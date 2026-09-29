// ==========================================
// ATMOSPHERE: Cel-Shading, Sky Dome, Distant Ranges, Cloud Sea & Post-Processing
// ==========================================
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';
import { ridged, fbm, smoothstep } from './landscape.js';

export const SKY_COLORS = {
  zenith: 0x6fb2ff,
  horizon: 0xf3e6ff,
  blush: 0xffd6ec,
  fog: 0xeee4fb,
  sun: 0xfff1d6
};

// Shared GLSL helpers (value noise, fbm, animated voronoi edges)
export const NOISE_GLSL = `
float gsHash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
vec2 gsHash22(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
float gsNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(gsHash21(i), gsHash21(i + vec2(1.0, 0.0)), u.x),
             mix(gsHash21(i + vec2(0.0, 1.0)), gsHash21(i + vec2(1.0, 1.0)), u.x), u.y);
}
float gsFbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += gsNoise(p) * a;
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return s;
}
// Distance to the nearest voronoi cell edge (0 on edges)
float gsCellEdge(vec2 p, float t) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float d1 = 8.0;
  float d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(float(x), float(y));
      vec2 o = gsHash22(i + g);
      o = 0.5 + 0.5 * sin(t + 6.2831 * o);
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) { d2 = d; }
    }
  }
  return sqrt(d2) - sqrt(d1);
}
`;

// Stylized anime light bands for every Lambert material (must run before first render)
export function applyCelShading() {
  const chunk = THREE.ShaderChunk.lights_lambert_pars_fragment;
  if (chunk.includes('CEL_SHADED')) return;
  THREE.ShaderChunk.lights_lambert_pars_fragment = chunk.replace(
    'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );',
    `// CEL_SHADED: soft-edged toon bands
	float dotNLRaw = saturate( dot( geometryNormal, directLight.direction ) );
	float dotNL = smoothstep( 0.0, 0.08, dotNLRaw ) * 0.68 + smoothstep( 0.36, 0.48, dotNLRaw ) * 0.32;`
  );
}

export function createSkyDome(sunDir) {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uZenith: { value: new THREE.Color(SKY_COLORS.zenith) },
      uHorizon: { value: new THREE.Color(SKY_COLORS.horizon) },
      uBlush: { value: new THREE.Color(SKY_COLORS.blush) },
      uSunColor: { value: new THREE.Color(SKY_COLORS.sun) },
      uSunDir: { value: sunDir.clone().normalize() },
      uNight: { value: 0 },
      uTime: { value: 0 }
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uZenith;
      uniform vec3 uHorizon;
      uniform vec3 uBlush;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uNight;
      uniform float uTime;
      varying vec3 vDir;
      ${NOISE_GLSL}
      float gsHash31(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      // Twinkling point stars on a 3D cell grid (no seams on the dome)
      float starLayer(vec3 d, float scale, float thresh) {
        vec3 p = d * scale;
        vec3 c = floor(p);
        float h = gsHash31(c);
        if (h < thresh) return 0.0;
        vec3 center = vec3(gsHash31(c + 1.7), gsHash31(c + 3.1), gsHash31(c + 5.3)) * 0.6 + 0.2;
        float dist = length(fract(p) - center);
        float twinkle = 0.6 + 0.4 * sin(uTime * (1.3 + h * 3.0) + h * 40.0);
        return smoothstep(0.24, 0.0, dist) * twinkle * (0.4 + 0.6 * (h - thresh) / (1.0 - thresh));
      }
      void main() {
        vec3 dir = normalize(vDir);
        float h = dir.y;
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.6, h), 0.7));
        col = mix(col, uBlush, exp(-abs(h) * 9.0) * 0.45);
        if (h < 0.0) col = uHorizon;
        float sd = max(dot(dir, normalize(uSunDir)), 0.0);
        float sunUp = smoothstep(-0.08, 0.04, uSunDir.y) * step(0.0, h);
        col += uSunColor * (pow(sd, 1400.0) * 5.0 + pow(sd, 18.0) * 0.22) * sunUp;

        // Night: galaxy band + stars
        if (uNight > 0.01 && h > -0.02) {
          float above = smoothstep(-0.02, 0.18, h);
          vec3 axis = normalize(vec3(0.35, 0.3, 0.88));
          float b = dot(dir, axis);
          float band = exp(-b * b * 16.0);
          vec2 q = vec2(dir.x * 3.0 + dir.z * 1.7, dir.y * 3.0 - dir.z * 1.3);
          float dust = gsFbm(q * 2.2 + 4.0);
          float lanes = smoothstep(0.35, 0.75, gsFbm(q * 5.0 - 2.0));
          vec3 galaxy = mix(vec3(0.42, 0.22, 0.75), vec3(0.95, 0.45, 0.8), dust);
          galaxy = mix(galaxy, vec3(0.35, 0.8, 1.0), smoothstep(0.55, 0.8, dust) * 0.5);
          col += galaxy * band * (0.25 + dust * 0.55) * (1.0 - lanes * 0.5) * uNight * above;
          float stars = starLayer(dir, 120.0, 0.968 - band * 0.03) * 2.6 + starLayer(dir, 260.0, 0.985) * 1.4;
          col += vec3(1.0, 0.95, 1.1) * stars * uNight * above;
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(800, 32, 16), mat);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  return dome;
}

