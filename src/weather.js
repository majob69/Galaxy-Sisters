// ==========================================
// WEATHER: clear, rain, fog and thunderstorms that come and go.
// Rain streaks (GPU animated) around the camera, denser grey fog, dimmer sun and sky, lightning with
// delayed thunder, and a rain bed in the audio engine. In co-op the host decides the weather.
// It runs after the day/night cycle every frame and only tints what that cycle just set.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';

export const WEATHER = [
  { id: 'clear', icon: '☀️', name: 'Klar', target: { rain: 0, fog: 0, storm: 0 }, msg: '☀️ Die Wolken verziehen sich' },
  { id: 'rain', icon: '🌧️', name: 'Regen', target: { rain: 1, fog: 0.25, storm: 0 }, msg: '🌧️ Es fängt an zu regnen …' },
  { id: 'fog', icon: '🌫️', name: 'Nebel', target: { rain: 0, fog: 1, storm: 0 }, msg: '🌫️ Dichter Nebel zieht auf' },
  { id: 'storm', icon: '⛈️', name: 'Gewitter', target: { rain: 1, fog: 0.3, storm: 1 }, msg: '⛈️ Ein Gewitter zieht auf!' }
];

// Probability of the next weather, by what it follows (clear weather is the usual state)
const NEXT = {
  0: [[0, 0], [1, 0.45], [2, 0.3], [3, 0.25]],
  1: [[0, 0.5], [3, 0.3], [2, 0.2]],
  2: [[0, 0.6], [1, 0.4]],
  3: [[1, 0.5], [0, 0.5]]
};

const RAIN_COUNT = 1700;
const BOX = 26;

export class WeatherSystem {
  constructor(game) {
    this.game = game;
    this.kind = 0;
    this.level = { rain: 0, fog: 0, storm: 0 };
    this.timer = 150 + Math.random() * 90; // first weather change
    this.lightning = 0;
    this.nextLightning = 6;
    this.thunderQueue = [];
    this.buildRain();
    this.tmpColor = new THREE.Color();
    this.gray = new THREE.Color();
  }

  get rain() { return this.level.rain; }
  get storm() { return this.level.storm; }
  get fog() { return this.level.fog; }
  get info() { return WEATHER[this.kind]; }

  buildRain() {
    const pos = new Float32Array(RAIN_COUNT * 2 * 3);
    const end = new Float32Array(RAIN_COUNT * 2);
    const seed = new Float32Array(RAIN_COUNT * 2);
    for (let i = 0; i < RAIN_COUNT; i++) {
      const x = (Math.random() * 2 - 1) * BOX;
      const y = Math.random() * BOX;
      const z = (Math.random() * 2 - 1) * BOX;
      const s = Math.random();
      for (let v = 0; v < 2; v++) {
        pos.set([x, y, z], (i * 2 + v) * 3);
        end[i * 2 + v] = v;
        seed[i * 2 + v] = s;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      uniforms: {
        uTime: { value: 0 },
        uCenter: { value: new THREE.Vector3() },
        uOpacity: { value: 0 },
        uColor: { value: new THREE.Color(0.75, 0.82, 0.95) }
      },
      vertexShader: `
        uniform float uTime; uniform vec3 uCenter;
        attribute float aEnd; attribute float aSeed;
        varying float vAlpha;
        const float R = ${BOX.toFixed(1)};
        void main() {
          float y = mod(position.y - uTime * (20.0 + aSeed * 9.0), R);
          vec3 rel = vec3(mod(position.x - uCenter.x + R, 2.0 * R) - R, y, mod(position.z - uCenter.z + R, 2.0 * R) - R);
          vec3 world = vec3(uCenter.x + rel.x, uCenter.y - 8.0 + rel.y, uCenter.z + rel.z);
          world.x += aEnd * 0.18;
          world.y += aEnd * (0.7 + aSeed * 0.5);
          vAlpha = mix(0.14, 0.9, aEnd) * (1.0 - smoothstep(R * 0.6, R, length(rel.xz)));
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 uColor; uniform float uOpacity; varying float vAlpha;
        void main() { gl_FragColor = vec4(uColor, vAlpha * uOpacity); }`
    });
    this.rainLines = new THREE.LineSegments(geo, this.rainMat);
    this.rainLines.frustumCulled = false;
    this.rainLines.visible = false;
    this.game.scene.add(this.rainLines);
  }

