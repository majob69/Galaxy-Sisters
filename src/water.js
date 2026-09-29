// ==========================================
// STYLIZED WATER: flow-mapped toon water surfaces, waterfall, mist & rainbow
// ==========================================
import * as THREE from 'three';
import { waterQuery } from './landscape.js';
import { NOISE_GLSL } from './atmosphere.js';

const WATER_VERT = `
  varying vec3 vWorld;
  #include <fog_pars_vertex>
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorld = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const WATER_FRAG = `
  uniform float uTime;
  uniform sampler2D uData;
  uniform vec2 uMin;
  uniform vec2 uSize;
  uniform vec3 uShallow;
  uniform vec3 uDeep;
  uniform vec3 uFoam;
  uniform vec3 uSky;
  varying vec3 vWorld;
  #include <fog_pars_fragment>
  ${NOISE_GLSL}
  void main() {
    vec4 data = texture2D(uData, (vWorld.xz - uMin) / uSize);
    if (data.a < 0.5) discard;
    float depth = data.b * 4.0;
    vec2 flow = (data.rg * 2.0 - 1.0) * 1.6;

    // Two-phase flow mapping (no stretching)
    float ph0 = fract(uTime * 0.3);
    float ph1 = fract(uTime * 0.3 + 0.5);
    float w0 = 1.0 - abs(1.0 - 2.0 * ph0);
    vec2 base = vWorld.xz * 0.62;
    vec2 drift = vec2(uTime * 0.03, uTime * 0.02);
    float e0 = gsCellEdge(base + drift - flow * ph0 * 2.0, uTime * 0.7);
    float e1 = gsCellEdge(base + drift - flow * ph1 * 2.0 + vec2(0.37, 0.71), uTime * 0.7);
    float cells = e0 * w0 + e1 * (1.0 - w0);

    vec3 col = mix(uShallow, uDeep, smoothstep(0.15, 2.3, depth));
    float lines = smoothstep(0.07, 0.015, cells);
    col = mix(col, vec3(0.92, 1.0, 1.0), lines * mix(0.45, 0.2, smoothstep(0.3, 2.0, depth)));

    // Fresnel sky tint at grazing angles
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - clamp(V.y, 0.0, 1.0), 4.0);
    col = mix(col, uSky, fres * 0.5);

    // Twinkling sparkles (HDR -> bloom)
    float sp = gsNoise(vWorld.xz * 2.4 + vec2(uTime * 0.7, -uTime * 0.4)) * gsNoise(vWorld.xz * 3.3 - vec2(uTime * 0.5, uTime * 0.6));
    col += vec3(1.0, 0.97, 0.9) * smoothstep(0.62, 0.72, sp) * 2.2;

    // Shoreline foam with wobbly edge, plus rapids foam where the current is strong
    float foamN = gsNoise(vWorld.xz * 1.7 + vec2(uTime * 0.35, uTime * 0.2));
    float foam = 1.0 - smoothstep(0.05, 0.22 + foamN * 0.28, depth);
    float speed = length(data.rg * 2.0 - 1.0);
    foam = max(foam, smoothstep(0.75, 0.95, speed) * smoothstep(0.55, 0.8, gsNoise(base * 3.0 - flow * uTime * 1.2)));
    col = mix(col, uFoam, foam * 0.9);

    float alpha = mix(0.6, 0.9, smoothstep(0.0, 1.8, depth));
    alpha = max(alpha, foam * 0.95);
    gl_FragColor = vec4(col, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

function createWaterMaterial(dataTex, minX, minZ, sizeX, sizeZ) {
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uData: { value: null },
        uMin: { value: new THREE.Vector2(minX, minZ) },
        uSize: { value: new THREE.Vector2(sizeX, sizeZ) },
        uShallow: { value: new THREE.Color(0x46d8e0) },
        uDeep: { value: new THREE.Color(0x1f56c9) },
        uFoam: { value: new THREE.Color(0xf4fdff) },
        uSky: { value: new THREE.Color(0xdcecff) }
      }
    ]),
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    transparent: true,
    depthWrite: false,
    fog: true
  });
}

