// ==========================================
// CO-OP SESSION (2-4 players)
//  - every client moves its own sister and broadcasts its state (~15 Hz)
//  - the host (lowest player id) runs the boss brain and broadcasts it (~10 Hz);
//    everybody else shows the boss as a puppet and reports their hits to the host
//  - the host also shares the time of day; ability casts are relayed so all see the spells
// ==========================================
import * as THREE from 'three';
import { NetClient } from './network.js';
import { SISTER_ICONS } from './remote.js';
import { sfx } from './game/shared.js';

const STATE_INTERVAL = 1 / 15;
const BOSS_INTERVAL = 1 / 10;
const TIME_INTERVAL = 2;
const HUD_INTERVAL = 0.25;
const HEAL_RADIUS = 9;
const EMOTES = ['👋', '💜', '⭐', '😂', '🆘', '📍'];
const PING_SECONDS = 20;
const PHRASES = ['Ich heile dich! 💚', 'Achtung, Kreise!', 'Kommt zu mir!', 'Danke! 💜', 'Hilfe, ich bin gefangen!', 'Jetzt draufhauen!', 'Wartet kurz …', 'Gut gemacht! ⭐'];

const r2 = (v) => Math.round(v * 100) / 100;
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class CoopSession {
  constructor(game) {
    this.game = game;
    this.net = null;
    this.name = '';
    this.timers = { state: 0, boss: 0, time: 0, hud: 0 };
    this.bossMsg = null;
    this.rosterDirty = true;
    this.pings = [];
    this.hud = document.getElementById('coop-panel');
    this.buildWheel();
    this.buildChat();
    this._tmpPos = new THREE.Vector3();
  }

  get active() {
    return !!this.net && this.net.connected;
  }

  // Solo play counts as host: the local boss brain runs
  get isHost() {
    return !this.active || this.net.isHost;
  }

  get puppetBoss() {
    return this.active && !this.net.isHost;
  }

  async join({ name, room, server }) {
    const g = this.game;
    this.name = name;
    this.net = new NetClient(this.handlers());
    let welcome;
    try {
      welcome = await this.net.connect({ server, room, name, sister: g.activeSisterIdx });
    } catch (e) {
      this.net = null;
      throw e;
    }
    welcome.players.filter((p) => p.id !== welcome.id).forEach((p) => g.remotes.add(p));
    this.rosterDirty = true;
    g.showToast(`👭 Raum ${welcome.room}: ${welcome.players.length} von 4 Spielern`, 4500);
    return welcome;
  }

  send(obj) {
    if (this.active) this.net.send(obj);
  }

  handlers() {
    const g = this.game;
    return {
      join: (m) => {
        g.remotes.add(m.player);
        this.rosterDirty = true;
        g.showToast(`👭 ${m.player.name} ist beigetreten`);
      },
      leave: (m) => {
        const p = g.remotes.remove(m.id);
        this.rosterDirty = true;
        if (p) g.showToast(`👋 ${p.name} hat das Spiel verlassen`);
      },
      host: () => {
        this.rosterDirty = true;
        if (this.net.isHost) g.showToast('👑 Du bist jetzt Gastgeber (der Boss läuft bei dir)');
      },
      s: (m) => {
        const p = g.remotes.get(m.id);
        if (p) p.applyState(m);
      },
      cast: (m) => this.onCast(m),
      boss: (m) => { this.bossMsg = m; },
      bossHit: (m) => g.applyBossDamage(m.dmg),
      bossPetrify: (m) => g.petrifyBoss(m.dur),
      slime: (m) => g.killSlimeRemote(m.i),
      time: (m) => this.onTime(m),
      skipTime: () => g.dayNight.skipToNextPhase(),
      emote: (m) => {
        const p = g.remotes.get(m.id);
        if (!p) return;
        g.showFloatingText(`${p.name} ${m.e}`, p.group.position.clone().setY(p.group.position.y + 3.6), '#ffffff');
        if (m.e === '🆘') g.showToast(`🆘 ${p.name} braucht Hilfe!`, 3500);
      },
      ping: (m) => this.addPing(m.id, m.x, m.z),
      chat: (m) => {
        const p = g.remotes.get(m.id);
        if (!p) return;
        p.say(m.text);
        this.logChat(p.name, m.text);
      },
      puzzle: (m) => {
        if (m.id === 'gate') g.stargate.openRemote();
        if (m.id === 'shrine') g.shrine.openRemote();
      },
      boss2: (m) => g.morvanta.onNetState(m),
      boss3: (m) => g.glaciel.onNetState(m),
      boss3Hit: (m) => {
        if (m.pet) g.glaciel.petrify(m.pet);
        if (m.dmg) g.glaciel.applyHit(m.dmg, m.cr >= 0 ? m.cr : -1);
      },
      weather: (m) => g.weather.setKind(m.k, false),
      boss2Hit: (m) => {
        if (m.pet) g.morvanta.petrify(m.pet);
        if (m.dmg) g.morvanta.applyHit(m.dmg);
      },
      boss2Free: (m) => g.morvanta.applyFree(m.n || 1),
      close: () => {
        g.remotes.clear();
        this.wheel.classList.remove('open');
        this.closeChat();
        this.net = null;
        this.bossMsg = null;
        this.rosterDirty = true;
        g.showToast('📡 Verbindung verloren – du spielst jetzt allein weiter', 6000);
      }
    };
  }

  // ---------- Outgoing ----------
  sendCast(a) {
    const g = this.game;
    if (!this.active) return;
    const p = g.playerGroup.position;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(g.playerGroup.quaternion);
    this.net.send({ t: 'cast', a, si: g.activeSisterIdx, x: r2(p.x), y: r2(p.y), z: r2(p.z), dx: r2(fwd.x), dz: r2(fwd.z) });
  }

  sendEmote(e) {
    const g = this.game;
    if (e === '📍') {
      const p = g.playerGroup.position;
      this.send({ t: 'ping', x: r2(p.x), z: r2(p.z) });
      this.addPing(this.net ? this.net.id : 0, p.x, p.z);
      return;
    }
    this.send({ t: 'emote', e });
    g.showFloatingText(e, g.playerGroup.position.clone().setY(g.playerGroup.position.y + 3.2), '#ffffff');
  }

  // ---------- Pings and compass markers for friends ----------
  addPing(id, x, z) {
    const g = this.game;
    const mine = this.net && id === this.net.id;
    const p = g.remotes.get(id);
    const name = mine ? 'Du' : p ? p.name : 'Freund';
    this.pings = this.pings.filter(pg => pg.id !== id);
    this.pings.push({ id, name, x, z, until: performance.now() + PING_SECONDS * 1000 });
    if (!mine) {
      g.showToast(`📍 ${name}: Hier!`, 3000);
      sfx.collect();
    }
    g.fx.ringWave(new THREE.Vector3(x, g.getTerrainHeight(x, z), z), new THREE.Color(2.4, 1.8, 0.5), 5, 1.2);
  }

  // Friends (and pings) on the compass; a friend in need is named in the label
  getCompassTargets() {
    const g = this.game;
    const out = [];
    const now = performance.now();
    this.pings = this.pings.filter(pg => pg.until > now);
    this.pings.forEach(pg => out.push({ id: `ping:${pg.id}`, icon: '📍', label: `${pg.name}: Hier!`, x: pg.x, z: pg.z }));
    g.remotes.list.forEach(r => {
      if (!r.hasState) return;
      out.push({
        id: `friend:${r.id}`, icon: r.downed ? '🆘' : SISTER_ICONS[r.sister], label: r.downed ? `${r.name} ist KO!` : r.name,
        x: r.group.position.x, z: r.group.position.z, noLabel: !r.downed
      });
    });
    return out;
  }

  // ---------- Chat: text box (Enter), quick phrases and a short log ----------
  buildChat() {
    const log = document.createElement('div');
    log.id = 'chat-log';
    log.className = 'chat-log';
    document.body.appendChild(log);
    this.chatLog = log;

    const box = document.createElement('div');
    box.id = 'chat-box';
    box.className = 'chat-box';
    const input = document.createElement('input');
    input.type = 'text';
    input.maxLength = 80;
    input.placeholder = 'Nachricht … (Enter sendet)';
    input.autocomplete = 'off';
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this.sendChat(input.value);
        input.value = '';
        this.closeChat();
      } else if (e.key === 'Escape') {
        this.closeChat();
      }
    });
    const phrases = document.createElement('div');
    phrases.className = 'chat-phrases';
    PHRASES.forEach(text => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-phrase clickable';
      b.textContent = text;
      b.addEventListener('click', () => { this.sendChat(text); this.closeChat(); });
      phrases.appendChild(b);
    });
    box.append(phrases, input);
    document.body.appendChild(box);
    this.chatBox = box;
    this.chatInput = input;
  }

  openChat() {
    if (!this.active) return;
    this.chatBox.classList.add('open');
    this.wheel.classList.remove('open');
    setTimeout(() => this.chatInput.focus(), 30);
  }

  closeChat() {
    this.chatBox.classList.remove('open');
    this.chatInput.blur();
  }

  toggleChat() {
    if (this.chatBox.classList.contains('open')) this.closeChat();
    else this.openChat();
  }

  sendChat(text) {
    const clean = String(text || '').replace(/[<>]/g, '').trim().slice(0, 80);
    if (!clean) return;
    this.send({ t: 'chat', text: clean });
    this.logChat(this.name, clean, true);
  }

  logChat(name, text, mine = false) {
    const line = document.createElement('div');
    line.className = 'chat-line' + (mine ? ' mine' : '');
    const who = document.createElement('b');
    who.textContent = `${name}: `;
    line.append(who, document.createTextNode(text));
    this.chatLog.appendChild(line);
    while (this.chatLog.children.length > 6) this.chatLog.firstChild.remove();
    setTimeout(() => line.remove(), 14000);
  }

  // ---------- Emote wheel (button in the roster, key T) ----------
  buildWheel() {
    const wheel = document.createElement('div');
    wheel.id = 'emote-wheel';
    wheel.className = 'emote-wheel';
    EMOTES.forEach((e, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'emote-item clickable';
      b.textContent = e;
      const ang = -Math.PI / 2 + (i / EMOTES.length) * Math.PI * 2;
      b.style.setProperty('--x', `${Math.cos(ang) * 84}px`);
      b.style.setProperty('--y', `${Math.sin(ang) * 84}px`);
      b.title = e === '📍' ? 'Markierung setzen' : e === '🆘' ? 'Hilfe rufen' : 'Emote';
      b.addEventListener('click', () => {
        this.sendEmote(e);
        this.toggleWheel(false);
      });
      wheel.appendChild(b);
    });
    document.body.appendChild(wheel);
    this.wheel = wheel;
  }

  toggleWheel(force) {
    if (!this.active && force !== false) return;
    const open = force === undefined ? !this.wheel.classList.contains('open') : force;
    this.wheel.classList.toggle('open', open);
  }

  // ---------- Incoming ----------
  onCast(m) {
    const g = this.game;
    const p = g.remotes.get(m.id);
    if (!p) return;
    const pos = new THREE.Vector3(m.x, m.y, m.z);
    const fwd = new THREE.Vector3(m.dx, 0, m.dz);
    g.shrine.onCast(m.si, m.a, pos);
    if (m.a === 1) {
      g.sfxCast(m.si, pos);
      if (m.si === 0) {
        p.showShield(7);
        g.fx.ringWave(pos, new THREE.Color(0.8, 1.5, 2.4), 4.5, 0.6);
      } else if (m.si === 1) {
        g.spawnStarArrows(pos, fwd, true);
      } else if (m.si === 2) {
        g.createSupernovaParticles(pos);
      } else if (m.si === 3) {
        g.spawnPlanetRing(pos, fwd, true);
      }
    } else if (m.a === 2) {
      if (m.si === 0) {
        g.createHealParticles(pos);
        g.sfxCast(-1, pos);
        // Luna's heal also reaches friends standing close by
        if (pos.distanceTo(g.playerGroup.position) < HEAL_RADIUS) g.healPlayer(30, p.name);
      } else if (m.si === 1) {
        g.fx.burst(pos.clone().setY(pos.y + 1.2), [new THREE.Color(2.6, 2.0, 0.5)], 24, { speed: 3, up: 1, size: 0.35 });
      } else if (m.si === 2) {
        g.fx.ringWave(pos, new THREE.Color(1.4, 1.1, 0.8), 22, 1.0);
      } else if (m.si === 3) {
        g.fx.burst(pos.clone().setY(pos.y + 1.2), [new THREE.Color(1.6, 0.8, 2.6), new THREE.Color(2.2, 1.6, 2.6)], 40, { speed: 2.5, up: 1, size: 0.35, gravity: -1 });
      }
    }
  }

  onTime(m) {
    if (m.w !== undefined) this.game.weather.setKind(m.w, false, true);
    const dn = this.game.dayNight;
    if (dn.skipTarget !== null) return;
    const diff = wrapAngle((m.p - dn.p) * Math.PI * 2) / (Math.PI * 2);
    if (Math.abs(diff) > 0.02) dn.p = (m.p + 1) % 1;
  }

  // ---------- Per frame ----------
  update(delta, dtFactor) {
    const g = this.game;
    g.remotes.update(delta);
    if (!this.active) {
      this.updateHud(delta);
      return;
    }

    const t = this.timers;
    t.state -= delta;
    if (t.state <= 0) {
      t.state = STATE_INTERVAL;
      const p = g.playerGroup.position;
      this.net.send({
        t: 's', x: r2(p.x), y: r2(p.y), z: r2(p.z), ry: r2(g.playerGroup.rotation.y),
        si: g.activeSisterIdx, mv: g.playerIsMoving ? 1 : 0, gr: g.isGrounded ? 1 : 0, sw: g.isSwimming ? 1 : 0,
        vy: r2(g.playerVelY), inv: g.isPlayerInvisible ? 1 : 0, hp: Math.round(g.playerHP), mhp: g.maxPlayerHP,
        dn: g.isDowned ? 1 : 0, vr: g.progression.getSkin(g.activeSisterIdx)
      });
    }

    if (this.net.isHost) {
      t.boss -= delta;
      if (t.boss <= 0) {
        t.boss = BOSS_INTERVAL;
        const b = g.bossData;
        const bp = g.bossGroup.position;
        this.net.send({
          t: 'boss', x: r2(bp.x), z: r2(bp.z), ry: r2(wrapAngle(g.bossGroup.rotation.y)),
          st: b.state, hp: b.hp, al: b.alive ? 1 : 0, pet: r2(b.petrifiedTimer)
        });
      }
      t.boss2 = (t.boss2 || 0) - delta;
      if (t.boss2 <= 0) {
        t.boss2 = BOSS_INTERVAL;
        this.net.send(g.morvanta.netState());
      }
      t.boss3 = (t.boss3 || 0) - delta;
      if (t.boss3 <= 0) {
        t.boss3 = BOSS_INTERVAL;
        this.net.send(g.glaciel.netState());
      }
      t.time -= delta;
      if (t.time <= 0) {
        t.time = TIME_INTERVAL;
        this.net.send({ t: 'time', p: r2(g.dayNight.p * 1000) / 1000, w: g.weather.kind });
      }
    } else if (this.bossMsg) {
      this.updateBossPuppet(delta, dtFactor);
    }

    this.updateHud(delta);
  }

  updateBossPuppet(delta, dtFactor) {
    const g = this.game;
    const b = g.bossData;
    const m = this.bossMsg;

    if (m.hp !== b.hp) {
      if (m.hp < b.hp) g.showFloatingText(`-${Math.round(b.hp - m.hp)} HP!`, g.bossGroup.position, '#00f0ff');
      b.hp = m.hp;
      g.updateBossBar();
    }
    if (!m.al && b.alive) {
      g.defeatBoss();
      return;
    }
    if (!b.alive) return;

    b.petrifiedTimer = m.pet;
    if (m.st !== b.state) {
      b.state = m.st;
      g.bossGroup.rotation.z = 0;
      if (m.pet <= 0) g.setBossStateText();
      if (m.st === 'spin') g.playBossSpin();
    }

    const k = 1 - Math.exp(-10 * delta);
    const pos = g.bossGroup.position;
    pos.x += (m.x - pos.x) * k;
    pos.z += (m.z - pos.z) * k;
    pos.y = g.getTerrainHeight(pos.x, pos.z);

    if (m.pet > 0) return;
    if (m.st === 'spin') {
      g.bossGroup.rotation.y += 0.35 * dtFactor;
    } else {
      g.bossGroup.rotation.y += wrapAngle(m.ry - g.bossGroup.rotation.y) * k;
      if (m.st === 'dizzy') g.bossGroup.rotation.z = Math.sin(Date.now() * 0.01) * 0.25;
    }
  }

  // ---------- HUD ----------
  updateHud(delta) {
    if (!this.hud) return;
    const g = this.game;
    const show = this.active;
    this.hud.classList.toggle('active', show);
    if (!show) return;

    if (this.rosterDirty) {
      this.rosterDirty = false;
      this.buildHud();
    }
    this.timers.hud -= delta;
    if (this.timers.hud > 0) return;
    this.timers.hud = HUD_INTERVAL;

    const fill = (id, hp, max) => {
      const el = this.hud.querySelector(`[data-hp="${id}"]`);
      if (el) el.style.width = `${Math.max(0, Math.min(100, (hp / max) * 100))}%`;
    };
    fill('me', g.playerHP, g.maxPlayerHP);
    g.remotes.list.forEach((p) => fill(p.id, p.hp, p.maxHp));
    const mySister = this.hud.querySelector('[data-icon="me"]');
    if (mySister) mySister.textContent = SISTER_ICONS[g.activeSisterIdx];
    g.remotes.list.forEach((p) => {
      const el = this.hud.querySelector(`[data-icon="${p.id}"]`);
      if (el) el.textContent = SISTER_ICONS[p.sister];
    });
  }

  buildHud() {
    const g = this.game;
    const row = (id, icon, name, crown) => `
      <div class="coop-row">
        <span class="coop-icon" data-icon="${id}">${icon}</span>
        <div class="coop-info">
          <div class="coop-name"></div>
          <div class="coop-hp"><div class="coop-hp-fill" data-hp="${id}"></div></div>
        </div>
        ${crown ? '<span class="coop-crown">👑</span>' : ''}
      </div>`;
    const hostId = this.net.hostId;
    let html = `<div class="coop-room">Raum ${this.net.room}</div>`;
    html += row('me', SISTER_ICONS[g.activeSisterIdx], this.name, this.net.id === hostId);
    g.remotes.list.forEach((p) => { html += row(p.id, SISTER_ICONS[p.sister], p.name, p.id === hostId); });
    html += '<button type="button" class="coop-emote-fab clickable" id="btn-emote-wheel">💬 Emotes & Ping (T)</button>';
    html += '<button type="button" class="coop-emote-fab clickable" id="btn-chat">⌨️ Chat & Sätze (Enter)</button>';
    this.hud.innerHTML = html;

    // Names go in as text, never as markup
    const names = this.hud.querySelectorAll('.coop-name');
    names[0].textContent = `${this.name} (Du)`;
    g.remotes.list.forEach((p, i) => { names[i + 1].textContent = p.name; });
    this.hud.querySelector('#btn-emote-wheel').addEventListener('click', (ev) => {
      this.toggleWheel();
      ev.currentTarget.blur();
    });
    this.hud.querySelector('#btn-chat').addEventListener('click', (ev) => {
      this.toggleChat();
      ev.currentTarget.blur();
    });
  }
}
