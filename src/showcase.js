// ==========================================
// CHARACTER SHOWCASE (figuren.html): the four sisters as 3D figures - the same ChibiRig models
// as in the game. Inspector with poses, light moods, outfits, wireframe and eyes that follow the
// cursor, plus a small play mode (collect stars, double jump, cast the sister's magic).
// ==========================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ChibiRig, SKIN_VARIANTS } from './characters.js';
import { playerMethods } from './game/player.js';
import { SISTERS, sfx } from './game/shared.js';
import { applyCelShading } from './atmosphere.js';
import { MagicFX, createShieldMaterial } from './magicfx.js';

applyCelShading();

const HAIR = { long: 'lang & glatt', wavy: 'wellig', twintails: 'Zöpfe', flowing: 'wallend' };
const PORTRAIT_X = ['8%', '37%', '63%', '92%'];
const SISTER_COLORS = [[0.8, 1.5, 2.4], [2.6, 2.1, 0.6], [2.6, 1.1, 0.25], [1.6, 0.8, 2.6]];

const LIGHTS = {
  sunset: { top: '#2a1650', bottom: '#ff9e8a', fog: 0x6a3a6a, hemi: [0xffd6c2, 0x5a3a7a, 0.9], sun: [0xffb07a, 1.4], rim: 0xff7eb6 },
  day: { top: '#6fb2ff', bottom: '#f3e6ff', fog: 0xd8e6ff, hemi: [0xffffff, 0x8899cc, 1.05], sun: [0xfff6e8, 1.5], rim: 0xffffff },
  night: { top: '#050820', bottom: '#2a2a6e', fog: 0x141a40, hemi: [0x8090ff, 0x1a1a40, 0.55], sun: [0xa0b4ff, 0.7], rim: 0x7f9cff },
  neon: { top: '#12002a', bottom: '#3a0060', fog: 0x200040, hemi: [0xc77dff, 0x00e5ff, 0.75], sun: [0xff7ee3, 0.9], rim: 0x00f0ff }
};

// ---------- Renderer, scene, camera ----------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 2.2;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI / 2 - 0.02;
controls.enablePan = false;

const hemi = new THREE.HemisphereLight(0xffffff, 0x7289da, 1);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.4);
sun.position.set(3, 7, 5);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
scene.add(sun);
const rim = new THREE.PointLight(0xff7eb6, 2.2, 12, 2);
rim.position.set(-2.5, 2.5, -2.5);
scene.add(rim);
const neonA = new THREE.PointLight(0xff3df0, 0, 10, 2);
neonA.position.set(2.5, 1.5, 2);
const neonB = new THREE.PointLight(0x00e5ff, 0, 10, 2);
neonB.position.set(-2.5, 1.5, 2);
scene.add(neonA, neonB);

// background gradient
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 4;
skyCanvas.height = 256;
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
scene.fog = new THREE.Fog(0x6a3a6a, 18, 60);

// stars in the sky (night / neon)
const starGeo = new THREE.BufferGeometry();
const sp = [];
for (let i = 0; i < 500; i++) {
  const a = Math.random() * Math.PI * 2;
  const r = 30 + Math.random() * 20;
  sp.push(Math.cos(a) * r, 4 + Math.random() * 30, Math.sin(a) * r);
}
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
const skyStars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6c8, size: 0.25, transparent: true, opacity: 0, fog: false }));
scene.add(skyStars);

// ---------- Stage: pedestal (inspector) and meadow (play mode) ----------
const stage = new THREE.Group();
scene.add(stage);
const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.3, 48), new THREE.MeshLambertMaterial({ color: 0x3a2856 }));
pedestal.position.y = -0.15;
pedestal.receiveShadow = true;
stage.add(pedestal);
const ringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 2.4) });
const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.05, 8, 64), ringMat);
ring.rotation.x = Math.PI / 2;
ring.position.y = 0.01;
stage.add(ring);
const floor = new THREE.Mesh(new THREE.CircleGeometry(24, 64), new THREE.MeshLambertMaterial({ color: 0x5aa86a }));
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.3;
floor.receiveShadow = true;
scene.add(floor);

