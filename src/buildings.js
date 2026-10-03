// ==========================================
// BUILDINGS & FURNITURE MODELS: everything the sisters can build on the building land
// (fountain, garden pavilion, lookout tower, berry garden, workshop, guest house) and the
// little furniture pieces they can set up in their houses. Only geometry lives here -
// costs, saving and interaction are in houses.js.
// ==========================================
import * as THREE from 'three';

// What can be built on the building land. cost may include crafted furniture (door, lamp, table).
export const BUILDINGS = [
  { id: 'fountain', name: 'Sternenbrunnen', icon: '⛲', cost: { stone: 10, glass: 3 }, desc: 'Wer am Brunnen steht, wird langsam geheilt.' },
  { id: 'gazebo', name: 'Gartenlaube', icon: '🌸', cost: { wood: 8, rope: 2, cloth: 3, lamp: 1 }, desc: 'Ein gemütlicher Platz zum Ausruhen – leuchtet nachts.' },
  { id: 'tower', name: 'Aussichtsturm', icon: '🗼', cost: { wood: 14, rope: 4, stone: 4 }, desc: 'Hüpf die Stufen hinauf und genieß die Aussicht!' },
  { id: 'garden', name: 'Beerenbeet', icon: '🌻', cost: { wood: 4, stone: 2 }, desc: 'Jeden Tag kannst du Beeren und einen Apfel ernten.' },
  { id: 'workshop', name: 'Werkstatt', icon: '🔨', cost: { wood: 10, stone: 4, rope: 2, table: 1 }, desc: 'Mit Werkbank – und jeden Tag liegt frisches Holz bereit.' },
  { id: 'guesthouse', name: 'Gästehaus', icon: '🏠', cost: { wood: 12, stone: 8, glass: 3, rope: 2, cloth: 2, door: 1 }, desc: 'Ein zweites Haus mit Bett und Vorratstruhe.' }
];

const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, flatShading: true, ...extra });
const glow = (r, g, b) => {
  const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(r, g, b) });
  m.userData.noNightGlow = true;
  return m;
};

function add(group, geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  group.add(m);
  return m;
}

