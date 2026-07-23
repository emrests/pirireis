// tests/base.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Base } from '../server/game/base.js';
import { Ship } from '../server/game/ship.js';
import { BASE } from '../server/game/balance.js';

const shipAt = (x, y) => new Ship({ id:'p1', name:'A', faction:'pirate', cls:'frigate', flagColor:'#f00', pos:{x,y} });

test('heal only after waiting, and clamps to maxHp', () => {
  const b = new Base('pirate');
  const s = shipAt(b.pos.x, b.pos.y);
  s.hp = 50;
  b.updateHeal(s, 100, 1000);          // just entered, wait not elapsed
  assert.equal(s.hp, 50);
  b.updateHeal(s, BASE.healWaitMs, 1000 + BASE.healWaitMs + 1000); // waited + 1s
  assert.ok(s.hp > 50);
  s.hp = s.maxHp - 1;
  b.updateHeal(s, 5000, 999999);
  assert.equal(s.hp, s.maxHp);         // clamps
});

test('leaving zone resets healingSince', () => {
  const b = new Base('pirate');
  const s = shipAt(b.pos.x, b.pos.y);
  b.updateHeal(s, 100, 1000);
  assert.ok(s.healingSince !== null);
  s.pos = { x: b.pos.x + BASE.healRadius + 500, y: b.pos.y };
  b.updateHeal(s, 100, 2000);
  assert.equal(s.healingSince, null);
});

test('base dies at zero hp', () => {
  const b = new Base('navy');
  assert.equal(b.damage(BASE.hp - 1), false);
  assert.equal(b.damage(10), true);
  assert.equal(b.alive, false);
});

test('donation requires same faction near base', () => {
  const b = new Base('pirate');
  const a = new Ship({ id:'p1', name:'A', faction:'pirate', cls:'frigate', flagColor:'#f00', pos:{x: b.pos.x, y: b.pos.y} });
  const c = new Ship({ id:'p2', name:'C', faction:'pirate', cls:'frigate', flagColor:'#f00', pos:{x: b.pos.x + 50, y: b.pos.y} });
  assert.equal(b.canDonate(a, c), true);
  c.pos = { x: b.pos.x + 5000, y: b.pos.y };
  assert.equal(b.canDonate(a, c), false);
});
