// ==========================================
// WORLD MAP (key M / map button): a painted top-down map of each world - the valley with the
// snow biome, the enchanted forest and the star castle - with the important places, your open
// goals (the same ones the compass shows), your friends, your pet and yourself.
// Hidden chests stay hidden until you found them.
// ==========================================
import { LANDMARKS } from './spots.js';
import { snowAt } from './biome.js';
import { FOREST, FOREST_ARENA, CASTLE_PORTAL } from './forest.js';
import { CASTLE } from './castle.js';
import { SISTER_ICONS } from './remote.js';

const SIZE = 512;
const RES = 128;

const WORLDS = [
  { id: 'valley', name: '🏔️ Himmelsgebirge', min: { x: -100, z: -100 }, max: { x: 100, z: 100 } },
  { id: 'forest', name: '🌲 Zauberwald', min: { x: FOREST.x - 70, z: FOREST.z - 70 }, max: { x: FOREST.x + 70, z: FOREST.z + 70 } },
  { id: 'castle', name: '🏰 Sternenschloss', min: { x: CASTLE.x - 58, z: CASTLE.z - 58 }, max: { x: CASTLE.x + 58, z: CASTLE.z + 58 } }
];

export class WorldMap {
  constructor(game) {
    this.game = game;
    this.base = {};
    this.world = 'valley';
    this.refresh = 0;
    this.buildUI();
  }

  worldOf(x) {
    return x > 300 ? 'forest' : x < -300 ? 'castle' : 'valley';
  }

  available(id) {
    const g = this.game;
    if (id === 'valley') return true;
    if (id === 'forest') return g.forest.unlocked || this.worldOf(g.playerGroup.position.x) === 'forest';
    return g.castle.unlocked || this.worldOf(g.playerGroup.position.x) === 'castle';
  }

  // ---------- UI ----------
  buildUI() {
    const modal = document.createElement('div');
    modal.id = 'map-modal';
    modal.className = 'album-modal map-modal';
    const card = document.createElement('div');
    card.className = 'album-card map-card';
    modal.appendChild(card);
    modal.addEventListener('click', (e) => { if (e.target === modal) this.toggle(false); });
    const head = document.createElement('div');
    head.className = 'album-head';
    const title = document.createElement('div');
    title.className = 'album-title';
    title.textContent = '🗺️ Weltkarte';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'album-close clickable';
    close.textContent = '✕';
    close.addEventListener('click', () => this.toggle(false));
    head.append(title, close);
    this.tabs = document.createElement('div');
    this.tabs.className = 'inv-tabs';
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    this.canvas.className = 'map-canvas';
    this.legend = document.createElement('div');
    this.legend.className = 'map-legend';
    card.append(head, this.tabs, this.canvas, this.legend);
    document.body.appendChild(modal);
    this.modal = modal;
    const btn = document.getElementById('btn-map');
    if (btn) btn.addEventListener('click', () => { this.toggle(); btn.blur(); });
  }

  get isOpen() {
    return this.modal.classList.contains('open');
  }

  toggle(open = !this.isOpen) {
    if (open) this.world = this.worldOf(this.game.playerGroup.position.x);
    this.modal.classList.toggle('open', open);
    if (open) this.render();
  }

  renderTabs() {
    this.tabs.textContent = '';
    WORLDS.forEach(w => {
      const b = document.createElement('button');
      b.type = 'button';
      const ok = this.available(w.id);
      b.className = `inv-tab clickable${this.world === w.id ? ' active' : ''}`;
      b.textContent = ok ? w.name : `🔒 ${w.name.slice(w.name.indexOf(' ') + 1)}`;
      b.disabled = !ok;
      b.addEventListener('click', () => { this.world = w.id; this.render(); });
      this.tabs.appendChild(b);
    });
  }

  // ---------- Painting ----------
  toCanvas(w, x, z) {
    return {
      x: ((x - w.min.x) / (w.max.x - w.min.x)) * SIZE,
      y: ((z - w.min.z) / (w.max.z - w.min.z)) * SIZE
    };
  }

