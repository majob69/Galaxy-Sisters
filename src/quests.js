// ==========================================
// RIVER & NIGHT QUESTS: star shards under water, the crystal spring, the four bridges,
// catchable star fireflies and moon flowers that only open at night. Progress is saved.
// ==========================================
import * as THREE from 'three';
import { LAKES, WATER_LEVEL, SPRING_LEVEL } from './landscape.js';
import { createSoftSpriteTexture } from './water.js';

const STORAGE_KEY = 'gs-quests-v1';

export const QUEST_DEFS = [
  { id: 'shards', icon: '💎', name: 'Sternensplitter im Wasser', hint: 'Schwimm über die leuchtenden Splitter', total: 5 },
  { id: 'spring', icon: '⛲', name: 'Finde die Kristallquelle', hint: 'Folge dem Fluss hinauf zum Wasserfall', total: 1 },
  { id: 'bridges', icon: '🌉', name: 'Überquere alle Brücken', hint: 'Mond-, Römer-, Hänge- & Sternenbrücke', total: 4 },
  { id: 'fireflies', icon: '✨', name: 'Fange Sternenglühwürmchen', hint: 'Die goldenen fliegen nachts über der Wiese – manche hoch, spring!', total: 8, night: true },
  { id: 'moonflowers', icon: '🌸', name: 'Pflücke Mondblumen', hint: 'Sie blühen am Flussufer', total: 5, night: true },
  { id: 'gate', icon: '⭐', name: 'Öffne das Sternen-Tor', hint: 'Beide Platten gleichzeitig – zu zweit oder mit Stellas Pfeil', total: 1 },
  { id: 'morvanta', icon: '🦋', name: 'Besiege Morvanta', hint: 'Sie erwacht, sobald Vortox besiegt ist', total: 1 }
];

const BRIDGE_NAMES = { moon: 'Mondbrücke', roman: 'Römerbrücke', rope: 'Hängebrücke', star: 'Sternenbrücke' };

export class QuestSystem {
  constructor(game, { onCollect, onQuestDone, onAllDone } = {}) {
    this.game = game;
    this.onCollect = onCollect;
    this.onQuestDone = onQuestDone;
    this.onAllDone = onAllDone;
    this.state = this.load();
    this.items = [];
    this.halo = createSoftSpriteTexture();
    this.buildShards();
    this.buildSpringMarker();
    this.buildFireflies();
    this.buildMoonFlowers();
    this.dirtyUI = true;
  }

