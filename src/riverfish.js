// ==========================================
// RIVER FISH: colourful fish of different sizes swimming in the river, pond and lakes.
// Fishing near them sometimes catches one of them (it is gone for a while, then a new one swims by) -
// but often something bites that was hiding deeper down, so you never quite know what you get.
// Two instanced meshes (bodies, tails) keep this to two draw calls.
// ==========================================
import * as THREE from 'three';
import { mulberry32, WORLD_SEED } from './game/shared.js';

const COUNT = 46;
const COLORS = [0xff8c42, 0xffd166, 0xc0d6e8, 0xff7eb6, 0x7ed957, 0xff5d5d, 0x9b8cff, 0xf4f4f4];

export class RiverFish {
  constructor(game) {
    this.game = game;
    this.fish = [];
    const rng = mulberry32(WORLD_SEED ^ 0x0f15);
    for (let guard = 0; this.fish.length < COUNT && guard < 20000; guard++) {
      const x = (rng() * 2 - 1) * 92;
      const z = (rng() * 2 - 1) * 92;
      const w = game.getWaterSurface(x, z);
      if (w === null) continue;
      if (w - game.getTerrainHeight(x, z) < 0.6) continue;
      const size = 0.55 + rng() * 0.8;
      this.fish.push({
        home: new THREE.Vector3(x, w, z), pos: new THREE.Vector3(x, w, z), heading: rng() * Math.PI * 2,
        speed: 0.6 + rng() * 0.9, size, color: COLORS[Math.floor(rng() * COLORS.length)], phase: rng() * 10, gone: 0
      });
    }
    const bodyGeo = new THREE.SphereGeometry(0.22, 10, 8);
    bodyGeo.scale(0.55, 0.45, 1.2);
    const tailGeo = new THREE.ConeGeometry(0.14, 0.26, 4);
    tailGeo.rotateX(Math.PI / 2);
    tailGeo.translate(0, 0, -0.36);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x111111 });
    this.bodies = new THREE.InstancedMesh(bodyGeo, mat, this.fish.length);
    this.tails = new THREE.InstancedMesh(tailGeo, mat, this.fish.length);
    this.fish.forEach((f, i) => {
      const c = new THREE.Color(f.color);
      this.bodies.setColorAt(i, c);
      this.tails.setColorAt(i, c.clone().multiplyScalar(0.8));
    });
    this.dummy = new THREE.Object3D();
    this.visibleChance = 0.5; // how often the bite is one of the fish you can see
    game.scene.add(this.bodies, this.tails);
    this.update(0);
  }

  update(delta) {
    const g = this.game;
    const t = g.clock.elapsedTime;
    const d = this.dummy;
    this.fish.forEach((f, i) => {
      if (f.gone > 0) {
        f.gone -= delta;
        d.position.copy(f.home);
        d.scale.setScalar(0.0001);
        d.updateMatrix();
        this.bodies.setMatrixAt(i, d.matrix);
        this.tails.setMatrixAt(i, d.matrix);
        if (f.gone <= 0) f.pos.copy(f.home);
        return;
      }
      // swim, turn around at the bank or when straying too far from home
      const step = f.speed * delta;
      const nx = f.pos.x + Math.sin(f.heading) * step;
      const nz = f.pos.z + Math.cos(f.heading) * step;
      const w = g.getWaterSurface(nx, nz);
      const deep = w !== null && w - g.getTerrainHeight(nx, nz) > 0.45;
      if (deep && Math.hypot(nx - f.home.x, nz - f.home.z) < 7) {
        f.pos.x = nx;
        f.pos.z = nz;
        f.pos.y = w;
        f.heading += Math.sin(t * 0.5 + f.phase) * delta * 0.6;
      } else {
        f.heading += Math.PI * (0.6 + Math.random() * 0.8);
      }
      d.position.set(f.pos.x, f.pos.y - 0.32 + Math.sin(t * 2 + f.phase) * 0.04, f.pos.z);
      d.rotation.set(0, f.heading, 0);
      d.scale.setScalar(f.size);
      d.updateMatrix();
      this.bodies.setMatrixAt(i, d.matrix);
      d.rotation.y = f.heading + Math.sin(t * 9 + f.phase) * 0.35;
      d.updateMatrix();
      this.tails.setMatrixAt(i, d.matrix);
    });
    this.bodies.instanceMatrix.needsUpdate = true;
    this.tails.instanceMatrix.needsUpdate = true;
  }

  // The fish that bites: sometimes the nearest visible one, otherwise a hidden fish from the deep
  // (null = hidden fish; the caller rolls its size)
  takeNearest(spot, maxDist = 9) {
    if (Math.random() >= this.visibleChance) return null;
    let best = null;
    let bd = maxDist;
    this.fish.forEach(f => {
      if (f.gone > 0) return;
      const dd = Math.hypot(f.pos.x - spot.x, f.pos.z - spot.z);
      if (dd < bd) { bd = dd; best = f; }
    });
    if (!best) return null;
    best.gone = 60 + Math.random() * 60;
    return { size: best.size, color: best.color, visible: true };
  }
}