  // Set the weather (host: announce = true tells the friends)
  setKind(idx, announce = true, silent = false) {
    if (idx < 0 || idx >= WEATHER.length || idx === this.kind) return;
    this.kind = idx;
    this.timer = 110 + Math.random() * 110;
    if (!silent) this.game.showToast(WEATHER[idx].msg, 4000);
    if (announce) this.game.coop.send({ t: 'weather', k: idx });
    this.updateBadge();
  }

  pickNext() {
    const options = NEXT[this.kind];
    let r = Math.random();
    let next = options[0][0];
    for (const [k, p] of options) { r -= p; if (r <= 0) { next = k; break; } }
    this.setKind(next, true);
  }

  updateBadge() {
    const el = document.getElementById('weather-badge');
    if (el) el.textContent = `${this.info.icon} ${this.info.name}`;
  }

  // Called right after the day/night cycle has set lights, fog and sky
  update(delta) {
    const g = this.game;
    const target = WEATHER[this.kind].target;
    const step = delta * 0.22;
    ['rain', 'fog', 'storm'].forEach(k => {
      const diff = target[k] - this.level[k];
      this.level[k] += Math.sign(diff) * Math.min(Math.abs(diff), step);
    });
    const { rain, fog, storm } = this.level;

    // Host picks the next weather
    if (g.coop.isHost) {
      this.timer -= delta;
      if (this.timer <= 0) this.pickNext();
    }

    const overcast = Math.max(rain * 0.7, fog * 0.55, storm);

    // Lights
    g.sunLight.intensity *= 1 - 0.65 * overcast;
    g.hemiLight.intensity *= 1 - 0.3 * overcast;

    // Fog: denser and greyer
    g.scene.fog.density *= 1 + fog * 3.2 + rain * 0.9 + storm * 1.2;
    const fc = g.scene.fog.color;
    const lum = (fc.r + fc.g + fc.b) / 3;
    this.gray.setRGB(0.66 * lum + 0.05, 0.7 * lum + 0.06, 0.78 * lum + 0.09);
    fc.lerp(this.gray, Math.min(1, overcast * 0.75));

    // Sky and clouds fade to grey
    const sky = g.skyDome.material.uniforms;
    this.tmpColor.copy(this.gray);
    sky.uZenith.value.lerp(this.tmpColor.multiplyScalar(0.85), overcast * 0.6);
    sky.uHorizon.value.lerp(this.gray, overcast * 0.7);
    sky.uBlush.value.lerp(this.gray, overcast * 0.8);
    g.scene.background.copy(sky.uHorizon.value);
    if (g.cloudSea) {
      const cu = g.cloudSea.material.uniforms;
      cu.uShade.value.lerp(this.gray.clone().multiplyScalar(0.7), overcast * 0.7);
      cu.uLight.value.lerp(this.gray, overcast * 0.6);
    }
    if (g.skyStarMat) g.skyStarMat.color.multiplyScalar(1 - Math.min(1, overcast * 1.1));
    if (g.moonMesh) g.moonMesh.material.color.multiplyScalar(1 - overcast * 0.6);

    // Lightning: flash the sky and lights, thunder follows
    if (storm > 0.6) {
      this.nextLightning -= delta;
      if (this.nextLightning <= 0) this.strike();
    }
    if (this.lightning > 0) {
      this.lightning = Math.max(0, this.lightning - delta * 3.2);
      const f = this.lightning * this.lightning;
      g.hemiLight.intensity += f * 2.6;
      sky.uHorizon.value.lerp(this.tmpColor.setRGB(1, 1, 1), f * 0.6);
      g.scene.background.copy(sky.uHorizon.value);
    }
    for (let i = this.thunderQueue.length - 1; i >= 0; i--) {
      this.thunderQueue[i] -= delta;
      if (this.thunderQueue[i] <= 0) {
        this.thunderQueue.splice(i, 1);
        sfx.thunder();
      }
    }

    // Rain streaks around the camera
    const show = rain > 0.02;
    this.rainLines.visible = show;
    if (show) {
      this.rainMat.uniforms.uTime.value = g.clock.elapsedTime;
      this.rainMat.uniforms.uCenter.value.copy(g.camera.position);
      this.rainMat.uniforms.uOpacity.value = Math.min(1, rain) * (0.8 + storm * 0.2);
    }
  }

  strike() {
    this.lightning = 1;
    this.nextLightning = 5 + Math.random() * 9;
    // sometimes a second flicker right after
    if (Math.random() < 0.5) setTimeout(() => { this.lightning = Math.max(this.lightning, 0.8); }, 170);
    this.thunderQueue.push(0.4 + Math.random() * 1.6);
  }
}
