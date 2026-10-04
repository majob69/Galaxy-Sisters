// ==========================================
// INVENTORY (key I / bag button): food, materials, furniture and puzzle helpers, plus the
// star coins (Sterntaler). Three tabs:
//   🎒 Tasche     eat food, use helpers, place furniture
//   🔨 Werkbank   craft furniture (chairs, doors, lamps ...) from materials
//   🍳 Kochen     combine two foods into a dish that heals as much as both together -
//                 but only some combinations work (found recipes are remembered)
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
  // cooked dishes (heal is filled in from the two ingredients, see FOOD_RECIPES)
  fruit_salad: { name: 'Obstsalat', icon: '🥗', kind: 'food', heal: 0, price: 0 },
  apple_pastry: { name: 'Apfeltasche', icon: '🥐', kind: 'food', heal: 0, price: 0 },
  fish_sandwich: { name: 'Fischbrötchen', icon: '🥪', kind: 'food', heal: 0, price: 0 },
  bread_soup: { name: 'Suppe mit Brot', icon: '🍲', kind: 'food', heal: 0, price: 0 },
  fish_soup: { name: 'Fischsuppe', icon: '🍜', kind: 'food', heal: 0, price: 0 },
  berry_cake: { name: 'Beerentorte', icon: '🎂', kind: 'food', heal: 0, price: 0 },
  apple_cake: { name: 'Apfelkuchen', icon: '🥧', kind: 'food', heal: 0, price: 0 },
  fish_feast: { name: 'Fischplatte', icon: '🍱', kind: 'food', heal: 0, price: 0 },
  // materials
  wood: { name: 'Holz', icon: '🪵', kind: 'material', price: 4 },
  stone: { name: 'Stein', icon: '🪨', kind: 'material', price: 4 },
  glass: { name: 'Glas', icon: '🔷', kind: 'material', price: 7 },
  rope: { name: 'Seil', icon: '🪢', kind: 'material', price: 5 },
  cloth: { name: 'Stoff', icon: '🧵', kind: 'material', price: 6 },
  // furniture: bought at the building stall or crafted at the workbench, placed in your house or on the building land
  chair: { name: 'Stuhl', icon: '🪑', kind: 'furniture', price: 12, recipe: { wood: 2, rope: 1 } },
  table: { name: 'Tisch', icon: '🟫', kind: 'furniture', price: 16, recipe: { wood: 3, stone: 1 } },
  door: { name: 'Tür', icon: '🚪', kind: 'furniture', price: 18, recipe: { wood: 3, rope: 1 } },
  lamp: { name: 'Lampe', icon: '💡', kind: 'furniture', price: 14, recipe: { glass: 1, rope: 1, stone: 1 } },
  shelf: { name: 'Regal', icon: '📚', kind: 'furniture', price: 15, recipe: { wood: 4 } },
  plant: { name: 'Blumentopf', icon: '🪴', kind: 'furniture', price: 8, recipe: { stone: 2 } },
  sofa: { name: 'Sofa', icon: '🛋️', kind: 'furniture', price: 22, recipe: { wood: 2, cloth: 3 } },
  picture: { name: 'Bild', icon: '🖼️', kind: 'furniture', price: 10, recipe: { wood: 1, cloth: 1 } },
  // puzzle helpers
  weight: { name: 'Sternen-Gewicht', icon: '⚖️', kind: 'tool', price: 12, desc: 'Leg es auf eine Platte des Sternen-Tors – sie bleibt gedrückt.' },
  candle: { name: 'Elementkerze', icon: '🕯️', kind: 'tool', price: 10, desc: 'Entzündet am Elemente-Schrein den nächsten Altar für 15 Sekunden.' },
  lantern: { name: 'Frostlaterne', icon: '🏮', kind: 'tool', price: 8, desc: 'Schützt eine Weile vor Glaciels Frost (nicht langsamer).' }
};

