import { test } from 'node:test';
import assert from 'node:assert/strict';
import { worldToScreen, screenToWorld } from '../client/js/iso.js';

test('worldToScreen/screenToWorld are inverses', () => {
  const cam = { x: 1000, y: 800, scale: 1, cx: 400, cy: 300 };
  const { sx, sy } = worldToScreen(1200, 900, cam);
  const back = screenToWorld(sx, sy, cam);
  assert.ok(Math.abs(back.x - 1200) < 1e-6);
  assert.ok(Math.abs(back.y - 900) < 1e-6);
});
