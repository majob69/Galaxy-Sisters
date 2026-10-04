// ==========================================
// GALAXY SISTERS CO-OP SERVER
// One small Node process (no npm packages needed):
//   - serves the game files over HTTP, so friends just open http://<your-ip>:8080
//   - relays player state over WebSocket (path /ws) between up to 4 players per room
// Start with: node server/server.js   (or start_multiplayer.bat)
// ==========================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT) || 8080;
const MAX_PLAYERS = 4;
const MAX_FRAME = 8 * 1024;
const MAX_MSG_PER_SEC = 90;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

// ---------- Static files ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};
const PUBLIC_DIRS = ['src', 'public', 'tests'];
const PUBLIC_FILES = ['index.html', 'figuren.html', 'style.css', 'intro.jpg'];

function serveStatic(req, res) {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  } catch (e) {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (rel === '/') rel = '/index.html';
  const clean = path.posix.normalize(rel).replace(/^\/+/, '');
  const top = clean.split('/')[0];
  const allowed = PUBLIC_FILES.includes(clean) || (PUBLIC_DIRS.includes(top) && clean.includes('/'));
  const file = path.join(ROOT, clean);
  if (!allowed || !file.startsWith(ROOT + path.sep)) {
    res.writeHead(404).end('Not found');
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
}

// ---------- Minimal RFC 6455 WebSocket connection ----------
class WSConn {
  constructor(socket, onMessage, onClose) {
    this.socket = socket;
    this.onMessage = onMessage;
    this.onClose = onClose;
    this.buffer = Buffer.alloc(0);
    this.fragments = [];
    this.closed = false;
    socket.setNoDelay(true);
    socket.on('data', (chunk) => this.receive(chunk));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 2 && !this.closed) {
      const b0 = this.buffer[0];
      const b1 = this.buffer[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let offset = 2;
      if (len === 126) {
        if (this.buffer.length < 4) return;
        len = this.buffer.readUInt16BE(2);
        offset = 4;
      } else if (len === 127) {
        if (this.buffer.length < 10) return;
        len = Number(this.buffer.readBigUInt64BE(2));
        offset = 10;
      }
      if (!masked || len > MAX_FRAME) return this.close(1009);
      if (this.buffer.length < offset + 4 + len) return;

      const mask = this.buffer.subarray(offset, offset + 4);
      const payload = Buffer.from(this.buffer.subarray(offset + 4, offset + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buffer = this.buffer.subarray(offset + 4 + len);

      if (opcode === 0x8) return this.close(1000);
      if (opcode === 0x9) { this.frame(0xA, payload); continue; }
      if (opcode === 0xA) continue;
      if (opcode === 0x1 || opcode === 0x0 || opcode === 0x2) {
        if (opcode !== 0x0) this.fragments = [];
        this.fragments.push(payload);
        if (this.fragments.reduce((n, f) => n + f.length, 0) > MAX_FRAME) return this.close(1009);
        if (fin) {
          const text = Buffer.concat(this.fragments).toString('utf8');
          this.fragments = [];
          this.onMessage(text);
        }
      }
    }
  }

  frame(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;
    const len = payload.length;
    let header;
    if (len < 126) {
      header = Buffer.from([0x80 | opcode, len]);
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([header, payload]));
  }

  send(text) {
    this.frame(0x1, Buffer.from(text, 'utf8'));
  }

  close(code = 1000) {
    if (this.closed) return;
    const body = Buffer.alloc(2);
    body.writeUInt16BE(code, 0);
    this.frame(0x8, body);
    this.socket.end();
    this.finish();
  }

  finish() {
    if (this.closed) return;
    this.closed = true;
    this.onClose();
  }
}

// ---------- Rooms ----------
const rooms = new Map(); // code -> { players: Map<id, Player>, nextId }

function cleanName(raw) {
  const s = String(raw || '').replace(/[^\p{L}\p{N} _.\-!?]/gu, '').trim().slice(0, 14);
  return s || 'Spieler';
}

function cleanRoom(raw) {
  return String(raw || 'GALAXY').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'GALAXY';
}

const num = (v, lim = 400) => (Number.isFinite(v) ? Math.max(-lim, Math.min(lim, v)) : 0);
// Player positions: the valley (about +-100), the enchanted forest (x ~ 600) and the star castle (x ~ -600)
const pos = (v) => num(v, 720);
const height = (v) => (Number.isFinite(v) ? Math.max(-30, Math.min(90, v)) : 0);

// Chat text: no control characters or angle brackets, trimmed and short
function cleanChat(raw) {
  return String(raw || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// Sanitizes free-form game payloads (boss 2 state etc.): short keys, numbers clamped, short strings,
// small arrays / objects only. Nothing else gets relayed.
function clean(v, depth = 0) {
  if (typeof v === 'number') return num(v, 2000);
  if (typeof v === 'boolean') return v ? 1 : 0;
  if (typeof v === 'string') return v.slice(0, 12);
  if (Array.isArray(v) && depth < 3) return v.slice(0, 10).map((x) => clean(x, depth + 1));
  if (v && typeof v === 'object' && depth < 2) {
    const out = {};
    Object.keys(v).slice(0, 20).forEach((k) => { if (/^\w{1,8}$/.test(k)) out[k] = clean(v[k], depth + 1); });
    return out;
  }
  return 0;
}

function broadcast(room, obj, exceptId = null) {
  const text = JSON.stringify(obj);
  room.players.forEach((p) => { if (p.id !== exceptId) p.conn.send(text); });
}

function hostOf(room) {
  let host = null;
  room.players.forEach((p) => { if (!host || p.id < host.id) host = p; });
  return host;
}

function publicInfo(p) {
  return { id: p.id, name: p.name, sister: p.sister };
}

function handleMessage(room, player, msg) {
  switch (msg.t) {
    case 's': // player state (relayed to everyone else)
      player.sister = msg.si | 0;
      broadcast(room, {
        t: 's', id: player.id,
        x: pos(msg.x), y: height(msg.y), z: pos(msg.z), ry: num(msg.ry, 10),
        si: player.sister, mv: msg.mv ? 1 : 0, gr: msg.gr ? 1 : 0, sw: msg.sw ? 1 : 0,
        vy: num(msg.vy, 5), inv: msg.inv ? 1 : 0, hp: num(msg.hp, 1000), mhp: num(msg.mhp, 1000),
        dn: msg.dn ? 1 : 0, vr: Math.max(0, Math.min(2, msg.vr | 0)), pk: Math.max(0, Math.min(20, msg.pk | 0))
      }, player.id);
      break;
    case 'cast': // ability visuals
      broadcast(room, {
        t: 'cast', id: player.id, a: msg.a | 0, si: msg.si | 0,
        x: pos(msg.x), y: height(msg.y), z: pos(msg.z), dx: num(msg.dx, 2), dz: num(msg.dz, 2)
      }, player.id);
      break;
    case 'boss': // host-authoritative boss state
      if (hostOf(room) === player) {
        broadcast(room, {
          t: 'boss', x: num(msg.x), z: num(msg.z), ry: num(msg.ry, 20), st: String(msg.st).slice(0, 8),
          hp: num(msg.hp, 1000), al: msg.al ? 1 : 0, pet: num(msg.pet, 20)
        }, player.id);
      }
      break;
    case 'bossHit':
    case 'bossPetrify': {
      const host = hostOf(room);
      if (host && host !== player) {
        host.conn.send(JSON.stringify({ t: msg.t, id: player.id, dmg: num(msg.dmg, 200), dur: num(msg.dur, 10) }));
      }
      break;
    }
    case 'ping':
      broadcast(room, { t: 'ping', id: player.id, x: num(msg.x), z: num(msg.z) }, player.id);
      break;
    case 'puzzle':
      broadcast(room, { t: 'puzzle', id: String(msg.id).slice(0, 12) }, player.id);
      break;
    case 'boss3': // host-authoritative state of boss 3
      if (hostOf(room) === player) broadcast(room, { ...clean(msg), t: 'boss3' }, player.id);
      break;
    case 'boss3Hit': {
      const host = hostOf(room);
      if (host && host !== player) host.conn.send(JSON.stringify({ ...clean(msg), t: 'boss3Hit', id: player.id }));
      break;
    }
    case 'weather':
      if (hostOf(room) === player) broadcast(room, { t: 'weather', k: Math.max(0, Math.min(3, msg.k | 0)) }, player.id);
      break;
    case 'gift': { // one item for one friend in the same room
      const to = room.players.get(msg.to | 0);
      const item = String(msg.item || '').replace(/[^a-z_]/g, '').slice(0, 16);
      if (to && to !== player && item) to.conn.send(JSON.stringify({ t: 'gift', id: player.id, item, n: Math.max(1, Math.min(20, msg.n | 0)) }));
      break;
    }
    case 'sleep':
      broadcast(room, { t: 'sleep', id: player.id }, player.id);
      break;
    case 'chat': {
      const now = Date.now();
      if (now - (player.lastChat || 0) < 600) break; // at most ~1.5 messages per second
      const text = cleanChat(msg.text);
      if (!text) break;
      player.lastChat = now;
      broadcast(room, { t: 'chat', id: player.id, text }, player.id);
      break;
    }
    case 'boss2': // host-authoritative state of boss 2
      if (hostOf(room) === player) broadcast(room, { ...clean(msg), t: 'boss2' }, player.id);
      break;
    case 'boss2Hit':
    case 'boss2Free': {
      const host = hostOf(room);
      if (host && host !== player) host.conn.send(JSON.stringify({ ...clean(msg), t: msg.t, id: player.id }));
      break;
    }
    case 'slime':
      broadcast(room, { t: 'slime', i: msg.i | 0 }, player.id);
      break;
    case 'time': // host shares the time of day
      if (hostOf(room) === player) broadcast(room, { t: 'time', p: num(msg.p, 2), night: msg.night ? 1 : 0, w: Math.max(0, Math.min(3, msg.w | 0)) }, player.id);
      break;
    case 'skipTime':
      broadcast(room, { t: 'skipTime' }, player.id);
      break;
    case 'emote':
      broadcast(room, { t: 'emote', id: player.id, e: String(msg.e).slice(0, 4) }, player.id);
      break;
    case 'wev': // shared world events: puzzle moves, chased-off foes ...
      broadcast(room, { ...clean(msg), t: 'wev', id: player.id }, player.id);
      break;
    case 'build': // the host's houses, building land and furniture (guests see the host's world)
      if (hostOf(room) === player) broadcast(room, cleanBuild(msg), player.id);
      break;
    case 'boss4': // host-authoritative state of the final boss
      if (hostOf(room) === player) broadcast(room, { ...clean(msg), t: 'boss4' }, player.id);
      break;
    case 'boss4Hit': {
      const host = hostOf(room);
      if (host && host !== player) host.conn.send(JSON.stringify({ ...clean(msg), t: 'boss4Hit', id: player.id }));
      break;
    }
    default:
      break;
  }
}

// Building snapshot: a few flags, up to five buildings and up to 40 pieces of furniture
function cleanBuild(msg) {
  const id = (v) => String(v || '').replace(/[^a-z_]/g, '').slice(0, 12);
  const st = {};
  Object.keys(msg.st || {}).slice(0, 5).forEach((k) => { if (/^[0-4]$/.test(k)) st[k] = id(msg.st[k]); });
  const fu = (Array.isArray(msg.fu) ? msg.fu : []).slice(0, 40)
    .filter((f) => Array.isArray(f) && f.length === 5)
    .map((f) => [id(f[0]), pos(f[1]), height(f[2]), pos(f[3]), num(f[4], 20)]);
  return { t: 'build', b: msg.b ? 1 : 0, f2: Math.max(0, Math.min(3, msg.f2 | 0)), rs: num(msg.rs, 600), st, fu };
}

function onUpgrade(req, socket) {
  const url = new URL(req.url, 'http://localhost');
  const key = req.headers['sec-websocket-key'];
  if (url.pathname !== '/ws' || !key) {
    socket.destroy();
    return;
  }
  const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
    `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
  );

  const code = cleanRoom(url.searchParams.get('room'));
  let room = rooms.get(code);
  if (!room) {
    room = { code, players: new Map(), nextId: 1 };
    rooms.set(code, room);
  }

  let player = null;
  let windowStart = Date.now();
  let windowCount = 0;

  const conn = new WSConn(socket, (text) => {
    const now = Date.now();
    if (now - windowStart > 1000) { windowStart = now; windowCount = 0; }
    if (++windowCount > MAX_MSG_PER_SEC || !player) return;
    let msg;
    try { msg = JSON.parse(text); } catch (e) { return; }
    if (msg && typeof msg === 'object') handleMessage(room, player, msg);
  }, () => {
    if (!player || !room.players.has(player.id)) return;
    const wasHost = hostOf(room) === player;
    room.players.delete(player.id);
    broadcast(room, { t: 'leave', id: player.id });
    if (wasHost && room.players.size) broadcast(room, { t: 'host', id: hostOf(room).id });
    if (!room.players.size) rooms.delete(room.code);
    console.log(`[${room.code}] ${player.name} left (${room.players.size}/${MAX_PLAYERS})`);
  });

  if (room.players.size >= MAX_PLAYERS) {
    conn.send(JSON.stringify({ t: 'error', reason: 'full' }));
    conn.close(1008);
    return;
  }

  player = {
    id: room.nextId++,
    name: cleanName(url.searchParams.get('name')),
    sister: Math.max(0, Math.min(3, Number(url.searchParams.get('sister')) | 0)),
    conn
  };
  room.players.set(player.id, player);
  conn.send(JSON.stringify({
    t: 'welcome', id: player.id, host: hostOf(room).id, room: room.code,
    players: [...room.players.values()].map(publicInfo)
  }));
  broadcast(room, { t: 'join', player: publicInfo(player) }, player.id);
  console.log(`[${room.code}] ${player.name} joined (${room.players.size}/${MAX_PLAYERS})`);
}

const server = http.createServer(serveStatic);
server.on('upgrade', onUpgrade);
server.listen(PORT, '0.0.0.0', () => {
  console.log('===================================================');
  console.log('  Galaxy Sisters Koop-Server laeuft');
  console.log('===================================================');
  console.log(`  Du:      http://localhost:${PORT}/`);
  Object.values(os.networkInterfaces()).flat().filter((n) => n && n.family === 'IPv4' && !n.internal)
    .forEach((n) => console.log(`  Freunde: http://${n.address}:${PORT}/   (gleiches WLAN / LAN)`));
  console.log('  Beenden mit Strg+C');
});
