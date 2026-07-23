import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISLANDS, BASES, blocked, segmentHitsIsland, resolveShipCollision } from '../server/game/map.js';

test('bases are in opposite corners', () => {
  assert.ok(BASES.pirate && BASES.navy);
  assert.ok(Math.hypot(BASES.pirate.x - BASES.navy.x, BASES.pirate.y - BASES.navy.y) > 3000);
});

test('blocked detects island interior', () => {
  const i = ISLANDS[0];
  assert.equal(blocked({ x: i.x, y: i.y }), true);
  assert.equal(blocked({ x: -5, y: -5 }), false); // outside world but not island
});

test('segmentHitsIsland true when crossing island', () => {
  const i = ISLANDS[0];
  assert.equal(segmentHitsIsland({ x: i.x - i.r - 200, y: i.y }, { x: i.x + i.r + 200, y: i.y }), true);
  assert.equal(segmentHitsIsland({ x: 0, y: 0 }, { x: 0, y: 1 }), false);
});

test('resolveShipCollision pushes out of island and keeps in bounds', () => {
  const i = ISLANDS[0];
  const out = resolveShipCollision({ x: i.x, y: i.y }, 20);
  assert.ok(Math.hypot(out.x - i.x, out.y - i.y) >= i.r + 20 - 1e-6);
  const b = resolveShipCollision({ x: -100, y: -100 }, 20);
  assert.ok(b.x >= 0 && b.y >= 0);
});
