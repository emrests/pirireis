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

const SKIN = [0xe8b98f, 0xc98c5a, 0x8d5a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
const SHIRT = [0xb5241d, 0x2f7fd0, 0xd7c14a, 0x4a8a44, 0xcccccc].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));

// a tiny low-poly islander (torso + head), added to make islands feel inhabited
function person() {
  const g = new THREE.Group();
  const legs = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a3a44, roughness: 0.9 }));
  legs.position.y = 4; legs.castShadow = true; g.add(legs);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.6, 10, 6), SHIRT[(Math.random() * SHIRT.length) | 0]);
  torso.position.y = 13; torso.castShadow = true; g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(3.2, 8, 8), SKIN[(Math.random() * SKIN.length) | 0]);
  head.position.y = 20.5; head.castShadow = true; g.add(head);
  g.rotation.y = Math.random() * Math.PI * 2;
  g.scale.setScalar(1.4);
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

    // dense vegetation + rocks + a few islanders (NPCs) scattered inside
    const n = Math.round(isl.r / 16);
    const people = Math.max(2, Math.round(isl.r / 90));
    for (let i = 0; i < n; i++) {
      // pseudo-random but stable placement
      const ang = i * 2.399963 + isl.x * 0.01;
      const rr = isl.r * (0.1 + 0.72 * ((i * 13) % 7) / 7);
      const px = Math.cos(ang) * rr, pz = Math.sin(ang) * rr;
      const dome = Math.max(0, 1 - (rr / isl.r) ** 2) * isl.r * 0.5;
      const roll = (i * 7) % 10;
      if (roll < 2) {
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(5 + roll * 2), rockMat);
        rock.position.set(px, dome + 3, pz); rock.rotation.set(roll, roll * 1.3, 0); rock.castShadow = true; grp.add(rock);
      } else {
        const t = tree();
        t.position.set(px, dome + 2, pz);
        t.scale.setScalar(0.75 + ((i * 3) % 5) * 0.14);
        grp.add(t);
      }
    }
    for (let i = 0; i < people; i++) {
      const ang = i * 1.7 + isl.y * 0.01;
      const rr = isl.r * (0.12 + 0.4 * ((i * 5) % 4) / 4);
      const px = Math.cos(ang) * rr, pz = Math.sin(ang) * rr;
      const dome = Math.max(0, 1 - (rr / isl.r) ** 2) * isl.r * 0.5;
      const p = person();
      p.position.set(px, dome + 2, pz);
      grp.add(p);
    }
    root.add(grp);
  }
  return root;
}
