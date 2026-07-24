// client/js/render.js
// Real 3D WebGL renderer (Three.js). An Age-of-Empires-style orthographic
// camera looks over a Gerstner-wave sea at floating 3D ships, terrain islands
// and harbour forts. Same public surface the rest of the client already uses:
//   new Renderer(canvas) · resize() · draw(state, cam, meId)
//   + screenToWorld(clientX, clientY) -> {x, y}  (raycast onto the water plane)
import * as THREE from '/vendor/three.module.js';
import { createWater, updateWater } from './three/water.js';
import { ShipManager } from './three/ships.js';
import { createIslands } from './three/islands.js';
import { BaseManager } from './three/bases.js';
import { ProjectileManager } from './three/projectiles.js';
import { FishManager } from './three/fish.js';
import { KrakenView } from './three/kraken.js';
import { FxManager } from './three/fx.js';
import { drawHUD } from './three/hud.js';
import { waveHeight, waveCfg } from './three/waves.js';

const WORLD = 4000;

// height above the waterline to float each class's HP bar (clears the masts)
const SHIP_TOP = {
  sloop:95, cutter:95, brig:115, corvette:115, frigate:125, frigate_n:125,
  galleon:165, shipofline:170, fireship:125, bombketch:130, boat:55,
};
// cannon range per class (mirrors balance SHIPS.range)
const WEAPON_RANGE = {
  sloop:520, brig:620, frigate:680, galleon:820, fireship:520,
  cutter:520, corvette:700, frigate_n:700, shipofline:860, bombketch:1100,
};

// Island list mirrors server/game/map.js (kept in sync manually).
export const ISLANDS = [
  { x:2000,y:2000,r:300 }, { x:1350,y:1150,r:210 }, { x:2650,y:1150,r:210 },
  { x:1350,y:2850,r:210 }, { x:2650,y:2850,r:210 },
];

