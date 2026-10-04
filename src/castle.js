// ==========================================
// THE STAR CASTLE (fourth world): a castle on a floating cloud island in eternal golden dusk.
// Once Morvanta is beaten, a star portal opens in the middle of the enchanted forest.
// In the throne yard waits UMBRA, the star eater, behind a shadow shield. Four seals surround
// her - one per sister: the seal lights up when its sister casts a spell next to it (alone you
// switch sisters with 1-4). When all four shine at the same time, the shield breaks for a while.
// Attacks: Sternenregen (marked circles), Schattenkugeln (homing orbs - shoot them down) and the
// Finsterring (a dark ring wave - jump over it). Host-authoritative in co-op, like Morvanta.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { simplex2, smoothstep } from './landscape.js';
import { CASTLE_PORTAL, forestHeight } from './forest.js';
import { createShieldMaterial } from './magicfx.js';
import { createSoftSpriteTexture } from './water.js';
import { bakeStaticGroup } from './bake.js';

export const CASTLE = { x: -600, z: 0, r: 52, y: 30 };
const STORAGE_KEY = 'gs-castle-v1';
const ARENA_R = 20;
const SEAL_R = 14;
const SEAL_TIME = 20;
const STUN_TIME = 12;
const MAX_HP = 600;
const ZONE_R = 3;
const ZONE_FUSE = 1.5;
const ZONE_LIFE = 2.0;
const ZONE_DMG = 15;
const ORB_DMG = 12;
const ORB_SPEED = 3.6;
const ORB_LIFE = 11;
const RING_SPEED = 9;
const RING_DMG = 14;
const SEAL_COLORS = [[0.8, 1.5, 2.6], [2.6, 2.2, 0.6], [2.8, 1.2, 0.3], [1.8, 0.8, 2.8]];
const SEAL_ICONS = ['🌙', '⭐', '☀️', '🪐'];
const SEAL_NAMES = ['Mondsiegel (Luna)', 'Sternensiegel (Stella)', 'Sonnensiegel (Sol)', 'Planetensiegel (Planeta)'];
const r2 = (v) => Math.round(v * 100) / 100;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export function inCastleArea(x) {
  return x < -300;
}

export function castleHeight(x, z) {
  const lx = x - CASTLE.x;
  const lz = z - CASTLE.z;
  const r = Math.hypot(lx, lz);
  let h = CASTLE.y;
  // gentle meadow outside the castle walls, flat inside
  h += smoothstep(30, 40, r) * simplex2(lx * 0.06, lz * 0.06) * 0.6;
  // the island ends in a cliff of clouds
  h -= smoothstep(CASTLE.r - 1, CASTLE.r + 6, r) * 30;
  return h;
}

