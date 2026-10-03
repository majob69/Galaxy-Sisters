// ==========================================
// WILDLIFE: animals that roam the snow biome (penguins, snow hares, arctic foxes, a snowy owl)
// and the enchanted forest (glowing bunnies, foxes, cats, owls and frogs). Walk up and press F
// to pet them. In the forest live a few DORNWICHTEL as well - prickly little imps that chase
// and bite. Spells and arrows drive them off; they come back after a while.
// Everything here is simulated per client (like the slimes).
// ==========================================
import * as THREE from 'three';
import { sfx, mulberry32, WORLD_SEED } from './game/shared.js';
import { createCritterLite, animateCritter } from './critters.js';
import { blinkFace } from './characters.js';
import { SNOW_BIOME, snowAt } from './biome.js';
import { FOREST, FOREST_ARENA, LILLI_SPOT, inForestArea } from './forest.js';
import { VORTOX_ARENA } from './arenas.js';
import { bakeStaticGroup } from './bake.js';

const SHOW_DIST = 48;
const PET_RANGE = 2.2;
const PET_COOLDOWN = 45;

const FOE_HP = 40;
const FOE_AGGRO = 10;
const FOE_SPEED = 3.0;
const FOE_DAMAGE = 6;
const FOE_RESPAWN = 90;

const SNOW_ANIMALS = [
  { kind: 'penguin', name: 'Pinguin', say: 'watschelt fröhlich im Kreis', n: 3, group: true },
  { kind: 'bunny', name: 'Schneehase', say: 'wackelt mit den Ohren', n: 2, colors: { body: 0xfbfcff, belly: 0xffffff, iris: 0x5f86ff } },
  { kind: 'fox', name: 'Polarfuchs', say: 'kuschelt sich an dich', n: 2, colors: { body: 0xf2f5ff, belly: 0xffffff, iris: 0x3b6fd6 } },
  { kind: 'owl', name: 'Schneeeule', say: 'plustert sich auf und schuhut leise', n: 1, colors: { body: 0xf4f4fa, belly: 0xffffff, iris: 0xffc400 } }
];

const FOREST_ANIMALS = [
  { kind: 'bunny', name: 'Glitzerhase', say: 'hoppelt im Kreis und funkelt', n: 3, colors: { body: 0xd9c8ff, belly: 0xfff0ff, iris: 0xb07cff } },
  { kind: 'fox', name: 'Sternfuchs', say: 'wedelt mit dem leuchtenden Schwanz', n: 2, colors: { body: 0x7fb8ff, belly: 0xe6f4ff, iris: 0x3b6fd6 } },
  { kind: 'cat', name: 'Mondkatze', say: 'schnurrt ganz zufrieden', n: 2, colors: { body: 0xff9ecf, belly: 0xffeef7, iris: 0x8a4dff } },
  { kind: 'owl', name: 'Nachteule', say: 'blinzelt dich weise an', n: 1, colors: { body: 0x6a5acd, belly: 0xd7cfff, iris: 0xffd166 } },
  { kind: 'frog', name: 'Glühfrosch', say: 'quakt eine kleine Melodie', n: 2, colors: { body: 0x4fe0c0, belly: 0xd8fff4, iris: 0x1b6b5a } }
];

export class Wildlife {
  constructor(game) {
    this.game = game;
    this.animals = [];
    this.foes = [];
    this.rng = mulberry32(WORLD_SEED ^ 0x5a17);
    this.spawnAnimals(SNOW_ANIMALS, 'snow');
    this.spawnAnimals(FOREST_ANIMALS, 'forest');
    this.spawnFoes();
  }

  // ---------- Places ----------
  okSnow(x, z) {
    const g = this.game;
    return snowAt(x, z) > 0.55 && Math.hypot(x - VORTOX_ARENA.x, z - VORTOX_ARENA.z) > VORTOX_ARENA.r + 1.5 &&
      g.getWaterSurface(x, z) === null && !g.checkWallCollision(x, z, 0.6, g.getTerrainHeight(x, z));
  }

  okForest(x, z) {
    const g = this.game;
    return Math.hypot(x - FOREST.x, z - FOREST.z) < FOREST.r - 6 &&
      Math.hypot(x - FOREST_ARENA.x, z - FOREST_ARENA.z) > FOREST_ARENA.r + 2 &&
      Math.hypot(x - LILLI_SPOT.x, z - LILLI_SPOT.z) > 2.5 &&
      !g.checkWallCollision(x, z, 0.6, g.getTerrainHeight(x, z));
  }

