// client/js/lobby.js
import { SHIP_CLASSES } from '/shared/constants.js';

const SHIP_LABEL = {
  sloop:'Salapurya', brig:'Uşkuna', frigate:'Firkateyn', galleon:'Kalyon', fireship:'Ateş Gemisi',
  cutter:'Karakol', corvette:'Korvet', frigate_n:'Firkateyn', shipofline:'Hat Gemisi', bombketch:'Havan',
};

export class Lobby {
  constructor(net, onStart) {
    this.net = net; this.onStart = onStart; this.selected = null;
    this.form = document.getElementById('joinForm');
    this.shipsEl = document.getElementById('ships');
    this.factionInputs = [...document.querySelectorAll('input[name=faction]')];
    this.factionInputs.forEach((r) => r.addEventListener('change', () => this.renderShips()));
    this.form.addEventListener('submit', (e) => this._submit(e));
    net.on('rooms', (m) => this._rooms(m.rooms));
    this.renderShips();
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
    this.onStart({
      room: document.getElementById('room').value || 'oda1',
      nick: document.getElementById('nick').value || 'Denizci',
      faction: this.faction(),
      shipClass: this.selected,
      flagColor: document.getElementById('flag').value,
    });
  }
}