// play mode things
const playGroup = new THREE.Group();
playGroup.visible = false;
scene.add(playGroup);
const platforms = [[5, 1.2, -3], [-5, 1.8, -4], [0, 2.6, -7.5], [7, 0.8, 4]].map(([x, h, z]) => {
  const p = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.5, 0.4, 24), new THREE.MeshLambertMaterial({ color: 0xb28cff }));
  p.position.set(x, h - 0.2, z);
  p.castShadow = true;
  p.receiveShadow = true;
  playGroup.add(p);
  return { x, z, top: h, r: 1.4 };
});
const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.1, 0.6) });
let pickups = [];
function placeStars() {
  pickups.forEach(p => playGroup.remove(p.mesh));
  pickups = [];
  for (let i = 0; i < 12; i++) {
    let x;
    let z;
    let y = 0.9;
    if (i < platforms.length) {
      x = platforms[i].x;
      z = platforms[i].z;
      y = platforms[i].top + 0.9;
    } else {
      const a = Math.random() * Math.PI * 2;
      const r = 3 + Math.random() * 14;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
    }
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), starMat);
    m.position.set(x, y, z);
    playGroup.add(m);
    pickups.push({ mesh: m, got: false, base: y });
  }
}

const fx = new MagicFX(scene, 1200);

// ---------- The figure ----------
let sister = Math.max(0, Math.min(3, Number(new URLSearchParams(location.search).get('s')) || 0));
let variant = 0;
const rig = new ChibiRig();
rig.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
// rig.update() owns rig.group's own y/x-rotation (knock-out pose), so position the figure via a holder
const holder = new THREE.Group();
holder.add(rig.group);
scene.add(holder);
rig.eyes.forEach(e => { e.userData.plane.userData.baseY = e.userData.plane.position.y; });
const shield = new THREE.Mesh(new THREE.SphereGeometry(1.3, 32, 20), createShieldMaterial());
shield.position.y = 1.2;
holder.add(shield);
let shieldTimer = 0;
const player = { pos: holder.position, vel: new THREE.Vector3(), vy: 0, grounded: true, airJump: false, facing: 0 };

function setSister(i, v = 0) {
  sister = i;
  variant = v;
  playerMethods.applySisterLook(rig, i, v);
  rig.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
  if (wire) setWire(true);
  const s = SISTERS[i];
  document.documentElement.style.setProperty('--accent', s.accentColor);
  document.getElementById('badge').textContent = s.icon;
  const [, role] = s.title.match(/^(.*?) \(/) || [null, s.title];
  document.getElementById('name').innerHTML = '';
  document.getElementById('name').append(document.createTextNode(`${s.name} `));
  const span = document.createElement('span');
  span.textContent = `✦ ${role || s.title}`;
  document.getElementById('name').append(span);
  document.getElementById('title').textContent = `${s.title.replace(/^.*?\(/, '').replace(/\)$/, '')} · Spielfigur in 3D`;
  document.getElementById('portrait').style.objectPosition = `${PORTRAIT_X[i]} 35%`;
  document.querySelectorAll('.sis').forEach((b, k) => b.classList.toggle('active', k === i));
  renderOutfits();
  renderFacts();
  history.replaceState(null, '', `?s=${i}`);
  ringMat.color.setRGB(...SISTER_COLORS[i]);
}

function renderOutfits() {
  const box = document.getElementById('outfits');
  box.textContent = '';
  [0, 1, 2].forEach(v => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (v === variant ? ' active' : '');
    b.textContent = v === 0 ? 'Standard' : SKIN_VARIANTS[sister][v].name;
    b.addEventListener('click', () => setSister(sister, v));
    box.appendChild(b);
  });
}

function renderFacts() {
  const s = SISTERS[sister];
  const ul = document.getElementById('facts');
  ul.textContent = '';
  const add = (label, text, bar) => {
    const li = document.createElement('li');
    const b = document.createElement('b');
    b.textContent = label;
    const d = document.createElement('div');
    d.textContent = text;
    if (bar !== undefined) {
      const wrap = document.createElement('div');
      wrap.className = 'bar';
      const fill = document.createElement('i');
      fill.style.width = `${Math.round(bar * 100)}%`;
      wrap.appendChild(fill);
      d.appendChild(wrap);
    }
    li.append(b, d);
    ul.appendChild(li);
  };
  add('Kraft 1 (E)', `${s.ability1.icon} ${s.ability1.name} · alle ${s.ability1.cooldown} s`);
  add('Kraft 2 (R)', `${s.ability2.icon} ${s.ability2.name} · alle ${s.ability2.cooldown} s`);
  add('Tempo', `${Math.round(s.speed * 100)}`, s.speed / 0.25);
  add('Sprungkraft', `${Math.round(s.jumpPower * 100)} (Doppelsprung)`, s.jumpPower / 0.2);
  const style = { 0: 'long', 1: 'wavy', 2: 'twintails', 3: 'flowing' }[sister];
  add('Frisur', HAIR[style]);
  add('Outfits', `Standard, ${SKIN_VARIANTS[sister][1].name}, ${SKIN_VARIANTS[sister][2].name} (im Spiel per Quests freischalten)`);
}

