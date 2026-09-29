// ==========================================
// BRIDGES: Moon bridge, Roman stone bridge, rope bridge & floating star bridge
// Every bridge registers a walkable 'bridge' platform plus rail colliders.
// ==========================================
import * as THREE from 'three';
import { bakeStaticGroup } from './bake.js';

// Deck height along a bridge (t = 0..1)
export function bridgeDeckY(def, t) {
  return def.y0 + (def.y1 - def.y0) * t + def.arch * Math.sin(Math.PI * t);
}

// halfWidth = walkable deck, railLimit = how far from the center the player may walk
function makeDef(a, b, y0, y1, arch, halfWidth, railLimit) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  return {
    ax: a.x, az: a.z, bx: b.x, bz: b.z,
    dirX: dx / len, dirZ: dz / len, len,
    y0, y1, arch, halfWidth, railLimit
  };
}

// Group whose local +X runs along the bridge and local Z across it
function makeBridgeGroup(def) {
  const group = new THREE.Group();
  group.position.set(def.ax, 0, def.az);
  group.rotation.y = Math.atan2(-def.dirZ, def.dirX);
  return group;
}

function localToWorld(def, along, side) {
  return {
    x: def.ax + def.dirX * along - def.dirZ * side,
    z: def.az + def.dirZ * along + def.dirX * side
  };
}

function registerBridge(game, def) {
  // Rails are enforced by clamping the player sideways while on the deck (see updatePlayerMovement)
  game.platforms.push({ type: 'bridge', ...def });
  game.bridgeFootprints.push(def);
}

function curvePoints(def, samples, side, lift) {
  const pts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    pts.push(new THREE.Vector3(t * def.len, bridgeDeckY(def, t) + lift, side));
  }
  return pts;
}

function tubeAlong(def, side, lift, radius, material, samples = 32) {
  const curve = new THREE.CatmullRomCurve3(curvePoints(def, samples, side, lift));
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, samples * 2, radius, 6, false), material);
  mesh.castShadow = true;
  return mesh;
}

// Planks / blocks laid along the deck curve
function deckSegments(def, count, width, thickness, materials, gapFactor = 1.0, jitter = 0) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const t0 = i / count;
    const t1 = (i + 1) / count;
    const x0 = t0 * def.len;
    const x1 = t1 * def.len;
    const y0 = bridgeDeckY(def, t0);
    const y1 = bridgeDeckY(def, t1);
    const segLen = Math.hypot(x1 - x0, y1 - y0);
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(segLen * gapFactor + 0.02, thickness, width),
      materials[i % materials.length]
    );
    plank.position.set((x0 + x1) / 2, (y0 + y1) / 2 - thickness / 2, 0);
    plank.rotation.z = Math.atan2(y1 - y0, x1 - x0);
    if (jitter) {
      plank.rotation.x = (Math.random() - 0.5) * jitter;
      plank.position.z = (Math.random() - 0.5) * jitter;
    }
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
  }
  return group;
}

function createPaperLantern(glowMat, capMat) {
  const lantern = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), glowMat);
  body.scale.set(1, 1.25, 1);
  lantern.add(body);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 0.12, 8), capMat);
  capTop.position.y = 0.42;
  const capBottom = capTop.clone();
  capBottom.position.y = -0.42;
  lantern.add(capTop, capBottom);
  return lantern;
}

