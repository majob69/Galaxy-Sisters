// ==========================================
// NETWORK CLIENT: thin WebSocket wrapper for the co-op relay (server/server.mjs).
// Messages are small JSON objects with a type field "t".
// ==========================================

export class NetClient {
  // handlers: { [type]: (msg) => void } plus optional 'close'
  constructor(handlers) {
    this.handlers = handlers;
    this.ws = null;
    this.id = 0;
    this.hostId = 0;
    this.room = '';
  }

  get connected() {
    return !!this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  get isHost() {
    return this.id !== 0 && this.id === this.hostId;
  }

  // Resolves with the welcome message, rejects with an Error('full' | 'unreachable')
  connect({ server, room, name, sister }) {
    return new Promise((resolve, reject) => {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const base = server || `${proto}//${location.host}`;
      let ws;
      try {
        ws = new WebSocket(`${base}/ws?${new URLSearchParams({ room, name, sister })}`);
      } catch (e) {
        reject(new Error('unreachable'));
        return;
      }
      this.ws = ws;
      let settled = false;
      const fail = (reason) => {
        if (settled) return;
        settled = true;
        reject(new Error(reason));
      };
      const timer = setTimeout(() => { fail('unreachable'); ws.close(); }, 5000);

      ws.onmessage = (e) => {
        let msg;
        try { msg = JSON.parse(e.data); } catch (err) { return; }
        if (msg.t === 'welcome') {
          this.id = msg.id;
          this.hostId = msg.host;
          this.room = msg.room;
          clearTimeout(timer);
          settled = true;
          resolve(msg);
        } else if (msg.t === 'error') {
          clearTimeout(timer);
          fail(msg.reason || 'error');
          return;
        } else if (msg.t === 'host') {
          this.hostId = msg.id;
        }
        const h = this.handlers[msg.t];
        if (h) h(msg);
      };
      ws.onerror = () => fail('unreachable');
      ws.onclose = () => {
        clearTimeout(timer);
        fail('unreachable');
        const wasJoined = this.id !== 0;
        this.id = 0;
        this.hostId = 0;
        if (wasJoined && this.handlers.close) this.handlers.close();
      };
    });
  }

  send(obj) {
    if (this.connected) this.ws.send(JSON.stringify(obj));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}
