// ==========================================
// PROGRESSION: star level (XP from kills, quests, chests and bosses), fighting perks and outfits.
//   Level   -> more damage, shorter cooldowns, more max HP, and from level 2 on a choice of two perks
//   Perks   -> each one upgrades a single ability of a sister (longer shield, more arrows ...)
//   Outfits -> unlocked by finishing quests, chosen per sister in the wardrobe
// Saved in localStorage; a friend in co-op sees your outfit.
// ==========================================
import { QUEST_DEFS } from './quests.js';
import { SKIN_VARIANTS } from './characters.js';

const STORAGE_KEY = 'gs-progress-v1';

// XP needed to reach level 1..6
export const XP_TABLE = [0, 50, 140, 280, 480, 760];
export const MAX_LEVEL = XP_TABLE.length;

// Outfit 1 needs 4 finished quests, outfit 2 needs 8
export const SKIN_UNLOCK = [0, 4, 8];

// Perks: one upgrade for one ability. From level 2 on every level offers two of the unowned ones.
export const PERKS = [
  { id: 'luna_shield', icon: '🌙', sister: 'Luna', name: 'Langer Schild', desc: 'Mondschild hält 11 statt 7 Sekunden' },
  { id: 'luna_heal', icon: '💚', sister: 'Luna', name: 'Starke Heilung', desc: 'Heilung gibt +75 statt +50 HP' },
  { id: 'stella_arrows', icon: '🏹', sister: 'Stella', name: 'Sechsfach-Pfeil', desc: 'Sternenbogen schießt 6 statt 4 Pfeile' },
  { id: 'stella_dash', icon: '⚡', sister: 'Stella', name: 'Weiter Dash', desc: 'Sternen-Dash trägt 50 % weiter' },
  { id: 'sol_nova', icon: '☀️', sister: 'Sol', name: 'Riesen-Nova', desc: 'Supernova-Radius 13 statt 9 Meter' },
  { id: 'sol_stone', icon: '🪨', sister: 'Sol', name: 'Lange Versteinerung', desc: 'Versteinern dauert 7 statt 4 Sekunden' },
  { id: 'planeta_rings', icon: '🪐', sister: 'Planeta', name: 'Doppelringe', desc: 'Ein zweiter Planeten-Ring folgt kurz danach' },
  { id: 'planeta_veil', icon: '👻', sister: 'Planeta', name: 'Langer Schleier', desc: 'Unsichtbar für 9 statt 5 Sekunden' }
];

