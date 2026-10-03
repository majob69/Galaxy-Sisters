// ==========================================
// BOSS: MORVANTA, the skull butterfly. She sleeps in a cocoon on a rune clearing in the enchanted
// forest (third world) and wakes up when a sister steps into her arena.
// Attacks:  Schuppenstaub (marked zones burst after a moment), Sturzflug (dive at a sister)
//           and the antenna GRAB: she lifts one sister into the air - friends strike her
//           (or the captive struggles with the jump button) to set her free.
// A freed captive stuns Morvanta (dizzy = double damage). Host-authoritative in co-op, like Vortox.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { ArenaLock } from './arenas.js';
import { FOREST_ARENA, inForestArea } from './forest.js';

const MAX_HP = 320;
const HOVER_H = 3.6;
const DUST_H = 6.5;
const ZONE_RADIUS = 3.3;
const ZONE_FUSE = 1.6;
const ZONE_LIFE = 2.15;
const ZONE_DAMAGE = 14;
const SWOOP_DAMAGE = 18;
const GRAB_DOT = 3;           // HP per second while lifted
const GRAB_TIME = 10;         // she gives up after this many seconds
const FREE_NEEDED = 5;        // strikes / struggles to break free
const MASH_PER_FREE = 3;      // jump presses for one struggle
const ARENA_RADIUS = FOREST_ARENA.r;
const WAKE_RADIUS = ARENA_RADIUS - 1;

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

