import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ship } from '../server/game/ship.js';
import { FULLSAILS_RESIST } from '../server/game/balance.js';

function mk() {
  return new Ship({ id:'p1', name:'A', faction:'pirate', cls:'sloop', flagColor:'#f00', pos:{x:500,y:500} });
}

test('ship inits from stat table', () => {
  const s = mk();
  assert.equal(s.hp, 80);
  assert.equal(s.maxHp, 80);
  assert.ok(s.alive);
  assert.ok(s.radius > 0);
});

test('ship moves toward target and stops', () => {
  const s = mk();
  s.setTarget(1000, 500);
  for (let i = 0; i < 200; i++) s.step(50);
  assert.ok(Math.abs(s.pos.x - 1000) < 5);
  assert.equal(s.target, null);
});

test('damage kills at zero and reports death once', () => {
  const s = mk();
  assert.equal(s.damage(50), false);
  assert.equal(s.damage(50), true);   // crosses to <=0 -> died
  assert.equal(s.alive, false);
  assert.equal(s.damage(10), false);  // already dead, not "died this call"
});

test('fullsails buff reduces damage taken by 25%', () => {
  const s = mk();
  s.buffs.push({ type: 'fullsails', until: 999999 });
  const before = s.hp;
  s.damage(40);
  const expectedLoss = 40 * (1 - FULLSAILS_RESIST);
  assert.equal(before - s.hp, expectedLoss);
});