// sister buttons
const sisBox = document.getElementById('sisters');
SISTERS.forEach((s, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'sis';
  b.textContent = `${s.icon} ${s.name}`;
  b.addEventListener('click', () => setSister(i));
  sisBox.appendChild(b);
});

// ---------- Light moods ----------
let light = 'sunset';
function setLight(key) {
  light = key;
  const L = LIGHTS[key];
  const ctx = skyCanvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, L.top);
  g.addColorStop(1, L.bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  skyTex.needsUpdate = true;
  scene.fog.color.setHex(L.fog);
  hemi.color.setHex(L.hemi[0]);
  hemi.groundColor.setHex(L.hemi[1]);
  hemi.intensity = L.hemi[2];
  sun.color.setHex(L.sun[0]);
  sun.intensity = L.sun[1];
  rim.color.setHex(L.rim);
  neonA.intensity = neonB.intensity = key === 'neon' ? 3 : 0;
  skyStars.material.opacity = key === 'night' || key === 'neon' ? 0.9 : 0;
  floor.material.color.setHex(key === 'night' ? 0x1f3a3a : key === 'neon' ? 0x1a1030 : 0x5aa86a);
  document.querySelectorAll('[data-light]').forEach(b => b.classList.toggle('active', b.dataset.light === key));
}
document.querySelectorAll('[data-light]').forEach(b => b.addEventListener('click', () => setLight(b.dataset.light)));

// ---------- Animations ----------
let anim = 'idle';
let animT = 0;
let magicClock = 0;
document.querySelectorAll('[data-anim]').forEach(b => b.addEventListener('click', () => setAnim(b.dataset.anim)));
function setAnim(a) {
  anim = a;
  animT = 0;
  magicClock = 0.3;
  document.querySelectorAll('[data-anim]').forEach(b => b.classList.toggle('active', b.dataset.anim === a));
}

function castMagic(origin, facing) {
  const p = origin.clone().setY(origin.y + 1.2);
  const c = new THREE.Color(...SISTER_COLORS[sister]);
  if (sister === 0) {
    shieldTimer = 2.2;
    shield.material.opacity = 0.75;
    fx.ringWave(origin.clone(), c, 2.6, 0.6);
    fx.spiral(origin.clone(), [c, new THREE.Color(2.2, 2.4, 2.6)], 30, 0.8, 2.2);
  } else if (sister === 1) {
    for (let k = -1; k <= 1; k++) {
      const dir = new THREE.Vector3(Math.sin(facing + k * 0.2), 0, Math.cos(facing + k * 0.2));
      for (let s = 0; s < 14; s++) fx.emit(p.clone().addScaledVector(dir, s * 0.35), dir.clone().multiplyScalar(6), c, { size: 0.35, life: 0.35 + s * 0.02 });
    }
  } else if (sister === 2) {
    fx.flash(p, c, 4.5, 0.4);
    fx.ringWave(origin.clone(), c, 4, 0.5);
    fx.burst(p, [c, new THREE.Color(2.6, 2.0, 0.6)], 60, { speed: 6, up: 2.5, size: 0.45, life: 0.8, gravity: 4 });
  } else {
    fx.ringWave(p.clone().setY(origin.y + 0.6), c, 3.2, 0.9);
    fx.ringWave(p.clone().setY(origin.y + 1.4), new THREE.Color(2.4, 1.0, 1.8), 2.6, 0.9);
    fx.burst(p, [c], 30, { speed: 2, up: 1, size: 0.35, gravity: -1 });
  }
  sfx.magicSkill(sister);
}