  randomSpot(zone, near = null, spread = 0) {
    for (let i = 0; i < 400; i++) {
      let x;
      let z;
      if (near) {
        x = near.x + (this.rng() - 0.5) * spread;
        z = near.z + (this.rng() - 0.5) * spread;
      } else if (zone === 'snow') {
        const a = this.rng() * Math.PI * 2;
        const r = 8 + this.rng() * (SNOW_BIOME.r - 2);
        x = SNOW_BIOME.x + Math.cos(a) * r;
        z = SNOW_BIOME.z + Math.sin(a) * r;
      } else {
        const a = this.rng() * Math.PI * 2;
        const r = 6 + this.rng() * (FOREST.r - 14);
        x = FOREST.x + Math.cos(a) * r;
        z = FOREST.z + Math.sin(a) * r;
      }
      if (zone === 'snow' ? this.okSnow(x, z) : this.okForest(x, z)) return { x, z };
    }
    return null;
  }

  ok(zone, x, z) {
    return zone === 'snow' ? this.okSnow(x, z) : this.okForest(x, z);
  }

  // ---------- Friendly animals ----------
  spawnAnimals(defs, zone) {
    const g = this.game;
    defs.forEach(def => {
      let groupHome = null;
      for (let i = 0; i < def.n; i++) {
        const home = def.group && groupHome ? this.randomSpot(zone, groupHome, 5) : this.randomSpot(zone);
        if (!home) continue;
        if (def.group && !groupHome) groupHome = home;
        const mesh = createCritterLite(def.kind, { scale: def.kind === 'owl' ? 0.8 : 0.7, colors: def.colors || null, glow: zone === 'forest' ? 0.45 : 0.18 });
        const y = g.getTerrainHeight(home.x, home.z);
        mesh.position.set(home.x, y, home.z);
        mesh.userData.baseY = y;
        mesh.rotation.y = this.rng() * Math.PI * 2;
        mesh.visible = false;
        g.scene.add(mesh);
        this.animals.push({ def, zone, mesh, home, target: null, wait: this.rng() * 4, seed: this.rng() * 10, petAt: -999, hop: 0 });
      }
    });
  }

