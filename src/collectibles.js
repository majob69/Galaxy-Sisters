// ==========================================
// EXPLORATION: hidden treasure chests, wonder flowers and glow mushrooms to find, and fishing.
// Everything found feeds the quests "Verborgene Truhen" and "Sammelalbum" (saved like all quests).
// Positions come from a seeded generator, so every player has the same world.
// ==========================================
import * as THREE from 'three';
import { sfx, mulberry32, WORLD_SEED } from './game/shared.js';
import { createSoftSpriteTexture } from './water.js';
import { scatterSpots } from './spots.js';

export const FLOWERS = [
  { id: 'moondew', name: 'Mondtau', color: 0xbfd4ff },
  { id: 'starcup', name: 'Sternenkelch', color: 0xffe066 },
  { id: 'sunaster', name: 'Sonnenaster', color: 0xff9f43 },
  { id: 'planetbell', name: 'Planetenglöckchen', color: 0xc77dff },
  { id: 'mistrose', name: 'Nebelrose', color: 0xff8fb1 },
  { id: 'crystallotus', name: 'Kristall-Lotus', color: 0x7ff0ff }
];

export const MUSHROOMS = [
  { id: 'glowcap', name: 'Leuchtkappe', color: 0x7dffb0 },
  { id: 'moonpuff', name: 'Mondbovist', color: 0xe8e8ff },
  { id: 'embercap', name: 'Glutpilz', color: 0xff7a4d },
  { id: 'violetbell', name: 'Veilchenglocke', color: 0xb28cff },
  { id: 'starmoss', name: 'Sternenmoos', color: 0xffe680 }
];

// where: pond | lake | river | any; when: night | rain | any; weight = how often it bites
export const FISH = [
  { id: 'koi', name: 'Glückskoi', emoji: '🐟', where: ['pond', 'lake'], when: 'any', weight: 5 },
  { id: 'silver', name: 'Silberlachs', emoji: '🐠', where: ['river', 'lake'], when: 'any', weight: 5 },
  { id: 'golden', name: 'Goldkarpfen', emoji: '🐡', where: ['pond', 'lake', 'river'], when: 'any', weight: 1 },
  { id: 'moonfish', name: 'Mondfisch', emoji: '🌙', where: ['pond', 'lake', 'river'], when: 'night', weight: 4 },
  { id: 'stareel', name: 'Sternenaal', emoji: '🌟', where: ['pond', 'lake'], when: 'night', weight: 1 },
  { id: 'rainbow', name: 'Regenbogenforelle', emoji: '🌈', where: ['pond', 'lake', 'river'], when: 'rain', weight: 5 }
];

const CHEST_COUNT = 6;
const PICK_RADIUS = 1.5;
const CHEST_RADIUS = 2.3;
const BITE_WINDOW = 1.4;

export class Collectibles {
  constructor(game, avoid = []) {
    this.game = game;
    this.group = new THREE.Group();
    this.items = [];
    this.halo = createSoftSpriteTexture();
    this.fish = null;
    this.fishHintShown = false;
    this.buildWorldItems(avoid);
    this.buildAlbum();
    this.buildFishGear();
    game.scene.add(this.group);
  }

  get quests() { return this.game.quests; }