// ---------- Eyes and head follow the cursor; click the figure to make her wave ----------
const pointer = new THREE.Vector2();
let pointerSeen = false;
canvas.addEventListener('pointermove', (e) => {
  const r = canvas.getBoundingClientRect();
  pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  pointerSeen = true;
});
let downAt = null;
canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY }; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6 || mode !== 'inspect') return;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(pointer, camera);
  if (ray.intersectObject(rig.group, true).length) {
    setAnim('wave');
    sfx.playTone(880, 'sine', 0.12, 0.06);
  }
});

// ---------- Camera / view ----------
let wire = false;
function setWire(on) {
  wire = on;
  rig.group.traverse(o => {
    if (!o.isMesh || o === shield) return;
    (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => { if ('wireframe' in m) m.wireframe = on; });
  });
  document.getElementById('btn-wire').classList.toggle('active', on);
}
document.getElementById('btn-wire').addEventListener('click', () => setWire(!wire));
document.getElementById('btn-rotate').addEventListener('click', (e) => {
  controls.autoRotate = !controls.autoRotate;
  controls.autoRotateSpeed = 2.5;
  e.currentTarget.classList.toggle('active', controls.autoRotate);
});
// share of the screen height that is not covered by the panels (set by layoutView)
let freeFrac = 1;
function centerCamera() {
  const d = Math.min(12, Math.max(4.8, 4.9 / freeFrac));
  camera.position.set(0, 1.25 + d * 0.09, d);
  controls.target.set(0, 1.05, 0);
  controls.update();
}
document.getElementById('btn-center').addEventListener('click', centerCamera);
document.getElementById('toggle-facts').addEventListener('click', () => {
  document.body.classList.remove('hide-panels');
  document.body.classList.toggle('show-facts');
  layoutView();
});
document.getElementById('toggle-panels').addEventListener('click', (e) => {
  const hidden = document.body.classList.toggle('hide-panels');
  e.currentTarget.textContent = hidden ? '🎛️ Menü' : '🙈 Menü';
  layoutView();
  centerCamera();
});

// ---------- Modes ----------
let mode = 'inspect';
let collected = 0;
function setMode(m) {
  mode = m;
  document.getElementById('mode-inspect').classList.toggle('active', m === 'inspect');
  document.getElementById('mode-play').classList.toggle('active', m === 'play');
  document.body.classList.toggle('playing', m === 'play');
  document.getElementById('hud').style.display = m === 'play' ? 'flex' : 'none';
  document.getElementById('hint').style.display = m === 'play' ? 'none' : 'flex';
  stage.visible = m === 'inspect';
  playGroup.visible = m === 'play';
  player.pos.set(0, 0, 0);
  player.vel.set(0, 0, 0);
  player.vy = 0;
  holder.rotation.set(0, 0, 0);
  if (m === 'play') {
    collected = 0;
    document.getElementById('stars').textContent = '0';
    placeStars();
    controls.autoRotate = false;
    controls.maxDistance = 16;
    camera.position.set(0, 4.5, 9);
    controls.target.set(0, 1.2, 0);
  } else {
    controls.maxDistance = 14;
    setAnim('idle');
  }
  layoutView();
  if (m === 'inspect') centerCamera();
}
document.getElementById('mode-inspect').addEventListener('click', () => setMode('inspect'));
document.getElementById('mode-play').addEventListener('click', () => setMode('play'));

