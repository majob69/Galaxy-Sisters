// ==========================================
// THE ENCHANTED FOREST (third world): unlocked when every quest is done. A portal near the start
// leads there. Purple, pink and blue trees glow in an eternal twilight full of floating lights;
// three moonstones sleep somewhere in the forest - bring them home and the Heart of the Forest awakens.
// The forest lies far east of the valley (x around 600) and has its own gentle ground.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { simplex2, smoothstep } from './landscape.js';
import { QUEST_DEFS } from './quests.js';
import { findFlatSpot } from './spots.js';
import { createCritter, animateCritter } from './critters.js';
import { blinkFace } from './characters.js';
import { createSoftSpriteTexture } from './water.js';
import { bakeStaticGroup } from './bake.js';

export const FOREST = { x: 600, z: 0, r: 64 };
// Morvanta's clearing: a big, flat, magical arena in the west of the forest
export const FOREST_ARENA = { x: FOREST.x - 24, z: FOREST.z - 22, r: 22 };
// a quiet clearing next to the arena where Lilli the bunny waits
export const LILLI_SPOT = { x: FOREST_ARENA.x + 4, z: FOREST_ARENA.z + FOREST_ARENA.r + 5 };
// every quest except Morvanta herself (she lives in the forest) opens the portal
export const FOREST_QUESTS = QUEST_DEFS.filter(d => d.id !== 'morvanta');
const STORAGE_KEY = 'gs-forest-v1';
const STONES = 3;

function forestNoise(lx, lz) {
  return simplex2(lx * 0.03, lz * 0.03) * 2.2 + simplex2(lx * 0.09 + 5, lz * 0.09 - 3) * 0.6;
}
const ARENA_FLOOR = 22 + forestNoise(FOREST_ARENA.x - FOREST.x, FOREST_ARENA.z - FOREST.z);

export function forestHeight(x, z) {
  const lx = x - FOREST.x;
  const lz = z - FOREST.z;
  const r = Math.hypot(lx, lz);
  // the forest floats high above the cloud sea that surrounds the valley
  let h = 22 + forestNoise(lx, lz);
  // Morvanta's arena is levelled flat
  const ad = Math.hypot(x - FOREST_ARENA.x, z - FOREST_ARENA.z);
  if (ad < FOREST_ARENA.r + 7) h += (ARENA_FLOOR - h) * (1 - smoothstep(FOREST_ARENA.r + 1, FOREST_ARENA.r + 7, ad));
  h += smoothstep(FOREST.r - 6, FOREST.r + 10, r) * 16; // the forest sits in a bowl of mossy hills
  return h;
}

// keeps trees and mushrooms out of the arena and Lilli's clearing
function inClearing(x, z, pad = 0) {
  return Math.hypot(x - FOREST_ARENA.x, z - FOREST_ARENA.z) < FOREST_ARENA.r + 3 + pad ||
    Math.hypot(x - LILLI_SPOT.x, z - LILLI_SPOT.z) < 4 + pad;
}

export function inForestArea(x) {
  return x > 300;
}

