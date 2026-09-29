// ==========================================
// REMOTE PLAYERS: the other sisters in a co-op session.
// Each one is a ChibiRig with a name tag, smoothed towards the last state received.
// ==========================================
import * as THREE from 'three';
import { ChibiRig } from './characters.js';
import { createShieldMaterial } from './magicfx.js';

const SISTER_ICONS = ['🌙', '⭐', '☀️', '🪐'];
const SISTER_COLORS = ['#90e0ef', '#ffe066', '#ff9f43', '#c77dff'];

function createNameTag(name, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '800 30px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 7;
  ctx.strokeStyle = 'rgba(25, 15, 45, 0.85)';
  ctx.strokeText(name, 128, 34);
  ctx.fillStyle = color;
  ctx.fillText(name, 128, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  mat.userData.noNightGlow = true;
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.6, 0.65, 1);
  sprite.position.y = 3.2;
  sprite.renderOrder = 10; // drawn after the shield bubble so the name stays readable
  return sprite;
}

const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Speech bubble: up to two lines of text on a rounded card
function createBubble(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  ctx.font = '700 34px "Segoe UI", sans-serif';
  const words = String(text).split(' ');
  const lines = [''];
  words.forEach(w => {
    const cur = lines[lines.length - 1];
    if (ctx.measureText(cur + ' ' + w).width > 450 && lines.length < 3) lines.push(w);
    else lines[lines.length - 1] = cur ? cur + ' ' + w : w;
  });
  const h = 26 + lines.length * 42;
  const y0 = 150 - h;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.strokeStyle = 'rgba(120, 90, 200, 0.9)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.roundRect(8, y0, 496, h, 26);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2b1d4a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  lines.forEach((l, i) => ctx.fillText(l, 256, y0 + 33 + i * 42));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  mat.userData.noNightGlow = true;
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.4, 1.375, 1);
  sprite.position.y = 4.5;
  sprite.renderOrder = 11;
  return sprite;
}

