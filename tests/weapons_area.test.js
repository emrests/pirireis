import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeArcherVolley, makeMolotov, FireArea } from '../server/game/weapons.js';
import { Ship } from '../server/game/ship.js';
import { ARCHER } from '../server/game/balance.js';

const mk = (cls) => new Ship({ id:'p1', name:'A', faction:'pirate', cls, flagColor:'#f00', pos:{x:0,y:0} });

test('archer volley fans multiple arrows', () => {
  const arrows = makeArcherVolley(mk('brig'), { x:1, y:0 });
  assert.equal(arrows.length, ARCHER.arrows);
  assert.ok(arrows.every((a) => a.kind === 'arrow' && a.dmg === ARCHER.dmg));
});

test('fireship molotov is bigger than a normal ship', () => {
  const normal = makeMolotov(mk('frigate'), { x:200, y:0 });
  const fire = makeMolotov(mk('fireship'), { x:200, y:0 });
  assert.ok(fire.radius > normal.radius);
});

test('FireArea contains + expires', () => {
  const f = new FireArea({ id:'f', owner:'p1', faction:'pirate', pos:{x:0,y:0}, radius:100, life:1000, dotPerSec:20, burst:0 });
  assert.equal(f.contains({ x:50, y:0 }), true);
  assert.equal(f.contains({ x:200, y:0 }), false);
  assert.equal(f.step(500), null);
  assert.equal(f.step(600), 'expired');
});
