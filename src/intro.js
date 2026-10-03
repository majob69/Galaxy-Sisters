// ==========================================
// INTRO PORTRAIT: the start screen shows the four sisters exactly as they look in the game -
// the same ChibiRig models, rendered live in a small scene under a starry sky.
// Falls back to the painted picture if WebGL is not available.
// ==========================================
import * as THREE from 'three';
import { ChibiRig } from './characters.js';
import { playerMethods } from './game/player.js';

const NAMES = [['Luna', '🌙', '#c6b6ff'], ['Stella', '⭐', '#ffd35c'], ['Sol', '☀️', '#ff9a1f'], ['Planeta', '🪐', '#c77dff']];

function skyTexture() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#1b1150');
  g.addColorStop(0.55, '#5b2a9e');
  g.addColorStop(0.85, '#e07fbf');
  g.addColorStop(1, '#ffc6dd');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function startIntroPortrait() {
  const wrap = document.querySelector('.intro-artwork-wrapper');
  if (!wrap) return null;
  const img = wrap.querySelector('.intro-artwork');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  } catch (e) {
    return null; // keep the painted picture
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  const canvas = renderer.domElement;
  canvas.className = 'intro-canvas';
  wrap.insertBefore(canvas, wrap.firstChild);
  if (img) img.style.display = 'none';

  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0xe5a6d6, 10, 22);
  const camera = new THREE.PerspectiveCamera(30, 2, 0.1, 100);
  camera.position.set(0, 1.4, 7.1);
  camera.lookAt(0, 1.12, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x7289da, 0.95));
  const sun = new THREE.DirectionalLight(0xfff2e0, 1.35);
  sun.position.set(3, 6, 6);
  scene.add(sun);

  // Stars
  const starPos = [];
  for (let i = 0; i < 260; i++) starPos.push((Math.random() - 0.5) * 30, 1.5 + Math.random() * 9, -6 - Math.random() * 6);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6c8, size: 0.06, transparent: true, opacity: 0.9, fog: false }));
  scene.add(stars);

  // Meadow with little flowers
  const ground = new THREE.Mesh(new THREE.CircleGeometry(9, 40), new THREE.MeshLambertMaterial({ color: 0x7cc96a }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  const flowerCols = [0xff8fb1, 0xffe066, 0xbfd4ff, 0xc77dff, 0xffffff];
  for (let i = 0; i < 70; i++) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), new THREE.MeshBasicMaterial({ color: flowerCols[i % flowerCols.length] }));
    const a = Math.random() * Math.PI * 2;
    const r = 1.2 + Math.random() * 6;
    f.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r - 1);
    scene.add(f);
  }

  // The four sisters
  const rigs = NAMES.map((_, i) => {
    const rig = new ChibiRig();
    playerMethods.applySisterLook(rig, i, 0);
    rig.group.position.set(-2.55 + i * 1.7, 0, i % 2 ? -0.25 : 0);
    rig.group.rotation.y = (1.5 - i) * 0.16;
    scene.add(rig.group);
    return rig;
  });

  // Floating emblems: moon, star, sun, planet
  const orbs = [0x9fb8ff, 0xffe066, 0xff9f43, 0xc77dff].map((c, i) => {
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshBasicMaterial({ color: c }));
    orb.position.set(-2.55 + i * 1.7 + 0.55, 2.35, 0.2);
    scene.add(orb);
    return orb;
  });

  // Names under the girls
  const names = document.createElement('div');
  names.className = 'intro-names';
  NAMES.forEach(([n, icon, color], i) => {
    const s = document.createElement('span');
    s.textContent = `${icon} ${n}`;
    s.style.color = color;
    s.title = `${n} in 3D ansehen`;
    s.addEventListener('click', () => openShowcase(i));
    names.appendChild(s);
  });
  wrap.appendChild(names);
  const hint = document.createElement('div');
  hint.className = 'intro-figure-hint';
  hint.textContent = '👆 Tippe auf eine Schwester – sie in 3D ansehen';
  wrap.appendChild(hint);

  // Clicking a sister opens her 3D showcase page (figuren.html)
  const openShowcase = (i) => { location.href = `figuren.html?s=${i}`; };
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickSister = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    let best = -1;
    let bestDist = Infinity;
    rigs.forEach((rig, i) => {
      const hit = ray.intersectObject(rig.group, true)[0];
      if (hit && hit.distance < bestDist) { best = i; bestDist = hit.distance; }
    });
    return best;
  };
  canvas.addEventListener('click', (e) => {
    const i = pickSister(e);
    if (i >= 0) openShowcase(i);
  });
  canvas.addEventListener('pointermove', (e) => {
    canvas.style.cursor = e.pointerType === 'mouse' && pickSister(e) >= 0 ? 'pointer' : '';
  });

  const resize = () => {
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(1, wrap.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep all four girls in view on narrow (portrait) screens
    camera.position.z = camera.aspect < 1.6 ? 7.1 * (1.6 / camera.aspect) * 0.85 : 7.1;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const clock = new THREE.Clock();
  let raf = 0;
  const frame = () => {
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    rigs.forEach((rig, i) => {
      rig.update(dt, { moving: false, grounded: true, swimming: false, velY: 0 });
      rig.group.position.y = Math.max(0, Math.sin(t * 2.2 + i * 1.3)) * 0.06;
    });
    // Stella waves, Planeta twirls slowly
    rigs[1].arms[1].rotation.z = -2.4 + Math.sin(t * 7) * 0.35;
    rigs[3].group.rotation.y = -0.24 + Math.sin(t * 0.8) * 0.25;
    orbs.forEach((o, i) => { o.position.y = 2.35 + Math.sin(t * 1.8 + i) * 0.12; });
    stars.material.opacity = 0.7 + Math.sin(t * 2) * 0.2;
    renderer.render(scene, camera);
  };
  frame(); // first picture right away (also in a background tab)
  const loop = () => { frame(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    }
  };
}
