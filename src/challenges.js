// ==========================================
// CHALLENGES of the second and third world - harder than the valley puzzles:
//   ❄️ Frost-Spirale     an ice obby spiralling up a glowing pillar (some ice floes crack under
//                        your feet!). On top waits the NORDLICHT puzzle: four crystals light up in a
//                        sequence - step on them in the same order. Three rounds: 4, 6 and 8 lights.
//   🧊 Gletscher-Sprünge a second obby up to a floating ice field with the SLIDING ICE puzzle:
//                        push the two ice blocks (F) onto the glowing runes - but ice slides until
//                        it hits something!
//   🏮 Laternen-Rätsel   in the enchanted forest: seven lanterns in a ring. Touching one switches it
//                        and both neighbours. Light all seven.
// Progress is saved in localStorage. In co-op every push, lantern and solved puzzle is shared.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { snowAt } from './biome.js';
import { VORTOX_ARENA } from './arenas.js';
import { FOREST, FOREST_ARENA, LILLI_SPOT } from './forest.js';
import { LANDMARKS } from './spots.js';

const STORAGE_KEY = 'gs-challenges-v1';

// Sliding puzzle (6x6, verified solvable in 8 pushes)
const SLIDE_N = 6;
const SLIDE_CELL = 1.4;
const SLIDE_ROCKS = [[3, 2], [2, 0], [0, 3], [3, 1], [5, 5]];
const SLIDE_BLOCKS = [[5, 3], [1, 3]];
const SLIDE_TARGETS = [[0, 2], [5, 0]];

const MEMORY_ROUNDS = [4, 6, 8];
const MEMORY_COLORS = [[0.5, 1.4, 2.8], [0.5, 2.6, 1.0], [2.8, 0.7, 1.8], [2.8, 2.2, 0.5]];
const MEMORY_TONES = [523, 659, 784, 988];

const LANTERNS = 7;
const LANTERN_START = [1, 0, 0, 1, 0, 1, 0];

const iceMat = () => new THREE.MeshLambertMaterial({ color: 0xbfe6ff, emissive: 0x2a5a8a, emissiveIntensity: 0.35, flatShading: true });

