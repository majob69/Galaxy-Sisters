// ==========================================
// CHIBI SISTERS: procedural anime characters with big eyes, per-sister hairstyles,
// outfits matching the intro artwork, and walk / jump / swim / idle animation
// ==========================================
import * as THREE from 'three';

// Looks taken from the intro artwork
export const SISTER_STYLES = [
  { // Luna: lavender long hair, blue-white moon dress
    hair: 0xc6b6ff, hairShade: 0x9f8cf2, dress: 0xb4c8ff, bodice: 0xe8eeff, trim: 0x3d4fa8,
    boots: 0xf4f1ff, skin: 0xffe4d2, iris: 0x7b6cf6, emblem: 'moon', hairStyle: 'long'
  },
  { // Stella: golden hair, white & gold star dress
    hair: 0xffd35c, hairShade: 0xf2b53a, dress: 0xfff6ea, bodice: 0xffffff, trim: 0xf2b400,
    boots: 0xfffaf0, skin: 0xffe4d2, iris: 0x5f86ff, emblem: 'star', hairStyle: 'wavy'
  },
  { // Sol: orange twin tails, sunny outfit, sun-kissed skin
    hair: 0xff9a1f, hairShade: 0xff6f00, dress: 0xffa51f, bodice: 0xffc24d, trim: 0xffe08a,
    boots: 0xd98b1a, skin: 0xf0c098, iris: 0xff6b35, emblem: 'sun', hairStyle: 'twintails'
  },
  { // Planeta: violet flowing hair, galaxy dress
    hair: 0x8e44d8, hairShade: 0x6a2bb0, dress: 0x5b2a9e, bodice: 0x7a3cc4, trim: 0xc77dff,
    boots: 0x4a2382, skin: 0xffe0d0, iris: 0xb07cff, emblem: 'planet', hairStyle: 'flowing'
  }
];

// Unlockable outfits per sister (index 0 = the standard style above); only the listed colors change
export const SKIN_VARIANTS = [
  [
    null,
    { name: 'Mondgala', dress: 0x6f7fe8, bodice: 0xffe9a8, trim: 0xffd166 },
    { name: 'Mitternachtsmond', dress: 0x1b1f5c, bodice: 0x3a3f9c, trim: 0xa5b4ff, hair: 0x8f7bff, hairShade: 0x6a58d6 }
  ],
  [
    null,
    { name: 'Zuckerstern', dress: 0xffc1e3, bodice: 0xfff0f8, trim: 0xff7eb6 },
    { name: 'Sternennacht', dress: 0x24305e, bodice: 0x2f3f7d, trim: 0xffd35c, boots: 0xe9dfc4 }
  ],
  [
    null,
    { name: 'Abendrot', dress: 0xff5f6d, bodice: 0xff9b73, trim: 0xffe08a },
    { name: 'Glutkönigin', dress: 0x7a1f2b, bodice: 0xb0324a, trim: 0xffb84d, hair: 0xff5a1f, hairShade: 0xd63f00, boots: 0x4a1017 }
  ],
  [
    null,
    { name: 'Ringnebel', dress: 0x2cb8c9, bodice: 0x5fdbe6, trim: 0xd7fbff },
    { name: 'Dunkle Materie', dress: 0x111133, bodice: 0x2b1b66, trim: 0xff8ad8, hair: 0x5b2bb0, hairShade: 0x3f1c85, boots: 0x1a1240 }
  ]
];