// Each builder returns { group, colliders: [local cylinders/boxes], platforms: [local platforms], extra }
export function buildStructure(id) {
  const group = new THREE.Group();
  const colliders = [];
  const platforms = [];
  const extra = {};
  const wood = lam(0xa8713f);
  const woodDark = lam(0x7a4f2a);
  const stone = lam(0xc9c3d6);
  if (id === 'fountain') {
    add(group, new THREE.CylinderGeometry(2.1, 2.3, 0.7, 20), stone, 0, 0.35, 0);
    const water = add(group, new THREE.CircleGeometry(1.85, 24), glow(0.5, 1.2, 1.9), 0, 0.66, 0);
    water.rotation.x = -Math.PI / 2;
    add(group, new THREE.CylinderGeometry(0.28, 0.4, 1.8, 10), stone, 0, 1.3, 0);
    add(group, new THREE.CylinderGeometry(0.8, 0.5, 0.3, 14), stone, 0, 2.2, 0);
    const star = add(group, new THREE.OctahedronGeometry(0.35, 0), glow(2.6, 2.1, 0.6), 0, 2.75, 0);
    extra.star = star;
    colliders.push({ type: 'cylinder', x: 0, z: 0, radius: 2.2, h: 0.9 });
  } else if (id === 'gazebo') {
    add(group, new THREE.CylinderGeometry(2.9, 3.0, 0.25, 6), wood, 0, 0.12, 0);
    platforms.push({ type: 'cylinder', x: 0, z: 0, radius: 2.9, top: 0.25 });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      add(group, new THREE.CylinderGeometry(0.1, 0.12, 2.7, 6), woodDark, Math.cos(a) * 2.6, 1.6, Math.sin(a) * 2.6);
      colliders.push({ type: 'cylinder', x: Math.cos(a) * 2.6, z: Math.sin(a) * 2.6, radius: 0.15, h: 3 });
    }
    add(group, new THREE.ConeGeometry(3.4, 1.6, 6), lam(0xff9ecf), 0, 3.75, 0);
    const bench = add(group, new THREE.BoxGeometry(2.2, 0.15, 0.6), wood, 0, 0.7, -1.6);
    bench.userData.seat = true;
    add(group, new THREE.BoxGeometry(2.2, 0.5, 0.12), wood, 0, 1.0, -1.9);
    extra.bulb = add(group, new THREE.SphereGeometry(0.22, 12, 10), glow(2.4, 1.9, 1.0), 0, 2.6, 0);
  } else if (id === 'tower') {
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => {
      add(group, new THREE.BoxGeometry(0.3, 9.2, 0.3), woodDark, x, 4.6, z);
      colliders.push({ type: 'cylinder', x, z, radius: 0.25, h: 9.4 });
    });
    // stepping stones spiralling up around the tower
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 * 1.25;
      const x = Math.cos(a) * 2.9;
      const z = Math.sin(a) * 2.9;
      const top = 0.9 + i * 0.95;
      add(group, new THREE.CylinderGeometry(0.85, 0.85, 0.25, 10), wood, x, top - 0.12, z);
      platforms.push({ type: 'cylinder', x, z, radius: 0.85, top });
    }
    add(group, new THREE.BoxGeometry(3.6, 0.3, 3.6), wood, 0, 9.35, 0);
    platforms.push({ type: 'box', x: 0, z: 0, hw: 1.8, hd: 1.8, top: 9.5 });
    add(group, new THREE.ConeGeometry(2.8, 1.8, 4), lam(0x7fbf6a), 0, 12.1, 0).rotation.y = Math.PI / 4;
    [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]].forEach(([x, z]) => add(group, new THREE.BoxGeometry(0.2, 1.7, 0.2), woodDark, x, 10.3, z));
    const scope = add(group, new THREE.CylinderGeometry(0.1, 0.16, 1.0, 10), lam(0xffd166), 0.6, 10.2, 0.6);
    scope.rotation.set(0.9, 0.6, 0);
    extra.top = 9.5;
  } else if (id === 'garden') {
    [[-1.3, 0], [1.3, 0]].forEach(([x, z]) => {
      add(group, new THREE.BoxGeometry(2.0, 0.45, 3.6), woodDark, x, 0.22, z);
      add(group, new THREE.BoxGeometry(1.8, 0.1, 3.4), lam(0x5a3a24), x, 0.47, z);
      for (let k = 0; k < 3; k++) {
        add(group, new THREE.SphereGeometry(0.42, 10, 8), lam(0x3f8a4a), x, 0.8, z - 1.1 + k * 1.1);
        for (let b = 0; b < 4; b++) add(group, new THREE.SphereGeometry(0.08, 6, 5), glow(0.5, 0.6, 1.8), x + Math.cos(b * 1.6) * 0.35, 0.95 + (b % 2) * 0.15, z - 1.1 + k * 1.1 + Math.sin(b * 1.6) * 0.35);
      }
      colliders.push({ type: 'box', x, z, hw: 1.0, hd: 1.8, h: 0.5 });
    });
    for (let s = 0; s < 3; s++) {
      add(group, new THREE.CylinderGeometry(0.05, 0.05, 1.6, 5), lam(0x4f9a3a), -2.7, 0.8, -1.2 + s * 1.2);
      add(group, new THREE.CylinderGeometry(0.3, 0.3, 0.08, 12), lam(0xffd23f), -2.7, 1.65, -1.1 + s * 1.2).rotation.x = 1.2;
    }
  } else if (id === 'workshop') {
    [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6], [2.2, 1.6]].forEach(([x, z]) => {
      add(group, new THREE.CylinderGeometry(0.14, 0.16, 3, 6), woodDark, x, 1.5, z);
      colliders.push({ type: 'cylinder', x, z, radius: 0.2, h: 3 });
    });
    const roof = add(group, new THREE.BoxGeometry(5.2, 0.2, 4.0), lam(0xd9534f), 0, 3.05, 0);
    roof.rotation.x = 0.12;
    add(group, new THREE.BoxGeometry(2.4, 0.15, 1.0), wood, 0, 0.95, -1.0);
    [[-1.0, -1.35], [1.0, -1.35], [-1.0, -0.65], [1.0, -0.65]].forEach(([x, z]) => add(group, new THREE.BoxGeometry(0.12, 0.9, 0.12), woodDark, x, 0.45, z));
    add(group, new THREE.BoxGeometry(0.6, 0.12, 0.12), lam(0x9aa0a6), -0.4, 1.08, -1.0);
    add(group, new THREE.BoxGeometry(0.12, 0.3, 0.2), lam(0x9aa0a6), 0.5, 1.15, -1.0);
    colliders.push({ type: 'box', x: 0, z: -1.0, hw: 1.2, hd: 0.5, h: 1.0 });
    for (let l = 0; l < 6; l++) {
      const log = add(group, new THREE.CylinderGeometry(0.18, 0.18, 1.4, 8), wood, 1.6 - (l % 3) * 0.38, 0.2 + Math.floor(l / 3) * 0.33, 1.1);
      log.rotation.x = Math.PI / 2;
    }
    extra.logs = true;
  }
  return { group, colliders, platforms, extra };
}

