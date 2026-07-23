// tests/skills.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addBuff, expireBuffs, onKill, onArcherKill, resetStreak, cooldownFactor } from '../server/game/skills.js';
import { Ship } from '../server/game/ship.js';

const mk = () => new Ship({ id:'p1', name:'A', faction:'pirate', cls:'frigate', flagColor:'#f00', pos:{x:0,y:0} });

test('buffs expire on time', () => {
  const s = mk();
  addBuff(s, 'fastreload', 1000);
  assert.ok(s.hasBuff('fastreload'));
  expireBuffs(s, 1000 + 11999);
  assert.ok(s.hasBuff('fastreload'));
  expireBuffs(s, 1000 + 12001);
  assert.ok(!s.hasBuff('fastreload'));
});

test('kill streak grants tiered buffs', () => {
  const s = mk();
  let g = [];
  for (let i = 0; i < 3; i++) g = onKill(s, 1, 1000);
  assert.ok(g.includes('fastreload'));
  for (let i = 3; i < 5; i++) g = onKill(s, 1, 1000);
  assert.ok(g.includes('broadside'));
});

test('multi-kill grants chainshot/shockwave', () => {
  const s = mk();
  const g2 = onKill(s, 2, 1000);
  assert.ok(g2.includes('chainshot'));
  const g3 = onKill(s, 3, 1000);
  assert.ok(g3.includes('shockwave'));
});

test('death resets streak', () => {
  const s = mk();
  onKill(s, 1, 1000); onKill(s, 1, 1000);
  resetStreak(s);
  assert.equal(s.streak, 0);
});

test('cooldownFactor reflects fastreload', () => {
  const s = mk();
  assert.equal(cooldownFactor(s), 1);
  addBuff(s, 'fastreload', 0);
  assert.equal(cooldownFactor(s), 0.6);
});
