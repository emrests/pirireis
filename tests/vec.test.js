// tests/vec.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, sub, scale, len, dist, norm, clamp, lerp } from '../server/game/vec.js';

test('vec basics', () => {
  assert.deepEqual(add({x:1,y:2}, {x:3,y:4}), {x:4,y:6});
  assert.deepEqual(sub({x:3,y:4}, {x:1,y:1}), {x:2,y:3});
  assert.deepEqual(scale({x:2,y:3}, 2), {x:4,y:6});
  assert.equal(len({x:3,y:4}), 5);
  assert.equal(dist({x:0,y:0}, {x:3,y:4}), 5);
  const n = norm({x:3,y:4});
  assert.ok(Math.abs(n.x - 0.6) < 1e-9 && Math.abs(n.y - 0.8) < 1e-9);
  assert.deepEqual(norm({x:0,y:0}), {x:0,y:0});
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(lerp(0, 10, 0.5), 5);
});
