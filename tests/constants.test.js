import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MSG, FACTION, WEAPON, SHIP_CLASSES, TICK_MS, WORLD } from '../shared/constants.js';

test('constants expose protocol + enums', () => {
  assert.equal(MSG.JOIN, 'join');
  assert.equal(MSG.SNAPSHOT, 'snapshot');
  assert.equal(FACTION.PIRATE, 'pirate');
  assert.equal(WEAPON.MOLOTOV, 'molotov');
  assert.equal(SHIP_CLASSES.pirate.length, 5);
  assert.equal(SHIP_CLASSES.navy.length, 5);
  assert.equal(TICK_MS, 50);
  assert.deepEqual(WORLD, { w: 4000, h: 4000 });
});
