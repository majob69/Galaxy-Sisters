// ==========================================
// STAR GATE PUZZLE: two glowing pressure plates that must be pressed at the same time.
//   - together with a friend (each stands on a plate), or
//   - alone with Stella: stand on one plate and hit the other with a star arrow (stays lit for 6 s).
// The gate opens for everybody in the room and reveals a treasure chest (quest "Öffne das Sternen-Tor").
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { findFlatSpot } from './spots.js';

const PLATE_RADIUS = 1.5;
const PLATE_DISTANCE = 6;      // plates sit at +-PLATE_DISTANCE from the plaza center
const ARROW_HOLD = 6;          // seconds a plate stays lit after an arrow hit
const GATE_HOLD = 0.6;         // both plates must stay lit this long
const CHEST_RANGE = 2.4;

function starTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(64, 64, 60, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#7a63c9';
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 46 : 20;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    ctx.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class StarGate {
  constructor(game) {
    this.game = game;
    this.open = false;
    this.gateTimer = 0;
    this.openAnim = 0;
    this.hintShown = false;
    this.group = new THREE.Group();
    this.plates = [];
    this.colliders = [];
    this.center = this.findSpot();
    this.build();
    game.scene.add(this.group);
  }

  // A flat, dry, empty patch of meadow (same result for every player: the world is seeded)
  findSpot() {
    const spot = findFlatSpot(this.game, { target: { x: 50, z: -8 }, radius: 14 });
    return { x: spot.x, z: spot.z - 4, score: spot.score };
  }

  addCollider(c) {
    this.game.colliders.push(c);
    this.colliders.push(c);
    return c;
  }

  build() {
    const g = this.game;
    const { x: cx, z: cz } = this.center;
    const baseY = g.getTerrainHeight(cx, cz);
    this.baseY = baseY;

    const stone = new THREE.MeshLambertMaterial({ color: 0xe8def2, flatShading: true });
    const violet = new THREE.MeshLambertMaterial({ color: 0x7a4bd8, emissive: 0x2a0d6a, emissiveIntensity: 0.5, flatShading: true });
    const gold = new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
    const wood = new THREE.MeshLambertMaterial({ color: 0x9a5b34, flatShading: true });

    // Pressure plates
    const tex = starTexture();
    [-1, 1].forEach(side => {
      const px = cx + side * PLATE_DISTANCE;
      const py = g.getTerrainHeight(px, cz);
      const mat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.6, 0.55, 1.0) });
      mat.userData.noNightGlow = true;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(PLATE_RADIUS, PLATE_RADIUS + 0.15, 0.16, 28), [stone, mat, stone]);
      disc.position.set(px, py + 0.06, cz);
      disc.receiveShadow = true;
      this.group.add(disc);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(PLATE_RADIUS + 0.1, 0.07, 6, 32), violet);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(px, py + 0.14, cz);
      this.group.add(ring);
      this.plates.push({ x: px, z: cz, y: py, mat, glow: 0, arrowTimer: 0, pressed: false, ring });
    });

    // Gate: two pillars, a lintel and a shimmering barrier
    const gateZ = cz + 3;
    [-1, 1].forEach(side => {
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 5.4, 8), stone);
      pillar.position.set(cx + side * 2.7, baseY + 2.7, gateZ);
      pillar.castShadow = true;
      this.group.add(pillar);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.62, 10, 8), gold);
      cap.position.set(cx + side * 2.7, baseY + 5.6, gateZ);
      this.group.add(cap);
      this.addCollider({ type: 'cylinder', x: cx + side * 2.7, z: gateZ, radius: 0.7, minY: baseY - 1, maxY: baseY + 30 });
    });
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.6, 1.0), violet);
    lintel.position.set(cx, baseY + 5.2, gateZ);
    lintel.castShadow = true;
    this.group.add(lintel);

    this.barrierMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 0.6, 2.4), transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false });
    this.barrierMat.userData.noNightGlow = true;
    this.barrier = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 4.9), this.barrierMat);
    this.barrier.position.set(cx, baseY + 2.6, gateZ);
    this.group.add(this.barrier);
    this.barrierCollider = this.addCollider({ type: 'box', minX: cx - 2.4, maxX: cx + 2.4, minZ: gateZ - 0.3, maxZ: gateZ + 0.3, minY: baseY - 1, maxY: baseY + 30 });

    // Chamber walls (left, right, back) so the chest can only be reached through the gate
    const chamberBackZ = cz + 11.5;
    const wallH = 5;
    const wall = (x0, x1, z0, z1) => {
      const w = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, wallH, z1 - z0), stone);
      w.position.set((x0 + x1) / 2, baseY + wallH / 2 - 0.3, (z0 + z1) / 2);
      w.castShadow = true;
      w.receiveShadow = true;
      this.group.add(w);
      this.addCollider({ type: 'box', minX: x0, maxX: x1, minZ: z0, maxZ: z1, minY: baseY - 3, maxY: baseY + 30 });
    };
    wall(cx - 6.6, cx - 3.0, gateZ - 0.4, gateZ + 0.4);   // front left of the gate
    wall(cx + 3.0, cx + 6.6, gateZ - 0.4, gateZ + 0.4);   // front right of the gate
    wall(cx - 6.6, cx - 6.0, gateZ, chamberBackZ);        // left
    wall(cx + 6.0, cx + 6.6, gateZ, chamberBackZ);        // right
    wall(cx - 6.6, cx + 6.6, chamberBackZ, chamberBackZ + 0.6); // back
    // Pillar stumps along the top edge of the front walls for a bit of shrine feeling
    [-5.2, 5.2].forEach(x => {
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), gold);
      orb.position.set(cx + x, baseY + wallH - 0.3 + 0.4, gateZ);
      this.group.add(orb);
    });

    // Treasure chest
    const chestZ = cz + 8;
    this.chestPos = new THREE.Vector3(cx, g.getTerrainHeight(cx, chestZ), chestZ);
    const chest = new THREE.Group();
    chest.position.copy(this.chestPos);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.85, 1.0), wood);
    body.position.y = 0.43;
    body.castShadow = true;
    chest.add(body);
    const band = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.16, 1.06), gold);
    band.position.y = 0.6;
    chest.add(band);
    this.lidPivot = new THREE.Group();
    this.lidPivot.position.set(0, 0.86, -0.5);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.5, 12, 1, false, 0, Math.PI), wood);
    lid.rotation.z = Math.PI / 2; // half cylinder lying along X, round side up
    lid.position.set(0, 0, 0.5);
    this.lidPivot.add(lid);
    chest.add(this.lidPivot);
    this.chestGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.6) });
    this.chestStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), this.chestGlowMat);
    this.chestStar.position.y = 2.0;
    chest.add(this.chestStar);
    this.group.add(chest);
    this.chest = chest;
    this.addCollider({ type: 'box', minX: this.chestPos.x - 0.8, maxX: this.chestPos.x + 0.8, minZ: this.chestPos.z - 0.6, maxZ: this.chestPos.z + 0.6, minY: baseY - 1, maxY: baseY + 1.2 });
    this.chestLight = new THREE.PointLight(0xffd27a, 0, 9, 2);
    this.chestLight.position.set(this.chestPos.x, this.chestPos.y + 1.5, this.chestPos.z);
    this.group.add(this.chestLight);
  }

  get chestOpened() {
    const q = this.game.quests;
    return !!(q && q.state.items['gate:chest']);
  }

  getTargets() {
    if (this.chestOpened) return [];
    return [{ id: 'stargate', icon: '⭐', label: 'Sternen-Tor', x: this.center.x, z: this.center.z + 3 }];
  }

  isPressed(plate) {
    const g = this.game;
    if (plate.arrowTimer > 0 || plate.weighted) return true;
    const stands = (pos) => Math.hypot(pos.x - plate.x, pos.z - plate.z) < PLATE_RADIUS && Math.abs(pos.y - plate.y) < 1.4;
    if (!g.isDowned && stands(g.playerGroup.position)) return true;
    return g.remotes.list.some(r => r.hasState && !r.downed && stands(r.group.position));
  }

  // Called by a network message: the gate opened somewhere else in the room
  openRemote() {
    if (!this.open) this.openGate(false);
  }

  // Restoring a saved game: the gate stays open
  restoreOpen() {
    this.open = true;
    this.barrierCollider.minY = this.barrierCollider.maxY = 1e9;
    this.barrier.visible = false;
  }

  openGate(announce) {
    const g = this.game;
    this.open = true;
    this.barrierCollider.minY = this.barrierCollider.maxY = 1e9;
    sfx.magicSkill(0);
    sfx.collect();
    g.fx.ringWave(new THREE.Vector3(this.center.x, this.baseY, this.center.z + 3), new THREE.Color(1.6, 0.9, 2.4), 8, 0.9);
    g.showToast('⭐ Das Sternen-Tor öffnet sich!', 4000);
    if (announce) g.coop.send({ t: 'puzzle', id: 'gate' });
    if (g.saveGame) g.saveGame.save();
  }

  update(delta) {
    const g = this.game;
    const pp = g.playerGroup.position;
    const t = g.clock.elapsedTime;

    // Arrows (and rings) that hit a plate keep it lit for a while
    this.plates.forEach(pl => {
      pl.arrowTimer = Math.max(0, pl.arrowTimer - delta);
      for (let i = 0; i < g.projectiles.length; i++) {
        const m = g.projectiles[i].mesh.position;
        if (Math.hypot(m.x - pl.x, m.z - pl.z) < PLATE_RADIUS + 0.4 && Math.abs(m.y - pl.y) < 2.6) pl.arrowTimer = ARROW_HOLD;
      }
      pl.pressed = this.isPressed(pl);
      pl.glow += ((pl.pressed ? 1 : 0) - pl.glow) * Math.min(1, delta * 8);
      const k = pl.glow;
      pl.mat.color.setRGB(0.6 + 1.6 * k, 0.55 + 1.25 * k, 1.0 - 0.4 * k);
      pl.ring.scale.setScalar(1 + k * 0.05);
    });

    if (!this.open) {
      if (this.plates.every(p => p.pressed)) {
        this.gateTimer += delta;
        if (this.gateTimer >= GATE_HOLD) this.openGate(true);
      } else {
        this.gateTimer = 0;
      }
      this.barrierMat.opacity = 0.32 + Math.sin(t * 3) * 0.08;
      this.barrier.visible = true;

      if (!this.hintShown && Math.hypot(pp.x - this.center.x, pp.z - this.center.z) < 11) {
        this.hintShown = true;
        g.showToast('⭐ Sternen-Tor: beide Platten gleichzeitig drücken – zu zweit, oder allein mit einem Sternenpfeil von Stella auf die andere Platte', 8000);
      }
    } else if (this.barrier.visible) {
      this.openAnim += delta;
      const k = Math.min(1, this.openAnim / 1.2);
      this.barrier.scale.y = 1 - k;
      this.barrier.position.y = this.baseY + 2.6 * (1 - k) + 0.1;
      this.barrierMat.opacity = 0.4 * (1 - k);
      if (k >= 1) this.barrier.visible = false;
    }

    // Chest: waits behind the barrier, opens when someone walks up to it
    const opened = this.chestOpened;
    this.lidPivot.rotation.x += ((opened ? -1.9 : 0) - this.lidPivot.rotation.x) * Math.min(1, delta * 6);
    this.chestStar.visible = !opened;
    this.chestStar.rotation.y += delta * 2;
    this.chestStar.position.y = 2.0 + Math.sin(t * 2.5) * 0.15;
    this.chestLight.intensity = opened ? 0 : (this.open ? 1.6 : 0.5);
    if (this.open && !opened && !g.isDowned && pp.distanceTo(this.chestPos) < CHEST_RANGE) this.openChest();
  }

  openChest() {
    const g = this.game;
    if (!g.quests.mark('gate', 'chest', 'Schatz des Sternen-Tors')) return;
    const p = this.chestPos.clone().setY(this.chestPos.y + 1);
    g.fx.burst(p, [new THREE.Color(2.6, 2.0, 0.6), new THREE.Color(2.2, 1.6, 2.6)], 60, { speed: 5, up: 3, size: 0.45, life: 1, gravity: 4 });
    g.fx.flash(p, new THREE.Color(2.4, 1.8, 0.7), 5, 0.5);
    sfx.victory();
    g.progression.addXp(60, 'Schatzkiste');
    g.inventory.addCoins(30, 'Sternen-Tor');
    for (let i = 0; i < 3; i++) g.addLoot('heart', p);
    for (let i = 0; i < 6; i++) g.addLoot('dust', p);
  }
}
