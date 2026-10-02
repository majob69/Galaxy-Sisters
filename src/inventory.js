// ==========================================
// INVENTORY (key I / bag button): food and materials, plus the star coins (Sterntaler).
// Food is eaten from here and heals; materials are for building, puzzles and gifts.
// Saved in localStorage.
// ==========================================
import { sfx } from './game/shared.js';

const STORAGE_KEY = 'gs-inventory-v1';

export const ITEMS = {
  // food
  apple: { name: 'Apfel', icon: '🍎', kind: 'food', heal: 15, price: 3 },
  bread: { name: 'Brot', icon: '🍞', kind: 'food', heal: 25, price: 5 },
  berries: { name: 'Sternbeeren', icon: '🫐', kind: 'food', heal: 12, price: 2 },
  soup: { name: 'Kürbissuppe', icon: '🥣', kind: 'food', heal: 40, price: 9 },
  cake: { name: 'Mondkuchen', icon: '🍰', kind: 'food', heal: 60, price: 14 },
  fish_small: { name: 'Kleiner Fisch', icon: '🐟', kind: 'food', heal: 20, price: 0 },
  fish_medium: { name: 'Fisch', icon: '🐠', kind: 'food', heal: 30, price: 0 },
  fish_large: { name: 'Großer Fisch', icon: '🐡', kind: 'food', heal: 45, price: 0 },
  // materials
  wood: { name: 'Holz', icon: '🪵', kind: 'material', price: 4 },
  stone: { name: 'Stein', icon: '🪨', kind: 'material', price: 4 },
  glass: { name: 'Glas', icon: '🔷', kind: 'material', price: 7 },
  rope: { name: 'Seil', icon: '🪢', kind: 'material', price: 5 },
  cloth: { name: 'Stoff', icon: '🧵', kind: 'material', price: 6 },
  // puzzle helpers
  weight: { name: 'Sternen-Gewicht', icon: '⚖️', kind: 'tool', price: 12, desc: 'Leg es auf eine Platte des Sternen-Tors – sie bleibt gedrückt.' },
  candle: { name: 'Elementkerze', icon: '🕯️', kind: 'tool', price: 10, desc: 'Entzündet am Elemente-Schrein den nächsten Altar für 15 Sekunden.' },
  lantern: { name: 'Frostlaterne', icon: '🏮', kind: 'tool', price: 8, desc: 'Schützt eine Weile vor Glaciels Frost (nicht langsamer).' }
};

