// ==========================================
// PET COMPANION: feed a wild animal its favourite food three times and it becomes your
// companion. It follows you everywhere (even into the enchanted forest), sniffs out hidden
// chests nearby, now and then brings you something it found, and helps you fish (fish bite
// sooner when it sits next to you). Friends in co-op see your pet too.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { createCritterLite, animateCritter } from './critters.js';
import { blinkFace } from './characters.js';
import { ITEMS } from './inventory.js';

const STORAGE_KEY = 'gs-pet-v1';
export const FEEDS_NEEDED = 3;

// species key = `${zone}-${kind}` (see wildlife.js); food = favourite food, names to pick from
export const PET_SPECIES = [
  { key: 'snow-penguin', food: 'fish_small', names: ['Pingo', 'Flitzi', 'Tux'] },
  { key: 'snow-bunny', food: 'apple', names: ['Flocke', 'Schneeball', 'Puschel'] },
  { key: 'snow-fox', food: 'fish_medium', names: ['Frosti', 'Silbi', 'Eiskralle'] },
  { key: 'snow-owl', food: 'berries', names: ['Wolke', 'Huhu', 'Federchen'] },
  { key: 'forest-bunny', food: 'berries', names: ['Funkel', 'Glitzi', 'Lavendel'] },
  { key: 'forest-fox', food: 'fish_small', names: ['Komet', 'Sternchen', 'Saphir'] },
  { key: 'forest-cat', food: 'fish_medium', names: ['Mondi', 'Rosa', 'Schnurri'] },
  { key: 'forest-owl', food: 'apple', names: ['Professorin', 'Nachtfee', 'Uhuli'] },
  { key: 'forest-frog', food: 'berries', names: ['Quakina', 'Minze', 'Hüpfi'] }
];

const FINDS = [['berries', 2], ['apple', 1], ['wood', 2], ['stone', 2], ['rope', 1], ['glass', 1], ['cloth', 1], ['coins', 0]];

function emojiSprite(emoji) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, 32, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  mat.userData.noNightGlow = true;
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(0.7);
  return s;
}

// The look of a species (colours etc. come from the wildlife definitions)
export function buildPetMesh(game, speciesIndex, scale = 0.55) {
  const sp = PET_SPECIES[speciesIndex];
  if (!sp || !game.wildlife) return null;
  const def = game.wildlife.defFor(sp.key);
  if (!def) return null;
  return createCritterLite(def.kind, { scale, colors: def.colors || null, glow: sp.key.startsWith('forest') ? 0.45 : 0.18 });
}