  // ---------- Persistence ----------
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { items: parsed.items || {}, done: parsed.done || {} };
      }
    } catch (e) { /* storage unavailable */ }
    return { items: {}, done: {} };
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  reset() {
    this.state = { items: {}, done: {} };
    this.save();
    this.items.forEach(it => { it.collected = false; it.group.visible = true; });
    this.springMarker.visible = true;
    this.dirtyUI = true;
    this.game.applyQuestRewards(false);
  }

  progress(questId) {
    const def = QUEST_DEFS.find(q => q.id === questId);
    const n = Object.keys(this.state.items).filter(k => k.startsWith(questId + ':')).length;
    return Math.min(def.total, n);
  }

  mark(questId, itemId, label) {
    const key = `${questId}:${itemId}`;
    if (this.state.items[key]) return false;
    this.state.items[key] = true;
    const def = QUEST_DEFS.find(q => q.id === questId);
    const n = this.progress(questId);
    if (this.onCollect) this.onCollect(`${def.icon} ${label} (${n}/${def.total})`);
    if (n >= def.total && !this.state.done[questId]) {
      this.state.done[questId] = true;
      if (this.onQuestDone) this.onQuestDone(def);
      if (QUEST_DEFS.every(q => this.state.done[q.id]) && this.onAllDone) this.onAllDone();
    }
    this.save();
    this.dirtyUI = true;
    return true;
  }

  // ---------- Visual helpers ----------
  haloSprite(color, scale) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.halo, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    sprite.scale.setScalar(scale);
    sprite.renderOrder = 7;
    return sprite;
  }

  lightBeam(color, height) {
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.5, height, 12, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide })
    );
    beam.position.y = height / 2;
    beam.renderOrder = 7;
    return beam;
  }

  addItem(questId, itemId, group, extra = {}) {
    const collected = !!this.state.items[`${questId}:${itemId}`];
    group.visible = !collected;
    this.game.scene.add(group);
    const item = { questId, itemId, group, collected, phase: this.items.length * 1.7, ...extra };
    this.items.push(item);
    return item;
  }

  // ---------- 1. Star shards resting in deep water ----------
  buildShards() {
    const g = this.game;
    const pond = LAKES.find(l => l.id === 'pond');
    const south = LAKES.find(l => l.id === 'southlake');
    const plunge = LAKES.find(l => l.id === 'plunge');
    const riverMid = g.getRiverCrossing(-1.8, -31);
    const spots = [
      { x: pond.x - 2.4, z: pond.z + 1.6 },
      { x: pond.x + 2.0, z: pond.z - 2.8 },
      { x: plunge.x + 0.8, z: plunge.z + 0.6 },
      { x: riverMid.x, z: riverMid.z },
      { x: south.x + 2.2, z: south.z + 1.5 }
    ];
    // Drawn after the water so the glow shines through the surface
    const shardMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.7, 2.2, 2.6), transparent: true, opacity: 0.95 });
    spots.forEach((p, i) => {
      const group = new THREE.Group();
      const bed = g.getTerrainHeight(p.x, p.z);
      group.position.set(p.x, bed + 0.45, p.z);
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), shardMat);
      crystal.scale.set(0.7, 1.3, 0.7);
      crystal.renderOrder = 7;
      group.add(crystal, this.haloSprite(0x7fe8ff, 1.8));
      const beam = this.lightBeam(0x8ff0ff, 6);
      beam.position.y = WATER_LEVEL - group.position.y + 3;
      group.add(beam);
      this.addItem('shards', i, group, { kind: 'shard', crystal, baseY: group.position.y });
    });
  }

  // ---------- 2. Crystal spring (golden beacon until found) ----------
  buildSpringMarker() {
    const spring = LAKES.find(l => l.id === 'spring');
    this.spring = spring;
    this.springMarker = new THREE.Group();
    this.springMarker.position.set(spring.x, SPRING_LEVEL, spring.z);
    const beam = this.lightBeam(0xffd166, 26);
    beam.material.opacity = 0.12;
    this.springMarker.add(beam);
    this.springMarker.visible = !this.state.done.spring;
    this.game.scene.add(this.springMarker);
  }

  // ---------- 4. Star fireflies (night only) ----------
  buildFireflies() {
    const g = this.game;
    const spots = [
      [5, 14, 1.3], [-7, 21, 1.6], [12, -7, 1.4], [-19, 3, 2.3],
      [4, -27, 1.5], [-3, 34, 1.8], [19, 9, 1.3], [-11, -19, 2.5]
    ];
    // Golden star fireflies stand out from the small green ambient ones
    const coreMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 1.6, 0.45) });
    spots.forEach(([x, z, h], i) => {
      const base = Math.max(g.getTerrainHeight(x, z), WATER_LEVEL);
      const group = new THREE.Group();
      group.position.set(x, base + h, z);
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), coreMat);
      const wings = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xe8fff0, transparent: true, opacity: 0.6, depthWrite: false })
      );
      wings.scale.set(1.8, 0.25, 0.9);
      wings.position.y = 0.08;
      group.add(core, wings, this.haloSprite(0xffd97a, 1.7));
      this.addItem('fireflies', i, group, { kind: 'firefly', home: group.position.clone(), wings, night: true });
    });
  }

  // ---------- 5. Moon flowers on the river banks (bloom at night) ----------
  buildMoonFlowers() {
    const g = this.game;
    const pond = LAKES.find(l => l.id === 'pond');
    const spots = [];
    [[-33, 1], [-12, -1], [17, 1], [29, -1]].forEach(([z, side]) => {
      const c = g.getRiverCrossing(0, z);
      const px = -c.dirZ * side;
      const pz = c.dirX * side;
      spots.push({ x: c.x + px * (c.width + 1.2), z: c.z + pz * (c.width + 1.2) });
    });
    spots.push({ x: pond.x + Math.cos(2.5) * 7.0, z: pond.z + Math.sin(2.5) * 7.0 });

    const stemMat = new THREE.MeshLambertMaterial({ color: 0x3f9b62 });
    const petalMat = new THREE.MeshLambertMaterial({ color: 0xdfe9ff, emissive: 0x6fb6ff, emissiveIntensity: 0.2 });
    const heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.9, 1.1, 1.7) });
    spots.forEach((p, i) => {
      const group = new THREE.Group();
      group.position.set(p.x, g.getTerrainHeight(p.x, p.z), p.z);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.7, 5), stemMat);
      stem.position.y = 0.35;
      group.add(stem);
      [-1, 1].forEach(sd => {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), stemMat);
        leaf.scale.set(1.6, 0.25, 0.6);
        leaf.position.set(sd * 0.12, 0.22, 0);
        leaf.rotation.z = sd * 0.4;
        group.add(leaf);
      });
      const bloom = new THREE.Group();
      bloom.position.y = 0.72;
      group.add(bloom);
      const petals = [];
      for (let k = 0; k < 6; k++) {
        const pivot = new THREE.Group();
        pivot.rotation.y = (k / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), petalMat);
        petal.scale.set(0.55, 0.18, 1.3);
        petal.position.z = 0.15;
        pivot.add(petal);
        bloom.add(pivot);
        petals.push(pivot);
      }
      const heart = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), heartMat);
      bloom.add(heart);
      const halo = this.haloSprite(0x9fc8ff, 1.1);
      halo.position.y = 0.72;
      group.add(halo);
      this.addItem('moonflowers', i, group, { kind: 'flower', petals, halo, heart, night: true });
    });
    this.petalMat = petalMat;
  }

  // ---------- Per frame ----------
  update(delta) {
    const g = this.game;
    const t = g.clock.elapsedTime;
    const night = g.dayNight ? g.dayNight.night : 0;
    const isNight = night > 0.45;
    const p = g.playerGroup.position;
    if (isNight !== this.lastNight) {
      this.lastNight = isNight;
      this.dirtyUI = true;
    }

    this.items.forEach(it => {
      if (it.collected) return;
      if (it.kind === 'shard') {
        it.crystal.rotation.y += delta * 1.6;
        it.group.position.y = it.baseY + Math.sin(t * 2 + it.phase) * 0.12;
        const dx = p.x - it.group.position.x;
        const dz = p.z - it.group.position.z;
        if (g.isSwimming && dx * dx + dz * dz < 1.7 * 1.7) this.collect(it, 'Sternensplitter gefunden');
      } else if (it.kind === 'firefly') {
        it.group.visible = isNight;
        if (!isNight) return;
        const h = it.home;
        it.group.position.set(
          h.x + Math.cos(t * 0.8 + it.phase) * 1.3,
          h.y + Math.sin(t * 1.9 + it.phase) * 0.35,
          h.z + Math.sin(t * 0.8 + it.phase) * 1.3
        );
        g.constrainFlyer(it.group.position, 0.4, 0.3);
        it.wings.scale.x = 1.8 * (0.6 + Math.abs(Math.sin(t * 22 + it.phase)) * 0.4);
        if (it.group.position.distanceTo(new THREE.Vector3(p.x, p.y + 1.1, p.z)) < 1.35) this.collect(it, 'Glühwürmchen gefangen');
      } else if (it.kind === 'flower') {
        // Petals open with the night, glow brighter
        const open = THREE.MathUtils.lerp(-1.25, 0.35, night);
        it.petals.forEach(pv => { pv.rotation.x = open; });
        it.halo.material.opacity = night * 0.4;
        it.heart.visible = night > 0.2;
        const dx = p.x - it.group.position.x;
        const dz = p.z - it.group.position.z;
        if (isNight && dx * dx + dz * dz < 1.4 * 1.4 && Math.abs(p.y - it.group.position.y) < 2) this.collect(it, 'Mondblume gepflückt');
      }
    });
    if (this.petalMat) this.petalMat.emissiveIntensity = 0.2 + night * 0.8;

    // Crystal spring
    if (!this.state.done.spring) {
      const dx = p.x - this.spring.x;
      const dz = p.z - this.spring.z;
      if (dx * dx + dz * dz < (this.spring.r + 0.6) ** 2 && Math.abs(p.y - SPRING_LEVEL) < 3) {
        this.springMarker.visible = false;
        this.mark('spring', 0, 'Kristallquelle entdeckt – volle Heilung!');
        g.playerHP = g.maxPlayerHP;
        g.updateHPBar();
      }
    }

    // Bridges: count once the middle of the span is reached
    let bridgeId = null;
    const br = g.currentBridge;
    if (br) {
      const along = (p.x - br.ax) * br.dirX + (p.z - br.az) * br.dirZ;
      if (along > br.len * 0.35 && along < br.len * 0.65) bridgeId = br.id;
    } else if (g.standingOnPlatform && g.standingOnPlatform.plateIndex === 2) {
      bridgeId = 'star';
    }
    if (bridgeId) this.mark('bridges', bridgeId, `${BRIDGE_NAMES[bridgeId]} überquert`);

    if (this.dirtyUI) this.renderUI(isNight);
  }

  collect(item, label) {
    item.collected = true;
    item.group.visible = false;
    this.game.createHealParticles(item.group.position.clone().setY(this.game.playerGroup.position.y));
    this.mark(item.questId, item.itemId, label);
  }

  // Open quest goals for the compass: { id, icon, label, x, z }
  getTargets() {
    const g = this.game;
    const isNight = g.dayNight ? g.dayNight.night > 0.45 : false;
    const out = [];
    const labels = { shard: 'Sternensplitter', firefly: 'Sternenglühwürmchen', flower: 'Mondblume' };
    this.items.forEach(it => {
      if (it.collected || (it.night && !isNight)) return;
      const def = QUEST_DEFS.find(q => q.id === it.questId);
      const p = it.kind === 'firefly' ? it.home : it.group.position;
      out.push({ id: `${it.questId}:${it.itemId}`, icon: def.icon, label: labels[it.kind], x: p.x, z: p.z });
    });
    if (!this.state.done.spring) {
      out.push({ id: 'spring', icon: '⛲', label: 'Kristallquelle', x: this.spring.x, z: this.spring.z });
    }
    if (g.bridgeEnds) {
      Object.keys(BRIDGE_NAMES).forEach(id => {
        if (this.state.items[`bridges:${id}`]) return;
        const e = g.bridgeEnds[id];
        out.push({ id: `bridge:${id}`, icon: '🌉', label: BRIDGE_NAMES[id], x: (e[0].x + e[1].x) / 2, z: (e[0].z + e[1].z) / 2 });
      });
    }
    return out;
  }

  // ---------- Quest list in the quest panel ----------
  renderUI(isNight) {
    this.dirtyUI = false;
    const el = document.getElementById('quest-list');
    if (!el) return;
    const rows = QUEST_DEFS.map(q => {
      const n = this.progress(q.id);
      const done = !!this.state.done[q.id];
      const nightTag = q.night && !done && !isNight ? ' <span class="quest-tag">🌙 nur nachts</span>' : '';
      return `<div class="quest-item quest-row${done ? ' done' : ''}" title="${q.hint}">` +
        `${done ? '✅' : q.icon} <b>${q.name}</b> <span class="quest-progress">${n}/${q.total}</span>${nightTag}</div>`;
    });
    const any = Object.keys(this.state.items).length > 0;
    if (any) rows.push('<button class="quest-reset clickable" id="btn-quest-reset" type="button">↺ Quests neu starten</button>');
    el.innerHTML = rows.join('');
    const resetBtn = document.getElementById('btn-quest-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => this.reset());
  }
}