  // The ground of a world, painted once from the real terrain
  baseImage(w) {
    if (this.base[w.id]) return this.base[w.id];
    const g = this.game;
    const c = document.createElement('canvas');
    c.width = c.height = RES;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(RES, RES);
    for (let j = 0; j < RES; j++) {
      for (let i = 0; i < RES; i++) {
        const x = w.min.x + ((i + 0.5) / RES) * (w.max.x - w.min.x);
        const z = w.min.z + ((j + 0.5) / RES) * (w.max.z - w.min.z);
        const h = g.getTerrainHeight(x, z);
        let col;
        if (w.id === 'valley') {
          if (Math.hypot(x, z) > 96 && h < 4) col = [250, 226, 240]; // the cloud sea around the mountains
          else if (g.getWaterSurface(x, z) !== null) col = [90, 170, 235];
          else if (h > 14) { const k = Math.min(1, (h - 14) / 30); col = [130 + k * 100, 118 + k * 105, 150 + k * 90]; }
          else if (snowAt(x, z) > 0.5) col = [240, 246, 255];
          else { const k = Math.min(1, h / 12); col = [120 + k * 40, 196 - k * 30, 110 - k * 20]; }
        } else if (w.id === 'forest') {
          const r = Math.hypot(x - FOREST.x, z - FOREST.z);
          col = r > FOREST.r + 4 ? [200, 170, 225] : [70 + h - 22, 70, 110];
        } else {
          const r = Math.hypot(x - CASTLE.x, z - CASTLE.z);
          col = r > CASTLE.r ? [255, 220, 235] : r < 33 ? [238, 228, 255] : [170, 215, 120];
        }
        img.data.set([col[0], col[1], col[2], 255], (j * RES + i) * 4);
      }
    }
    ctx.putImageData(img, 0, 0);
    this.base[w.id] = c;
    return c;
  }

  places(w) {
    const g = this.game;
    const out = [];
    const add = (x, z, icon, label) => out.push({ x, z, icon, label });
    if (w.id === 'valley') {
      add(0, 8, '⭐', 'Start');
      add(22, -20, '🏛️', 'Tempel');
      add(-14, -8, '🛖', 'Dorf');
      add(g.market.center.x, g.market.center.z, '🛒', 'Markt');
      g.houses.houses.forEach(h => add(h.x, h.z, h.own ? '🏡' : '🏠', h.own ? h.name : ''));
      if (!g.houses.view.built) add(g.houses.plot.x, g.houses.plot.z, '🏗️', 'Bauplatz');
      add(g.houses.area.x, g.houses.area.z, '🧱', 'Bauland');
      add(g.stargate.center.x, g.stargate.center.z, '⭐', 'Sternen-Tor');
      add(g.shrine.center.x, g.shrine.center.z, '🔮', 'Schrein');
      add(32, 30, '👾', 'Vortox-Arena');
      add(g.glaciel.center.x, g.glaciel.center.z, '❄️', 'Glaciel');
      add(g.challenges.spiral.x, g.challenges.spiral.z, '🧗', 'Frost-Spirale');
      add(g.challenges.glacier.x, g.challenges.glacier.z, '🧊', 'Gletscher-Sprünge');
      add(g.forest.portal.x, g.forest.portal.z, '🌀', 'Zauberwald-Portal');
      const obby = LANDMARKS[3];
      add(obby.x, obby.z, '🪜', 'Obby');
      g.collectibles.items.forEach(it => { if (it.kind === 'chest' && g.collectibles.isFound(it)) add(it.spot.x, it.spot.z, '🧰', ''); });
      g.npcs.list.forEach(n => add(n.x, n.z, '💬', ''));
    } else if (w.id === 'forest') {
      add(FOREST.x, FOREST.z, '💜', 'Herz des Waldes');
      add(FOREST_ARENA.x, FOREST_ARENA.z, '🦋', 'Morvantas Lichtung');
      add(g.forest.returnGate.x, g.forest.returnGate.z, '🌀', 'Rückweg');
      add(g.forest.guideSpot.x, g.forest.guideSpot.z, '🦉', 'Waldeule');
      add(g.challenges.lanternSpot.x, g.challenges.lanternSpot.z, '🏮', 'Laternen-Rätsel');
      if (g.castle.unlocked) add(CASTLE_PORTAL.x, CASTLE_PORTAL.z, '🏰', 'Sternenportal');
      g.forest.stones.forEach((s, i) => { if (!g.forest.state.stones.includes(i)) add(s.x, s.z, '💠', 'Mondstein'); });
    } else {
      add(CASTLE.x, CASTLE.z, '👑', 'Thronhof');
      add(CASTLE.x, CASTLE.z - 27, '🏰', 'Burg');
      add(g.castle.returnPortal.x, g.castle.returnPortal.z, '🌀', 'Rückweg');
      g.castle.seals.forEach((s, i) => add(s.x, s.z, ['🌙', '⭐', '☀️', '🪐'][i], ''));
    }
    return out;
  }