class RemotePlayer {
  constructor(game, info) {
    this.game = game;
    this.id = info.id;
    this.name = info.name;
    this.sister = info.sister | 0;
    this.hp = 100;
    this.maxHp = 100;
    this.invisible = false;
    this.downed = false;
    this.variant = 0;
    this.hasState = false;
    this.shieldTimer = 0;

    this.group = new THREE.Group();
    this.group.visible = false;
    this.rig = new ChibiRig();
    this.group.add(this.rig.group);
    this.rig.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    game.applySisterLook(this.rig, this.sister, 0);

    this.shield = new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), createShieldMaterial());
    this.shield.position.y = 1.5;
    this.group.add(this.shield);

    this.tag = createNameTag(this.name, SISTER_COLORS[this.sister] || '#ffffff');
    this.group.add(this.tag);
    game.scene.add(this.group);

    this.target = new THREE.Vector3();
    this.targetRy = 0;
    this.buffer = []; // recent { t, pos, ry } samples; we draw ~110 ms in the past for smooth motion
    this.bubble = null;
    this.bubbleTimer = 0;
    this.flags = { moving: false, grounded: true, swimming: false, velY: 0 };
  }

  setSister(idx, variant = 0) {
    if (idx === this.sister && variant === this.variant) return;
    const sisterChanged = idx !== this.sister;
    this.sister = idx;
    this.variant = variant;
    this.game.applySisterLook(this.rig, idx, variant);
    if (!sisterChanged) return;
    this.tag.material.map.dispose();
    this.group.remove(this.tag);
    this.tag.material.dispose();
    this.tag = createNameTag(this.name, SISTER_COLORS[idx] || '#ffffff');
    this.group.add(this.tag);
    if (this.invisible) this.rig.setOpacity(0.25);
  }

  applyState(m) {
    this.target.set(m.x, m.y, m.z);
    this.targetRy = m.ry;
    this.buffer.push({ t: performance.now(), pos: this.target.clone(), ry: m.ry });
    if (this.buffer.length > 12) this.buffer.shift();
    const wasDowned = this.downed;
    this.downed = !!m.dn;
    this.flags = { moving: !!m.mv, grounded: !!m.gr, swimming: !!m.sw, velY: m.vy, downed: this.downed };
    if (this.downed && !wasDowned) this.game.showToast(`🆘 ${this.name} ist KO – lauf hin und hilf!`, 4000);
    this.hp = m.hp;
    this.maxHp = m.mhp || 100;
    this.setSister(m.si | 0, m.vr | 0);
    const inv = !!m.inv;
    if (inv !== this.invisible) {
      this.invisible = inv;
      this.rig.setOpacity(inv ? 0.25 : 1);
      this.tag.visible = !inv;
    }
    if (!this.hasState) {
      this.hasState = true;
      this.group.position.copy(this.target);
      this.group.rotation.y = this.targetRy;
      this.group.visible = true;
    }
  }

  showShield(seconds) {
    this.shieldTimer = seconds;
    this.shield.material.opacity = 0.75;
  }

  // Position at `renderTime`, interpolated between the two samples around it
  sample(renderTime) {
    const b = this.buffer;
    if (b.length === 0) return { pos: this.target, ry: this.targetRy };
    if (renderTime <= b[0].t) return { pos: b[0].pos, ry: b[0].ry };
    for (let i = b.length - 1; i > 0; i--) {
      const s0 = b[i - 1];
      const s1 = b[i];
      if (renderTime >= s0.t && renderTime <= s1.t) {
        const u = (renderTime - s0.t) / Math.max(1, s1.t - s0.t);
        // big jumps (dash, being carried away, respawn) are not smoothed
        if (s0.pos.distanceToSquared(s1.pos) > 144) return { pos: u < 0.5 ? s0.pos : s1.pos, ry: s1.ry };
        this._tmp = this._tmp || new THREE.Vector3();
        return { pos: this._tmp.lerpVectors(s0.pos, s1.pos, u), ry: s0.ry + wrapAngle(s1.ry - s0.ry) * u };
      }
    }
    const last = b[b.length - 1];
    return { pos: last.pos, ry: last.ry };
  }

  say(text) {
    if (this.bubble) {
      this.group.remove(this.bubble);
      this.bubble.material.map.dispose();
      this.bubble.material.dispose();
    }
    this.bubble = createBubble(text);
    this.group.add(this.bubble);
    this.bubbleTimer = 5.5;
  }

  update(delta) {
    if (!this.hasState) return;
    const k = 1 - Math.exp(-18 * delta);
    const { pos, ry } = this.sample(performance.now() - 110);
    if (this.group.position.distanceToSquared(pos) > 400) this.group.position.copy(pos);
    else this.group.position.lerp(pos, k);
    this.group.rotation.y += wrapAngle(ry - this.group.rotation.y) * k;
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= delta;
      if (this.bubbleTimer <= 0 && this.bubble) {
        this.group.remove(this.bubble);
        this.bubble.material.map.dispose();
        this.bubble.material.dispose();
        this.bubble = null;
      } else if (this.bubble) {
        this.bubble.material.opacity = Math.min(1, this.bubbleTimer / 0.6);
      }
    }
    this.rig.update(delta, this.flags);
    if (this.shieldTimer > 0) {
      this.shieldTimer -= delta;
      if (this.shieldTimer <= 0) this.shield.material.opacity = 0;
    }
  }

  dispose() {
    this.game.scene.remove(this.group);
    this.tag.material.map.dispose();
    this.tag.material.dispose();
    this.shield.geometry.dispose();
    this.shield.material.dispose();
  }
}

export class RemotePlayers {
  constructor(game) {
    this.game = game;
    this.players = new Map();
  }

  get list() {
    return [...this.players.values()];
  }

  add(info) {
    if (this.players.has(info.id)) return this.players.get(info.id);
    const p = new RemotePlayer(this.game, info);
    this.players.set(info.id, p);
    return p;
  }

  remove(id) {
    const p = this.players.get(id);
    if (!p) return null;
    p.dispose();
    this.players.delete(id);
    return p;
  }

  clear() {
    [...this.players.keys()].forEach((id) => this.remove(id));
  }

  get(id) {
    return this.players.get(id);
  }

  update(delta) {
    this.players.forEach((p) => p.update(delta));
  }
}

export { SISTER_ICONS, SISTER_COLORS };
