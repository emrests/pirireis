// tests/world.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { World } from '../server/game/world.js';

function twoShips() {
  const w = new World('room1');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  const b = w.addShip({ id:'b', name:'B', faction:'navy',   cls:'sloop',   flagColor:'#00f' });
  a.pos = { x: 2000, y: 2000 };
  b.pos = { x: 2000, y: 2100 };
  return { w, a, b };
}

test('cannon fire damages an enemy in line', () => {
  const { w, b } = twoShips();
  const before = b.hp;
  w.input('a', { type:'fire', weapon:'cannon', dir:{ x:0, y:1 }, power:0.2 });
  for (let i = 0; i < 10; i++) w.step(50, 100 + i * 50);
  assert.ok(b.hp < before, 'enemy took damage');
});

test('friendly fire does nothing', () => {
  const w = new World('r');
  const a = w.addShip({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  const c = w.addShip({ id:'c', name:'C', faction:'pirate', cls:'sloop', flagColor:'#f00' });
  a.pos = { x:2000, y:2000 }; c.pos = { x:2000, y:2100 };
  const before = c.hp;
  w.input('a', { type:'fire', weapon:'cannon', dir:{x:0,y:1}, power:0.2 });
  for (let i = 0; i < 10; i++) w.step(50, 100 + i*50);
  assert.equal(c.hp, before);
});

test('destroying a base ends the game', () => {
  const { w } = twoShips();
  w.bases.navy.hp = 5;
  w.bases.navy.damage(5);      // base now dead
  const evs = w.step(50, 200); // step should notice + end
  assert.ok(w.over);
  assert.ok(evs.some((e) => e.type === 'gameOver'));
});