// ---------- 1. Kawaii Moon Bridge (red lacquer, paper lanterns) ----------
export function buildMoonBridge(game, a, b) {
  const y0 = game.getTerrainHeight(a.x, a.z);
  const y1 = game.getTerrainHeight(b.x, b.z);
  const def = makeDef(a, b, y0, y1, 2.3, 1.2, 0.62);
  def.kind = 'wood';
  def.id = 'moon';
  const group = makeBridgeGroup(def);
  const W = 2.5;

  const woodMats = [
    new THREE.MeshLambertMaterial({ color: 0xd9a066 }),
    new THREE.MeshLambertMaterial({ color: 0xc98f58 })
  ];
  const redMat = new THREE.MeshLambertMaterial({ color: 0xe23a4e });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x6b4a00, emissiveIntensity: 0.5 });
  const glowMat = new THREE.MeshLambertMaterial({ color: 0xffe2a8, emissive: 0xffb347, emissiveIntensity: 2.4 });
  glowMat.userData.lantern = true; // dim by day, full glow after dusk

  group.add(deckSegments(def, 30, W, 0.18, woodMats, 0.94));

  [-W / 2, W / 2].forEach(side => {
    group.add(tubeAlong(def, side, -0.2, 0.16, redMat));
    group.add(tubeAlong(def, side * 0.96, 1.0, 0.085, redMat));
    group.add(tubeAlong(def, side * 0.96, 0.52, 0.05, redMat));
    // Graceful supporting arch below the deck edge
    const archDef = { ...def, arch: def.arch * 0.82 };
    group.add(tubeAlong(archDef, side, -0.75, 0.12, redMat));

    for (let i = 1; i < 10; i++) {
      const t = i / 10;
      const y = bridgeDeckY(def, t);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.05, 8), redMat);
      post.position.set(t * def.len, y + 0.5, side * 0.96);
      post.castShadow = true;
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), goldMat);
      cap.position.set(t * def.len, y + 1.1, side * 0.96);
      group.add(post, cap);
    }
  });

  // Lantern posts at all four corners
  [0, 1].forEach(end => {
    [-1, 1].forEach(sign => {
      const along = end === 0 ? -0.2 : def.len + 0.2;
      const baseY = end === 0 ? y0 : y1;
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 2.1, 8), redMat);
      post.position.set(along, baseY + 1.05, sign * (W / 2 + 0.25));
      post.castShadow = true;
      const lantern = createPaperLantern(glowMat, redMat);
      lantern.position.set(along, baseY + 2.5, sign * (W / 2 + 0.25));
      group.add(post, lantern);
      const wp = localToWorld(def, along, sign * (W / 2 + 0.25));
      game.colliders.push({ type: 'cylinder', x: wp.x, z: wp.z, radius: 0.22, minY: baseY, maxY: baseY + 2.8 });
    });
  });

  game.scene.add(bakeStaticGroup(group));
  registerBridge(game, def);
  return def;
}

// ---------- 2. Roman Stone Bridge (arched, Flower of Life keystone) ----------
function createStoneBlockTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#efe3d2';
  ctx.fillRect(0, 0, 256, 256);
  const rows = 4;
  const rowH = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * 32;
    for (let c = -1; c < 5; c++) {
      const x = c * 64 + offset;
      const shade = 225 + Math.floor(Math.random() * 22);
      ctx.fillStyle = `rgb(${shade}, ${shade - 12}, ${shade - 26})`;
      ctx.fillRect(x + 3, r * rowH + 3, 58, rowH - 6);
    }
  }
  ctx.strokeStyle = 'rgba(160, 140, 120, 0.55)';
  ctx.lineWidth = 3;
  for (let r = 0; r <= rows; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * rowH);
    ctx.lineTo(256, r * rowH);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(0.45, 0.45);
  return tex;
}

