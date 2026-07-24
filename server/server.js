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

const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.mp3':'audio/mpeg' };

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

// roomId -> { room, sockets:Set, phase:'lobby'|'playing', hostId, lobby:Map(id->cfg) }
const rooms = new Map();

function getRoom(id) {
  if (!rooms.has(id)) {
    const entry = { room: null, sockets: new Set(), phase: 'lobby', hostId: null, lobby: new Map() };
    entry.room = new Room(id, (obj) => {
      const data = JSON.stringify(obj);
      for (const ws of entry.sockets) { if (ws.readyState === ws.OPEN) ws.send(data); }
    });
    rooms.set(id, entry);
  }
  return rooms.get(id);
}

function roomList() {
  return [...rooms.entries()].map(([id, e]) => ({ id, players: e.lobby.size, phase: e.phase }));
}

function send(ws, obj) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj)); }
function broadcast(entry, obj) { const d = JSON.stringify(obj); for (const ws of entry.sockets) if (ws.readyState === ws.OPEN) ws.send(d); }

function broadcastLobby(entry) {
  const players = [...entry.lobby.entries()].map(([id, c]) => ({ id, nick: c.name, faction: c.faction }));
  broadcast(entry, { type: MSG.LOBBY, players, hostId: entry.hostId, phase: entry.phase });
}

let _id = 0;
wss.on('connection', (ws) => {
  ws.playerId = 'pl' + (++_id);
  ws.roomId = null;

  ws.on('message', (raw) => {
    let msg; try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === MSG.LIST_ROOMS) { send(ws, { type: MSG.ROOMS, rooms: roomList() }); return; }

    if (msg.type === MSG.JOIN) {
      const { room, nick, faction, shipClass, flagColor } = msg;
      if (!SHIP_CLASSES[faction] || !SHIP_CLASSES[faction].includes(shipClass)) {
        send(ws, { type: MSG.ERROR, error: 'invalid faction/ship' }); return;
      }
      const entry = getRoom(room || 'default');
      if (entry.phase === 'playing') { send(ws, { type: MSG.ERROR, error: 'Oyun başladı, katılınamaz.' }); return; }
      entry.sockets.add(ws);
      ws.roomId = room || 'default';
      entry.lobby.set(ws.playerId, { name: (nick || 'Sailor').slice(0, 16), faction, cls: shipClass, flagColor: flagColor || '#ffffff' });
      if (!entry.hostId) entry.hostId = ws.playerId;
      send(ws, { type: MSG.JOINED, playerId: ws.playerId, hostId: entry.hostId });
      broadcastLobby(entry);
      return;
    }

    if (msg.type === MSG.SET_TEAM) {
      const entry = ws.roomId && rooms.get(ws.roomId);
      if (!entry || entry.phase !== 'lobby') return;
      const cfg = entry.lobby.get(ws.playerId);
      if (!cfg || !SHIP_CLASSES[msg.faction]) return;
      cfg.faction = msg.faction;
      cfg.cls = SHIP_CLASSES[msg.faction][0]; // ship classes differ per faction -> reset to default
      broadcastLobby(entry);
      return;
    }

    if (msg.type === MSG.START_GAME) {
      const entry = ws.roomId && rooms.get(ws.roomId);
      if (!entry || entry.phase !== 'lobby' || ws.playerId !== entry.hostId) return;
      if (entry.lobby.size === 0) return;
      entry.phase = 'playing';
      for (const [pid, cfg] of entry.lobby) entry.room.join({ id: pid, ...cfg });
      broadcast(entry, { type: MSG.STARTED });
      entry.room.start();
      return;
    }

    // gameplay intents only once the match is running
    const entry = ws.roomId && rooms.get(ws.roomId);
    if (entry && entry.phase === 'playing') {
      try { entry.room.handle(ws.playerId, msg); } catch (err) { console.error('gameplay intent handling failed:', err); }
    }
  });

  ws.on('close', () => {
    const entry = ws.roomId && rooms.get(ws.roomId);
    if (!entry) return;
    entry.sockets.delete(ws);
    entry.lobby.delete(ws.playerId);
    if (entry.phase === 'playing') entry.room.leave(ws.playerId);
    if (entry.hostId === ws.playerId) entry.hostId = entry.lobby.size ? [...entry.lobby.keys()][0] : null;
    if (entry.sockets.size === 0) { entry.room.stop(); rooms.delete(ws.roomId); }
    else if (entry.phase === 'lobby') broadcastLobby(entry);
  });
});

httpServer.listen(PORT, () => {
  console.log(`Naval battle server on http://localhost:${PORT} (LAN: http://<your-ip>:${PORT})`);
});
