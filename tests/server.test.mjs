// Co-op server protocol tests. Run with: npm test   (Node 22+, no packages needed)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const base = `ws://localhost:${PORT}/ws`;
let server;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  server = spawn(process.execPath, [path.join(root, 'server', 'server.mjs')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {
    try { await fetch(`http://localhost:${PORT}/`); return; } catch (e) { await wait(100); }
  }
  throw new Error('server did not start');
});

after(() => { if (server) server.kill(); });

function open(query) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base}?${query}`);
    const msgs = [];
    ws.onmessage = (e) => msgs.push(JSON.parse(e.data));
    ws.onopen = () => resolve({ ws, msgs, send: (o) => ws.send(JSON.stringify(o)), of: (t) => msgs.filter((m) => m.t === t) });
    ws.onerror = reject;
  });
}

test('welcome names the first player host and lists the room', async () => {
  const a = await open('room=SRV1&name=Anna&sister=0');
  const b = await open('room=SRV1&name=Ben&sister=2');
  await wait(150);
  assert.equal(a.msgs[0].t, 'welcome');
  assert.equal(a.msgs[0].host, a.msgs[0].id);
  assert.equal(b.msgs[0].players.length, 2);
  assert.equal(a.of('join')[0].player.name, 'Ben');
  a.ws.close(); b.ws.close();
});

test('names are cleaned, rooms are limited to four players', async () => {
  const a = await open('room=SRV2&name=%3Cscript%3EAnna%3C%2Fscript%3E');
  await wait(100);
  assert.ok(!/[<>]/.test(a.msgs[0].players[0].name));
  const others = [await open('room=SRV2&name=B'), await open('room=SRV2&name=C'), await open('room=SRV2&name=D')];
  const fifth = await open('room=SRV2&name=E');
  await wait(200);
  assert.deepEqual(fifth.of('error')[0], { t: 'error', reason: 'full' });
  [a, ...others, fifth].forEach((c) => c.ws.close());
});

test('state and casts are relayed to the others with positions clamped', async () => {
  const a = await open('room=SRV3&name=A');
  const b = await open('room=SRV3&name=B');
  await wait(100);
  a.send({ t: 's', x: 1.5, y: 2, z: -3, ry: 1, si: 1, dn: 1, vr: 2, hp: 50, mhp: 100 });
  a.send({ t: 's', x: 99999, y: 99999, z: -99999, ry: 0, si: 0 });
  a.send({ t: 'cast', a: 1, si: 1, x: 5, y: 1, z: 5, dx: 0, dz: 1 });
  await wait(150);
  const states = b.of('s');
  assert.equal(states[0].dn, 1);
  assert.equal(states[0].vr, 2);
  assert.equal(states[1].x, 110);
  assert.equal(states[1].z, -110);
  assert.equal(states[1].y, 90);
  assert.equal(b.of('cast').length, 1);
  a.ws.close(); b.ws.close();
});

test('only the host may send boss and world state; hits go to the host only', async () => {
  const host = await open('room=SRV4&name=Host');
  const guest = await open('room=SRV4&name=Guest');
  await wait(100);
  guest.send({ t: 'boss2', hp: 1 });
  guest.send({ t: 'boss3', hp: 1 });
  guest.send({ t: 'weather', k: 3 });
  guest.send({ t: 'time', p: 0.5 });
  host.send({ t: 'boss2', x: 1, hp: 300, zs: [[1, 2, 3, 0.5]], 'bad key!': 5, s: 'x'.repeat(50) });
  host.send({ t: 'boss3', x: 2, hp: 400, cr: [60, 60, 60] });
  host.send({ t: 'weather', k: 2 });
  host.send({ t: 'time', p: 0.4, w: 2 });
  guest.send({ t: 'boss2Hit', dmg: 25, pet: 3 });
  guest.send({ t: 'boss3Hit', dmg: 10, cr: 1 });
  await wait(200);
  assert.equal(host.of('boss2').length + host.of('boss3').length + host.of('weather').length + host.of('time').length, 0, 'guest must not drive world state');
  const b2 = guest.of('boss2')[0];
  assert.equal(b2.hp, 300);
  assert.equal(b2['bad key!'], undefined);
  assert.equal(b2.s.length, 12);
  assert.deepEqual(guest.of('boss3')[0].cr, [60, 60, 60]);
  assert.equal(guest.of('weather')[0].k, 2);
  assert.equal(guest.of('time')[0].w, 2);
  assert.equal(host.of('boss2Hit')[0].dmg, 25);
  assert.equal(host.of('boss3Hit')[0].cr, 1);
  assert.equal(guest.of('boss2Hit').length, 0);
  host.ws.close(); guest.ws.close();
});

test('host leaves: the next player becomes host', async () => {
  const a = await open('room=SRV5&name=A');
  const b = await open('room=SRV5&name=B');
  await wait(100);
  a.ws.close();
  await wait(200);
  assert.equal(b.of('leave').length, 1);
  assert.equal(b.of('host')[0].id, b.msgs[0].id);
  b.ws.close();
});

test('chat: sanitized, rate limited, never echoed back', async () => {
  const a = await open('room=SRV6&name=A');
  const b = await open('room=SRV6&name=B');
  await wait(100);
  a.send({ t: 'chat', text: '  Hallo <b>Welt</b>\u0007!  ' });
  a.send({ t: 'chat', text: 'zweite sofort' }); // too fast, dropped
  await wait(700);
  a.send({ t: 'chat', text: 'x'.repeat(300) });
  a.send({ t: 'chat', text: '   ' }); // empty after cleaning
  await wait(200);
  const chats = b.of('chat');
  assert.equal(chats[0].text, 'Hallo bWelt/b!');
  assert.equal(chats.length, 2);
  assert.equal(chats[1].text.length, 80);
  assert.equal(a.of('chat').length, 0);
  a.ws.close(); b.ws.close();
});

test('pings and puzzle messages are relayed, garbage json is ignored', async () => {
  const a = await open('room=SRV7&name=A');
  const b = await open('room=SRV7&name=B');
  await wait(100);
  a.ws.send('this is not json');
  a.send({ t: 'ping', x: 5.5, z: -3 });
  a.send({ t: 'puzzle', id: 'shrine-with-a-very-long-name' });
  await wait(150);
  assert.deepEqual(b.of('ping')[0], { t: 'ping', id: a.msgs[0].id, x: 5.5, z: -3 });
  assert.equal(b.of('puzzle')[0].id.length, 12);
  a.ws.close(); b.ws.close();
});

test('static files: game files are served, server code and traversal are not', async () => {
  const get = async (p) => (await fetch(`http://localhost:${PORT}${p}`)).status;
  assert.equal(await get('/'), 200);
  assert.equal(await get('/src/main.js'), 200);
  assert.equal(await get('/server/server.mjs'), 404);
  assert.equal(await get('/package.json'), 404);
  assert.equal(await get('/..%2fpackage.json'), 404);
  assert.equal(await get('/src/../package.json'), 404);
});

test('gifts go to exactly one friend, sleep is shared with the room', async () => {
  const a = await open('room=SRV8&name=A');
  const b = await open('room=SRV8&name=B');
  const c = await open('room=SRV8&name=C');
  await wait(150);
  const bId = b.msgs[0].id;
  a.send({ t: 'gift', to: bId, item: 'wood<script>', n: 500 });
  a.send({ t: 'gift', to: a.msgs[0].id, item: 'apple', n: 1 }); // not to yourself
  a.send({ t: 'sleep' });
  await wait(200);
  assert.deepEqual(b.of('gift')[0], { t: 'gift', id: a.msgs[0].id, item: 'woodscript', n: 20 });
  assert.equal(c.of('gift').length, 0);
  assert.equal(a.of('gift').length, 0);
  assert.equal(b.of('sleep').length, 1);
  assert.equal(c.of('sleep').length, 1);
  [a, b, c].forEach((x) => x.ws.close());
});