export function buildRomanBridge(game, a, b, waterLevel, flowerTexture) {
  const y0 = game.getTerrainHeight(a.x, a.z);
  const y1 = game.getTerrainHeight(b.x, b.z);
  const def = makeDef(a, b, y0, y1, 2.1, 1.45, 0.85);
  def.kind = 'stone';
  def.id = 'roman';
  const group = makeBridgeGroup(def);
  const W = 3.2;
  const L = def.len;

  const stoneMat = new THREE.MeshLambertMaterial({ map: createStoneBlockTexture() });
  const copingMat = new THREE.MeshLambertMaterial({ color: 0xfaf3ea });
  const goldMat = new THREE.MeshLambertMaterial({ color: 0xffd166, emissive: 0x6b4a00, emissiveIntensity: 0.6 });
  const violetMat = new THREE.MeshLambertMaterial({ color: 0x9d4edd, emissive: 0x3b0b5c, emissiveIntensity: 0.5 });

  // Side profile: arched deck on top, big elliptical arch over the water below
  const deckThickness = 0.35;
  const bottomY = waterLevel - 2.6;
  const shape = new THREE.Shape();
  shape.moveTo(-0.6, bottomY);
  shape.lineTo(-0.6, y0 - deckThickness);
  const samples = 24;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    shape.lineTo(t * L, bridgeDeckY(def, t));
  }
  shape.lineTo(L + 0.6, y1 - deckThickness);
  shape.lineTo(L + 0.6, bottomY);
  const archCx = L / 2;
  const crownY = bridgeDeckY(def, 0.5);
  const archRx = L * 0.33;
  const springY = waterLevel - 0.6;
  const archRy = Math.max(1.2, crownY - deckThickness - 0.45 - springY);
  shape.lineTo(archCx + archRx, bottomY);
  shape.lineTo(archCx + archRx, springY);
  shape.absellipse(archCx, springY, archRx, archRy, 0, Math.PI, false);
  shape.lineTo(archCx - archRx, bottomY);
  shape.lineTo(-0.6, bottomY);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false, curveSegments: 20 });
  bodyGeo.translate(0, 0, -W / 2);
  const body = new THREE.Mesh(bodyGeo, stoneMat);
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Parapets following the deck
  [-1, 1].forEach(sign => {
    const z = sign * (W / 2 - 0.16);
    const count = 12;
    for (let i = 0; i < count; i++) {
      const t0 = i / count;
      const t1 = (i + 1) / count;
      const x0 = t0 * L;
      const x1 = t1 * L;
      const yA = bridgeDeckY(def, t0);
      const yB = bridgeDeckY(def, t1);
      const segLen = Math.hypot(x1 - x0, yB - yA);
      const ang = Math.atan2(yB - yA, x1 - x0);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.04, 0.72, 0.32), stoneMat);
      wall.position.set((x0 + x1) / 2, (yA + yB) / 2 + 0.36, z);
      wall.rotation.z = ang;
      wall.castShadow = true;
      const coping = new THREE.Mesh(new THREE.BoxGeometry(segLen + 0.06, 0.1, 0.44), copingMat);
      coping.position.set((x0 + x1) / 2, (yA + yB) / 2 + 0.77, z);
      coping.rotation.z = ang;
      group.add(wall, coping);
    }

    // End columns with golden orbs
    [[0, y0], [L, y1]].forEach(([x, y]) => {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.32, 1.5, 12), copingMat);
      col.position.set(x, y + 0.75, sign * (W / 2 + 0.05));
      col.castShadow = true;
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 16), violetMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, y + 1.35, sign * (W / 2 + 0.05));
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 12), goldMat);
      orb.position.set(x, y + 1.7, sign * (W / 2 + 0.05));
      group.add(col, ring, orb);
      const wp = localToWorld(def, x, sign * (W / 2 + 0.05));
      game.colliders.push({ type: 'cylinder', x: wp.x, z: wp.z, radius: 0.34, minY: y, maxY: y + 1.9 });
    });

    // Flower of Life medallion on the keystone
    if (flowerTexture) {
      const medallion = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 32),
        new THREE.MeshLambertMaterial({ map: flowerTexture, transparent: true, emissive: 0x2a0a40, emissiveIntensity: 0.4 })
      );
      medallion.position.set(archCx, springY + archRy + 0.22, sign * (W / 2 + 0.02));
      if (sign < 0) medallion.rotation.y = Math.PI;
      group.add(medallion);
    }
  });

  game.scene.add(bakeStaticGroup(group));
  registerBridge(game, def);
  return def;
}

