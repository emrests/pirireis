// server/server.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Room } from './room.js';
import { MSG, SHIP_CLASSES } from '../shared/constants.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const CLIENT_DIR = path.join(ROOT, 'client');
const PORT = process.env.PORT || 8080;

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json' };

const httpServer = http.createServer((req, res) => {
  const urlPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  // /shared/* is served from ROOT so the browser can import shared/constants.js
  const baseDir = urlPath.startsWith('/shared/') ? ROOT : CLIENT_DIR;
  const filePath = path.normalize(path.join(baseDir, urlPath));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server: httpServer });

// roomId -> { room, sockets:Set }
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) {
    const entry = { room: null, sockets: new Set() };
    entry.room = new Room(id, (obj) => {
      const data = JSON.stringify(obj);
      for (const ws of entry.sockets) { if (ws.readyState === ws.OPEN) ws.send(data); }
    });
    rooms.set(id, entry);
  }
  return rooms.get(id);
}

function roomList() {
  return [...rooms.entries()].map(([id, e]) => ({ id, players: e.room.playerCount() }));
}

let _id = 0;
wss.on('connection', (ws) => {
  ws.playerId = 'pl' + (++_id);
  ws.roomId = null;

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === MSG.LIST_ROOMS) {
      ws.send(JSON.stringify({ type: MSG.ROOMS, rooms: roomList() }));
      return;
    }
    if (msg.type === MSG.JOIN) {
      const { room, nick, faction, shipClass, flagColor } = msg;
      if (!SHIP_CLASSES[faction] || !SHIP_CLASSES[faction].includes(shipClass)) {
        ws.send(JSON.stringify({ type: MSG.ERROR, error: 'invalid faction/ship' })); return;
      }
      const entry = getRoom(room || 'default');
      const wasEmpty = entry.room.playerCount() === 0;
      entry.sockets.add(ws);
      ws.roomId = room || 'default';
      entry.room.join({ id: ws.playerId, name: (nick||'Sailor').slice(0,16), faction, cls: shipClass, flagColor: flagColor || '#ffffff' });
      ws.send(JSON.stringify({ type: MSG.JOINED, playerId: ws.playerId }));
      if (wasEmpty) entry.room.start();
      return;
    }
    if (ws.roomId && rooms.has(ws.roomId)) {
      rooms.get(ws.roomId).room.handle(ws.playerId, msg);
    }
  });

  ws.on('close', () => {
    if (ws.roomId && rooms.has(ws.roomId)) {
      const entry = rooms.get(ws.roomId);
      entry.sockets.delete(ws);
      entry.room.leave(ws.playerId);
      if (entry.room.playerCount() === 0) { entry.room.stop(); rooms.delete(ws.roomId); }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Naval battle server on http://localhost:${PORT} (LAN: http://<your-ip>:${PORT})`);
});
