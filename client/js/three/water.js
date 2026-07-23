// client/js/three/water.js
// Animated sea: a large plane displaced by the shared Gerstner waves, shaded
// with deep/shallow colour, sun specular, Fresnel rim and crest foam.
import * as THREE from '/vendor/three.module.js';
import { GERSTNER_GLSL, waveUniforms, WAVE_COUNT } from './waves.js';

export function createWater(worldW, worldH) {
  const W = worldW + 2000, H = worldH + 2000;
  const geo = new THREE.PlaneGeometry(W, H, 220, 220);
  geo.rotateX(-Math.PI / 2); // lie flat on XZ

  const u = waveUniforms();
  const dirVecs = [];
  for (let i = 0; i < WAVE_COUNT; i++) dirVecs.push(new THREE.Vector2(u.dir[i * 2], u.dir[i * 2 + 1]));
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime:   { value: 0 },
      uSun:    { value: new THREE.Vector3(-0.5, 0.8, 0.35).normalize() },
      uDeep:   { value: new THREE.Color('#14577a') },
      uShallow:{ value: new THREE.Color('#4bb0d0') },
      uFoam:   { value: new THREE.Color('#eaf7fb') },
      uCam:    { value: new THREE.Vector3() },
      uOffset: { value: new THREE.Vector2(worldW / 2, worldH / 2) },
      uWDir:   { value: dirVecs },
      uWA:     { value: u.A },
      uWW:     { value: u.w },
      uWSp:    { value: u.sp },
      uWQ:     { value: u.Q },
    },
    vertexShader: /* glsl */`
      uniform float uTime;
      uniform vec2 uOffset;
      ${GERSTNER_GLSL}
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
      void main() {
        vec3 nrm;
        // sample waves in WORLD space so ships (CPU waveHeight) match the surface
        vec3 disp = gerstner(position.xz + uOffset, uTime, nrm);
        vec3 local = vec3(position.x, 0.0, position.z) + disp;
        vWorld = local + vec3(uOffset.x, 0.0, uOffset.y);
        vNormal = nrm;
        vCrest = clamp(disp.y * 0.02 + 0.5, 0.0, 1.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(local, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform vec3 uSun, uDeep, uShallow, uFoam, uCam;
      varying vec3 vWorld;
      varying vec3 vNormal;
      varying float vCrest;
      void main() {
        vec3 N = normalize(vNormal);
        vec3 V = normalize(uCam - vWorld);
        vec3 L = normalize(uSun);
        // wave faces (where the normal tilts away from straight up) read lighter,
        // flat troughs stay deep -> the swell shows as real moving water.
        float upFace = clamp(N.y, 0.0, 1.0);
        float slope = 1.0 - upFace;
        vec3 col = mix(uDeep, uShallow, smoothstep(0.0, 0.4, slope));
        // sun diffuse (kept bright so open water stays a lively blue) + glints
        float diff = 0.82 + 0.28 * max(dot(N, L), 0.0);
        col *= diff;
        vec3 Hh = normalize(L + V);
        float spec = pow(max(dot(N, Hh), 0.0), 220.0);
        col += vec3(1.0, 0.97, 0.88) * spec;
        // gentle sky reflection at grazing angles
        float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
        col = mix(col, vec3(0.60, 0.76, 0.86), fres * 0.28);
        // thin foam only on the sharpest crests
        float foam = smoothstep(0.9, 1.0, vCrest);
        col = mix(col, uFoam, foam * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(worldW / 2, 0, worldH / 2);
  mesh.receiveShadow = false;
  return { mesh, material: mat };
}

export function updateWater(water, tSec, camPos) {
  water.material.uniforms.uTime.value = tSec;
  water.material.uniforms.uCam.value.copy(camPos);
}
