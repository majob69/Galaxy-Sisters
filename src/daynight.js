// ==========================================
// DAY / NIGHT CYCLE: sun & moon arcs, sky / fog / water palettes,
// glowing lanterns & crystals at night, fireflies and phase skipping
// ==========================================
import * as THREE from 'three';
import { smoothstep } from './landscape.js';
import { createSoftSpriteTexture } from './water.js';

const PALETTES = {
  day: {
    zenith: 0x6fb2ff, horizon: 0xf3e6ff, blush: 0xffd6ec, fog: 0xeee4fb, fogDensity: 0.0048,
    light: 0xfffaed, lightI: 1.35, hemiSky: 0xffffff, hemiGround: 0x7289da, hemiI: 0.85,
    cloudShade: 0xb3abe4, cloudLight: 0xffffff, cloudBlush: 0xffe0f0,
    waterSky: 0xdcecff, shallow: 0x46d8e0, deep: 0x1f56c9, fall: 0x4fb8f0, mist: 0xffffff
  },
  dusk: {
    zenith: 0x5566cf, horizon: 0xffb892, blush: 0xff7fae, fog: 0xf1bfc8, fogDensity: 0.0052,
    light: 0xffa36b, lightI: 1.0, hemiSky: 0xffc3d8, hemiGround: 0x6a5acd, hemiI: 0.62,
    cloudShade: 0xc48bb5, cloudLight: 0xffd3b8, cloudBlush: 0xff9ec4,
    waterSky: 0xffc2b5, shallow: 0x4fc3d9, deep: 0x2b3fa8, fall: 0x6fb0e0, mist: 0xffe0ea
  },
  night: {
    zenith: 0x080c2e, horizon: 0x252868, blush: 0x4a2f7e, fog: 0x1c1f52, fogDensity: 0.0058,
    light: 0xa9bcff, lightI: 0.5, hemiSky: 0x5f6fd0, hemiGround: 0x1c1a4a, hemiI: 0.55,
    cloudShade: 0x23265e, cloudLight: 0x4b4f9c, cloudBlush: 0x5b3f8f,
    waterSky: 0x3c4aa0, shallow: 0x2a9fc4, deep: 0x0d2470, fall: 0x3f7fcf, mist: 0x8a9ae0
  }
};

// Phase starts on the 0..1 clock (0 = sunrise, 0.25 = noon, 0.5 = sunset, 0.75 = midnight)
const PHASES = [
  { name: 'Morgen', icon: '🌅', start: 0.97 },
  { name: 'Tag', icon: '☀️', start: 0.06 },
  { name: 'Abend', icon: '🌇', start: 0.44 },
  { name: 'Nacht', icon: '🌙', start: 0.56 }
];

const toColors = (p) => {
  const out = {};
  Object.keys(p).forEach(k => {
    out[k] = typeof p[k] === 'number' && !k.endsWith('I') && k !== 'fogDensity' ? new THREE.Color(p[k]) : p[k];
  });
  return out;
};

export class DayNightCycle {
  constructor(game, { dayLength = 480, start = 0.1, onNightfall, onSunrise } = {}) {
    this.game = game;
    this.dayLength = dayLength;
    this.p = start;
    this.skipTarget = null;
    this.onNightfall = onNightfall;
    this.onSunrise = onSunrise;
    this.palettes = { day: toColors(PALETTES.day), dusk: toColors(PALETTES.dusk), night: toColors(PALETTES.night) };
    this.night = 0;
    this.wasNight = false;
    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.tmp = {};
    Object.keys(PALETTES.day).forEach(k => {
      if (this.palettes.day[k] instanceof THREE.Color) this.tmp[k] = new THREE.Color();
    });

    this.collectGlowSources();
    this.createFireflies();
    this.update(0);
    this.wasNight = this.night > 0.5;
  }