// ---------- Painted anime eye (one textured plane instead of 7 meshes) ----------
const eyeTexCache = new Map();
export function getEyeTexture(iris, brows = false, side = 1) {
  const key = `${iris}-${brows}-${side}`;
  if (eyeTexCache.has(key)) return eyeTexCache.get(key);
  const W = 128;
  const H = 176;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const c = new THREE.Color(iris);
  const css = (col, k = 1) => `rgb(${Math.min(255, col.r * 255 * k)}, ${Math.min(255, col.g * 255 * k)}, ${Math.min(255, col.b * 255 * k)})`;
  const cy = H * 0.56;
  // Sclera
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(W / 2, cy, W * 0.42, H * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // Iris: dark top -> bright bottom
  const g = ctx.createLinearGradient(0, cy - H * 0.3, 0, cy + H * 0.3);
  g.addColorStop(0, css(c, 0.35));
  g.addColorStop(0.55, css(c, 1));
  g.addColorStop(1, css(c, 1.45));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(W / 2, cy + H * 0.02, W * 0.33, H * 0.31, 0, 0, Math.PI * 2);
  ctx.fill();
  // Pupil
  ctx.fillStyle = '#1b1433';
  ctx.beginPath();
  ctx.ellipse(W / 2, cy, W * 0.15, H * 0.17, 0, 0, Math.PI * 2);
  ctx.fill();
  // Highlights
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(W / 2 - side * W * 0.14, cy - H * 0.12, W * 0.12, H * 0.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(W / 2 + side * W * 0.13, cy + H * 0.14, W * 0.06, H * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  // Upper lash line with a little flick
  ctx.strokeStyle = '#2a1d3d';
  ctx.lineWidth = W * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.ellipse(W / 2, cy, W * 0.42, H * 0.36, 0, Math.PI * 1.08, Math.PI * 1.92);
  ctx.stroke();
  ctx.beginPath();
  const fx = W / 2 + side * W * 0.4;
  ctx.moveTo(fx, cy - H * 0.14);
  ctx.lineTo(fx + side * W * 0.06, cy - H * 0.22);
  ctx.stroke();
  if (brows) {
    ctx.lineWidth = W * 0.08;
    ctx.beginPath();
    ctx.moveTo(W / 2 - side * W * 0.34, H * 0.1);
    ctx.lineTo(W / 2 + side * W * 0.3, H * 0.2);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  eyeTexCache.set(key, tex);
  return tex;
}

function createEyePlane(size, iris, brows, side) {
  const mat = new THREE.MeshBasicMaterial({ map: getEyeTexture(iris, brows, side), alphaTest: 0.5 });
  mat.userData.noNightGlow = true;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(size * 2.0, size * 2.75), mat);
  plane.position.y = size * 0.25;
  return plane;
}

const HEAD_Y = 1.78;
const HEAD_R = 0.44;

export class ChibiRig {
  constructor() {
    this.group = new THREE.Group();
    this.time = 0;
    this.walkPhase = 0;
    this.blinkTimer = 2 + Math.random() * 2;
    this.blinkT = 0;
    this.hairSway = 0;

    const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
    this.mats = {
      skin: lambert(0xffe4d2),
      hair: lambert(0xc6b6ff),
      hairShade: lambert(0x9f8cf2),
      dress: lambert(0xb4c8ff),
      bodice: lambert(0xe8eeff),
      trim: new THREE.MeshLambertMaterial({ color: 0x3d4fa8, emissive: 0x000000 }),
      boots: lambert(0xf4f1ff),
      emblem: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.6) }),
      white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      iris: new THREE.MeshBasicMaterial({ color: 0x7b6cf6 }),
      irisDark: new THREE.MeshBasicMaterial({ color: 0x3a2f8f }),
      pupil: new THREE.MeshBasicMaterial({ color: 0x1b1433 }),
      shine: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.3, 1.3) }),
      lash: new THREE.MeshBasicMaterial({ color: 0x2a1d3d }),
      blush: new THREE.MeshBasicMaterial({ color: 0xff8fb1, transparent: true, opacity: 0.55, depthWrite: false }),
      mouth: new THREE.MeshBasicMaterial({ color: 0xd9546f })
    };

    // Characters keep their own lighting at night (no extra night glow)
    Object.values(this.mats).forEach(m => { m.userData.noNightGlow = true; });

    this.buildBody();
    this.buildHead();
    this.downAmt = 0;
    this.setStyle(0);
  }

  mesh(geo, mat, parent, x = 0, y = 0, z = 0, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    parent.add(m);
    return m;
  }

  buildBody() {
    const M = this.mats;
    // Hips pivot (bobs while walking)
    this.hips = new THREE.Group();
    this.group.add(this.hips);

    // Legs pivot at the hip joints, boots below
    this.legs = [-1, 1].map(side => {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.12, 0.66, 0);
      this.hips.add(pivot);
      this.mesh(new THREE.CapsuleGeometry(0.075, 0.34, 4, 8), M.skin, pivot, 0, -0.26, 0);
      this.mesh(new THREE.CapsuleGeometry(0.095, 0.2, 4, 8), M.boots, pivot, 0, -0.46, 0.0);
      const foot = this.mesh(new THREE.SphereGeometry(0.1, 10, 8), M.boots, pivot, 0, -0.6, 0.06);
      foot.scale.set(1, 0.7, 1.5);
      return pivot;
    });

    // Bell skirt
    // Bottom -> top so the lathe faces point outwards
    const skirtProfile = [
      new THREE.Vector2(0.5, -0.02), new THREE.Vector2(0.56, 0.0), new THREE.Vector2(0.52, 0.06),
      new THREE.Vector2(0.4, 0.25), new THREE.Vector2(0.28, 0.4), new THREE.Vector2(0.22, 0.46)
    ];
    this.skirt = this.mesh(new THREE.LatheGeometry(skirtProfile, 18), M.dress, this.hips, 0, 0.52, 0);
    const hem = this.mesh(new THREE.TorusGeometry(0.535, 0.025, 6, 24), M.trim, this.hips, 0, 0.53, 0);
    hem.rotation.x = Math.PI / 2;

    // Torso: bodice, belt, emblem, puff sleeves
    this.torso = new THREE.Group();
    this.torso.position.y = 0.98;
    this.hips.add(this.torso);
    this.mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.4, 14), M.bodice, this.torso, 0, 0.18, 0);
    const belt = this.mesh(new THREE.TorusGeometry(0.225, 0.04, 6, 20), M.trim, this.torso, 0, 0.02, 0);
    belt.rotation.x = Math.PI / 2;
    this.emblemGroup = new THREE.Group();
    this.emblemGroup.position.set(0, 0.24, 0.2);
    this.torso.add(this.emblemGroup);
    this.mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), M.skin, this.torso, 0, 0.42, 0);

    this.arms = [-1, 1].map(side => {
      this.mesh(new THREE.SphereGeometry(0.11, 10, 8), M.bodice, this.torso, side * 0.24, 0.33, 0);
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.26, 0.33, 0);
      this.torso.add(pivot);
      this.mesh(new THREE.CapsuleGeometry(0.06, 0.3, 4, 8), M.skin, pivot, side * 0.03, -0.2, 0);
      this.mesh(new THREE.SphereGeometry(0.075, 8, 8), M.skin, pivot, side * 0.04, -0.4, 0);
      const cuff = this.mesh(new THREE.TorusGeometry(0.065, 0.02, 6, 12), M.trim, pivot, side * 0.035, -0.32, 0);
      cuff.rotation.x = Math.PI / 2;
      pivot.userData.side = side;
      return pivot;
    });
  }

  buildHead() {
    const M = this.mats;
    this.head = new THREE.Group();
    this.head.position.y = HEAD_Y - 0.98;
    this.torso.add(this.head);

    const skull = this.mesh(new THREE.SphereGeometry(HEAD_R, 24, 18), M.skin, this.head);
    skull.scale.set(1, 0.95, 0.94);

    // Big anime eyes: one painted plane each (iris color swaps with the sister)
    this.eyes = [-1, 1].map(side => {
      const eye = new THREE.Group();
      eye.position.set(side * 0.155, -0.04, HEAD_R * 0.9);
      eye.rotation.y = side * 0.34;
      this.head.add(eye);
      eye.userData.plane = createEyePlane(0.095, 0x7b6cf6, false, side);
      eye.userData.side = side;
      eye.add(eye.userData.plane);
      return eye;
    });

    [-1, 1].forEach(side => {
      const blush = new THREE.Mesh(new THREE.CircleGeometry(0.06, 16), M.blush);
      blush.position.set(side * 0.26, -0.15, HEAD_R * 0.78);
      blush.rotation.y = side * 0.62;
      blush.scale.set(1.3, 0.7, 1);
      this.head.add(blush);
    });
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 4, 12, Math.PI), M.mouth);
    mouth.position.set(0, -0.2, HEAD_R * 0.88);
    mouth.rotation.z = Math.PI;
    this.head.add(mouth);

    // Hair: cap, back, bangs + per-sister style group
    const cap = this.mesh(new THREE.SphereGeometry(HEAD_R + 0.035, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.42), M.hair, this.head, 0, 0.02, -0.01);
    cap.scale.set(1.02, 1, 1);
    const back = this.mesh(new THREE.SphereGeometry(HEAD_R + 0.04, 20, 16, Math.PI, Math.PI, 0, Math.PI * 0.8), M.hair, this.head, 0, 0.0, -0.02);
    back.scale.set(1.04, 1.02, 1.06);
    for (let i = 0; i < 6; i++) {
      const t = (i / 5) * 2 - 1;
      const bang = this.mesh(new THREE.SphereGeometry(0.12, 10, 8), M.hair, this.head, t * 0.3, 0.2 - Math.abs(t) * 0.07, 0.33 - Math.abs(t) * 0.1);
      bang.scale.set(0.9, 1.2, 0.55);
      bang.rotation.set(-0.35, t * 0.5, -t * 0.35);
    }
    this.hairStyleGroup = new THREE.Group();
    this.head.add(this.hairStyleGroup);

    // Existing accessory slot (moon, star & bow, sun, planet rings) sits on the head
    this.accessorySlot = new THREE.Group();
    this.accessorySlot.position.set(0, 0.62, 0);
    this.accessorySlot.scale.setScalar(0.75);
    this.head.add(this.accessorySlot);
  }

  clearGroup(g) {
    while (g.children.length) {
      const c = g.children.pop();
      c.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    }
  }

  buildHairStyle(style) {
    const M = this.mats;
    const g = this.hairStyleGroup;
    this.clearGroup(g);
    this.hairBack = new THREE.Group();
    this.hairBack.position.set(0, -0.05, -0.2);
    g.add(this.hairBack);
    const lock = (parent, x, y, z, r, len, rx = 0, rz = 0, mat = M.hair) => {
      const m = this.mesh(new THREE.CapsuleGeometry(r, len, 4, 10), mat, parent, x, y, z);
      m.rotation.set(rx, 0, rz);
      return m;
    };

    if (style === 'long' || style === 'wavy' || style === 'flowing') {
      const length = style === 'flowing' ? 0.95 : 0.8;
      const width = style === 'flowing' ? 1.25 : 1.1;
      const panel = lock(this.hairBack, 0, -0.55, -0.08, 0.3, length, 0.12);
      panel.scale.set(width, 1, 0.5);
      // Side locks framing the face
      [-1, 1].forEach(side => {
        lock(g, side * 0.37, -0.32, 0.12, 0.085, 0.5, 0.1, side * 0.08);
        if (style !== 'long') lock(this.hairBack, side * 0.3, -0.62, 0.02, 0.1, length * 0.8, 0.1, side * -0.15, M.hairShade);
      });
      if (style === 'wavy') {
        for (let i = 0; i < 5; i++) {
          const wave = this.mesh(new THREE.SphereGeometry(0.13, 10, 8), M.hairShade, this.hairBack, (i - 2) * 0.13, -1.0 - Math.abs(i - 2) * 0.04, -0.08);
          wave.scale.set(1, 0.8, 0.7);
        }
      }
      if (style === 'flowing') {
        const swirl = lock(this.hairBack, 0.45, -0.75, -0.05, 0.14, 0.7, 0.2, -0.5, M.hairShade);
        swirl.scale.set(1, 1, 0.8);
      }
    } else if (style === 'twintails') {
      [-1, 1].forEach(side => {
        const tie = this.mesh(new THREE.SphereGeometry(0.08, 8, 8), M.trim, g, side * 0.4, 0.12, -0.08);
        tie.scale.set(1, 1, 1);
        const tail = new THREE.Group();
        tail.position.set(side * 0.45, 0.1, -0.1);
        tail.rotation.z = side * 0.55;
        this.hairBack.add(tail);
        const t1 = lock(tail, 0, -0.35, 0, 0.13, 0.5, 0, 0);
        t1.scale.set(1, 1, 0.8);
        lock(tail, side * 0.05, -0.75, 0, 0.09, 0.35, 0, side * -0.3, M.hairShade);
        tail.position.sub(this.hairBack.position);
      });
      // Spiky crown
      for (let i = 0; i < 5; i++) {
        const spike = this.mesh(new THREE.ConeGeometry(0.07, 0.22, 6), M.hair, g, (i - 2) * 0.12, 0.44 - Math.abs(i - 2) * 0.03, -0.02);
        spike.rotation.z = (i - 2) * -0.35;
      }
    }
  }

  buildEmblem(kind) {
    const g = this.emblemGroup;
    this.clearGroup(g);
    const M = this.mats;
    if (kind === 'moon') {
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 6, 14, Math.PI * 1.3), M.emblem);
      m.rotation.z = 0.9;
      g.add(m);
    } else if (kind === 'star') {
      const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.07, 0), M.emblem);
      m.scale.set(1, 1, 0.4);
      g.add(m);
    } else if (kind === 'sun') {
      g.add(new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), M.emblem));
      const rays = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.1, 8, 1), M.emblem);
      g.add(rays);
    } else {
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), M.emblem));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 4, 20), M.emblem);
      ring.rotation.x = 1.2;
      g.add(ring);
    }
  }

  setStyle(idx, variant = 0) {
    const st = { ...SISTER_STYLES[idx], ...(SKIN_VARIANTS[idx][variant] || {}) };
    const M = this.mats;
    M.skin.color.setHex(st.skin);
    // Soft self-light keeps anime faces bright even on the shadow side
    M.skin.emissive = new THREE.Color(st.skin).multiplyScalar(0.32);
    M.hair.emissive = new THREE.Color(st.hair).multiplyScalar(0.12);
    M.hair.color.setHex(st.hair);
    M.hairShade.color.setHex(st.hairShade);
    M.dress.color.setHex(st.dress);
    M.bodice.color.setHex(st.bodice);
    M.trim.color.setHex(st.trim);
    M.boots.color.setHex(st.boots);
    this.eyes.forEach(e => { e.userData.plane.material.map = getEyeTexture(st.iris, false, e.userData.side); });
    // Planeta's galaxy dress twinkles faintly
    M.dress.emissive = new THREE.Color(idx === 3 ? 0x2a0a55 : 0x000000);
    this.buildHairStyle(st.hairStyle);
    this.buildEmblem(st.emblem);
  }

  setOpacity(alpha) {
    const eyeMats = this.eyes.map(e => e.userData.plane.material);
    [...Object.values(this.mats), ...eyeMats].forEach(m => {
      if (m === this.mats.blush) return;
      m.transparent = alpha < 1;
      m.opacity = alpha;
      m.needsUpdate = true;
    });
  }

  // state: { moving, grounded, swimming, velY }
  update(delta, state) {
    this.time += delta;
    const t = this.time;

    // Blinking
    this.blinkTimer -= delta;
    if (this.blinkTimer <= 0) {
      this.blinkT = 0.14;
      this.blinkTimer = 2.2 + Math.random() * 3;
    }
    this.blinkT = Math.max(0, this.blinkT - delta);
    const lid = this.blinkT > 0 ? 0.1 : 1;
    this.eyes.forEach(e => { e.scale.y += (lid - e.scale.y) * 0.6; });

    let legSwing = 0;
    let armSwing = 0;
    let armLift = 0.12;
    let bob = 0;
    let lean = 0;
    let legTuck = 0;

    if (state.swimming) {
      const s = t * 5;
      armSwing = Math.sin(s) * 0.9;
      armLift = 1.2 + Math.cos(s) * 0.3;
      legSwing = Math.sin(s * 1.6) * 0.4;
      lean = 0.35;
    } else if (!state.grounded) {
      armLift = state.velY > 0 ? 2.3 : 1.5;
      legTuck = state.velY > 0 ? 0.5 : 0.2;
      lean = -0.08;
    } else if (state.moving) {
      this.walkPhase += delta * 11;
      legSwing = Math.sin(this.walkPhase) * 0.7;
      armSwing = -Math.sin(this.walkPhase) * 0.6;
      bob = Math.abs(Math.sin(this.walkPhase)) * 0.06;
      lean = 0.1;
    } else {
      armSwing = Math.sin(t * 1.8) * 0.05;
      bob = Math.sin(t * 2.2) * 0.012;
      this.walkPhase = 0;
    }

    // Knocked out: lie down on the back with limp arms and legs
    if (state.downed) {
      legSwing = 0;
      armSwing = 0;
      armLift = 0.35;
      legTuck = 0;
      lean = 0;
      bob = 0;
    }
    this.downAmt += ((state.downed ? 1 : 0) - this.downAmt) * Math.min(1, delta * 8);
    this.group.rotation.x = -1.45 * this.downAmt;
    this.group.position.y = 0.32 * this.downAmt;

    this.hips.position.y = bob;
    this.hips.rotation.x += (lean - this.hips.rotation.x) * 0.2;
    this.legs[0].rotation.x = legSwing - legTuck;
    this.legs[1].rotation.x = -legSwing - legTuck * 0.6;
    this.arms.forEach((arm, i) => {
      const dir = i === 0 ? 1 : -1;
      arm.rotation.x = armSwing * dir;
      const targetZ = arm.userData.side * armLift;
      arm.rotation.z += (targetZ - arm.rotation.z) * 0.25;
    });
    this.torso.scale.y = 1 + Math.sin(t * 2.2) * 0.012;
    this.head.rotation.z = Math.sin(t * 1.3) * 0.04;

    // Hair trails behind when moving
    const sway = (state.moving || state.swimming ? 0.25 : 0) + (!state.grounded ? -0.2 : 0);
    this.hairSway += (sway - this.hairSway) * 0.1;
    if (this.hairBack) this.hairBack.rotation.x = this.hairSway + Math.sin(t * 2) * 0.03;
  }
}

