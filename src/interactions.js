// ==========================================
// INTERACTIONS: one key (F, or the round action button on touch screens) for everything nearby:
// pick apples, talk, sleep, open chests, buy at stands, build, fish ...
// Systems register providers that return { dist, label, action } (or null) for the player's spot.
// ==========================================

export class Interactions {
  constructor(game) {
    this.game = game;
    this.providers = [];
    this.current = null;
    this.hint = document.getElementById('interact-hint');
    this.button = document.getElementById('btn-interact');
    if (this.button) {
      const press = (e) => { e.preventDefault(); this.trigger(); };
      this.button.addEventListener('touchstart', press, { passive: false });
      this.button.addEventListener('mousedown', press);
    }
  }

  // provider(): { dist, label, action, priority? } | null — lower dist wins, priority beats dist
  register(provider) {
    this.providers.push(provider);
  }

  update() {
    const g = this.game;
    let best = null;
    if (!g.isDowned) {
      for (const p of this.providers) {
        const c = p();
        if (!c) continue;
        const score = (c.priority || 0) * -1000 + c.dist;
        if (!best || score < best.score) best = { ...c, score };
      }
    }
    this.current = best;
    const label = best ? best.label : '';
    if (this.hint) {
      this.hint.classList.toggle('visible', !!best);
      if (label !== this.lastLabel) this.hint.textContent = best ? `F · ${label}` : '';
    }
    if (this.button) {
      this.button.classList.toggle('visible', !!best);
      if (label !== this.lastLabel) this.button.textContent = label;
    }
    this.lastLabel = label;
  }

  trigger() {
    if (this.current && this.current.action) this.current.action();
    else this.game.showToast('Hier gibt es nichts zu tun. Geh näher an Bäume, Wesen, Ufer oder Truhen.', 2500);
  }
}