  render() {
    const g = this.game;
    this.renderTabs();
    const w = WORLDS.find(x => x.id === this.world);
    const ctx = this.canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.baseImage(w), 0, 0, SIZE, SIZE);
    // outlines
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(80, 40, 120, 0.55)';
    const circle = (x, z, r, color, fill) => {
      const p = this.toCanvas(w, x, z);
      const pr = (r / (w.max.x - w.min.x)) * SIZE;
      ctx.beginPath();
      ctx.arc(p.x, p.y, pr, 0, Math.PI * 2);
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.strokeStyle = color;
      ctx.stroke();
    };
    if (w.id === 'valley') {
      circle(32, 30, 19, 'rgba(90, 170, 255, 0.9)');
      circle(g.glaciel.center.x, g.glaciel.center.z, 14, 'rgba(90, 170, 255, 0.9)');
    } else if (w.id === 'forest') {
      ctx.fillStyle = 'rgba(200, 120, 255, 0.55)';
      g.forest.treeSpots.forEach(t => { const p = this.toCanvas(w, t.x, t.z); ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill(); });
      circle(FOREST_ARENA.x, FOREST_ARENA.z, FOREST_ARENA.r, 'rgba(255, 120, 230, 0.9)', 'rgba(255, 160, 240, 0.25)');
    } else {
      circle(CASTLE.x, CASTLE.z, 34, 'rgba(255, 255, 255, 0.95)');
      circle(CASTLE.x, CASTLE.z, 20, 'rgba(255, 200, 90, 0.95)', 'rgba(255, 220, 140, 0.35)');
    }
    // places
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    this.places(w).forEach(pl => {
      const p = this.toCanvas(w, pl.x, pl.z);
      ctx.font = '20px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
      ctx.fillText(pl.icon, p.x, p.y);
      if (pl.label) {
        ctx.font = '700 10px "Segoe UI", sans-serif';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(30, 15, 50, 0.85)';
        ctx.strokeText(pl.label, p.x, p.y + 15);
        ctx.fillStyle = '#fff';
        ctx.fillText(pl.label, p.x, p.y + 15);
      }
    });
    // open goals (same as the compass)
    let goals = [];
    try { goals = g.compass.getTargets ? g.compass.getTargets() : []; } catch (e) { goals = []; }
    goals.filter(t => this.worldOf(t.x) === w.id && !String(t.id).startsWith('friend:')).forEach(t => {
      const p = this.toCanvas(w, t.x, t.z);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 220, 90, 0.95)';
      ctx.lineWidth = 3;
      ctx.stroke();
    });
    // friends, pet, me
    g.remotes.list.forEach(r => {
      if (!r.hasState || this.worldOf(r.group.position.x) !== w.id) return;
      const p = this.toCanvas(w, r.group.position.x, r.group.position.z);
      ctx.font = '22px "Segoe UI Emoji", sans-serif';
      ctx.fillText(SISTER_ICONS[r.sister] || '⭐', p.x, p.y);
    });
    if (g.pet && g.pet.mesh && this.worldOf(g.pet.mesh.position.x) === w.id) {
      const p = this.toCanvas(w, g.pet.mesh.position.x, g.pet.mesh.position.z);
      ctx.font = '16px "Segoe UI Emoji", sans-serif';
      ctx.fillText('🐾', p.x, p.y);
    }
    const pp = g.playerGroup.position;
    if (this.worldOf(pp.x) === w.id) {
      const p = this.toCanvas(w, pp.x, pp.z);
      const ry = g.playerGroup.rotation.y;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(-ry + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, -13);
      ctx.lineTo(9, 9);
      ctx.lineTo(0, 4);
      ctx.lineTo(-9, 9);
      ctx.closePath();
      ctx.fillStyle = '#ff5fa2';
      ctx.fill();
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#fff';
      ctx.stroke();
      ctx.restore();
    }
    this.legend.textContent = '▲ Du · 🐾 Begleiter · ◯ offene Ziele (wie im Kompass) · 🧰 gefundene Truhen';
  }

  update(delta) {
    if (!this.isOpen) return;
    this.refresh -= delta;
    if (this.refresh <= 0) {
      this.refresh = 0.4;
      this.render();
    }
  }
}