// One flat water plane with a baked flow/depth/mask texture
export class WaterSurface {
  constructor({ level, minX, maxX, minZ, maxZ, res, upper, heightAt, flowBoost }) {
    this.level = level;
    this.res = res;
    this.w = Math.ceil((maxX - minX) / res);
    this.h = Math.ceil((maxZ - minZ) / res);
    // Anchor to maxZ so a clipped edge (waterfall lip) stays exact
    minZ = maxZ - this.h * res;
    this.minX = minX;
    this.minZ = minZ;
    this.sizeX = this.w * res;
    this.sizeZ = this.h * res;
    this.mask = new Uint8Array(this.w * this.h);

    const data = new Uint8Array(this.w * this.h * 4);
    for (let j = 0; j < this.h; j++) {
      const z = minZ + (j + 0.5) * res;
      for (let i = 0; i < this.w; i++) {
        const x = minX + (i + 0.5) * res;
        const q = waterQuery(x, z, upper);
        const ground = heightAt(x, z);
        const depth = level - ground;
        const inside = q.dist < 0.8 && depth > -0.6;
        let fx = 0;
        let fz = 0;
        if (inside && !q.isLake) {
          const speed = Math.min(1, 0.55 + (flowBoost ? flowBoost(x, z) : 0));
          // Current fades out towards the banks
          const bankFade = Math.min(1, Math.max(0.25, -q.dist / (q.width * 0.6)));
          fx = q.dirX * speed * bankFade;
          fz = q.dirZ * speed * bankFade;
        }
        const o = (j * this.w + i) * 4;
        data[o] = Math.round((fx * 0.5 + 0.5) * 255);
        data[o + 1] = Math.round((fz * 0.5 + 0.5) * 255);
        data[o + 2] = Math.round(Math.min(1, Math.max(0, depth / 4)) * 255);
        data[o + 3] = inside ? 255 : 0;
        this.mask[j * this.w + i] = inside && depth > 0 ? 1 : 0;
      }
    }

    this.texture = new THREE.DataTexture(data, this.w, this.h, THREE.RGBAFormat);
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.needsUpdate = true;

    this.material = createWaterMaterial(this.texture, minX, minZ, this.sizeX, this.sizeZ);
    this.material.uniforms.uData.value = this.texture;

    const geo = new THREE.PlaneGeometry(this.sizeX, this.sizeZ);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.position.set(minX + this.sizeX / 2, level, minZ + this.sizeZ / 2);
    this.mesh.renderOrder = 2;
  }

  // Water surface height at (x, z) or null when dry
  surfaceAt(x, z) {
    const i = Math.floor((x - this.minX) / this.res);
    const j = Math.floor((z - this.minZ) / this.res);
    if (i < 0 || j < 0 || i >= this.w || j >= this.h) return null;
    return this.mask[j * this.w + i] ? this.level : null;
  }

  update(time) {
    this.material.uniforms.uTime.value = time;
  }
}

