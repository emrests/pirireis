// client/js/three/bases.js
// 3D harbor forts, one per faction, placed at the server base position (pirate
// left, navy right). Stone dock + towers + a faction banner + cannons, plus a
// soft pulsing healing-zone ring (radius 420 world units) on the water.
import * as THREE from '/vendor/three.module.js';

const HEAL_R = 420;

function buildFort(faction) {
  const g = new THREE.Group();
  const struct = new THREE.Group();          // the fort itself (shrunk, edge-shifted)
  const stone = new THREE.MeshStandardMaterial({ color: 0x8b8577, roughness: 0.95 });
  const darkStone = new THREE.MeshStandardMaterial({ color: 0x6f6a5e, roughness: 0.95 });
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3d24, roughness: 0.9 });
  const facColor = faction === 'pirate' ? 0xb5241d : 0x2f7fd0;
  const pierDir = faction === 'pirate' ? 1 : -1;  // +X = toward field centre

  // dock platform
  const dock = new THREE.Mesh(new THREE.BoxGeometry(220, 26, 300), stone);
  dock.position.y = 8; dock.castShadow = true; dock.receiveShadow = true; struct.add(dock);
  // pier out toward the sea (toward field centre)
  const pier = new THREE.Mesh(new THREE.BoxGeometry(180, 12, 60), wood);
  pier.position.set(pierDir * 190, 6, 0); pier.castShadow = true; struct.add(pier);

  // main keep
  const keep = new THREE.Mesh(new THREE.BoxGeometry(120, 130, 140), stone);
  keep.position.set(-pierDir * 30, 70, 0); keep.castShadow = true; struct.add(keep);
  // two towers
  for (const tz of [-110, 110]) {
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(34, 40, 170, 12), darkStone);
    tower.position.set(-pierDir * 40, 90, tz); tower.castShadow = true; struct.add(tower);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(44, 40, 12), new THREE.MeshStandardMaterial({ color: facColor, roughness: 0.7 }));
    cap.position.set(-pierDir * 40, 190, tz); struct.add(cap);
  }
  // banner pole + flag
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 150, 6), wood);
  pole.position.set(-pierDir * 30, 200, 0); struct.add(pole);
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(70, 46), new THREE.MeshStandardMaterial({ color: facColor, roughness: 0.7, side: THREE.DoubleSide, emissive: facColor, emissiveIntensity: 0.15 }));
  banner.position.set(-pierDir * 30 + 38, 235, 0); struct.add(banner);
  // a couple of cannons facing the field
  const cmat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.4, metalness: 0.6 });
  for (const cz of [-60, 60]) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(9, 11, 60, 8), cmat);
    c.rotation.z = Math.PI / 2; c.position.set(pierDir * 95, 26, cz); struct.add(c);
  }

  // shrink the fort and push it toward the map edge, so ships spawn (at base
  // centre) in open water in FRONT of the harbour instead of inside it.
  struct.scale.setScalar(0.55);
  struct.position.x = -pierDir * 210;
  g.add(struct);

  // pulsing heal ring on the water, kept centred on the base position
  const ringGeo = new THREE.RingGeometry(HEAL_R * 0.94, HEAL_R, 64);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: facColor, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.position.y = 2; g.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(HEAL_R, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: facColor, transparent: true, opacity: 0.06, depthWrite: false }));
  disc.position.y = 1.5; g.add(disc);

  return { group: g, banner, ring, ringMat, keep };
}

export class BaseManager {
  constructor(scene) { this.scene = scene; this.bases = new Map(); }

  update(list, tSec) {
    for (const b of list) {
      let e = this.bases.get(b.faction);
      if (!e) { e = buildFort(b.faction); this.scene.add(e.group); this.bases.set(b.faction, e); }
      e.group.position.set(b.x, 0, b.y);
      e.banner.rotation.y = Math.sin(tSec * 2) * 0.35;
      const pulse = 0.28 + 0.16 * (0.5 + 0.5 * Math.sin(tSec * 2.2));
      e.ringMat.opacity = b.alive ? pulse : 0.05;
      if (!b.alive) { e.keep.material.color.setHex(0x3a3a3a); e.group.rotation.z = 0.06; }
    }
  }
}
