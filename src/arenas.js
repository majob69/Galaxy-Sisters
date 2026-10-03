// ==========================================
// ARENA LOCK: walk into a boss arena while the boss lives and a glowing wall seals it -
// you can only leave once the boss is beaten (or if you are knocked out and wake up at the start).
// The bosses are kept inside their arena as well (see clampToArena).
// Every arena gets the same magic: a turning rune ring on the ground, an aurora wall with
// rising light streaks and glowing glyphs that circle above it while the boss is awake.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { FOREST_ARENA, inForestArea } from './forest.js';

export const VORTOX_ARENA = { x: 32, z: 30, r: 19 };
const GLYPHS = ['✦', '☾', '✧', '☀', '❄', '✶', '◈', '❋'];

function runeRingTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(255, 255, 255, 0.0)';
  ctx.fillRect(0, 0, 1024, 64);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(1024, 6); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 58); ctx.lineTo(1024, 58); ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = '38px "Segoe UI Symbol", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < 24; i++) ctx.fillText(GLYPHS[i % GLYPHS.length], i * (1024 / 24) + 21, 33);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function glyphTexture(ch) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = '#ffffff';
  ctx.font = '40px "Segoe UI Symbol", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ch, 32, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Ring strip in the ground plane whose UVs run around the circle (u) and across the band (v)
function ringStrip(r0, r1, segments = 96) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    pos.push(ca * r0, 0, sa * r0, ca * r1, 0, sa * r1);
    uv.push(i / segments * 3, 0, i / segments * 3, 1);
    if (i < segments) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return geo;
}