// ---------- Furniture ----------
export function buildFurniture(id) {
  const g = new THREE.Group();
  const wood = lam(0xb07a45);
  const woodDark = lam(0x7a4f2a);
  if (id === 'chair') {
    add(g, new THREE.BoxGeometry(0.6, 0.08, 0.6), wood, 0, 0.5, 0);
    add(g, new THREE.BoxGeometry(0.6, 0.6, 0.08), wood, 0, 0.82, -0.26);
    [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]].forEach(([x, z]) => add(g, new THREE.BoxGeometry(0.07, 0.5, 0.07), woodDark, x, 0.25, z));
  } else if (id === 'table') {
    add(g, new THREE.BoxGeometry(1.3, 0.09, 0.9), wood, 0, 0.78, 0);
    [[-0.55, -0.35], [0.55, -0.35], [-0.55, 0.35], [0.55, 0.35]].forEach(([x, z]) => add(g, new THREE.BoxGeometry(0.08, 0.78, 0.08), woodDark, x, 0.39, z));
  } else if (id === 'door') {
    add(g, new THREE.BoxGeometry(1.0, 2.0, 0.1), lam(0x8d5a34), 0, 1.0, 0);
    add(g, new THREE.BoxGeometry(1.15, 2.1, 0.06), woodDark, 0, 1.05, -0.06);
    add(g, new THREE.SphereGeometry(0.06, 8, 6), lam(0xffd166), 0.36, 1.0, 0.07);
  } else if (id === 'lamp') {
    add(g, new THREE.CylinderGeometry(0.22, 0.26, 0.08, 12), woodDark, 0, 0.04, 0);
    add(g, new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), woodDark, 0, 0.75, 0);
    add(g, new THREE.SphereGeometry(0.16, 12, 10), glow(2.6, 2.1, 1.1), 0, 1.5, 0);
    add(g, new THREE.ConeGeometry(0.32, 0.3, 14, 1, true), lam(0xfff1d6, { side: THREE.DoubleSide }), 0, 1.62, 0);
  } else if (id === 'shelf') {
    add(g, new THREE.BoxGeometry(1.2, 1.6, 0.08), woodDark, 0, 0.8, -0.18);
    [0.1, 0.6, 1.1, 1.58].forEach(y => add(g, new THREE.BoxGeometry(1.2, 0.06, 0.4), wood, 0, y, 0));
    const cols = [0xff7eb6, 0x7fc8ff, 0xffd166, 0x9b8cff, 0x7ed957];
    for (let i = 0; i < 6; i++) add(g, new THREE.BoxGeometry(0.12, 0.34, 0.26), lam(cols[i % 5]), -0.4 + (i % 3) * 0.15 + Math.floor(i / 3) * 0.55, 0.31 + Math.floor(i / 3) * 0.5, 0);
  } else if (id === 'plant') {
    add(g, new THREE.CylinderGeometry(0.22, 0.16, 0.36, 12), lam(0xd9805a), 0, 0.18, 0);
    for (let i = 0; i < 5; i++) add(g, new THREE.SphereGeometry(0.17, 8, 6), lam(0x4f9a3a), Math.cos(i * 1.3) * 0.13, 0.5 + (i % 2) * 0.16, Math.sin(i * 1.3) * 0.13);
    add(g, new THREE.SphereGeometry(0.08, 6, 5), glow(2.2, 0.9, 1.4), 0, 0.75, 0);
  } else if (id === 'sofa') {
    const cloth = lam(0x9b8cff);
    add(g, new THREE.BoxGeometry(1.8, 0.4, 0.8), cloth, 0, 0.3, 0);
    add(g, new THREE.BoxGeometry(1.8, 0.6, 0.2), cloth, 0, 0.7, -0.3);
    [-0.9, 0.9].forEach(x => add(g, new THREE.BoxGeometry(0.2, 0.55, 0.8), cloth, x, 0.45, 0));
    [-0.4, 0.4].forEach(x => add(g, new THREE.BoxGeometry(0.6, 0.25, 0.25), lam(0xffd6ec), x, 0.65, -0.15));
  } else if (id === 'picture') {
    add(g, new THREE.BoxGeometry(0.06, 1.6, 0.06), woodDark, 0, 0.8, 0);
    add(g, new THREE.BoxGeometry(0.9, 0.7, 0.06), woodDark, 0, 1.55, 0.05);
    const paint = add(g, new THREE.PlaneGeometry(0.76, 0.56), new THREE.MeshBasicMaterial({ map: paintingTexture() }), 0, 1.55, 0.09);
    paint.castShadow = false;
  }
  return g;
}

