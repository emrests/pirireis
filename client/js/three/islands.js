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

const LEAF_MATS = [0x2f6d3a, 0x357a41, 0x28613a, 0x3e8a4a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
const TRUNK_MAT = new THREE.MeshStandardMaterial({ color: 0x5b3d24, roughness: 0.9 });

// a conifer-style tree (stacked cones)
function pineTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3, 22, 6), TRUNK_MAT);
  trunk.position.y = 11; trunk.castShadow = true; g.add(trunk);
  const leaf = LEAF_MATS[(Math.random() * LEAF_MATS.length) | 0];
  for (let i = 0; i < 3; i++) {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(15 - i * 3, 16, 7), leaf);
    cone.position.y = 22 + i * 9; cone.castShadow = true; g.add(cone);
  }
  return g;
}

// a palm-style tree (bare trunk + a round canopy)
function palmTree() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.6, 34, 6), new THREE.MeshStandardMaterial({ color: 0x7a5a30, roughness: 0.9 }));
  trunk.position.y = 17; trunk.rotation.z = (Math.random() - 0.5) * 0.3; trunk.castShadow = true; g.add(trunk);
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(13, 8, 6), LEAF_MATS[(Math.random() * LEAF_MATS.length) | 0]);
  canopy.position.y = 36; canopy.scale.y = 0.6; canopy.castShadow = true; g.add(canopy);
  return g;
}

function tree() { return Math.random() < 0.5 ? pineTree() : palmTree(); }

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

    // height of the mound's top surface at radius rr (mound mesh sits at y=2,
    // cylinder half-height r*0.45, plus the domed displacement) — objects must
    // sit ON this, not on the flat base, or they get buried in the hill.
    const surfaceY = (rr) => 2 + isl.r * 0.45 + Math.max(0, 1 - (rr / isl.r) ** 2) * isl.r * 0.5;

    // dense vegetation + rocks scattered inside
    const n = Math.round(isl.r / 14);
    for (let i = 0; i < n; i++) {
      const ang = i * 2.399963 + isl.x * 0.01;
      const rr = isl.r * (0.08 + 0.78 * ((i * 13) % 7) / 7);
      const px = Math.cos(ang) * rr, pz = Math.sin(ang) * rr;
      const y = surfaceY(rr);
      const roll = (i * 7) % 10;
      if (roll < 2) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(7 + roll * 3), rockMat);
        rock.position.set(px, y + 3, pz); rock.rotation.set(roll, roll * 1.3, 0); rock.castShadow = true; grp.add(rock);
      } else {
        const t = tree();
        t.position.set(px, y - 3, pz);
        t.scale.setScalar((1.3 + ((i * 3) % 5) * 0.18) * (isl.r / 210));
        grp.add(t);
      }
    }
    root.add(grp);
  }
  return root;
}