  // Emissive materials and point lights get brighter after dark
  collectGlowSources() {
    this.glowMats = new Map();
    this.pointLights = [];
    this.game.scene.traverse(obj => {
      if (obj.isPointLight) this.pointLights.push({ light: obj, base: obj.intensity });
      if (!obj.isMesh) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => {
        if (m.userData.noNightGlow) return;
        if (m.emissive && m.emissiveIntensity > 0 && m.emissive.getHex() !== 0 && !this.glowMats.has(m)) {
          this.glowMats.set(m, m.emissiveIntensity);
        }
      });
    });
  }

  createFireflies() {
    const count = 140;
    this.fireflyBase = [];
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const r = 4 + Math.random() * 40;
      const x = Math.cos(ang) * r;
      const z = Math.sin(ang) * r;
      const y = this.game.getTerrainHeight(x, z) + 0.6 + Math.random() * 2.2;
      this.fireflyBase.push({ x, y, z, ph: Math.random() * 100, sp: 0.4 + Math.random() * 0.6 });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.fireflyMat = new THREE.PointsMaterial({
      map: createSoftSpriteTexture(),
      color: new THREE.Color(0.9, 1.8, 0.3),
      size: 0.5,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.fireflies = new THREE.Points(geo, this.fireflyMat);
    this.fireflies.frustumCulled = false;
    this.fireflies.visible = false;
    this.game.scene.add(this.fireflies);
  }

  get phase() {
    let current = PHASES[0];
    let best = -Infinity;
    PHASES.forEach(ph => {
      // Latest phase start that is not after p (with wrap-around)
      const since = (this.p - ph.start + 1) % 1;
      if (-since > best) {
        best = -since;
        current = ph;
      }
    });
    return current;
  }

  get nextPhase() {
    const idx = PHASES.indexOf(this.phase);
    return PHASES[(idx + 1) % PHASES.length];
  }

  skipToNextPhase() {
    this.skipTarget = this.nextPhase.start + 0.005;
  }

  mix(key, w) {
    const out = this.tmp[key];
    const { day, dusk, night } = this.palettes;
    out.setRGB(
      day[key].r * w.day + dusk[key].r * w.dusk + night[key].r * w.night,
      day[key].g * w.day + dusk[key].g * w.dusk + night[key].g * w.night,
      day[key].b * w.day + dusk[key].b * w.dusk + night[key].b * w.night
    );
    return out;
  }

  mixScalar(key, w) {
    const { day, dusk, night } = this.palettes;
    return day[key] * w.day + dusk[key] * w.dusk + night[key] * w.night;
  }

  update(delta) {
    const g = this.game;

    // Advance the clock (nights pass a bit faster), or fast-forward to the chosen phase
    if (this.skipTarget !== null) {
      const remaining = (this.skipTarget - this.p + 1) % 1;
      const stepP = Math.min(remaining, delta * 0.16);
      this.p = (this.p + stepP) % 1;
      if (remaining - stepP < 1e-4) this.skipTarget = null;
    } else {
      const speed = Math.sin(this.p * Math.PI * 2) < 0 ? 1.5 : 1;
      this.p = (this.p + (delta / this.dayLength) * speed) % 1;
    }

    const a = this.p * Math.PI * 2;
    const elev = Math.sin(a);
    this.sunDir.set(Math.cos(a) * 0.85, elev, 0.45).normalize();
    this.moonDir.set(-Math.cos(a) * 0.85, -elev, 0.3).normalize();

    const wDay = smoothstep(0.0, 0.4, elev);
    const wNight = smoothstep(0.0, -0.3, elev);
    const w = { day: wDay, night: wNight, dusk: Math.max(0, 1 - wDay - wNight) };
    this.night = wNight;

    // Sun by day, moon by night; the swap happens while both are dimmed at the horizon
    const sunAbove = elev > -0.03;
    const fade = sunAbove ? smoothstep(-0.03, 0.12, elev) : smoothstep(-0.03, -0.18, elev);
    const lightDir = sunAbove ? this.sunDir : this.moonDir;
    g.sunLight.position.copy(lightDir).multiplyScalar(90);
    g.sunLight.color.copy(this.mix('light', w));
    g.sunLight.intensity = this.mixScalar('lightI', w) * fade;

    g.hemiLight.color.copy(this.mix('hemiSky', w));
    g.hemiLight.groundColor.copy(this.mix('hemiGround', w));
    g.hemiLight.intensity = this.mixScalar('hemiI', w);

    // Sky, fog & background
    const sky = g.skyDome.material.uniforms;
    sky.uZenith.value.copy(this.mix('zenith', w));
    sky.uHorizon.value.copy(this.mix('horizon', w));
    sky.uBlush.value.copy(this.mix('blush', w));
    sky.uSunColor.value.copy(this.mix('light', w));
    sky.uSunDir.value.copy(this.sunDir);
    sky.uNight.value = wNight;
    sky.uTime.value = g.clock.elapsedTime;
    g.scene.fog.color.copy(this.mix('fog', w));
    g.scene.fog.density = this.mixScalar('fogDensity', w);
    g.scene.background.copy(sky.uHorizon.value);

    // Moon rides opposite the sun and glows brighter at night
    if (g.moonMesh) {
      g.moonMesh.position.copy(this.moonDir).multiplyScalar(420);
      g.moonMesh.visible = this.moonDir.y > -0.1;
      const mb = 1.2 + wNight * 0.9;
      g.moonMesh.material.color.setRGB(mb, mb * 0.98, mb * 0.9);
    }
    if (g.skyStarMat) g.skyStarMat.color.setRGB(1.6 + wNight * 1.2, 1.15 + wNight * 0.9, 0.45 + wNight * 0.4);

    // Cloud sea
    if (g.cloudSea) {
      const cu = g.cloudSea.material.uniforms;
      cu.uShade.value.copy(this.mix('cloudShade', w));
      cu.uLight.value.copy(this.mix('cloudLight', w));
      cu.uBlush.value.copy(this.mix('cloudBlush', w));
    }

    // Water tints, waterfall, spray & rainbow
    g.waterSurfaces.forEach(ws => {
      const u = ws.material.uniforms;
      u.uSky.value.copy(this.mix('waterSky', w));
      u.uShallow.value.copy(this.mix('shallow', w));
      u.uDeep.value.copy(this.mix('deep', w));
    });
    if (g.waterfall) g.waterfall.material.uniforms.uWater.value.copy(this.mix('fall', w));
    if (g.mist) g.mist.material.color.copy(this.mix('mist', w));
    if (g.rainbow) g.rainbow.material.uniforms.uStrength.value = wDay;

    // Night glow
    this.glowMats.forEach((base, mat) => { mat.emissiveIntensity = base * (1 + wNight * 1.4); });
    this.pointLights.forEach(pl => { pl.light.intensity = pl.base * (1 + wNight * 1.6); });

    // Fireflies
    this.fireflies.visible = wNight > 0.02;
    if (this.fireflies.visible) {
      const t = g.clock.elapsedTime;
      const pos = this.fireflies.geometry.attributes.position.array;
      for (let i = 0; i < this.fireflyBase.length; i++) {
        const f = this.fireflyBase[i];
        pos[i * 3] = f.x + Math.sin(t * 0.5 * f.sp + f.ph) * 1.6;
        pos[i * 3 + 1] = f.y + Math.sin(t * 1.1 * f.sp + f.ph * 2) * 0.5;
        pos[i * 3 + 2] = f.z + Math.cos(t * 0.45 * f.sp + f.ph) * 1.6;
      }
      this.fireflies.geometry.attributes.position.needsUpdate = true;
      this.fireflyMat.opacity = wNight * (0.75 + Math.sin(t * 2.3) * 0.25);
    }

    // Phase events
    const isNight = wNight > 0.5;
    if (isNight !== this.wasNight) {
      this.wasNight = isNight;
      if (isNight && this.onNightfall) this.onNightfall();
      if (!isNight && this.onSunrise) this.onSunrise();
    }
  }
}
