// client/js/three/fish.js
// Living sea: schools of fish. "Surface" fish are little 3D bodies riding the
// wave surface; "deep" fish are darker translucent silhouettes gliding just
// under the surface (from the top-down camera you read them as fish below the
// water). All wander gently and wrap inside the world.
import * as THREE from '/vendor/three.module.js';
import { waveHeight } from './waves.js';

const MARGIN = 250;
const LO = MARGIN, HI = 4000 - MARGIN;

function surfaceFish() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(6, 8, 8),
    new THREE.MeshStandardMaterial({ color: 0xb9c6d0, roughness: 0.5, metalness: 0.2 })
  );
  body.scale.set(2.4, 1, 1);
  g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(4.5, 9, 5), new THREE.MeshStandardMaterial({ color: 0x9fb0bc, roughness: 0.6 }));
  tail.rotation.z = Math.PI / 2; tail.position.x = -15; g.add(tail);
  return g;
}

function deepFish() {
  // flat elongated silhouette laid on the surface, dark + translucent
  const geo = new THREE.CircleGeometry(9, 14);
  geo.scale(2.2, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x08344a, transparent: true, opacity: 0.4, depthWrite: false });
  return new THREE.Mesh(geo, mat);
}

export class FishManager {
  constructor(scene, { surface = 26, deep = 44 } = {}) {
    this.scene = scene;
    this.fish = [];
    for (let i = 0; i < surface; i++) this._add(surfaceFish(), false);
    for (let i = 0; i < deep; i++) this._add(deepFish(), true);
  }

  _add(mesh, deep) {
    this.scene.add(mesh);
    this.fish.push({
      mesh, deep,
      x: LO + Math.random() * (HI - LO),
      z: LO + Math.random() * (HI - LO),
      ang: Math.random() * Math.PI * 2,
      speed: (deep ? 24 : 34) + Math.random() * 22,
      phase: Math.random() * 6.28,
      subY: deep ? -(18 + Math.random() * 30) : 0,
    });
  }

  update(tSec, dt) {
    const step = Math.min(dt, 0.05);
    for (const f of this.fish) {
      // gentle wander + steer back from the edges
      f.ang += Math.sin(tSec * 0.7 + f.phase) * 0.03;
      if (f.x < LO) f.ang = 0; else if (f.x > HI) f.ang = Math.PI;
      if (f.z < LO) f.ang = Math.PI / 2; else if (f.z > HI) f.ang = -Math.PI / 2;
      const vx = Math.cos(f.ang), vz = Math.sin(f.ang);
      f.x += vx * f.speed * step;
      f.z += vz * f.speed * step;
      const h = waveHeight(f.x, f.z, tSec);
      f.mesh.position.set(f.x, h + (f.deep ? 1.5 : -1.5), f.z);
      f.mesh.rotation.y = -f.ang;
      if (!f.deep) f.mesh.rotation.z = Math.sin(tSec * 8 + f.phase) * 0.18; // tail wiggle
    }
  }
}