// ---------- Input (play mode) ----------
const keys = {};
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['1', '2', '3', '4'].includes(e.key)) setSister(Number(e.key) - 1);
  if (mode !== 'play') return;
  if (e.code === 'Space') { e.preventDefault(); jump(); }
  if (e.code === 'KeyE') castMagic(player.pos, player.facing);
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
function jump() {
  const s = SISTERS[sister];
  if (player.grounded) {
    player.vy = s.jumpPower;
    player.grounded = false;
    sfx.jump();
  } else if (!player.airJump) {
    player.airJump = true;
    player.vy = s.jumpPower * 1.2;
    fx.ringWave(player.pos.clone(), new THREE.Color(...SISTER_COLORS[sister]), 1.4, 0.35);
    sfx.jump();
  }
}
// touch: joystick + jump
const joy = { x: 0, y: 0, id: null, cx: 0, cy: 0 };
const tJoy = document.getElementById('t-joy');
tJoy.addEventListener('pointerdown', (e) => {
  joy.id = e.pointerId;
  const r = tJoy.getBoundingClientRect();
  joy.cx = r.left + r.width / 2;
  joy.cy = r.top + r.height / 2;
  tJoy.setPointerCapture(e.pointerId);
});
tJoy.addEventListener('pointermove', (e) => {
  if (e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.cx;
  const dy = e.clientY - joy.cy;
  const d = Math.max(1, Math.hypot(dx, dy));
  const k = Math.min(1, d / 40) / d;
  joy.x = dx * k;
  joy.y = dy * k;
});
const endJoy = () => { joy.id = null; joy.x = 0; joy.y = 0; };
tJoy.addEventListener('pointerup', endJoy);
tJoy.addEventListener('pointercancel', endJoy);
document.getElementById('t-jump').addEventListener('pointerdown', (e) => { e.preventDefault(); jump(); });

function groundAt(x, z, y) {
  let g = 0;
  platforms.forEach(p => {
    if (Math.hypot(x - p.x, z - p.z) < p.r && y >= p.top - 0.35) g = Math.max(g, p.top);
  });
  return g;
}

// ---------- Loop ----------
const COMPACT = window.matchMedia('(max-width: 860px), (max-height: 520px)');
// Center the figure in the free area between header, panels and footer (view offset shifts the picture)
function layoutView() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  let top = 0;
  let bottom = H;
  let left = 0;
  let right = W;
  if (mode === 'inspect') {
    top = document.querySelector('header').getBoundingClientRect().bottom;
    document.querySelectorAll('aside').forEach(a => {
      const r = a.getBoundingClientRect();
      if (!r.width || getComputedStyle(a).visibility === 'hidden') return;
      if (COMPACT.matches) bottom = Math.min(bottom, r.top);
      else if (r.left < W / 2) left = Math.max(left, r.right);
      else right = Math.min(right, r.left);
    });
    const hint = document.getElementById('hint').getBoundingClientRect();
    if (hint.height) bottom = Math.min(bottom, hint.top);
  }
  camera.setViewOffset(W, H, W / 2 - (left + right) / 2, H / 2 - (top + bottom) / 2, W, H);
  camera.updateProjectionMatrix();
  freeFrac = Math.max(0.3, (bottom - top) / H);
}
window.addEventListener('resize', () => { layoutView(); if (mode === 'inspect') centerCamera(); });

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;
  animT += dt;
  const flags = { moving: false, grounded: true, swimming: false, velY: 0 };

  if (mode === 'inspect') {
    holder.position.y = 0;
    if (anim === 'walk' || anim === 'dance') flags.moving = anim === 'walk';
    if (anim === 'jump') {
      const ph = (animT * 1.6) % 1;
      holder.position.y = Math.sin(ph * Math.PI) * 0.9;
      flags.grounded = ph > 0.92 || ph < 0.04;
      flags.velY = ph < 0.5 ? 0.1 : -0.1;
    }
    if (anim === 'swim') flags.swimming = true;
    rig.update(dt, flags);
    if (anim === 'wave') {
      rig.arms[1].rotation.z = rig.arms[1].userData.side * (2.5 + Math.sin(animT * 9) * 0.35);
      rig.head.rotation.z = 0.12;
      if (animT > 2.6) setAnim('idle');
    } else if (anim === 'shy') {
      rig.arms.forEach(a => { a.rotation.x = -1.1; a.rotation.z = -a.userData.side * 0.35; });
      rig.head.rotation.x = 0.28;
      holder.rotation.y = Math.sin(animT * 1.5) * 0.2;
    } else if (anim === 'magic') {
      rig.arms.forEach(a => { a.rotation.z = a.userData.side * 2.4 + Math.sin(animT * 6) * 0.1; });
      holder.position.y = 0.15 + Math.sin(animT * 3) * 0.08;
      magicClock -= dt;
      if (magicClock <= 0) { magicClock = 1.8; castMagic(new THREE.Vector3(0, 0, 0), 0); }
    } else if (anim === 'dance') {
      holder.rotation.y += dt * 2.4;
      holder.position.y = Math.abs(Math.sin(animT * 6)) * 0.18;
      rig.arms.forEach((a, i) => { a.rotation.z = a.userData.side * (1.2 + Math.sin(animT * 6 + i * Math.PI) * 1.1); });
    } else if (anim === 'swim') {
      holder.position.y = 0.3 + Math.sin(animT * 2.5) * 0.06;
    }
    if (anim !== 'dance' && anim !== 'shy') holder.rotation.y += (0 - holder.rotation.y) * Math.min(1, dt * 4);

    // eyes and head follow the cursor
    if (pointerSeen && anim !== 'shy') {
      rig.head.rotation.y += (pointer.x * 0.5 - rig.head.rotation.y) * Math.min(1, dt * 6);
      rig.head.rotation.x += (-pointer.y * 0.25 - rig.head.rotation.x) * Math.min(1, dt * 6);
      rig.eyes.forEach(e => {
        const pl = e.userData.plane;
        pl.position.x = pointer.x * 0.012;
        pl.position.y = pl.userData.baseY + pointer.y * 0.01;
      });
    } else if (anim !== 'shy') {
      rig.head.rotation.y *= 1 - Math.min(1, dt * 4);
      rig.head.rotation.x *= 1 - Math.min(1, dt * 4);
    }
  } else {
    // ---- play mode: camera-relative movement, double jump, stars ----
    const s = SISTERS[sister];
    let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joy.x;
    let mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0) + joy.y;
    const wish = new THREE.Vector3(mx, 0, mz);
    if (wish.lengthSq() > 1) wish.normalize();
    const yaw = Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z);
    wish.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const sprint = keys.ShiftLeft || keys.ShiftRight ? 1.45 : 1;
    player.vel.lerp(wish.multiplyScalar(s.speed * 60 * 0.11 * sprint), Math.min(1, dt * 10));
    const moving = player.vel.lengthSq() > 0.02;
    player.pos.addScaledVector(player.vel, dt * 6);
    const r = Math.hypot(player.pos.x, player.pos.z);
    if (r > 22) player.pos.multiplyScalar(22 / r);
    if (wish.lengthSq() > 0.001) {
      const want = Math.atan2(player.vel.x, player.vel.z);
      player.facing += Math.atan2(Math.sin(want - player.facing), Math.cos(want - player.facing)) * Math.min(1, dt * 12);
    }
    holder.rotation.y = player.facing;
    player.vy -= s.gravity * dt * 60;
    player.pos.y += player.vy * dt * 60;
    const g = groundAt(player.pos.x, player.pos.z, player.pos.y);
    if (player.pos.y <= g) {
      player.pos.y = g;
      player.vy = 0;
      player.grounded = true;
      player.airJump = false;
    } else {
      player.grounded = false;
    }
    flags.moving = moving;
    flags.grounded = player.grounded;
    flags.velY = player.vy;
    rig.update(dt, flags);
    // camera follows
    const delta = new THREE.Vector3(player.pos.x, player.pos.y + 1.2, player.pos.z).sub(controls.target);
    controls.target.add(delta);
    camera.position.add(delta);
    // stars
    pickups.forEach((p, i) => {
      if (p.got) return;
      p.mesh.rotation.y += dt * 2;
      p.mesh.position.y = p.base + Math.sin(t * 2 + i) * 0.15;
      if (p.mesh.position.distanceTo(new THREE.Vector3(player.pos.x, player.pos.y + 0.9, player.pos.z)) < 1.0) {
        p.got = true;
        p.mesh.visible = false;
        collected++;
        document.getElementById('stars').textContent = String(collected);
        fx.burst(p.mesh.position.clone(), [new THREE.Color(2.6, 2.1, 0.6)], 24, { speed: 3, up: 2, size: 0.3, gravity: 3 });
        sfx.collect();
        if (collected === pickups.length) {
          fx.burst(player.pos.clone().setY(player.pos.y + 1.5), [new THREE.Color(2.6, 2.1, 0.6), new THREE.Color(2.0, 1.4, 2.6), new THREE.Color(1.0, 2.0, 2.6)], 120, { speed: 8, up: 4, size: 0.45, life: 1.2, gravity: 3 });
          sfx.victory();
          setTimeout(() => { collected = 0; document.getElementById('stars').textContent = '0'; placeStars(); }, 2500);
        }
      }
    });
  }

  if (shieldTimer > 0) {
    shieldTimer -= dt;
    if (shieldTimer <= 0) shield.material.opacity = 0;
  }
  ring.rotation.z += dt * 0.3;
  controls.update();
  fx.update(dt, camera, renderer);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

setSister(sister);
setLight('sunset');
layoutView();
centerCamera();
frame();
// web font may change the header height after the first layout
if (document.fonts) document.fonts.ready.then(() => { layoutView(); centerCamera(); });