// ==========================================
// ANIME FACE for creatures: big glossy eyes, blush & mouth on a head sphere
// ==========================================
const faceMatCache = new Map();
function faceMats(iris) {
  if (!faceMatCache.has(iris)) {
    faceMatCache.set(iris, {
      white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
      iris: new THREE.MeshBasicMaterial({ color: iris }),
      irisDark: new THREE.MeshBasicMaterial({ color: new THREE.Color(iris).multiplyScalar(0.45) }),
      pupil: new THREE.MeshBasicMaterial({ color: 0x1b1433 }),
      shine: new THREE.MeshBasicMaterial({ color: new THREE.Color(1.3, 1.3, 1.3) }),
      lash: new THREE.MeshBasicMaterial({ color: 0x2a1d3d }),
      blush: new THREE.MeshBasicMaterial({ color: 0xff8fb1, transparent: true, opacity: 0.55, depthWrite: false }),
      mouth: new THREE.MeshBasicMaterial({ color: 0xd9546f })
    });
  }
  return faceMatCache.get(iris);
}

// Places a face on a sphere (center/radius in the parent's space), looking along +Z
export function addAnimeFace(parent, { center, radius, spread = 0.38, eyeSize = 0.2, iris = 0x6c5ce7, blush = true, mouth = true, brows = false }) {
  const M = faceMats(iris);
  const face = new THREE.Group();
  face.position.copy(center);
  parent.add(face);
  const onSphere = (theta, phi, lift = 0.01) => new THREE.Vector3(
    Math.sin(theta) * Math.cos(phi) * (radius + lift),
    Math.sin(phi) * (radius + lift),
    Math.cos(theta) * Math.cos(phi) * (radius + lift)
  );
  const k = eyeSize / 0.095;
  const eyes = [-1, 1].map(side => {
    const eye = new THREE.Group();
    eye.position.copy(onSphere(side * spread, 0.05));
    eye.rotation.set(-0.05, side * spread, 0);
    eye.scale.setScalar(k);
    eye.add(createEyePlane(0.095, iris, brows, side));
    face.add(eye);
    return eye;
  });
  if (blush) {
    [-1, 1].forEach(side => {
      const b = new THREE.Mesh(new THREE.CircleGeometry(eyeSize * 0.65, 14), M.blush);
      b.position.copy(onSphere(side * (spread + 0.42), -0.22, 0.012));
      b.rotation.set(0.2, side * (spread + 0.42), 0);
      b.scale.set(1.3, 0.7, 1);
      face.add(b);
    });
  }
  if (mouth) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(eyeSize * 0.45, eyeSize * 0.12, 4, 12, Math.PI), M.mouth);
    m.position.copy(onSphere(0, -0.32, 0.012));
    m.rotation.set(0.32, 0, Math.PI);
    face.add(m);
  }
  face.userData.eyes = eyes;
  face.userData.blinkSeed = Math.random() * 10;
  return face;
}

// Occasional blinks for creature faces
export function blinkFace(face, time) {
  const cycle = (time * 0.31 + face.userData.blinkSeed) % 4.2;
  const lid = cycle < 0.13 ? 0.12 : 1;
  face.userData.eyes.forEach(e => { e.scale.y += (lid * e.scale.x - e.scale.y) * 0.5; });
}
