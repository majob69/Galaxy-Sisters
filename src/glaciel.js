// ==========================================
// BOSS 3: GLACIEL, the frost golem. Sleeps as an ice statue until Morvanta is beaten.
// Her ice armor soaks up almost all damage. Three frost crystals feed the armor:
// smash all three and the core is exposed for a few seconds (x1.5 damage) - then the crystals regrow.
// Attacks: ice spikes (lines drawn on the ground first), snow volley (marked circles that slow you)
// and a leaping slam with a shockwave you can jump over. Host-authoritative like the other bosses.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { findFlatSpot } from './spots.js';
import { createSoftSpriteTexture } from './water.js';
import { ArenaLock } from './arenas.js';

const MAX_HP = 420;
const CRYSTAL_HP = 60;
const ARENA_RADIUS = 14;
const CRYSTAL_RING = 9.5;
const LINE_LEN = 21;
const LINE_HALF = 1.4;
const LINE_FUSE = 1.4;
const LINE_LIFE = 1.9;
const SNOW_RADIUS = 2.5;
const SNOW_FUSE = 1.5;
const SNOW_LIFE = 1.95;
const LINE_DAMAGE = 16;
const SNOW_DAMAGE = 10;
const SLAM_DAMAGE = 18;
const SLOW_SECONDS = 2.5;
const STUN_SECONDS = 9;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const r2 = (v) => Math.round(v * 100) / 100;

export class Glaciel {
  constructor(game, avoid = []) {
    this.game = game;
    this.center = findFlatSpot(game, { target: { x: 60, z: -50 }, radius: ARENA_RADIUS, extent: 70, avoid, pull: 0.06 });
    this.d = {
      st: 'sleep', hp: MAX_HP, maxHp: MAX_HP, alive: true, awake: false, timer: 0, pet: 0,
      cr: [CRYSTAL_HP, CRYSTAL_HP, CRYSTAL_HP], zones: [], zid: 0, attackIdx: 0, sl: null
    };
    this.msg = null;
    this.morvantaDown = false; // Morvanta beaten
    this.zoneHits = new Set();
    this.slamHit = false;
    this.pos = new THREE.Vector3(this.center.x, this.groundAt(this.center.x, this.center.z), this.center.z);
    this.hitPoint = new THREE.Vector3();
    this.slamFrom = new THREE.Vector3();
    this.slamTo = new THREE.Vector3();
    this.buildArena();
    this.buildModel();
    this.buildBanner();
    this.applyVisual(0);
  }

  groundAt(x, z) {
    return this.game.getTerrainHeight(x, z);
  }

  // ---------- Scene ----------
  buildArena() {
    const g = this.game;
    const { x: cx, z: cz } = this.center;
    const by = this.groundAt(cx, cz);
    this.arena = new THREE.Group();
    const snow = new THREE.Mesh(
      new THREE.CircleGeometry(ARENA_RADIUS, 40),
      new THREE.MeshLambertMaterial({ color: 0xeaf6ff, transparent: true, opacity: 0.9 })
    );
    snow.rotation.x = -Math.PI / 2;
    snow.position.set(cx, by + 0.06, cz);
    snow.receiveShadow = true;
    this.arena.add(snow);

    const iceMat = new THREE.MeshLambertMaterial({ color: 0xbfe8ff, emissive: 0x2b6fa8, emissiveIntensity: 0.4, flatShading: true, transparent: true, opacity: 0.92 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const px = cx + Math.cos(a) * (ARENA_RADIUS + 0.5);
      const pz = cz + Math.sin(a) * (ARENA_RADIUS + 0.5);
      const py = g.getTerrainHeight(px, pz);
      const h = 3 + (i % 3) * 1.3;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.9, h, 5), iceMat);
      spike.position.set(px, py + h / 2 - 0.3, pz);
      spike.castShadow = true;
      this.arena.add(spike);
      g.colliders.push({ type: 'cylinder', x: px, z: pz, radius: 0.8, minY: py - 1, maxY: py + h });
    }
    g.scene.add(this.arena);