// AoE-ish view: elevation ~34°, azimuth 45° -> fixed diagonal top-down angle.
const CAM_DIR = new THREE.Vector3(0.58, 0.66, 0.58).normalize();
const CAM_DIST = 3000;
const BASE_VIEW = 580; // ortho half-height in world units (zoomed for a small arena)

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#afd4e6');
    // fog starts past the camera-to-target distance so the foreground stays
    // crisp (ortho cam sits ~CAM_DIST away); only far map edges haze out.
    this.scene.fog = new THREE.Fog('#afd4e6', 4300, 9000);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 12000);

    // lights
    const hemi = new THREE.HemisphereLight('#dff0ff', '#2b4a3a', 0.9);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight('#fff3d6', 1.35);
    this.sun.position.set(-1, 1.6, 0.7).multiplyScalar(1000);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -1400; sc.right = 1400; sc.top = 1400; sc.bottom = -1400; sc.near = 100; sc.far = 4000;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // world
    this.water = createWater(WORLD, WORLD);
    this.scene.add(this.water.mesh);
    this.scene.add(createIslands(ISLANDS));
    this.fx = new FxManager(this.scene);
    this.ships = new ShipManager(this.scene, this.fx);
    this.bases = new BaseManager(this.scene);
    this.proj = new ProjectileManager(this.scene, this.fx);
    this.fish = new FishManager(this.scene);
    this.krakenView = new KrakenView(this.scene);

    // client-side ability cooldown clocks (updated by Input via markAbility)
    this.abilities = { cannon: 0, rifle: 0, molotov: 0, heal: 0 };
    this._lastT = performance.now();

    // move-destination marker (right-click; only this client sees it)
    this.targetPoint = null;
    const rg = new THREE.RingGeometry(40, 58, 28); rg.rotateX(-Math.PI / 2);
    this.reticle = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x8affa0, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
    this.reticle.visible = false; this.scene.add(this.reticle);

    // selected-weapon range ring around own ship
    this.selectedWeapon = 'cannon';
    const rr = new THREE.RingGeometry(0.986, 1, 72); rr.rotateX(-Math.PI / 2);
    this.rangeRing = new THREE.Mesh(rr, new THREE.MeshBasicMaterial({ color: 0x66e0ff, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }));
    this.rangeRing.visible = false; this.scene.add(this.rangeRing);

    // 2D HUD overlay above the WebGL canvas
    this.hud = document.createElement('canvas');
    this.hud.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;';
    document.body.appendChild(this.hud);
    this.hctx = this.hud.getContext('2d');

    this.ray = new THREE.Raycaster();
    this.seaPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._camTarget = new THREE.Vector3(WORLD / 2, 0, WORLD / 2);

    this.resize();
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.hud.width = w; this.hud.height = h;
    this._aspect = w / h;
    this._applyFrustum(1);
  }

  _applyFrustum(scale) {
    const vh = BASE_VIEW / scale;
    const vw = vh * this._aspect;
    const c = this.camera;
    c.left = -vw; c.right = vw; c.top = vh; c.bottom = -vh;
    c.updateProjectionMatrix();
  }

  markAbility(name) { if (name in this.abilities) this.abilities[name] = performance.now(); }
  setMoveMarker(p) { this.targetPoint = { x: p.x, y: p.y }; }
  setWeapon(w) { this.selectedWeapon = w; }
  setWaves(on) { waveCfg.on = !!on; }
  _weaponRange(cls) {
    if (this.selectedWeapon === 'rifle') return 660;
    if (this.selectedWeapon === 'molotov') return 600;
    return WEAPON_RANGE[cls] || 700;
  }

  // floating HP bars + names above every ship and base, projected to the overlay
  _floatingBars(state, t) {
    const ctx = this.hctx, W = this.hud.width, H = this.hud.height;
    const v = new THREE.Vector3();
    ctx.textAlign = 'center';
    const bar = (wx, wz, topY, hp, maxHp, name, big, tint) => {
      v.set(wx, topY, wz).project(this.camera);
      if (v.z > 1) return;
      const sx = (v.x * 0.5 + 0.5) * W, sy = (-v.y * 0.5 + 0.5) * H;
      if (sx < -80 || sx > W + 80 || sy < -40 || sy > H + 40) return;
      const bw = big ? 96 : 56, bh = big ? 8 : 6, x = sx - bw / 2, y = sy;
      const frac = Math.max(0, Math.min(1, hp / maxHp));
      if (name) {
        ctx.font = big ? '700 12px system-ui' : '600 11px system-ui';
        ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(name, sx, y - 6);
        ctx.fillStyle = tint || '#fff'; ctx.fillText(name, sx, y - 6);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 1, y - 1, bw + 2, bh + 2);
      ctx.fillStyle = frac > 0.5 ? '#4caf50' : frac > 0.25 ? '#ffb300' : '#e53935';
      ctx.fillRect(x, y, bw * frac, bh);
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.strokeRect(x, y, bw, bh);
      ctx.font = '9px system-ui'; ctx.fillStyle = '#dfe';
      ctx.fillText(`${Math.round(hp)}/${maxHp}`, sx, y + bh + 9);
    };
    for (const s of state.ships) {
      if (!s.alive) continue;
      const top = waveHeight(s.x, s.y, t) + (SHIP_TOP[s.cls] || 120);
      bar(s.x, s.y, top, s.hp, s.maxHp, s.name, false, s.faction === 'pirate' ? '#ff9d8a' : '#9ad1ff');
    }
    for (const b of state.bases) {
      if (!b.alive) continue;
      bar(b.x, b.y, 210, b.hp, b.maxHp, b.faction === 'pirate' ? 'Korsan Üssü' : 'Donanma Üssü', true, b.faction === 'pirate' ? '#ff9d8a' : '#9ad1ff');
    }
  }

  draw(state, cam, meId) {
    const now = performance.now();
    const t = now / 1000;
    const dt = Math.min(0.05, (now - this._lastT) / 1000); this._lastT = now;

    // camera follows the player, fixed AoE angle
    this._camTarget.set(cam.x, 0, cam.y);
    this._applyFrustum(cam.scale || 1);
    this.camera.position.copy(this._camTarget).addScaledVector(CAM_DIR, CAM_DIST);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(this._camTarget);
    this.camera.updateMatrixWorld();
    // keep the sun shadow box over the action
    this.sun.position.copy(this._camTarget).add(new THREE.Vector3(-900, 1500, 650));
    this.sun.target.position.copy(this._camTarget);
    this.sun.target.updateMatrixWorld();

    updateWater(this.water, t, this.camera.position);
    this.ships.update(state.ships, t, now);
    this.bases.update(state.bases, t);
    this.proj.update(state.projectiles, state.fires, state.ships, t, now);
    this.fish.update(t, dt);
    this.krakenView.update(state.kraken, t);
    this.fx.update(dt, now);

    // aim target marker (pulses on the water)
    if (this.targetPoint) {
      this.reticle.visible = true;
      this.reticle.position.set(this.targetPoint.x, 18, this.targetPoint.y);
      this.reticle.rotation.y = t * 1.5;
      this.reticle.scale.setScalar(1 + 0.12 * Math.sin(t * 5));
    }
    // range ring for the selected weapon, around own ship
    const meShip = state.ships.find((s) => s.id === meId);
    if (meShip && meShip.alive) {
      this.rangeRing.visible = true;
      this.rangeRing.position.set(meShip.x, 17, meShip.y);
      this.rangeRing.scale.setScalar(this._weaponRange(meShip.cls));
    } else { this.rangeRing.visible = false; }

    this.renderer.render(this.scene, this.camera);
    drawHUD(this.hctx, this.hud.width, this.hud.height, state, meId, ISLANDS, this.abilities, now, this.selectedWeapon);
    this._floatingBars(state, t);
  }

  // Screen pixel -> world (x, y) by casting a ray onto the sea plane (Y=0).
  screenToWorld(clientX, clientY) {
    const ndc = new THREE.Vector2(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    this.ray.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    this.ray.ray.intersectPlane(this.seaPlane, hit);
    if (!hit) return { x: this._camTarget.x, y: this._camTarget.z };
    return { x: hit.x, y: hit.z };
  }
}
