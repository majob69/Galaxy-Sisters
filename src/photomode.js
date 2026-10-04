// ==========================================
// PHOTO MODE (key P / 📸 button): hides the whole interface, lets the camera fly around your
// sister freely (drag to turn, wheel / pinch to zoom), offers poses like on the figure page and
// the time of day, and saves the picture as a PNG file.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';

const POSES = [
  ['none', '🫧', 'Normal'], ['wave', '👋', 'Winken'], ['shy', '🙈', 'Schüchtern'],
  ['magic', '🪄', 'Zaubern'], ['dance', '💃', 'Tanzen'], ['jump', '🦘', 'Hüpfen']
];
const SISTER_COLORS = [[0.8, 1.5, 2.4], [2.6, 2.1, 0.6], [2.6, 1.1, 0.25], [1.6, 0.8, 2.6]];
const TIMES = [['🌅', 'Morgen', 0.04], ['☀️', 'Tag', 0.3], ['🌇', 'Abend', 0.55], ['🌙', 'Nacht', 0.75]];

export class PhotoMode {
  constructor(game) {
    this.game = game;
    this.active = false;
    this.pose = 'none';
    this.t = 0;
    this.buildUI();
    const btn = document.getElementById('btn-photo');
    if (btn) btn.addEventListener('click', () => { this.toggle(); btn.blur(); });
  }

  buildUI() {
    const panel = document.createElement('div');
    panel.id = 'photo-panel';
    panel.className = 'photo-panel';
    const row = (label) => {
      const r = document.createElement('div');
      r.className = 'photo-row';
      const l = document.createElement('span');
      l.className = 'photo-label';
      l.textContent = label;
      r.appendChild(l);
      panel.appendChild(r);
      return r;
    };
    const button = (parent, text, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'photo-btn clickable';
      b.textContent = text;
      b.title = title;
      b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); b.blur(); });
      parent.appendChild(b);
      return b;
    };
    const poses = row('Pose');
    this.poseButtons = POSES.map(([id, icon, name]) => {
      const b = button(poses, `${icon} ${name}`, name, () => this.setPose(id));
      b.dataset.pose = id;
      return b;
    });
    const times = row('Licht');
    TIMES.forEach(([icon, name, p]) => button(times, `${icon} ${name}`, name, () => { this.game.dayNight.p = p; }));
    const actions = row('');
    button(actions, '📷 Foto speichern', 'Bild als PNG speichern', () => this.capture());
    button(actions, '✕ Zurück zum Spiel', 'Foto-Modus beenden (P / Esc)', () => this.toggle(false));
    const hint = document.createElement('div');
    hint.className = 'photo-hint';
    hint.textContent = 'Ziehen: Kamera drehen · Mausrad / zwei Finger: Zoom · P oder Esc: zurück';
    panel.appendChild(hint);
    document.body.appendChild(panel);
    this.panel = panel;
    this.setPose('none');
  }

  setPose(id) {
    this.pose = id;
    this.t = 0;
    const rig = this.game.playerRig;
    if (rig) { rig.group.rotation.y = 0; rig.group.position.y = 0; }
    this.poseButtons.forEach(b => b.classList.toggle('active', b.dataset.pose === id));
  }

  toggle(on = !this.active) {
    const g = this.game;
    if (on === this.active) return;
    if (on && (g.isDowned || g.isGrabbed)) return;
    this.active = on;
    document.body.classList.toggle('photo-mode', on);
    if (on) {
      this.saved = { min: g.controls.minDistance, max: g.controls.maxDistance, follow: g.camFollow };
      g.controls.minDistance = 1.6;
      g.controls.maxDistance = 60;
      g.camFollow = false;
      Object.keys(g.keys).forEach(k => { g.keys[k] = false; });
      g.joystickDelta.x = 0;
      g.joystickDelta.y = 0;
      sfx.playTone(990, 'sine', 0.08, 0.05);
    } else {
      g.controls.minDistance = this.saved.min;
      g.controls.maxDistance = this.saved.max;
      g.camFollow = this.saved.follow;
      this.setPose('none');
    }
  }

  // Called right after the player rig was animated: lay the chosen pose over it
  applyPose(delta) {
    if (!this.active || this.pose === 'none') return;
    const rig = this.game.playerRig;
    this.t += delta;
    const t = this.t;
    if (this.pose === 'wave') {
      rig.arms[1].rotation.z = rig.arms[1].userData.side * (2.5 + Math.sin(t * 9) * 0.35);
      rig.head.rotation.z = 0.12;
    } else if (this.pose === 'shy') {
      rig.arms.forEach(a => { a.rotation.x = -1.1; a.rotation.z = -a.userData.side * 0.35; });
      rig.head.rotation.x = 0.28;
    } else if (this.pose === 'magic') {
      rig.arms.forEach(a => { a.rotation.z = a.userData.side * (2.4 + Math.sin(t * 6) * 0.1); });
      if (Math.floor(t * 1.2) !== this.lastFx) {
        this.lastFx = Math.floor(t * 1.2);
        const p = this.game.playerGroup.position;
        const c = new THREE.Color(...SISTER_COLORS[this.game.activeSisterIdx]);
        this.game.fx.spiral(p.clone(), [c, new THREE.Color(2.2, 2.2, 2.4)], 24, 0.9, 2.4);
      }
    } else if (this.pose === 'dance') {
      rig.group.rotation.y = t * 2.4;
      rig.arms.forEach((a, i) => { a.rotation.z = a.userData.side * (1.2 + Math.sin(t * 6 + i * Math.PI) * 1.1); });
    } else if (this.pose === 'jump') {
      rig.group.position.y = Math.abs(Math.sin(t * 4)) * 0.6;
      rig.arms.forEach(a => { a.rotation.z = a.userData.side * 2.2; });
    }
  }

  capture() {
    const g = this.game;
    // draw a fresh frame and read it right away (the canvas keeps no copy of older frames)
    if (g.graphicsQuality === 'high' && g.postFX) g.postFX.render();
    else g.renderer.render(g.scene, g.camera);
    let url;
    try {
      url = g.renderer.domElement.toDataURL('image/png');
    } catch (e) {
      g.showToast('⚠️ Das Foto konnte nicht gespeichert werden', 3000);
      return;
    }
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.href = url;
    a.download = `galaxy-sisters-foto-${stamp}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    sfx.collect();
    this.flash();
  }

  flash() {
    const f = document.createElement('div');
    f.className = 'photo-flash';
    document.body.appendChild(f);
    setTimeout(() => f.remove(), 450);
  }
}