export class Challenges {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.crumbling = [];
    this.buildFrostSpiral();
    this.buildGlacierHops();
    this.buildLanterns();
    // older save games: count what was already done for the new quests
    const q = game.quests;
    if (this.state.obby1) q.markQuiet('obbys', 'spiral');
    if (this.state.obby2) q.markQuiet('obbys', 'glacier');
    if (this.state.memory) q.markQuiet('snowpuzzles', 'memory');
    if (this.state.slide) q.markQuiet('snowpuzzles', 'slide');
    if (this.state.lanterns) q.markQuiet('lanterns', 0);
  }

  load() {
    const fresh = { obby1: false, obby2: false, memory: false, slide: false, lanterns: false };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        Object.keys(fresh).forEach(k => { fresh[k] = !!p[k]; });
      }
    } catch (e) { /* storage unavailable */ }
    return fresh;
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  reward(coins, xp, why, items = {}) {
    const g = this.game;
    g.inventory.addCoins(coins, why);
    g.progression.addXp(xp, why);
    Object.keys(items).forEach(id => g.inventory.add(id, items[id], true));
    sfx.victory();
  }

  // Where an obby fits around Vortox' arena: the base on snowy ground, every floe floating free
  // (not inside a hill, not over the arena) and few things in the way. layout(x, z, h) lists the
  // floes as { x, z, top }.
  pickSnowSpot(layout, clear) {
    const g = this.game;
    let best = null;
    for (let a = 0; a < Math.PI * 2; a += 0.06) {
      for (let r = VORTOX_ARENA.r + 2.5; r <= VORTOX_ARENA.r + 15; r += 1) {
        const x = VORTOX_ARENA.x + Math.cos(a) * r;
        const z = VORTOX_ARENA.z + Math.sin(a) * r;
        if (Math.abs(x) > 86 || Math.abs(z) > 86) continue;
        const h0 = g.getTerrainHeight(x, z);
        let score = 0;
        if (snowAt(x, z) < 0.5) score += 60;
        if (g.getTerrainSlope(x, z) > 0.25) score += 30;
        if (g.checkWallCollision(x, z, 1.5, h0)) score += 25;
        if (g.getWaterSurface(x, z) !== null) score += 60;
        // stay clear of the fixed places of the valley (start, lake ...), the star gate and the other obby
        LANDMARKS.forEach(l => { if (l.r < 25 && !(l.x === VORTOX_ARENA.x && l.z === VORTOX_ARENA.z) && Math.hypot(l.x - x, l.z - z) < l.r + clear) score += 50; });
        if (g.stargate && Math.hypot(g.stargate.center.x - x, g.stargate.center.z - z) < 14 + clear) score += 50;
        (this.avoidSpots || []).forEach(s => { if (Math.hypot(s.x - x, s.z - z) < s.r + clear) score += 80; });
        if (best && score >= best.score) continue;
        layout(x, z, h0).forEach((p, i) => {
          if (Math.hypot(p.x - VORTOX_ARENA.x, p.z - VORTOX_ARENA.z) < VORTOX_ARENA.r + 1.2) score += 100;
          const ground = g.getTerrainHeight(p.x, p.z);
          if (ground > p.top - 0.9) score += 40;
          if (i < 4 && g.checkWallCollision(p.x, p.z, 0.9, ground)) score += 6;
        });
        if (!best || score < best.score) best = { x, z, y: h0, score };
      }
    }
    return best;
  }

  addPlatform(group, x, y, z, radius, crumble) {
    const g = this.game;
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.8, 0.35, 10), crumble ? this.crackMat : this.floeMat);
    mesh.position.set(x, y - 0.17, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    const plat = { type: 'cylinder', x, z, radius, topY: y, crystal: true };
    g.platforms.push(plat);
    if (crumble) this.crumbling.push({ mesh, plat, top: y, timer: 0, gone: 0 });
    return plat;
  }

  // ---------- ❄️ Frost-Spirale + Nordlicht puzzle ----------
  spiralLayout(x, z, h) {
    const out = [];
    for (let k = 0; k < 11; k++) out.push({ x: x + Math.cos(k) * 3.3, z: z + Math.sin(k) * 3.3, top: h + 1.1 + k * 1.05, step: true });
    for (let k = 0; k < 8; k++) out.push({ x: x + Math.cos(k * 0.785) * 4.6, z: z + Math.sin(k * 0.785) * 4.6, top: h + 12.6 });
    return out;
  }

  buildFrostSpiral() {
    const g = this.game;
    this.floeMat = iceMat();
    this.crackMat = new THREE.MeshLambertMaterial({ color: 0xe8f6ff, emissive: 0x6aa8d8, emissiveIntensity: 0.25, flatShading: true, transparent: true, opacity: 0.85 });
    const spot = this.pickSnowSpot((x, z, h) => this.spiralLayout(x, z, h), 4.5);
    this.spiral = spot;
    this.avoidSpots = [{ x: spot.x, z: spot.z, r: 6 }];
    const group = new THREE.Group();
    const base = spot.y;
    // glowing ice pillar
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.0, 12.4, 8), iceMat());
    pillar.position.set(spot.x, base + 6.2, spot.z);
    pillar.castShadow = true;
    group.add(pillar);
    g.colliders.push({ type: 'cylinder', x: spot.x, z: spot.z, radius: 1.0, minY: base - 1, maxY: base + 12.3 });
    this.spiralLayout(spot.x, spot.z, base).forEach((p, k) => { if (p.step) this.addPlatform(group, p.x, p.top, p.z, 0.8, k % 3 === 2); });
    // the top: a round ice terrace with the four Nordlicht crystals
    const topY = base + 12.6;
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 3.6, 0.5, 24), iceMat());
    disc.position.set(spot.x, topY - 0.25, spot.z);
    disc.receiveShadow = true;
    group.add(disc);
    g.platforms.push({ type: 'cylinder', x: spot.x, z: spot.z, radius: 4.6, topY, crystal: true });
    this.memory = { topY, plates: [], seq: [], step: 0, phase: 'idle', round: 0, timer: 0, show: -1, inside: -1 };
    [[-1.8, -1.8], [1.8, -1.8], [1.8, 1.8], [-1.8, 1.8]].forEach(([ox, oz], i) => {
      const c = new THREE.Color(...MEMORY_COLORS[i]);
      const plateMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.25) });
      plateMat.userData.noNightGlow = true;
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.08, 18), plateMat);
      plate.position.set(spot.x + ox, topY + 0.04, spot.z + oz);
      group.add(plate);
      const crystalMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.35) });
      crystalMat.userData.noNightGlow = true;
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), crystalMat);
      crystal.scale.y = 1.8;
      crystal.position.set(spot.x + ox * 1.55, topY + 1.2, spot.z + oz * 1.55);
      group.add(crystal);
      this.memory.plates.push({ x: spot.x + ox, z: spot.z + oz, plateMat, crystalMat, crystal, color: c, glow: 0 });
    });
    const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.8, 2.6) });
    orbMat.userData.noNightGlow = true;
    this.memory.orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), orbMat);
    this.memory.orb.position.set(spot.x, topY + 1.4, spot.z);
    group.add(this.memory.orb);
    this.memory.chest = this.makeChest(group, spot.x, topY, spot.z + 3.4, this.state.memory);
    g.scene.add(group);
    this.spiralGroup = group;
  }

  makeChest(group, x, y, z, open) {
    const chest = new THREE.Group();
    chest.position.set(x, y, z);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.6), new THREE.MeshLambertMaterial({ color: 0x5a7fbf, flatShading: true }));
    body.position.y = 0.28;
    chest.add(body);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.16, 0.64), new THREE.MeshLambertMaterial({ color: 0xbfe6ff, flatShading: true }));
    lid.position.set(0, 0.62, 0);
    chest.add(lid);
    chest.visible = !open;
    group.add(chest);
    return chest;
  }

  startMemory() {
    const m = this.memory;
    m.round = 0;
    this.newMemoryRound();
    this.game.showToast('✨ Nordlicht-Rätsel: Merk dir, welche Kristalle aufleuchten – dann stell dich in derselben Reihenfolge auf ihre Platten!', 6000);
  }

  newMemoryRound() {
    const m = this.memory;
    const len = MEMORY_ROUNDS[m.round];
    m.seq = [];
    for (let i = 0; i < len; i++) {
      let n;
      do { n = Math.floor(Math.random() * 4); } while (i > 0 && n === m.seq[i - 1] && Math.random() < 0.7);
      m.seq.push(n);
    }
    m.step = 0;
    m.phase = 'show';
    m.timer = -0.8;
    m.show = -1;
  }

  memoryStep(i) {
    const g = this.game;
    const m = this.memory;
    const p = m.plates[i];
    p.glow = 1;
    if (m.seq[m.step] === i) {
      sfx.playTone(MEMORY_TONES[i], 'sine', 0.2, 0.08);
      m.step++;
      if (m.step >= m.seq.length) {
        m.round++;
        if (m.round >= MEMORY_ROUNDS.length) {
          m.phase = 'done';
          this.state.memory = true;
          this.save();
          m.chest.visible = false;
          const pos = new THREE.Vector3(this.spiral.x, m.topY + 2, this.spiral.z);
          g.fx.burst(pos, m.plates.map(q => q.color), 120, { speed: 7, up: 5, size: 0.5, life: 1.4, gravity: 3 });
          g.showToast('🌌 Das Nordlicht leuchtet! Rätsel gelöst – in der Eistruhe lagen 60 Sterntaler, Glas und Seil.', 7000);
          this.reward(60, 100, 'Nordlicht-Rätsel', { glass: 3, rope: 2 });
          g.quests.mark('snowpuzzles', 'memory', 'Nordlicht-Rätsel gelöst');
          g.coop.sendWorld({ k: 'mem' });
          return;
        }
        m.phase = 'pause';
        m.timer = 0;
        g.showToast(`✨ Richtig! Runde ${m.round + 1} von ${MEMORY_ROUNDS.length}: diesmal ${MEMORY_ROUNDS[m.round]} Lichter …`, 3500);
        sfx.collect();
      }
    } else {
      sfx.playTone(150, 'sawtooth', 0.35, 0.07);
      g.showToast('❌ Falsche Reihenfolge! Pass gut auf – die Lichter zeigen sich noch einmal.', 3500);
      m.phase = 'pause';
      m.timer = -0.5;
      m.retry = true;
    }
  }

  updateMemory(delta, t) {
    const g = this.game;
    const m = this.memory;
    const pp = g.playerGroup.position;
    m.orb.rotation.y += delta;
    m.orb.position.y = m.topY + 1.4 + Math.sin(t * 2) * 0.12;
    if (m.phase === 'show') {
      m.timer += delta;
      const idx = Math.floor(m.timer / 0.85);
      if (m.timer >= 0 && idx < m.seq.length && idx !== m.show) {
        m.show = idx;
        const n = m.seq[idx];
        m.plates[n].glow = 1;
        sfx.playTone(MEMORY_TONES[n], 'sine', 0.3, 0.07);
      }
      if (idx >= m.seq.length) { m.phase = 'input'; m.inside = -1; g.showToast('👣 Jetzt du! Stell dich der Reihe nach auf die Platten.', 3000); }
    } else if (m.phase === 'pause') {
      m.timer += delta;
      if (m.timer > 1.4) {
        if (m.retry) { m.retry = false; m.step = 0; m.phase = 'show'; m.timer = -0.6; m.show = -1; } else this.newMemoryRound();
      }
    } else if (m.phase === 'input') {
      let on = -1;
      if (Math.abs(pp.y - m.topY) < 0.6) m.plates.forEach((p, i) => { if (Math.hypot(pp.x - p.x, pp.z - p.z) < 0.8) on = i; });
      if (on >= 0 && on !== m.inside) this.memoryStep(on);
      m.inside = on;
      // fell off the tower: the round starts over when you are back
      if (pp.y < m.topY - 3) { m.phase = 'idle'; g.showToast('❄️ Runter gefallen – das Nordlicht-Rätsel wartet oben auf dich.', 3000); }
    }
    m.plates.forEach(p => {
      p.glow = Math.max(0, p.glow - delta * 1.8);
      const k = 0.25 + p.glow * 0.9 + (this.state.memory ? 0.5 : 0);
      p.plateMat.color.copy(p.color).multiplyScalar(k);
      p.crystalMat.color.copy(p.color).multiplyScalar(0.35 + p.glow * 0.9 + (this.state.memory ? 0.5 : 0));
      p.crystal.rotation.y += delta * (0.5 + p.glow * 4);
    });
  }

  // ---------- 🧊 Gletscher-Sprünge + sliding ice puzzle ----------
  glacierLayout(x, z, h) {
    const size = (SLIDE_N + 2) * SLIDE_CELL;
    const out = [];
    for (let k = 0; k < 10; k++) {
      const a = k * 0.62;
      const r = size / 2 + 1.8;
      out.push({ x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, top: h + 1.0 + k * 0.95, step: true });
    }
    for (const sx of [-1, 0, 1]) for (const sz of [-1, 0, 1]) out.push({ x: x + sx * size / 2, z: z + sz * size / 2, top: h + 9.6 });
    return out;
  }

  buildGlacierHops() {
    const g = this.game;
    const spot = this.pickSnowSpot((x, z, h) => this.glacierLayout(x, z, h), 7.5);
    this.glacier = spot;
    const group = new THREE.Group();
    const base = spot.y;
    const fieldY = base + 9.6;
    const size = (SLIDE_N + 2) * SLIDE_CELL;
    // hops spiralling up around the floating ice field
    this.glacierLayout(spot.x, spot.z, base).forEach((p, k) => { if (p.step) this.addPlatform(group, p.x, p.top, p.z, 0.75, k % 4 === 3); });
    // the floating ice field (grid with a margin of one cell)
    const field = new THREE.Mesh(new THREE.BoxGeometry(size, 0.6, size), iceMat());
    field.position.set(spot.x, fieldY - 0.3, spot.z);
    field.receiveShadow = true;
    group.add(field);
    g.platforms.push({ type: 'box', minX: spot.x - size / 2, maxX: spot.x + size / 2, minZ: spot.z - size / 2, maxZ: spot.z + size / 2, topY: fieldY, crystal: true });
    const lines = new THREE.Mesh(new THREE.PlaneGeometry(SLIDE_N * SLIDE_CELL, SLIDE_N * SLIDE_CELL), new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, depthWrite: false }));
    lines.rotation.x = -Math.PI / 2;
    lines.position.set(spot.x, fieldY + 0.02, spot.z);
    group.add(lines);
    const s = this.slide = {
      ox: spot.x - (SLIDE_N * SLIDE_CELL) / 2, oz: spot.z - (SLIDE_N * SLIDE_CELL) / 2, y: fieldY,
      blocks: [], rocks: SLIDE_ROCKS.map(r => r.slice()), solved: this.state.slide
    };
    const cellPos = (c, r) => new THREE.Vector3(s.ox + (c + 0.5) * SLIDE_CELL, fieldY, s.oz + (r + 0.5) * SLIDE_CELL);
    this.cellPos = cellPos;
    const runeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 2.6), transparent: true, opacity: 0.8 });
    runeMat.userData.noNightGlow = true;
    SLIDE_TARGETS.forEach(([c, r]) => {
      const p = cellPos(c, r);
      const rune = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.6, 4), runeMat);
      rune.rotation.set(-Math.PI / 2, 0, Math.PI / 4);
      rune.position.set(p.x, fieldY + 0.04, p.z);
      group.add(rune);
    });
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
    s.rocks.forEach(([c, r]) => {
      const p = cellPos(c, r);
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.62, 0), snowMat);
      rock.position.set(p.x, fieldY + 0.45, p.z);
      rock.castShadow = true;
      group.add(rock);
      g.colliders.push({ type: 'cylinder', x: p.x, z: p.z, radius: 0.6, minY: fieldY - 0.2, maxY: fieldY + 1.2 });
    });
    const blockMat = new THREE.MeshLambertMaterial({ color: 0x9fdcff, emissive: 0x3a7ab8, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 });
    SLIDE_BLOCKS.forEach(([c, r]) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.15, 1.15), blockMat);
      mesh.castShadow = true;
      group.add(mesh);
      const col = { type: 'box', minX: 0, maxX: 0, minZ: 0, maxZ: 0, minY: fieldY - 0.2, maxY: fieldY + 1.2 };
      g.colliders.push(col);
      s.blocks.push({ c, r, mesh, col, from: null, t: 1 });
    });
    // reset crystal in a corner of the margin
    const rp = cellPos(-1, -1);
    const resetMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.4, 2.6) });
    resetMat.userData.noNightGlow = true;
    s.reset = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0), resetMat);
    s.reset.position.set(rp.x, fieldY + 1.0, rp.z);
    group.add(s.reset);
    s.resetPos = rp;
    s.chest = this.makeChest(group, cellPos(SLIDE_N, SLIDE_N).x, fieldY, cellPos(SLIDE_N, SLIDE_N).z, this.state.slide);
    if (this.state.slide) SLIDE_TARGETS.forEach(([c, r], i) => { s.blocks[i].c = c; s.blocks[i].r = r; });
    s.blocks.forEach(b => this.placeBlock(b));
    g.scene.add(group);
    this.glacierGroup = group;
  }

  placeBlock(b, k = 1) {
    const p = this.cellPos(b.c, b.r);
    if (b.from && k < 1) {
      b.mesh.position.lerpVectors(b.from, p, k).setY(this.slide.y + 0.58);
    } else {
      b.mesh.position.set(p.x, this.slide.y + 0.58, p.z);
    }
    const h = 0.6;
    b.col.minX = b.mesh.position.x - h;
    b.col.maxX = b.mesh.position.x + h;
    b.col.minZ = b.mesh.position.z - h;
    b.col.maxZ = b.mesh.position.z + h;
  }

  slideOccupied(c, r, except) {
    if (c < 0 || r < 0 || c >= SLIDE_N || r >= SLIDE_N) return true;
    if (this.slide.rocks.some(([rc, rr]) => rc === c && rr === r)) return true;
    return this.slide.blocks.some(b => b !== except && b.c === c && b.r === r);
  }

  // Push block b one way: it slides until something stops it. Returns true if it moved.
  pushBlock(b, dc, dr, remote = false) {
    if (!remote) this.game.coop.sendWorld({ k: 'slide', b: this.slide.blocks.indexOf(b), dc, dr });
    let c = b.c;
    let r = b.r;
    while (!this.slideOccupied(c + dc, r + dr, b)) { c += dc; r += dr; }
    if (c === b.c && r === b.r) {
      this.game.showToast('🧊 Der Eisblock rührt sich nicht – da ist etwas im Weg.', 2200);
      return false;
    }
    b.from = b.mesh.position.clone();
    b.dist = Math.abs(c - b.c) + Math.abs(r - b.r);
    b.c = c;
    b.r = r;
    b.t = 0;
    sfx.playTone(260, 'triangle', 0.25, 0.06);
    this.checkSlideSolved();
    return true;
  }

  checkSlideSolved() {
    const s = this.slide;
    if (s.solved) return;
    const done = SLIDE_TARGETS.every(([c, r]) => s.blocks.some(b => b.c === c && b.r === r));
    if (!done) return;
    s.solved = true;
    this.state.slide = true;
    this.save();
    s.chest.visible = false;
    const g = this.game;
    setTimeout(() => {
      g.fx.burst(new THREE.Vector3(this.glacier.x, s.y + 2, this.glacier.z), [new THREE.Color(0.8, 1.8, 2.8), new THREE.Color(2.4, 2.6, 2.8)], 120, { speed: 7, up: 5, size: 0.5, life: 1.4, gravity: 3 });
      g.showToast('🧊 Beide Eisblöcke stehen auf den Runen! Rätsel gelöst – 70 Sterntaler, Holz und Stoff gehören dir.', 7000);
      this.reward(70, 120, 'Eis-Rätsel', { wood: 4, cloth: 2 });
      g.quests.mark('snowpuzzles', 'slide', 'Eisschiebe-Rätsel gelöst');
    }, 500);
  }

  resetSlide(remote = false) {
    if (!remote) this.game.coop.sendWorld({ k: 'slreset' });
    const s = this.slide;
    s.blocks.forEach((b, i) => { b.c = SLIDE_BLOCKS[i][0]; b.r = SLIDE_BLOCKS[i][1]; b.from = null; b.t = 1; this.placeBlock(b); });
    sfx.playTone(440, 'sine', 0.15, 0.05);
    this.game.showToast('↺ Die Eisblöcke sind zurück an ihrem Anfang.', 2500);
  }

  // which grid cell the player stands in (can be -1 or SLIDE_N on the margin)
  playerCell() {
    const pp = this.game.playerGroup.position;
    const s = this.slide;
    if (Math.abs(pp.y - s.y) > 0.8) return null;
    return { c: Math.floor((pp.x - s.ox) / SLIDE_CELL), r: Math.floor((pp.z - s.oz) / SLIDE_CELL) };
  }

  // ---------- 🏮 Lantern ring in the enchanted forest ----------
  buildLanterns() {
    const g = this.game;
    // a calm clearing in the east of the forest, away from the arena
    let best = null;
    for (let a = -1.4; a <= 1.4; a += 0.1) {
      for (let r = 22; r <= 40; r += 2) {
        const x = FOREST.x + Math.cos(a) * r;
        const z = FOREST.z + Math.sin(a) * r;
        if (Math.hypot(x - FOREST_ARENA.x, z - FOREST_ARENA.z) < FOREST_ARENA.r + 10) continue;
        if (Math.hypot(x - LILLI_SPOT.x, z - LILLI_SPOT.z) < 8) continue;
        if (Math.hypot(x - FOREST.x, z - (FOREST.z + 40)) < 12) continue;
        let score = 0;
        for (let k = 0; k < 12; k++) {
          const ka = (k / 12) * Math.PI * 2;
          if (g.checkWallCollision(x + Math.cos(ka) * 4.5, z + Math.sin(ka) * 4.5, 1.0, g.getTerrainHeight(x, z))) score += 5;
        }
        if (g.checkWallCollision(x, z, 2, g.getTerrainHeight(x, z))) score += 20;
        if (!best || score < best.score) best = { x, z, score };
      }
    }
    const c = best;
    this.lanternSpot = c;
    const group = new THREE.Group();
    const stone = new THREE.MeshLambertMaterial({ color: 0x5a4a7a, flatShading: true });
    const cy = g.getTerrainHeight(c.x, c.z);
    const altar = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 0.9, 8), stone);
    altar.position.set(c.x, cy + 0.45, c.z);
    group.add(altar);
    g.colliders.push({ type: 'cylinder', x: c.x, z: c.z, radius: 0.9, minY: cy - 1, maxY: cy + 1 });
    const heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.4, 0.9) });
    heartMat.userData.noNightGlow = true;
    this.lanternHeart = new THREE.Mesh(new THREE.IcosahedronGeometry(0.4, 1), heartMat);
    this.lanternHeart.position.set(c.x, cy + 1.4, c.z);
    group.add(this.lanternHeart);
    this.lanterns = [];
    const lit = this.state.lanterns ? new Array(LANTERNS).fill(1) : LANTERN_START.slice();
    for (let i = 0; i < LANTERNS; i++) {
      const a = (i / LANTERNS) * Math.PI * 2;
      const x = c.x + Math.cos(a) * 4.2;
      const z = c.z + Math.sin(a) * 4.2;
      const y = g.getTerrainHeight(x, z);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 1.6, 6), stone);
      post.position.set(x, y + 0.8, z);
      group.add(post);
      const glassMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.15, 0.3) });
      glassMat.userData.noNightGlow = true;
      const lamp = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), glassMat);
      lamp.scale.y = 1.4;
      lamp.position.set(x, y + 1.9, z);
      group.add(lamp);
      g.colliders.push({ type: 'cylinder', x, z, radius: 0.2, minY: y - 1, maxY: y + 2 });
      this.lanterns.push({ x, z, y, lamp, glassMat, on: lit[i] === 1 });
    }
    this.lanternGroup = group;
    g.scene.add(group);
    this.refreshLanterns();
  }

  refreshLanterns() {
    this.lanterns.forEach(l => {
      if (l.on) l.glassMat.color.setRGB(2.6, 1.8, 0.8);
      else l.glassMat.color.setRGB(0.2, 0.15, 0.3);
    });
  }

  touchLantern(i, remote = false) {
    if (this.state.lanterns) return;
    if (!remote) this.game.coop.sendWorld({ k: 'lan', i });
    [i - 1, i, i + 1].forEach(k => {
      const l = this.lanterns[(k + LANTERNS) % LANTERNS];
      l.on = !l.on;
    });
    sfx.playTone(600 + i * 60, 'sine', 0.15, 0.06);
    this.refreshLanterns();
    if (this.lanterns.every(l => l.on)) {
      this.state.lanterns = true;
      this.save();
      const g = this.game;
      const c = this.lanternSpot;
      g.fx.burst(new THREE.Vector3(c.x, this.lanternHeart.position.y, c.z), [new THREE.Color(2.6, 1.8, 0.8), new THREE.Color(2.0, 1.2, 2.6)], 140, { speed: 6, up: 5, size: 0.45, life: 1.6, gravity: 1 });
      g.showToast('🏮 Alle sieben Laternen leuchten! Das Waldherz schenkt dir 80 Sterntaler und zwei Lampen.', 7000);
      this.reward(80, 140, 'Laternen-Rätsel', { lamp: 2, glass: 2 });
      g.quests.mark('lanterns', 0, 'Laternen-Rätsel gelöst');
    }
  }

  resetLanterns(remote = false) {
    if (this.state.lanterns) return;
    if (!remote) this.game.coop.sendWorld({ k: 'lanreset' });
    this.lanterns.forEach((l, i) => { l.on = LANTERN_START[i] === 1; });
    this.refreshLanterns();
    this.game.showToast('↺ Die Laternen sind wieder wie am Anfang.', 2500);
  }

  // ---------- Co-op: what a friend did ----------
  onRemote(m) {
    const g = this.game;
    if (m.k === 'slide') {
      const b = this.slide.blocks[m.b | 0];
      if (b && !this.slide.solved) {
        if (b.t < 1) { b.t = 1; this.placeBlock(b); }
        this.pushBlock(b, Math.sign(m.dc | 0), Math.sign(m.dr | 0), true);
      }
    } else if (m.k === 'slreset') {
      if (!this.slide.solved) this.resetSlide(true);
    } else if (m.k === 'lan') {
      const i = m.i | 0;
      if (i >= 0 && i < LANTERNS) this.touchLantern(i, true);
    } else if (m.k === 'lanreset') {
      this.resetLanterns(true);
    } else if (m.k === 'mem' && !this.state.memory) {
      const mem = this.memory;
      mem.phase = 'done';
      this.state.memory = true;
      this.save();
      mem.chest.visible = false;
      g.showToast('🌌 Eine Freundin hat das Nordlicht-Rätsel gelöst! Die Eistruhe teilt sie mit dir.', 6000);
      this.reward(60, 100, 'Nordlicht-Rätsel', { glass: 3, rope: 2 });
      g.quests.mark('snowpuzzles', 'memory', 'Nordlicht-Rätsel gelöst');
    }
  }

  // ---------- Compass ----------
  getTargets(inForest) {
    const out = [];
    if (inForest) {
      if (!this.state.lanterns) out.push({ id: 'lanterns', icon: '🏮', label: 'Laternen-Rätsel', x: this.lanternSpot.x, z: this.lanternSpot.z });
      return out;
    }
    if (!this.state.memory) out.push({ id: 'frostspiral', icon: '❄️', label: 'Frost-Spirale', x: this.spiral.x, z: this.spiral.z });
    if (!this.state.slide) out.push({ id: 'glacier', icon: '🧊', label: 'Gletscher-Sprünge', x: this.glacier.x, z: this.glacier.z });
    return out;
  }

  // ---------- Interact key ----------
  getInteraction() {
    const g = this.game;
    const pp = g.playerGroup.position;
    let best = null;
    const consider = (dist, label, action) => { if (!best || dist < best.dist) best = { dist, label, action }; };
    // Nordlicht
    const m = this.memory;
    if (Math.abs(pp.y - m.topY) < 1 && !this.state.memory) {
      const d = Math.hypot(pp.x - this.spiral.x, pp.z - this.spiral.z);
      if (d < 1.8 && (m.phase === 'idle' || m.phase === 'done')) consider(d, '✨ Nordlicht-Rätsel starten', () => this.startMemory());
    }
    // sliding ice
    const s = this.slide;
    const cell = this.playerCell();
    if (cell && !s.solved) {
      s.blocks.forEach(b => {
        const dc = b.c - cell.c;
        const dr = b.r - cell.r;
        if (Math.abs(dc) + Math.abs(dr) !== 1 || b.t < 1) return;
        const center = this.cellPos(b.c, b.r);
        const d = Math.hypot(pp.x - center.x, pp.z - center.z);
        consider(d, '🧊 Eisblock schieben', () => this.pushBlock(b, dc, dr));
      });
      const dr = Math.hypot(pp.x - s.resetPos.x, pp.z - s.resetPos.z);
      if (dr < 1.6) consider(dr, '↺ Eis-Rätsel neu starten', () => this.resetSlide());
    }
    // lanterns
    if (!this.state.lanterns && this.lanternSpot) {
      this.lanterns.forEach((l, i) => {
        const d = Math.hypot(pp.x - l.x, pp.z - l.z);
        if (d < 1.6) consider(d, l.on ? '🏮 Laterne löschen' : '🏮 Laterne anzünden', () => this.touchLantern(i));
      });
      const dc = Math.hypot(pp.x - this.lanternSpot.x, pp.z - this.lanternSpot.z);
      if (dc < 1.9) consider(dc, '↺ Laternen zurücksetzen', () => this.resetLanterns());
    }
    return best;
  }

  // ---------- Per frame ----------
  update(delta) {
    const g = this.game;
    const t = g.clock.elapsedTime;
    const pp = g.playerGroup.position;
    const inForest = pp.x > 300;
    const inValley = Math.abs(pp.x) < 300;
    this.spiralGroup.visible = inValley;
    this.glacierGroup.visible = inValley;
    this.lanternGroup.visible = inForest;

    // cracking ice floes: stand on them too long and they break (and come back a moment later)
    this.crumbling.forEach(c => {
      if (c.gone > 0) {
        c.gone -= delta;
        if (c.gone <= 0) { c.plat.topY = c.top; c.mesh.visible = true; c.mesh.material.opacity = 0.85; c.timer = 0; }
        return;
      }
      if (g.standingOnPlatform === c.plat) {
        c.timer += delta;
        c.mesh.position.x = c.plat.x + Math.sin(t * 50) * 0.05 * c.timer;
        if (c.timer > 0.9) {
          c.gone = 3;
          c.plat.topY = -1e9;
          c.mesh.visible = false;
          g.fx.burst(new THREE.Vector3(c.plat.x, c.top, c.plat.z), [new THREE.Color(1.6, 2.2, 2.8)], 18, { speed: 3, up: 1, size: 0.3, gravity: 6 });
          sfx.playTone(900, 'square', 0.08, 0.04);
        }
      } else {
        c.timer = Math.max(0, c.timer - delta * 0.5);
        c.mesh.position.x = c.plat.x;
      }
    });

    if (inValley) {
      this.updateMemory(delta, t);
      // reaching the tops
      if (!this.state.obby1 && Math.abs(pp.y - this.memory.topY) < 0.5 && Math.hypot(pp.x - this.spiral.x, pp.z - this.spiral.z) < 4.6) {
        this.state.obby1 = true;
        this.save();
        g.showToast('❄️ Frost-Spirale geschafft! Hier oben wartet das Nordlicht-Rätsel (F am Lichtkristall in der Mitte).', 6000);
        this.reward(20, 40, 'Frost-Spirale');
        g.quests.mark('obbys', 'spiral', 'Frost-Spirale erklommen');
      }
      const s = this.slide;
      if (!this.state.obby2 && Math.abs(pp.y - s.y) < 0.5 && Math.abs(pp.x - this.glacier.x) < (SLIDE_N + 2) * SLIDE_CELL / 2 && Math.abs(pp.z - this.glacier.z) < (SLIDE_N + 2) * SLIDE_CELL / 2) {
        this.state.obby2 = true;
        this.save();
        g.showToast('🧊 Gletscher-Sprünge geschafft! Schieb die Eisblöcke (F) auf die leuchtenden Runen – Eis rutscht, bis es anstößt!', 7000);
        this.reward(20, 40, 'Gletscher-Sprünge');
        g.quests.mark('obbys', 'glacier', 'Gletscher-Sprünge geschafft');
      }
      s.blocks.forEach(b => {
        if (b.t < 1) {
          b.t = Math.min(1, b.t + delta * 8 / Math.max(1, b.dist));
          this.placeBlock(b, b.t);
        }
      });
      s.reset.rotation.y += delta * 1.5;
    } else if (inForest) {
      this.lanternHeart.rotation.y += delta;
      this.lanternHeart.material.color.setRGB(this.state.lanterns ? 2.4 : 0.6, this.state.lanterns ? 1.6 : 0.4, this.state.lanterns ? 2.6 : 0.9);
      this.lanterns.forEach((l, i) => { l.lamp.rotation.y += delta * (l.on ? 1.2 : 0.2); l.lamp.position.y = l.y + 1.9 + (l.on ? Math.sin(t * 2 + i) * 0.06 : 0); });
    }
  }
}

function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 384;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.lineWidth = 3;
  for (let i = 0; i <= SLIDE_N; i++) {
    const p = (i / SLIDE_N) * 384;
    ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, 384); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, p); ctx.lineTo(384, p); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
