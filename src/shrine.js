// ==========================================
// ELEMENT SHRINE (four players): four altars, one for each sister. Each altar is lit by its
// sister's own magic and stays lit for a while; all four lit at once opens the shrine.
//   Luna    - any of her spells cast near her altar
//   Stella  - hit her altar with a star arrow
//   Sol     - Supernova or Petrify near her altar
//   Planeta - let a planet ring fly through her altar, or turn invisible next to it
// With friends every player takes a sister; alone you switch sisters (1-4) between the casts.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { findFlatSpot } from './spots.js';
import { createChest, emojiTexture } from './props.js';
import { createSoftSpriteTexture } from './water.js';

const LIT_SECONDS = 15;
const ALTAR_SPREAD = 5.5;
const CHEST_RANGE = 2.4;

const ALTARS = [
  { sister: 0, symbol: '🌙', name: 'Luna', color: 0x9fb8ff, dx: -1, dz: -1 },
  { sister: 1, symbol: '⭐', name: 'Stella', color: 0xffe066, dx: 1, dz: -1 },
  { sister: 2, symbol: '☀️', name: 'Sol', color: 0xff9f43, dx: -1, dz: 1 },
  { sister: 3, symbol: '🪐', name: 'Planeta', color: 0xc77dff, dx: 1, dz: 1 }
];

export class ElementShrine {
  constructor(game, avoid = []) {
    this.game = game;
    this.solved = false;
    this.rise = 0;
    this.hintShown = false;
    this.group = new THREE.Group();
    this.center = findFlatSpot(game, { target: { x: -62, z: 38 }, radius: 11, avoid });
    this.build();
    game.scene.add(this.group);
  }

