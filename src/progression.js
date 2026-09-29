// ==========================================
// PROGRESSION: star level (XP from kills, quests, chests and bosses) and unlockable outfits.
//   Level  -> more damage, shorter cooldowns, more max HP
//   Outfits -> unlocked by finishing quests, chosen per sister in the wardrobe
// Saved in localStorage; a friend in co-op sees your outfit.
// ==========================================
import { QUEST_DEFS } from './quests.js';
import { SKIN_VARIANTS } from './characters.js';

const STORAGE_KEY = 'gs-progress-v1';

// XP needed to reach level 1..6
export const XP_TABLE = [0, 50, 140, 280, 480, 760];
export const MAX_LEVEL = XP_TABLE.length;

// Outfit 1 needs 3 finished quests, outfit 2 needs every quest
const SKIN_UNLOCK = [0, 3, QUEST_DEFS.length];

export class Progression {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.render();
  }

  load() {
    const fresh = { xp: 0, skins: [0, 0, 0, 0] };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return {
          xp: Math.max(0, Number(p.xp) || 0),
          skins: [0, 1, 2, 3].map(i => Math.max(0, Math.min(2, (p.skins && p.skins[i]) | 0)))
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
      g.showToast(`🔒 „${this.skinName(s, next)}“: schließe ${need === QUEST_DEFS.length ? 'alle' : need} Quests ab (${this.finishedQuests()}/${need})`, 4500);
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