export const FURNITURE = Object.keys(ITEMS).filter(id => ITEMS[id].kind === 'furniture');

// Only these pairs can be cooked together; the dish heals as much as both ingredients
export const FOOD_RECIPES = [
  { a: 'apple', b: 'berries', out: 'fruit_salad' },
  { a: 'apple', b: 'bread', out: 'apple_pastry' },
  { a: 'bread', b: 'fish_small', out: 'fish_sandwich' },
  { a: 'bread', b: 'soup', out: 'bread_soup' },
  { a: 'fish_medium', b: 'soup', out: 'fish_soup' },
  { a: 'berries', b: 'cake', out: 'berry_cake' },
  { a: 'apple', b: 'cake', out: 'apple_cake' },
  { a: 'bread', b: 'fish_large', out: 'fish_feast' }
];
FOOD_RECIPES.forEach(r => { ITEMS[r.out].heal = ITEMS[r.a].heal + ITEMS[r.b].heal; });

export function findFoodRecipe(a, b) {
  return FOOD_RECIPES.find(r => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || null;
}

export function recipeText(recipe) {
  return Object.keys(recipe).map(id => `${recipe[id]} ${ITEMS[id].icon}`).join(' + ');
}

export class Inventory {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.tab = 'bag';
    this.cook = [null, null];
    this.buildUI();
    this.renderCoins();
    if (game.quests) this.state.recipes.forEach(id => game.quests.markQuiet('cook', id));
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
        const recipes = Array.isArray(p.recipes) ? p.recipes.filter(id => FOOD_RECIPES.some(r => r.out === id)) : [];
        return { items, coins: Math.max(0, Math.min(1e6, Math.floor(Number(p.coins) || 0))), recipes };
      }
    } catch (e) { /* storage unavailable */ }
    return { items: {}, coins: 0, recipes: [] };
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  count(id) {
    return this.state.items[id] || 0;
  }

  has(cost) {
    return Object.keys(cost).every(id => this.count(id) >= cost[id]);
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
    } else if (it.kind === 'furniture') {
      if (g.houses && g.houses.placeFurniture(id)) {
        this.remove(id, 1);
        this.toggle(false);
      }
    } else {
      g.showToast(`${it.icon} ${it.name}: zum Bauen, Basteln an der Werkbank und Verschenken`, 2500);
    }
  }

  // ---------- Workbench: furniture from materials ----------
  craft(id) {
    const g = this.game;
    const it = ITEMS[id];
    if (!it || !it.recipe) return false;
    if (!this.has(it.recipe)) {
      g.showToast(`🔨 Für ${it.icon} ${it.name} brauchst du ${recipeText(it.recipe)}.`, 3500);
      return false;
    }
    Object.keys(it.recipe).forEach(m => { this.state.items[m] -= it.recipe[m]; if (this.state.items[m] <= 0) delete this.state.items[m]; });
    this.state.items[id] = Math.min(999, this.count(id) + 1);
    this.save();
    sfx.collect();
    g.showToast(`🔨 ${it.icon} ${it.name} gebaut! Antippen in der Tasche stellt es auf.`, 3000);
    if (g.progression) g.progression.addXp(5, 'Gebastelt');
    this.render();
    return true;
  }

  // ---------- Cooking: two foods into one dish ----------
  pickCook(id) {
    if (this.cook[0] === null) this.cook[0] = id;
    else if (this.cook[1] === null) this.cook[1] = id;
    else this.cook = [id, null];
    this.render();
  }

  cookNow() {
    const g = this.game;
    const [a, b] = this.cook;
    if (!a || !b) { g.showToast('🍳 Lege zwei Lebensmittel in die Pfanne.', 2500); return null; }
    const need = a === b ? { [a]: 2 } : { [a]: 1, [b]: 1 };
    if (!this.has(need)) { g.showToast('🍳 Davon hast du nicht genug.', 2500); return null; }
    const r = findFoodRecipe(a, b);
    if (!r) {
      g.showToast(`🍳 ${ITEMS[a].icon} und ${ITEMS[b].icon} passen nicht zusammen – probier eine andere Mischung!`, 3500);
      sfx.playTone(220, 'triangle', 0.15, 0.06);
      this.cook = [null, null];
      this.render();
      return null;
    }
    Object.keys(need).forEach(id => { this.state.items[id] -= need[id]; if (this.state.items[id] <= 0) delete this.state.items[id]; });
    this.state.items[r.out] = Math.min(999, this.count(r.out) + 1);
    const isNew = !this.state.recipes.includes(r.out);
    if (isNew) this.state.recipes.push(r.out);
    this.save();
    sfx.heal();
    const out = ITEMS[r.out];
    g.showToast(`🍳 ${out.icon} ${out.name} gekocht! Heilt +${out.heal} HP.${isNew ? ' Neues Rezept entdeckt!' : ''}`, 3500);
    if (isNew && g.progression) g.progression.addXp(15, 'Rezept');
    if (g.quests) g.quests.mark('cook', r.out, `Rezept: ${out.name}`);
    this.cook = [null, null];
    this.render();
    return r.out;
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

  toggle(open = !this.isOpen, tab = null) {
    if (tab) this.tab = tab;
    this.modal.classList.toggle('open', open);
    if (open) this.render();
  }

  cell(icon, name, onClick, extraClass = '') {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `album-cell found inv-cell clickable ${extraClass}`;
    const em = document.createElement('div');
    em.className = 'album-emoji';
    em.textContent = icon;
    const nm = document.createElement('div');
    nm.className = 'album-name';
    nm.textContent = name;
    cell.append(em, nm);
    if (onClick) cell.addEventListener('click', onClick);
    return cell;
  }

  section(label) {
    const h = document.createElement('div');
    h.className = 'album-section';
    h.textContent = label;
    this.card.appendChild(h);
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

    const tabs = document.createElement('div');
    tabs.className = 'inv-tabs';
    [['bag', '🎒 Tasche'], ['craft', '🔨 Werkbank'], ['cook', '🍳 Kochen']].forEach(([id, label]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `inv-tab clickable${this.tab === id ? ' active' : ''}`;
      b.dataset.tab = id;
      b.textContent = label;
      b.addEventListener('click', () => { this.tab = id; this.render(); });
      tabs.appendChild(b);
    });
    card.appendChild(tabs);

    if (this.tab === 'craft') this.renderCraft();
    else if (this.tab === 'cook') this.renderCook();
    else this.renderBag();
  }

  renderBag() {
    const card = this.card;
    const pet = this.game.pet;
    if (pet && pet.active) {
      this.section(`🐾 Dein Begleiter: ${pet.name}`);
      const row = document.createElement('div');
      row.className = 'shop-row';
      const info = document.createElement('div');
      info.className = 'shop-info';
      info.textContent = 'Folgt dir überall hin, spürt versteckte Truhen auf, bringt dir ab und zu etwas mit und hilft beim Angeln.';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-buy clickable';
      btn.textContent = 'Freilassen';
      btn.addEventListener('click', () => pet.release());
      row.append(info, btn);
      card.appendChild(row);
    }
    const groups = [
      ['food', '🍎 Essen (antippen zum Essen)'],
      ['tool', '🧩 Rätsel-Helfer (antippen zum Benutzen)'],
      ['furniture', '🪑 Möbel (antippen zum Aufstellen – in deinem Haus oder auf dem Bauland)'],
      ['material', '🪵 Materialien']
    ];
    let any = false;
    groups.forEach(([kind, label]) => {
      const ids = Object.keys(this.state.items).filter(id => ITEMS[id].kind === kind);
      if (!ids.length) return;
      any = true;
      this.section(label);
      const grid = document.createElement('div');
      grid.className = 'album-grid';
      ids.forEach(id => {
        const it = ITEMS[id];
        const cell = this.cell(it.icon, `${it.name} ×${this.count(id)}`, () => this.use(id));
        if (it.kind === 'food') cell.title = `+${it.heal} HP`;
        if (it.desc) cell.title = it.desc;
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
    if (!any) this.section('Noch leer – pflücke Äpfel (F am Apfelbaum), angle Fische oder kaufe etwas an den Ständen.');
  }

  renderCraft() {
    const card = this.card;
    this.section('🔨 Aus Materialien Möbel bauen. Fehlt etwas? Materialien gibt es bei Brummo am Bau-Stand.');
    const list = document.createElement('div');
    list.className = 'shop-list';
    FURNITURE.forEach(id => {
      const it = ITEMS[id];
      const row = document.createElement('div');
      row.className = 'shop-row';
      const icon = document.createElement('span');
      icon.className = 'shop-icon';
      icon.textContent = it.icon;
      const info = document.createElement('div');
      info.className = 'shop-info';
      const nm = document.createElement('b');
      nm.textContent = `${it.name} (du hast ${this.count(id)})`;
      const desc = document.createElement('div');
      desc.className = 'shop-desc';
      desc.textContent = Object.keys(it.recipe).map(m => `${it.recipe[m]} ${ITEMS[m].icon} ${ITEMS[m].name} (${this.count(m)})`).join(' · ');
      info.append(nm, desc);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-buy clickable';
      btn.dataset.craft = id;
      btn.textContent = '🔨 Bauen';
      btn.disabled = !this.has(it.recipe);
      btn.addEventListener('click', () => this.craft(id));
      row.append(icon, info, btn);
      list.appendChild(row);
    });
    card.appendChild(list);
  }

  renderCook() {
    const card = this.card;
    this.section('🍳 Lege zwei Lebensmittel in die Pfanne. Passen sie zusammen, entsteht ein Gericht, das so viel heilt wie beide zusammen – aber nur manche Mischungen klappen!');
    const pan = document.createElement('div');
    pan.className = 'cook-pan';
    this.cook.forEach((id, i) => {
      const slot = this.cell(id ? ITEMS[id].icon : '➕', id ? ITEMS[id].name : 'leer', () => { this.cook[i] = null; this.render(); }, 'cook-slot');
      pan.appendChild(slot);
      if (i === 0) {
        const plus = document.createElement('span');
        plus.className = 'cook-plus';
        plus.textContent = '+';
        pan.appendChild(plus);
      }
    });
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'shop-buy clickable cook-go';
    go.textContent = '🍳 Kochen';
    go.disabled = !this.cook[0] || !this.cook[1];
    go.addEventListener('click', () => this.cookNow());
    pan.appendChild(go);
    card.appendChild(pan);

    const foods = Object.keys(this.state.items).filter(id => ITEMS[id].kind === 'food');
    this.section('Deine Lebensmittel (antippen = in die Pfanne)');
    const grid = document.createElement('div');
    grid.className = 'album-grid';
    if (!foods.length) this.section('Du hast gerade nichts zu essen dabei.');
    foods.forEach(id => grid.appendChild(this.cell(ITEMS[id].icon, `${ITEMS[id].name} ×${this.count(id)}`, () => this.pickCook(id))));
    card.appendChild(grid);

    this.section(`📖 Entdeckte Rezepte (${this.state.recipes.length}/${FOOD_RECIPES.length})`);
    const book = document.createElement('div');
    book.className = 'album-grid';
    FOOD_RECIPES.forEach(r => {
      const known = this.state.recipes.includes(r.out);
      const out = ITEMS[r.out];
      const c = this.cell(known ? out.icon : '❔', known ? `${ITEMS[r.a].icon}+${ITEMS[r.b].icon} = ${out.name} (+${out.heal})` : '???', null, known ? '' : 'locked');
      book.appendChild(c);
    });
    card.appendChild(book);
  }
}
