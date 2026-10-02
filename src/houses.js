// ==========================================
// HOUSES: two cosy cottages you can walk into (and one you can build yourself).
// Inside: a bed (sleep in the evening or at night: the night passes and you wake up healed)
// and a chest that holds food, materials or puzzle helpers - refilled every new day.
// While you are inside, the roof disappears and the walls turn see-through so the camera can follow.
// The building plot: bring materials and press F to build your own house (with a storage chest).
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { ITEMS } from './inventory.js';
import { findFlatSpot } from './spots.js';

const STORAGE_KEY = 'gs-house-v1';
const W = 7;   // inner width (x)
const D = 6;   // inner depth (z)
const H = 3;   // wall height
const T = 0.3; // wall thickness
const DOOR = 1.7;

export const BUILD_COST = { wood: 12, stone: 8, glass: 3, rope: 2, cloth: 2 };

const CHEST_LOOT = [
  ['apple', 2], ['bread', 1], ['berries', 3], ['soup', 1], ['cake', 1],
  ['wood', 3], ['stone', 2], ['glass', 1], ['rope', 1], ['cloth', 1],
  ['weight', 1], ['candle', 1], ['lantern', 1]
];

function windowTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffd98a';
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#7a4f2a';
  ctx.fillRect(0, 29, 64, 6);
  ctx.fillRect(29, 0, 6, 64);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#7a4f2a';
  ctx.strokeRect(3, 3, 58, 58);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Houses {
  constructor(game, avoid = []) {
    this.game = game;
    this.state = this.load();
    this.houses = [];
    this.inside = null;
    this.lastP = game.dayNight ? game.dayNight.p : 0.1;
    const taken = avoid.slice();
    const spots = [
      { target: { x: -30, z: -14 }, colors: { wall: 0xfff1d6, roof: 0xd9534f, trim: 0x8d5a34 }, name: 'Rosenhaus' },
      { target: { x: -2, z: -34 }, colors: { wall: 0xe3f0ff, roof: 0x4f7bd9, trim: 0x6b4a2b }, name: 'Blaues Haus' }
    ];
    spots.forEach((s, i) => {
      const spot = findFlatSpot(game, { target: s.target, radius: 6.5, avoid: taken, pull: 0.12 });
      taken.push({ x: spot.x, z: spot.z, r: 9 });
      this.houses.push(this.buildHouse(spot.x, spot.z, s.colors, `house${i}`, s.name, false));
    });
    // building plot for the player's own house
    const plot = findFlatSpot(game, { target: { x: -24, z: -30 }, radius: 6.5, avoid: taken, pull: 0.12 });
    this.plot = { x: plot.x, z: plot.z };
    taken.push({ x: plot.x, z: plot.z, r: 9 });
    this.taken = taken;
    this.buildPlot();
    if (this.state.built) this.buildOwnHouse(true);
    this.wireClicks();
    this.sleepOverlay = document.getElementById('sleep-overlay');
    this.buildStorageUI();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const storage = {};
        Object.keys(p.storage || {}).forEach(k => {
          const n = Math.floor(Number(p.storage[k]));
          if (ITEMS[k] && n > 0) storage[k] = Math.min(999, n);
        });
        return { day: Math.max(0, Number(p.day) | 0), chests: p.chests && typeof p.chests === 'object' ? p.chests : {}, built: !!p.built, storage };
      }
    } catch (e) { /* storage unavailable */ }
    return { day: 0, chests: {}, built: false, storage: {} };
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  // Facing: the door points towards the middle of the valley (rounded to 90 degrees so walls stay axis aligned)
  doorRotation(x, z) {
    const a = Math.atan2(-x, -z);
    return Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  }

  buildHouse(x, z, colors, id, name, own) {
    const g = this.game;
    const rot = this.doorRotation(x, z);
    const ground = Math.max(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => g.getTerrainHeight(x + a * W / 2, z + b * D / 2)));
    const floorY = ground + 0.12;
    const group = new THREE.Group();
    group.position.set(x, floorY, z);
    group.rotation.y = rot;

    const wallMat = new THREE.MeshLambertMaterial({ color: colors.wall, transparent: true, opacity: 1 });
    const trimMat = new THREE.MeshLambertMaterial({ color: colors.trim, flatShading: true });
    const roofMat = new THREE.MeshLambertMaterial({ color: colors.roof, flatShading: true });
    const floorMat = new THREE.MeshLambertMaterial({ color: 0xc89060 });

    // floor and foundation
    const floor = new THREE.Mesh(new THREE.BoxGeometry(W + T * 2, 0.4, D + T * 2), floorMat);
    floor.position.y = -0.2;
    floor.receiveShadow = true;
    group.add(floor);

    // walls (local boxes; front wall at +z has the door gap)
    const boxes = [
      [-W / 2 - T / 2, 0, T, D + T * 2],                 // left
      [W / 2 + T / 2, 0, T, D + T * 2],                  // right
      [0, -D / 2 - T / 2, W + T * 2, T],                 // back
      [-(W / 2 + DOOR / 2) / 2 - 0.05, D / 2 + T / 2, W / 2 - DOOR / 2 + T, T], // front left
      [(W / 2 + DOOR / 2) / 2 + 0.05, D / 2 + T / 2, W / 2 - DOOR / 2 + T, T]   // front right
    ];
    const walls = [];
    boxes.forEach(([bx, bz, bw, bd]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, H, bd), wallMat);
      wall.position.set(bx, H / 2, bz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      walls.push(wall);
    });
    // lintel over the door
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR + 0.2, 0.6, T), wallMat);
    lintel.position.set(0, H - 0.3, D / 2 + T / 2);
    group.add(lintel);
    // corner beams
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.34, H + 0.1, 0.34), trimMat);
      beam.position.set(a * (W / 2 + T / 2), H / 2, b * (D / 2 + T / 2));
      group.add(beam);
    });

    // windows (glow warmly at night)
    const winMat = new THREE.MeshLambertMaterial({ map: windowTex(), emissive: 0xffb347, emissiveIntensity: 0.15 });
    winMat.userData.lantern = true;
    [[-W / 2 - T - 0.01, 0, -Math.PI / 2], [W / 2 + T + 0.01, 0, Math.PI / 2]].forEach(([wx, wz, ry]) => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), winMat);
      w.position.set(wx, 1.7, wz);
      w.rotation.y = ry;
      group.add(w);
    });

    // gable roof
    const roof = new THREE.Group();
    const span = W / 2 + T + 0.5;
    const rise = 1.9;
    const slope = Math.hypot(span, rise);
    [-1, 1].forEach(s => {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.18, D + T * 2 + 0.8), roofMat);
      panel.position.set(s * span / 2, H + rise / 2, 0);
      panel.rotation.z = -s * Math.atan2(rise, span);
      panel.castShadow = true;
      roof.add(panel);
    });
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-W / 2 - T, 0);
    gableShape.lineTo(W / 2 + T, 0);
    gableShape.lineTo(0, rise);
    gableShape.closePath();
    const gableGeo = new THREE.ShapeGeometry(gableShape);
    [-1, 1].forEach(s => {
      const gable = new THREE.Mesh(gableGeo, wallMat);
      gable.position.set(0, H, s * (D / 2 + T));
      if (s < 0) gable.rotation.y = Math.PI;
      roof.add(gable);
    });
    const chimney = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), trimMat);
    chimney.position.set(1.6, H + 1.6, -1);
    roof.add(chimney);
    group.add(roof);

    // door frame + welcome mat
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), new THREE.MeshLambertMaterial({ color: 0xff8fb1 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(0, 0.02, D / 2 + 0.9);
    group.add(mat);

    // ---- interior ----
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.4, 24), new THREE.MeshLambertMaterial({ color: own ? 0xb28cff : 0xff9ecf }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0.3, 0.02, 0.4);
    group.add(rug);

    // bed (back left)
    const bed = new THREE.Group();
    bed.position.set(-W / 2 + 1.0, 0, -D / 2 + 1.35);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.45, 2.4), trimMat);
    frame.position.y = 0.22;
    bed.add(frame);
    const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.36, 0.22, 2.25), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    mattress.position.y = 0.55;
    bed.add(mattress);
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.12, 1.5), new THREE.MeshLambertMaterial({ color: own ? 0x9b8cff : 0x7fc8ff }));
    blanket.position.set(0, 0.68, 0.35);
    bed.add(blanket);
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.45), new THREE.MeshLambertMaterial({ color: 0xfff1f6 }));
    pillow.position.set(0, 0.72, -0.85);
    bed.add(pillow);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.0, 0.15), trimMat);
    head.position.set(0, 0.6, -1.2);
    bed.add(head);
    group.add(bed);

    // chest (back right)
    const chest = new THREE.Group();
    chest.position.set(W / 2 - 0.9, 0, -D / 2 + 0.75);
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.7, 0.8), trimMat);
    body.position.y = 0.35;
    chest.add(body);
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.7, -0.4);
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.18, 0.84), new THREE.MeshLambertMaterial({ color: own ? 0xb28cff : 0xd9a066 }));
    lid.position.set(0, 0.09, 0.42);
    lidPivot.add(lid);
    chest.add(lidPivot);
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.06), new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x6a4a00 }));
    lock.position.set(0, 0.62, 0.42);
    chest.add(lock);
    group.add(chest);

    // table with two stools and a little vase
    const table = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 16), trimMat);
    table.position.set(1.5, 0.85, 0.9);
    group.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 8), trimMat);
    leg.position.set(1.5, 0.4, 0.9);
    group.add(leg);
    [[0.6, 0.9], [2.4, 0.9]].forEach(([sx, sz]) => {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.5, 10), trimMat);
      stool.position.set(sx, 0.25, sz);
      group.add(stool);
    });
    const vase = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshLambertMaterial({ color: 0x7fc8ff }));
    vase.position.set(1.5, 1.0, 0.9);
    group.add(vase);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7eb6 }));
    flower.position.set(1.5, 1.3, 0.9);
    group.add(flower);

    const lamp = new THREE.PointLight(0xffc27a, 0.7, 9, 2);
    lamp.position.set(0, H - 0.5, 0);
    lamp.userData.lantern = true;
    group.add(lamp);

    g.scene.add(group);
    group.updateMatrixWorld(true);

    // colliders: walls in world space (axis aligned because the rotation is a multiple of 90 degrees)
    const toWorld = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(x, 0, z));
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    boxes.forEach(([bx, bz, bw, bd]) => {
      const c = toWorld(bx, bz);
      const hw = (swap ? bd : bw) / 2;
      const hd = (swap ? bw : bd) / 2;
      g.colliders.push({ type: 'box', minX: c.x - hw, maxX: c.x + hw, minZ: c.z - hd, maxZ: c.z + hd, minY: floorY - 1, maxY: floorY + H + 2 });
    });
    // bed and chest are furniture you bump into
    [[bed.position, 0.75, 1.2], [chest.position, 0.6, 0.4]].forEach(([p, hw0, hd0]) => {
      const c = toWorld(p.x, p.z);
      const hw = swap ? hd0 : hw0;
      const hd = swap ? hw0 : hd0;
      g.colliders.push({ type: 'box', minX: c.x - hw, maxX: c.x + hw, minZ: c.z - hd, maxZ: c.z + hd, minY: floorY - 1, maxY: floorY + 0.8 });
    });
    // the floor is a platform, so the terrain below never pokes through
    const half = toWorld(W / 2 + T, D / 2 + T).sub(new THREE.Vector3(x, 0, z));
    g.platforms.push({ type: 'box', minX: x - Math.abs(half.x), maxX: x + Math.abs(half.x), minZ: z - Math.abs(half.z), maxZ: z + Math.abs(half.z), topY: floorY });

    return {
      id, name, own, x, z, rot, floorY, group, roof, wallMat, walls,
      bedPos: toWorld(bed.position.x, bed.position.z).setY(floorY + 0.6),
      chestPos: toWorld(chest.position.x, chest.position.z).setY(floorY + 0.5),
      bedMeshes: [frame, mattress, blanket, pillow], lidPivot, lidOpen: 0
    };
  }

  // ---------- Building plot ----------
  buildPlot() {
    const g = this.game;
    const { x, z } = this.plot;
    const y = g.getTerrainHeight(x, z);
    this.plotGroup = new THREE.Group();
    this.plotGroup.position.set(x, y, z);
    const stake = new THREE.MeshLambertMaterial({ color: 0x8d5a34 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6), stake);
      s.position.set(a * W / 2, 0.5, b * D / 2);
      this.plotGroup.add(s);
    });
    const rope = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    rope.scale.set(W / 2 * 1.414, D / 2 * 1.414, 1);
    rope.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    rope.position.y = 0.9;
    this.plotGroup.add(rope);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture('🏗️ Bauplatz'), transparent: true, depthWrite: false }));
    sign.scale.set(2.6, 0.65, 1);
    sign.position.set(0, 2.2, D / 2 + 0.6);
    this.plotGroup.add(sign);
    g.scene.add(this.plotGroup);
  }

  missingMaterials() {
    const inv = this.game.inventory;
    return Object.keys(BUILD_COST).filter(id => inv.count(id) < BUILD_COST[id]).map(id => `${ITEMS[id].icon} ${inv.count(id)}/${BUILD_COST[id]}`);
  }

  tryBuild() {
    const g = this.game;
    const missing = this.missingMaterials();
    if (missing.length) {
      g.showToast(`🏗️ Für dein Haus fehlt noch: ${missing.join(' · ')}. Materialien gibt es am Bau-Stand, in Truhen oder als Geschenk.`, 6000);
      return;
    }
    Object.keys(BUILD_COST).forEach(id => g.inventory.remove(id, BUILD_COST[id]));
    this.state.built = true;
    this.save();
    this.buildOwnHouse(false);
  }

  buildOwnHouse(silent) {
    const g = this.game;
    this.plotGroup.visible = false;
    const house = this.buildHouse(this.plot.x, this.plot.z, { wall: 0xf3e8ff, roof: 0x9b6bff, trim: 0x6b4a2b }, 'own', 'Dein Haus', true);
    this.houses.push(house);
    if (!silent) {
      const p = new THREE.Vector3(this.plot.x, house.floorY + 2, this.plot.z);
      g.fx.burst(p, [new THREE.Color(2.4, 2.0, 0.8), new THREE.Color(2.0, 1.6, 2.6)], 90, { speed: 7, up: 4, size: 0.5, life: 1.2, gravity: 4 });
      sfx.victory();
      g.showToast('🏡 Dein eigenes Haus ist fertig! Drinnen stehen ein Bett und eine Vorratstruhe.', 6000);
      g.progression.addXp(80, 'Hausbau');
      g.inventory.addCoins(25, 'Hausbau');
    }
  }

  // ---------- Interact key ----------
  getInteraction() {
    const g = this.game;
    const pp = g.playerGroup.position;
    let best = null;
    const consider = (dist, label, action) => { if (!best || dist < best.dist) best = { dist, label, action }; };
    this.houses.forEach(h => {
      const db = Math.hypot(pp.x - h.bedPos.x, pp.z - h.bedPos.z);
      if (db < 2.3) consider(db, '🛏️ Schlafen', () => this.sleep(h));
      const dc = Math.hypot(pp.x - h.chestPos.x, pp.z - h.chestPos.z);
      if (dc < 2.0) consider(dc, h.own ? '📦 Vorratstruhe' : '🧰 Truhe öffnen', () => (h.own ? this.openStorage() : this.openChest(h)));
    });
    if (!this.state.built) {
      const dp = Math.hypot(pp.x - this.plot.x, pp.z - this.plot.z);
      if (dp < 5) consider(dp, '🏗️ Haus bauen', () => this.tryBuild());
    }
    return best;
  }

  // ---------- Sleeping ----------
  canSleep() {
    const name = this.game.dayNight.phase.name;
    return name === 'Abend' || name === 'Nacht';
  }

  sleep(house, remote = false) {
    const g = this.game;
    if (!remote && !this.canSleep()) {
      g.showToast('😴 Du bist noch gar nicht müde – schlafen kannst du am Abend und in der Nacht.', 3500);
      return;
    }
    if (this.sleeping) return;
    this.sleeping = true;
    if (this.sleepOverlay) this.sleepOverlay.classList.add('visible');
    if (!remote) {
      if (house) g.playerGroup.position.set(house.bedPos.x, house.floorY, house.bedPos.z);
      g.coop.send({ t: 'sleep' });
    }
    setTimeout(() => {
      g.dayNight.p = 0.02; // a new morning
      this.newDay();
      if (!remote) {
        g.playerHP = g.maxPlayerHP;
        g.updateHPBar();
      }
      setTimeout(() => {
        if (this.sleepOverlay) this.sleepOverlay.classList.remove('visible');
        this.sleeping = false;
        g.showToast(remote ? '☀️ Eine Freundin hat geschlafen – ein neuer Morgen beginnt!' : '☀️ Gut geschlafen! Ein neuer Tag beginnt – du bist wieder ganz fit.', 4500);
        sfx.sunrise();
      }, 900);
    }, 1400);
  }

  newDay() {
    this.state.day += 1;
    this.save();
  }

  // ---------- Chests (refill every in-game day) ----------
  openChest(h) {
    const g = this.game;
    if (this.state.chests[h.id] === this.state.day) {
      g.showToast('🧰 Die Truhe ist leer. Morgen liegt bestimmt wieder etwas darin!', 3000);
      return;
    }
    this.state.chests[h.id] = this.state.day;
    this.save();
    h.lidOpen = 1;
    const picks = 2 + Math.floor(Math.random() * 2);
    const got = [];
    for (let i = 0; i < picks; i++) {
      const [id, n] = CHEST_LOOT[Math.floor(Math.random() * CHEST_LOOT.length)];
      g.inventory.add(id, n, true);
      got.push(`${ITEMS[id].icon} ${n}× ${ITEMS[id].name}`);
    }
    const coins = 3 + Math.floor(Math.random() * 6);
    g.inventory.addCoins(coins);
    sfx.collect();
    g.fx.burst(h.chestPos.clone().setY(h.chestPos.y + 0.6), [new THREE.Color(2.6, 2.0, 0.6)], 30, { speed: 3, up: 2, size: 0.35, gravity: 4 });
    g.showToast(`🧰 In der Truhe: ${got.join(', ')} und ${coins} 🪙`, 5000);
  }

  // ---------- Own house: storage chest ----------
  buildStorageUI() {
    const modal = document.createElement('div');
    modal.id = 'storage-modal';
    modal.className = 'album-modal';
    const card = document.createElement('div');
    card.className = 'album-card';
    modal.appendChild(card);
    modal.addEventListener('click', (e) => { if (e.target === modal) this.closeStorage(); });
    document.body.appendChild(modal);
    this.storageModal = modal;
    this.storageCard = card;
  }

  openStorage() {
    this.storageModal.classList.add('open');
    this.renderStorage();
  }

  closeStorage() {
    this.storageModal.classList.remove('open');
  }

  moveItem(id, toStorage) {
    const inv = this.game.inventory;
    if (toStorage) {
      if (!inv.remove(id, 1)) return;
      this.state.storage[id] = (this.state.storage[id] || 0) + 1;
    } else {
      if (!this.state.storage[id]) return;
      this.state.storage[id] -= 1;
      if (this.state.storage[id] <= 0) delete this.state.storage[id];
      inv.add(id, 1, true);
    }
    this.save();
    this.renderStorage();
  }

  renderStorage() {
    const card = this.storageCard;
    const inv = this.game.inventory;
    card.textContent = '';
    const head = document.createElement('div');
    head.className = 'album-head';
    const title = document.createElement('div');
    title.className = 'album-title';
    title.textContent = '📦 Vorratstruhe – antippen zum Ablegen / Herausnehmen';
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'album-close clickable';
    close.textContent = '✕';
    close.addEventListener('click', () => this.closeStorage());
    head.append(title, close);
    card.appendChild(head);
    const section = (label, items, toStorage) => {
      const h = document.createElement('div');
      h.className = 'album-section';
      h.textContent = label;
      card.appendChild(h);
      const grid = document.createElement('div');
      grid.className = 'album-grid';
      const ids = Object.keys(items);
      if (!ids.length) {
        const empty = document.createElement('div');
        empty.className = 'album-name';
        empty.textContent = 'leer';
        grid.appendChild(empty);
      }
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
        nm.textContent = `${it.name} ×${items[id]}`;
        cell.append(em, nm);
        cell.addEventListener('click', () => this.moveItem(id, toStorage));
        grid.appendChild(cell);
      });
      card.appendChild(grid);
    };
    section('🎒 In deiner Tasche (antippen = in die Truhe)', inv.state.items, true);
    section('📦 In der Truhe (antippen = in die Tasche)', this.state.storage, false);
  }

  // ---------- Clicking the bed ----------
  wireClicks() {
    const g = this.game;
    const el = g.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    el.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
    el.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, g.camera);
      for (const h of this.houses) {
        if (ray.intersectObjects(h.bedMeshes, false).length) {
          const d = Math.hypot(g.playerGroup.position.x - h.bedPos.x, g.playerGroup.position.z - h.bedPos.z);
          if (d < 7) this.sleep(h);
          else g.showToast('🛏️ Geh näher ans Bett, um zu schlafen.', 2500);
          return;
        }
      }
    });
  }

  // ---------- Per frame ----------
  update(delta) {
    const g = this.game;
    const pp = g.playerGroup.position;
    // new day when the clock passes midnight-morning
    const p = g.dayNight.p;
    if (this.lastP > 0.9 && p < 0.1 && !this.sleeping) this.newDay();
    this.lastP = p;

    let inside = null;
    this.houses.forEach(h => {
      // player position in the house's own frame (inverse of the Y rotation)
      const dx = pp.x - h.x;
      const dz = pp.z - h.z;
      const lx = dx * Math.cos(h.rot) - dz * Math.sin(h.rot);
      const lz = dx * Math.sin(h.rot) + dz * Math.cos(h.rot);
      const isIn = Math.abs(lx) < W / 2 + 0.2 && Math.abs(lz) < D / 2 + 0.2 && pp.y < h.floorY + H;
      if (isIn) inside = h;
      // roof off and see-through walls while inside
      const target = isIn ? 0.25 : 1;
      h.wallMat.opacity += (target - h.wallMat.opacity) * Math.min(1, delta * 8);
      h.wallMat.depthWrite = h.wallMat.opacity > 0.95;
      h.roof.visible = !isIn;
      h.lidOpen = Math.max(0, h.lidOpen - delta * 0.3);
      h.lidPivot.rotation.x = -1.6 * Math.min(1, h.lidOpen * 3);
    });
    if (inside !== this.inside) {
      this.inside = inside;
      // zoom in while indoors so trees outside do not block the view
      g.controls.maxDistance = inside ? 9 : 30;
      if (inside) g.showToast(`🏠 ${inside.name}${this.canSleep() ? ' – im Bett kannst du schlafen (F oder anklicken)' : ''}`, 3000);
    }
  }
}

function signTexture(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(122, 79, 42, 0.95)';
  ctx.beginPath();
  ctx.roundRect(4, 6, 248, 52, 14);
  ctx.fill();
  ctx.fillStyle = '#fff6dc';
  ctx.font = '800 30px "Segoe UI", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