  // ---------- Placement ----------
  buildWorldItems(avoid) {
    const rng = mulberry32(WORLD_SEED ^ 0x7e57);
    const total = CHEST_COUNT + FLOWERS.length * 2 + MUSHROOMS.length * 2;
    const spots = scatterSpots(this.game, rng, total, { minGap: 9, minR: 12, maxR: 88, avoid });
    // Chests get the spots that are furthest apart from the middle of the valley first
    const chestSpots = spots.slice().sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z)).slice(0, CHEST_COUNT);
    const rest = spots.filter(s => !chestSpots.includes(s));
    chestSpots.forEach((s, i) => this.addChest(s, i + 1));
    let k = 0;
    FLOWERS.forEach(f => { for (let i = 0; i < 2; i++) if (rest[k]) this.addFlower(f, rest[k++]); });
    MUSHROOMS.forEach(m => { for (let i = 0; i < 2; i++) if (rest[k]) this.addMushroom(m, rest[k++]); });
  }

  haloSprite(color, scale, opacity = 0.7) {
    const mat = new THREE.SpriteMaterial({ map: this.halo, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity });
    const s = new THREE.Sprite(mat);
    s.scale.setScalar(scale);
    return s;
  }

  addFlower(def, spot) {
    const g = new THREE.Group();
    const y = this.game.getTerrainHeight(spot.x, spot.z);
    g.position.set(spot.x, y, spot.z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.9, 5), new THREE.MeshLambertMaterial({ color: 0x4fbf6a }));
    stem.position.y = 0.45;
    g.add(stem);
    const petalMat = new THREE.MeshLambertMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.55 });
    petalMat.userData.noNightGlow = true;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), petalMat);
      petal.scale.set(0.6, 0.25, 1.2);
      petal.position.set(Math.cos(a) * 0.24, 0.98, Math.sin(a) * 0.24);
      petal.rotation.y = -a;
      g.add(petal);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.0, 0.8) }));
    core.position.y = 1.0;
    g.add(core);
    const glow = this.haloSprite(def.color, 2.6, 0.5);
    glow.position.y = 1.0;
    g.add(glow);
    this.group.add(g);
    this.items.push({ kind: 'flower', def, group: g, glow, key: `flower-${def.id}`, radius: PICK_RADIUS, spot });
  }

  addMushroom(def, spot) {
    const g = new THREE.Group();
    const y = this.game.getTerrainHeight(spot.x, spot.z);
    g.position.set(spot.x, y, spot.z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.5, 8), new THREE.MeshLambertMaterial({ color: 0xf3ead8 }));
    stem.position.y = 0.25;
    g.add(stem);
    const capMat = new THREE.MeshLambertMaterial({ color: def.color, emissive: def.color, emissiveIntensity: 0.6, flatShading: true });
    capMat.userData.noNightGlow = true;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
    cap.position.y = 0.5;
    g.add(cap);
    for (let i = 0; i < 5; i++) {
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      const a = i * 1.26;
      dot.position.set(Math.cos(a) * 0.24, 0.72 - (i % 2) * 0.08, Math.sin(a) * 0.24);
      g.add(dot);
    }
    const glow = this.haloSprite(def.color, 2.2, 0.45);
    glow.position.y = 0.6;
    g.add(glow);
    this.group.add(g);
    this.items.push({ kind: 'mushroom', def, group: g, glow, key: `mush-${def.id}`, radius: PICK_RADIUS, spot });
  }

  addChest(spot, n) {
    const g = new THREE.Group();
    const y = this.game.getTerrainHeight(spot.x, spot.z);
    g.position.set(spot.x, y, spot.z);
    g.rotation.y = (n * 1.7) % 6.28;
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a5b34, flatShading: true });
    const gold = new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.85), wood);
    body.position.y = 0.35;
    body.castShadow = true;
    g.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.14, 0.9), gold);
    band.position.y = 0.5;
    g.add(band);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.71, -0.42);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.2, 12, 1, false, 0, Math.PI), wood);
    lid.rotation.z = Math.PI / 2;
    lid.position.set(0, 0, 0.42);
    lidPivot.add(lid);
    g.add(lidPivot);
    const sparkle = this.haloSprite(new THREE.Color(1.6, 1.3, 0.5), 3.2, 0);
    sparkle.position.y = 0.9;
    g.add(sparkle);
    this.group.add(g);
    this.items.push({ kind: 'chest', group: g, lidPivot, glow: sparkle, key: `c${n}`, quest: 'chests', radius: CHEST_RADIUS, spot, open: 0 });
  }

  // ---------- Per frame ----------
  isFound(it) {
    const q = this.quests;
    if (!q) return false;
    return !!q.state.items[it.kind === 'chest' ? `chests:${it.key}` : `album:${it.key}`];
  }

  update(delta) {
    const g = this.game;
    const pp = g.playerGroup.position;
    const t = g.clock.elapsedTime;
    this.items.forEach(it => {
      const found = this.isFound(it);
      const d = Math.hypot(pp.x - it.spot.x, pp.z - it.spot.z);
      if (it.kind === 'chest') {
        it.open += ((found ? 1 : 0) - it.open) * Math.min(1, delta * 5);
        it.lidPivot.rotation.x = -1.9 * it.open;
        // A faint glimmer draws you in when you are near, and stops once the chest is open
        const near = found ? 0 : Math.max(0, Math.min(1, (28 - d) / 14));
        it.glow.material.opacity = near * (0.35 + Math.sin(t * 3 + it.spot.x) * 0.2);
        if (!found && !g.isDowned && d < it.radius) this.openChest(it);
      } else {
        it.group.visible = !found;
        if (found) return;
        it.glow.material.opacity = 0.35 + Math.sin(t * 2 + it.spot.z) * 0.15;
        it.group.rotation.y += delta * 0.5;
        if (!g.isDowned && d < it.radius && Math.abs(pp.y - it.group.position.y) < 2.2) this.pick(it);
      }
    });
    this.updateFishing(delta);
  }

  openChest(it) {
    const g = this.game;
    if (!this.quests.mark('chests', it.key, 'Versteckte Truhe')) return;
    const p = it.group.position.clone().setY(it.group.position.y + 0.9);
    g.fx.burst(p, [new THREE.Color(2.6, 2.0, 0.6), new THREE.Color(2.2, 1.6, 2.6)], 40, { speed: 4, up: 3, size: 0.4, life: 0.9, gravity: 4 });
    g.fx.flash(p, new THREE.Color(2.4, 1.8, 0.7), 4, 0.4);
    sfx.victory();
    g.progression.addXp(30, 'Truhe');
    g.inventory.addCoins(10);
    g.inventory.add(['wood', 'stone', 'rope', 'glass', 'cloth'][Math.floor(Math.random() * 5)], 2);
    g.addLoot('heart', p);
    for (let i = 0; i < 3; i++) g.addLoot('dust', p);
  }

  pick(it) {
    const g = this.game;
    const label = `${it.def.name} entdeckt`;
    if (!this.quests.mark('album', it.key, label)) return;
    g.fx.burst(it.group.position.clone().setY(it.group.position.y + 1), [new THREE.Color(it.def.color)], 18, { speed: 2.5, up: 1.5, size: 0.3 });
    sfx.collect();
    g.progression.addXp(6);
    g.inventory.addCoins(2);
    this.checkMilestones();
    this.renderAlbum();
  }

  checkMilestones() {
    const q = this.quests;
    const done = (list, prefix) => list.every(x => q.state.items[`album:${prefix}-${x.id}`]);
    const marks = q.state.marks || (q.state.marks = {});
    [['flowers', FLOWERS, 'flower', 'Alle Wunderblumen gefunden!'], ['mushrooms', MUSHROOMS, 'mush', 'Alle Leuchtpilze gefunden!'], ['fish', FISH, 'fish', 'Alle Fische gefangen!']].forEach(([id, list, prefix, text]) => {
      if (!marks[id] && done(list, prefix)) {
        marks[id] = true;
        q.save();
        this.game.showToast(`📖 ${text} +60 XP`, 5000);
        this.game.progression.addXp(60);
      }
    });
  }

  // ---------- Fishing ----------
  buildFishGear() {
    const g = this.game;
    this.bobber = new THREE.Group();
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff4d6d }));
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    cap.position.y = 0.1;
    this.bobber.add(ball, cap);
    this.bobber.visible = false;
    g.scene.add(this.bobber);
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    g.scene.add(this.line);
  }

  // The water spot in front of the player where a cast would land, or null
  findCastSpot() {
    const g = this.game;
    if (g.isSwimming || g.isDowned || g.isGrabbed) return null;
    const pp = g.playerGroup.position;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(g.playerGroup.quaternion);
    for (let d = 1.6; d <= 5.5; d += 0.6) {
      const x = pp.x + fwd.x * d;
      const z = pp.z + fwd.z * d;
      const y = g.getWaterSurface(x, z);
      if (y !== null) return new THREE.Vector3(x + fwd.x * 0.8, y, z + fwd.z * 0.8);
    }
    return null;
  }

  waterKind(pos) {
    if (Math.hypot(pos.x + 4.5, pos.z - 0.5) < 9) return 'pond';
    if (Math.hypot(pos.x + 2, pos.z - 44) < 12) return 'lake';
    return 'river';
  }

  onFishKey() {
    const g = this.game;
    const f = this.fish;
    if (!f) {
      const spot = this.findCastSpot();
      if (!spot) { g.showToast('🎣 Zum Angeln stell dich ans Ufer und schau aufs Wasser (Taste F)', 3000); return; }
      this.startCast(spot);
      return;
    }
    if (f.state === 'wait') { this.endFishing('🎣 Zu früh gezogen – der Fisch ist weg'); return; }
    if (f.state === 'bite') this.catchFish();
  }

  startCast(spot) {
    const g = this.game;
    const rain = g.weather ? g.weather.rain : 0;
    this.fish = { state: 'wait', spot, timer: (2 + Math.random() * 4) * (1 - 0.3 * rain), from: g.playerGroup.position.clone(), t: 0 };
    this.bobber.position.copy(spot);
    this.bobber.visible = true;
    this.line.visible = true;
    sfx.splash();
    g.fx.ringWave(spot.clone(), new THREE.Color(0.8, 1.4, 2.0), 1.6, 0.7);
    g.showToast('🎣 Angel ausgeworfen … warte, bis der Schwimmer taucht, dann F!', 3500);
  }

  updateFishing(delta) {
    const g = this.game;
    const f = this.fish;
    const near = !f && !!this.castSpot;
    if (near && !this.fishHintShown) {
      this.fishHintShown = true;
      g.showToast('🎣 Hier kannst du angeln: Taste F (Handy: runder Aktionsknopf)', 4500);
    }
    if (!f) return;
    const pp = g.playerGroup.position;
    // walking away, jumping or swimming ends the cast
    if (pp.distanceTo(f.from) > 1.8 || g.isSwimming || g.isDowned || g.isGrabbed) { this.endFishing(null); return; }
    f.t += delta;
    const t = g.clock.elapsedTime;
    if (f.state === 'wait') {
      f.timer -= delta;
      this.bobber.position.y = f.spot.y + Math.sin(t * 2.5) * 0.03;
      if (f.timer <= 0) {
        f.state = 'bite';
        f.window = BITE_WINDOW;
        sfx.splash();
        g.showToast('❗ Es beißt! Jetzt F drücken!', 1600);
      }
    } else {
      f.window -= delta;
      this.bobber.position.y = f.spot.y - 0.1 + Math.sin(t * 30) * 0.05;
      if (f.window <= 0) this.endFishing('🎣 Der Fisch ist entwischt');
    }
    const hand = pp.clone().add(new THREE.Vector3(0, 1.4, 0));
    const attr = this.line.geometry.attributes.position;
    attr.setXYZ(0, hand.x, hand.y, hand.z);
    attr.setXYZ(1, this.bobber.position.x, this.bobber.position.y, this.bobber.position.z);
    attr.needsUpdate = true;
  }

  // For the interact key: fishing has priority while a line is out
  getInteraction() {
    const f = this.fish;
    if (f) return { dist: 0, priority: 2, label: f.state === 'bite' ? '❗ Fangen!' : '🎣 Warten …', action: () => this.onFishKey() };
    this.castSpot = this.findCastSpot();
    if (this.castSpot) return { dist: 3.5, label: '🎣 Angeln', action: () => this.onFishKey() };
    return null;
  }

  endFishing(message) {
    this.fish = null;
    this.bobber.visible = false;
    this.line.visible = false;
    if (message) this.game.showToast(message, 2500);
  }

  catchFish() {
    const g = this.game;
    const f = this.fish;
    const kind = this.waterKind(f.spot);
    const night = g.dayNight && g.dayNight.night > 0.5;
    const raining = g.weather && g.weather.rain > 0.4;
    const pool = FISH.filter(x => x.where.includes(kind) && (x.when === 'any' || (x.when === 'night' && night) || (x.when === 'rain' && raining)));
    const totalWeight = pool.reduce((s, x) => s + x.weight, 0);
    let roll = Math.random() * totalWeight;
    let fish = pool[0];
    for (const x of pool) { roll -= x.weight; if (roll <= 0) { fish = x; break; } }
    g.fx.burst(f.spot.clone().setY(f.spot.y + 0.4), [new THREE.Color(1.4, 2.0, 2.6)], 22, { speed: 3, up: 3, size: 0.3, gravity: 6 });
    sfx.collect();
    const isNew = this.quests.mark('album', `fish-${fish.id}`, `${fish.name} gefangen`);
    // the fish that actually swam by the bobber decides the size
    const caught = g.riverFish ? g.riverFish.takeNearest(f.spot) : null;
    const size = caught ? (caught.size - 0.55) / 0.8 : Math.random();
    const item = size < 0.45 ? 'fish_small' : size < 0.8 ? 'fish_medium' : 'fish_large';
    g.inventory.add(item, 1, true);
    const sizeName = item === 'fish_small' ? 'klein' : item === 'fish_medium' ? 'mittel' : 'groß';
    g.showToast(`${fish.emoji} Du fängst: ${fish.name} (${sizeName})!${isNew ? ' Neu im Album.' : ''} Im Inventar (I) kannst du ihn essen.`, 4000);
    g.progression.addXp(isNew ? 20 : 4);
    if (Math.random() < 0.35) g.addLoot('dust', g.playerGroup.position);
    this.endFishing(null);
    if (isNew) { this.checkMilestones(); this.renderAlbum(); }
  }

  // ---------- Album (modal) ----------
  buildAlbum() {
    const modal = document.createElement('div');
    modal.id = 'album-modal';
    modal.className = 'album-modal';
    const card = document.createElement('div');
    card.className = 'album-card';
    modal.appendChild(card);
    modal.addEventListener('click', (e) => { if (e.target === modal) this.toggleAlbum(false); });
    document.body.appendChild(modal);
    this.albumModal = modal;
    this.albumCard = card;
    const btn = document.getElementById('btn-album');
    if (btn) btn.addEventListener('click', () => { this.toggleAlbum(true); btn.blur(); });
  }

  toggleAlbum(open) {
    this.albumModal.classList.toggle('open', open);
    if (open) this.renderAlbum();
  }

  renderAlbum() {
    const q = this.quests;
    if (!q) return;
    const card = this.albumCard;
    card.textContent = '';
    const head = document.createElement('div');
    head.className = 'album-head';
    const title = document.createElement('div');
    title.className = 'album-title';
    title.textContent = `📖 Sammelalbum ${q.progress('album')}/17 · Truhen ${q.progress('chests')}/${CHEST_COUNT}`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'album-close clickable';
    close.textContent = '✕';
    close.addEventListener('click', () => this.toggleAlbum(false));
    head.append(title, close);
    card.appendChild(head);
    const section = (label, list, prefix, symbol) => {
      const h = document.createElement('div');
      h.className = 'album-section';
      h.textContent = label;
      card.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'album-grid';
      list.forEach(x => {
        const found = !!q.state.items[`album:${prefix}-${x.id}`];
        const cell = document.createElement('div');
        cell.className = 'album-cell' + (found ? ' found' : '');
        const em = document.createElement('div');
        em.className = 'album-emoji';
        em.textContent = found ? (x.emoji || symbol) : '❔';
        const nm = document.createElement('div');
        nm.className = 'album-name';
        nm.textContent = found ? x.name : '???';
        cell.append(em, nm);
        if (!found && prefix === 'fish') cell.title = x.when === 'night' ? 'Nur nachts' : x.when === 'rain' ? 'Nur bei Regen' : 'Angeln (Taste F)';
        grid.appendChild(cell);
      });
      card.appendChild(grid);
    };
    section('🌸 Wunderblumen (im Tal versteckt)', FLOWERS, 'flower', '🌸');
    section('🍄 Leuchtpilze', MUSHROOMS, 'mush', '🍄');
    section('🎣 Fische (Taste F am Ufer; manche nur nachts oder bei Regen)', FISH, 'fish', '🐟');
  }
}
