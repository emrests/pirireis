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
import { drawHUD } from './three/hud.js';

const WORLD = 4000;

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
    this.ships = new ShipManager(this.scene);
    this.bases = new BaseManager(this.scene);
    this.proj = new ProjectileManager(this.scene);
    this.fish = new FishManager(this.scene);

    // client-side ability cooldown clocks (updated by Input via markAbility)
    this.abilities = { cannon: 0, archer: 0, molotov: 0, donate: 0 };
    this._lastT = performance.now();

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
    this.proj.update(state.projectiles, state.fires, t, now);
    this.fish.update(t, dt);

    this.renderer.render(this.scene, this.camera);
    drawHUD(this.hctx, this.hud.width, this.hud.height, state, meId, ISLANDS, this.abilities, now);
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