let paintTex = null;
function paintingTexture() {
  if (paintTex) return paintTex;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#2a1650');
  grad.addColorStop(1, '#ff9ecf');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 96);
  ctx.fillStyle = '#fff6c8';
  ctx.beginPath();
  ctx.arc(92, 26, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5aa86a';
  ctx.beginPath();
  ctx.moveTo(0, 96); ctx.lineTo(0, 70); ctx.quadraticCurveTo(40, 50, 70, 72); ctx.quadraticCurveTo(100, 58, 128, 68); ctx.lineTo(128, 96);
  ctx.fill();
  paintTex = new THREE.CanvasTexture(c);
  paintTex.colorSpace = THREE.SRGBColorSpace;
  return paintTex;
}

// Wooden scaffolding shown while the upper floor is being built
export function buildScaffold(w, d, h) {
  const g = new THREE.Group();
  const pole = lam(0xc8a06a);
  const plank = lam(0x9c6b3c);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new THREE.CylinderGeometry(0.08, 0.08, h, 6), pole, sx * (w / 2 + 0.7), h / 2, sz * (d / 2 + 0.7));
  [h * 0.45, h * 0.9].forEach(y => {
    add(g, new THREE.BoxGeometry(w + 1.6, 0.08, 0.5), plank, 0, y, d / 2 + 0.7);
    add(g, new THREE.BoxGeometry(w + 1.6, 0.08, 0.5), plank, 0, y, -d / 2 - 0.7);
    add(g, new THREE.BoxGeometry(0.5, 0.08, d + 1.6), plank, w / 2 + 0.7, y, 0);
    add(g, new THREE.BoxGeometry(0.5, 0.08, d + 1.6), plank, -w / 2 - 0.7, y, 0);
  });
  return g;
}
