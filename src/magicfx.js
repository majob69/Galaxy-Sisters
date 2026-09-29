// ==========================================
// MAGIC FX: one GPU particle pool (HDR colors -> bloom), expanding ring waves,
// flashes and projectile trails for the sisters' spells
// ==========================================
import * as THREE from 'three';
import { createSoftSpriteTexture } from './water.js';

const _v = new THREE.Vector3();

export class MagicFX {
  constructor(scene, capacity = 1800) {
    this.scene = scene;
    this.capacity = capacity;
    this.cursor = 0;
    this.positions = new Float32Array(capacity * 3);
    this.colors = new Float32Array(capacity * 3);
    this.sizes = new Float32Array(capacity);
    this.alphas = new Float32Array(capacity);
    this.vel = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.gravity = new Float32Array(capacity);
    this.drag = new Float32Array(capacity);
    this.size0 = new Float32Array(capacity);
    this.size1 = new Float32Array(capacity);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alphas, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 400 } },
      vertexShader: `
        attribute float aSize;
        attribute float aAlpha;
        varying vec3 vColor;
        varying float vAlpha;
        uniform float uScale;
        void main() {
          vColor = color;
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aAlpha > 0.0 ? aSize * uScale / max(0.1, -mv.z) : 0.0;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float core = smoothstep(1.0, 0.0, d);
          float glow = core * core;
          gl_FragColor = vec4(vColor * glow * vAlpha, glow * vAlpha);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 8;
    scene.add(this.points);

    this.rings = [];
    this.flashes = [];
    this.flashTex = createSoftSpriteTexture();
    this.ringGeo = new THREE.RingGeometry(0.82, 1.0, 48);
    this.ringGeo.rotateX(-Math.PI / 2);
  }

  // color: THREE.Color (may be HDR > 1 so it blooms)
  emit(pos, vel, color, { size = 0.35, sizeEnd = 0, life = 0.8, gravity = 0, drag = 0.98 } = {}) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.capacity;
    this.positions.set([pos.x, pos.y, pos.z], i * 3);
    this.vel.set([vel.x, vel.y, vel.z], i * 3);
    this.colors.set([color.r, color.g, color.b], i * 3);
    this.life[i] = life;
    this.maxLife[i] = life;
    this.gravity[i] = gravity;
    this.drag[i] = drag;
    this.size0[i] = size;
    this.size1[i] = sizeEnd;
    this.sizes[i] = size;
    this.alphas[i] = 1;
  }

  // Radial burst of sparkles
  burst(pos, colors, count, { speed = 4, up = 1.5, size = 0.4, life = 0.9, gravity = 3, spread = 1 } = {}) {
    for (let k = 0; k < count; k++) {
      const a = Math.random() * Math.PI * 2;
      const r = (0.3 + Math.random() * 0.7) * speed;
      _v.set(Math.cos(a) * r * spread, up * (0.4 + Math.random()), Math.sin(a) * r * spread);
      this.emit(pos, _v, colors[k % colors.length], {
        size: size * (0.6 + Math.random() * 0.8), life: life * (0.6 + Math.random() * 0.6), gravity
      });
    }
  }

  // Sparkles spiralling upwards around a point (heal, spring)
  spiral(pos, colors, count, radius = 1.0, height = 2.4) {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * Math.PI * 6;
      const p = _v.set(pos.x + Math.cos(a) * radius, pos.y + (k / count) * 0.6, pos.z + Math.sin(a) * radius);
      const vel = new THREE.Vector3(-Math.sin(a) * 0.8, height * (0.6 + Math.random() * 0.5), Math.cos(a) * 0.8);
      this.emit(p, vel, colors[k % colors.length], { size: 0.3 + Math.random() * 0.2, life: 1.1 + Math.random() * 0.5, drag: 0.97 });
    }
  }

  // Flat shockwave ring expanding on the ground
  ringWave(pos, color, maxRadius, duration = 0.6, thickness = 1) {
    const mat = new THREE.MeshBasicMaterial({
      color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(this.ringGeo, mat);
    ring.position.set(pos.x, pos.y + 0.12, pos.z);
    ring.renderOrder = 8;
    this.scene.add(ring);
    this.rings.push({ mesh: ring, t: 0, duration, maxRadius, thickness });
  }

  // Short bright glow sprite (supernova core, impacts)
  flash(pos, color, size = 4, duration = 0.35) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: this.flashTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    sprite.position.copy(pos);
    sprite.renderOrder = 9;
    this.scene.add(sprite);
    this.flashes.push({ sprite, t: 0, duration, size });
  }

  update(delta, camera, renderer) {
    // Point size scale follows the viewport so sparkles keep their size
    const h = renderer.getDrawingBufferSize(_v).y;
    this.material.uniforms.uScale.value = h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));

    for (let i = 0; i < this.capacity; i++) {
      if (this.life[i] <= 0) {
        if (this.alphas[i] !== 0) this.alphas[i] = 0;
        continue;
      }
      this.life[i] -= delta;
      const o = i * 3;
      this.vel[o + 1] -= this.gravity[i] * delta;
      const d = Math.pow(this.drag[i], delta * 60);
      this.vel[o] *= d;
      this.vel[o + 1] *= d;
      this.vel[o + 2] *= d;
      this.positions[o] += this.vel[o] * delta;
      this.positions[o + 1] += this.vel[o + 1] * delta;
      this.positions[o + 2] += this.vel[o + 2] * delta;
      const t = 1 - Math.max(0, this.life[i]) / this.maxLife[i];
      this.sizes[i] = this.size0[i] + (this.size1[i] - this.size0[i]) * t;
      this.alphas[i] = this.life[i] > 0 ? Math.min(1, (1 - t) * 1.6) : 0;
    }
    const attrs = this.points.geometry.attributes;
    attrs.position.needsUpdate = true;
    attrs.color.needsUpdate = true;
    attrs.aSize.needsUpdate = true;
    attrs.aAlpha.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += delta;
      const k = Math.min(1, r.t / r.duration);
      const radius = 0.3 + (r.maxRadius - 0.3) * (1 - Math.pow(1 - k, 3));
      r.mesh.scale.set(radius, 1, radius);
      r.mesh.material.opacity = (1 - k) * 0.9;
      if (k >= 1) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.rings.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += delta;
      const k = Math.min(1, f.t / f.duration);
      f.sprite.scale.setScalar(f.size * (0.4 + k * 0.8));
      f.sprite.material.opacity = 1 - k;
      if (k >= 1) {
        this.scene.remove(f.sprite);
        f.sprite.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
  }
}

// Soap-bubble shield: transparent in the middle, glowing fresnel rim (keeps material.opacity semantics)
export function createShieldMaterial() {
  const mat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0.9, 1.6, 2.2),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    mat.userData.shader = shader;
    shader.vertexShader = 'varying vec3 vShieldNormal;\nvarying vec3 vShieldView;\nvarying vec3 vShieldPos;\n' +
      shader.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
        vShieldNormal = normalize(normalMatrix * normal);
        vShieldView = normalize(-mvPosition.xyz);
        vShieldPos = position;`);
    shader.fragmentShader = 'uniform float uTime;\nvarying vec3 vShieldNormal;\nvarying vec3 vShieldView;\nvarying vec3 vShieldPos;\n' +
      shader.fragmentShader.replace('#include <opaque_fragment>', `
        float rim = pow(1.0 - abs(dot(normalize(vShieldNormal), normalize(vShieldView))), 2.2);
        float bands = 0.5 + 0.5 * sin(vShieldPos.y * 7.0 - uTime * 3.0);
        float swirl = 0.5 + 0.5 * sin((vShieldPos.x + vShieldPos.z) * 5.0 + uTime * 2.0);
        vec3 tint = mix(vec3(0.7, 0.9, 1.6), vec3(1.4, 0.8, 1.6), swirl);
        outgoingLight = diffuseColor.rgb * tint * (rim * 1.4 + bands * 0.08);
        diffuseColor.a *= rim * 0.9 + 0.06;
        #include <opaque_fragment>`);
  };
  return mat;
}