// Curved falling sheet of water from the cliff lip into the plunge pool
export function createWaterfall({ x, topY, topZ, bottomY, reach, topHalfWidth, bottomHalfWidth }) {
  const cols = 10;
  const rows = 24;
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let r = 0; r <= rows; r++) {
    const t = r / rows;
    // Ballistic arc: constant forward drift, accelerating fall
    const y = topY + (bottomY - topY) * t;
    const z = topZ + reach * Math.sqrt(t);
    const hw = topHalfWidth + (bottomHalfWidth - topHalfWidth) * t;
    for (let c = 0; c <= cols; c++) {
      const u = c / cols;
      const bulge = Math.sin(u * Math.PI) * 0.25;
      positions.push(x + (u - 0.5) * 2 * hw, y, z + bulge);
      uvs.push(u, t);
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = r * (cols + 1) + c;
      const b = a + 1;
      const d = a + cols + 1;
      const e = d + 1;
      indices.push(a, d, b, b, d, e);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uWater: { value: new THREE.Color(0x4fb8f0) },
        uFoam: { value: new THREE.Color(0xffffff) }
      }
    ]),
    vertexShader: `
      varying vec2 vUv;
      #include <fog_pars_vertex>
      void main() {
        vUv = uv;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uWater;
      uniform vec3 uFoam;
      varying vec2 vUv;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      void main() {
        float s1 = gsNoise(vec2(vUv.x * 16.0, vUv.y * 5.0 - uTime * 2.6));
        float s2 = gsNoise(vec2(vUv.x * 34.0 + 3.0, vUv.y * 9.0 - uTime * 3.4));
        float streak = s1 * 0.6 + s2 * 0.4;
        vec3 col = mix(uWater, uFoam, smoothstep(0.38, 0.72, streak));
        float lipFoam = smoothstep(0.1, 0.0, vUv.y);
        float baseFoam = smoothstep(0.78, 1.0, vUv.y);
        col = mix(col, uFoam, max(lipFoam, baseFoam) * 0.85);
        col += vec3(1.0) * smoothstep(0.8, 0.9, s2) * 0.8;
        float edge = smoothstep(0.0, 0.14, vUv.x) * smoothstep(1.0, 0.86, vUv.x);
        float alpha = (0.72 + streak * 0.28) * edge;
        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 3;
  return mesh;
}

export function createSoftSpriteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

// Rising spray at the base of the waterfall
export class MistParticles {
  constructor(center, spread, count = 70) {
    this.center = center.clone();
    this.spread = spread;
    this.count = count;
    this.positions = new Float32Array(count * 3);
    this.velocities = [];
    this.life = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.respawn(i);
      this.life[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      map: createSoftSpriteTexture(),
      color: 0xffffff,
      size: 2.4,
      transparent: true,
      opacity: 0.42,
      depthWrite: false
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
  }

  respawn(i) {
    const o = i * 3;
    this.positions[o] = this.center.x + (Math.random() - 0.5) * this.spread;
    this.positions[o + 1] = this.center.y + Math.random() * 0.4;
    this.positions[o + 2] = this.center.z + (Math.random() - 0.5) * this.spread * 0.6;
    this.velocities[i] = new THREE.Vector3(
      (Math.random() - 0.5) * 0.9,
      0.8 + Math.random() * 1.4,
      0.4 + Math.random() * 1.2
    );
    this.life[i] = 0;
  }

  update(delta) {
    for (let i = 0; i < this.count; i++) {
      this.life[i] += delta * 0.45;
      if (this.life[i] >= 1) {
        this.respawn(i);
        continue;
      }
      const v = this.velocities[i];
      const o = i * 3;
      this.positions[o] += v.x * delta;
      this.positions[o + 1] += v.y * delta;
      this.positions[o + 2] += v.z * delta;
      v.y *= 0.985;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

// Soft rainbow arc in the waterfall spray
export function createRainbow(inner, outer) {
  const geo = new THREE.RingGeometry(inner, outer, 64, 1, 0, Math.PI);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uInner: { value: inner }, uOuter: { value: outer }, uStrength: { value: 1 } },
    vertexShader: `
      varying vec2 vLocal;
      void main() {
        vLocal = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uInner;
      uniform float uOuter;
      uniform float uStrength;
      varying vec2 vLocal;
      vec3 hsv2rgb(vec3 c) {
        vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
        return c.z * clamp(p - 1.0, 0.0, 1.0);
      }
      void main() {
        float t = clamp((length(vLocal) - uInner) / (uOuter - uInner), 0.0, 1.0);
        vec3 col = hsv2rgb(vec3(0.78 * (1.0 - t), 0.75, 1.0));
        float a = sin(t * 3.14159) * 0.32 * smoothstep(0.0, 2.5, vLocal.y) * uStrength;
        gl_FragColor = vec4(col * a, a);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = 5;
  return mesh;
}
