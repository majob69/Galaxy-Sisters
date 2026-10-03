// ==========================================
// SNOW BIOME: igloos, snowmen, snowy firs, frozen crystals and gently falling snow
// around Vortox' arena. The ground itself turns white in buildTerrain (see biome.js).
// ==========================================
import * as THREE from 'three';
import { SNOW_BIOME, snowAt } from './biome.js';
import { bakeStaticGroup } from './bake.js';

const FLAKES = 1400;
const BOX = 24;

function iglooTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f4f9ff';
  ctx.fillRect(0, 0, 256, 128);
  ctx.strokeStyle = '#b9d3ee';
  ctx.lineWidth = 3;
  for (let row = 0; row < 6; row++) {
    const y = row * 21 + 10;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
    for (let col = 0; col < 8; col++) {
      const x = col * 32 + (row % 2) * 16;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + 21);
      ctx.stroke();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

export class SnowBiome {
  constructor(game) {
    this.game = game;
    this.group = new THREE.Group();
    this.buildIgloos();
    this.buildSnowmen();
    this.buildFirs();
    this.buildSnowfall();
    // igloos, snowmen and firs never move: a handful of draw calls instead of ~150
    game.scene.add(bakeStaticGroup(this.group));
  }

  // Dry, snowy ground away from the arena ring
  okSpot(x, z, clear = 2.5) {
    const g = this.game;
    const arena = Math.hypot(x - 32, z - 30);
    return snowAt(x, z) > 0.6 && arena > 20 + clear && !g.isNearWater(x, z, 2.5) && g.getWaterSurface(x, z) === null &&
      !g.checkWallCollision(x, z, clear, g.getTerrainHeight(x, z));
  }

  ring(n, r0, r1, rng, clear) {
    const out = [];
    for (let i = 0; i < n * 30 && out.length < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = r0 + rng() * (r1 - r0);
      const x = SNOW_BIOME.x + Math.cos(a) * r;
      const z = SNOW_BIOME.z + Math.sin(a) * r;
      if (!this.okSpot(x, z, clear)) continue;
      if (out.some(o => Math.hypot(o.x - x, o.z - z) < clear * 3)) continue;
      out.push({ x, z, a });
    }
    return out;
  }

  rng() {
    // tiny deterministic generator so every player sees the same igloos
    let s = this._seed = (this._seed || 9137) * 16807 % 2147483647;
    return s / 2147483647;
  }

  buildIgloos() {
    const g = this.game;
    const mat = new THREE.MeshLambertMaterial({ map: iglooTexture(), flatShading: false });
    const dark = new THREE.MeshBasicMaterial({ color: 0x1b2a44 });
    this.igloos = this.ring(4, 20, 27, () => this.rng(), 3.4);
    this.igloos.forEach(spot => {
      const y = g.getTerrainHeight(spot.x, spot.z);
      const igloo = new THREE.Group();
      igloo.position.set(spot.x, y - 0.1, spot.z);
      // entrance faces the arena
      igloo.rotation.y = Math.atan2(32 - spot.x, 30 - spot.z);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
      dome.castShadow = true;
      dome.receiveShadow = true;
      igloo.add(dome);
      const tunnel = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.6, 14, 1, false, 0, Math.PI), mat);
      tunnel.rotation.set(Math.PI / 2, 0, Math.PI / 2);
      tunnel.position.set(0, 0, 2.3);
      igloo.add(tunnel);
      const door = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16, 0, Math.PI), dark);
      door.position.set(0, 0.02, 3.11);
      igloo.add(door);
      this.group.add(igloo);
      g.colliders.push({ type: 'cylinder', x: spot.x, z: spot.z, radius: 2.4, minY: y - 1, maxY: y + 2.4 });
    });
  }

  buildSnowmen() {
    const g = this.game;
    const snow = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const coal = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const carrot = new THREE.MeshLambertMaterial({ color: 0xff8c1a });
    const scarf = new THREE.MeshLambertMaterial({ color: 0xff5f8f });
    this.ring(3, 10, 26, () => this.rng(), 1.5).forEach(spot => {
      const y = g.getTerrainHeight(spot.x, spot.z);
      const man = new THREE.Group();
      man.position.set(spot.x, y, spot.z);
      man.rotation.y = this.rng() * Math.PI * 2;
      [[0.75, 0.7], [0.55, 1.8], [0.4, 2.6]].forEach(([r, h]) => {
        const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), snow);
        ball.position.y = h;
        ball.castShadow = true;
        man.add(ball);
      });
      [-0.14, 0.14].forEach(x => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), coal);
        eye.position.set(x, 2.72, 0.35);
        man.add(eye);
      });
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 8), carrot);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, 2.6, 0.55);
      man.add(nose);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 6, 16), scarf);
      band.rotation.x = Math.PI / 2;
      band.position.y = 2.25;
      man.add(band);
      this.group.add(man);
      g.colliders.push({ type: 'cylinder', x: spot.x, z: spot.z, radius: 0.7, minY: y - 1, maxY: y + 3 });
    });
  }

  buildFirs() {
    const g = this.game;
    const bark = new THREE.MeshLambertMaterial({ color: 0x5a3a24 });
    const green = new THREE.MeshLambertMaterial({ color: 0x2f5f44, flatShading: true });
    const snowCap = new THREE.MeshLambertMaterial({ color: 0xf2f8ff, flatShading: true });
    this.ring(16, 12, 30, () => this.rng(), 2.2).forEach(spot => {
      const y = g.getTerrainHeight(spot.x, spot.z);
      const fir = new THREE.Group();
      fir.position.set(spot.x, y, spot.z);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 7), bark);
      trunk.position.y = 0.9;
      fir.add(trunk);
      for (let t = 0; t < 3; t++) {
        const r = 2.1 - t * 0.55;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(r, 2.2, 8), green);
        cone.position.y = 2.1 + t * 1.25;
        cone.castShadow = true;
        fir.add(cone);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r * 0.72, 0.9, 8), snowCap);
        cap.position.y = cone.position.y + 0.75;
        fir.add(cap);
      }
      this.group.add(fir);
      g.colliders.push({ type: 'cylinder', x: spot.x, z: spot.z, radius: 0.4, minY: y - 1, maxY: y + 2 });
    });
  }

  buildSnowfall() {
    const pos = new Float32Array(FLAKES * 3);
    const seed = new Float32Array(FLAKES);
    for (let i = 0; i < FLAKES; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * BOX;
      pos[i * 3 + 1] = Math.random() * BOX;
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * BOX;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.snowMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uOpacity: { value: 0 } },
      vertexShader: `
        uniform float uTime; uniform vec3 uCenter; attribute float aSeed; varying float vA;
        const float R = ${BOX.toFixed(1)};
        void main() {
          float y = mod(position.y - uTime * (1.2 + aSeed * 0.9), R);
          float sway = sin(uTime * (0.6 + aSeed) + aSeed * 40.0) * 0.6;
          vec3 rel = vec3(mod(position.x + sway - uCenter.x + R, 2.0 * R) - R, y, mod(position.z - uCenter.z + R, 2.0 * R) - R);
          vec3 world = vec3(uCenter.x + rel.x, uCenter.y - 6.0 + rel.y, uCenter.z + rel.z);
          vec4 mv = viewMatrix * vec4(world, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + aSeed * 3.0) * (60.0 / -mv.z);
          vA = 1.0 - smoothstep(R * 0.6, R, length(rel.xz));
        }`,
      fragmentShader: `
        uniform float uOpacity; varying float vA;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = length(c);
          if (d > 0.5) discard;
          gl_FragColor = vec4(1.0, 1.0, 1.0, (1.0 - d * 2.0) * vA * uOpacity);
        }`
    });
    this.flakes = new THREE.Points(geo, this.snowMat);
    this.flakes.frustumCulled = false;
    this.flakes.visible = false;
    this.game.scene.add(this.flakes);
  }

  update() {
    const g = this.game;
    const cam = g.camera.position;
    // snow falls while the camera is over the biome, fading in at its border
    const amount = snowAt(cam.x, cam.z);
    this.flakes.visible = amount > 0.02;
    if (this.flakes.visible) {
      this.snowMat.uniforms.uTime.value = g.clock.elapsedTime;
      this.snowMat.uniforms.uCenter.value.copy(cam);
      this.snowMat.uniforms.uOpacity.value = amount * 0.9;
    }
  }
}
