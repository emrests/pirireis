import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cannonDamage, makeCannon, Projectile } from '../server/game/weapons.js';
import { Ship } from '../server/game/ship.js';
import { CANNON } from '../server/game/balance.js';

test('cannon damage falls off with distance', () => {
  const base = 40, range = 800;
  assert.equal(cannonDamage(base, 0, range), 40);
  assert.equal(Math.round(cannonDamage(base, 800, range)), Math.round(base * CANNON.minDmgFactor));
  assert.ok(cannonDamage(base, 400, range) < 40 && cannonDamage(base, 400, range) > base * CANNON.minDmgFactor);
});

test('makeCannon: closer aim (low power) deals more damage than far aim', () => {
  const s = new Ship({ id:'p1', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00', pos:{x:0,y:0} });
  const near = makeCannon(s, { x:1, y:0 }, 0.2);
  const far  = makeCannon(s, { x:1, y:0 }, 1.0);
  assert.ok(near.dmg > far.dmg);
});

test('projectile expires after its life', () => {
  const p = new Projectile({ id:'x', kind:'cannon', owner:'p1', faction:'pirate', pos:{x:0,y:0}, vel:{x:100,y:0}, dmg:10, life:100, pierce:false });
  assert.equal(p.step(50), null);
  assert.equal(p.step(60), 'expired');
});
