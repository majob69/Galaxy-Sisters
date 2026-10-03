// ==========================================
// HOUSES & BUILDING: two cosy cottages you can walk into, your own house on the building plot
// and the building land where you can put up several more things (fountain, pavilion, tower,
// berry garden, workshop, guest house - see buildings.js).
// Inside: a bed (sleep in the evening or at night: the night passes and you wake up healed)
// and a chest that holds food, materials or puzzle helpers - refilled every new day.
// While you are inside, the roof disappears and the walls turn see-through so the camera can follow.
// Your own house can get an upper floor: pay Sterntaler, bring the materials, then the builders
// need five minutes. Furniture (chairs, lamps, sofas ...) can be set up in your houses and on the land.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { ITEMS } from './inventory.js';
import { findFlatSpot } from './spots.js';
import { BUILDINGS, buildStructure, buildFurniture, buildScaffold } from './buildings.js';

const STORAGE_KEY = 'gs-house-v1';
const W = 7;   // inner width (x)
const D = 6;   // inner depth (z)
const H = 3;   // wall height per floor
const T = 0.3; // wall thickness
const DOOR = 1.7;
const GALLERY_Z = -0.6; // the upper floor is a gallery over the back of the room (z < GALLERY_Z)
const STAIR_X = 3.45;   // the stairs run along the right wall
const STAIR_STEPS = 6;

export const BUILD_COST = { wood: 12, stone: 8, glass: 3, rope: 2, cloth: 2 };
export const FLOOR2_PRICE = 60;
export const FLOOR2_COST = { wood: 14, stone: 6, glass: 4, rope: 3, door: 1, lamp: 2 };
export const FLOOR2_SECONDS = 5 * 60;
const PLOT_OFFSETS = [[0, 0], [-8.5, -6], [8.5, -6], [-8.5, 6], [8.5, 6]];
const MAX_FURNITURE = 40;

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

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const costText = (cost, inv) => Object.keys(cost).map(id => `${ITEMS[id].icon} ${inv ? `${inv.count(id)}/` : ''}${cost[id]}`).join(' · ');

export class Houses {
  constructor(game, avoid = [], buildArea = null) {
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
    // the building land with five plots for more buildings
    this.area = buildArea || { x: plot.x - 20, z: plot.z - 14 };
    this.buildLand();
    this.furniture = [];
    this.state.furniture.forEach(f => this.spawnFurniture(f));
    this.wireClicks();
    this.sleepOverlay = document.getElementById('sleep-overlay');
    this.buildStorageUI();
    this.buildMenuUI();
  }