function wingTexture(kind) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.beginPath();
  ctx.moveTo(8, 150);
  if (kind === 'fore') {
    ctx.bezierCurveTo(20, 40, 150, 0, 248, 26);
    ctx.bezierCurveTo(256, 110, 170, 176, 8, 150);
  } else {
    ctx.bezierCurveTo(30, 170, 120, 170, 214, 236);
    ctx.bezierCurveTo(150, 250, 40, 230, 8, 150);
  }
  ctx.closePath();
  const grad = ctx.createRadialGradient(20, 150, 10, 150, 130, 190);
  grad.addColorStop(0, '#6a2bb0');
  grad.addColorStop(0.55, '#3b1670');
  grad.addColorStop(1, '#12061f');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ff5fd2';
  ctx.stroke();
  // veins
  ctx.strokeStyle = 'rgba(255, 140, 230, 0.45)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(14, 150);
    ctx.quadraticCurveTo(90, 110 + i * 14 - (kind === 'fore' ? 60 : -10), 200 + i * 8, kind === 'fore' ? 40 + i * 24 : 190 + i * 8);
    ctx.stroke();
  }
  // glowing eye spots
  const spot = (x, y, r) => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#ff7ee3');
    g.addColorStop(1, 'rgba(120, 30, 160, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  };
  if (kind === 'fore') { spot(170, 70, 26); spot(120, 110, 16); spot(205, 105, 14); } else { spot(140, 190, 22); spot(80, 170, 13); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function runeTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d');
  ctx.translate(128, 128);
  ctx.strokeStyle = 'rgba(200, 120, 255, 0.85)';
  ctx.lineWidth = 3;
  [120, 100, 70].forEach(r => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); });
  ctx.beginPath();
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    ctx.moveTo(Math.cos(a) * 70, Math.sin(a) * 70);
    ctx.lineTo(Math.cos(a) * 120, Math.sin(a) * 120);
  }
  ctx.stroke();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 60 : 26;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Morvanta {
  constructor(game) {
    this.game = game;
    this.center = this.findSpot();
    this.d = {
      st: 'sleep', hp: MAX_HP, maxHp: MAX_HP, alive: true, awake: false,
      timer: 0, pet: 0, cp: -1, fc: 0, zones: [], zid: 0, attackIdx: 0, orbit: Math.random() * 6
    };
    this.msg = null;
    this.mash = 0;
    this.swoopTarget = new THREE.Vector3();
    this.swoopHit = false;
    this.zoneHits = new Set();
    this.grabbedSelf = false;
    this.pos = new THREE.Vector3(this.center.x, this.groundAt(this.center.x, this.center.z) + 4.2, this.center.z);
    this.buildArena();
    this.buildModel();
    this.buildBanner();
    this.applyVisual(0);
  }

  groundAt(x, z) {
    return this.game.getTerrainHeight(x, z);
  }

  // Her rune clearing in the enchanted forest (kept free of trees, see forest.js)
  findSpot() {
    return { x: FOREST_ARENA.x, z: FOREST_ARENA.z };
  }

  // The forest portal is open (every other quest is done)
  get ready() {
    return !!(this.game.forest && this.game.forest.unlocked);
  }

  // ---------- Scene ----------
  buildArena() {
    const g = this.game;
    const { x: cx, z: cz } = this.center;
    const by = this.groundAt(cx, cz);
    this.arena = new THREE.Group();
    const runeMat = new THREE.MeshBasicMaterial({ map: runeTexture(), transparent: true, depthWrite: false, color: new THREE.Color(1.4, 0.8, 2.0), opacity: 0.9 });
    runeMat.userData.noNightGlow = true;
    const rune = new THREE.Mesh(new THREE.CircleGeometry(ARENA_RADIUS - 1.5, 48), runeMat);
    rune.rotation.x = -Math.PI / 2;
    rune.position.set(cx, by + 0.08, cz);
    this.arena.add(rune);
    this.runeMat = runeMat;

    // a second, outer rune ring that turns the other way
    const outerMat = runeMat.clone();
    outerMat.color = new THREE.Color(0.8, 1.2, 2.4);
    const outer = new THREE.Mesh(new THREE.RingGeometry(ARENA_RADIUS - 1.2, ARENA_RADIUS + 0.6, 64), outerMat);
    outer.rotation.x = -Math.PI / 2;
    outer.position.set(cx, by + 0.06, cz);
    this.arena.add(outer);
    this.outerRune = outer;

    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x3c2a58, flatShading: true });
    const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.6, 2.4) });
    orbMat.userData.noNightGlow = true;
    const archMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.2, 0.5, 2.0), transparent: true, opacity: 0.55, depthWrite: false });
    archMat.userData.noNightGlow = true;
    const PILLARS = 14;
    const tops = [];
    for (let i = 0; i < PILLARS; i++) {
      const ang = (i / PILLARS) * Math.PI * 2;
      const px = cx + Math.cos(ang) * ARENA_RADIUS;
      const pz = cz + Math.sin(ang) * ARENA_RADIUS;
      const py = g.getTerrainHeight(px, pz);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.85, 6.5, 7), pillarMat);
      pillar.position.set(px, py + 3, pz);
      pillar.castShadow = true;
      this.arena.add(pillar);
      const orb = new THREE.Mesh(new THREE.OctahedronGeometry(0.5, 0), orbMat);
      orb.position.set(px, py + 7, pz);
      this.arena.add(orb);
      tops.push(new THREE.Vector3(px, py + 6.4, pz));
      g.colliders.push({ type: 'cylinder', x: px, z: pz, radius: 0.85, minY: py - 1, maxY: py + 7 });
    }
    // glowing arches of magic between neighbouring pillars
    for (let i = 0; i < PILLARS; i++) {
      const a = tops[i];
      const b = tops[(i + 1) % PILLARS];
      const mid = a.clone().lerp(b, 0.5);
      mid.y += 1.6;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      this.arena.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.07, 5, false), archMat));
    }
    // floating crystals that circle above the clearing
    const crystalMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.9, 2.6) });
    crystalMat.userData.noNightGlow = true;
    this.crystals = [];
    for (let i = 0; i < 10; i++) {
      const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 + (i % 3) * 0.15, 0), crystalMat);
      c.scale.y = 1.8;
      c.userData = { a: (i / 10) * Math.PI * 2, r: ARENA_RADIUS * (0.55 + (i % 2) * 0.25), h: 7 + (i % 3) * 1.3 };
      this.arena.add(c);
      this.crystals.push(c);
    }
    // sparkles drifting up from the runes
    const SPARKS = 140;
    this.sparkBase = [];
    for (let i = 0; i < SPARKS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(Math.random()) * ARENA_RADIUS;
      this.sparkBase.push({ x: cx + Math.cos(a) * r, z: cz + Math.sin(a) * r, y: by, ph: Math.random() * 8, sp: 0.5 + Math.random() });
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARKS * 3), 3));
    this.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: new THREE.Color(1.8, 1.0, 2.6), size: 0.18, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.sparks.frustumCulled = false;
    this.arena.add(this.sparks);
    this.arenaLight = new THREE.PointLight(0xc58bff, 1.2, ARENA_RADIUS * 2.2, 2);
    this.arenaLight.position.set(cx, by + 9, cz);
    this.arena.add(this.arenaLight);
    g.scene.add(this.arena);

    // Telegraph zones for Schuppenstaub (pooled)
    this.zoneMeshes = [];
    const zoneMat = () => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 0.4, 2.2), transparent: true, opacity: 0.4, depthWrite: false });
      m.userData.noNightGlow = true;
      return m;
    };
    for (let i = 0; i < 9; i++) {
      const disc = new THREE.Mesh(new THREE.CircleGeometry(ZONE_RADIUS, 32), zoneMat());
      disc.rotation.x = -Math.PI / 2;
      disc.visible = false;
      g.scene.add(disc);
      this.zoneMeshes.push(disc);
    }
  }

  buildModel() {
    const g = this.game;
    this.group = new THREE.Group();
    const bone = new THREE.MeshLambertMaterial({ color: 0xf1e8d6, flatShading: true });
    const boneDark = new THREE.MeshLambertMaterial({ color: 0xd9ccb3, flatShading: true });
    const fur = new THREE.MeshLambertMaterial({ color: 0x2b1740, flatShading: true });
    const dark = new THREE.MeshBasicMaterial({ color: 0x0b0512 });
    const glow = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.6, 2.6) });
    glow.userData.noNightGlow = true;

    // Body
    const thorax = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 1.9, 6, 12), fur);
    thorax.rotation.x = Math.PI / 2;
    thorax.position.set(0, 0.6, 0);
    thorax.castShadow = true;
    this.group.add(thorax);
    const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.7, 2.6, 6, 12), fur);
    abdomen.rotation.x = Math.PI / 2;
    abdomen.position.set(0, 0.3, -2.6);
    abdomen.scale.set(1, 1, 1);
    this.group.add(abdomen);
    for (let i = 0; i < 5; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72 - i * 0.03, 0.06, 6, 16), boneDark);
      ring.position.set(0, 0.3, -1.6 - i * 0.55);
      this.group.add(ring);
    }

    // Skull head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.85, 1.9);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1.25, 18, 14), bone);
    skull.scale.set(1, 1.05, 1.08);
    skull.castShadow = true;
    this.head.add(skull);
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 0.95), boneDark);
    jaw.position.set(0, -1.05, 0.3);
    this.head.add(jaw);
    for (let i = -3; i <= 3; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.28, 0.12), bone);
      tooth.position.set(i * 0.17, -0.8, 0.78);
      this.head.add(tooth);
    }
    [-1, 1].forEach(side => {
      const socket = new THREE.Mesh(new THREE.SphereGeometry(0.44, 12, 10), dark);
      socket.scale.set(1, 1.2, 0.6);
      socket.position.set(side * 0.5, 0.12, 1.02);
      this.head.add(socket);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), glow);
      eye.position.set(side * 0.5, 0.1, 1.2);
      this.head.add(eye);
    });
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.36, 3), dark);
    nose.rotation.x = Math.PI;
    nose.position.set(0, -0.4, 1.28);
    this.head.add(nose);
    this.group.add(this.head);

    // Antennae
    this.antennae = [-1, 1].map(side => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.4, 2.0, 0.2);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(side * 0.4, 1.4, 0.5),
        new THREE.Vector3(side * 1.1, 2.6, 1.3),
        new THREE.Vector3(side * 2.0, 3.1, 2.6)
      ]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.075, 6, false), fur);
      pivot.add(tube);
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), glow);
      tip.position.copy(curve.getPoint(1));
      pivot.add(tip);
      this.head.add(pivot);
      pivot.userData.tip = tip;
      return pivot;
    });

    // Wings
    const foreTex = wingTexture('fore');
    const hindTex = wingTexture('hind');
    const makeWing = (tex, size, side, pos) => {
      const geo = new THREE.PlaneGeometry(size, size);
      geo.translate(size / 2 - 0.03 * size, 0.09 * size, 0);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, color: new THREE.Color(1.15, 1.0, 1.4) });
      mat.userData.noNightGlow = true;
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = Math.PI / 2;
      if (side < 0) mesh.scale.x = -1;
      const pivot = new THREE.Group();
      pivot.position.copy(pos);
      pivot.add(mesh);
      pivot.userData.side = side;
      this.group.add(pivot);
      return pivot;
    };
    this.wings = [];
    [-1, 1].forEach(side => {
      this.wings.push(makeWing(foreTex, 8.2, side, new THREE.Vector3(side * 0.7, 1.15, 0.6)));
      this.wings.push(makeWing(hindTex, 6.2, side, new THREE.Vector3(side * 0.7, 0.85, -0.9)));
    });

    // Legs
    for (let i = 0; i < 3; i++) {
      [-1, 1].forEach(side => {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 1.4, 5), boneDark);
        leg.position.set(side * 0.7, -0.2, 0.7 - i * 0.7);
        leg.rotation.z = side * 0.7;
        this.group.add(leg);
      });
    }

    // Tendril used for the grab
    this.tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1, 6), glow);
    this.tendril.visible = false;
    g.scene.add(this.tendril);

    this.light = new THREE.PointLight(0xb46bff, 1.4, 26, 2);
    this.light.position.set(0, 2, 0);
    this.group.add(this.light);

    // Cocoon shown while she sleeps
    this.cocoon = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(1.7, 14, 12), new THREE.MeshLambertMaterial({ color: 0x5b4a78, flatShading: true }));
    shell.scale.set(1, 1.7, 1);
    shell.castShadow = true;
    this.cocoon.add(shell);
    const veinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.5, 2.2) });
    veinMat.userData.noNightGlow = true;
    for (let i = 0; i < 4; i++) {
      const vein = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 5, 24), veinMat);
      vein.scale.set(1, 1.7, 1);
      vein.rotation.y = (i * Math.PI) / 4;
      this.cocoon.add(vein);
    }
    this.cocoonLight = new THREE.PointLight(0xb46bff, 1.0, 16, 2);
    this.cocoon.add(this.cocoonLight);
    g.scene.add(this.cocoon);

    g.scene.add(this.group);
    this.hitPoint = new THREE.Vector3();
  }

  buildBanner() {
    const b = document.createElement('div');
    b.id = 'boss2-banner';
    b.className = 'boss-banner boss2-banner';
    b.innerHTML = '<div class="boss-title">🦋 MORVANTA – DER TOTENKOPF-FALTER 🦋</div>' +
      '<div class="boss-bar-wrap"><div class="boss-bar-fill boss2-fill" id="boss2-hp-bar"></div></div>' +
      '<div class="boss-subtitle" id="boss2-state-text"></div>';
    (document.getElementById('ui-overlay') || document.body).appendChild(b);
    this.banner = b;
    this.bannerFill = b.querySelector('#boss2-hp-bar');
    this.bannerText = b.querySelector('#boss2-state-text');
  }

  // ---------- Roles ----------
  get puppet() { return this.game.coop.puppetBoss; }
  get myId() { return this.game.coop.active ? this.game.coop.net.id : 0; }
  get hittable() { return this.d.alive && this.d.awake && this.d.st !== 'awaken' && this.d.st !== 'sleep'; }

  getTargets() {
    const d = this.d;
    if (!this.ready || !d.alive) return [];
    const done = this.game.quests && this.game.quests.state.done.morvanta;
    return done ? [] : [{ id: 'morvanta', icon: '🦋', label: 'Morvanta', x: this.center.x, z: this.center.z }];
  }

  // ---------- Candidates the boss may attack (only sisters at her clearing) ----------
  candidates(range = ARENA_RADIUS + 10) {
    const g = this.game;
    const out = [];
    const close = (p) => inForestArea(p.x) && Math.hypot(p.x - this.center.x, p.z - this.center.z) < range;
    if (!g.isPlayerInvisible && !g.isDowned && close(g.playerGroup.position)) out.push({ id: this.myId, pos: g.playerGroup.position });
    g.remotes.list.forEach(r => {
      if (r.hasState && !r.invisible && !r.downed && close(r.group.position)) out.push({ id: r.id, pos: r.group.position });
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

  // ---------- Incoming hits (host applies; others forward) ----------
  hit(dmg) {
    if (!this.hittable) return;
    if (this.puppet) {
      this.game.coop.send({ t: 'boss2Hit', dmg });
      sfx.hit();
      return;
    }
    this.applyHit(dmg);
  }

  applyHit(dmg) {
    const d = this.d;
    if (!this.hittable || d.pet > 0) return;
    let amount = dmg;
    if (d.st === 'dizzy') amount = Math.round(dmg * 1.6);
    if (d.st === 'grab' && d.cp >= 0) {
      // Strikes on her antenna loosen the grip
      d.fc += 1;
      amount = Math.round(dmg * 0.5);
      this.game.showFloatingText(`💥 Griff lockert sich (${Math.min(d.fc, FREE_NEEDED)}/${FREE_NEEDED})`, this.pos, '#ffe066');
    }
    d.hp = Math.max(0, d.hp - amount);
    sfx.hit();
    this.game.showFloatingText(`-${amount}${d.st === 'dizzy' ? ' 💫' : ''}`, this.pos, '#ff8ad8');
    if (d.hp <= 0) this.die();
  }

  applyFree(n) {
    const d = this.d;
    if (d.st === 'grab' && d.cp >= 0) d.fc += n;
  }

  petrify(dur) {
    if (this.hittable) this.d.pet = Math.min(8, dur);
  }

  // Captive: every jump press struggles a little
  onJumpWhileGrabbed() {
    this.mash++;
    if (this.mash >= MASH_PER_FREE) {
      this.mash = 0;
      this.game.playSpatial(this.game.playerGroup.position, () => sfx.playTone(520, 'triangle', 0.08, 0.08));
      if (this.puppet) this.game.coop.send({ t: 'boss2Free', n: 1 });
      else this.applyFree(1);
    }
  }

  die() {
    const d = this.d;
    if (!d.alive) return;
    d.alive = false;
    d.hp = 0;
    d.cp = -1;
    this.finishDeath();
  }

  // Restoring a saved game: she stays beaten
  restoreDefeated() {
    this.d.alive = false;
    this.d.hp = 0;
    this.d.awake = false;
    this.group.visible = false;
    this.cocoon.visible = false;
    this.banner.classList.remove('visible');
  }

  // Runs on every client when she falls
  finishDeath() {
    const g = this.game;
    this.d.alive = false;
    this.d.hp = 0;
    this.releaseSelf(false);
    this.banner.classList.remove('visible');
    this.group.visible = false;
    this.tendril.visible = false;
    g.fx.flash(this.pos.clone(), new THREE.Color(2.6, 1.0, 2.8), 9, 0.7);
    g.fx.ringWave(this.pos.clone().setY(this.groundAt(this.pos.x, this.pos.z)), new THREE.Color(2.0, 0.8, 2.4), 16, 1.2);
    g.fx.burst(this.pos.clone(), [new THREE.Color(2.6, 0.8, 2.8), new THREE.Color(2.4, 2.0, 2.6)], 120, { speed: 10, up: 4, size: 0.5, life: 1.4, gravity: 3 });
    sfx.victory();
    g.showFloatingText('🦋 MORVANTA BESIEGT! 🦋', g.playerGroup.position, '#ff9ee6');
    g.progression.addXp(200, 'Morvanta besiegt');
    g.inventory.addCoins(120, 'Morvanta');
    if (g.saveGame) g.saveGame.save();
    g.quests.mark('morvanta', 'boss', 'Morvanta besiegt');
    for (let i = 0; i < 3; i++) g.dropLoot(this.pos.clone().setY(this.groundAt(this.pos.x, this.pos.z)), { dust: 1, heart: 1 });
  }

  // ---------- Frame update ----------
  update(delta) {
    const d = this.d;
    const g = this.game;

    if (d.alive) {
      if (this.puppet) this.stepPuppet(delta);
      else {
        this.stepHost(delta);
        if (d.awake) ArenaLock.clamp(this.pos, this.center.x, this.center.z, ARENA_RADIUS - 2);
      }
      this.localEffects(delta);
    }
    this.applyVisual(delta);
    this.updateBanner();
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
    const speed = phase2 ? 0.75 : 1;
    const g = this.game;
    const groundHere = this.groundAt(this.pos.x, this.pos.z);

    // zones age
    d.zones.forEach(z => { z[3] += delta; });
    d.zones = d.zones.filter(z => z[3] < ZONE_LIFE);

    if (d.st === 'sleep') {
      this.pos.set(this.center.x, this.groundAt(this.center.x, this.center.z) + 4.2, this.center.z);
      // she wakes when a sister steps onto her rune clearing
      if (this.ready && this.candidates(WAKE_RADIUS).length) {
        this.setState('awaken');
        g.showToast('🦋 Der Kokon bricht auf … Morvanta erwacht!', 5000);
      }
      return;
    }
    if (d.st === 'awaken') {
      d.awake = true;
      if (d.timer > 3.2) this.setState('hover');
      return;
    }

    const target = this.nearestCandidate();

    if (d.st === 'hover') {
      d.orbit += delta * 0.7;
      const focus = target ? target.pos : new THREE.Vector3(this.center.x, 0, this.center.z);
      const wantX = focus.x + Math.cos(d.orbit) * 9;
      const wantZ = focus.z + Math.sin(d.orbit) * 9;
      this.moveTowards(wantX, wantZ, this.groundAt(wantX, wantZ) + HOVER_H + Math.sin(d.timer * 2) * 0.4, 6.5, delta);
      this.faceTo(focus.x, focus.z);
      if (d.timer > 4.5 * speed && target) {
        const attacks = ['dust', 'swoop', 'grab'];
        this.setState(attacks[d.attackIdx % attacks.length]);
        d.attackIdx++;
      }
      return;
    }

    if (d.st === 'dust') {
      this.moveTowards(this.center.x, this.center.z, this.groundAt(this.center.x, this.center.z) + DUST_H, 7, delta);
      // Drop marked zones on the sisters (and a few around them)
      const spawnEvery = 0.55 * speed;
      d.zoneClock = (d.zoneClock || 0) + delta;
      if (d.zoneClock >= spawnEvery && d.timer < 3.6 * speed) {
        d.zoneClock = 0;
        const cands = this.candidates();
        if (cands.length) {
          const c = cands[Math.floor(Math.random() * cands.length)];
          const jitter = Math.random() < 0.5 ? 0 : 3.5;
          const ang = Math.random() * Math.PI * 2;
          this.addZone(c.pos.x + Math.cos(ang) * jitter, c.pos.z + Math.sin(ang) * jitter);
        }
      }
      if (d.timer > 5 * speed) this.setState('hover');
      return;
    }

    if (d.st === 'swoop') {
      if (d.timer < 0.9) {
        // wind-up: rise and lock the target
        if (target) this.swoopTarget.copy(target.pos);
        this.moveTowards(this.pos.x, this.pos.z, this.groundAt(this.pos.x, this.pos.z) + 6.5, 6, delta);
        this.faceTo(this.swoopTarget.x, this.swoopTarget.z);
      } else if (d.timer < 2.3) {
        const dx = this.swoopTarget.x - this.pos.x;
        const dz = this.swoopTarget.z - this.pos.z;
        const dist = Math.hypot(dx, dz);
        const step = Math.min(dist, 17 * delta);
        if (dist > 0.3) {
          this.pos.x += (dx / dist) * step;
          this.pos.z += (dz / dist) * step;
        }
        const wantY = this.groundAt(this.pos.x, this.pos.z) + 1.7;
        this.pos.y += (wantY - this.pos.y) * Math.min(1, delta * 6);
      } else {
        this.setState('hover');
      }
      return;
    }

    if (d.st === 'grab') {
      if (d.cp < 0) {
        // Chase a sister and snatch her
        const c = target;
        if (!c || d.timer > 5) { this.setState('hover'); return; }
        this.moveTowards(c.pos.x, c.pos.z, this.groundAt(c.pos.x, c.pos.z) + 3.4, 11, delta);
        this.faceTo(c.pos.x, c.pos.z);
        if (Math.hypot(c.pos.x - this.pos.x, c.pos.z - this.pos.z) < 2.6) {
          d.cp = c.id;
          d.fc = 0;
          d.grabTimer = 0;
          g.showToast('🦋 Morvanta hat eine Schwester gepackt! Schlagt auf sie ein!', 4500);
        }
      } else {
        d.grabTimer += delta;
        const wantY = groundHere + 7;
        this.moveTowards(this.pos.x, this.pos.z, wantY, 4, delta);
        if (d.fc >= FREE_NEEDED) {
          g.showToast('💥 Die Gefangene ist frei! Morvanta ist benommen – jetzt zuschlagen!', 4500);
          d.cp = -1;
          this.setState('dizzy');
        } else if (d.grabTimer > GRAB_TIME) {
          d.cp = -1;
          this.setState('hover');
        }
      }
      return;
    }

    if (d.st === 'dizzy') {
      const wantY = groundHere + 1.4;
      this.moveTowards(this.pos.x, this.pos.z, wantY, 5, delta);
      if (d.timer > 5.2) this.setState('hover');
    }
  }

  setState(st) {
    const d = this.d;
    d.st = st;
    d.timer = 0;
    d.zoneClock = 0;
    if (st !== 'grab') d.cp = -1;
    if (st === 'swoop') this.swoopHit = false;
    this.onStateEntered();
  }

  moveTowards(x, z, y, speed, delta) {
    const dx = x - this.pos.x;
    const dz = z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 0.05) {
      const step = Math.min(dist, speed * delta);
      this.pos.x += (dx / dist) * step;
      this.pos.z += (dz / dist) * step;
    }
    this.pos.y += (y - this.pos.y) * Math.min(1, delta * 3);
  }

  faceTo(x, z) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.group.rotation.y += wrap(want - this.group.rotation.y) * 0.08;
  }

  addZone(x, z) {
    const d = this.d;
    if (d.zones.length >= 8) d.zones.shift();
    d.zones.push([++d.zid, Math.round(x * 10) / 10, Math.round(z * 10) / 10, 0]);
    sfx.playTone(300, 'sine', 0.1, 0.05);
  }

  // ----- Puppet: follow the host's messages -----
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
    d.cp = m.cp;
    d.fc = m.fc;
    d.zones = (m.zs || []).map(z => [z[0], z[1], z[2], z[3]]);
    if (changed) {
      d.st = m.st;
      d.timer = 0;
      this.onStateEntered();
    }
    if (!m.al) {
      this.finishDeath();
      return;
    }
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
      t: 'boss2', x: r2(this.pos.x), y: r2(this.pos.y), z: r2(this.pos.z), ry: r2(wrap(this.group.rotation.y)),
      st: d.st, hp: d.hp, al: d.alive ? 1 : 0, aw: d.awake ? 1 : 0, pet: r2(d.pet), cp: d.cp, fc: d.fc,
      zs: d.zones.map(z => [z[0], z[1], z[2], r2(z[3])])
    };
  }

  // ----- Shared client-side gameplay: damage to me, being carried -----
  onStateEntered() {
    const st = this.d.st;
    if (st === 'awaken') sfx.bossSpin();
    if (st === 'dust') sfx.playTone(180, 'sawtooth', 0.4, 0.05);
    if (st === 'swoop') {
      this.swoopHit = false;
      sfx.bossSpin();
    }
    if (st === 'grab') sfx.playTone(240, 'triangle', 0.3, 0.06);
    if (st === 'dizzy') this.game.showFloatingText('💫 Morvanta ist benommen!', this.pos, '#ffdf6b');
    this.setBannerText();
  }

  localEffects(delta) {
    const g = this.game;
    const d = this.d;
    const pp = g.playerGroup.position;
    const mine = !g.isDowned;

    // Marked zones burst once
    d.zones.forEach(z => {
      if (z[3] >= ZONE_FUSE && !this.zoneHits.has(z[0])) {
        this.zoneHits.add(z[0]);
        const zp = new THREE.Vector3(z[1], this.groundAt(z[1], z[2]), z[2]);
        g.fx.ringWave(zp, new THREE.Color(1.8, 0.6, 2.4), ZONE_RADIUS * 1.2, 0.5);
        g.fx.burst(zp.clone().setY(zp.y + 0.5), [new THREE.Color(2.2, 0.7, 2.6)], 26, { speed: 4, up: 3, size: 0.4, gravity: 3 });
        g.playSpatial(zp, () => sfx.hit());
        if (mine && Math.hypot(pp.x - z[1], pp.z - z[2]) < ZONE_RADIUS && pp.y - zp.y < 2.2) g.damagePlayer(ZONE_DAMAGE);
      }
    });
    if (this.zoneHits.size > 60) this.zoneHits.clear();

    // Dive attack
    if (d.st === 'swoop' && d.timer > 0.9 && !this.swoopHit && mine) {
      if (Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z) < 3.4 && Math.abs(pp.y + 1 - this.pos.y) < 3.2) {
        this.swoopHit = true;
        g.damagePlayer(SWOOP_DAMAGE);
      }
    }

    // Being carried
    const grabbedNow = d.st === 'grab' && d.cp === this.myId && d.cp >= 0 && mine;
    if (grabbedNow) {
      if (!this.grabbedSelf) {
        this.grabbedSelf = true;
        g.isGrabbed = true;
        this.mash = 0;
        g.joystickDelta.x = 0;
        g.joystickDelta.y = 0;
        g.showToast('🕸️ Gepackt! Drück Springen so schnell du kannst – und Freunde: schlagt auf sie ein!', 5000);
      }
      const hover = this.pos;
      pp.set(hover.x, hover.y - 2.6, hover.z);
      g.playerVelY = 0;
      d.dotClock = (d.dotClock || 0) + delta;
      if (d.dotClock >= 1) {
        d.dotClock = 0;
        g.damagePlayer(GRAB_DOT);
      }
    } else if (this.grabbedSelf) {
      this.releaseSelf(true);
    }
  }

  releaseSelf(dropped) {
    const g = this.game;
    this.grabbedSelf = false;
    g.isGrabbed = false;
    if (dropped) g.showFloatingText('Frei!', g.playerGroup.position, '#9ff3ff');
  }

  // ---------- Presentation ----------
  applyVisual(delta) {
    const d = this.d;
    const t = this.game.clock.elapsedTime;
    const asleep = !d.awake || d.st === 'sleep';
    this.cocoon.visible = d.alive && (asleep || d.st === 'awaken');
    this.group.visible = d.alive && !asleep;
    this.cocoonLight.intensity = 0.7 + Math.sin(t * 3) * 0.3;
    this.cocoon.position.set(this.center.x, this.groundAt(this.center.x, this.center.z) + 4.2 + Math.sin(t * 1.2) * 0.15, this.center.z);
    this.cocoon.rotation.y += delta * 0.4;
    this.runeMat.opacity = 0.55 + Math.sin(t * 1.5) * 0.15;
    // the clearing (and everything on it) is only drawn while you are in the forest
    const here = inForestArea(this.game.camera.position.x);
    this.arena.visible = here;
    if (!here) {
      this.cocoon.visible = false;
      this.group.visible = false;
    } else {
      this.outerRune.rotation.z -= delta * 0.12;
      const floorY = this.groundAt(this.center.x, this.center.z);
      this.crystals.forEach((c, i) => {
        const u = c.userData;
        const a = u.a + t * (i % 2 ? 0.18 : -0.12);
        c.position.set(this.center.x + Math.cos(a) * u.r, floorY + u.h + Math.sin(t * 1.4 + i) * 0.5, this.center.z + Math.sin(a) * u.r);
        c.rotation.y += delta * 1.2;
      });
      const arr = this.sparks.geometry.attributes.position.array;
      this.sparkBase.forEach((p, i) => {
        const k = (t * p.sp * 0.25 + p.ph) % 1;
        arr[i * 3] = p.x + Math.sin(t + p.ph) * 0.3;
        arr[i * 3 + 1] = p.y + k * 7;
        arr[i * 3 + 2] = p.z + Math.cos(t + p.ph) * 0.3;
      });
      this.sparks.geometry.attributes.position.needsUpdate = true;
      this.arenaLight.intensity = (d.awake && d.alive ? 2.2 : 1.0) + Math.sin(t * 2) * 0.3;
    }

    this.group.position.copy(this.pos);
    if (d.alive && d.awake) {
      const flapRate = d.st === 'dizzy' || d.pet > 0 ? 1.5 : d.st === 'swoop' ? 14 : d.st === 'dust' ? 7 : 9;
      const droop = d.st === 'dizzy' ? 0.7 : 0;
      this.wings.forEach((w, i) => {
        const side = w.userData.side;
        const flap = d.pet > 0 ? 0.1 : Math.sin(t * flapRate + (i > 1 ? 0.4 : 0)) * 0.6;
        w.rotation.z = side * (0.25 - droop + flap);
      });
      this.antennae.forEach((a, i) => {
        a.rotation.x = Math.sin(t * 2 + i) * 0.12;
        a.rotation.z = Math.sin(t * 1.7 + i * 2) * 0.1;
      });
      this.head.rotation.z = d.st === 'dizzy' ? Math.sin(t * 8) * 0.18 : 0;
      this.group.rotation.z = d.st === 'dizzy' ? Math.sin(t * 6) * 0.12 : 0;
      this.hitPoint.copy(this.pos).y += 1;
    }
    // Tendril to the captive
    const cap = d.st === 'grab' && d.cp >= 0 ? this.capturePos() : null;
    this.tendril.visible = !!cap && d.alive;
    if (cap) {
      const from = this.pos.clone().add(new THREE.Vector3(0, 1.2, 0));
      const dir = new THREE.Vector3().subVectors(cap, from);
      const len = dir.length();
      this.tendril.position.copy(from).addScaledVector(dir, 0.5);
      this.tendril.scale.set(1 + Math.sin(t * 20) * 0.2, len, 1 + Math.sin(t * 20) * 0.2);
      this.tendril.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    }
    // Zone telegraphs
    this.zoneMeshes.forEach((mesh, i) => {
      const z = d.zones[i];
      mesh.visible = !!z && d.alive;
      if (!z) return;
      const y = this.groundAt(z[1], z[2]) + 0.1;
      mesh.position.set(z[1], y, z[2]);
      const age = z[3];
      const fuse = Math.min(1, age / ZONE_FUSE);
      mesh.material.opacity = age < ZONE_FUSE ? 0.18 + fuse * 0.32 + Math.sin(age * 22) * 0.06 * fuse : Math.max(0, 0.6 - (age - ZONE_FUSE) * 1.4);
      mesh.scale.setScalar(age < ZONE_FUSE ? 0.55 + fuse * 0.45 : 1 + (age - ZONE_FUSE) * 0.4);
    });
  }

  capturePos() {
    const g = this.game;
    const d = this.d;
    if (d.cp === this.myId) return g.playerGroup.position.clone().add(new THREE.Vector3(0, 1.5, 0));
    const r = g.remotes.get(d.cp);
    return r ? r.group.position.clone().add(new THREE.Vector3(0, 1.5, 0)) : null;
  }

  setBannerText() {
    const texts = {
      sleep: 'Ein Kokon schlummert …',
      awaken: '🦋 Sie erwacht!',
      hover: 'Sie kreist über euch …',
      dust: '✨ SCHUPPENSTAUB! Weicht den Kreisen aus!',
      swoop: '💨 STURZFLUG!',
      grab: '🕸️ GEFANGEN! Schlagt auf Morvanta ein – oder strampelt!',
      dizzy: '💫 Benommen! Doppelter Schaden!'
    };
    this.bannerText.textContent = texts[this.d.st] || '';
  }

  updateBanner() {
    const g = this.game;
    const d = this.d;
    const near = d.alive && d.awake && this.pos.distanceTo(g.playerGroup.position) < 32;
    this.banner.classList.toggle('visible', near);
    if (d.pet > 0) this.bannerText.textContent = `🪨 VERSTEINERT! (${d.pet.toFixed(1)}s)`;
    else if (this.bannerShownPet) this.setBannerText();
    this.bannerShownPet = d.pet > 0;
    this.bannerFill.style.width = `${(d.hp / d.maxHp) * 100}%`;
    // Boss 1 banner uses the same spot; slide this one below it when both are up
    const b1 = document.getElementById('boss-banner');
    this.banner.classList.toggle('below', !!b1 && b1.classList.contains('visible'));
  }
}

function r2(v) {
  return Math.round(v * 100) / 100;
}