function wallMaterial(color) {
  const m = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: new THREE.Color(color).multiplyScalar(1.4) }, uTime: { value: 0 }, uOpacity: { value: 0 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform vec3 uColor; uniform float uTime; uniform float uOpacity; varying vec2 vUv;
      float hash(float n) { return fract(sin(n) * 43758.5453); }
      void main() {
        float u = vUv.x * 80.0;
        float lane = floor(u);
        float speed = 0.25 + hash(lane) * 0.5;
        float streak = fract(vUv.y * 0.8 - uTime * speed + hash(lane + 7.0));
        float beam = smoothstep(0.0, 0.15, streak) * (1.0 - smoothstep(0.15, 0.55, streak));
        float edge = smoothstep(0.5, 0.0, abs(fract(u) - 0.5) - 0.2);
        float fade = (1.0 - vUv.y) * (0.35 + 0.65 * smoothstep(0.0, 0.1, vUv.y));
        float wave = 0.55 + 0.45 * sin(vUv.x * 40.0 + uTime * 1.5);
        float a = (0.35 * wave + beam * edge * 1.4) * fade * uOpacity;
        gl_FragColor = vec4(uColor * (0.8 + beam), a);
      }`
  });
  m.userData.noNightGlow = true;
  return m;
}

export class ArenaLock {
  constructor(game) {
    this.game = game;
    this.locked = null;
    const g = game;
    this.arenas = [
      { name: 'Vortox', x: VORTOX_ARENA.x, z: VORTOX_ARENA.z, r: VORTOX_ARENA.r, color: 0x7fe0ff, active: () => g.bossData.alive },
      { name: 'Morvanta', x: FOREST_ARENA.x, z: FOREST_ARENA.z, r: FOREST_ARENA.r, color: 0xff7ee3, forest: true, active: () => g.morvanta.d.alive && g.morvanta.d.awake },
      { name: 'Glaciel', x: g.glaciel.center.x, z: g.glaciel.center.z, r: 14, color: 0x9fe8ff, active: () => g.glaciel.d.alive && g.glaciel.d.awake }
    ];
    const ringTex = runeRingTexture();
    this.arenas.forEach(a => {
      const y = g.getTerrainHeight(a.x, a.z);
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(a.r, a.r, 8, 96, 1, true), wallMaterial(a.color));
      wall.position.set(a.x, y + 3.7, a.z);
      wall.visible = false;
      g.scene.add(wall);
      a.wall = wall;
      // turning rune ring on the ground along the wall
      const ringMat = new THREE.MeshBasicMaterial({ map: ringTex, color: new THREE.Color(a.color).multiplyScalar(1.5), transparent: true, opacity: 0.4, depthWrite: false, side: THREE.DoubleSide });
      ringMat.userData.noNightGlow = true;
      const ring = new THREE.Mesh(ringStrip(a.r - 1.8, a.r + 0.2), ringMat);
      ring.position.set(a.x, y + 0.1, a.z);
      g.scene.add(ring);
      a.ring = ring;
      // glyphs circling above the wall
      a.glyphs = GLYPHS.map((ch, i) => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTexture(ch), color: new THREE.Color(a.color).multiplyScalar(1.6), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        s.material.userData.noNightGlow = true;
        s.scale.setScalar(1.6);
        s.userData.a = (i / GLYPHS.length) * Math.PI * 2;
        s.visible = false;
        g.scene.add(s);
        return s;
      });
      a.y = y;
    });
  }

  // Keep a boss (or anything) inside an arena
  static clamp(pos, cx, cz, r) {
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d = Math.hypot(dx, dz);
    if (d > r) {
      pos.x = cx + (dx / d) * r;
      pos.z = cz + (dz / d) * r;
    }
  }

  update(delta) {
    const g = this.game;
    const pp = g.playerGroup.position;
    const t = g.clock.elapsedTime;
    const inForest = inForestArea(g.camera.position.x);
    this.arenas.forEach(a => {
      const active = a.active();
      const d = Math.hypot(pp.x - a.x, pp.z - a.z);
      const sameWorld = !!a.forest === inForest;
      const near = active && d < a.r + 18;
      const isLocked = this.locked === a;
      a.wall.visible = sameWorld && (near || isLocked);
      if (a.wall.visible) {
        const u = a.wall.material.uniforms;
        u.uTime.value = t;
        u.uOpacity.value = (isLocked ? 1 : 0.45) + Math.sin(t * 3) * 0.08;
      }
      // the rune ring always marks the arena; it shines brighter while the boss is awake
      a.ring.visible = sameWorld && d < a.r + 70;
      if (a.ring.visible) {
        a.ring.rotation.y += delta * (active ? 0.25 : 0.06);
        a.ring.material.opacity = active ? 0.75 + Math.sin(t * 4) * 0.15 : 0.3;
      }
      const glyphsOn = sameWorld && active && d < a.r + 40;
      a.glyphs.forEach((s, i) => {
        s.visible = glyphsOn;
        if (!glyphsOn) return;
        const ang = s.userData.a + t * 0.35;
        s.position.set(a.x + Math.cos(ang) * a.r, a.y + 6.5 + Math.sin(t * 2 + i) * 0.6, a.z + Math.sin(ang) * a.r);
      });

      if (!this.locked && active && d < a.r - 0.6 && !g.isDowned) {
        this.locked = a;
        sfx.bossSpin();
        g.showToast(`🔒 Die Arena ist versiegelt! Besiege ${a.name}, um sie wieder zu verlassen.`, 5000);
      }
    });

    const a = this.locked;
    if (!a) return;
    const d = Math.hypot(pp.x - a.x, pp.z - a.z);
    if (!a.active()) {
      this.locked = null;
      g.showToast(`🔓 ${a.name} ist besiegt – die Arena ist wieder offen!`, 4000);
      return;
    }
    // Teleported away (knocked out and woke up at the start): the seal lets go
    if (d > a.r + 4) {
      this.locked = null;
      return;
    }
    if (d > a.r - 0.8) {
      ArenaLock.clamp(pp, a.x, a.z, a.r - 0.8);
      if (g.moveVel) {
        const nx = (pp.x - a.x) / d;
        const nz = (pp.z - a.z) / d;
        const out = g.moveVel.x * nx + g.moveVel.z * nz;
        if (out > 0) { g.moveVel.x -= nx * out; g.moveVel.z -= nz * out; }
      }
    }
  }
}