  load() {
    const fresh = { day: 0, chests: {}, built: false, storage: {}, floor2: { stage: 0, delivered: {}, readyAt: 0 }, structures: {}, furniture: [], harvest: {}, towerTop: false };
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        const counts = (obj) => {
          const out = {};
          Object.keys(obj || {}).forEach(k => {
            const n = Math.floor(Number(obj[k]));
            if (ITEMS[k] && n > 0) out[k] = Math.min(999, n);
          });
          return out;
        };
        const f2 = p.floor2 && typeof p.floor2 === 'object' ? p.floor2 : {};
        const structures = {};
        Object.keys(p.structures || {}).forEach(k => {
          const i = Number(k);
          if (i >= 0 && i < PLOT_OFFSETS.length && BUILDINGS.some(b => b.id === p.structures[k])) structures[i] = p.structures[k];
        });
        const furniture = (Array.isArray(p.furniture) ? p.furniture : [])
          .filter(f => f && ITEMS[f.id] && ITEMS[f.id].kind === 'furniture' && [f.x, f.y, f.z, f.r].every(Number.isFinite))
          .slice(0, MAX_FURNITURE)
          .map(f => ({ id: f.id, x: f.x, y: f.y, z: f.z, r: f.r }));
        return {
          ...fresh,
          day: Math.max(0, Number(p.day) | 0),
          chests: p.chests && typeof p.chests === 'object' ? p.chests : {},
          built: !!p.built,
          storage: counts(p.storage),
          floor2: { stage: Math.max(0, Math.min(3, Number(f2.stage) | 0)), delivered: counts(f2.delivered), readyAt: Number(f2.readyAt) || 0 },
          structures,
          furniture,
          harvest: p.harvest && typeof p.harvest === 'object' ? p.harvest : {},
          towerTop: !!p.towerTop
        };
      }
    } catch (e) { /* storage unavailable */ }
    return fresh;
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  // Facing: the door points towards the middle of the valley (rounded to 90 degrees so walls stay axis aligned)
  doorRotation(x, z) {
    const a = Math.atan2(-x, -z);
    return Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  }

  buildHouse(x, z, colors, id, name, own, floors = 1) {
    const g = this.game;
    const rot = this.doorRotation(x, z);
    const ground = Math.max(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => g.getTerrainHeight(x + a * W / 2, z + b * D / 2)));
    const floorY = ground + 0.12;
    const height = H * floors;
    const group = new THREE.Group();
    group.position.set(x, floorY, z);
    group.rotation.y = rot;
    const colliders = [];
    const platforms = [];

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
      const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, height, bd), wallMat);
      wall.position.set(bx, height / 2, bz);
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
      walls.push(wall);
    });
    // lintel over the door (up to the roof on a two-storey house)
    const lintelH = height - (H - 0.6);
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(DOOR + 0.2, lintelH, T), wallMat);
    lintel.position.set(0, H - 0.6 + lintelH / 2, D / 2 + T / 2);
    group.add(lintel);
    // corner beams
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(0.34, height + 0.1, 0.34), trimMat);
      beam.position.set(a * (W / 2 + T / 2), height / 2, b * (D / 2 + T / 2));
      group.add(beam);
    });
    if (floors > 1) {
      // a wooden band between the floors
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + T * 2 + 0.12, 0.22, D + T * 2 + 0.12), trimMat);
      band.position.y = H;
      group.add(band);
    }

    // windows (glow warmly at night)
    const winMat = new THREE.MeshLambertMaterial({ map: windowTex(), emissive: 0xffb347, emissiveIntensity: 0.15 });
    winMat.userData.lantern = true;
    for (let f = 0; f < floors; f++) {
      [[-W / 2 - T - 0.01, 0, -Math.PI / 2], [W / 2 + T + 0.01, 0, Math.PI / 2]].forEach(([wx, wz, ry]) => {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), winMat);
        w.position.set(wx, 1.7 + f * H, wz);
        w.rotation.y = ry;
        group.add(w);
      });
      if (f > 0) {
        [-1.8, 1.8].forEach(wx => {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.9), winMat);
          w.position.set(wx, 1.6 + f * H, D / 2 + T + 0.01);
          group.add(w);
        });
      }
    }

    // gable roof
    const roof = new THREE.Group();
    roof.position.y = height - H;
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
    table.position.set(1.3, 0.85, 0.9);
    group.add(table);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.8, 8), trimMat);
    leg.position.set(1.3, 0.4, 0.9);
    group.add(leg);
    [[0.4, 0.9], [1.3, 1.85]].forEach(([sx, sz]) => {
      const stool = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.24, 0.5, 10), trimMat);
      stool.position.set(sx, 0.25, sz);
      group.add(stool);
    });
    const vase = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshLambertMaterial({ color: 0x7fc8ff }));
    vase.position.set(1.3, 1.0, 0.9);
    group.add(vase);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff7eb6 }));
    flower.position.set(1.3, 1.3, 0.9);
    group.add(flower);

    // ---- upper floor: a gallery over the back half, reached by stairs along the right wall ----
    const stepBoxes = [];
    if (floors > 1) {
      const galleryDepth = GALLERY_Z + D / 2;
      const gallery = new THREE.Mesh(new THREE.BoxGeometry(W, 0.2, galleryDepth), floorMat);
      gallery.position.set(0, H - 0.1, -D / 2 + galleryDepth / 2);
      gallery.receiveShadow = true;
      group.add(gallery);
      // railing along the gallery edge (open where the stairs arrive)
      const railLen = W - 1.0;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(railLen, 0.08, 0.08), trimMat);
      rail.position.set(-0.5, H + 0.9, GALLERY_Z);
      group.add(rail);
      for (let i = 0; i <= 6; i++) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.9, 0.07), trimMat);
        post.position.set(-W / 2 + 0.05 + (railLen / 6) * i, H + 0.45, GALLERY_Z);
        group.add(post);
      }
      const stairMat = new THREE.MeshLambertMaterial({ color: 0xb07a45, flatShading: true });
      const rise = H / STAIR_STEPS;
      for (let i = 0; i < STAIR_STEPS; i++) {
        const z1 = D / 2 - 0.6 - i * 0.5;
        const top = (i + 1) * rise;
        const step = new THREE.Mesh(new THREE.BoxGeometry(0.85, top, 0.5), stairMat);
        step.position.set(STAIR_X - 0.45, top / 2, z1 - 0.25);
        group.add(step);
        stepBoxes.push({ lx: STAIR_X - 0.45, lz: z1 - 0.25, hw: 0.43, hd: 0.25, top });
      }
      // upstairs: a cosy reading corner with a lamp
      const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 14), new THREE.MeshLambertMaterial({ color: 0xff9ecf }));
      cushion.position.set(-2.4, H + 0.12, -2.1);
      group.add(cushion);
      const rug2 = new THREE.Mesh(new THREE.CircleGeometry(1.0, 20), new THREE.MeshLambertMaterial({ color: 0x7fc8ff }));
      rug2.rotation.x = -Math.PI / 2;
      rug2.position.set(-0.6, H + 0.02, -1.8);
      group.add(rug2);
      const lamp2 = new THREE.PointLight(0xffc27a, 0.6, 7, 2);
      lamp2.position.set(0, H + 2.2, -1.8);
      lamp2.userData.lantern = true;
      group.add(lamp2);
    }

    const lamp = new THREE.PointLight(0xffc27a, 0.7, 9, 2);
    lamp.position.set(0, H - 0.5, 0.8);
    lamp.userData.lantern = true;
    group.add(lamp);

    g.scene.add(group);
    group.updateMatrixWorld(true);

    // colliders: walls in world space (axis aligned because the rotation is a multiple of 90 degrees)
    const toWorld = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), rot).add(new THREE.Vector3(x, 0, z));
    const swap = Math.abs(Math.sin(rot)) > 0.5;
    const worldBox = (lx, lz, hw0, hd0) => {
      const c = toWorld(lx, lz);
      const hw = swap ? hd0 : hw0;
      const hd = swap ? hw0 : hd0;
      return { minX: c.x - hw, maxX: c.x + hw, minZ: c.z - hd, maxZ: c.z + hd };
    };
    const pushCollider = (c) => { g.colliders.push(c); colliders.push(c); };
    const pushPlatform = (p) => { g.platforms.push(p); platforms.push(p); };
    boxes.forEach(([bx, bz, bw, bd]) => pushCollider({ type: 'box', ...worldBox(bx, bz, bw / 2, bd / 2), minY: floorY - 1, maxY: floorY + height + 2 }));
    // bed and chest are furniture you bump into
    [[bed.position, 0.75, 1.2], [chest.position, 0.6, 0.4]].forEach(([p, hw0, hd0]) => pushCollider({ type: 'box', ...worldBox(p.x, p.z, hw0, hd0), minY: floorY - 1, maxY: floorY + 0.8 }));
    // the floor is a platform, so the terrain below never pokes through
    pushPlatform({ type: 'box', ...worldBox(0, 0, W / 2 + T, D / 2 + T), topY: floorY });
    if (floors > 1) {
      const galleryDepth = GALLERY_Z + D / 2;
      pushPlatform({ type: 'box', ...worldBox(0, -D / 2 + galleryDepth / 2, W / 2, galleryDepth / 2), topY: floorY + H });
      stepBoxes.forEach(s => pushPlatform({ type: 'box', ...worldBox(s.lx, s.lz, s.hw, s.hd), topY: floorY + s.top }));
      // the railing keeps you from walking off the gallery (only up there)
      pushCollider({ type: 'box', ...worldBox(-0.5, GALLERY_Z, (W - 1.0) / 2, 0.08), minY: floorY + H - 0.2, maxY: floorY + H + 1.1 });
    }

    return {
      id, name, own, x, z, rot, floorY, height, floors, group, roof, wallMat, walls, colliders, platforms,
      bedPos: toWorld(bed.position.x, bed.position.z).setY(floorY + 0.6),
      chestPos: toWorld(chest.position.x, chest.position.z).setY(floorY + 0.5),
      doorPos: toWorld(0, D / 2 + 1.3).setY(floorY),
      bedMeshes: [frame, mattress, blanket, pillow], lidPivot, lidOpen: 0
    };
  }

  removeHouse(h) {
    const g = this.game;
    g.scene.remove(h.group);
    const drop = (arr, gone) => { for (let i = arr.length - 1; i >= 0; i--) if (gone.includes(arr[i])) arr.splice(i, 1); };
    drop(g.colliders, h.colliders);
    drop(g.platforms, h.platforms);
    this.houses = this.houses.filter(x => x !== h);
  }

  // ---------- Building plot for your own house ----------
  buildPlot() {
    const g = this.game;
    const { x, z } = this.plot;
    const y = g.getTerrainHeight(x, z);
    this.plotGroup = new THREE.Group();
    this.plotGroup.position.set(x, y, z);
    this.addPlotMarker(this.plotGroup, '🏗️ Bauplatz');
    g.scene.add(this.plotGroup);
  }

  addPlotMarker(group, label) {
    const stake = new THREE.MeshLambertMaterial({ color: 0x8d5a34 });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([a, b]) => {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 6), stake);
      s.position.set(a * W / 2, 0.5, b * D / 2);
      group.add(s);
    });
    const rope = new THREE.Mesh(new THREE.TorusGeometry(1, 0.02, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
    rope.scale.set(W / 2 * 1.414, D / 2 * 1.414, 1);
    rope.rotation.set(Math.PI / 2, 0, Math.PI / 4);
    rope.position.y = 0.9;
    group.add(rope);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture(label), transparent: true, depthWrite: false }));
    sign.scale.set(2.6, 0.65, 1);
    sign.position.set(0, 2.2, D / 2 + 0.6);
    group.add(sign);
  }

  missingMaterials(cost = BUILD_COST) {
    const inv = this.game.inventory;
    return Object.keys(cost).filter(id => inv.count(id) < cost[id]).map(id => `${ITEMS[id].icon} ${inv.count(id)}/${cost[id]}`);
  }

  pay(cost) {
    Object.keys(cost).forEach(id => this.game.inventory.remove(id, cost[id]));
  }

  tryBuild() {
    const g = this.game;
    const missing = this.missingMaterials();
    if (missing.length) {
      g.showToast(`🏗️ Für dein Haus fehlt noch: ${missing.join(' · ')}. Materialien gibt es am Bau-Stand, in Truhen oder als Geschenk.`, 6000);
      return;
    }
    this.pay(BUILD_COST);
    this.state.built = true;
    this.save();
    this.buildOwnHouse(false);
  }

  get ownHouse() {
    return this.houses.find(h => h.id === 'own') || null;
  }

  buildOwnHouse(silent) {
    const g = this.game;
    this.plotGroup.visible = false;
    const floors = this.state.floor2.stage >= 3 ? 2 : 1;
    const house = this.buildHouse(this.plot.x, this.plot.z, { wall: 0xf3e8ff, roof: 0x9b6bff, trim: 0x6b4a2b }, 'own', 'Dein Haus', true, floors);
    this.houses.push(house);
    if (this.state.floor2.stage === 2) this.showScaffold(house);
    if (!silent) {
      const p = new THREE.Vector3(this.plot.x, house.floorY + 2, this.plot.z);
      g.fx.burst(p, [new THREE.Color(2.4, 2.0, 0.8), new THREE.Color(2.0, 1.6, 2.6)], 90, { speed: 7, up: 4, size: 0.5, life: 1.2, gravity: 4 });
      sfx.victory();
      g.showToast('🏡 Dein eigenes Haus ist fertig! Drinnen stehen ein Bett und eine Vorratstruhe. An der Tür kannst du später ein Obergeschoss ausbauen.', 6500);
      g.progression.addXp(80, 'Hausbau');
      g.inventory.addCoins(25, 'Hausbau');
    }
  }

  // ---------- Upper floor: Sterntaler -> materials -> five minutes of building ----------
  floor2Step() {
    const g = this.game;
    const f2 = this.state.floor2;
    const inv = g.inventory;
    if (f2.stage === 0) {
      if (!inv.spendCoins(FLOOR2_PRICE)) {
        g.showToast(`🪙 Ein Obergeschoss kostet ${FLOOR2_PRICE} Sterntaler – dir fehlen noch ${FLOOR2_PRICE - inv.coins}.`, 4000);
        return;
      }
      f2.stage = 1;
      this.save();
      sfx.collect();
      g.showToast(`📜 Bauauftrag erteilt (−${FLOOR2_PRICE} 🪙)! Jetzt brauchen die Handwerker: ${costText(FLOOR2_COST)}. Bring alles hierher zur Tür.`, 7000);
      return;
    }
    if (f2.stage === 1) {
      let gave = 0;
      Object.keys(FLOOR2_COST).forEach(id => {
        const need = FLOOR2_COST[id] - (f2.delivered[id] || 0);
        const n = Math.min(need, inv.count(id));
        if (n > 0) {
          inv.remove(id, n);
          f2.delivered[id] = (f2.delivered[id] || 0) + n;
          gave += n;
        }
      });
      const missing = Object.keys(FLOOR2_COST).filter(id => (f2.delivered[id] || 0) < FLOOR2_COST[id]);
      if (!missing.length) {
        f2.stage = 2;
        f2.readyAt = Date.now() + FLOOR2_SECONDS * 1000;
        this.save();
        sfx.victory();
        this.showScaffold(this.ownHouse);
        g.showToast('🔨 Alle Materialien sind da! Die Handwerker bauen jetzt dein Obergeschoss – in 5 Minuten ist es fertig.', 6000);
        return;
      }
      this.save();
      const left = missing.map(id => `${ITEMS[id].icon} ${f2.delivered[id] || 0}/${FLOOR2_COST[id]}`).join(' · ');
      g.showToast(gave ? `📦 ${gave} Teile abgegeben. Es fehlt noch: ${left}` : `📦 Für das Obergeschoss fehlt noch: ${left}. Möbel wie Tür und Lampe baust du an der Werkbank (I → 🔨).`, 6000);
      return;
    }
    if (f2.stage === 2) g.showToast(`⏳ Die Handwerker hämmern fleißig … noch ${fmtTime(this.floor2Remaining())}.`, 3000);
  }

  floor2Remaining() {
    return Math.max(0, (this.state.floor2.readyAt - Date.now()) / 1000);
  }

  showScaffold(house) {
    if (!house || this.scaffold) return;
    const g = this.game;
    const s = buildScaffold(W + T * 2, D + T * 2, H * 2 + 0.6);
    s.position.set(house.x, house.floorY, house.z);
    s.rotation.y = house.rot;
    this.scaffoldSign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture('⏳ 5:00'), transparent: true, depthWrite: false }));
    this.scaffoldSign.scale.set(2.6, 0.65, 1);
    this.scaffoldSign.position.set(0, H * 2 + 1.6, D / 2 + 1);
    s.add(this.scaffoldSign);
    g.scene.add(s);
    this.scaffold = s;
  }

  finishFloor2() {
    const g = this.game;
    const f2 = this.state.floor2;
    f2.stage = 3;
    this.save();
    if (this.scaffold) { g.scene.remove(this.scaffold); this.scaffold = null; }
    const old = this.ownHouse;
    if (old) this.removeHouse(old);
    const house = this.buildHouse(this.plot.x, this.plot.z, { wall: 0xf3e8ff, roof: 0x9b6bff, trim: 0x6b4a2b }, 'own', 'Dein Haus', true, 2);
    this.houses.push(house);
    this.inside = null;
    g.fx.burst(new THREE.Vector3(house.x, house.floorY + H * 2 + 1, house.z), [new THREE.Color(2.4, 2.0, 0.8), new THREE.Color(2.0, 1.6, 2.6)], 120, { speed: 8, up: 5, size: 0.5, life: 1.3, gravity: 4 });
    sfx.victory();
    g.showToast('🏰 Dein Obergeschoss ist fertig! Eine Treppe an der rechten Wand führt hinauf.', 6500);
    g.progression.addXp(120, 'Obergeschoss');
  }

  // ---------- Building land: five plots for more buildings ----------
  buildLand() {
    const g = this.game;
    const { x: cx, z: cz } = this.area;
    this.plots = PLOT_OFFSETS.map(([ox, oz], i) => {
      const x = cx + ox;
      const z = cz + oz;
      const ground = Math.max(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]].map(([a, b]) => g.getTerrainHeight(x + a * 3, z + b * 3)));
      const marker = new THREE.Group();
      marker.position.set(x, g.getTerrainHeight(x, z), z);
      this.addPlotMarker(marker, `🏗️ Bauland ${i + 1}`);
      g.scene.add(marker);
      return { i, x, z, y: ground, marker, built: null };
    });
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: signTexture('🧱 Bauland'), transparent: true, depthWrite: false }));
    sign.scale.set(3.4, 0.85, 1);
    sign.position.set(cx, g.getTerrainHeight(cx, cz + 13) + 3.2, cz + 13);
    g.scene.add(sign);
    Object.keys(this.state.structures).forEach(k => this.placeStructure(this.plots[k], this.state.structures[k]));
  }

  placeStructure(plot, id) {
    const g = this.game;
    plot.marker.visible = false;
    if (id === 'guesthouse') {
      const h = this.buildHouse(plot.x, plot.z, { wall: 0xe8fff1, roof: 0x4fbf8a, trim: 0x6b4a2b }, `guest${plot.i}`, 'Gästehaus', true);
      this.houses.push(h);
      plot.built = { id, house: h };
      return;
    }
    const s = buildStructure(id);
    const rot = Math.atan2(this.area.x - plot.x, this.area.z - plot.z);
    s.group.position.set(plot.x, plot.y, plot.z);
    s.group.rotation.y = plot.i === 0 ? 0 : rot;
    g.scene.add(s.group);
    const toWorld = (lx, lz) => new THREE.Vector3(lx, 0, lz).applyAxisAngle(new THREE.Vector3(0, 1, 0), s.group.rotation.y).add(new THREE.Vector3(plot.x, 0, plot.z));
    s.colliders.forEach(c => {
      const p = toWorld(c.x, c.z);
      if (c.type === 'cylinder') g.colliders.push({ type: 'cylinder', x: p.x, z: p.z, radius: c.radius, minY: plot.y - 1, maxY: plot.y + c.h });
      else {
        const r = Math.max(c.hw, c.hd);
        g.colliders.push({ type: 'cylinder', x: p.x, z: p.z, radius: r * 0.9, minY: plot.y - 1, maxY: plot.y + c.h });
      }
    });
    s.platforms.forEach(pl => {
      const p = toWorld(pl.x, pl.z);
      if (pl.type === 'cylinder') g.platforms.push({ type: 'cylinder', x: p.x, z: p.z, radius: pl.radius, topY: plot.y + pl.top });
      else g.platforms.push({ type: 'box', minX: p.x - pl.hw, maxX: p.x + pl.hw, minZ: p.z - pl.hd, maxZ: p.z + pl.hd, topY: plot.y + pl.top });
    });
    plot.built = { id, ...s };
  }

  build(plotIndex, id) {
    const g = this.game;
    const plot = this.plots[plotIndex];
    const def = BUILDINGS.find(b => b.id === id);
    if (!plot || !def || plot.built) return false;
    if (Object.values(this.state.structures).includes(id)) { g.showToast(`${def.icon} ${def.name} steht schon auf deinem Bauland.`, 3000); return false; }
    const missing = this.missingMaterials(def.cost);
    if (missing.length) {
      g.showToast(`🧱 Für ${def.icon} ${def.name} fehlt noch: ${missing.join(' · ')}`, 5000);
      return false;
    }
    this.pay(def.cost);
    this.state.structures[plotIndex] = id;
    this.save();
    this.placeStructure(plot, id);
    g.fx.burst(new THREE.Vector3(plot.x, plot.y + 2, plot.z), [new THREE.Color(2.4, 2.0, 0.8), new THREE.Color(1.6, 2.4, 1.2)], 80, { speed: 6, up: 4, size: 0.45, life: 1.1, gravity: 4 });
    sfx.victory();
    g.showToast(`${def.icon} ${def.name} gebaut! ${def.desc}`, 5000);
    g.progression.addXp(50, def.name);
    this.closeMenu();
    return true;
  }

  // daily harvest from the garden and the workshop's wood pile
  harvest(plot) {
    const g = this.game;
    const key = `p${plot.i}`;
    if (this.state.harvest[key] === this.state.day) {
      g.showToast(plot.built.id === 'garden' ? '🌻 Heute ist schon alles geerntet – morgen wächst neues nach.' : '🪵 Das Holz für heute hast du schon geholt.', 3000);
      return;
    }
    this.state.harvest[key] = this.state.day;
    this.save();
    if (plot.built.id === 'garden') {
      g.inventory.add('berries', 3, true);
      g.inventory.add('apple', 1, true);
      g.showToast('🌻 Geerntet: 3 🫐 Sternbeeren und 1 🍎 Apfel', 3500);
    } else {
      g.inventory.add('wood', 3, true);
      g.showToast('🪵 3 Holz aus der Werkstatt geholt', 3000);
    }
    sfx.collect();
  }

  // ---------- Furniture ----------
  canFurnishHere() {
    const pp = this.game.playerGroup.position;
    if (this.inside && this.inside.own) return true;
    return Math.hypot(pp.x - this.area.x, pp.z - this.area.z) < 20;
  }

  placeFurniture(id) {
    const g = this.game;
    if (!this.canFurnishHere()) {
      g.showToast('🪑 Möbel kannst du in deinem eigenen Haus oder auf dem Bauland aufstellen.', 4000);
      return false;
    }
    if (this.state.furniture.length >= MAX_FURNITURE) {
      g.showToast('🪑 Hier ist kein Platz mehr – heb erst ein anderes Möbelstück auf.', 3500);
      return false;
    }
    const pp = g.playerGroup.position;
    const ry = g.playerGroup.rotation.y;
    const f = { id, x: pp.x + Math.sin(ry) * 1.2, y: pp.y, z: pp.z + Math.cos(ry) * 1.2, r: ry + Math.PI };
    this.state.furniture.push(f);
    this.save();
    this.spawnFurniture(f);
    sfx.collect();
    g.showToast(`${ITEMS[id].icon} ${ITEMS[id].name} aufgestellt! (F daneben: wieder aufheben)`, 3000);
    return true;
  }

  spawnFurniture(f) {
    const mesh = buildFurniture(f.id);
    mesh.position.set(f.x, f.y, f.z);
    mesh.rotation.y = f.r;
    this.game.scene.add(mesh);
    this.furniture.push({ data: f, mesh });
  }

  pickUpFurniture(item) {
    const g = this.game;
    g.scene.remove(item.mesh);
    this.furniture = this.furniture.filter(x => x !== item);
    this.state.furniture = this.state.furniture.filter(x => x !== item.data);
    this.save();
    g.inventory.add(item.data.id, 1, true);
    g.showToast(`${ITEMS[item.data.id].icon} ${ITEMS[item.data.id].name} wieder eingepackt`, 2500);
  }

  // ---------- Interact key ----------
  getInteraction() {
    const g = this.game;
    const pp = g.playerGroup.position;
    let best = null;
    const consider = (dist, label, action) => { if (!best || dist < best.dist) best = { dist, label, action }; };
    const level = (y) => Math.abs(pp.y - y) < 1.6;
    this.houses.forEach(h => {
      const db = Math.hypot(pp.x - h.bedPos.x, pp.z - h.bedPos.z);
      if (db < 2.3 && level(h.floorY)) consider(db, '🛏️ Schlafen', () => this.sleep(h));
      const dc = Math.hypot(pp.x - h.chestPos.x, pp.z - h.chestPos.z);
      if (dc < 2.0 && level(h.floorY)) consider(dc, h.own ? '📦 Vorratstruhe' : '🧰 Truhe öffnen', () => (h.own ? this.openStorage() : this.openChest(h)));
    });
    if (!this.state.built) {
      const dp = Math.hypot(pp.x - this.plot.x, pp.z - this.plot.z);
      if (dp < 5) consider(dp, '🏗️ Haus bauen', () => this.tryBuild());
    }
    const own = this.ownHouse;
    if (own && this.state.floor2.stage < 3) {
      const dd = Math.hypot(pp.x - own.doorPos.x, pp.z - own.doorPos.z);
      const st = this.state.floor2.stage;
      const label = st === 0 ? `🏗️ Obergeschoss ausbauen (${FLOOR2_PRICE} 🪙)` : st === 1 ? '📦 Material fürs Obergeschoss abgeben' : `⏳ Obergeschoss: noch ${fmtTime(this.floor2Remaining())}`;
      if (dd < 2.2) consider(dd + 0.3, label, () => this.floor2Step());
    }
    (this.plots || []).forEach(p => {
      const d = Math.hypot(pp.x - p.x, pp.z - p.z);
      if (!p.built) {
        if (d < 4.2) consider(d + 0.5, `🧱 Bauland ${p.i + 1}: etwas bauen`, () => this.openMenu(p.i));
      } else if (p.built.id === 'garden' && d < 3.6) consider(d, '🌻 Ernten', () => this.harvest(p));
      else if (p.built.id === 'workshop' && d < 3.6) {
        consider(d, '🔨 Werkbank', () => g.inventory.toggle(true, 'craft'));
        if (this.state.harvest[`p${p.i}`] !== this.state.day) consider(d - 0.01, '🪵 Holz holen', () => this.harvest(p));
      }
    });
    this.furniture.forEach(f => {
      const d = Math.hypot(pp.x - f.data.x, pp.z - f.data.z);
      if (d < 1.4 && level(f.data.y)) consider(d + 0.4, `${ITEMS[f.data.id].icon} ${ITEMS[f.data.id].name} aufheben`, () => this.pickUpFurniture(f));
    });
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

  // ---------- Building menu (building land) ----------
  buildMenuUI() {
    const modal = document.createElement('div');
    modal.id = 'build-modal';
    modal.className = 'album-modal shop-modal';
    const card = document.createElement('div');
    card.className = 'album-card';
    modal.appendChild(card);
    modal.addEventListener('click', (e) => { if (e.target === modal) this.closeMenu(); });
    document.body.appendChild(modal);
    this.menuModal = modal;
    this.menuCard = card;
  }

  openMenu(plotIndex) {
    this.menuPlot = plotIndex;
    this.menuModal.classList.add('open');
    this.renderMenu();
  }

  closeMenu() {
    this.menuPlot = null;
    this.menuModal.classList.remove('open');
  }

  renderMenu() {
    const g = this.game;
    const inv = g.inventory;
    const card = this.menuCard;
    card.textContent = '';
    const head = document.createElement('div');
    head.className = 'album-head';
    const title = document.createElement('div');
    title.className = 'album-title';
    title.textContent = `🧱 Bauland ${this.menuPlot + 1} – was möchtest du bauen?`;
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'album-close clickable';
    close.textContent = '✕';
    close.addEventListener('click', () => this.closeMenu());
    head.append(title, close);
    card.appendChild(head);
    const list = document.createElement('div');
    list.className = 'shop-list';
    const builtIds = Object.values(this.state.structures);
    BUILDINGS.forEach(b => {
      const row = document.createElement('div');
      row.className = 'shop-row';
      const icon = document.createElement('span');
      icon.className = 'shop-icon';
      icon.textContent = b.icon;
      const info = document.createElement('div');
      info.className = 'shop-info';
      const nm = document.createElement('b');
      nm.textContent = b.name;
      const desc = document.createElement('div');
      desc.className = 'shop-desc';
      desc.textContent = `${b.desc} · ${costText(b.cost, inv)}`;
      info.append(nm, desc);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-buy clickable';
      btn.dataset.build = b.id;
      const done = builtIds.includes(b.id);
      btn.textContent = done ? '✓ steht' : '🧱 Bauen';
      btn.disabled = done || !inv.has(b.cost);
      btn.addEventListener('click', () => this.build(this.menuPlot, b.id));
      row.append(icon, info, btn);
      list.appendChild(row);
    });
    card.appendChild(list);
    const tip = document.createElement('div');
    tip.className = 'album-section';
    tip.textContent = '💡 Tür, Lampe und Tisch baust du an der Werkbank (I → 🔨) oder kaufst sie bei Brummo.';
    card.appendChild(tip);
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
    const t = g.clock.elapsedTime;
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
      const isIn = Math.abs(lx) < W / 2 + 0.2 && Math.abs(lz) < D / 2 + 0.2 && pp.y < h.floorY + h.height;
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

    // upper floor under construction
    const f2 = this.state.floor2;
    if (f2.stage === 2) {
      const left = this.floor2Remaining();
      if (left <= 0) this.finishFloor2();
      else if (this.scaffoldSign && Math.floor(left) !== this._signSec) {
        this._signSec = Math.floor(left);
        this.scaffoldSign.material.map.dispose();
        this.scaffoldSign.material.map = signTexture(`⏳ ${fmtTime(left)}`);
      }
    }

    // buildings on the land: the fountain heals, the pavilion glows at night, the tower rewards climbers
    (this.plots || []).forEach(pl => {
      const b = pl.built;
      if (!b) return;
      const d = Math.hypot(pp.x - pl.x, pp.z - pl.z);
      if (b.id === 'fountain') {
        b.extra.star.rotation.y += delta * 1.5;
        b.extra.star.position.y = 2.75 + Math.sin(t * 2) * 0.12;
        if (d < 3.6 && !g.isDowned && g.playerHP < g.maxPlayerHP) {
          this.healAcc = (this.healAcc || 0) + delta * 4;
          if (this.healAcc >= 1) {
            const n = Math.floor(this.healAcc);
            this.healAcc -= n;
            g.playerHP = Math.min(g.maxPlayerHP, g.playerHP + n);
            g.updateHPBar();
            if (Math.random() < 0.3) g.fx.burst(pp.clone().setY(pp.y + 1), [new THREE.Color(0.8, 1.8, 2.4)], 4, { speed: 1, up: 1.5, size: 0.25, gravity: -1 });
          }
        }
      } else if (b.id === 'gazebo') {
        b.extra.bulb.material.color.setScalar(0.6 + (g.dayNight.night || 0) * 2);
        if (d < 2.6 && !g.isDowned && g.playerHP < g.maxPlayerHP) {
          this.restAcc = (this.restAcc || 0) + delta * 1.5;
          if (this.restAcc >= 1) { this.restAcc -= 1; g.playerHP = Math.min(g.maxPlayerHP, g.playerHP + 1); g.updateHPBar(); }
        }
      } else if (b.id === 'tower' && !this.state.towerTop && d < 2.2 && pp.y > pl.y + b.extra.top - 0.3) {
        this.state.towerTop = true;
        this.save();
        sfx.victory();
        g.showToast('🗼 Was für eine Aussicht! Von hier oben siehst du das ganze Himmelsgebirge.', 5000);
        g.progression.addXp(40, 'Aussichtsturm');
        g.inventory.addCoins(10, 'Aussicht');
      }
    });
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