export class Inventory {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.buildUI();
    this.renderCoins();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const items = {};
        Object.keys(p.items || {}).forEach(k => {
          const n = Math.floor(Number(p.items[k]));
          if (ITEMS[k] && n > 0) items[k] = Math.min(999, n);
        });
        return { items, coins: Math.max(0, Math.min(1e6, Math.floor(Number(p.coins) || 0))) };
      }
    } catch (e) { /* storage unavailable */ }
    return { items: {}, coins: 0 };
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  count(id) {
    return this.state.items[id] || 0;
  }

  add(id, n = 1, quiet = false) {
    if (!ITEMS[id] || n <= 0) return;
    this.state.items[id] = Math.min(999, this.count(id) + n);
    this.save();
    if (!quiet) {
      const it = ITEMS[id];
      const g = this.game;
      g.showFloatingText(`+${n} ${it.icon} ${it.name}`, g.playerGroup.position.clone().setY(g.playerGroup.position.y + 1.2), '#ffe9a8');
    }
    this.render();
  }

  remove(id, n = 1) {
    if (this.count(id) < n) return false;
    this.state.items[id] -= n;
    if (this.state.items[id] <= 0) delete this.state.items[id];
    this.save();
    this.render();
    return true;
  }

  // ---------- Star coins ----------
  get coins() { return this.state.coins; }

  addCoins(n, why) {
    if (n <= 0) return;
    this.state.coins += n;
    this.save();
    this.renderCoins();
    const g = this.game;
    g.showFloatingText(`+${n} 🪙${why ? ' ' + why : ''}`, g.playerGroup.position.clone().setY(g.playerGroup.position.y + 1.6), '#ffd166');
    sfx.collect();
  }

  spendCoins(n) {
    if (this.state.coins < n) return false;
    this.state.coins -= n;
    this.save();
    this.renderCoins();
    return true;
  }

  renderCoins() {
    const el = document.getElementById('coin-badge');
    if (el) el.textContent = `🪙 ${this.state.coins}`;
  }

  // ---------- Using things ----------
  use(id) {
    const g = this.game;
    const it = ITEMS[id];
    if (!it || this.count(id) <= 0) return;
    if (it.kind === 'food') {
      if (g.isDowned) return;
      if (g.playerHP >= g.maxPlayerHP) { g.showToast('Du bist schon ganz satt und gesund 💚', 2500); return; }
      this.remove(id, 1);
      g.playerHP = Math.min(g.maxPlayerHP, g.playerHP + it.heal);
      g.updateHPBar();
      g.createHealParticles(g.playerGroup.position);
      sfx.heal();
      g.showFloatingText(`${it.icon} +${it.heal} HP`, g.playerGroup.position, '#7dffb0');
    } else if (it.kind === 'tool') {
      if (g.useTool && g.useTool(id)) this.remove(id, 1);
    } else {
      g.showToast(`${it.icon} ${it.name}: zum Bauen und Verschenken`, 2500);
    }
  }

  // ---------- UI ----------
  buildUI() {
    const modal = document.createElement('div');
    modal.id = 'inventory-modal';
    modal.className = 'album-modal inventory-modal';
    const card = document.createElement('div');
    card.className = 'album-card';
    modal.appendChild(card);
    modal.addEventListener('click', (e) => { if (e.target === modal) this.toggle(false); });
    document.body.appendChild(modal);
    this.modal = modal;
    this.card = card;
    const btn = document.getElementById('btn-inventory');
    if (btn) btn.addEventListener('click', () => { this.toggle(); btn.blur(); });
  }

  get isOpen() {
    return this.modal.classList.contains('open');
  }

  toggle(open = !this.isOpen) {
    this.modal.classList.toggle('open', open);
    if (open) this.render();
  }

  render() {
    if (!this.isOpen) return;
    const card = this.card;
    card.textContent = '';
    const head = document.createElement('div');
    head.className = 'album-head';
    const title = document.createElement('div');
    title.className = 'album-title';
    title.textContent = `🎒 Inventar · 🪙 ${this.state.coins} Sterntaler`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'album-close clickable';
    close.textContent = '✕';
    close.addEventListener('click', () => this.toggle(false));
    head.append(title, close);
    card.appendChild(head);

    const groups = [['food', '🍎 Essen (antippen zum Essen)'], ['tool', '🧩 Rätsel-Helfer (antippen zum Benutzen)'], ['material', '🪵 Materialien']];
    let any = false;
    groups.forEach(([kind, label]) => {
      const ids = Object.keys(this.state.items).filter(id => ITEMS[id].kind === kind);
      if (!ids.length) return;
      any = true;
      const h = document.createElement('div');
      h.className = 'album-section';
      h.textContent = label;
      card.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'album-grid';
      ids.forEach(id => {
        const it = ITEMS[id];
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'album-cell found inv-cell clickable';
        const em = document.createElement('div');
        em.className = 'album-emoji';
        em.textContent = it.icon;
        const nm = document.createElement('div');
        nm.className = 'album-name';
        nm.textContent = `${it.name} ×${this.count(id)}`;
        cell.append(em, nm);
        if (it.kind === 'food') cell.title = `+${it.heal} HP`;
        if (it.desc) cell.title = it.desc;
        cell.addEventListener('click', () => this.use(id));
        if (this.game.coop && this.game.coop.active && this.game.remotes.list.length) {
          const gift = document.createElement('div');
          gift.className = 'inv-gift';
          gift.textContent = '🎁 verschenken';
          gift.addEventListener('click', (e) => { e.stopPropagation(); this.game.coop.openGift(id); });
          cell.appendChild(gift);
        }
        grid.appendChild(cell);
      });
      card.appendChild(grid);
    });
    if (!any) {
      const empty = document.createElement('div');
      empty.className = 'album-section';
      empty.textContent = 'Noch leer – pflücke Äpfel (F am Apfelbaum), angle Fische oder kaufe etwas an den Ständen.';
      card.appendChild(empty);
    }
  }
}