    // Frost crystals on a ring
    const cGlow = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 2.8) });
    cGlow.userData.noNightGlow = true;
    const halo = createSoftSpriteTexture();
    this.crystals = [0, 1, 2].map(i => {
      const a = Math.PI / 2 + (i * Math.PI * 2) / 3;
      const x = cx + Math.cos(a) * CRYSTAL_RING;
      const z = cz + Math.sin(a) * CRYSTAL_RING;
      const y = g.getTerrainHeight(x, z);
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.2, 0.8, 7), iceMat);
      base.position.y = 0.4;
      grp.add(base);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.85, 0), cGlow);
      gem.scale.set(0.8, 1.7, 0.8);
      gem.position.y = 2.1;
      grp.add(gem);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0x88e0ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.7 }));
      glow.scale.setScalar(4);
      glow.position.y = 2.1;
      grp.add(glow);
      g.scene.add(grp);
      g.colliders.push({ type: 'cylinder', x, z, radius: 1.0, minY: y - 1, maxY: y + 1 });
      return { x, y, z, group: grp, gem, glow, hitPos: new THREE.Vector3(x, y + 2.1, z) };
    });
    this.crystalLinks = [0, 1, 2].map(() => {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1, 5), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 2.0, 2.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      g.scene.add(beam);
      return beam;
    });

    // Zone telegraphs: pooled flat markers (circles and lines)
    this.zoneMeshes = [];
    for (let i = 0; i < 10; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 1.7, 2.4), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
      mat.userData.noNightGlow = true;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      g.scene.add(mesh);
      this.zoneMeshes.push(mesh);
    }
    this.circleGeo = new THREE.CircleGeometry(1, 28);
    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    // shockwave ring
    this.wave = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 2.2, 3.0), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
    this.wave.rotation.x = -Math.PI / 2;
    this.wave.visible = false;
    g.scene.add(this.wave);
  }

  buildModel() {
    const g = this.game;
    this.group = new THREE.Group();
    const ice = new THREE.MeshLambertMaterial({ color: 0x9fdcff, emissive: 0x2a6fa8, emissiveIntensity: 0.35, flatShading: true });
    const iceDark = new THREE.MeshLambertMaterial({ color: 0x6fb4e8, emissive: 0x1c4f86, emissiveIntensity: 0.3, flatShading: true });
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 2.6, 3.0) });
    eyeMat.userData.noNightGlow = true;

    const torso = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1, 0), ice);
    torso.scale.set(1.15, 1.3, 0.95);
    torso.position.y = 3.4;
    torso.castShadow = true;
    this.group.add(torso);
    const belly = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 0), iceDark);
    belly.position.y = 1.6;
    this.group.add(belly);
    this.head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 1.3), ice);
    this.head.position.y = 5.7;
    this.head.castShadow = true;
    this.group.add(this.head);
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.22, 0.12), eyeMat);
      eye.position.set(s * 0.38, 5.75, 0.68);
      this.group.add(eye);
    });
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.2 + (i % 2) * 0.5, 5), ice);
      c.position.set((i - 2) * 0.32, 6.6 + (i % 2) * 0.2, 0);
      c.rotation.z = (i - 2) * 0.16;
      this.group.add(c);
    }
    this.arms = [-1, 1].map(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 2.5, 4.4, 0);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 2.4, 4, 8), ice);
      arm.position.y = -1.3;
      pivot.add(arm);
      const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 0), iceDark);
      fist.position.y = -3.0;
      pivot.add(fist);
      this.group.add(pivot);
      return pivot;
    });
    [-1, 1].forEach(s => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 1.2), iceDark);
      leg.position.set(s * 0.9, 0.8, 0);
      this.group.add(leg);
    });
    // Glowing core in the chest, hidden behind armor until she is stunned
    this.coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.8, 1.0) });
    this.coreMat.userData.noNightGlow = true;
    this.core = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 10), this.coreMat);
    this.core.position.set(0, 3.6, 1.55);
    this.group.add(this.core);
    this.coreHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: createSoftSpriteTexture(), color: 0x99e5ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.4 }));
    this.coreHalo.scale.setScalar(4);
    this.coreHalo.position.copy(this.core.position);
    this.group.add(this.coreHalo);
    // Armor shell
    this.armor = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3.3, 1),
      new THREE.MeshLambertMaterial({ color: 0xcdf0ff, emissive: 0x3a86c8, emissiveIntensity: 0.3, transparent: true, opacity: 0.32, flatShading: true, depthWrite: false })
    );
    this.armor.position.y = 3.6;
    this.group.add(this.armor);
    this.light = new THREE.PointLight(0x9fe0ff, 1.3, 24, 2);
    this.light.position.set(0, 4, 2);
    this.group.add(this.light);
    g.scene.add(this.group);
  }

  buildBanner() {
    const b = document.createElement('div');
    b.id = 'boss3-banner';
    b.className = 'boss-banner boss3-banner';
    b.innerHTML = '<div class="boss-title">❄️ GLACIEL – DER FROSTGOLEM ❄️</div>' +
      '<div class="boss-bar-wrap"><div class="boss-bar-fill boss3-fill" id="boss3-hp-bar"></div></div>' +
      '<div class="boss-subtitle" id="boss3-state-text"></div>';
    (document.getElementById('ui-overlay') || document.body).appendChild(b);
    this.banner = b;
    this.bannerFill = b.querySelector('#boss3-hp-bar');
    this.bannerText = b.querySelector('#boss3-state-text');
  }

  // ---------- Roles ----------
  get puppet() { return this.game.coop.puppetBoss; }
  get myId() { return this.game.coop.active ? this.game.coop.net.id : 0; }
  get armored() { return this.d.cr.some(h => h > 0); }
  get hittable() { return this.d.alive && this.d.awake && this.d.st !== 'sleep' && this.d.st !== 'awaken'; }

  onMorvantaDefeated() {
    this.morvantaDown = true;
    this.game.showToast('❄️ Ein eisiger Wind zieht auf … der Frostgolem Glaciel erwacht!', 6000);
  }

  getTargets() {
    const d = this.d;
    if (!this.morvantaDown || !d.alive) return [];
    const done = this.game.quests && this.game.quests.state.done.glaciel;
    return done ? [] : [{ id: 'glaciel', icon: '❄️', label: 'Glaciel', x: this.center.x, z: this.center.z }];
  }

  candidates() {
    const g = this.game;
    const out = [];
    if (!g.isPlayerInvisible && !g.isDowned) out.push({ id: this.myId, pos: g.playerGroup.position });
    g.remotes.list.forEach(r => {
      if (r.hasState && !r.invisible && !r.downed) out.push({ id: r.id, pos: r.group.position });
    });
    return out;
  }

  nearestCandidate() {
    let best = null;
    let bd = Infinity;
    this.candidates().forEach(c => {
      const dd = Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z);
      if (dd < bd) { bd = dd; best = c; }
    });
    return best;
  }

  // ---------- Hits (host applies, others forward) ----------
  // Returns true if something absorbed the projectile / spell at `pos`
  tryHit(pos, dmg) {
    if (!this.hittable) return false;
    const ci = this.crystalAt(pos, 1.5);
    if (ci >= 0) { this.hit({ crystal: ci, dmg }); return true; }
    if (pos.distanceTo(this.hitPoint) < 3.6) { this.hit({ dmg }); return true; }
    return false;
  }

  areaHit(pos, radius, dmg) {
    if (!this.hittable) return;
    for (let i = 0; i < 3; i++) {
      if (this.d.cr[i] > 0 && pos.distanceTo(this.crystals[i].hitPos) < radius + 1.2) this.hit({ crystal: i, dmg });
    }
    if (pos.distanceTo(this.hitPoint) < radius + 3) this.hit({ dmg });
  }

  crystalAt(pos, reach) {
    for (let i = 0; i < 3; i++) {
      if (this.d.cr[i] > 0 && pos.distanceTo(this.crystals[i].hitPos) < reach) return i;
    }
    return -1;
  }

  hit({ crystal = -1, dmg }) {
    if (this.puppet) {
      this.game.coop.send({ t: 'boss3Hit', dmg, cr: crystal });
      sfx.hit();
      return;
    }
    this.applyHit(dmg, crystal);
  }

  applyHit(dmg, crystal = -1) {
    const d = this.d;
    if (!this.hittable || d.pet > 0) return;
    const g = this.game;
    sfx.hit();
    if (crystal >= 0 && d.cr[crystal] > 0) {
      d.cr[crystal] = Math.max(0, d.cr[crystal] - dmg);
      g.showFloatingText(`-${dmg} 💎`, this.crystals[crystal].hitPos, '#9fe8ff');
      if (d.cr[crystal] <= 0) this.shatterCrystal(crystal);
      return;
    }
    let amount = dmg;
    if (d.st === 'stunned') amount = Math.round(dmg * 1.5);
    else if (this.armored) amount = Math.max(1, Math.round(dmg * 0.1));
    d.hp = Math.max(0, d.hp - amount);
    g.showFloatingText(this.armored ? `Eispanzer! -${amount}` : `-${amount}${d.st === 'stunned' ? ' 💥' : ''}`, this.hitPoint, this.armored ? '#9fe8ff' : '#ffffff');
    if (d.hp <= 0) this.die();
  }

  shatterCrystal(i) {
    const g = this.game;
    const c = this.crystals[i];
    g.fx.burst(c.hitPos.clone(), [new THREE.Color(1.2, 2.2, 3.0), new THREE.Color(2.4, 2.8, 3.0)], 50, { speed: 6, up: 3, size: 0.45, life: 0.9, gravity: 5 });
    g.fx.ringWave(new THREE.Vector3(c.x, c.y, c.z), new THREE.Color(1.0, 2.0, 2.8), 5, 0.6);
    g.playSpatial(c.hitPos, () => sfx.victory());
    if (this.d.cr.every(h => h <= 0) && !this.puppet) this.setState('stunned');
  }

  petrify(dur) {
    if (this.hittable) this.d.pet = Math.min(8, dur);
  }

  // Restoring a saved game: she stays beaten
  restoreDefeated() {
    this.d.alive = false;
    this.d.hp = 0;
    this.d.awake = false;
    this.group.visible = false;
    this.banner.classList.remove('visible');
  }

  die() {
    const d = this.d;
    if (!d.alive) return;
    d.alive = false;
    d.hp = 0;
    this.finishDeath();
  }

  finishDeath() {
    const g = this.game;
    this.d.alive = false;
    this.d.hp = 0;
    this.banner.classList.remove('visible');
    this.group.visible = false;
    this.wave.visible = false;
    g.fx.flash(this.pos.clone().setY(this.pos.y + 3), new THREE.Color(1.6, 2.6, 3.0), 10, 0.8);
    g.fx.ringWave(this.pos.clone(), new THREE.Color(1.2, 2.2, 3.0), 18, 1.3);
    g.fx.burst(this.pos.clone().setY(this.pos.y + 3), [new THREE.Color(1.2, 2.2, 3.0), new THREE.Color(2.6, 2.8, 3.0)], 140, { speed: 11, up: 4, size: 0.5, life: 1.5, gravity: 3 });
    sfx.victory();
    g.showFloatingText('❄️ GLACIEL BESIEGT! ❄️', g.playerGroup.position, '#aee8ff');
    g.progression.addXp(300, 'Glaciel besiegt');
    g.inventory.addCoins(120, 'Glaciel');
    g.quests.mark('glaciel', 'boss', 'Glaciel besiegt');
    if (g.saveGame) g.saveGame.save();
    for (let i = 0; i < 4; i++) g.dropLoot(this.pos.clone(), { dust: 1, heart: 1 });
  }

  // ---------- Frame update ----------
  update(delta) {
    if (this.d.alive) {
      if (this.puppet) this.stepPuppet(delta);
      else {
        this.stepHost(delta);
        if (this.d.awake) ArenaLock.clamp(this.pos, this.center.x, this.center.z, ARENA_RADIUS - 2.5);
      }
      this.localEffects(delta);
    }
    this.applyVisual(delta);
    this.updateBanner();
  }

  setState(st) {
    const d = this.d;
    d.st = st;
    d.timer = 0;
    d.zoneClock = 0;
    d.sl = null;
    this.slamHit = false;
    if (st === 'stunned') {
      this.game.showToast('💥 Der Kern liegt frei! Jetzt mit allem draufhalten!', 4000);
    }
    this.onStateEntered();
  }

  onStateEntered() {
    const st = this.d.st;
    if (st === 'awaken') sfx.bossSpin();
    if (st === 'spikes') sfx.playTone(150, 'sawtooth', 0.5, 0.06);
    if (st === 'snow') sfx.playTone(600, 'triangle', 0.25, 0.05);
    if (st === 'slam') sfx.bossSpin();
    this.setBannerText();
  }

  // ----- Host brain -----
  stepHost(delta) {
    const d = this.d;
    d.timer += delta;
    if (d.pet > 0) {
      d.pet -= delta;
      return;
    }
    const phase2 = d.hp < d.maxHp * 0.5;
    const k = phase2 ? 0.8 : 1;
    d.zones.forEach(z => { z[4] += delta; });
    d.zones = d.zones.filter(z => z[4] < (z[1] === 1 ? LINE_LIFE : SNOW_LIFE));
    if (d.sl) {
      d.sl[2] += delta;
      if (d.sl[2] > 1.2) d.sl = null;
    }

    if (d.st === 'sleep') {
      if (this.morvantaDown) this.setState('awaken');
      return;
    }
    if (d.st === 'awaken') {
      d.awake = true;
      if (d.timer > 3.2) this.setState('idle');
      return;
    }

    const target = this.nearestCandidate();
    const cx = this.center.x;
    const cz = this.center.z;

    if (d.st === 'idle') {
      if (target) this.walkTowards(target.pos.x, target.pos.z, 2.3, delta, 5);
      if (d.timer > 2.4 * k && target) {
        const cycle = ['spikes', 'snow', 'slam'];
        this.setState(cycle[d.attackIdx % cycle.length]);
        d.attackIdx++;
      }
      return;
    }

    if (d.st === 'spikes') {
      if (target) this.faceTo(target.pos.x, target.pos.z);
      d.zoneClock = (d.zoneClock || 0) + delta;
      if (d.timer < 0.3 && d.zones.length === 0) this.addLines(phase2 ? 4 : 2, target);
      if (d.timer > 3.4 * k) this.setState('idle');
      return;
    }

    if (d.st === 'snow') {
      if (target) this.faceTo(target.pos.x, target.pos.z);
      d.zoneClock = (d.zoneClock || 0) + delta;
      if (d.zoneClock >= 0.5 * k && d.timer < 3 * k) {
        d.zoneClock = 0;
        const cands = this.candidates();
        if (cands.length) {
          const c = cands[Math.floor(Math.random() * cands.length)];
          const j = Math.random() < 0.5 ? 0 : 3;
          const a = Math.random() * Math.PI * 2;
          this.addSnow(c.pos.x + Math.cos(a) * j, c.pos.z + Math.sin(a) * j);
        }
      }
      if (d.timer > 4.4 * k) this.setState('idle');
      return;
    }

    if (d.st === 'slam') {
      if (d.timer < 0.9) {
        // crouch: pick the landing point
        if (target) {
          this.slamTo.set(target.pos.x, 0, target.pos.z);
          ArenaLock.clamp(this.slamTo, this.center.x, this.center.z, ARENA_RADIUS - 2.5);
          this.faceTo(target.pos.x, target.pos.z);
        }
        this.slamFrom.copy(this.pos);
      } else if (d.timer < 1.7) {
        const u = (d.timer - 0.9) / 0.8;
        this.pos.x = this.slamFrom.x + (this.slamTo.x - this.slamFrom.x) * u;
        this.pos.z = this.slamFrom.z + (this.slamTo.z - this.slamFrom.z) * u;
        this.pos.y = this.groundAt(this.pos.x, this.pos.z) + Math.sin(u * Math.PI) * 5;
      } else if (!d.sl && d.timer < 1.9) {
        this.pos.y = this.groundAt(this.pos.x, this.pos.z);
        d.sl = [r2(this.pos.x), r2(this.pos.z), 0];
        sfx.hit();
      }
      if (d.timer > 3.2 * k) this.setState('idle');
      return;
    }

    if (d.st === 'stunned') {
      this.pos.y = this.groundAt(this.pos.x, this.pos.z);
      if (d.timer > STUN_SECONDS) {
        d.cr = [CRYSTAL_HP, CRYSTAL_HP, CRYSTAL_HP];
        this.game.showToast('❄️ Die Frostkristalle wachsen nach!', 3000);
        this.setState('idle');
      }
    }
  }

  walkTowards(x, z, speed, delta, minDist) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    this.faceTo(x, z);
    if (dist > minDist) {
      const step = Math.min(dist - minDist, speed * delta);
      let nx = this.pos.x + (dx / dist) * step;
      let nz = this.pos.z + (dz / dist) * step;
      // stay inside the arena
      const ox = nx - this.center.x;
      const oz = nz - this.center.z;
      const od = Math.hypot(ox, oz);
      if (od > ARENA_RADIUS - 3) {
        nx = this.center.x + (ox / od) * (ARENA_RADIUS - 3);
        nz = this.center.z + (oz / od) * (ARENA_RADIUS - 3);
      }
      this.pos.x = nx;
      this.pos.z = nz;
    }
    this.pos.y = this.groundAt(this.pos.x, this.pos.z);
  }

  faceTo(x, z) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.group.rotation.y += wrap(want - this.group.rotation.y) * 0.1;
  }

  addLines(n, target) {
    const d = this.d;
    const base = target ? Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z) : 0;
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? 0 : (i / (n - 1) - 0.5) * (n > 2 ? 1.6 : 0.7);
      const a = base + spread;
      d.zones.push([++d.zid, 1, r2(this.pos.x), r2(this.pos.z), 0, r2(Math.sin(a)), r2(Math.cos(a))]);
    }
  }

  addSnow(x, z) {
    const d = this.d;
    if (d.zones.length >= 8) d.zones.shift();
    d.zones.push([++d.zid, 2, r2(x), r2(z), 0, 0, 0]);
    sfx.playTone(420, 'sine', 0.1, 0.05);
  }

  // ----- Puppet -----
  onNetState(m) {
    this.msg = m;
  }

  stepPuppet(delta) {
    const m = this.msg;
    const d = this.d;
    if (!m) return;
    const changed = m.st !== d.st;
    d.awake = !!m.aw;
    d.hp = m.hp;
    d.pet = m.pet;
    d.cr = Array.isArray(m.cr) ? m.cr.slice(0, 3) : d.cr;
    d.zones = (m.zs || []).map(z => z.slice());
    d.sl = m.sl ? m.sl.slice() : null;
    if (changed) {
      d.st = m.st;
      d.timer = 0;
      this.onStateEntered();
    }
    if (!m.al) { this.finishDeath(); return; }
    const k = 1 - Math.exp(-10 * delta);
    this.pos.x += (m.x - this.pos.x) * k;
    this.pos.y += (m.y - this.pos.y) * k;
    this.pos.z += (m.z - this.pos.z) * k;
    this.group.rotation.y += wrap(m.ry - this.group.rotation.y) * k;
    d.timer += delta;
  }

  netState() {
    const d = this.d;
    return {
      t: 'boss3', x: r2(this.pos.x), y: r2(this.pos.y), z: r2(this.pos.z), ry: r2(wrap(this.group.rotation.y)),
      st: d.st, hp: d.hp, al: d.alive ? 1 : 0, aw: d.awake ? 1 : 0, pet: r2(d.pet), cr: d.cr.slice(),
      zs: d.zones.map(z => z.map(r2)), sl: d.sl ? d.sl.map(r2) : 0
    };
  }

  // ----- Shared client-side gameplay: damage to me -----
  localEffects(delta) {
    const g = this.game;
    const d = this.d;
    const pp = g.playerGroup.position;
    const mine = !g.isDowned;

    d.zones.forEach(z => {
      const kind = z[1];
      const fuse = kind === 1 ? LINE_FUSE : SNOW_FUSE;
      if (z[4] < fuse || this.zoneHits.has(z[0])) return;
      this.zoneHits.add(z[0]);
      let hit = false;
      if (kind === 1) {
        const dx = pp.x - z[2];
        const dz = pp.z - z[3];
        const along = dx * z[5] + dz * z[6];
        const side = Math.abs(-dx * z[6] + dz * z[5]);
        hit = along > 0 && along < LINE_LEN && side < LINE_HALF + 0.4;
        const ex = z[2] + z[5] * 10;
        const ez = z[3] + z[6] * 10;
        g.fx.burst(new THREE.Vector3(ex, this.groundAt(ex, ez) + 0.6, ez), [new THREE.Color(1.2, 2.2, 3.0)], 24, { speed: 3, up: 3, size: 0.4, gravity: 4 });
      } else {
        hit = Math.hypot(pp.x - z[2], pp.z - z[3]) < SNOW_RADIUS;
        const zp = new THREE.Vector3(z[2], this.groundAt(z[2], z[3]), z[3]);
        g.fx.ringWave(zp, new THREE.Color(1.2, 2.2, 3.0), SNOW_RADIUS * 1.3, 0.45);
        g.fx.burst(zp.clone().setY(zp.y + 0.4), [new THREE.Color(2.4, 2.8, 3.0)], 20, { speed: 3, up: 2.5, size: 0.35, gravity: 3 });
      }
      g.playSpatial(new THREE.Vector3(z[2], 0, z[3]), () => sfx.hit());
      if (hit && mine) {
        if (g.damagePlayer(kind === 1 ? LINE_DAMAGE : SNOW_DAMAGE) && !(g.frostWard > 0)) g.slowTimer = SLOW_SECONDS;
      }
    });
    if (this.zoneHits.size > 60) this.zoneHits.clear();

    // Slam shockwave: an expanding ring you can jump over
    if (d.sl) {
      const r = d.sl[2] * 14 / 0.9;
      const dist = Math.hypot(pp.x - d.sl[0], pp.z - d.sl[1]);
      const airborne = pp.y - this.groundAt(pp.x, pp.z) > 0.7;
      if (!this.slamHit && mine && !airborne && Math.abs(dist - r) < 1.2 && r < 15) {
        this.slamHit = true;
        if (g.damagePlayer(SLAM_DAMAGE) && !(g.frostWard > 0)) g.slowTimer = SLOW_SECONDS;
      }
    } else {
      this.slamHit = false;
    }
  }

  // ---------- Presentation ----------
  applyVisual(delta) {
    const d = this.d;
    const g = this.game;
    const t = g.clock.elapsedTime;
    const asleep = !d.awake || d.st === 'sleep';
    this.group.visible = d.alive;
    this.group.position.copy(this.pos);
    this.hitPoint.copy(this.pos).y += 3.6;
    const armored = this.armored;
    this.armor.visible = armored && !asleep;
    this.armor.rotation.y += delta * 0.3;
    this.armor.material.opacity = 0.26 + Math.sin(t * 2) * 0.05;
    const exposed = d.st === 'stunned';
    const cm = exposed ? 2.8 + Math.sin(t * 9) * 0.6 : 0.6;
    this.coreMat.color.setRGB(cm * 0.5, cm * 0.85, cm);
    this.coreHalo.material.opacity = exposed ? 0.8 : 0.25;
    this.light.intensity = asleep ? 0.5 : exposed ? 2.2 : 1.3;

    if (d.alive) {
      // Arms: swing while walking, raise for the slam and spikes, hang when stunned
      let lift = 0.2;
      if (d.st === 'slam') lift = d.timer < 0.9 ? 2.2 : 0.3;
      else if (d.st === 'spikes') lift = 1.4 + Math.sin(t * 6) * 0.2;
      else if (d.st === 'snow') lift = 1.0 + Math.sin(t * 5) * 0.4;
      else if (d.st === 'stunned') lift = -0.1;
      this.arms.forEach((a, i) => { a.rotation.z = (i === 0 ? -1 : 1) * lift * 0.4; a.rotation.x = -lift * (i === 0 ? 0.4 : 0.6); });
      this.group.rotation.z = d.st === 'stunned' ? Math.sin(t * 5) * 0.08 : 0;
      this.head.rotation.x = d.st === 'stunned' ? 0.4 : 0;
    }

    // Crystals and their links to the golem
    this.crystals.forEach((c, i) => {
      const alive = d.cr[i] > 0 && d.awake && d.alive;
      c.group.visible = alive || (!d.awake && d.alive);
      const frac = d.cr[i] / CRYSTAL_HP;
      c.gem.rotation.y += delta * 1.2;
      c.gem.scale.set(0.8, 1.7, 0.8).multiplyScalar(0.7 + frac * 0.3);
      c.glow.material.opacity = 0.4 + Math.sin(t * 3 + i) * 0.15;
      const link = this.crystalLinks[i];
      link.visible = alive && this.armored;
      if (link.visible) {
        const from = c.hitPos;
        const to = new THREE.Vector3(this.pos.x, this.pos.y + 3.6, this.pos.z);
        const dir = new THREE.Vector3().subVectors(to, from);
        const len = dir.length();
        link.position.copy(from).addScaledVector(dir, 0.5);
        link.scale.set(1, len, 1);
        link.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      }
    });

    // Zone markers
    this.zoneMeshes.forEach((mesh, i) => {
      const z = d.zones[i];
      mesh.visible = !!z && d.alive;
      if (!z) return;
      const kind = z[1];
      const fuse = kind === 1 ? LINE_FUSE : SNOW_FUSE;
      const age = z[4];
      const y = this.groundAt(z[2], z[3]) + 0.12;
      if (kind === 1) {
        mesh.geometry = this.planeGeo;
        const angle = Math.atan2(z[5], z[6]);
        mesh.position.set(z[2] + z[5] * LINE_LEN / 2, y, z[3] + z[6] * LINE_LEN / 2);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(-Math.PI / 2, angle + Math.PI, 0);
        mesh.scale.set(LINE_HALF * 2, LINE_LEN, 1);
      } else {
        mesh.geometry = this.circleGeo;
        mesh.position.set(z[2], y, z[3]);
        mesh.rotation.order = 'YXZ';
        mesh.rotation.set(-Math.PI / 2, 0, 0);
        mesh.scale.set(SNOW_RADIUS, SNOW_RADIUS, 1);
      }
      const f = Math.min(1, age / fuse);
      mesh.material.opacity = age < fuse ? 0.15 + f * 0.35 + Math.sin(age * 22) * 0.05 * f : Math.max(0, 0.75 - (age - fuse) * 1.6);
      if (age >= fuse && kind === 2) mesh.scale.multiplyScalar(1 + (age - fuse) * 0.3);
    });

    // Slam shockwave ring
    if (d.sl && d.alive) {
      const r = Math.max(0.2, d.sl[2] * 14 / 0.9);
      this.wave.visible = true;
      this.wave.position.set(d.sl[0], this.groundAt(d.sl[0], d.sl[1]) + 0.2, d.sl[1]);
      this.wave.scale.setScalar(r);
      this.wave.material.opacity = Math.max(0, 0.9 - d.sl[2] * 0.7);
    } else {
      this.wave.visible = false;
    }
  }

  setBannerText() {
    const texts = {
      sleep: 'Eine Eisstatue steht reglos da …',
      awaken: '❄️ Das Eis bricht auf!',
      idle: 'Zerschlagt die 3 Frostkristalle, dann liegt ihr Kern frei!',
      spikes: '🧊 EISDORNEN! Tretet aus den Linien!',
      snow: '⛄ SCHNEEHAGEL! Weicht den Kreisen aus!',
      slam: '💥 SPRUNGANGRIFF! Über die Welle springen!',
      stunned: '💥 KERN FREI! Doppelt Schaden!'
    };
    this.bannerText.textContent = texts[this.d.st] || '';
  }

  updateBanner() {
    const g = this.game;
    const d = this.d;
    const near = d.alive && d.awake && this.pos.distanceTo(g.playerGroup.position) < 34;
    this.banner.classList.toggle('visible', near);
    if (d.pet > 0) this.bannerText.textContent = `🪨 VERSTEINERT! (${d.pet.toFixed(1)}s)`;
    else if (this.bannerShownPet) this.setBannerText();
    this.bannerShownPet = d.pet > 0;
    this.bannerFill.style.width = `${(d.hp / d.maxHp) * 100}%`;
    const others = ['boss-banner', 'boss2-banner'].map(id => document.getElementById(id));
    this.banner.classList.toggle('below', others.some(b => b && b.classList.contains('visible')));
  }
}
