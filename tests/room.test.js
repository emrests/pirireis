import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/room.js';
import { MSG } from '../shared/constants.js';

test('room broadcasts snapshots on tick', () => {
  const sent = [];
  const room = new Room('r1', (obj) => sent.push(obj));
  room.join({ id:'a', name:'A', faction:'pirate', cls:'galleon', flagColor:'#f00' });
  room.join({ id:'b', name:'B', faction:'navy', cls:'sloop', flagColor:'#00f' });
  room.tickOnce(50);
  const snap = sent.find((m) => m.type === MSG.SNAPSHOT);
  assert.ok(snap, 'snapshot broadcast');
  assert.equal(snap.ships.length, 2);
});

test('handle forwards move intent', () => {
  const room = new Room('r2', () => {});
  const s = room.join({ id:'a', name:'A', faction:'pirate', cls:'sloop', flagColor:'#f00' });
  const before = s.pos.x;
  room.handle('a', { type:'move', x: s.pos.x + 400, y: s.pos.y });
  for (let i = 0; i < 30; i++) room.tickOnce(50 * (i + 1));
  assert.ok(room.world.ships.get('a').pos.x !== before);
});