export class Pet {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.mesh = null;
    this.findTimer = 60 + Math.random() * 40;
    this.sniffed = new Set();
    this.hint = emojiSprite('❗');
    this.hint.visible = false;
    game.scene.add(this.hint);
    if (this.state) this.spawn();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const i = PET_SPECIES.findIndex(s => s.key === p.key);
        if (i >= 0) return { key: p.key, name: String(p.name || PET_SPECIES[i].names[0]).slice(0, 16) };
      }
    } catch (e) { /* storage unavailable */ }
    return null;
  }

  save() {
    try {
      if (this.state) localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) { /* ignore */ }
  }

  get active() { return !!this.state; }
  get speciesIndex() { return this.state ? PET_SPECIES.findIndex(s => s.key === this.state.key) : -1; }
  get name() { return this.state ? this.state.name : ''; }

  static species(key) {
    return PET_SPECIES.find(s => s.key === key) || null;
  }

  spawn() {
    const g = this.game;
    if (this.mesh) g.scene.remove(this.mesh);
    this.mesh = buildPetMesh(g, this.speciesIndex);
    if (!this.mesh) return;
    const pp = g.playerGroup.position;
    this.mesh.position.set(pp.x + 1.5, g.getTerrainHeight(pp.x + 1.5, pp.z), pp.z);
    this.mesh.userData.baseY = this.mesh.position.y;
    g.scene.add(this.mesh);
    this.hop = 0;
  }

  // Wildlife calls this when an animal got its favourite food often enough
  adopt(animalKey, name) {
    const g = this.game;
    this.state = { key: animalKey, name };
    this.save();
    this.spawn();
    sfx.victory();
    g.fx.burst(this.mesh.position.clone().setY(this.mesh.position.y + 1), [new THREE.Color(2.4, 0.8, 1.4), new THREE.Color(2.6, 2.0, 0.8)], 50, { speed: 3, up: 3, size: 0.4, gravity: -0.5 });
    g.showToast(`🐾 ${name} möchte dein Begleiter sein! Es folgt dir jetzt überall hin, spürt Truhen auf und hilft beim Angeln.`, 7000);
    g.quests.mark('pet', 0, `${name} ist dein Begleiter`);
    if (g.inventory) g.inventory.render();
  }

  release() {
    const g = this.game;
    if (!this.state) return;
    const name = this.state.name;
    if (this.mesh) g.scene.remove(this.mesh);
    this.mesh = null;
    this.state = null;
    this.hint.visible = false;
    this.save();
    if (g.wildlife) g.wildlife.refreshTamed();
    g.showToast(`🐾 ${name} hüpft zurück zu seinen Freunden. Tschüss!`, 4000);
    if (g.inventory) g.inventory.render();
  }

  pet() {
    const g = this.game;
    const pos = this.mesh.position.clone().setY(this.mesh.position.y + 1);
    g.fx.burst(pos, [new THREE.Color(2.4, 0.8, 1.4)], 16, { speed: 2, up: 2.5, size: 0.35, gravity: -0.5 });
    sfx.playTone(880, 'sine', 0.1, 0.05);
    g.showFloatingText('💗', pos, '#ff8fb1');
  }

  getInteraction() {
    if (!this.mesh) return null;
    const pp = this.game.playerGroup.position;
    const d = Math.hypot(pp.x - this.mesh.position.x, pp.z - this.mesh.position.z);
    return d < 1.8 ? { dist: d + 0.8, label: `💗 ${this.name} streicheln`, action: () => this.pet() } : null;
  }

  // the nearest chest you have not opened yet (within a short distance)
  nearestChest(range = 22) {
    const col = this.game.collectibles;
    if (!col) return null;
    const pp = this.game.playerGroup.position;
    let best = null;
    let bd = range;
    col.items.forEach(it => {
      if (it.kind !== 'chest' || col.isFound(it)) return;
      const d = Math.hypot(it.spot.x - pp.x, it.spot.z - pp.z);
      if (d < bd) { bd = d; best = it; }
    });
    return best;
  }

  bringFind() {
    const g = this.game;
    const [id, n] = FINDS[Math.floor(Math.random() * FINDS.length)];
    const pos = this.mesh.position.clone().setY(this.mesh.position.y + 1);
    g.fx.burst(pos, [new THREE.Color(2.6, 2.0, 0.6)], 20, { speed: 2.5, up: 2, size: 0.3, gravity: 3 });
    if (id === 'coins') {
      const c = 3 + Math.floor(Math.random() * 6);
      g.inventory.addCoins(c, this.name);
      g.showToast(`🐾 ${this.name} hat ${c} Sterntaler im Gras gefunden!`, 3500);
    } else {
      g.inventory.add(id, n, true);
      g.showToast(`🐾 ${this.name} bringt dir ${n}× ${ITEMS[id].icon} ${ITEMS[id].name}!`, 3500);
    }
    sfx.collect();
  }

  update(delta) {
    const g = this.game;
    if (!this.mesh) return;
    const m = this.mesh;
    const pp = g.playerGroup.position;
    const t = g.clock.elapsedTime;
    const dx = pp.x - m.position.x;
    const dz = pp.z - m.position.z;
    const d = Math.hypot(dx, dz);
    // left behind (travel, teleport, respawn) or stuck behind something: pop up next to you
    if (d > 24 || (pp.x > 300) !== (m.position.x > 300) || (pp.x < -300) !== (m.position.x < -300) || this.stuck > 1.2) {
      this.stuck = 0;
      const ry = g.playerGroup.rotation.y;
      const x = pp.x - Math.sin(ry) * 1.6 + Math.cos(ry) * 0.8;
      const z = pp.z - Math.cos(ry) * 1.6 - Math.sin(ry) * 0.8;
      m.position.set(x, Math.max(g.getTerrainHeight(x, z), pp.y), z);
      g.fx.burst(m.position.clone().setY(m.position.y + 0.6), [new THREE.Color(2.0, 1.6, 2.6)], 12, { speed: 2, up: 1.5, size: 0.3 });
      return;
    }
    // a chest nearby: run to it and wave the ❗
    const chest = this.nearestChest();
    let tx = pp.x;
    let tz = pp.z;
    let stop = 2.0;
    if (chest) {
      tx = chest.spot.x;
      tz = chest.spot.z;
      stop = 1.4;
      if (!this.sniffed.has(chest.key)) {
        this.sniffed.add(chest.key);
        g.showToast(`🐾 ${this.name} schnüffelt aufgeregt – hier in der Nähe ist eine versteckte Truhe!`, 4000);
        sfx.playTone(990, 'triangle', 0.12, 0.05);
      }
    }
    const tdx = tx - m.position.x;
    const tdz = tz - m.position.z;
    const td = Math.hypot(tdx, tdz);
    let moving = false;
    if (td > stop) {
      const speed = Math.min(9, 2.5 + td * 0.9);
      const step = Math.min(td - stop, speed * delta);
      // straight ahead, or slip around an obstacle to the left or right
      const base = Math.atan2(tdx, tdz);
      for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
        const nx = m.position.x + Math.sin(base + turn) * step;
        const nz = m.position.z + Math.cos(base + turn) * step;
        if (!g.checkWallCollision(nx, nz, 0.3, m.position.y)) {
          m.position.x = nx;
          m.position.z = nz;
          moving = true;
          break;
        }
      }
      this.stuck = moving ? 0 : (this.stuck || 0) + delta;
      const want = Math.atan2(tdx, tdz);
      m.rotation.y += Math.atan2(Math.sin(want - m.rotation.y), Math.cos(want - m.rotation.y)) * Math.min(1, delta * 8);
    } else {
      const want = Math.atan2(dx, dz);
      m.rotation.y += Math.atan2(Math.sin(want - m.rotation.y), Math.cos(want - m.rotation.y)) * Math.min(1, delta * 3);
    }
    // stand on the ground, or on whatever the player stands on (house floors, platforms)
    const ground = g.getTerrainHeight(m.position.x, m.position.z);
    const floor = d < 4 && pp.y > ground ? pp.y : ground;
    this.hop = moving ? this.hop + delta * 11 : 0;
    m.position.y += (floor + Math.abs(Math.sin(this.hop)) * 0.25 - m.position.y) * Math.min(1, delta * 12);
    m.userData.baseY = m.position.y;
    if (!moving) animateCritter(m, t, 1.3);
    blinkFace(m.userData.face, t);

    this.hint.visible = !!chest && td < 3;
    if (this.hint.visible) this.hint.position.set(m.position.x, m.position.y + 1.6 + Math.sin(t * 6) * 0.1, m.position.z);

    this.findTimer -= delta;
    if (this.findTimer <= 0) {
      this.findTimer = 70 + Math.random() * 50;
      if (!g.isDowned) this.bringFind();
    }
  }
}