function emojiTex(text, size = 64, font = 48) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.font = `${font}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size / 2, size / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTex(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(90, 50, 20, 0.92)';
  ctx.beginPath();
  ctx.roundRect(4, 6, 248, 52, 14);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.font = '800 28px "Segoe UI", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function mosaicTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const ctx = c.getContext('2d');
  ctx.translate(256, 256);
  const grad = ctx.createRadialGradient(0, 0, 10, 0, 0, 256);
  grad.addColorStop(0, '#fff2c4');
  grad.addColorStop(0.6, '#f2c6ff');
  grad.addColorStop(1, '#b48cff');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 256, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.lineWidth = 6;
  [240, 190, 120].forEach(r => { ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke(); });
  ctx.fillStyle = 'rgba(255, 215, 110, 0.9)';
  ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const r = i % 2 === 0 ? 110 : 45;
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class StarCastle {
  constructor(game) {
    this.game = game;
    this.state = this.load();
    this.inCastle = false;
    this.arrival = { x: CASTLE.x, z: CASTLE.z + 44 };
    this.d = {
      st: 'sleep', hp: MAX_HP, maxHp: MAX_HP, alive: !this.state.defeated, awake: false, timer: 0,
      seals: [0, 0, 0, 0], zones: [], orbs: [], zid: 0, ringR: -1, attackIdx: 0
    };
    this.pos = new THREE.Vector3(CASTLE.x, CASTLE.y + 4.5, CASTLE.z);
    this.hitPoint = new THREE.Vector3();
    this.zoneHits = new Set();
    this.orbHits = new Set();
    this.ringHit = false;
    this.msg = null;
    this.root = new THREE.Group();
    this.buildIsland();
    this.buildCastle();
    this.buildArena();
    this.buildBoss();
    this.buildPortals();
    this.buildBanner();
    game.scene.add(this.root);
    this.overlay = document.getElementById('travel-overlay');
    if (this.state.defeated) this.showFreed();
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return { defeated: !!JSON.parse(raw).defeated };
    } catch (e) { /* storage unavailable */ }
    return { defeated: false };
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  get unlocked() {
    const q = this.game.quests;
    return !!(q && q.state.done.morvanta) || this.forceUnlock === true;
  }

  get puppet() { return this.game.coop.puppetBoss; }
  get myId() { return this.game.coop.active ? this.game.coop.net.id : 0; }
  get hittable() { return this.d.alive && this.d.awake && this.d.st === 'stunned'; }
  get wantsBossMusic() { return this.inCastle && this.d.alive && this.d.awake; }

  groundAt(x, z) {
    return castleHeight(x, z);
  }

  // ---------- The island ----------
  buildIsland() {
    const size = 140;
    const geo = new THREE.PlaneGeometry(size, size, 90, 90);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(0x9fd86a);
    const gold = new THREE.Color(0xffe39a);
    const stone = new THREE.Color(0xe8dcff);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + CASTLE.x;
      const z = pos.getZ(i) + CASTLE.z;
      pos.setY(i, castleHeight(x, z));
      const r = Math.hypot(x - CASTLE.x, z - CASTLE.z);
      tmp.copy(grass).lerp(gold, smoothstep(-0.3, 0.7, simplex2(x * 0.05, z * 0.05)) * 0.5);
      if (r < 33) tmp.copy(stone);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.position.set(CASTLE.x, 0, CASTLE.z);
    ground.receiveShadow = true;
    this.root.add(ground);
    // the rocky underside of the floating island
    const under = new THREE.Mesh(new THREE.ConeGeometry(CASTLE.r + 2, 60, 18, 3), new THREE.MeshLambertMaterial({ color: 0x9c8cc8, flatShading: true }));
    under.rotation.x = Math.PI;
    under.position.set(CASTLE.x, CASTLE.y - 34, CASTLE.z);
    this.root.add(under);
    // soft clouds around the island
    const cloudTex = createSoftSpriteTexture();
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2;
      const r = CASTLE.r + 6 + (i % 3) * 7;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, color: 0xffe6f4, transparent: true, opacity: 0.9, depthWrite: false }));
      s.scale.set(24 + (i % 4) * 6, 10 + (i % 3) * 3, 1);
      s.position.set(CASTLE.x + Math.cos(a) * r, CASTLE.y - 6 - (i % 4) * 3, CASTLE.z + Math.sin(a) * r);
      this.root.add(s);
    }
  }

  // ---------- Walls, towers, keep, rainbow path ----------
  buildCastle() {
    const g = this.game;
    const statics = new THREE.Group();
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xf6efff, flatShading: true });
    const trim = new THREE.MeshLambertMaterial({ color: 0xffd36e, flatShading: true });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x9b6bff, flatShading: true });
    const roofPink = new THREE.MeshLambertMaterial({ color: 0xff8fc8, flatShading: true });
    const add = (geo, mat, x, y, z, ry = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(CASTLE.x + x, y, CASTLE.z + z);
      m.rotation.y = ry;
      statics.add(m);
      return m;
    };
    // the outer wall: a ring with a gate in the south
    const WALL_R = 34;
    const segs = 28;
    for (let i = 0; i < segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      if (Math.abs(wrap(a - Math.PI / 2)) < 0.16) continue; // gate
      const x = Math.cos(a) * WALL_R;
      const z = Math.sin(a) * WALL_R;
      const len = (2 * Math.PI * WALL_R) / segs + 0.2;
      add(new THREE.BoxGeometry(len, 5, 1.4), wallMat, x, CASTLE.y + 2.5, z, -a + Math.PI / 2);
      for (let k = -1; k <= 1; k += 2) add(new THREE.BoxGeometry(0.9, 0.9, 1.5), trim, x + Math.cos(a + Math.PI / 2) * k * len * 0.25, CASTLE.y + 5.4, z + Math.sin(a + Math.PI / 2) * k * len * 0.25, -a + Math.PI / 2);
      g.colliders.push({ type: 'cylinder', x: CASTLE.x + x, z: CASTLE.z + z, radius: len / 2 + 0.2, minY: CASTLE.y - 2, maxY: CASTLE.y + 5 });
    }
    // towers along the wall
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const x = Math.cos(a) * WALL_R;
      const z = Math.sin(a) * WALL_R;
      add(new THREE.CylinderGeometry(2.4, 2.7, 10, 12), wallMat, x, CASTLE.y + 5, z);
      add(new THREE.CylinderGeometry(2.8, 2.8, 0.6, 12), trim, x, CASTLE.y + 10.2, z);
      add(new THREE.ConeGeometry(3.0, 5, 12), i % 2 ? roofPink : roofMat, x, CASTLE.y + 13, z);
      g.colliders.push({ type: 'cylinder', x: CASTLE.x + x, z: CASTLE.z + z, radius: 2.7, minY: CASTLE.y - 2, maxY: CASTLE.y + 11 });
    }
    // gate towers
    [-1, 1].forEach(s => {
      add(new THREE.CylinderGeometry(2, 2.3, 12, 12), wallMat, s * 5, CASTLE.y + 6, WALL_R);
      add(new THREE.ConeGeometry(2.6, 5, 12), roofMat, s * 5, CASTLE.y + 14.5, WALL_R);
      g.colliders.push({ type: 'cylinder', x: CASTLE.x + s * 5, z: CASTLE.z + WALL_R, radius: 2.3, minY: CASTLE.y - 2, maxY: CASTLE.y + 12 });
    });
    add(new THREE.BoxGeometry(12, 1.6, 2), trim, 0, CASTLE.y + 9, WALL_R);
    // the keep behind the throne yard
    add(new THREE.BoxGeometry(22, 14, 9), wallMat, 0, CASTLE.y + 7, -27);
    add(new THREE.BoxGeometry(23, 1, 10), trim, 0, CASTLE.y + 14.3, -27);
    [-9, 0, 9].forEach((x, i) => {
      add(new THREE.CylinderGeometry(i === 1 ? 3.2 : 2.4, i === 1 ? 3.5 : 2.6, i === 1 ? 22 : 18, 12), wallMat, x, CASTLE.y + (i === 1 ? 11 : 9), -29);
      add(new THREE.ConeGeometry(i === 1 ? 4 : 3, i === 1 ? 8 : 6, 12), i === 1 ? roofMat : roofPink, x, CASTLE.y + (i === 1 ? 26 : 21), -29);
    });
    add(new THREE.BoxGeometry(4, 6, 0.4), new THREE.MeshLambertMaterial({ color: 0x8d5a34 }), 0, CASTLE.y + 3, -22.4);
    g.colliders.push({ type: 'box', minX: CASTLE.x - 11.5, maxX: CASTLE.x + 11.5, minZ: CASTLE.z - 32, maxZ: CASTLE.z - 22.4, minY: CASTLE.y - 2, maxY: CASTLE.y + 14 });
    // windows of the keep glow
    const winMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.9) });
    winMat.userData.noNightGlow = true;
    for (let k = 0; k < 6; k++) add(new THREE.PlaneGeometry(1.2, 1.8), winMat, -7.5 + k * 3, CASTLE.y + 9, -22.45);
    // rainbow path from the arrival to the gate
    const bands = [0xff8fa3, 0xffc46b, 0xfff07a, 0x8fe6a0, 0x8fc8ff, 0xc29bff];
    bands.forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 14), new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.25 }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(CASTLE.x - 2.25 + i * 0.9, CASTLE.y + 0.05, CASTLE.z + 41);
      statics.add(m);
    });
    // rainbow arch over the gate
    bands.forEach((c, i) => {
      const arch = new THREE.Mesh(new THREE.TorusGeometry(7.5 - i * 0.35, 0.17, 6, 40, Math.PI), new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.3) }));
      arch.material.userData.noNightGlow = true;
      arch.position.set(CASTLE.x, CASTLE.y + 9, CASTLE.z + 38);
      statics.add(arch);
    });
    this.root.add(bakeStaticGroup(statics));
    // waving banners and floating star lanterns
    this.banners = [];
    const bannerMat = new THREE.MeshLambertMaterial({ color: 0xff8fc8, side: THREE.DoubleSide });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6, 4, 1), bannerMat);
      b.position.set(CASTLE.x + Math.cos(a) * (WALL_R - 2.6), CASTLE.y + 7.5, CASTLE.z + Math.sin(a) * (WALL_R - 2.6));
      b.rotation.y = -a - Math.PI / 2;
      this.root.add(b);
      this.banners.push(b);
    }
    this.lanterns = [];
    const lanternTex = emojiTex('⭐');
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = 24 + (i % 2) * 5;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: lanternTex, transparent: true, depthWrite: false }));
      s.material.userData.noNightGlow = true;
      s.scale.setScalar(1.1);
      s.userData = { a, r, h: 7 + (i % 3) * 2 };
      this.root.add(s);
      this.lanterns.push(s);
    }
    this.light = new THREE.PointLight(0xffc27a, 2.2, 70, 1.5);
    this.light.position.set(CASTLE.x, CASTLE.y + 18, CASTLE.z);
    this.root.add(this.light);
  }

  // ---------- Throne yard: mosaic floor and the four seals ----------
  buildArena() {
    const floor = new THREE.Mesh(new THREE.CircleGeometry(ARENA_R, 64), new THREE.MeshLambertMaterial({ map: mosaicTexture(), emissive: 0x3a2050, emissiveIntensity: 0.4 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(CASTLE.x, CASTLE.y + 0.04, CASTLE.z);
    floor.receiveShadow = true;
    this.root.add(floor);
    this.seals = [0, 1, 2, 3].map(i => {
      const a = Math.PI / 4 + i * Math.PI / 2;
      const x = CASTLE.x + Math.cos(a) * SEAL_R;
      const z = CASTLE.z + Math.sin(a) * SEAL_R;
      const grp = new THREE.Group();
      grp.position.set(x, CASTLE.y, z);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.1, 1.4, 8), new THREE.MeshLambertMaterial({ color: 0xf2e8ff, flatShading: true }));
      ped.position.y = 0.7;
      grp.add(ped);
      const c = new THREE.Color(...SEAL_COLORS[i]);
      const gemMat = new THREE.MeshBasicMaterial({ color: c.clone().multiplyScalar(0.25) });
      gemMat.userData.noNightGlow = true;
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), gemMat);
      gem.position.y = 2.1;
      gem.scale.y = 1.5;
      grp.add(gem);
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: emojiTex(SEAL_ICONS[i]), transparent: true, depthWrite: false }));
      icon.material.userData.noNightGlow = true;
      icon.position.y = 3.4;
      icon.scale.setScalar(1.2);
      grp.add(icon);
      const beamMat = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
      beamMat.userData.noNightGlow = true;
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.6, 14, 10, 1, true), beamMat);
      beam.position.y = 9;
      grp.add(beam);
      this.root.add(grp);
      this.game.colliders.push({ type: 'cylinder', x, z, radius: 1.0, minY: CASTLE.y - 1, maxY: CASTLE.y + 1.6 });
      return { x, z, gem, gemMat, beam, color: c };
    });
    // telegraph discs (pooled)
    this.zoneMeshes = [];
    for (let i = 0; i < 8; i++) {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 1.2, 0.45), transparent: true, opacity: 0.4, depthWrite: false });
      m.userData.noNightGlow = true;
      const disc = new THREE.Mesh(new THREE.CircleGeometry(ZONE_R, 32), m);
      disc.rotation.x = -Math.PI / 2;
      disc.visible = false;
      this.root.add(disc);
      this.zoneMeshes.push(disc);
    }
    this.orbMeshes = [];
    const orbMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 0.2, 1.4) });
    orbMat.userData.noNightGlow = true;
    for (let i = 0; i < 6; i++) {
      const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), orbMat);
      o.visible = false;
      this.root.add(o);
      this.orbMeshes.push(o);
    }
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.3, 1.8), transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    ringMat.userData.noNightGlow = true;
    this.ringMesh = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 64), ringMat);
    this.ringMesh.rotation.x = -Math.PI / 2;
    this.ringMesh.visible = false;
    this.root.add(this.ringMesh);
  }

  // ---------- Umbra ----------
  buildBoss() {
    const grp = new THREE.Group();
    const robe = new THREE.MeshLambertMaterial({ color: 0x2a1748, emissive: 0x120628, flatShading: true });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9c8ff, emissive: 0x3a2a60 });
    const gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.9, 0.6) });
    gold.userData.noNightGlow = true;
    const eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.5, 1.8) });
    eye.userData.noNightGlow = true;
    const dress = new THREE.Mesh(new THREE.ConeGeometry(1.8, 4.2, 14, 1, true), robe);
    dress.position.y = 0.2;
    grp.add(dress);
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.9, 1.6, 12), robe);
    body.position.y = 2.6;
    grp.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.75, 18, 14), skin);
    head.position.y = 4.0;
    grp.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6), robe);
    hair.position.y = 4.1;
    hair.rotation.x = -0.3;
    grp.add(hair);
    [-1, 1].forEach(s => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), eye);
      e.position.set(s * 0.27, 4.05, 0.66);
      grp.add(e);
    });
    for (let i = 0; i < 7; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.6, 5), gold);
      const a = (i / 7) * Math.PI - Math.PI / 2;
      spike.position.set(Math.sin(a) * 0.55, 4.95, Math.cos(a) * 0.3 - 0.1);
      grp.add(spike);
    }
    // cape wings of night sky
    this.wings = [-1, 1].map(s => {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 3.2), new THREE.MeshBasicMaterial({ color: 0x1a0b33, side: THREE.DoubleSide, transparent: true, opacity: 0.92 }));
      w.position.set(s * 1.8, 2.8, -0.4);
      w.rotation.y = s * 0.4;
      grp.add(w);
      return w;
    });
    const shield = new THREE.Mesh(new THREE.SphereGeometry(3.4, 32, 20), createShieldMaterial());
    shield.material.color.setRGB(1.6, 0.6, 2.4);
    shield.material.opacity = 0.7;
    shield.position.y = 2.4;
    grp.add(shield);
    this.shield = shield;
    this.bossLight = new THREE.PointLight(0xb46bff, 2, 20, 2);
    this.bossLight.position.y = 3;
    grp.add(this.bossLight);
    grp.visible = !this.state.defeated;
    this.root.add(grp);
    this.boss = grp;
  }

  // ---------- Portals: forest -> castle and back ----------
  makePortal(x, y, z, parent) {
    const grp = new THREE.Group();
    grp.position.set(x, y, z);
    const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.0, 0.8) });
    ringMat.userData.noNightGlow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.22, 10, 40), ringMat);
    ring.position.y = 2.4;
    grp.add(ring);
    const swirl = new THREE.Mesh(new THREE.CircleGeometry(1.85, 40), new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOn: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uTime; uniform float uOn; varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5; float r = length(p) * 2.0; if (r > 1.0) discard;
          float a = atan(p.y, p.x);
          float s = sin(a * 6.0 - r * 10.0 + uTime * 2.5) * 0.5 + 0.5;
          vec3 c = mix(vec3(2.2, 1.7, 0.6), vec3(1.8, 1.0, 2.2), s);
          gl_FragColor = vec4(c, (0.9 - r * 0.4) * uOn);
        }`
    }));
    swirl.position.y = 2.4;
    grp.add(swirl);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('🏰 Sternenschloss'), transparent: true, depthWrite: false }));
    sign.scale.set(2.8, 0.7, 1);
    sign.position.y = 5.2;
    grp.add(sign);
    parent.add(grp);
    return { grp, swirl, x, z };
  }

  buildPortals() {
    const g = this.game;
    const fy = forestHeight(CASTLE_PORTAL.x, CASTLE_PORTAL.z);
    this.forestPortal = this.makePortal(CASTLE_PORTAL.x, fy, CASTLE_PORTAL.z, g.scene);
    this.returnPortal = this.makePortal(this.arrival.x, castleHeight(this.arrival.x, this.arrival.z + 4), this.arrival.z + 4, this.root);
  }

  buildBanner() {
    const b = document.createElement('div');
    b.id = 'boss4-banner';
    b.className = 'boss-banner boss2-banner';
    b.innerHTML = '<div class="boss-title">🏰 UMBRA – DIE STERNENFRESSERIN 🏰</div>' +
      '<div class="boss-bar-wrap"><div class="boss-bar-fill boss2-fill" id="boss4-hp-bar"></div></div>' +
      '<div class="boss-subtitle" id="boss4-state-text"></div>';
    (document.getElementById('ui-overlay') || document.body).appendChild(b);
    this.banner = b;
    this.bannerFill = b.querySelector('#boss4-hp-bar');
    this.bannerText = b.querySelector('#boss4-state-text');
  }

  // ---------- Travel ----------
  travel(toCastle) {
    const g = this.game;
    if (this.travelling) return;
    this.travelling = true;
    if (this.overlay) this.overlay.classList.add('visible');
    sfx.magicSkill(1);
    setTimeout(() => {
      const target = toCastle ? this.arrival : { x: CASTLE_PORTAL.x, z: CASTLE_PORTAL.z + 3.5 };
      const y = g.getTerrainHeight(target.x, target.z);
      const offset = g.camera.position.clone().sub(g.playerGroup.position);
      g.playerGroup.position.set(target.x, y, target.z);
      g.playerVelY = 0;
      if (g.moveVel) g.moveVel.set(0, 0, 0);
      g.camera.position.copy(g.playerGroup.position).add(offset);
      if (g.cameraDesired) g.cameraDesired.copy(g.camera.position);
      if (g.prevPlayerPos) g.prevPlayerPos.copy(g.playerGroup.position);
      g.controls.target.set(target.x, y + 1.6, target.z);
      setTimeout(() => {
        if (this.overlay) this.overlay.classList.remove('visible');
        this.travelling = false;
        g.showToast(toCastle ? '🏰 Das Sternenschloss … hoch über den Wolken. Im Thronhof wartet Umbra.' : '🌲 Zurück im Zauberwald', 4500);
      }, 500);
    }, 900);
  }

  // ---------- Interact key ----------
  getInteraction() {
    const pp = this.game.playerGroup.position;
    if (!this.inCastle) {
      if (pp.x < 300) return null;
      const d = Math.hypot(pp.x - this.forestPortal.x, pp.z - this.forestPortal.z);
      if (d > 4) return null;
      return this.unlocked
        ? { dist: d, label: '🏰 Zum Sternenschloss reisen', action: () => this.travel(true) }
        : { dist: d, label: '🔒 Sternenportal', action: () => this.game.showToast('🔒 Das Sternenportal erwacht, wenn Morvanta besiegt ist.', 4000) };
    }
    const d = Math.hypot(pp.x - this.returnPortal.x, pp.z - this.returnPortal.z);
    if (d < 4) return { dist: d, label: '🌀 Zurück in den Zauberwald', action: () => this.travel(false) };
    return null;
  }

  getTargets() {
    const out = [];
    if (this.d.alive) out.push({ id: 'umbra', icon: '🏰', label: 'Umbra', x: CASTLE.x, z: CASTLE.z });
    if (this.d.alive && this.d.awake) {
      this.seals.forEach((s, i) => { if (this.d.seals[i] <= 0) out.push({ id: `seal:${i}`, icon: SEAL_ICONS[i], label: SEAL_NAMES[i], x: s.x, z: s.z, noLabel: true }); });
    }
    out.push({ id: 'castleback', icon: '🌀', label: 'Rückweg', x: this.returnPortal.x, z: this.returnPortal.z, noLabel: true });
    return out;
  }

  getPortalTargets() {
    if (!this.unlocked || this.state.defeated) return [];
    return [{ id: 'castleportal', icon: '🏰', label: 'Sternenportal', x: this.forestPortal.x, z: this.forestPortal.z }];
  }

  // ---------- Seals: a sister casts next to her seal ----------
  onCast(si, pos) {
    if (!this.inCastle && !inCastleArea(pos.x)) return;
    const d = this.d;
    if (!d.alive || !d.awake || si < 0 || si > 3) return;
    const s = this.seals[si];
    if (Math.hypot(pos.x - s.x, pos.z - s.z) > 6.5) return;
    if (this.puppet) this.game.coop.send({ t: 'boss4Hit', seal: si });
    else this.lightSeal(si);
  }

  lightSeal(si) {
    const d = this.d;
    if (d.st === 'stunned') return;
    const wasOff = d.seals[si] <= 0;
    d.seals[si] = SEAL_TIME;
    if (wasOff) {
      const s = this.seals[si];
      this.game.fx.burst(new THREE.Vector3(s.x, CASTLE.y + 2.2, s.z), [s.color], 30, { speed: 3, up: 3, size: 0.4, gravity: 1 });
      sfx.playTone(523 + si * 120, 'sine', 0.3, 0.08);
      const lit = d.seals.filter(v => v > 0).length;
      this.game.showToast(`${SEAL_ICONS[si]} ${SEAL_NAMES[si]} leuchtet! (${lit}/4)`, 2500);
    }
    if (d.seals.every(v => v > 0)) this.setState('stunned');
  }

  // ---------- Hits ----------
  hit(dmg) {
    if (!this.d.alive || !this.d.awake) return;
    if (this.puppet) {
      this.game.coop.send({ t: 'boss4Hit', dmg });
      sfx.hit();
      return;
    }
    this.applyHit(dmg);
  }

  applyHit(dmg) {
    const d = this.d;
    if (!d.alive || !d.awake) return;
    if (d.st !== 'stunned') {
      this.game.showFloatingText('🛡️ Schattenschild! Entzündet die vier Siegel!', this.pos, '#c9a8ff');
      return;
    }
    d.hp = Math.max(0, d.hp - dmg);
    sfx.hit();
    this.game.showFloatingText(`-${dmg}`, this.pos, '#ffd166');
    if (d.hp <= 0) this.die();
  }

  destroyOrb(id) {
    const d = this.d;
    const i = d.orbs.findIndex(o => o[0] === id);
    if (i < 0) return;
    const o = d.orbs[i];
    this.game.fx.burst(new THREE.Vector3(o[1], CASTLE.y + 1.4, o[2]), [new THREE.Color(1.0, 0.4, 2.2)], 20, { speed: 3, up: 1, size: 0.35 });
    d.orbs.splice(i, 1);
  }

  hitOrb(id) {
    if (this.puppet) {
      this.game.coop.send({ t: 'boss4Hit', orb: id });
      this.orbHits.add(id);
    } else this.destroyOrb(id);
  }

  // Spells that hit an area (Sol's nova ...)
  areaHit(pos, radius, dmg) {
    if (!this.d.alive || !this.d.awake || !inCastleArea(pos.x)) return;
    if (pos.distanceTo(this.hitPoint) < radius + 3) this.hit(dmg);
    this.d.orbs.slice().forEach(o => { if (Math.hypot(o[1] - pos.x, o[2] - pos.z) < radius + 0.6) this.hitOrb(o[0]); });
  }

  // Arrows and rings; returns true when something was hit
  tryHit(p, dmg) {
    if (!this.d.alive || !this.d.awake || !inCastleArea(p.x)) return false;
    const orb = this.d.orbs.find(o => Math.hypot(o[1] - p.x, o[2] - p.z) < 1.3 && Math.abs(p.y - (CASTLE.y + 1.4)) < 2);
    if (orb) { this.hitOrb(orb[0]); return true; }
    if (p.distanceTo(this.hitPoint) < 3.4) { this.hit(dmg); return true; }
    return false;
  }

  onRemoteHit(m) {
    if (this.puppet) return;
    if (m.seal !== undefined) this.lightSeal(m.seal | 0);
    if (m.orb !== undefined) this.destroyOrb(m.orb | 0);
    if (m.dmg) this.applyHit(Math.min(200, m.dmg));
  }

  die() {
    const d = this.d;
    if (!d.alive) return;
    d.alive = false;
    d.hp = 0;
    this.finishDeath();
  }

  // Runs on every client when she falls
  finishDeath() {
    const g = this.game;
    this.d.alive = false;
    this.d.hp = 0;
    this.d.zones = [];
    this.d.orbs = [];
    this.d.ringR = -1;
    this.banner.classList.remove('visible');
    this.state.defeated = true;
    this.save();
    const p = this.pos.clone();
    g.fx.flash(p, new THREE.Color(2.6, 2.2, 1.2), 14, 1.2);
    g.fx.ringWave(new THREE.Vector3(CASTLE.x, CASTLE.y + 0.2, CASTLE.z), new THREE.Color(2.6, 2.0, 0.8), 30, 1.6);
    g.fx.burst(p, SEAL_COLORS.map(c => new THREE.Color(...c)), 200, { speed: 12, up: 6, size: 0.55, life: 1.8, gravity: 2 });
    sfx.victory();
    this.showFreed();
    g.showFloatingText('🏰 UMBRA BESIEGT! 🏰', g.playerGroup.position, '#ffe066');
    g.showToast('🎉 Umbra ist besiegt – das Sternenschloss leuchtet wieder! Die Galaxy Sisters haben alle vier Welten gerettet. Danke fürs Spielen! 💜', 12000);
    g.progression.addXp(400, 'Umbra besiegt');
    g.inventory.addCoins(250, 'Sternenschloss');
    g.quests.mark('umbra', 0, 'Das Sternenschloss ist befreit');
    for (let i = 0; i < 5; i++) g.dropLoot(new THREE.Vector3(CASTLE.x, CASTLE.y, CASTLE.z), { dust: 1, heart: 1 });
    if (g.saveGame) g.saveGame.save();
  }

  showFreed() {
    this.boss.visible = false;
    this.d.alive = false;
    this.seals.forEach(s => { s.gemMat.color.copy(s.color); s.beam.material.opacity = 0.35; });
    this.light.intensity = 3.2;
  }

  // ---------- Who can be attacked ----------
  candidates(range = ARENA_R + 8) {
    const g = this.game;
    const out = [];
    const close = (p) => inCastleArea(p.x) && Math.hypot(p.x - CASTLE.x, p.z - CASTLE.z) < range;
    if (!g.isPlayerInvisible && !g.isDowned && close(g.playerGroup.position)) out.push({ id: this.myId, pos: g.playerGroup.position });
    g.remotes.list.forEach(r => {
      if (r.hasState && !r.invisible && !r.downed && close(r.group.position)) out.push({ id: r.id, pos: r.group.position });
    });
    return out;
  }

  setState(st) {
    const d = this.d;
    d.st = st;
    d.timer = 0;
    if (st === 'stunned') {
      d.seals = [0, 0, 0, 0];
      d.zones = [];
      d.ringR = -1;
    }
    if (st === 'ring') d.ringR = 1.5;
    if (st === 'orbs') d.orbsSpawned = false;
    this.onStateEntered();
  }

  onStateEntered() {
    const st = this.d.st;
    const g = this.game;
    if (st === 'awaken') { sfx.bossSpin(); g.showToast('🏰 Umbra erhebt sich vom Thron … Entzündet die vier Siegel, um ihren Schild zu brechen!', 6000); }
    if (st === 'stunned') {
      g.fx.flash(this.pos.clone(), new THREE.Color(2.6, 2.2, 1.2), 9, 0.6);
      sfx.victory();
      g.showToast('💥 Alle vier Siegel leuchten – der Schattenschild ist zerbrochen! Jetzt angreifen!', 4500);
    }
    if (st === 'ring') sfx.playTone(140, 'sawtooth', 0.6, 0.06);
    if (st === 'rain') sfx.playTone(400, 'triangle', 0.3, 0.05);
    if (st === 'orbs') sfx.playTone(220, 'square', 0.25, 0.04);
    this.ringHit = false;
    this.setBannerText();
  }

  // ---------- Host brain ----------
  stepHost(delta) {
    const d = this.d;
    d.timer += delta;
    d.seals = d.seals.map(v => Math.max(0, v - delta));
    d.zones.forEach(z => { z[3] += delta; });
    d.zones = d.zones.filter(z => z[3] < ZONE_LIFE);
    // orbs drift towards the nearest sister
    const cands = this.candidates();
    d.orbs.forEach(o => {
      o[3] += delta;
      let best = null;
      let bd = Infinity;
      cands.forEach(c => { const dd = Math.hypot(c.pos.x - o[1], c.pos.z - o[2]); if (dd < bd) { bd = dd; best = c; } });
      if (best && bd > 0.1) {
        o[1] += ((best.pos.x - o[1]) / bd) * ORB_SPEED * delta;
        o[2] += ((best.pos.z - o[2]) / bd) * ORB_SPEED * delta;
      }
    });
    d.orbs = d.orbs.filter(o => o[3] < ORB_LIFE);
    if (d.ringR >= 0) {
      d.ringR += RING_SPEED * delta;
      if (d.ringR > ARENA_R + 2) d.ringR = -1;
    }
    const floorY = CASTLE.y;
    if (d.st === 'sleep') {
      this.pos.set(CASTLE.x, floorY + 4.5, CASTLE.z - 8);
      if (this.unlocked && this.candidates(ARENA_R - 1).length) this.setState('awaken');
      return;
    }
    if (d.st === 'awaken') {
      d.awake = true;
      this.pos.y = floorY + 4.5 + Math.min(1, d.timer / 3) * 1.5;
      if (d.timer > 3.2) this.setState('idle');
      return;
    }
    const target = cands[0];
    if (d.st === 'stunned') {
      this.pos.y += (floorY + 1.2 - this.pos.y) * Math.min(1, delta * 2);
      if (d.timer > STUN_TIME) this.setState('idle');
      return;
    }
    // hover in a slow circle above the yard
    const ang = d.timer * 0.35 + d.attackIdx;
    const wantX = CASTLE.x + Math.cos(ang) * 6;
    const wantZ = CASTLE.z + Math.sin(ang) * 6;
    this.pos.x += (wantX - this.pos.x) * Math.min(1, delta * 1.5);
    this.pos.z += (wantZ - this.pos.z) * Math.min(1, delta * 1.5);
    this.pos.y += (floorY + 5.5 + Math.sin(d.timer * 2) * 0.4 - this.pos.y) * Math.min(1, delta * 2);
    if (target) this.boss.rotation.y += wrap(Math.atan2(target.pos.x - this.pos.x, target.pos.z - this.pos.z) - this.boss.rotation.y) * 0.06;
    const phase2 = d.hp < d.maxHp * 0.5;
    if (d.st === 'idle') {
      if (d.timer > (phase2 ? 3.2 : 4.2) && target) {
        const attacks = ['rain', 'orbs', 'ring'];
        this.setState(attacks[d.attackIdx % 3]);
        d.attackIdx++;
      }
    } else if (d.st === 'rain') {
      d.zoneClock = (d.zoneClock || 0) + delta;
      if (d.zoneClock > (phase2 ? 0.35 : 0.5) && d.timer < 3.2 && cands.length) {
        d.zoneClock = 0;
        const c = cands[Math.floor(Math.random() * cands.length)];
        const jitter = Math.random() < 0.5 ? 0 : 3;
        const a = Math.random() * Math.PI * 2;
        if (d.zones.length >= 8) d.zones.shift();
        d.zones.push([++d.zid, r2(c.pos.x + Math.cos(a) * jitter), r2(c.pos.z + Math.sin(a) * jitter), 0]);
      }
      if (d.timer > 4.5) this.setState('idle');
    } else if (d.st === 'orbs') {
      if (!d.orbsSpawned) {
        d.orbsSpawned = true;
        for (let k = 0; k < (phase2 ? 4 : 3); k++) {
          const a = (k / 3) * Math.PI * 2;
          if (d.orbs.length < 6) d.orbs.push([++d.zid, r2(this.pos.x + Math.cos(a) * 2.5), r2(this.pos.z + Math.sin(a) * 2.5), 0]);
        }
      }
      if (d.timer > 1.5) this.setState('idle');
    } else if (d.st === 'ring') {
      if (d.ringR < 0 && d.timer > 0.5) this.setState('idle');
    }
  }

  // ---------- Puppet: follow the host ----------
  onNetState(m) {
    this.msg = m;
  }

  stepPuppet(delta) {
    const m = this.msg;
    const d = this.d;
    if (!m) return;
    if (!m.al) {
      if (d.alive) this.finishDeath();
      return;
    }
    const changed = m.st !== d.st;
    d.awake = !!m.aw;
    d.hp = m.hp;
    d.seals = Array.isArray(m.sl) ? m.sl.slice(0, 4).map(Number) : d.seals;
    d.zones = (m.zs || []).map(z => [z[0], z[1], z[2], z[3]]);
    d.orbs = (m.ob || []).filter(o => !this.orbHits.has(o[0])).map(o => [o[0], o[1], o[2], 0]);
    d.ringR = m.rr;
    if (changed) {
      d.st = m.st;
      d.timer = 0;
      this.onStateEntered();
    }
    const k = 1 - Math.exp(-10 * delta);
    this.pos.x += (m.x - this.pos.x) * k;
    this.pos.y += (m.y - this.pos.y) * k;
    this.pos.z += (m.z - this.pos.z) * k;
    d.timer += delta;
  }

  netState() {
    const d = this.d;
    return {
      t: 'boss4', x: r2(this.pos.x), y: r2(this.pos.y), z: r2(this.pos.z), st: d.st, hp: d.hp, al: d.alive ? 1 : 0, aw: d.awake ? 1 : 0,
      sl: d.seals.map(r2), zs: d.zones.map(z => [z[0], z[1], z[2], r2(z[3])]), ob: d.orbs.slice(0, 6).map(o => [o[0], r2(o[1]), r2(o[2])]), rr: r2(d.ringR)
    };
  }

  // ---------- What hurts me (every client checks itself) ----------
  localEffects() {
    const g = this.game;
    const d = this.d;
    const pp = g.playerGroup.position;
    if (g.isDowned || !inCastleArea(pp.x)) return;
    d.zones.forEach(z => {
      if (z[3] >= ZONE_FUSE && !this.zoneHits.has(z[0])) {
        this.zoneHits.add(z[0]);
        const zp = new THREE.Vector3(z[1], CASTLE.y + 0.1, z[2]);
        g.fx.ringWave(zp, new THREE.Color(1.5, 1.1, 0.4), ZONE_R * 1.2, 0.5);
        g.fx.burst(zp.clone().setY(zp.y + 0.5), [new THREE.Color(1.6, 1.3, 0.5), new THREE.Color(1.2, 0.7, 1.6)], 16, { speed: 4, up: 4, size: 0.32, gravity: 4 });
        g.playSpatial(zp, () => sfx.hit());
        if (Math.hypot(pp.x - z[1], pp.z - z[2]) < ZONE_R && pp.y - zp.y < 2.2) g.damagePlayer(ZONE_DMG);
      }
    });
    if (this.zoneHits.size > 80) this.zoneHits.clear();
    d.orbs.slice().forEach(o => {
      if (Math.hypot(pp.x - o[1], pp.z - o[2]) < 1.2 && Math.abs(pp.y + 1 - (CASTLE.y + 1.4)) < 1.8) {
        g.damagePlayer(ORB_DMG);
        this.hitOrb(o[0]);
      }
    });
    if (d.ringR > 0 && !this.ringHit) {
      const dist = Math.hypot(pp.x - this.pos.x, pp.z - this.pos.z);
      const grounded = pp.y - this.groundAt(pp.x, pp.z) < 0.45;
      if (Math.abs(dist - d.ringR) < 0.8 && grounded) {
        this.ringHit = true;
        g.damagePlayer(RING_DMG);
      }
    }
  }

  // ---------- Atmosphere (runs after day/night and weather) ----------
  applyAtmosphere() {
    if (!this.inCastle) return;
    const g = this.game;
    g.scene.fog.color.setRGB(1.0, 0.82, 0.86);
    g.scene.fog.density = 0.006;
    g.scene.background.setRGB(1.0, 0.78, 0.7);
    const sky = g.skyDome.material.uniforms;
    sky.uZenith.value.setRGB(0.42, 0.36, 0.78);
    sky.uHorizon.value.setRGB(1.0, 0.72, 0.62);
    sky.uNight.value = 0.15;
    g.sunLight.intensity = 1.3;
    g.sunLight.color.setRGB(1.0, 0.85, 0.65);
    g.hemiLight.intensity = 0.9;
    g.hemiLight.color.setRGB(1.0, 0.9, 1.0);
  }

  // ---------- Banner ----------
  setBannerText() {
    const texts = {
      sleep: 'Sie schlummert auf ihrem Thron …',
      awaken: '🏰 Umbra erwacht!',
      idle: '🛡️ Schattenschild – entzündet alle vier Siegel!',
      rain: '🌠 STERNENREGEN! Weicht den Kreisen aus!',
      orbs: '🔮 SCHATTENKUGELN! Schießt sie ab!',
      ring: '⭕ FINSTERRING! Springt darüber!',
      stunned: '💥 Schild zerbrochen – jetzt angreifen!'
    };
    this.bannerText.textContent = texts[this.d.st] || '';
  }

  // ---------- Per frame ----------
  update(delta) {
    const g = this.game;
    const t = g.clock.elapsedTime;
    this.inCastle = inCastleArea(g.camera.position.x);
    this.root.visible = this.inCastle;
    // the forest portal shows up after Morvanta
    const inForest = g.camera.position.x > 300;
    this.forestPortal.grp.visible = inForest && this.unlocked;
    if (this.forestPortal.grp.visible) this.forestPortal.swirl.material.uniforms.uTime.value = t;
    if (!this.inCastle) {
      this.banner.classList.remove('visible');
      return;
    }
    if (g.forest) sfx.zone = 'forest';
    this.returnPortal.swirl.material.uniforms.uTime.value = t;
    this.banners.forEach((b, i) => { b.rotation.z = Math.sin(t * 2 + i) * 0.06; });
    this.lanterns.forEach((s, i) => {
      const u = s.userData;
      const a = u.a + t * 0.08;
      s.position.set(CASTLE.x + Math.cos(a) * u.r, CASTLE.y + u.h + Math.sin(t + i) * 0.4, CASTLE.z + Math.sin(a) * u.r);
    });

    const d = this.d;
    if (d.alive) {
      if (this.puppet) this.stepPuppet(delta);
      else this.stepHost(delta);
      this.localEffects();
    }
    // presentation
    this.boss.visible = d.alive;
    this.boss.position.copy(this.pos);
    this.hitPoint.copy(this.pos).y += 2.6;
    const shieldOn = d.alive && d.st !== 'stunned';
    this.shield.material.opacity += ((shieldOn ? 0.7 : 0) - this.shield.material.opacity) * Math.min(1, delta * 4);
    this.wings.forEach((w, i) => { w.rotation.z = (i ? -1 : 1) * (0.15 + Math.sin(t * 2.5) * 0.12); });
    this.boss.rotation.z = d.st === 'stunned' ? Math.sin(t * 5) * 0.12 : 0;
    if (d.alive) {
      this.seals.forEach((s, i) => {
        const lit = d.seals[i] > 0;
        const blink = lit && d.seals[i] < 5 ? (Math.sin(t * 12) > 0 ? 1 : 0.4) : 1;
        s.gemMat.color.copy(s.color).multiplyScalar(lit ? 1.1 * blink : 0.25);
        s.beam.material.opacity = lit ? 0.45 * blink : 0;
        s.gem.rotation.y += delta * (lit ? 3 : 0.6);
      });
    }
    this.zoneMeshes.forEach((m, i) => {
      const z = d.zones[i];
      m.visible = !!z && d.alive;
      if (!z) return;
      m.position.set(z[1], CASTLE.y + 0.12, z[2]);
      const fuse = Math.min(1, z[3] / ZONE_FUSE);
      m.material.opacity = z[3] < ZONE_FUSE ? 0.2 + fuse * 0.35 : Math.max(0, 0.6 - (z[3] - ZONE_FUSE) * 1.2);
      m.scale.setScalar(0.5 + fuse * 0.5);
    });
    this.orbMeshes.forEach((m, i) => {
      const o = d.orbs[i];
      m.visible = !!o && d.alive;
      if (!o) return;
      m.position.set(o[1], CASTLE.y + 1.4 + Math.sin(t * 4 + i) * 0.2, o[2]);
      m.rotation.y += delta * 3;
    });
    this.ringMesh.visible = d.alive && d.ringR > 0;
    if (this.ringMesh.visible) {
      this.ringMesh.scale.setScalar(d.ringR);
      this.ringMesh.position.set(this.pos.x, CASTLE.y + 0.25, this.pos.z);
    }
    const near = d.alive && d.awake && this.pos.distanceTo(g.playerGroup.position) < 40;
    this.banner.classList.toggle('visible', near);
    this.bannerFill.style.width = `${(d.hp / d.maxHp) * 100}%`;
    if (near && d.st !== 'stunned') {
      const lit = d.seals.filter(v => v > 0).length;
      const base = { idle: '🛡️ Schattenschild', rain: '🌠 Sternenregen!', orbs: '🔮 Schattenkugeln!', ring: '⭕ Finsterring – springen!' }[d.st];
      if (base) this.bannerText.textContent = `${base} · Siegel ${lit}/4 ${d.seals.map((v, i) => (v > 0 ? SEAL_ICONS[i] : '◌')).join(' ')}`;
    }
  }
}
