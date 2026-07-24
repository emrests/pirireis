// client/js/three/kraken.js
// A big neutral sea monster: a dark translucent mantle just under the surface
// with eight undulating arms. When it attacks, a bright arm rears up out of the
// water toward the doomed ship. Driven by server state {x,y,ang,atk,tx,ty}.
import * as THREE from '/vendor/three.module.js';
import { waveHeight } from './waves.js';

const SPH = new THREE.SphereGeometry(1, 10, 8);
const ARM_N = 7;

export class KrakenView {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group(); this.group.visible = false; scene.add(this.group);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a1740, roughness: 0.7, transparent: true, opacity: 0.85, emissive: 0x1a0030, emissiveIntensity: 0.35 });
    this.mantle = new THREE.Mesh(SPH, bodyMat);
    this.mantle.scale.set(120, 70, 165); this.mantle.position.y = 8; this.group.add(this.mantle);
    const brow = new THREE.Mesh(SPH, bodyMat); brow.scale.set(90, 46, 60); brow.position.set(0, 26, 90); this.group.add(brow);

    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffe7a0, emissive: 0xffb020, emissiveIntensity: 1.6 });
    this.eyes = [];
    for (const ex of [-46, 46]) { const e = new THREE.Mesh(SPH, eyeMat.clone()); e.scale.setScalar(13); e.position.set(ex, 34, 110); this.group.add(e); this.eyes.push(e); }

    this.arms = [];
    const armMat = new THREE.MeshStandardMaterial({ color: 0x33204a, roughness: 0.78, transparent: true, opacity: 0.8 });
    for (let i = 0; i < 8; i++) {
      const baseAng = (i / 8) * Math.PI * 2;
      const segs = [];
      for (let j = 0; j < ARM_N; j++) {
        const m = new THREE.Mesh(SPH, armMat);
        m.scale.setScalar(26 * (1 - j / ARM_N) + 7);
        this.group.add(m); segs.push(m);
      }
      this.arms.push({ baseAng, segs });
    }

    // separate world-space "grab" arm used during an attack
    this.grab = new THREE.Group(); this.grab.visible = false; scene.add(this.grab);
    this.grabMat = new THREE.MeshStandardMaterial({ color: 0x4a2d63, roughness: 0.7, emissive: 0x6a1030, emissiveIntensity: 0.5 });
    this.grabSegs = [];
    for (let j = 0; j < 9; j++) { const m = new THREE.Mesh(SPH, this.grabMat); m.scale.setScalar(30 * (1 - j / 9) + 8); this.grab.add(m); this.grabSegs.push(m); }
  }

  update(k, tSec) {
    if (!k) { this.group.visible = false; this.grab.visible = false; return; }
    this.group.visible = true;
    const wy = waveHeight(k.x, k.y, tSec);
    this.group.position.set(k.x, wy, k.y);
    this.group.rotation.y = -k.ang;
    this.mantle.position.y = 6 + Math.sin(tSec * 0.8) * 4;
    const ei = k.atk ? 2.6 : 1.4;
    for (const e of this.eyes) e.material.emissiveIntensity = ei;

    for (const arm of this.arms) {
      for (let j = 0; j < arm.segs.length; j++) {
        const r = 90 + j * 48;
        const ang = arm.baseAng + Math.sin(tSec * 2.4 + arm.baseAng * 2 + j * 0.6) * 0.45;
        const lift = -4 - j * 2 + Math.sin(tSec * 3.4 + j + arm.baseAng) * 7;
        arm.segs[j].position.set(Math.cos(ang) * r, lift, Math.sin(ang) * r);
      }
    }

    // attack: rear a bright arm up out of the water toward the target ship
    if (k.atk) {
      this.grab.visible = true;
      const sx = k.x, sz = k.y, ex = k.tx, ez = k.ty;
      const peak = 120;
      for (let j = 0; j < this.grabSegs.length; j++) {
        const t = j / (this.grabSegs.length - 1);
        const x = sx + (ex - sx) * t, z = sz + (ez - sz) * t;
        const y = waveHeight(x, z, tSec) + Math.sin(t * Math.PI) * peak + 6;
        this.grabSegs[j].position.set(x, y, z);
      }
    } else {
      this.grab.visible = false;
    }
  }
}
