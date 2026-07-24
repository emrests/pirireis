// client/js/three/waves.js
// Single source of truth for the sea surface. The SAME Gerstner-wave
// parameters drive both the GPU water shader (vertex displacement) and the
// CPU helpers below, so ships float on exactly the surface you see.
//
// World mapping: X = world.x, Z = world.y, Y = up. Water rests around Y = 0.

// Human-friendly wave definitions -> derived params.
// dir: 2D direction in the XZ plane. len: wavelength (world units).
// amp: crest height. speed: phase speed. steep: 0..1 Gerstner steepness.
// Smaller, more numerous swell — reads as sea texture, not giant rollers.
const DEFS = [
  { dir: [ 1.0,  0.35], len: 300, amp: 4.6, speed: 22, steep: 0.5  },
  { dir: [-0.6,  1.0 ], len: 210, amp: 3.2, speed: 18, steep: 0.45 },
  { dir: [ 0.4, -0.9 ], len: 140, amp: 2.1, speed: 15, steep: 0.4  },
  { dir: [-1.0, -0.2 ], len: 95,  amp: 1.4, speed: 12, steep: 0.38 },
  { dir: [ 0.7,  0.7 ], len: 65,  amp: 0.9, speed: 10, steep: 0.35 },
];

export const WAVE_COUNT = DEFS.length;

// runtime toggle: calm sea (off) is flat + much cheaper for weak browsers
export const waveCfg = { on: true };

// Flatten into typed uniform arrays. Each wave: dir(unit) Dx,Dz; w=2π/len;
// A=amp; speed(phase per sec); Q=steepness/(w*A*count) so summed crests never loop.
export const WAVES = DEFS.map((d) => {
  const l = Math.hypot(d.dir[0], d.dir[1]) || 1;
  const dx = d.dir[0] / l, dz = d.dir[1] / l;
  const w = (2 * Math.PI) / d.len;
  const Q = d.steep / (w * d.amp * WAVE_COUNT);
  return { dx, dz, A: d.amp, w, speed: d.speed * w, Q };
});

// Uniform-ready arrays for the shader.
export function waveUniforms() {
  const dir = [], A = [], w = [], sp = [], Q = [];
  for (const v of WAVES) { dir.push(v.dx, v.dz); A.push(v.A); w.push(v.w); sp.push(v.speed); Q.push(v.Q); }
  return { dir, A, w, sp, Q };
}

// CPU: vertical height of the surface at world (x, z) and time t (seconds).
export function waveHeight(x, z, t) {
  if (!waveCfg.on) return 0;
  let y = 0;
  for (const v of WAVES) {
    const phase = v.w * (v.dx * x + v.dz * z) + v.speed * t;
    y += v.A * Math.sin(phase);
  }
  return y;
}

// CPU: approximate surface normal (unit) at world (x, z) via finite differences.
export function waveNormal(x, z, t, e = 6) {
  if (!waveCfg.on) return { x: 0, y: 1, z: 0 };
  const hL = waveHeight(x - e, z, t), hR = waveHeight(x + e, z, t);
  const hD = waveHeight(x, z - e, t), hU = waveHeight(x, z + e, t);
  const nx = hL - hR;
  const nz = hD - hU;
  const ny = 2 * e;
  const inv = 1 / Math.hypot(nx, ny, nz);
  return { x: nx * inv, y: ny * inv, z: nz * inv };
}

// GLSL shared by the water shader. Expects uniform arrays uWDir/uWA/uWW/uWSp/uWQ
// and const WAVE_COUNT. Fills displaced position + normal.
export const GERSTNER_GLSL = /* glsl */`
#define WAVE_COUNT ${WAVE_COUNT}
uniform vec2 uWDir[WAVE_COUNT];
uniform float uWA[WAVE_COUNT];
uniform float uWW[WAVE_COUNT];
uniform float uWSp[WAVE_COUNT];
uniform float uWQ[WAVE_COUNT];

vec3 gerstner(vec2 p, float t, out vec3 nrm) {
  vec3 disp = vec3(p.x, 0.0, p.y);
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  for (int i = 0; i < WAVE_COUNT; i++) {
    vec2 d = uWDir[i];
    float A = uWA[i];
    float w = uWW[i];
    float Q = uWQ[i];
    float phase = w * dot(d, p) + uWSp[i] * t;
    float c = cos(phase);
    float s = sin(phase);
    disp.x += Q * A * d.x * c;
    disp.z += Q * A * d.y * c;
    disp.y += A * s;
    float wa = w * A;
    tangent  += vec3(-Q * d.x * d.x * wa * s, d.x * wa * c, -Q * d.x * d.y * wa * s);
    binormal += vec3(-Q * d.x * d.y * wa * s, d.y * wa * c, -Q * d.y * d.y * wa * s);
  }
  nrm = normalize(cross(binormal, tangent));
  return disp;
}
`;
