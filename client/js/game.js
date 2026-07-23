// client/js/game.js
import { Net } from './net.js';
import { Renderer } from './render.js';
import { SnapshotBuffer } from './interpolate.js';
import { Lobby } from './lobby.js';
import { Input } from './input.js';

const net = new Net();
const buffer = new SnapshotBuffer();
let meId = null;
let renderer = null;
const cam = { x: 500, y: 500, scale: 1, cx: 0, cy: 0 };
let latestState = null;
let clockOffset = 0; // Date.now() - serverT

const currentState = () => latestState;
const myId = () => meId;

async function boot() {
  await net.connect(`ws://${location.host}`);
  net.send({ type: 'listRooms' });

  net.on('joined', (m) => {
    meId = m.playerId;
    document.getElementById('lobby').classList.add('hidden');
    const canvas = document.getElementById('game');
    canvas.classList.remove('hidden');
    renderer = new Renderer(canvas);
    window.addEventListener('resize', () => renderer.resize());
    new Input(canvas, net, currentState, myId, (x, y) => renderer.screenToWorld(x, y), (name) => renderer.markAbility(name));
    requestAnimationFrame(loop);
  });

  net.on('snapshot', (m) => { buffer.push(m); clockOffset = Date.now() - m.t; });
  net.on('event', (m) => { for (const e of m.events) if (e.type === 'gameOver') showEnd(e.winner); });

  new Lobby(net, (info) => net.send({ type: 'join', ...info }));
}

function loop() {
  const renderTime = Date.now() - clockOffset - 100;
  const state = buffer.sample(renderTime);
  if (state && renderer) {
    latestState = state;
    const me = state.ships.find((s) => s.id === meId);
    if (me) { cam.x = me.x; cam.y = me.y; }
    renderer.draw(state, cam, meId);
  }
  requestAnimationFrame(loop);
}

function showEnd(winner) {
  const el = document.getElementById('endScreen');
  el.classList.remove('hidden');
  const mine = latestState?.ships.find((s) => s.id === meId);
  const win = mine && mine.faction === winner;
  el.innerHTML = `<div>${win ? '🏆 ZAFER' : '💀 MAĞLUP'} — Kazanan: ${winner === 'pirate' ? 'Korsan' : 'Donanma'}<br><button onclick="location.reload()">Tekrar</button></div>`;
}

boot();