// Far mountain silhouettes rising out of the cloud sea (atmospheric perspective via fog)
export function createDistantRanges() {
  const group = new THREE.Group();
  const layers = [
    { inner: 128, outer: 250, base: 16, amp: 58, seed: 3.1, rock: 0x8a90cf, snowLine: 44 },
    { inner: 230, outer: 380, base: 30, amp: 90, seed: 8.7, rock: 0xa0a5e0, snowLine: 62 }
  ];

  layers.forEach(layer => {
    const angSeg = 180;
    const radSeg = 12;
    const positions = [];
    const colors = [];
    const rockCol = new THREE.Color(layer.rock);
    const snowCol = new THREE.Color(0xf6f7ff);
    const tmp = new THREE.Color();
    // Height grid once, then emit flat-shaded triangles
    const grid = [];
    for (let ai = 0; ai <= angSeg; ai++) {
      const row = [];
      const ang = (ai / angSeg) * Math.PI * 2;
      for (let ri = 0; ri <= radSeg; ri++) {
        const r = layer.inner + (ri / radSeg) * (layer.outer - layer.inner);
        const x = Math.cos(ang) * r;
        const z = Math.sin(ang) * r;
        const profile = smoothstep(layer.inner, layer.inner + 40, r) * (1 - smoothstep(layer.outer - 50, layer.outer, r));
        const peaks = ridged(x * 0.009 + layer.seed, z * 0.009 - layer.seed, 4);
        const y = -18 + profile * (layer.base + peaks * layer.amp + fbm(x * 0.03, z * 0.03, 2) * 6);
        row.push([x, y, z]);
      }
      grid.push(row);
    }
    for (let ai = 0; ai < angSeg; ai++) {
      for (let ri = 0; ri < radSeg; ri++) {
        const a = grid[ai][ri];
        const b = grid[ai + 1][ri];
        const c = grid[ai][ri + 1];
        const d = grid[ai + 1][ri + 1];
        [a, c, b, b, c, d].forEach(v => {
          positions.push(v[0], v[1], v[2]);
          const snow = smoothstep(layer.snowLine - 6, layer.snowLine + 4, v[1]);
          tmp.copy(rockCol).lerp(snowCol, snow);
          colors.push(tmp.r, tmp.g, tmp.b);
        });
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
  });
  return group;
}

export function createCloudSea() {
  const geo = new THREE.RingGeometry(88, 760, 120, 10);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uShade: { value: new THREE.Color(0xb3abe4) },
        uLight: { value: new THREE.Color(0xffffff) },
        uBlush: { value: new THREE.Color(0xffe0f0) }
      }
    ]),
    vertexShader: `
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uShade;
      uniform vec3 uLight;
      uniform vec3 uBlush;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      ${NOISE_GLSL}
      void main() {
        vec2 p = vWorld.xz * 0.012 + vec2(uTime * 0.006, uTime * 0.004);
        float n = gsFbm(p);
        float puffs = smoothstep(0.3, 0.68, n);
        // Toon-stepped cloud tops
        puffs = floor(puffs * 3.0 + 0.5) / 3.0 * 0.6 + puffs * 0.4;
        vec3 col = mix(uShade, uLight, puffs);
        col = mix(col, uBlush, smoothstep(0.55, 0.8, gsFbm(p * 0.5 + 3.0)) * 0.35);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
    fog: true
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 2.5;
  mesh.matrixAutoUpdate = false;
  mesh.updateMatrix();
  return mesh;
}

// HDR pipeline: only values above 1.0 (sun, lanterns, crystals, water glints) bloom.
// MSAA on half-float targets is expensive on integrated GPUs, so edges get FXAA instead.
export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.6, 0.55, 1.0);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    this.setSize();
  }

  setSize() {
    const size = this.renderer.getDrawingBufferSize(new THREE.Vector2());
    this.composer.setSize(size.x, size.y);
    this.fxaa.material.uniforms.resolution.value.set(1 / size.x, 1 / size.y);
  }

  render() {
    this.composer.render();
  }
}
