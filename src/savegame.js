// ==========================================
// SAVE GAME: world progress that quests / XP do not cover (boss defeats, opened gate and shrine,
// position, sister, time of day). Saved automatically and restored on the next start.
// Also export / import as a .json file to move a game to another device.
// Quests and XP have their own storage keys and are bundled into the export.
// ==========================================
import { PERKS } from './progression.js';
import { ITEMS } from './inventory.js';

const KEY = 'gs-save-v1';
const QUEST_KEY = 'gs-quests-v1';
const PROGRESS_KEY = 'gs-progress-v1';
const GRAPHICS_KEY = 'gs-graphics';
const INVENTORY_KEY = 'gs-inventory-v1';

const num = (v, lo, hi, dflt = 0) => (Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt);

export class SaveGame {
  constructor(game) {
    this.game = game;
    this.timer = 15;
    this.fileInput = document.getElementById('save-file');
    this.wire();
    window.addEventListener('pagehide', () => this.save());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(); });
  }

  // ---------- Snapshot ----------
  snapshot() {
    const g = this.game;
    return {
      v: 1,
      savedAt: Date.now(),
      sister: g.activeSisterIdx,
      pos: Math.abs(g.playerGroup.position.x) > 300 ? { x: g.forest.portal.x, z: g.forest.portal.z + 3.5 } : { x: g.playerGroup.position.x, z: g.playerGroup.position.z },
      dayP: g.dayNight.p,
      vortox: !g.bossData.alive,
      gate: g.stargate.open,
      shrine: g.shrine.solved,
      morvanta: !g.morvanta.d.alive,
      glaciel: !g.glaciel.d.alive
    };
  }

  save() {
    if (this.skipSaveOnUnload) return;
    try { localStorage.setItem(KEY, JSON.stringify(this.snapshot())); } catch (e) { /* storage unavailable */ }
  }

  read() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? this.sanitize(JSON.parse(raw)) : null;
    } catch (e) {
      return null;
    }
  }

  sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    return {
      v: 1,
      savedAt: num(s.savedAt, 0, 4e12),
      sister: num(s.sister | 0, 0, 3),
      pos: { x: num(s.pos && s.pos.x, -96, 96), z: num(s.pos && s.pos.z, -96, 96) },
      dayP: num(s.dayP, 0, 0.9999, 0.1),
      vortox: !!s.vortox,
      gate: !!s.gate,
      shrine: !!s.shrine,
      morvanta: !!s.morvanta,
      glaciel: !!s.glaciel
    };
  }

  // Apply a saved game to the freshly built world (called once after construction)
  restore() {
    const s = this.read();
    const g = this.game;
    if (!s) return false;
    if (s.vortox) g.restoreVortoxDefeated();
    if (s.morvanta) g.morvanta.restoreDefeated();
    if (s.vortox || s.glaciel) g.glaciel.vortoxDown = true;
    if (s.glaciel) g.glaciel.restoreDefeated();
    if (s.gate) g.stargate.restoreOpen();
    if (s.shrine) g.shrine.restoreSolved();
    g.dayNight.p = s.dayP;
    g.switchSister(s.sister);
    const y = g.getTerrainHeight(s.pos.x, s.pos.z);
    if (g.getWaterSurface(s.pos.x, s.pos.z) === null && !g.checkWallCollision(s.pos.x, s.pos.z, 0.5, y)) {
      g.playerGroup.position.set(s.pos.x, y, s.pos.z);
      if (g.prevPlayerPos) g.prevPlayerPos.copy(g.playerGroup.position);
    }
    return true;
  }

  update(delta) {
    this.timer -= delta;
    if (this.timer <= 0) {
      this.timer = 15;
      this.save();
    }
  }

  // ---------- Export / import / reset ----------
  buildExport() {
    this.save();
    const read = (key) => { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch (e) { return null; } };
    return {
      game: 'galaxy-sisters',
      version: 1,
      save: this.snapshot(),
      quests: read(QUEST_KEY),
      progress: read(PROGRESS_KEY),
      inventory: read(INVENTORY_KEY)
    };
  }

  exportFile() {
    const blob = new Blob([JSON.stringify(this.buildExport(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'galaxy-sisters-spielstand.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    this.game.showToast('💾 Spielstand als Datei gespeichert', 3500);
  }

  // Only known, well-formed fields are accepted from a file
  parseImport(text) {
    let data;
    try { data = JSON.parse(text); } catch (e) { throw new Error('Keine gültige Datei'); }
    if (!data || data.game !== 'galaxy-sisters') throw new Error('Das ist kein Galaxy-Sisters-Spielstand');
    const save = this.sanitize(data.save);
    if (!save) throw new Error('Spielstand beschädigt');

    const quests = { items: {}, done: {}, marks: {} };
    const q = data.quests && typeof data.quests === 'object' ? data.quests : {};
    ['items', 'done', 'marks'].forEach(part => {
      const src = q[part] && typeof q[part] === 'object' ? q[part] : {};
      Object.keys(src).slice(0, 200).forEach(k => { if (/^[a-z0-9:_-]{1,48}$/i.test(k) && src[k] === true) quests[part][k] = true; });
    });

    const known = new Set(PERKS.map(p => p.id));
    const p = data.progress && typeof data.progress === 'object' ? data.progress : {};
    const progress = {
      xp: num(p.xp, 0, 1e6),
      skins: [0, 1, 2, 3].map(i => num((p.skins && p.skins[i]) | 0, 0, 2)),
      perks: Array.isArray(p.perks) ? p.perks.filter(id => known.has(id)).slice(0, 8) : [],
      offer: []
    };
    const inv = data.inventory && typeof data.inventory === 'object' ? data.inventory : {};
    const inventory = { items: {}, coins: num(Math.floor(Number(inv.coins) || 0), 0, 1e6) };
    const srcItems = inv.items && typeof inv.items === 'object' ? inv.items : {};
    Object.keys(srcItems).forEach(k => {
      const n = Math.floor(Number(srcItems[k]));
      if (ITEMS[k] && n > 0) inventory.items[k] = Math.min(999, n);
    });
    return { save, quests, progress, inventory };
  }

  importText(text) {
    let parsed;
    try {
      parsed = this.parseImport(text);
    } catch (e) {
      this.game.showToast(`⚠️ ${e.message}`, 4500);
      return false;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(parsed.save));
      localStorage.setItem(QUEST_KEY, JSON.stringify(parsed.quests));
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(parsed.progress));
      localStorage.setItem(INVENTORY_KEY, JSON.stringify(parsed.inventory));
    } catch (e) {
      this.game.showToast('⚠️ Der Browser erlaubt kein Speichern', 4500);
      return false;
    }
    this.skipSaveOnUnload = true;
    location.reload();
    return true;
  }

  resetAll() {
    if (!window.confirm('Wirklich alles zurücksetzen? Quests, Level, Outfits und Spielstand gehen verloren.')) return;
    try {
      [KEY, QUEST_KEY, PROGRESS_KEY, GRAPHICS_KEY, INVENTORY_KEY, 'gs-house-v1', 'gs-player-name', 'gs-room'].forEach(k => localStorage.removeItem(k));
    } catch (e) { /* ignore */ }
    this.skipSaveOnUnload = true;
    location.reload();
  }

  wire() {
    const bind = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', () => { fn(); el.blur(); });
    };
    bind('btn-save-export', () => this.exportFile());
    bind('btn-save-import', () => { if (this.fileInput) this.fileInput.click(); });
    bind('btn-save-reset', () => this.resetAll());
    if (this.fileInput) {
      this.fileInput.addEventListener('change', () => {
        const file = this.fileInput.files && this.fileInput.files[0];
        this.fileInput.value = '';
        if (!file) return;
        if (file.size > 200 * 1024) { this.game.showToast('⚠️ Datei ist zu groß', 3500); return; }
        const reader = new FileReader();
        reader.onload = () => this.importText(String(reader.result));
        reader.readAsText(file);
      });
    }
  }
}
