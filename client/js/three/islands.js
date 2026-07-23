// client/js/three/islands.js
// Static 3D islands at the (server-mirrored) ISLANDS coords: a noisy sand/grass
// mound rising from the seabed, a beach ring, a foam surf band at the waterline,
// plus a few trees and rocks. Built once and added to the scene.
import * as THREE from '/vendor/three.module.js';

function moundGeometry(r) {
  const g = new THREE.CylinderGeometry(r * 0.98, r * 1.15, r * 0.9, 40, 6);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const rad = Math.hypot(v.x, v.z) / r;
    // dome up toward the centre, roughen with cheap trig noise
    const dome = Math.max(0, 1 - rad * rad) * r * 0.5;
    const noise = (Math.sin(v.x * 0.06) + Math.cos(v.z * 0.055) + Math.sin((v.x + v.z) * 0.03)) * r * 0.03;
    p.setY(i, v.y + dome + noise);
  }
  g.computeVertexNormals();
  return g;
}

function tree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 22, 6), new THREE.MeshStandardMaterial({ color: 0x5b3d24, roughness: 0.9 }));
  trunk.position.y = 11; trunk.castShadow = true; g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f6d3a, roughness: 0.85 });
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(15 - i * 3, 16, 7), leafMat);
    cone.position.y = 22 + i * 9; cone.castShadow = true; g.add(cone);
  }
  return g;
}

export function createIslands(list) {
  const root = new THREE.Group();
  const sandMat = new THREE.MeshStandardMaterial({ color: 0xcdb98a, roughness: 1 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4e8a44, roughness: 0.95 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x7d7a72, roughness: 1 });

  for (const isl of list) {
    const grp = new THREE.Group();
    grp.position.set(isl.x, 0, isl.y);

    // beach base (sand), slightly wider than collision radius
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(isl.r * 1.15, isl.r * 1.2, 8, 40), sandMat);
    beach.position.y = -1; beach.receiveShadow = true; grp.add(beach);

    // grassy mound
    const mound = new THREE.Mesh(moundGeometry(isl.r), grassMat);
    mound.position.y = 2; mound.castShadow = true; mound.receiveShadow = true; grp.add(mound);

    // foam surf band at the waterline
    const surfGeo = new THREE.RingGeometry(isl.r * 1.12, isl.r * 1.34, 48);
    surfGeo.rotateX(-Math.PI / 2);
    const surf = new THREE.Mesh(surfGeo, new THREE.MeshBasicMaterial({ color: 0xe8f6f8, transparent: true, opacity: 0.45, depthWrite: false }));
    surf.position.y = 1.2; grp.add(surf);

    // vegetation + rocks scattered inside
    const n = Math.round(isl.r / 40);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * 6.283 + isl.x;
      const rr = isl.r * (0.15 + 0.5 * ((i * 7) % 5) / 5);
      const px = Math.cos(ang) * rr, pz = Math.sin(ang) * rr;
      const dome = Math.max(0, 1 - (rr / isl.r) ** 2) * isl.r * 0.5;
      if (i % 3 === 0) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + (i % 3) * 3), rockMat);
        rock.position.set(px, dome + 3, pz); rock.castShadow = true; grp.add(rock);
      } else {
        const t = tree();
        t.position.set(px, dome + 2, pz);
        t.scale.setScalar(0.8 + ((i * 3) % 4) * 0.15);
        grp.add(t);
      }
    }
    root.add(grp);
  }
  return root;
}
