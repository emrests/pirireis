// tests/balance.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHIPS, CANNON, BASE } from '../server/game/balance.js';
import { SHIP_CLASSES } from '../shared/constants.js';

test('every ship class has stats', () => {
  for (const f of ['pirate', 'navy']) {
    for (const id of SHIP_CLASSES[f]) {
      const s = SHIPS[id];
      assert.ok(s, `missing stats for ${id}`);
      assert.equal(s.faction, f);
      assert.ok(s.hp > 0 && s.speed > 0 && s.range > 0);
    }
  }
});

test('large ships slower + tankier than small', () => {
  assert.ok(SHIPS.galleon.hp > SHIPS.sloop.hp);
  assert.ok(SHIPS.galleon.speed < SHIPS.sloop.speed);
  assert.ok(SHIPS.galleon.cannonDmg > SHIPS.sloop.cannonDmg);
});

test('cannon + base tunables sane', () => {
  assert.ok(CANNON.minDmgFactor > 0 && CANNON.minDmgFactor < 1);
  assert.equal(BASE.hp, 2000);
});
