// client/js/game.js
import { Net } from './net.js';
import { Renderer } from './render.js';
import { SnapshotBuffer } from './interpolate.js';
import { Lobby } from './lobby.js';
import { Input } from './input.js';
import { audio } from './three/audio.js';

const net = new Net();
const buffer = new SnapshotBuffer();
let meId = null;
let renderer = null;
const cam = { x: 500, y: 500, scale: 1, cx: 0, cy: 0 };
let latestState = null;
let clockOffset = 0; // Date.now() - serverT

const currentState = () => latestState;
const myId = () => meId;
let isHost = false;

async function boot() {
  await net.connect(`ws://${location.host}`);
  net.send({ type: 'listRooms' });

  // joined the lobby (not spawned yet) -> show the room roster
  net.on('joined', (m) => {
    meId = m.playerId;
    isHost = m.hostId === m.playerId;
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('lobbyRoom').classList.remove('hidden');
    document.getElementById('roomName').textContent = window.__room || '';
    document.getElementById('startBtn').onclick = () => net.send({ type: 'startGame' });
    document.querySelectorAll('.teamBtn').forEach((b) => { b.onclick = () => net.send({ type: 'setTeam', faction: b.dataset.faction }); });
  });

  net.on('lobby', (m) => renderRoster(m));
  net.on('error', (m) => showJoinError(m.error));
  net.on('started', () => startMatch());

  net.on('snapshot', (m) => {
    buffer.push(m);
    // smooth the local<->server clock offset (EMA) so per-packet jitter doesn't
    // shake the render clock -> ships glide instead of trembling
    const off = Date.now() - m.t;
    clockOffset = clockOffset === 0 ? off : clockOffset * 0.9 + off * 0.1;
  });
  net.on('event', (m) => { for (const e of m.events) if (e.type === 'gameOver') showEnd(e.winner); });

  new Lobby(net, (info) => {
    audio.init();
    window.__room = info.room;
    window.__calm = document.getElementById('calmSea').checked;
    net.send({ type: 'join', ...info });
  });
}

function renderRoster(m) {
  isHost = m.hostId === meId;
  const p = m.players.filter((x) => x.faction === 'pirate');
  const n = m.players.filter((x) => x.faction === 'navy');
  document.getElementById('pcount').textContent = p.length;
  document.getElementById('ncount').textContent = n.length;
  const fill = (ul, arr) => {
    ul.innerHTML = '';
    for (const pl of arr) {
      const li = document.createElement('li');
      li.textContent = pl.nick + (pl.id === m.hostId ? ' 👑' : '') + (pl.id === meId ? ' (sen)' : '');
      ul.appendChild(li);
    }
  };
  fill(document.getElementById('plist'), p);
  fill(document.getElementById('nlist'), n);
  const myFaction = (m.players.find((x) => x.id === meId) || {}).faction;
  document.querySelectorAll('.teamBtn').forEach((b) => { b.disabled = b.dataset.faction === myFaction; });
  document.getElementById('startBtn').classList.toggle('hidden', !isHost);
  document.getElementById('waitMsg').classList.toggle('hidden', isHost);
}

function showJoinError(err) {
  // shown on the join form (e.g. game already started)
  document.getElementById('lobbyRoom').classList.add('hidden');
  document.getElementById('lobby').classList.remove('hidden');
  const el = document.getElementById('joinErr');
  el.textContent = err || 'Katılım başarısız'; el.classList.remove('hidden');
}

function startMatch() {
  document.getElementById('lobbyRoom').classList.add('hidden');
  const canvas = document.getElementById('game');
  canvas.classList.remove('hidden');
  renderer = new Renderer(canvas);
  window.addEventListener('resize', () => renderer.resize());
  new Input(canvas, net, currentState, myId, (x, y) => renderer.screenToWorld(x, y), renderer);
  setupAudioUI();
  setupWaveToggle();
  audio.startMusic();
  requestAnimationFrame(loop);
}

function setupWaveToggle() {
  let on = !window.__calm;
  renderer.setWaves(on);
  const wb = document.getElementById('waveBtn');
  wb.textContent = on ? '🌊' : '〜';
  wb.onclick = () => { on = !on; renderer.setWaves(on); wb.textContent = on ? '🌊' : '〜'; };
}

function setupAudioUI() {
  const ctl = document.getElementById('audioCtl');
  ctl.classList.remove('hidden');
  const slider = document.getElementById('musicVol');
  const mute = document.getElementById('muteBtn');
  audio.setMusicVolume(slider.value / 100);
  slider.oninput = () => audio.setMusicVolume(slider.value / 100);
  let muted = false;
  mute.onclick = () => { muted = !muted; audio.setMuted(muted); mute.textContent = muted ? '🔇' : '🔊'; };
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