export class Progression {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.buildPerkModal();
    this.render();
  }

  load() {
    const fresh = { xp: 0, skins: [0, 0, 0, 0], perks: [], offer: [] };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const known = new Set(PERKS.map(x => x.id));
        return {
          xp: Math.max(0, Number(p.xp) || 0),
          skins: [0, 1, 2, 3].map(i => Math.max(0, Math.min(2, (p.skins && p.skins[i]) | 0))),
          perks: Array.isArray(p.perks) ? p.perks.filter(id => known.has(id)) : [],
          offer: Array.isArray(p.offer) ? p.offer.filter(id => known.has(id)).slice(0, 2) : []
        };
      }
    } catch (e) { /* storage unavailable */ }
    return fresh;
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  // ---------- Level ----------
  get level() {
    let lvl = 1;
    XP_TABLE.forEach((need, i) => { if (this.state.xp >= need) lvl = i + 1; });
    return lvl;
  }

  get damageMul() { return 1 + 0.08 * (this.level - 1); }
  get cooldownMul() { return 1 - 0.04 * (this.level - 1); }
  get hpBonus() { return 6 * (this.level - 1); }

  addXp(amount, why) {
    const g = this.game;
    const before = this.level;
    this.state.xp += amount;
    this.save();
    if (why) g.showFloatingText(`+${amount} XP ${why}`, g.playerGroup.position.clone().setY(g.playerGroup.position.y + 0.8), '#b8f1ff');
    if (this.level > before) this.onLevelUp();
    this.render();
  }

  onLevelUp() {
    const g = this.game;
    g.applyQuestRewards(true);
    g.showToast(`⭐ Stern-Level ${this.level}! Mehr Schaden, kürzere Abklingzeit, mehr Leben`, 5000);
    g.createSupernovaParticles(g.playerGroup.position.clone());
    g.sfxLevelUp();
    this.checkOffer();
  }

  // ---------- Perks ----------
  has(id) {
    return this.state.perks.includes(id);
  }

  get pendingPicks() {
    return Math.max(0, this.level - 1 - this.state.perks.length);
  }

  // Offer two unowned perks if a pick is due (the pair is saved, so reloading shows the same choice)
  checkOffer() {
    if (this.pendingPicks <= 0) return this.hidePerkModal();
    const intro = document.getElementById('intro-screen');
    if (intro && !intro.classList.contains('hidden')) return; // shown once the adventure starts
    const owned = new Set(this.state.perks);
    let offer = this.state.offer.filter(id => !owned.has(id));
    if (offer.length < 2) {
      const pool = PERKS.filter(p => !owned.has(p.id) && !offer.includes(p.id));
      while (offer.length < 2 && pool.length) offer.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    }
    this.state.offer = offer;
    this.save();
    if (offer.length) this.showPerkModal(offer);
  }

  choose(id) {
    if (!this.state.offer.includes(id) || this.has(id)) return;
    this.state.perks.push(id);
    this.state.offer = [];
    this.save();
    const perk = PERKS.find(p => p.id === id);
    this.game.showToast(`${perk.icon} Neue Fähigkeit: ${perk.name} – ${perk.desc}`, 5000);
    this.game.sfxLevelUp();
    this.hidePerkModal();
    this.checkOffer();
  }

  buildPerkModal() {
    const el = document.createElement('div');
    el.id = 'perk-modal';
    el.className = 'perk-modal';
    document.body.appendChild(el);
    this.modal = el;
  }

  showPerkModal(ids) {
    this.modal.textContent = '';
    const title = document.createElement('div');
    title.className = 'perk-title';
    title.textContent = '⭐ Neue Fähigkeit wählen!';
    this.modal.appendChild(title);
    const row = document.createElement('div');
    row.className = 'perk-row';
    ids.forEach(id => {
      const p = PERKS.find(x => x.id === id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'perk-card clickable';
      const icon = document.createElement('div');
      icon.className = 'perk-icon';
      icon.textContent = p.icon;
      const name = document.createElement('div');
      name.className = 'perk-name';
      name.textContent = p.name;
      const sis = document.createElement('div');
      sis.className = 'perk-sister';
      sis.textContent = p.sister;
      const desc = document.createElement('div');
      desc.className = 'perk-desc';
      desc.textContent = p.desc;
      card.append(icon, name, sis, desc);
      card.addEventListener('click', () => this.choose(id));
      row.appendChild(card);
    });
    this.modal.appendChild(row);
    this.modal.classList.add('open');
  }

  hidePerkModal() {
    this.modal.classList.remove('open');
  }

  // ---------- Outfits ----------
  finishedQuests() {
    const q = this.game.quests;
    return q ? QUEST_DEFS.filter(d => q.state.done[d.id]).length : 0;
  }

  isSkinUnlocked(variant) {
    return this.finishedQuests() >= SKIN_UNLOCK[variant];
  }

  getSkin(sister) {
    const v = this.state.skins[sister];
    return this.isSkinUnlocked(v) ? v : 0;
  }

  skinName(sister, variant) {
    return variant === 0 ? 'Standard' : SKIN_VARIANTS[sister][variant].name;
  }

  // Wardrobe button: next outfit of the active sister, locked ones explain how to get them
  cycleSkin() {
    const g = this.game;
    const s = g.activeSisterIdx;
    const next = (this.getSkin(s) + 1) % 3;
    if (!this.isSkinUnlocked(next)) {
      const need = SKIN_UNLOCK[next];
      g.showToast(`🔒 „${this.skinName(s, next)}“: schließe ${need} Quests ab (${this.finishedQuests()}/${need})`, 4500);
      this.state.skins[s] = 0; // wrap around to the standard outfit
    } else {
      this.state.skins[s] = next;
    }
    this.save();
    g.updateSisterAccessory();
    this.render();
  }

  // ---------- HUD ----------
  render() {
    const lvl = this.level;
    const badge = document.getElementById('lvl-badge');
    const fill = document.getElementById('xp-fill');
    if (badge) badge.textContent = `Lv ${lvl}`;
    if (fill) {
      const cur = XP_TABLE[lvl - 1];
      const next = XP_TABLE[lvl] ?? cur;
      fill.style.width = lvl >= MAX_LEVEL ? '100%' : `${((this.state.xp - cur) / (next - cur)) * 100}%`;
    }
    const btn = document.getElementById('btn-wardrobe');
    if (btn && this.game.activeSisterIdx !== undefined) {
      const s = this.game.activeSisterIdx;
      btn.textContent = `👗 Outfit: ${this.skinName(s, this.getSkin(s))}`;
    }
  }
}