  build() {
    const g = this.game;
    const { x: cx, z: cz } = this.center;
    const baseY = g.getTerrainHeight(cx, cz);
    this.baseY = baseY;
    const stone = new THREE.MeshLambertMaterial({ color: 0xe6dcf0, flatShading: true });
    const halo = createSoftSpriteTexture();

    // Floor disc with four coloured quarters
    ALTARS.forEach((def, i) => {
      const quarter = new THREE.Mesh(
        new THREE.CircleGeometry(9, 20, i * (Math.PI / 2) + Math.PI / 4, Math.PI / 2),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.55), transparent: true, opacity: 0.55, depthWrite: false })
      );
      quarter.rotation.x = -Math.PI / 2;
      quarter.position.set(cx, baseY + 0.07, cz);
      this.group.add(quarter);
    });

    this.altars = ALTARS.map(def => {
      const ax = cx + def.dx * ALTAR_SPREAD;
      const az = cz + def.dz * ALTAR_SPREAD;
      const ay = g.getTerrainHeight(ax, az);
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.0, 1.5, 8), stone);
      pillar.position.set(ax, ay + 0.75, az);
      pillar.castShadow = true;
      this.group.add(pillar);
      const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.6) });
      orbMat.userData.noNightGlow = true;
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), orbMat);
      orb.position.set(ax, ay + 2.1, az);
      this.group.add(orb);
      const sym = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTexture(def.symbol), transparent: true, depthWrite: false, fog: false }));
      sym.scale.setScalar(1.1);
      sym.position.set(ax, ay + 3.2, az);
      this.group.add(sym);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: def.color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.25 }));
      glow.scale.setScalar(3.4);
      glow.position.copy(orb.position);
      this.group.add(glow);
      const beamMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(def.color).multiplyScalar(1.6), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending });
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.5, 12, 10, 1, true), beamMat);
      beam.position.set(ax, ay + 6, az);
      beam.visible = false;
      this.group.add(beam);
      g.colliders.push({ type: 'cylinder', x: ax, z: az, radius: 1.0, minY: ay - 1, maxY: ay + 2 });
      return { def, x: ax, z: az, y: ay, orb, orbMat, glow, beam, lit: 0 };
    });

    // The reward chest rises from the floor once the shrine is open
    const chest = createChest(1.15);
    chest.group.position.set(cx, baseY - 1.4, cz);
    chest.group.visible = false;
    this.group.add(chest.group);
    this.chest = chest;
    this.chestPos = new THREE.Vector3(cx, baseY, cz);
    this.light = new THREE.PointLight(0xd8c2ff, 0, 16, 2);
    this.light.position.set(cx, baseY + 3, cz);
    this.group.add(this.light);
  }

  get chestOpened() {
    const q = this.game.quests;
    return !!(q && q.state.items['elements:chest']);
  }

  getTargets() {
    if (this.chestOpened) return [];
    return [{ id: 'shrine', icon: '🔮', label: 'Elemente-Schrein', x: this.center.x, z: this.center.z }];
  }

  light_(i) {
    const a = this.altars[i];
    a.lit = LIT_SECONDS;
    this.game.fx.burst(new THREE.Vector3(a.x, a.y + 2.1, a.z), [new THREE.Color(a.def.color).multiplyScalar(2.2)], 18, { speed: 3, up: 2, size: 0.35, gravity: 2 });
    this.game.fx.ringWave(new THREE.Vector3(a.x, a.y, a.z), new THREE.Color(a.def.color).multiplyScalar(2), 3.4, 0.6);
    sfx.collect();
  }

  // Every cast (own or a friend's) tells the shrine what magic happened where
  onCast(sister, ability, pos) {
    if (this.solved) return;
    const a = this.altars[sister];
    if (!a) return;
    const d = Math.hypot(pos.x - a.x, pos.z - a.z);
    const near = (r) => d <= r;
    if ((sister === 0 && near(6)) ||
      (sister === 2 && near(9)) ||
      (sister === 3 && ability === 2 && near(5))) this.light_(sister);
  }

  // Arrows and rings that touch an altar
  scanProjectiles() {
    const ps = this.game.projectiles;
    this.altars.forEach((a, i) => {
      if (a.def.sister !== 1 && a.def.sister !== 3) return;
      const want = a.def.sister === 1 ? 'arrow' : 'ring';
      const reach = a.def.sister === 1 ? 1.6 : 2.4;
      for (let k = 0; k < ps.length; k++) {
        const p = ps[k];
        if (p.kind !== want) continue;
        const m = p.mesh.position;
        if (Math.hypot(m.x - a.x, m.z - a.z) < reach && Math.abs(m.y - (a.y + 1.6)) < 2.6) {
          if (a.lit < LIT_SECONDS - 0.5) this.light_(i);
          return;
        }
      }
    });
  }

  // Restoring a saved game: the shrine stays open
  restoreSolved() {
    this.solved = true;
    this.chest.group.visible = true;
    this.chest.group.position.y = this.baseY;
  }

  openRemote() {
    if (!this.solved) this.solve(false);
  }

  solve(announce) {
    const g = this.game;
    this.solved = true;
    this.chest.group.visible = true;
    sfx.victory();
    g.fx.flash(new THREE.Vector3(this.center.x, this.baseY + 2, this.center.z), new THREE.Color(2.2, 1.8, 2.8), 8, 0.7);
    g.showToast('🔮 Der Schrein öffnet sich – die Elemente sind vereint!', 5000);
    if (announce) g.coop.send({ t: 'puzzle', id: 'shrine' });
    if (g.saveGame) g.saveGame.save();
  }

  update(delta) {
    const g = this.game;
    const pp = g.playerGroup.position;
    const t = g.clock.elapsedTime;
    this.scanProjectiles();

    let litCount = 0;
    this.altars.forEach(a => {
      a.lit = Math.max(0, a.lit - delta);
      const on = a.lit > 0 || this.solved;
      if (on) litCount++;
      const k = this.solved ? 1 : Math.min(1, a.lit / 2);
      const mul = 0.6 + k * 2.2;
      a.orbMat.color.setHex(a.def.color).multiplyScalar(mul);
      a.glow.material.opacity = 0.25 + k * 0.5 + Math.sin(t * 4) * 0.05 * k;
      a.beam.visible = on;
      if (on) a.beam.rotation.y += delta;
    });

    if (!this.solved) {
      if (litCount === 4) this.solve(true);
      if (!this.hintShown && Math.hypot(pp.x - this.center.x, pp.z - this.center.z) < 14) {
        this.hintShown = true;
        g.showToast('🔮 Elemente-Schrein: Jede Schwester entzündet ihren Altar mit ihrer Magie – alle vier gleichzeitig! Allein: mit 1–4 die Schwester wechseln.', 9000);
      }
    }

    // Chest rises, then opens when someone walks up
    const target = this.solved ? this.baseY : this.baseY - 1.4;
    const opened = this.chestOpened;
    this.rise += ((this.solved ? 1 : 0) - this.rise) * Math.min(1, delta * 2);
    this.chest.group.position.y += (target - this.chest.group.position.y) * Math.min(1, delta * 2);
    this.chest.lidPivot.rotation.x += ((opened ? -1.9 : 0) - this.chest.lidPivot.rotation.x) * Math.min(1, delta * 6);
    this.light.intensity = this.solved && !opened ? 2 : 0;
    if (this.solved && !opened && !g.isDowned && pp.distanceTo(this.chestPos) < CHEST_RANGE) this.openChest();
  }

  openChest() {
    const g = this.game;
    if (!g.quests.mark('elements', 'chest', 'Elementar-Kiste')) return;
    const p = this.chestPos.clone().setY(this.chestPos.y + 1);
    g.fx.burst(p, [new THREE.Color(2.6, 2.0, 0.6), new THREE.Color(2.2, 1.6, 2.8), new THREE.Color(1.6, 2.4, 2.6)], 70, { speed: 5.5, up: 3.5, size: 0.45, life: 1, gravity: 4 });
    g.fx.flash(p, new THREE.Color(2.4, 1.8, 0.9), 5, 0.5);
    sfx.victory();
    g.progression.addXp(80, 'Elementar-Kiste');
    for (let i = 0; i < 4; i++) g.addLoot('heart', p);
    for (let i = 0; i < 7; i++) g.addLoot('dust', p);
  }
}
