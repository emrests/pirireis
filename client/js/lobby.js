// client/js/lobby.js
import { SHIP_CLASSES } from '/shared/constants.js';

const SHIP_LABEL = {
  sloop:'Salapurya', brig:'Uşkuna', frigate:'Firkateyn', galleon:'Kalyon', fireship:'Ateş Gemisi',
  cutter:'Karakol', corvette:'Korvet', frigate_n:'Firkateyn', shipofline:'Hat Gemisi', bombketch:'Havan',
};

const FLAG_COLORS = ['#e63946', '#f4a300', '#ffd23f', '#2ecc71', '#1abc9c', '#3498db', '#5b6cff', '#9b59b6', '#ff6ec7', '#f5f5f5'];

export class Lobby {
  constructor(net, onStart) {
    this.net = net; this.onStart = onStart; this.selected = null;
    this.flag = FLAG_COLORS[0];
    this.form = document.getElementById('joinForm');
    this.shipsEl = document.getElementById('ships');
    this.factionInputs = [...document.querySelectorAll('input[name=faction]')];
    this.factionInputs.forEach((r) => r.addEventListener('change', () => this.renderShips()));
    this.form.addEventListener('submit', (e) => this._submit(e));
    document.getElementById('nick').addEventListener('input', (e) => e.target.classList.remove('invalid'));
    net.on('rooms', (m) => this._rooms(m.rooms));
    this.renderShips();
    this.renderFlags();
  }
  renderFlags() {
    const el = document.getElementById('flags');
    el.innerHTML = '';
    for (const c of FLAG_COLORS) {
      const d = document.createElement('div');
      d.className = 'flag' + (c === this.flag ? ' sel' : '');
      d.style.background = c;
      d.onclick = () => { this.flag = c; [...el.children].forEach((x) => x.classList.remove('sel')); d.classList.add('sel'); };
      el.appendChild(d);
    }
  }
  faction() { return this.factionInputs.find((r) => r.checked).value; }
  renderShips() {
    const f = this.faction();
    this.selected = SHIP_CLASSES[f][0];
    this.shipsEl.innerHTML = '';
    for (const id of SHIP_CLASSES[f]) {
      const d = document.createElement('div');
      d.className = 'ship' + (id === this.selected ? ' sel' : '');
      d.textContent = SHIP_LABEL[id] || id;
      d.onclick = () => { this.selected = id; [...this.shipsEl.children].forEach((c) => c.classList.remove('sel')); d.classList.add('sel'); };
      this.shipsEl.appendChild(d);
    }
  }
  _rooms(rooms) {
    const el = document.getElementById('roomList');
    el.textContent = rooms.length ? 'Odalar: ' + rooms.map((r) => `${r.id}(${r.players})`).join(', ') : 'Henüz oda yok';
  }
  _submit(e) {
    e.preventDefault();
    const nickEl = document.getElementById('nick');
    const nick = nickEl.value.trim();
    if (!nick) { nickEl.focus(); nickEl.classList.add('invalid'); return; } // rumuz zorunlu
    this.onStart({
      room: document.getElementById('room').value.trim() || 'oda1',
      nick,
      faction: this.faction(),
      shipClass: this.selected,
      flagColor: this.flag,
    });
  }
}
