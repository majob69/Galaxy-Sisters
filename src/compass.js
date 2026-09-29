// ==========================================
// COMPASS HUD: heading strip with N/O/S/W and markers for open quest goals.
// The nearest goal is named with its distance; goals behind you show as edge arrows.
// ==========================================
import * as THREE from 'three';

const SPAN = THREE.MathUtils.degToRad(150); // visible field of the strip
const CARDINALS = [['N', 0], ['NO', Math.PI / 4], ['O', Math.PI / 2], ['SO', Math.PI * 0.75], ['S', Math.PI], ['SW', -Math.PI * 0.75], ['W', -Math.PI / 2], ['NW', -Math.PI / 4]];

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class Compass {
  constructor(game, getTargets) {
    this.game = game;
    this.getTargets = getTargets;
    this.targets = [];
    this.refreshTimer = 0;
    this.dir = new THREE.Vector3();

    const root = document.createElement('div');
    root.className = 'compass';
    root.innerHTML = '<div class="compass-strip"></div><div class="compass-needle"></div><div class="compass-label"></div>';
    (document.getElementById('ui-overlay') || document.body).appendChild(root);
    this.root = root;
    this.strip = root.querySelector('.compass-strip');
    this.label = root.querySelector('.compass-label');

    this.cardinals = CARDINALS.map(([text, angle]) => {
      const el = document.createElement('span');
      el.className = text.length === 1 ? 'compass-cardinal main' : 'compass-cardinal';
      el.textContent = text;
      this.strip.appendChild(el);
      return { el, angle };
    });
    this.markers = new Map();
  }

  marker(id, icon) {
    let m = this.markers.get(id);
    if (!m) {
      const el = document.createElement('span');
      el.className = 'compass-marker';
      el.textContent = icon;
      this.strip.appendChild(el);
      m = { el };
      this.markers.set(id, m);
    }
    return m;
  }

  update(delta) {
    const g = this.game;
    this.refreshTimer -= delta;
    if (this.refreshTimer <= 0) {
      this.refreshTimer = 0.3;
      this.targets = this.getTargets();
      const alive = new Set(this.targets.map(t => t.id));
      this.markers.forEach((m, id) => {
        if (!alive.has(id)) {
          m.el.remove();
          this.markers.delete(id);
        }
      });
      // Move below the boss banner while it is shown
      const banner = document.getElementById('boss-banner');
      this.root.classList.toggle('lowered', !!banner && banner.classList.contains('visible'));
    }

    g.camera.getWorldDirection(this.dir);
    const heading = Math.atan2(this.dir.x, -this.dir.z);
    const width = this.strip.clientWidth || 1;
    const place = (el, rel) => {
      el.style.transform = `translateX(${(rel / SPAN + 0.5) * width}px) translateX(-50%)`;
    };

    this.cardinals.forEach(c => {
      const rel = wrap(c.angle - heading);
      const visible = Math.abs(rel) < SPAN / 2;
      c.el.style.display = visible ? '' : 'none';
      if (visible) place(c.el, rel);
    });

    const p = g.playerGroup.position;
    let nearest = null;
    let nearestDist = Infinity;
    this.targets.forEach(t => {
      const dx = t.x - p.x;
      const dz = t.z - p.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      const rel = wrap(Math.atan2(dx, -dz) - heading);
      const m = this.marker(t.id, t.icon);
      const clamped = Math.max(-SPAN / 2, Math.min(SPAN / 2, rel));
      const behind = Math.abs(rel) > SPAN / 2;
      m.el.classList.toggle('edge', behind);
      m.el.dataset.side = rel < 0 ? 'left' : 'right';
      m.el.style.opacity = behind ? 0.75 : Math.max(0.45, 1 - dist / 140);
      place(m.el, clamped * 0.97);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = { t, m, rel };
      }
    });

    this.markers.forEach(m => m.el.classList.remove('nearest'));
    if (nearest) {
      nearest.m.el.classList.add('nearest');
      const turn = Math.abs(nearest.rel) > SPAN / 2 ? (nearest.rel < 0 ? '◀ ' : ' ▶') : '';
      const text = `${nearest.t.icon} ${nearest.t.label} · ${Math.round(nearestDist)} m`;
      this.label.textContent = turn === '◀ ' ? turn + text : text + turn;
      this.label.style.display = '';
    } else {
      this.label.textContent = '🌟 Alle Ziele erreicht!';
    }
  }
}