// ---------- 3. Rope Bridge across the waterfall gorge ----------
export function buildRopeBridge(game, a, b, deckY0, deckY1) {
  const def = makeDef(a, b, deckY0, deckY1, -0.75, 0.9, 0.38);
  def.kind = 'wood';
  def.id = 'rope';
  const group = makeBridgeGroup(def);
  const W = 1.9;

  const plankMats = [
    new THREE.MeshLambertMaterial({ color: 0xb07a45 }),
    new THREE.MeshLambertMaterial({ color: 0x9c6a3b }),
    new THREE.MeshLambertMaterial({ color: 0xc28a52 })
  ];
  const ropeMat = new THREE.MeshLambertMaterial({ color: 0xe8d4a8 });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x7a4f2a, flatShading: true });
  const flagMats = [
    new THREE.MeshLambertMaterial({ color: 0xff70a6, side: THREE.DoubleSide }),
    new THREE.MeshLambertMaterial({ color: 0x70d6ff, side: THREE.DoubleSide }),
    new THREE.MeshLambertMaterial({ color: 0xffd670, side: THREE.DoubleSide })
  ];

  group.add(deckSegments(def, 26, W, 0.1, plankMats, 0.78, 0.05));

  const handDef = { ...def, arch: def.arch * 1.15 };
  [-W / 2, W / 2].forEach(side => {
    group.add(tubeAlong(def, side * 0.9, -0.08, 0.045, ropeMat));
    group.add(tubeAlong(handDef, side, 1.05, 0.055, ropeMat));
    for (let i = 1; i < 13; i++) {
      const t = i / 13;
      const yDeck = bridgeDeckY(def, t);
      const yHand = bridgeDeckY(handDef, t) + 1.05;
      const h = yHand - yDeck;
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, h, 4), ropeMat);
      rope.position.set(t * def.len, yDeck + h / 2, side);
      group.add(rope);
      // Tiny pennant flags on the hand rope
      if (i % 2 === 0) {
        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.34, 3), flagMats[i % 3]);
        flag.rotation.z = Math.PI;
        flag.position.set(t * def.len, yHand - 0.22, side);
        group.add(flag);
      }
    }
  });

  [[-0.25, deckY0], [def.len + 0.25, deckY1]].forEach(([x, y]) => {
    [-1, 1].forEach(sign => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 1.9, 7), poleMat);
      pole.position.set(x, y + 0.7, sign * (W / 2 + 0.1));
      pole.castShadow = true;
      group.add(pole);
      const wp = localToWorld(def, x, sign * (W / 2 + 0.1));
      game.colliders.push({ type: 'cylinder', x: wp.x, z: wp.z, radius: 0.22, minY: y - 0.3, maxY: y + 1.8 });
    });
  });

  game.scene.add(bakeStaticGroup(group));
  registerBridge(game, def);
  return def;
}

// ---------- 4. Floating Crystal Star Bridge (glowing stepping plates) ----------
export function buildStarBridge(game, center, dirX, dirZ, count, spacing, topY) {
  const plates = [];
  const mats = [
    new THREE.MeshLambertMaterial({ color: 0x9be7ff, emissive: 0x3fb8ff, emissiveIntensity: 1.6, transparent: true, opacity: 0.92 }),
    new THREE.MeshLambertMaterial({ color: 0xffb3ec, emissive: 0xff5fc8, emissiveIntensity: 1.5, transparent: true, opacity: 0.92 })
  ];
  const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.0, 1.2) });
  for (let i = 0; i < count; i++) {
    const off = (i - (count - 1) / 2) * spacing;
    const x = center.x + dirX * off;
    const z = center.z + dirZ * off;
    const plate = new THREE.Group();
    const slab = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.62, 0.32, 6), mats[i % 2]);
    slab.position.y = -0.16;
    plate.add(slab);
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), starMat);
    star.position.y = 0.55;
    plate.add(star);
    plate.position.set(x, topY, z);
    plate.userData = { baseY: topY, phase: i * 0.9, star };
    game.scene.add(plate);
    plates.push(plate);
    game.platforms.push({ type: 'cylinder', x, z, radius: 0.85, topY, crystal: true, plateIndex: i });
  }
  return plates;
}
