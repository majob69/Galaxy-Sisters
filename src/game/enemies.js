// Enemies and loot: slime packs that chase and bite, shadow wisps that haunt the night,
// and the hearts / star dust they drop. Everything here is simulated per client.
import * as THREE from 'three';
import { sfx } from './shared.js';
import { createSoftSpriteTexture } from '../water.js';

const SLIME_AGGRO = 9;
const SLIME_SPEED = 2.4;
const SLIME_DAMAGE = 4;
const SLIME_RESPAWN = 75; // seconds, only when the player is far away

const WISP_CAP = 5;
const WISP_HP = 20;
const WISP_DAMAGE = 5;
const WISP_SPEED = 2.7;

const LOOT_LIFETIME = 40;
const LOOT_MAGNET = 4;

function emojiTexture(emoji) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = '46px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, 36);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const enemyMethods = {
  initEnemies() {
    this.wisps = [];
    this.loot = [];
    this.wispTimer = 5;
    this.lootTex = { heart: emojiTexture('💗'), dust: emojiTexture('✨') };
    this.wispGeo = new THREE.SphereGeometry(0.42, 12, 10);
    this.wispMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 0.4, 2.4) });
    this.wispHaloMat = new THREE.SpriteMaterial({
      map: createSoftSpriteTexture(),
      color: new THREE.Color(0.8, 0.25, 1.7),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.slimes.forEach(s => {
      Object.assign(s.userData, { attackCd: 0, deadAt: 0, hop: Math.random() * 6 });
    });
  },

  updateEnemies(delta) {
    this.updateSlimes(delta);
    this.updateWisps(delta);
    this.updateLoot(delta);
  },

  // ---------- Damage to the local player (shield, KO guard) ----------
  damagePlayer(amount) {
    if (this.isDowned || this.playerHP <= 0) return false;
    if (this.activeSisterIdx === 0 && this.shieldMesh.material.opacity > 0) {
      this.showFloatingText('🛡️ Geblockt!', this.playerGroup.position, '#90e0ef');
      return false;
    }
    this.playerHP = Math.max(0, this.playerHP - amount);
    this.updateHPBar();
    sfx.hit();
    this.showFloatingText(`-${amount}`, this.playerGroup.position.clone().setY(this.playerGroup.position.y + 0.6), '#ff6b8b');
    return true;
  },

  // ---------- Slimes ----------
  updateSlimes(delta) {
    const pp = this.playerGroup.position;
    const t = this.clock.elapsedTime;
    this.slimes.forEach(s => {
      const u = s.userData;
      if (!u.alive) {
        if (u.deadAt && t - u.deadAt > SLIME_RESPAWN && s.position.distanceTo(pp) > 25) this.respawnSlime(s);
        return;
      }
      if (u.petrifiedTimer > 0) return;
      u.attackCd = Math.max(0, u.attackCd - delta);

      const dx = pp.x - s.position.x;
      const dz = pp.z - s.position.z;
      const d = Math.hypot(dx, dz);
      const chase = !this.isPlayerInvisible && !this.isDowned && d < SLIME_AGGRO && Math.abs(pp.y - s.position.y) < 4;
      let tx = u.basePos.x;
      let tz = u.basePos.z;
      let speed = 1.4;
      if (chase) {
        tx = pp.x;
        tz = pp.z;
        speed = SLIME_SPEED;
      }
      const mx = tx - s.position.x;
      const mz = tz - s.position.z;
      const md = Math.hypot(mx, mz);
      const stopAt = chase ? 1.1 : 0.4;
      let moving = false;
      if (md > stopAt) {
        const step = Math.min(md - stopAt, speed * delta);
        const nx = s.position.x + (mx / md) * step;
        const nz = s.position.z + (mz / md) * step;
        if (this.getWaterSurface(nx, nz) === null && !this.checkWallCollision(nx, nz, 0.7, s.position.y)) {
          s.position.x = nx;
          s.position.z = nz;
          moving = true;
        }
        s.rotation.y += Math.atan2(Math.sin(Math.atan2(mx, mz) - s.rotation.y), Math.cos(Math.atan2(mx, mz) - s.rotation.y)) * Math.min(1, delta * 8);
      }
      u.hop += delta * (moving ? 9 : 2);
      const hop = moving ? Math.abs(Math.sin(u.hop)) * 0.4 : 0;
      s.position.y = this.getTerrainHeight(s.position.x, s.position.z) + hop;

      if (chase && d < 1.6 && u.attackCd <= 0) {
        u.attackCd = 1.7;
        this.damagePlayer(SLIME_DAMAGE);
      }
    });
  },

  respawnSlime(s) {
    const u = s.userData;
    u.alive = true;
    u.hp = u.maxHp;
    u.deadAt = 0;
    u.petrifiedTimer = 0;
    s.visible = true;
    s.position.copy(u.basePos);
    this.fx.burst(s.position.clone().setY(s.position.y + 0.7), [new THREE.Color(0.6, 2.2, 1.0)], 14, { speed: 2, up: 1, size: 0.3 });
  },

  // The local player finished off a slime: tell friends, XP and loot
  onSlimeKilledLocal(slime) {
    this.coop.send({ t: 'slime', i: this.slimes.indexOf(slime) });
    slime.userData.deadAt = this.clock.elapsedTime;
    this.progression.addXp(10, 'Slime');
    this.dropLoot(slime.position, { dust: 0.8, heart: 0.25 });
  },

  // ---------- Shadow wisps (night) ----------
  updateWisps(delta) {
    const night = this.dayNight ? this.dayNight.night : 0;
    const pp = this.playerGroup.position;
    const t = this.clock.elapsedTime;

    this.wispTimer -= delta;
    if (night > 0.55 && this.wisps.length < WISP_CAP && this.wispTimer <= 0 && !this.isDowned) {
      this.spawnWisp();
      this.wispTimer = 5 + Math.random() * 4;
    }

    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      const u = w.userData;
      const d = w.position.distanceTo(pp);

      // Dawn dissolves them; so does wandering far away
      if (night < 0.25 || d > 48) {
        u.fade = (u.fade ?? 1) - delta * 1.5;
        w.scale.setScalar(Math.max(0.01, u.fade));
        if (u.fade <= 0) this.removeWisp(i);
        continue;
      }
      if (u.petrifiedTimer > 0) {
        u.petrifiedTimer -= delta;
        continue;
      }

      const hunt = !this.isPlayerInvisible && !this.isDowned && d < 32;
      if (hunt) {
        const dir = new THREE.Vector3().subVectors(pp, w.position).setY(0).normalize();
        w.position.addScaledVector(dir, WISP_SPEED * delta);
      } else {
        w.position.x += Math.cos(t * 0.7 + u.phase) * delta * 1.2;
        w.position.z += Math.sin(t * 0.6 + u.phase) * delta * 1.2;
      }
      const floorY = this.getTerrainHeight(w.position.x, w.position.z);
      const wantY = Math.max(floorY, pp.y) + 1.5 + Math.sin(t * 2.4 + u.phase) * 0.35;
      w.position.y += (wantY - w.position.y) * Math.min(1, delta * 3);
      w.userData.halo.scale.setScalar(2.6 + Math.sin(t * 6 + u.phase) * 0.35);

      if (hunt && d < 1.4) {
        this.damagePlayer(WISP_DAMAGE);
        this.fx.burst(w.position.clone(), [new THREE.Color(1.3, 0.4, 2.4)], 16, { speed: 2.5, up: 0.5, size: 0.3 });
        this.removeWisp(i);
      }
    }
  },

  spawnWisp() {
    const pp = this.playerGroup.position;
    const ang = Math.random() * Math.PI * 2;
    const r = 15 + Math.random() * 8;
    const x = Math.max(-92, Math.min(92, pp.x + Math.cos(ang) * r));
    const z = Math.max(-92, Math.min(92, pp.z + Math.sin(ang) * r));
    const g = new THREE.Group();
    g.add(new THREE.Mesh(this.wispGeo, this.wispMat));
    const halo = new THREE.Sprite(this.wispHaloMat);
    halo.scale.setScalar(2.6);
    g.add(halo);
    g.position.set(x, this.getTerrainHeight(x, z) + 2, z);
    g.userData = { hp: WISP_HP, phase: Math.random() * 10, halo, petrifiedTimer: 0 };
    this.scene.add(g);
    this.wisps.push(g);
  },

  removeWisp(i) {
    this.scene.remove(this.wisps[i]);
    this.wisps.splice(i, 1);
  },

  petrifyWisps(duration) {
    const pp = this.playerGroup.position;
    this.wisps.forEach(w => {
      if (w.position.distanceTo(pp) < 22) w.userData.petrifiedTimer = duration;
    });
  },

  // Damage from spells and arrows; returns true if something was hit
  hitWisps(pos, radius, dmg) {
    let hit = false;
    for (let i = this.wisps.length - 1; i >= 0; i--) {
      const w = this.wisps[i];
      if (w.position.distanceTo(pos) > radius) continue;
      hit = true;
      w.userData.hp -= dmg;
      this.showFloatingText(`-${dmg}`, w.position, '#e0aaff');
      if (w.userData.hp <= 0) {
        this.fx.burst(w.position.clone(), [new THREE.Color(1.3, 0.4, 2.4), new THREE.Color(2.4, 1.6, 2.6)], 30, { speed: 3.5, up: 1, size: 0.35 });
        this.fx.ringWave(w.position.clone().setY(w.position.y - 0.8), new THREE.Color(1.0, 0.4, 2.0), 3, 0.5);
        sfx.hit();
        this.progression.addXp(8, 'Irrlicht');
        this.dropLoot(w.position, { dust: 0.7, heart: 0.18 });
        this.removeWisp(i);
      }
    }
    return hit;
  },

  // ---------- Loot ----------
  dropLoot(pos, chances) {
    if (Math.random() < chances.dust) this.addLoot('dust', pos);
    if (Math.random() < chances.heart) this.addLoot('heart', pos);
  },

  addLoot(kind, pos) {
    const mat = new THREE.SpriteMaterial({ map: this.lootTex[kind], transparent: true, depthWrite: false, fog: false });
    mat.userData.noNightGlow = true;
    const sprite = new THREE.Sprite(mat);
    sprite.scale.setScalar(kind === 'heart' ? 0.95 : 0.8);
    const ground = this.getTerrainHeight(pos.x, pos.z);
    const ox = (Math.random() - 0.5) * 1.6;
    const oz = (Math.random() - 0.5) * 1.6;
    sprite.position.set(pos.x + ox, Math.max(ground, pos.y) + 0.7, pos.z + oz);
    this.scene.add(sprite);
    this.loot.push({ sprite, kind, born: this.clock.elapsedTime, phase: Math.random() * 6, vy: 3 });
  },

  updateLoot(delta) {
    if (!this.loot.length) return;
    const pp = this.playerGroup.position;
    const t = this.clock.elapsedTime;
    for (let i = this.loot.length - 1; i >= 0; i--) {
      const l = this.loot[i];
      const s = l.sprite;
      const age = t - l.born;
      const ground = this.getTerrainHeight(s.position.x, s.position.z) + 0.75;

      // Pop up, then settle and bob
      if (l.vy !== 0) {
        s.position.y += l.vy * delta;
        l.vy -= 9 * delta;
        if (s.position.y <= ground) { s.position.y = ground; l.vy = 0; }
      } else {
        s.position.y = ground + Math.sin(t * 3 + l.phase) * 0.12;
      }

      const dx = pp.x - s.position.x;
      const dz = pp.z - s.position.z;
      const d = Math.hypot(dx, dz);
      if (!this.isDowned && d < LOOT_MAGNET && l.vy === 0) {
        const pull = Math.min(d, 7 * delta);
        s.position.x += (dx / d) * pull;
        s.position.z += (dz / d) * pull;
      }
      if (!this.isDowned && d < 1.2 && Math.abs(pp.y + 0.8 - s.position.y) < 2.4) {
        this.collectLoot(l);
        this.scene.remove(s);
        s.material.dispose();
        this.loot.splice(i, 1);
        continue;
      }
      if (age > LOOT_LIFETIME - 5) s.material.opacity = Math.max(0, (LOOT_LIFETIME - age) / 5);
      if (age > LOOT_LIFETIME) {
        this.scene.remove(s);
        s.material.dispose();
        this.loot.splice(i, 1);
      }
    }
  },

  collectLoot(l) {
    const pos = this.playerGroup.position;
    this.fx.burst(pos.clone().setY(pos.y + 1.2), [new THREE.Color(l.kind === 'heart' ? 2.4 : 2.2, l.kind === 'heart' ? 0.7 : 1.9, l.kind === 'heart' ? 1.2 : 0.5)], 10, { speed: 2, up: 1, size: 0.25 });
    sfx.collect();
    if (l.kind === 'heart') {
      this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + 20);
      this.updateHPBar();
      this.showFloatingText('💗 +20 HP', pos, '#ff8fb1');
    } else {
      this.progression.addXp(3, '✨');
    }
  }
};
