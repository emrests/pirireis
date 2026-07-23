export class Net {
  constructor() { this.ws = null; this.handlers = {}; }
  connect(url) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      (this.handlers[msg.type] || []).forEach((cb) => cb(msg));
    };
    return new Promise((res) => { this.ws.onopen = () => res(); });
  }
  on(type, cb) { (this.handlers[type] ||= []).push(cb); }
  send(obj) { if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj)); }
}