  updateAnimals(delta, t, inForest) {
    const g = this.game;
    const pp = g.playerGroup.position;
    this.animals.forEach(a => {
      const m = a.mesh;
      const d = Math.hypot(pp.x - m.position.x, pp.z - m.position.z);
      m.visible = (a.zone === 'forest') === inForest && d < SHOW_DIST;
      if (!m.visible) return;
      blinkFace(m.userData.face, t);
      if (d < 5) {
        // curious: stop and look at the sister
        const want = Math.atan2(pp.x - m.position.x, pp.z - m.position.z);
        m.rotation.y += Math.atan2(Math.sin(want - m.rotation.y), Math.cos(want - m.rotation.y)) * Math.min(1, delta * 4);
        m.userData.baseY = g.getTerrainHeight(m.position.x, m.position.z);
        animateCritter(m, t, a.seed);
        return;
      }
      if (!a.target) {
        a.wait -= delta;
        if (a.wait <= 0) {
          const ang = Math.random() * Math.PI * 2;
          const r = 1.5 + Math.random() * 5;
          const tx = a.home.x + Math.cos(ang) * r;
          const tz = a.home.z + Math.sin(ang) * r;
          if (this.ok(a.zone, tx, tz)) a.target = { x: tx, z: tz };
          else a.wait = 0.5;
        }
        m.userData.baseY = g.getTerrainHeight(m.position.x, m.position.z);
        animateCritter(m, t, a.seed);
        return;
      }
      const dx = a.target.x - m.position.x;
      const dz = a.target.z - m.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 0.2) {
        a.target = null;
        a.wait = 1.5 + Math.random() * 4;
        return;
      }
      const speed = a.def.kind === 'bunny' || a.def.kind === 'frog' ? 1.6 : a.def.kind === 'penguin' ? 0.7 : 1.1;
      const step = Math.min(dist, speed * delta);
      const nx = m.position.x + (dx / dist) * step;
      const nz = m.position.z + (dz / dist) * step;
      if (!this.ok(a.zone, nx, nz)) { a.target = null; a.wait = 1; return; }
      m.position.x = nx;
      m.position.z = nz;
      const want = Math.atan2(dx, dz);
      m.rotation.y += Math.atan2(Math.sin(want - m.rotation.y), Math.cos(want - m.rotation.y)) * Math.min(1, delta * 6);
      a.hop += delta * (a.def.kind === 'penguin' ? 7 : 10);
      const ground = g.getTerrainHeight(nx, nz);
      const hopping = a.def.kind === 'bunny' || a.def.kind === 'frog';
      m.position.y = ground + (hopping ? Math.abs(Math.sin(a.hop)) * 0.35 : Math.abs(Math.sin(a.hop)) * 0.05);
      m.rotation.z = a.def.kind === 'penguin' ? Math.sin(a.hop) * 0.15 : 0;
      m.userData.baseY = ground;
    });
  }

  pet(a) {
    const g = this.game;
    const t = g.clock.elapsedTime;
    const pos = a.mesh.position.clone().setY(a.mesh.position.y + 1.2);
    g.fx.burst(pos, [new THREE.Color(2.4, 0.8, 1.4), new THREE.Color(2.6, 1.6, 2.0)], 18, { speed: 2, up: 2.5, size: 0.35, gravity: -0.5 });
    sfx.playTone(880, 'sine', 0.1, 0.05);
    g.showFloatingText('💗', pos, '#ff8fb1');
    g.showToast(`💗 ${a.def.name}: ${a.def.say}!`, 2500);
    if (t - a.petAt > PET_COOLDOWN) g.progression.addXp(3, 'Streicheln');
    a.petAt = t;
  }

  // ---------- Dornwichtel (forest foes) ----------
  buildFoeMesh() {
    const g = new THREE.Group();
    const parts = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3a1f5c, emissive: 0x1a0830, flatShading: true });
    const thornMat = new THREE.MeshLambertMaterial({ color: 0x8a4dff, emissive: 0x2a0a55, flatShading: true });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), bodyMat);
    body.position.y = 0.6;
    parts.add(body);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const up = (i % 3) * 0.35 - 0.1;
      const dir = new THREE.Vector3(Math.cos(a) * Math.cos(up), Math.sin(up) + 0.3, Math.sin(a) * Math.cos(up)).normalize();
      const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.4, 5), thornMat);
      thorn.position.copy(dir.clone().multiplyScalar(0.55)).add(new THREE.Vector3(0, 0.6, 0));
      thorn.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      parts.add(thorn);
    }
    [-1, 1].forEach(s => {
      const foot = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), bodyMat);
      foot.position.set(s * 0.25, 0.1, 0.1);
      parts.add(foot);
    });
    g.add(bakeStaticGroup(parts, { receiveShadow: false }));
    const eyeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.6, 1.4) });
    eyeMat.userData.noNightGlow = true;
    [-1, 1].forEach(s => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), eyeMat);
      eye.position.set(s * 0.2, 0.72, 0.47);
      eye.scale.set(1, 0.7, 0.6);
      g.add(eye);
    });
    return g;
  }

  spawnFoes() {
    const g = this.game;
    const N = 6;
    for (let i = 0; i < N; i++) {
      let home = null;
      for (let k = 0; k < 60 && !home; k++) {
        const s = this.randomSpot('forest');
        // keep the arrival clearing and the guide owl peaceful
        if (s && Math.hypot(s.x - FOREST.x, s.z - (FOREST.z + 40)) > 16 && this.foes.every(f => Math.hypot(f.home.x - s.x, f.home.z - s.z) > 14)) home = s;
      }
      if (!home) continue;
      const mesh = this.buildFoeMesh();
      mesh.position.set(home.x, g.getTerrainHeight(home.x, home.z), home.z);
      mesh.visible = false;
      g.scene.add(mesh);
      this.foes.push({ mesh, home, hp: FOE_HP, alive: true, deadAt: 0, attackCd: 0, pet: 0, bob: Math.random() * 6 });
    }
  }

  updateFoes(delta, t, inForest) {
    const g = this.game;
    const pp = g.playerGroup.position;
    this.foes.forEach(f => {
      const m = f.mesh;
      if (!f.alive) {
        m.visible = false;
        if (t - f.deadAt > FOE_RESPAWN && Math.hypot(pp.x - f.home.x, pp.z - f.home.z) > 25) {
          f.alive = true;
          f.hp = FOE_HP;
          m.position.set(f.home.x, g.getTerrainHeight(f.home.x, f.home.z), f.home.z);
        }
        return;
      }
      const d = Math.hypot(pp.x - m.position.x, pp.z - m.position.z);
      m.visible = inForest && d < SHOW_DIST + 10;
      if (!inForest) return;
      if (f.pet > 0) { f.pet -= delta; return; }
      f.attackCd = Math.max(0, f.attackCd - delta);
      const chase = !g.isPlayerInvisible && !g.isDowned && inForestArea(pp.x) && d < FOE_AGGRO && Math.abs(pp.y - m.position.y) < 4 &&
        Math.hypot(pp.x - FOREST_ARENA.x, pp.z - FOREST_ARENA.z) > FOREST_ARENA.r;
      const tx = chase ? pp.x : f.home.x + Math.sin(t * 0.3 + f.bob) * 3;
      const tz = chase ? pp.z : f.home.z + Math.cos(t * 0.27 + f.bob) * 3;
      const dx = tx - m.position.x;
      const dz = tz - m.position.z;
      const dist = Math.hypot(dx, dz);
      const stopAt = chase ? 1.1 : 0.3;
      if (dist > stopAt) {
        const step = Math.min(dist - stopAt, (chase ? FOE_SPEED : 1.2) * delta);
        const nx = m.position.x + (dx / dist) * step;
        const nz = m.position.z + (dz / dist) * step;
        if (this.okForest(nx, nz)) { m.position.x = nx; m.position.z = nz; }
        m.rotation.y = Math.atan2(dx, dz);
      }
      f.bob += delta * (chase ? 12 : 4);
      m.position.y = g.getTerrainHeight(m.position.x, m.position.z) + Math.abs(Math.sin(f.bob)) * 0.25;
      m.scale.setScalar(1 + (chase ? Math.sin(t * 10) * 0.05 : 0));
      if (chase && d < 1.6 && f.attackCd <= 0) {
        f.attackCd = 1.4;
        if (g.damagePlayer(FOE_DAMAGE)) g.fx.burst(pp.clone().setY(pp.y + 1), [new THREE.Color(1.6, 0.5, 2.4)], 10, { speed: 2, up: 1, size: 0.3 });
      }
    });
  }

  // Spells and arrows; returns true if a foe was hit
  hitFoes(pos, radius, dmg) {
    const g = this.game;
    let hit = false;
    this.foes.forEach(f => {
      if (!f.alive || !f.mesh.visible) return;
      const c = f.mesh.position.clone().setY(f.mesh.position.y + 0.6);
      if (c.distanceTo(pos) > radius + 0.6) return;
      hit = true;
      f.hp -= dmg;
      g.showFloatingText(`-${dmg}`, c, '#e0aaff');
      sfx.hit();
      if (f.hp <= 0) {
        f.alive = false;
        f.deadAt = g.clock.elapsedTime;
        f.mesh.visible = false;
        g.fx.burst(c, [new THREE.Color(1.6, 0.5, 2.4), new THREE.Color(2.4, 1.6, 2.6)], 34, { speed: 4, up: 2, size: 0.4 });
        g.fx.ringWave(c.clone().setY(c.y - 0.5), new THREE.Color(1.2, 0.4, 2.0), 3, 0.5);
        g.showFloatingText('🌿 Dornwichtel verscheucht!', c, '#c77dff');
        g.progression.addXp(15, 'Dornwichtel');
        g.inventory.addCoins(2);
        g.dropLoot(c, { dust: 0.9, heart: 0.3 });
      }
    });
    return hit;
  }

  petrify(duration) {
    const pp = this.game.playerGroup.position;
    this.foes.forEach(f => { if (f.alive && f.mesh.position.distanceTo(pp) < 22) f.pet = duration; });
  }

  // ---------- Interact key: pet the nearest animal ----------
  getInteraction() {
    const pp = this.game.playerGroup.position;
    let best = null;
    let bd = PET_RANGE;
    this.animals.forEach(a => {
      if (!a.mesh.visible) return;
      const d = Math.hypot(pp.x - a.mesh.position.x, pp.z - a.mesh.position.z);
      if (d < bd) { bd = d; best = a; }
    });
    return best ? { dist: bd + 0.6, label: `💗 ${best.def.name} streicheln`, action: () => this.pet(best) } : null;
  }

  update(delta) {
    const g = this.game;
    const t = g.clock.elapsedTime;
    const inForest = inForestArea(g.camera.position.x);
    this.updateAnimals(delta, t, inForest);
    this.updateFoes(delta, t, inForest);
  }
}