export class EnchantedForest {
  constructor(game, avoid = []) {
    this.game = game;
    this.state = this.load();
    this.inForest = false;
    this.unlocked = false;
    this.portal = findFlatSpot(game, { target: { x: 12, z: 18 }, radius: 4, avoid, pull: 0.2 });
    this.buildPortal();
    this.buildForest();
    this.overlay = document.getElementById('travel-overlay');
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { stones: Array.isArray(p.stones) ? p.stones.filter(i => i >= 0 && i < STONES).slice(0, STONES) : [], heart: !!p.heart };
      }
    } catch (e) { /* storage unavailable */ }
    return { stones: [], heart: false };
  }

  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state)); } catch (e) { /* ignore */ }
  }

  // ---------- Unlock ----------
  questsDone() {
    const q = this.game.quests;
    return q ? FOREST_QUESTS.filter(d => q.state.done[d.id]).length : 0;
  }

  checkUnlock() {
    const was = this.unlocked;
    this.unlocked = this.questsDone() >= FOREST_QUESTS.length;
    if (this.unlocked && !was && this.announce) {
      this.game.showToast('🌀 Alle Aufgaben erfüllt! Das Portal zum Zauberwald hat sich geöffnet – es steht nahe am Start. Dort wartet Morvanta …', 7000);
      sfx.victory();
    }
    this.announce = true;
  }

  // ---------- Portal (in the valley) and return gate (in the forest) ----------
  makeGate(x, z, y) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    const stone = new THREE.MeshLambertMaterial({ color: 0x6a5a8a, flatShading: true });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.32, 10, 32), stone);
    ring.position.y = 2.4;
    ring.castShadow = true;
    group.add(ring);
    [-1, 1].forEach(s => {
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.9), stone);
      foot.position.set(s * 1.6, 0.3, 0);
      group.add(foot);
    });
    const swirlMat = new THREE.ShaderMaterial({
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uOn: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `
        uniform float uTime; uniform float uOn; varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5;
          float r = length(p) * 2.0;
          if (r > 1.0) discard;
          float a = atan(p.y, p.x);
          float swirl = sin(a * 5.0 + r * 12.0 - uTime * 3.0) * 0.5 + 0.5;
          vec3 c = mix(vec3(0.6, 0.3, 1.6), vec3(1.6, 0.5, 1.2), swirl);
          c = mix(c, vec3(0.4, 1.0, 1.8), smoothstep(0.6, 1.0, r));
          gl_FragColor = vec4(c, (0.9 - r * 0.4) * uOn);
        }`
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.9, 40), swirlMat);
    disc.position.y = 2.4;
    group.add(disc);
    const light = new THREE.PointLight(0xc58bff, 0, 10, 2);
    light.position.y = 2.4;
    group.add(light);
    this.game.scene.add(group);
    [-1, 1].forEach(s => this.game.colliders.push({ type: 'cylinder', x: x + s * 1.6, z, radius: 0.5, minY: y - 1, maxY: y + 1 }));
    return { group, swirlMat, light, x, z, y };
  }

  buildPortal() {
    const g = this.game;
    const { x, z } = this.portal;
    this.gate = this.makeGate(x, z, g.getTerrainHeight(x, z));
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex('🌀 Zauberwald'), transparent: true, depthWrite: false }));
    sign.scale.set(2.8, 0.7, 1);
    sign.position.set(x, this.gate.y + 5.1, z);
    g.scene.add(sign);
  }

  // ---------- The forest itself ----------
  buildForest() {
    const g = this.game;
    const root = new THREE.Group();
    this.root = root;
    // ground
    const size = 180;
    const geo = new THREE.PlaneGeometry(size, size, 120, 120);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const moss = new THREE.Color(0x3d5a4a);
    const violet = new THREE.Color(0x4a3a6e);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + FOREST.x;
      const z = pos.getZ(i) + FOREST.z;
      pos.setY(i, forestHeight(x, z));
      tmp.copy(moss).lerp(violet, smoothstep(-0.4, 0.6, simplex2(x * 0.05, z * 0.05)));
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.position.set(FOREST.x, 0, FOREST.z);
    ground.receiveShadow = true;
    root.add(ground);

    // trees: purple, pink and blue, softly glowing
    const palettes = [
      [0x9d4edd, 0xb565d8, 0xc77dff],
      [0xff7eb6, 0xff9ecf, 0xf72585],
      [0x4cc9f0, 0x4895ef, 0x7fd8ff]
    ];
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x3a2350, flatShading: true });
    const rng = mulberry(77);
    this.treeSpots = [];
    for (let i = 0; i < 400 && this.treeSpots.length < 70; i++) {
      const a = rng() * Math.PI * 2;
      const r = 8 + rng() * (FOREST.r - 10);
      const x = FOREST.x + Math.cos(a) * r;
      const z = FOREST.z + Math.sin(a) * r;
      if (this.treeSpots.some(t => Math.hypot(t.x - x, t.z - z) < 5.5)) continue;
      if (Math.hypot(x - FOREST.x, z - (FOREST.z + 40)) < 7) continue; // keep the arrival clearing open
      if (inClearing(x, z, 2)) continue;
      this.treeSpots.push({ x, z, p: palettes[i % 3], h: 4 + rng() * 3, s: 0.8 + rng() * 0.6 });
    }
    const forestGroup = new THREE.Group();
    this.treeSpots.forEach(t => {
      const y = forestHeight(t.x, t.z);
      const tree = new THREE.Group();
      tree.position.set(t.x, y, t.z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35 * t.s, 0.6 * t.s, t.h, 7), trunkMat);
      trunk.position.y = t.h / 2;
      tree.add(trunk);
      const mats = t.p.map(c => {
        const m = new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.28, flatShading: true });
        m.userData.noNightGlow = true;
        return m;
      });
      const cr = 2.6 * t.s;
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(cr, 1), mats[0]);
      core.position.y = t.h + cr * 0.6;
      tree.add(core);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(cr * 0.55, 1), mats[1 + (k % 2)]);
        puff.position.set(Math.cos(a) * cr * 0.75, t.h + cr * 0.5 + (k % 2) * 0.5, Math.sin(a) * cr * 0.75);
        tree.add(puff);
      }
      forestGroup.add(tree);
      g.colliders.push({ type: 'cylinder', x: t.x, z: t.z, radius: 0.6 * t.s, minY: y - 1, maxY: y + t.h });
    });
    // trees and mushrooms are static: merge them into a few draw calls
    const statics = forestGroup;

    // glowing mushrooms
    const mushMat = [0x7dffb0, 0xff9ecf, 0x9fd8ff].map(c => {
      const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(1.6) });
      m.userData.noNightGlow = true;
      return m;
    });
    for (let i = 0; i < 60; i++) {
      const a = rng() * Math.PI * 2;
      const r = 4 + rng() * (FOREST.r - 8);
      const x = FOREST.x + Math.cos(a) * r;
      const z = FOREST.z + Math.sin(a) * r;
      if (inClearing(x, z)) continue;
      const y = forestHeight(x, z);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), mushMat[i % 3]);
      cap.position.set(x, y + 0.35, z);
      statics.add(cap);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.35, 6), trunkMat);
      stem.position.set(x, y + 0.17, z);
      statics.add(stem);
    }

    root.add(bakeStaticGroup(statics));

    // floating lights
    const motes = 260;
    const mp = new Float32Array(motes * 3);
    this.moteBase = [];
    for (let i = 0; i < motes; i++) {
      const a = rng() * Math.PI * 2;
      const r = rng() * FOREST.r;
      const x = FOREST.x + Math.cos(a) * r;
      const z = FOREST.z + Math.sin(a) * r;
      this.moteBase.push({ x, z, y: forestHeight(x, z) + 1 + rng() * 6, ph: rng() * 10 });
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: createSoftSpriteTexture(), color: new THREE.Color(1.4, 1.0, 2.2), size: 0.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.motes.frustumCulled = false;
    root.add(this.motes);

    // the Heart of the Forest: a crystal tree in the middle
    const hy = forestHeight(FOREST.x, FOREST.z);
    this.heart = new THREE.Group();
    this.heart.position.set(FOREST.x, hy, FOREST.z);
    const bigTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 8, 9), trunkMat);
    bigTrunk.position.y = 4;
    this.heart.add(bigTrunk);
    this.heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.4, 0.8) });
    this.heartMat.userData.noNightGlow = true;
    for (let k = 0; k < 9; k++) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1.2 + (k % 3) * 0.4, 0), this.heartMat);
      const a = (k / 9) * Math.PI * 2;
      crystal.position.set(Math.cos(a) * 2.6, 9 + (k % 3), Math.sin(a) * 2.6);
      crystal.scale.y = 1.8;
      this.heart.add(crystal);
    }
    this.heartLight = new THREE.PointLight(0xc58bff, 0.4, 30, 2);
    this.heartLight.position.y = 10;
    this.heart.add(this.heartLight);
    root.add(this.heart);
    g.colliders.push({ type: 'cylinder', x: FOREST.x, z: FOREST.z, radius: 1.7, minY: hy - 1, maxY: hy + 8 });

    // three moonstones on little pedestals
    const stoneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.8, 1.6, 2.6) });
    stoneMat.userData.noNightGlow = true;
    this.stones = [0, 1, 2].map(i => {
      const a = 0.6 + i * 2.1;
      const r = 30 + i * 7;
      const x = FOREST.x + Math.cos(a) * r;
      const z = FOREST.z + Math.sin(a) * r;
      const y = forestHeight(x, z);
      const grp = new THREE.Group();
      grp.position.set(x, y, z);
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, 0.9, 8), new THREE.MeshLambertMaterial({ color: 0x6a5a8a }));
      ped.position.y = 0.45;
      grp.add(ped);
      const gem = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4, 0), stoneMat);
      gem.position.y = 1.4;
      grp.add(gem);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: createSoftSpriteTexture(), color: 0x9fd8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(2.4);
      halo.position.y = 1.4;
      grp.add(halo);
      root.add(grp);
      return { x, z, y, group: grp, gem };
    });

    // a mysterious guide
    this.guide = createCritter('owl', { scale: 1.2, accessory: 'hat' });
    const gx = FOREST.x + 4;
    const gz = FOREST.z + 36;
    this.guide.position.set(gx, forestHeight(gx, gz), gz);
    this.guide.userData.baseY = this.guide.position.y;
    root.add(this.guide);
    this.guideSpot = { x: gx, z: gz };
    this.guideLines = [
      'Willkommen im Zauberwald, Schwester … hier ist es immer Dämmerung. 🦉',
      'Drei Mondsteine schlafen zwischen den leuchtenden Bäumen. Folge deinem Kompass.',
      'Im Westen liegt eine große Lichtung voller Runen. Dort schläft Morvanta, der Totenkopf-Falter, in ihrem Kokon …',
      'Nimm dich vor den Dornwichteln in Acht – sie beißen! Die anderen Tiere hier sind lieb.',
      'Bringst du alle drei, erwacht das Herz des Waldes in der Mitte.',
      'Das Tor hinter mir bringt dich zurück ins Himmelsgebirge.'
    ];
    this.guideLine = -1;

    // return gate in the arrival clearing
    this.returnGate = this.makeGate(FOREST.x, FOREST.z + 44, forestHeight(FOREST.x, FOREST.z + 44));
    this.returnGate.swirlMat.uniforms.uOn.value = 1;
    this.returnGate.light.intensity = 1.5;

    g.scene.add(root);
    this.refreshStones();
  }

  refreshStones() {
    this.stones.forEach((s, i) => { s.group.visible = !this.state.stones.includes(i); });
    if (this.state.heart) this.awakenVisual();
  }

  awakenVisual() {
    this.heartMat.color.setRGB(1.6, 1.0, 2.6);
    this.heartLight.intensity = 3;
  }

  // ---------- Travel ----------
  travel(toForest) {
    const g = this.game;
    if (this.travelling) return;
    this.travelling = true;
    if (this.overlay) this.overlay.classList.add('visible');
    sfx.magicSkill(3);
    setTimeout(() => {
      const target = toForest ? { x: FOREST.x, z: FOREST.z + 38 } : { x: this.portal.x, z: this.portal.z + 3.5 };
      const y = g.getTerrainHeight(target.x, target.z);
      const offset = g.camera.position.clone().sub(g.playerGroup.position);
      g.playerGroup.position.set(target.x, y, target.z);
      g.playerVelY = 0;
      if (g.moveVel) g.moveVel.set(0, 0, 0);
      g.camera.position.copy(g.playerGroup.position).add(offset);
      if (g.cameraDesired) g.cameraDesired.copy(g.camera.position);
      if (g.prevPlayerPos) g.prevPlayerPos.copy(g.playerGroup.position);
      g.controls.target.set(target.x, y + 1.6, target.z);
      this.inForest = toForest;
      sfx.zone = toForest ? 'forest' : null;
      setTimeout(() => {
        if (this.overlay) this.overlay.classList.remove('visible');
        this.travelling = false;
        g.showToast(toForest ? '🌲 Der Zauberwald … geheimnisvoll leuchten die Bäume.' : '🏔️ Zurück im Himmelsgebirge', 4000);
      }, 500);
    }, 900);
  }

  // ---------- Interact key ----------
  getInteraction() {
    const pp = this.game.playerGroup.position;
    if (!this.inForest) {
      const d = Math.hypot(pp.x - this.portal.x, pp.z - this.portal.z);
      if (d > 4) return null;
      return this.unlocked
        ? { dist: d, label: '🌀 In den Zauberwald reisen', action: () => this.travel(true) }
        : { dist: d, label: `🔒 Portal (${this.questsDone()}/${FOREST_QUESTS.length} Aufgaben)`, action: () => this.game.showToast(`🔒 Das Portal öffnet sich, wenn alle Aufgaben erfüllt sind (${this.questsDone()}/${FOREST_QUESTS.length}). Schau ins Quest-Feld!`, 4500) };
    }
    const dr = Math.hypot(pp.x - this.returnGate.x, pp.z - this.returnGate.z);
    if (dr < 4) return { dist: dr, label: '🌀 Zurück ins Himmelsgebirge', action: () => this.travel(false) };
    const dg = Math.hypot(pp.x - this.guideSpot.x, pp.z - this.guideSpot.z);
    if (dg < 3.2) return { dist: dg, label: '💬 Mit der Waldeule sprechen', action: () => this.talkGuide() };
    return null;
  }

  talkGuide() {
    this.guideLine = (this.guideLine + 1) % this.guideLines.length;
    const npcs = this.game.npcs;
    npcs.dialogName.textContent = 'Waldeule';
    npcs.dialogText.textContent = this.guideLines[this.guideLine];
    npcs.dialogMore.textContent = 'F: weiter';
    npcs.dialog.classList.add('open');
    clearTimeout(this.guideTimer);
    this.guideTimer = setTimeout(() => npcs.dialog.classList.remove('open'), 7000);
  }

  getTargets() {
    const out = this.stones
      .map((s, i) => ({ s, i }))
      .filter(o => !this.state.stones.includes(o.i))
      .map(o => ({ id: `moonstone:${o.i}`, icon: '💠', label: 'Mondstein', x: o.s.x, z: o.s.z }));
    if (!this.state.heart && this.state.stones.length >= STONES) out.push({ id: 'heart', icon: '💜', label: 'Herz des Waldes', x: FOREST.x, z: FOREST.z });
    out.push(...this.game.morvanta.getTargets());
    out.push({ id: 'returngate', icon: '🌀', label: 'Rückweg', x: this.returnGate.x, z: this.returnGate.z, noLabel: true });
    return out;
  }

  // ---------- Twilight atmosphere (runs after day/night and weather) ----------
  applyAtmosphere() {
    if (!this.inForest) return;
    const g = this.game;
    g.scene.fog.color.setRGB(0.16, 0.1, 0.28);
    g.scene.fog.density = 0.022;
    g.scene.background.setRGB(0.12, 0.07, 0.22);
    const sky = g.skyDome.material.uniforms;
    sky.uZenith.value.setRGB(0.05, 0.03, 0.14);
    sky.uHorizon.value.setRGB(0.22, 0.1, 0.32);
    sky.uNight.value = 1;
    g.sunLight.intensity = 0.35;
    g.sunLight.color.setRGB(0.7, 0.6, 1.0);
    g.hemiLight.intensity = 0.55;
    g.hemiLight.color.setRGB(0.6, 0.5, 1.0);
  }

  // ---------- Per frame ----------
  update(delta) {
    const g = this.game;
    const t = g.clock.elapsedTime;
    if (Math.floor(t * 2) !== this._tick) { this._tick = Math.floor(t * 2); this.checkUnlock(); }
    const on = this.unlocked ? 1 : 0;
    this.gate.swirlMat.uniforms.uOn.value += (on - this.gate.swirlMat.uniforms.uOn.value) * Math.min(1, delta * 2);
    this.gate.swirlMat.uniforms.uTime.value = t;
    this.gate.light.intensity = on * 1.6;
    this.returnGate.swirlMat.uniforms.uTime.value = t;

    // being in the forest area (portal, or a saved game) is what counts
    this.inForest = inForestArea(g.playerGroup.position.x);
    sfx.zone = this.inForest ? 'forest' : null;
    // the forest is only drawn while you are in it
    this.root.visible = this.inForest;
    this.returnGate.group.visible = this.inForest;
    if (!this.inForest) return;

    const pp = g.playerGroup.position;
    // floating lights
    const arr = this.motes.geometry.attributes.position.array;
    this.moteBase.forEach((m, i) => {
      arr[i * 3] = m.x + Math.sin(t * 0.4 + m.ph) * 1.5;
      arr[i * 3 + 1] = m.y + Math.sin(t * 0.9 + m.ph * 2) * 0.6;
      arr[i * 3 + 2] = m.z + Math.cos(t * 0.35 + m.ph) * 1.5;
    });
    this.motes.geometry.attributes.position.needsUpdate = true;

    // guide owl
    animateCritter(this.guide, t, 3);
    blinkFace(this.guide.userData.face, t);

    // moonstones
    this.stones.forEach((s, i) => {
      if (this.state.stones.includes(i)) return;
      s.gem.rotation.y += delta * 1.5;
      s.gem.position.y = 1.4 + Math.sin(t * 2 + i) * 0.15;
      if (Math.hypot(pp.x - s.x, pp.z - s.z) < 1.8) {
        this.state.stones.push(i);
        this.save();
        this.refreshStones();
        sfx.collect();
        g.fx.burst(new THREE.Vector3(s.x, s.y + 1.4, s.z), [new THREE.Color(0.8, 1.6, 2.6)], 40, { speed: 4, up: 3, size: 0.4, gravity: 3 });
        g.showToast(`💠 Mondstein gefunden (${this.state.stones.length}/${STONES})${this.state.stones.length === STONES ? ' – bring sie zum Herz des Waldes in der Mitte!' : ''}`, 4500);
        g.inventory.addCoins(15, 'Mondstein');
      }
    });

    // the heart awakens when all stones are brought to it
    if (!this.state.heart && this.state.stones.length >= STONES && Math.hypot(pp.x - FOREST.x, pp.z - FOREST.z) < 6) {
      this.state.heart = true;
      this.save();
      this.awakenVisual();
      const c = new THREE.Vector3(FOREST.x, forestHeight(FOREST.x, FOREST.z) + 9, FOREST.z);
      g.fx.flash(c, new THREE.Color(1.8, 1.2, 2.8), 14, 1.2);
      g.fx.burst(c, [new THREE.Color(1.6, 0.8, 2.6), new THREE.Color(2.4, 1.6, 2.6), new THREE.Color(0.8, 1.6, 2.6)], 160, { speed: 10, up: 5, size: 0.55, life: 1.6, gravity: 2 });
      sfx.victory();
      g.showToast('💜 Das Herz des Waldes ist erwacht! Du hast alle Geheimnisse der Galaxy Sisters gelüftet. 🌟', 9000);
      g.progression.addXp(300, 'Herz des Waldes');
      g.inventory.addCoins(100, 'Herz des Waldes');
    }
    this.heart.rotation.y += delta * (this.state.heart ? 0.3 : 0.05);
  }
}

function mulberry(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function labelTex(text) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(58, 35, 80, 0.92)';
  ctx.beginPath();
  ctx.roundRect(4, 6, 248, 52, 14);
  ctx.fill();
  ctx.fillStyle = '#f3e8ff';
  ctx.font = '800 30px "Segoe UI", "Segoe UI Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
