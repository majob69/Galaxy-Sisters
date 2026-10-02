// Creatures, insects and ambient world animation (plus flyer collision). Methods are mixed into the game class (see main.js), so `this` is the game.
import * as THREE from 'three';
import { waterQuery, WATERFALL } from '../landscape.js';
import { bridgeDeckY } from '../bridges.js';
import { addAnimeFace, blinkFace } from '../characters.js';
import { sfx } from './shared.js';

export const creatureMethods = {

  // ==========================================
  // 4.12 CREATURES & SLIMES
  // ==========================================
  spawnCuteCreatures() {
    const starletColors = [0xffc6d3, 0xbfe3ff, 0xd9c6ff, 0xc6f5d0];
    const irisColors = [0xff6fa3, 0x4f8cff, 0x9b6cff, 0x2fbf71];
    const tipMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.9, 0.6) });
    this.creatureFaces = [];
    for (let i = 0; i < 4; i++) {
      const creature = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({ color: starletColors[i], emissive: new THREE.Color(starletColors[i]).multiplyScalar(0.25) });
      bodyMat.userData.noNightGlow = true;
      // Star-drop body: round belly with a curled tip
      const body = new THREE.Group();
      body.position.y = 0.5;
      creature.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.5, 20, 16), bodyMat);
      belly.castShadow = true;
      body.add(belly);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 16), bodyMat);
      tip.position.set(0, 0.52, -0.04);
      tip.rotation.x = -0.25;
      body.add(tip);
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), tipMat);
      star.position.set(0, 0.84, -0.12);
      body.add(star);
      [-1, 1].forEach(side => {
        const arm = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), bodyMat);
        arm.position.set(side * 0.45, -0.1, 0.12);
        arm.scale.set(0.8, 1.2, 0.8);
        body.add(arm);
      });
      const face = addAnimeFace(body, { center: new THREE.Vector3(0, 0, 0), radius: 0.5, spread: 0.36, eyeSize: 0.13, iris: irisColors[i] });
      this.creatureFaces.push(face);

      const spots = [{ x: 3, z: 12 }, { x: -3, z: 13 }, { x: 6.5, z: 8.5 }, { x: -5.5, z: 15.5 }];
      const cx = spots[i].x;
      const cz = spots[i].z;
      const cy = this.getTerrainHeight(cx, cz);
      creature.position.set(cx, cy, cz);
      creature.userData = { initialY: cy, hopOffset: Math.random() * 5, body, star };
      this.creatures.push(creature);
      this.scene.add(creature);
    }
  },


  // Slime packs around the valley (positions come from the seeded RNG, so every player has the same ones)
  spawnMinorSlimes() {
    const packs = [
      { x: 10, z: -2, n: 3, line: true },
      { x: -32, z: -30, n: 4 },
      { x: 48, z: -42, n: 4 },
      { x: -58, z: 22, n: 3 },
      { x: 18, z: 62, n: 4 },
      { x: -22, z: 58, n: 3 }
    ];
    const spots = [];
    packs.forEach(pack => {
      for (let i = 0; i < pack.n; i++) {
        let sx = pack.x + i * 5;
        let sz = pack.z - i * 4;
        if (!pack.line) {
          for (let tries = 0; tries < 14; tries++) {
            const ang = Math.random() * Math.PI * 2;
            const r = 1.5 + Math.random() * 4.5;
            sx = pack.x + Math.cos(ang) * r;
            sz = pack.z + Math.sin(ang) * r;
            const sy0 = this.getTerrainHeight(sx, sz);
            if (!this.isNearWater(sx, sz, 1.5) && !this.checkWallCollision(sx, sz, 0.9, sy0)) break;
          }
        }
        spots.push({ x: sx, z: sz });
      }
    });

    spots.forEach(spot => {
      const slime = new THREE.Group();
      const slimeMat = new THREE.MeshLambertMaterial({ color: 0x80ed99, transparent: true, opacity: 0.85 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), slimeMat);
      body.position.y = 0.7;
      body.scale.set(1, 0.8, 1);
      slime.add(body);

      const shine = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 10, 8),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })
      );
      shine.position.set(-0.28, 0.42, 0.45);
      shine.scale.set(1, 0.6, 0.4);
      body.add(shine);
      // Face sits on the body surface and squishes along with it
      const slimeFace = addAnimeFace(body, { center: new THREE.Vector3(0, 0.05, 0), radius: 0.71, spread: 0.34, eyeSize: 0.15, iris: 0x1f7a3a, brows: true });
      if (!this.creatureFaces) this.creatureFaces = [];
      this.creatureFaces.push(slimeFace);

      const sx = spot.x;
      const sz = spot.z;
      const sy = this.getTerrainHeight(sx, sz);
      slime.position.set(sx, sy, sz);
      slime.userData = {
        hp: 30,
        maxHp: 30,
        basePos: slime.position.clone(),
        alive: true,
        groundY: sy
      };
      this.slimes.push(slime);
      this.scene.add(slime);
    });
  },


  // ==========================================
  // 4.14 BEES & BUTTERFLIES
  // ==========================================
  spawnBees(count = 22) {
    this.bees = [];

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffbe0b';
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(16, 0, 12, 64);
    ctx.fillRect(38, 0, 12, 64);
    const beeTex = new THREE.CanvasTexture(canvas);
    const bodyMat = new THREE.MeshLambertMaterial({ map: beeTex });
    const blackMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const wingMat = new THREE.MeshBasicMaterial({
      color: 0xecfeff,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide
    });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = 0; i < count; i++) {
      const bee = new THREE.Group();

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 10), bodyMat);
      body.scale.set(1.1, 0.85, 0.85);
      bee.add(body);

      const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 8), blackMat);
      head.position.set(0.22, 0.02, 0);
      bee.add(head);

      const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.04, 5, 5), eyeMat);
      eye1.position.set(0.28, 0.07, 0.07);
      const eye2 = eye1.clone();
      eye2.position.z = -0.07;
      bee.add(eye1, eye2);

      const wingGeo = new THREE.PlaneGeometry(0.22, 0.32);
      const leftWing = new THREE.Mesh(wingGeo, wingMat);
      leftWing.position.set(0.04, 0.18, 0.12);
      leftWing.rotation.x = Math.PI / 4;
      const rightWing = new THREE.Mesh(wingGeo, wingMat);
      rightWing.position.set(0.04, 0.18, -0.12);
      rightWing.rotation.x = -Math.PI / 4;
      bee.add(leftWing, rightWing);

      const nearTemple = (i % 3 === 0);
      let cx, cz;
      if (nearTemple) {
        cx = 25 + (Math.random() - 0.5) * 18;
        cz = -22 + (Math.random() - 0.5) * 20;
      } else {
        cx = (Math.random() - 0.5) * 80;
        cz = (Math.random() - 0.5) * 80;
      }
      const cy = this.getTerrainHeight(cx, cz) + 0.9 + Math.random() * 1.8;

      const radius = 1.8 + Math.random() * 3.6;
      const speed = 0.018 + Math.random() * 0.022;
      const angle = Math.random() * Math.PI * 2;
      const heightVar = 0.35 + Math.random() * 0.45;
      const bobPhase = Math.random() * 10;

      const initX = cx + Math.cos(angle) * radius;
      const initZ = cz + Math.sin(angle) * radius;
      const initY = cy + Math.sin(bobPhase) * heightVar;
      bee.position.set(initX, initY, initZ);
      bee.rotation.y = -angle - Math.PI / 2;
      this.scene.add(bee);

      this.bees.push({
        mesh: bee,
        leftWing: leftWing,
        rightWing: rightWing,
        centerPos: new THREE.Vector3(cx, cy, cz),
        radius: radius,
        speed: speed,
        angle: angle,
        heightVar: heightVar,
        bobPhase: bobPhase
      });
    }
  },


  spawnButterflies(count = 26) {
    this.butterflies = [];
    const colors = [
      { main: 0xff70a6, spot: 0xffeef5 },
      { main: 0x00b4d8, spot: 0xe0f2fe },
      { main: 0xffe600, spot: 0xfffbeb },
      { main: 0xa855f7, spot: 0xf3e8ff },
      { main: 0xff6b6b, spot: 0xffe3e3 },
      { main: 0x2ec4b6, spot: 0xd8f3dc }
    ];
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0x22222b });

    for (let i = 0; i < count; i++) {
      const bfly = new THREE.Group();
      const colScheme = colors[i % colors.length];

      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.45, 6), bodyMat);
      body.rotation.x = Math.PI / 2;
      bfly.add(body);

      const leftWingGroup = new THREE.Group();
      const rightWingGroup = new THREE.Group();
      const wingMat = new THREE.MeshLambertMaterial({
        color: colScheme.main,
        side: THREE.DoubleSide
      });
      const spotMat = new THREE.MeshBasicMaterial({ color: colScheme.spot });

      const foreShape = new THREE.Shape();
      foreShape.moveTo(0, 0);
      foreShape.bezierCurveTo(0.3, 0.4, 0.7, 0.5, 0.75, 0.1);
      foreShape.bezierCurveTo(0.7, -0.2, 0.3, -0.2, 0, 0);
      const foreGeo = new THREE.ShapeGeometry(foreShape);

      const leftFore = new THREE.Mesh(foreGeo, wingMat);
      leftWingGroup.add(leftFore);
      const leftSpot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), spotMat);
      leftSpot.position.set(0.42, 0.15, 0.01);
      leftWingGroup.add(leftSpot);

      const rightFore = new THREE.Mesh(foreGeo, wingMat);
      rightFore.scale.x = -1;
      rightWingGroup.add(rightFore);
      const rightSpot = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), spotMat);
      rightSpot.position.set(-0.42, 0.15, 0.01);
      rightWingGroup.add(rightSpot);

      bfly.add(leftWingGroup, rightWingGroup);

      const nearTemple = (i % 4 === 0);
      let cx, cz;
      if (nearTemple) {
        cx = 25 + (Math.random() - 0.5) * 22;
        cz = -22 + (Math.random() - 0.5) * 24;
      } else {
        cx = (Math.random() - 0.5) * 90;
        cz = (Math.random() - 0.5) * 90;
      }
      const cy = this.getTerrainHeight(cx, cz) + 1.4 + Math.random() * 2.2;

      bfly.position.set(cx, cy, cz);
      this.scene.add(bfly);

      this.butterflies.push({
        mesh: bfly,
        leftWing: leftWingGroup,
        rightWing: rightWingGroup,
        basePos: new THREE.Vector3(cx, cy, cz),
        wanderRadius: 4 + Math.random() * 9,
        speed: 0.008 + Math.random() * 0.014,
        angle: Math.random() * Math.PI * 2,
        heightVar: 0.6 + Math.random() * 0.8,
        flapSpeed: 0.016 + Math.random() * 0.006,
        timeOffset: Math.random() * 20
      });
    }
  },


  // ==========================================
  // 9.4 AMBIENT ANIMATIONS & OPTIMIZED UPDATES
  // ==========================================
  updateWorldAmbience(delta) {
    const now = Date.now();
    const secTime = now * 0.001;

    // Grass GPU wind shader uniform update (ZERO matrix updates, 1 float uniform set!)
    if (this.grassMat1 && this.grassMat1.userData.shader) {
      this.grassMat1.userData.shader.uniforms.uTime.value = secTime;
    }
    if (this.grassMat2 && this.grassMat2.userData.shader) {
      this.grassMat2.userData.shader.uniforms.uTime.value = secTime;
    }

    // Drifting Sky Clouds
    for (let c = 0; c < this.clouds.length; c++) {
      const cloud = this.clouds[c];
      cloud.position.x += cloud.userData.driftSpeed;
      if (cloud.position.x > 110) cloud.position.x = -110;
    }

    // Spell effects
    this.fx.update(delta, this.camera, this.renderer);
    const shieldShader = this.shieldMesh.material.userData.shader;
    if (shieldShader) shieldShader.uniforms.uTime.value = this.clock.elapsedTime;
    if (this.shieldMesh.material.opacity > 0 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * 1.2;
      const sp = this.playerGroup.position.clone().add(new THREE.Vector3(Math.cos(a) * 1.6 * Math.cos(e), 1.5 + Math.sin(e) * 1.6, Math.sin(a) * 1.6 * Math.cos(e)));
      this.fx.emit(sp, new THREE.Vector3(-Math.sin(a) * 0.8, 0.3, Math.cos(a) * 0.8), new THREE.Color(1.0, 1.6, 2.6), { size: 0.22, life: 0.6 });
    }

    // Day/night cycle, quests and the soundscape around the player
    this.dayNight.update(delta);
    this.weather.update(delta);
    if (this.forest) this.forest.applyAtmosphere();
    this.quests.update(delta);
    this.compass.update(delta);
    const pp = this.playerGroup.position;
    const fallDx = pp.x - WATERFALL.x;
    const fallDz = pp.z - (this.waterfallLipZ + 2);
    sfx.updateAmbience({
      waterDist: waterQuery(pp.x, pp.z).dist,
      waterfallDist: Math.sqrt(fallDx * fallDx + fallDz * fallDz),
      altitude: pp.y,
      night: this.dayNight.night,
      rain: this.weather.rain,
      storm: this.weather.storm,
      swimming: this.isSwimming
    });
    this.updateDaytimeButton();

    // Flowing water, waterfall, spray and cloud sea
    const t = this.clock.elapsedTime;
    this.waterSurfaces.forEach(w => w.update(t));
    if (this.waterfall) this.waterfall.material.uniforms.uTime.value = t;
    if (this.mist) this.mist.update(delta);
    if (this.cloudSea) this.cloudSea.material.uniforms.uTime.value = t;
    this.updateSwimRipples(delta);

    // Koi circling in the pond
    this.koiFish.forEach(koi => {
      const d = koi.userData;
      const ang = d.phase + t * d.speed;
      koi.position.set(d.cx + Math.cos(ang) * d.radius, d.depth + Math.sin(t * 2 + d.phase) * 0.04, d.cz + Math.sin(ang) * d.radius);
      koi.rotation.y = -ang + (d.speed > 0 ? 0 : Math.PI);
      d.tail.rotation.y = Math.sin(t * 9 + d.phase) * 0.45;
    });

    // Floating star bridge plates bob gently
    this.starBridgePlates.forEach(plate => {
      const d = plate.userData;
      plate.position.y = d.baseY + Math.sin(t * 1.6 + d.phase) * 0.04;
      d.star.rotation.y += 0.03;
      d.star.position.y = 0.55 + Math.sin(t * 2.4 + d.phase) * 0.08;
    });

    // Temple Crystal rotation
    if (this.templeCrystal) {
      this.templeCrystal.rotation.y += 0.015;
      this.templeCrystal.rotation.x = Math.sin(now * 0.001) * 0.2;
    }

    // Trophy Star rotation
    if (this.trophyStar) {
      this.trophyStar.rotation.y += 0.02;
    }

    // Starlet Creatures bouncing with squash & stretch, turning towards the player
    const pp0 = this.playerGroup.position;
    this.creatures.forEach((c) => {
      const hop = Math.sin(now * 0.004 + c.userData.hopOffset);
      c.position.y = c.userData.initialY + Math.abs(hop) * 0.8;
      const squash = Math.abs(hop) < 0.2 ? 0.82 + Math.abs(hop) : 1.02;
      if (c.userData.body) c.userData.body.scale.set(1 / Math.sqrt(squash), squash, 1 / Math.sqrt(squash));
      if (c.userData.star) c.userData.star.rotation.y += 0.05;
      const dx = pp0.x - c.position.x;
      const dz = pp0.z - c.position.z;
      if (dx * dx + dz * dz < 144) {
        const want = Math.atan2(dx, dz);
        let diff = want - c.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        c.rotation.y += diff * 0.08;
      }
    });
    if (this.creatureFaces) this.creatureFaces.forEach(f => blinkFace(f, secTime));
    if (this.villagerNpc && this.villagerNpc.userData.ears) {
      const u = this.villagerNpc.userData;
      const twitch = Math.sin(secTime * 7) > 0.97 ? 0.3 : 0;
      u.ears[0].rotation.z = 0.15 + twitch;
      u.ears[1].rotation.z = -0.15;
      u.tail.rotation.z = -0.5 + Math.sin(secTime * 2.2) * 0.35;
    }

    // Slimes idle squish
    this.slimes.forEach((s) => {
      if (s.userData.alive) {
        if (s.userData.petrifiedTimer > 0) {
          s.userData.petrifiedTimer -= delta;
          return;
        }
        const squish = 0.8 + Math.sin(now * 0.005) * 0.15;
        s.children[0].scale.set(1 / squish, squish, 1 / squish);
      }
    });

    this.updateRunningParticles();
    this.updateFallingPetalsInstanced();
    this.updateBees();
    this.updateButterflies();
    this.updateLavender();
  },


  updateFallingPetalsInstanced() {
    if (!this.petalsInstanced || !this.treePetalsData || this.treePetalsData.length === 0) return;
    const time = Date.now() * 0.002;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < this.treePetalsData.length; i++) {
      const p = this.treePetalsData[i];
      p.y -= p.fallSpeed;
      p.x += Math.sin(time * p.swaySpeed + p.swaySeed) * 0.016;
      p.z += Math.cos(time * p.swaySpeed * 1.3 + p.swaySeed) * 0.016;

      const groundY = this.getTerrainHeight(p.x, p.z);
      if (p.y <= groundY + 0.15) {
        const tree = this.treeCanopies[p.treeIdx];
        if (tree) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * tree.radius;
          p.x = tree.x + Math.cos(ang) * dist;
          p.z = tree.z + Math.sin(ang) * dist;
          p.y = tree.y + 0.3 + Math.random() * 1.2;
        }
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.x += p.rotX;
      dummy.rotation.y += p.rotY;
      dummy.rotation.z += p.rotZ;
      dummy.updateMatrix();
      this.petalsInstanced.setMatrixAt(i, dummy.matrix);
    }
    this.petalsInstanced.instanceMatrix.needsUpdate = true;
  },


  updateBees() {
    if (!this.bees || this.bees.length === 0) return;
    const now = Date.now();
    for (let i = 0; i < this.bees.length; i++) {
      const b = this.bees[i];
      const prevX = b.mesh.position.x;
      const prevZ = b.mesh.position.z;

      b.angle += b.speed;
      const x = b.centerPos.x + Math.cos(b.angle) * b.radius;
      const z = b.centerPos.z + Math.sin(b.angle) * b.radius;
      const bob = Math.sin(now * 0.006 + b.bobPhase) * b.heightVar;
      // Follow the ground softly (hills, banks, podium) instead of a fixed height
      const ground = this.getFlyerFloor(x, b.mesh.position.y, z);
      const targetY = Math.max(b.centerPos.y + bob, ground + 0.7 + bob * 0.5);
      const y = b.mesh.position.y + (targetY - b.mesh.position.y) * 0.12;

      b.mesh.position.set(x, y, z);
      this.constrainFlyer(b.mesh.position, 0.3, 0.25);

      // Bee head is along local +X axis: Math.atan2(-dz, dx) points head strictly into flight direction
      const dx = b.mesh.position.x - prevX;
      const dz = b.mesh.position.z - prevZ;
      if (Math.hypot(dx, dz) > 0.0001) {
        b.mesh.rotation.y = Math.atan2(-dz, dx);
      }

      const flap = Math.sin(now * 0.08 + b.bobPhase) * 0.9;
      b.leftWing.rotation.x = Math.PI / 4 + flap;
      b.rightWing.rotation.x = -Math.PI / 4 - flap;
    }
  },


  updateButterflies() {
    if (!this.butterflies || this.butterflies.length === 0) return;
    const now = Date.now();
    for (let i = 0; i < this.butterflies.length; i++) {
      const b = this.butterflies[i];
      const prevX = b.mesh.position.x;
      const prevZ = b.mesh.position.z;

      b.angle += b.speed;
      const x = b.basePos.x + Math.cos(b.angle) * b.wanderRadius + Math.sin(b.angle * 2.3) * 1.6;
      const z = b.basePos.z + Math.sin(b.angle) * b.wanderRadius + Math.cos(b.angle * 1.7) * 1.6;
      const bob = Math.sin(now * 0.003 + b.timeOffset) * b.heightVar;
      const ground = this.getFlyerFloor(x, b.mesh.position.y, z);
      const targetY = Math.max(b.basePos.y + bob, ground + 1.0 + bob * 0.5);
      const y = b.mesh.position.y + (targetY - b.mesh.position.y) * 0.1;

      b.mesh.position.set(x, y, z);
      this.constrainFlyer(b.mesh.position, 0.45, 0.45);

      // Butterfly head is along local +Z axis: Math.atan2(dx, dz) points head strictly into flight direction
      const dx = b.mesh.position.x - prevX;
      const dz = b.mesh.position.z - prevZ;
      if (Math.hypot(dx, dz) > 0.0001) {
        b.mesh.rotation.y = Math.atan2(dx, dz);
      }
      b.mesh.rotation.z = Math.sin(now * 0.004 + b.timeOffset) * 0.18;

      const flap = Math.sin(now * b.flapSpeed + b.timeOffset) * 0.85;
      b.leftWing.rotation.y = flap;
      b.rightWing.rotation.y = -flap;
    }
  },


  updateLavender() {
    if (!this.lavenderStems || this.lavenderStems.length === 0) return;
    const windTime = Date.now() * 0.0028;
    for (let i = 0; i < this.lavenderStems.length; i++) {
      const stem = this.lavenderStems[i];
      stem.rotation.z = Math.sin(windTime + stem.userData.phase) * 0.08;
      stem.rotation.x = Math.cos(windTime * 0.85 + stem.userData.phase) * 0.05;
    }
  },


  // Highest solid surface below a flyer: terrain, water, and walkable platforms/bridges it is above
  getFlyerFloor(x, y, z) {
    let floor = this.getTerrainHeight(x, z);
    const water = this.getWaterSurface(x, z);
    if (water !== null && water > floor) floor = water;
    for (let i = 0; i < this.platforms.length; i++) {
      const p = this.platforms[i];
      let inside = false;
      let top = p.topY;
      if (p.type === 'box') {
        inside = x >= p.minX && x <= p.maxX && z >= p.minZ && z <= p.maxZ;
      } else if (p.type === 'cylinder') {
        const dx = x - p.x;
        const dz = z - p.z;
        inside = dx * dx + dz * dz <= p.radius * p.radius;
      } else if (p.type === 'bridge') {
        const rx = x - p.ax;
        const rz = z - p.az;
        const along = rx * p.dirX + rz * p.dirZ;
        const side = -rx * p.dirZ + rz * p.dirX;
        inside = along >= 0 && along <= p.len && Math.abs(side) <= p.halfWidth + 0.2;
        if (inside) top = bridgeDeckY(p, along / p.len);
      }
      // Thin floating platforms & bridge decks can be passed underneath
      if (inside && y > top - 0.35 && top > floor) floor = top;
    }
    return floor;
  },


  // Keeps bees, butterflies & fireflies out of walls, columns, trunks, ground, water and platforms
  constrainFlyer(pos, clearance = 0.35, radius = 0.3) {
    // Two passes so a push out of one obstacle cannot leave the flyer inside a neighbour
    for (let pass = 0; pass < 2; pass++) this.pushFlyerOutOfColliders(pos, clearance, radius);
    const floor = this.getFlyerFloor(pos.x, pos.y, pos.z) + clearance;
    if (pos.y < floor) pos.y = floor;
    return pos;
  },


  pushFlyerOutOfColliders(pos, clearance, radius) {
    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (pos.y < c.minY - 0.2 || pos.y > c.maxY + 0.2) continue;
      if (c.type === 'cylinder') {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const min = c.radius + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2) || 0.001;
          pos.x = c.x + (dx / d) * min;
          pos.z = c.z + (dz / d) * min;
        }
      } else if (
        pos.x > c.minX - radius && pos.x < c.maxX + radius &&
        pos.z > c.minZ - radius && pos.z < c.maxZ + radius
      ) {
        // Push out through the closest face (or over the top when that is closer)
        const pushes = [
          [c.minX - radius - pos.x, 0, 0],
          [c.maxX + radius - pos.x, 0, 0],
          [0, 0, c.minZ - radius - pos.z],
          [0, 0, c.maxZ + radius - pos.z],
          [0, c.maxY + clearance - pos.y, 0]
        ];
        let best = pushes[0];
        let bestLen = Infinity;
        pushes.forEach(pv => {
          const len = Math.abs(pv[0]) + Math.abs(pv[1]) + Math.abs(pv[2]);
          if (len < bestLen) { bestLen = len; best = pv; }
        });
        pos.x += best[0];
        pos.y += best[1];
        pos.z += best[2];
      }
    }
  }
};
