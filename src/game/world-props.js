// Foliage, grass, flowers, village, temple and obby parkour. Methods are mixed into the game class (see main.js), so `this` is the game.
import * as THREE from 'three';
import { bakeStaticGroup } from '../bake.js';
import { addAnimeFace } from '../characters.js';
import { snowAt } from '../biome.js';

export const worldPropsMethods = {

  // Brown bark with darker grooves and a few knots
  createBarkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#7a5235';
    ctx.fillRect(0, 0, 128, 256);
    for (let i = 0; i < 46; i++) {
      ctx.strokeStyle = i % 3 === 0 ? '#5a3a24' : (i % 3 === 1 ? '#8d6443' : '#4a2f1c');
      ctx.lineWidth = 1 + Math.random() * 3;
      ctx.beginPath();
      const x = Math.random() * 128;
      ctx.moveTo(x, 0);
      ctx.bezierCurveTo(x + (Math.random() - 0.5) * 12, 90, x + (Math.random() - 0.5) * 12, 170, x + (Math.random() - 0.5) * 10, 256);
      ctx.stroke();
    }
    for (let k = 0; k < 4; k++) {
      ctx.fillStyle = '#4a2f1c';
      ctx.beginPath();
      ctx.ellipse(Math.random() * 128, Math.random() * 256, 5 + Math.random() * 4, 8 + Math.random() * 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 2);
    return tex;
  },

  // Real-life trees: leafy broadleaf trees (some of them apple trees) and firs
  buildFoliage() {
    const bark = new THREE.MeshLambertMaterial({ map: this.createBarkTexture(), flatShading: true });
    const leafMats = [0x4e9a3a, 0x5fae45, 0x3f8a33, 0x6bb84c, 0x55a03e].map(c => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
    const firMats = [0x2f6b3a, 0x3a7d44, 0x2a5f33].map(c => new THREE.MeshLambertMaterial({ color: c, flatShading: true }));
    const forest = new THREE.Group();

    this.treeCanopies = [];
    this.appleTrees = [];
    const appleSpots = [];

    for (let i = 0; i < 42; i++) {
      const x = (Math.random() - 0.5) * 88;
      const z = (Math.random() - 0.5) * 88;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      if (x > 15 && z > 15) continue; // boss arena
      if (x >= 10 && x <= 34 && z >= -36 && z <= 2) continue; // Celestial Temple area
      if (x >= -19 && x <= -9 && z >= -13 && z <= -3) continue; // Village hut area
      if (this.isNearWater(x, z, 2.6) || this.isOnBridge(x, z, 1.8)) continue; // river, pond & bridges
      if (this.getTerrainSlope(x, z) > 0.3) continue; // no trees on cliffs
      if (this.treeCanopies.some(t => (t.x - x) ** 2 + (t.z - z) ** 2 < 4.8 * 4.8)) continue; // keep trunks apart

      const treeGroup = new THREE.Group();
      const isFir = i % 4 === 1;
      const isApple = !isFir && i % 3 === 0;
      const ty = this.getTerrainHeight(x, z);
      let trunkHeight;
      let trunkBottomRadius;
      let crownY;
      let crownRadius;

      if (isFir) {
        trunkHeight = 2.4 + Math.random() * 0.6;
        trunkBottomRadius = 0.42;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, trunkBottomRadius, trunkHeight, 7), bark);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        treeGroup.add(trunk);
        const tiers = 4;
        const baseR = 2.7 + Math.random() * 0.5;
        for (let t = 0; t < tiers; t++) {
          const r = baseR * (1 - t * 0.22);
          const h = 2.6 - t * 0.25;
          const cone = new THREE.Mesh(new THREE.ConeGeometry(r, h, 8), firMats[(i + t) % firMats.length]);
          cone.position.y = trunkHeight + 0.6 + t * 1.45;
          cone.rotation.y = Math.random() * Math.PI;
          cone.castShadow = true;
          treeGroup.add(cone);
        }
        crownY = trunkHeight + 3;
        crownRadius = baseR;
      } else {
        trunkHeight = 3.8 + Math.random() * 1.4;
        trunkBottomRadius = 0.48 + Math.random() * 0.1;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, trunkBottomRadius, trunkHeight, 8), bark);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        treeGroup.add(trunk);
        // two branches reaching into the crown
        [-1, 1].forEach(side => {
          const br = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.18, 2.0, 6), bark);
          br.position.set(side * 0.55, trunkHeight * 0.78, 0.1 * side);
          br.rotation.z = -side * 0.75;
          treeGroup.add(br);
        });
        crownRadius = 2.6 + Math.random() * 0.6;
        crownY = trunkHeight + 1.2;
        const crown = new THREE.Group();
        crown.position.y = crownY;
        treeGroup.add(crown);
        const clusters = 7;
        for (let p = 0; p < clusters; p++) {
          const ang = (p / clusters) * Math.PI * 2 + Math.random() * 0.5;
          const ring = p === 0 ? 0 : crownRadius * (0.45 + Math.random() * 0.2);
          const r = crownRadius * (p === 0 ? 0.85 : 0.55 + Math.random() * 0.15);
          const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), leafMats[(i + p) % leafMats.length]);
          leaf.position.set(Math.cos(ang) * ring, p === 0 ? 0.2 : (Math.random() - 0.3) * crownRadius * 0.6, Math.sin(ang) * ring);
          leaf.scale.y = 0.85;
          leaf.castShadow = true;
          crown.add(leaf);
        }
        if (isApple) {
          const tree = { x, z, apples: [] };
          for (let k = 0; k < 8; k++) {
            const u = (k / 8) * Math.PI * 2 + Math.random() * 0.4;
            const v = -0.25 + Math.random() * 0.75;
            const rr = crownRadius * 0.98;
            const pos = new THREE.Vector3(
              x + Math.cos(u) * Math.cos(v) * rr,
              ty + crownY + Math.sin(v) * rr * 0.8,
              z + Math.sin(u) * Math.cos(v) * rr
            );
            tree.apples.push({ pos, ripe: Math.random() < 0.75, timer: 30 + Math.random() * 120, index: appleSpots.length });
            appleSpots.push(pos);
          }
          this.appleTrees.push(tree);
        }
      }

      treeGroup.position.set(x, ty, z);
      treeGroup.rotation.y = Math.random() * Math.PI * 2;
      forest.add(treeGroup);

      this.colliders.push({
        type: 'cylinder',
        x: x,
        z: z,
        radius: trunkBottomRadius * 0.95,
        minY: ty,
        maxY: ty + trunkHeight
      });

      this.treeCanopies.push({
        x: x,
        z: z,
        y: ty + crownY + 0.8,
        radius: crownRadius + 1.0,
        fir: isFir
      });
    }

    // All trees merged into a handful of draw calls
    this.scene.add(bakeStaticGroup(forest));

    // Apples: one instanced mesh; picked apples shrink to nothing until they regrow
    if (appleSpots.length) {
      const appleMat = new THREE.MeshLambertMaterial({ color: 0xd62828, emissive: 0x3a0606 });
      this.appleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.24, 10, 8), appleMat, appleSpots.length);
      this.appleMesh.castShadow = true;
      this.appleDummy = new THREE.Object3D();
      this.appleTrees.forEach(t => t.apples.forEach(a => this.setAppleVisible(a, a.ripe)));
      this.scene.add(this.appleMesh);
    }

    this.createFallingTreePetals();
  },

  setAppleVisible(apple, on) {
    const d = this.appleDummy;
    d.position.copy(apple.pos);
    d.scale.setScalar(on ? 1 : 0.0001);
    d.updateMatrix();
    this.appleMesh.setMatrixAt(apple.index, d.matrix);
    this.appleMesh.instanceMatrix.needsUpdate = true;
  },

  // Ripe apples regrow a while after they were picked
  updateApples(delta) {
    if (!this.appleTrees) return;
    this.appleTrees.forEach(t => t.apples.forEach(a => {
      if (a.ripe) return;
      a.timer -= delta;
      if (a.timer <= 0) {
        a.ripe = true;
        this.setAppleVisible(a, true);
      }
    }));
  },

  // Nearest apple tree with ripe apples (for the interact key)
  nearestAppleTree(maxDist = 3.6) {
    if (!this.appleTrees) return null;
    const p = this.playerGroup.position;
    let best = null;
    let bd = maxDist;
    this.appleTrees.forEach(t => {
      const d = Math.hypot(t.x - p.x, t.z - p.z);
      if (d < bd && t.apples.some(a => a.ripe)) { bd = d; best = t; }
    });
    return best ? { tree: best, dist: bd } : null;
  },

  pickApple(tree) {
    const apple = tree.apples.find(a => a.ripe);
    if (!apple) return false;
    apple.ripe = false;
    apple.timer = 90 + Math.random() * 90;
    this.setAppleVisible(apple, false);
    this.fx.burst(apple.pos.clone(), [new THREE.Color(2.2, 0.5, 0.4), new THREE.Color(0.8, 1.8, 0.6)], 10, { speed: 1.5, up: 0.5, size: 0.25, gravity: 3 });
    this.inventory.add('apple', 1);
    return true;
  },


  // ==========================================
  // 4.6 HIGH-PERFORMANCE INSTANCED GRASS BLADES
  // 2,500 blades rendered in 2 draw calls with GPU vertex shader wind!
  // ==========================================
  buildInstancedGrass() {
    // Tuft of 5 slim, tapered, slightly curved blades with a dark-to-light gradient
    const tuftGeo = new THREE.BufferGeometry();
    const pos = [];
    const col = [];
    const nrm = [];
    const cBase = new THREE.Color(0x2f7a34);
    const cMid = new THREE.Color(0x62b94a);
    const cTip = new THREE.Color(0xd4f7a0);
    const gradient = (t) => (t < 0.5 ? cBase.clone().lerp(cMid, t * 2) : cMid.clone().lerp(cTip, (t - 0.5) * 2));
    for (let b = 0; b < 5; b++) {
      const face = (b / 5) * Math.PI + (b % 2) * 0.4;
      const fx = Math.cos(face);
      const fz = Math.sin(face);
      const lean = face + Math.PI / 2;
      const lx = Math.cos(lean);
      const lz = Math.sin(lean);
      const h = 0.5 + (b % 3) * 0.13;
      const w = 0.075 - (b % 2) * 0.012;
      const ox = Math.cos(b * 2.4) * 0.1;
      const oz = Math.sin(b * 2.4) * 0.1;
      const bend = 0.12 + (b % 3) * 0.05;
      const seg = 3;
      const pt = (t, side) => {
        const hw = w * Math.pow(1 - t, 0.85) * side;
        return [ox + lx * bend * t * t + fx * hw, h * t, oz + lz * bend * t * t + fz * hw];
      };
      for (let k = 0; k < seg; k++) {
        const t0 = k / seg;
        const t1 = (k + 1) / seg;
        const quad = [[t0, -1], [t0, 1], [t1, 1], [t0, -1], [t1, 1], [t1, -1]];
        quad.forEach(([t, side]) => {
          pos.push(...pt(t, side));
          const c = gradient(t);
          col.push(c.r, c.g, c.b);
          nrm.push(0, 1, 0);
        });
      }
    }
    tuftGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    tuftGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    tuftGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));

    const createGrassShaderMat = (colorHex) => {
      const mat = new THREE.MeshLambertMaterial({
        color: colorHex,
        vertexColors: true,
        side: THREE.DoubleSide
      });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = { value: 0 };
        mat.userData.shader = shader;
        shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float sway = sin(uTime * 2.4 + transformed.y * 3.5 + instanceMatrix[3][0] * 0.4 + instanceMatrix[3][2] * 0.4) * (transformed.y * 0.16);
          transformed.x += sway;
          transformed.z += sway * 0.6;
          `
        );
      };
      return mat;
    };

    const countPerBatch = 1250;
    // Batch tints on top of the per-vertex gradient
    this.grassMat1 = createGrassShaderMat(0xffffff);
    this.grassMat2 = createGrassShaderMat(0xd6efc0);

    const inst1 = new THREE.InstancedMesh(tuftGeo, this.grassMat1, countPerBatch);
    const inst2 = new THREE.InstancedMesh(tuftGeo, this.grassMat2, countPerBatch);
    inst1.receiveShadow = true;
    inst2.receiveShadow = true;

    const dummy = new THREE.Object3D();
    const batches = [inst1, inst2];

    for (let b = 0; b < 2; b++) {
      const instMesh = batches[b];
      let placed = 0;
      let attempts = 0;
      while (placed < countPerBatch && attempts < 4000) {
        attempts++;
        const x = (Math.random() - 0.5) * 115;
        const z = (Math.random() - 0.5) * 115;
        if (Math.abs(x) < 4.5 && Math.abs(z) < 4.5) continue;
        if (x > 14 && z > 14) continue; // boss arena
        if (x >= 11 && x <= 33 && z >= -35 && z <= 0.5) continue; // temple
        if (x >= -18 && x <= -10 && z >= -12 && z <= -4) continue; // hut
        if (this.isNearWater(x, z, 0.25) || this.isOnBridge(x, z, 0.2)) continue; // water & bridges
        if (snowAt(x, z) > 0.4) continue; // snow biome
        if (this.getTerrainSlope(x, z) > 0.3 || this.getTerrainHeight(x, z) > 12) continue; // rocky slopes

        const y = this.getTerrainHeight(x, z);
        const scaleY = 0.75 + Math.random() * 0.55;
        dummy.position.set(x, y, z);
        dummy.rotation.y = Math.random() * Math.PI;
        dummy.scale.set(1.0, scaleY, 1.0);
        dummy.updateMatrix();
        instMesh.setMatrixAt(placed, dummy.matrix);
        placed++;
      }
      instMesh.instanceMatrix.needsUpdate = true;
      this.scene.add(instMesh);
    }
  },


  // ==========================================
  // 4.7 INSTANCED WILDFLOWERS
  // 320 vibrant wildflowers rendered in just 3 draw calls!
  // ==========================================
  buildInstancedFlowers() {
    const flowerCount = 320;
    const stemGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.24, 5);
    const headGeo = new THREE.SphereGeometry(0.13, 6, 6);
    const centerGeo = new THREE.SphereGeometry(0.09, 6, 6);

    const stemMat = new THREE.MeshLambertMaterial({ color: 0x388e3c });
    const petalMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const centerMat = new THREE.MeshLambertMaterial({ color: 0xffe600 });

    const stemInst = new THREE.InstancedMesh(stemGeo, stemMat, flowerCount);
    const petalInst = new THREE.InstancedMesh(headGeo, petalMat, flowerCount);
    const centerInst = new THREE.InstancedMesh(centerGeo, centerMat, flowerCount);

    const flowerPetalColors = [
      new THREE.Color(0xff4d6d), new THREE.Color(0xff70a6), new THREE.Color(0x3a86ff),
      new THREE.Color(0xa855f7), new THREE.Color(0xff99c8), new THREE.Color(0x06b6d4),
      new THREE.Color(0xffb703), new THREE.Color(0xf72585), new THREE.Color(0x4cc9f0),
      new THREE.Color(0xffffff), new THREE.Color(0xe0aaff), new THREE.Color(0xff5400)
    ];

    const dummy = new THREE.Object3D();
    let placed = 0;
    let attempts = 0;

    while (placed < flowerCount && attempts < 2500) {
      attempts++;
      const fx = (Math.random() - 0.5) * 110;
      const fz = (Math.random() - 0.5) * 110;
      if (Math.abs(fx) < 4.5 && Math.abs(fz) < 4.5) continue;
      if (fx > 15 && fz > 15) continue;
      if (fx >= 11 && fx <= 33 && fz >= -35 && fz <= 0.5) continue;
      if (fx >= -18 && fx <= -10 && fz >= -12 && fz <= -4) continue;
      if (this.isNearWater(fx, fz, 0.4) || this.isOnBridge(fx, fz, 0.2)) continue;
      if (snowAt(fx, fz) > 0.4) continue;
      if (this.getTerrainSlope(fx, fz) > 0.3 || this.getTerrainHeight(fx, fz) > 12) continue;

      const fy = this.getTerrainHeight(fx, fz);

      // 1. Stem
      dummy.position.set(fx, fy + 0.12, fz);
      dummy.rotation.set(0, Math.random() * Math.PI, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stemInst.setMatrixAt(placed, dummy.matrix);

      // 2. Petal Head
      dummy.position.set(fx, fy + 0.24, fz);
      dummy.scale.set(1.5, 0.7, 1.5);
      dummy.updateMatrix();
      petalInst.setMatrixAt(placed, dummy.matrix);
      petalInst.setColorAt(placed, flowerPetalColors[placed % flowerPetalColors.length]);

      // 3. Center
      dummy.position.set(fx, fy + 0.28, fz);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      centerInst.setMatrixAt(placed, dummy.matrix);

      placed++;
    }

    stemInst.instanceMatrix.needsUpdate = true;
    petalInst.instanceMatrix.needsUpdate = true;
    if (petalInst.instanceColor) petalInst.instanceColor.needsUpdate = true;
    centerInst.instanceMatrix.needsUpdate = true;

    this.scene.add(stemInst, petalInst, centerInst);
  },


  // ==========================================
  // 4.8 BIOLUMINESCENT MUSHROOMS & CRYSTALS
  // ==========================================
  buildMushroomsAndCrystals() {
    const shroomCapMats = [
      new THREE.MeshLambertMaterial({ color: 0x06d6a0, emissive: 0x028090, emissiveIntensity: 0.6 }),
      new THREE.MeshLambertMaterial({ color: 0xff006e, emissive: 0x8338ec, emissiveIntensity: 0.55 }),
      new THREE.MeshLambertMaterial({ color: 0xffbe0b, emissive: 0xfb5607, emissiveIntensity: 0.6 })
    ];
    const shroomStalkMat = new THREE.MeshLambertMaterial({ color: 0xf8f9fa });

    const shroomClusters = [
      { x: -7.5, z: 17 }, { x: 8, z: -12 }, { x: -20, z: -15 },
      { x: 14, z: 16 }, { x: -8, z: -22 }, { x: 18, z: 5 }
    ];

    shroomClusters.forEach(sc => {
      const clusterGroup = new THREE.Group();
      const count = 3 + Math.floor(Math.random() * 3);
      for (let s = 0; s < count; s++) {
        const ox = (Math.random() - 0.5) * 1.4;
        const oz = (Math.random() - 0.5) * 1.4;
        const h = 0.35 + Math.random() * 0.4;
        const r = 0.22 + Math.random() * 0.18;

        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, h, 6), shroomStalkMat);
        stalk.position.set(ox, h / 2, oz);
        clusterGroup.add(stalk);

        const capMat = shroomCapMats[s % shroomCapMats.length];
        const cap = new THREE.Mesh(new THREE.ConeGeometry(r, 0.28, 7), capMat);
        cap.position.set(ox, h + 0.12, oz);
        clusterGroup.add(cap);

        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.position.set(ox, h + 0.24, oz + r * 0.4);
        clusterGroup.add(dot);
      }
      const cy = this.getTerrainHeight(sc.x, sc.z);
      clusterGroup.position.set(sc.x, cy, sc.z);
      this.scene.add(clusterGroup);
    });

    const crystalMatAmethyst = new THREE.MeshPhongMaterial({
      color: 0xc77dff,
      emissive: 0x7b2cbf,
      emissiveIntensity: 0.7,
      transparent: true,
      opacity: 0.9,
      shininess: 90
    });
    const crystalMatCyan = new THREE.MeshPhongMaterial({
      color: 0x48cae4,
      emissive: 0x0077b6,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.92,
      shininess: 90
    });

    const crystalLocations = [
      { x: -30, z: -25, mat: crystalMatAmethyst },
      { x: 28, z: -32, mat: crystalMatCyan },
      { x: -28, z: 26, mat: crystalMatCyan },
      { x: 38, z: 12, mat: crystalMatAmethyst }
    ];

    crystalLocations.forEach(cl => {
      const cGroup = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        const h = 1.4 + Math.random() * 1.5;
        const r = 0.25 + Math.random() * 0.2;
        const shard = new THREE.Mesh(new THREE.ConeGeometry(r, h, 6), cl.mat);
        shard.position.set((Math.random() - 0.5) * 0.8, h / 2, (Math.random() - 0.5) * 0.8);
        shard.rotation.set((Math.random() - 0.5) * 0.35, Math.random() * Math.PI, (Math.random() - 0.5) * 0.35);
        cGroup.add(shard);
      }
      const cy = this.getTerrainHeight(cl.x, cl.z);
      cGroup.position.set(cl.x, cy, cl.z);
      this.scene.add(cGroup);
    });
  },


  // ==========================================
  // 4.5 INSTANCED FALLING SAKURA & PURPLE PETALS
  // 400 petals rendered in 1 single draw call!
  // ==========================================
  createFallingTreePetals() {
    this.treePetalsData = [];
    if (!this.treeCanopies || this.treeCanopies.length === 0) return;

    const count = 160;
    const petalGeo = new THREE.PlaneGeometry(0.24, 0.3);
    const petalMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });

    this.petalsInstanced = new THREE.InstancedMesh(petalGeo, petalMat, count);
    const dummy = new THREE.Object3D();

    const petalColors = [
      new THREE.Color(0x6bb84c), new THREE.Color(0x8cc63f),
      new THREE.Color(0xc9b037), new THREE.Color(0xd98c32),
      new THREE.Color(0x5fae45), new THREE.Color(0xa7c957)
    ];

    for (let i = 0; i < count; i++) {
      const tree = this.treeCanopies[i % this.treeCanopies.length];
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * tree.radius;
      const px = tree.x + Math.cos(ang) * dist;
      const pz = tree.z + Math.sin(ang) * dist;
      const groundY = this.getTerrainHeight(px, pz);
      const py = groundY + 0.3 + Math.random() * (tree.y - groundY + 1.2);

      dummy.position.set(px, py, pz);
      dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      dummy.updateMatrix();
      this.petalsInstanced.setMatrixAt(i, dummy.matrix);
      this.petalsInstanced.setColorAt(i, petalColors[i % petalColors.length]);

      this.treePetalsData.push({
        x: px,
        y: py,
        z: pz,
        fallSpeed: 0.018 + Math.random() * 0.024,
        swaySeed: Math.random() * 100,
        swaySpeed: 0.8 + Math.random() * 0.9,
        rotX: (Math.random() - 0.5) * 0.04,
        rotY: (Math.random() - 0.5) * 0.05,
        rotZ: (Math.random() - 0.5) * 0.04,
        treeIdx: i % this.treeCanopies.length
      });
    }

    this.petalsInstanced.instanceMatrix.needsUpdate = true;
    if (this.petalsInstanced.instanceColor) this.petalsInstanced.instanceColor.needsUpdate = true;
    this.scene.add(this.petalsInstanced);
  },


  // ==========================================
  // 4.9 COZY WOODEN VILLAGE HUT WITH FENCE & LANTERN
  // ==========================================
  buildVillageHut(pos) {
    const hutGroup = new THREE.Group();
    hutGroup.position.copy(pos);

    // Wooden base
    const baseMat = new THREE.MeshLambertMaterial({ color: 0xa06535, flatShading: true });
    const base = new THREE.Mesh(new THREE.BoxGeometry(5, 3.5, 4.5), baseMat);
    base.position.y = 1.75;
    base.castShadow = true;
    base.receiveShadow = true;
    hutGroup.add(base);

    // Kawaii Red Roof
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xe63946, flatShading: true });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.8, 4), roofMat);
    roof.position.y = 4.6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    hutGroup.add(roof);

    // Wooden Door
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x4a2810 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.2), doorMat);
    door.position.set(0, 1, 2.3);
    hutGroup.add(door);

    // Chimney with smoke
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 6), new THREE.MeshLambertMaterial({ color: 0x6c757d }));
    chimney.position.set(1.5, 4.8, 0.5);
    hutGroup.add(chimney);

    // Cozy Wooden Picket Fence around garden
    const fenceMat = new THREE.MeshLambertMaterial({ color: 0xc49a6c });
    const fencePickets = [
      { x: -3.8, z: 2.8, len: 3.2, rot: 0 },
      { x: 3.8, z: 2.8, len: 3.2, rot: 0 },
      { x: -4.8, z: 0.5, len: 4.8, rot: Math.PI / 2 },
      { x: 4.8, z: 0.5, len: 4.8, rot: Math.PI / 2 }
    ];
    fencePickets.forEach(fp => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(fp.len, 0.12, 0.1), fenceMat);
      rail.position.set(fp.x, 0.8, fp.z);
      rail.rotation.y = fp.rot;
      hutGroup.add(rail);

      const rail2 = rail.clone();
      rail2.position.y = 0.35;
      hutGroup.add(rail2);

      const count = Math.floor(fp.len / 0.6);
      for (let p = 0; p <= count; p++) {
        const picket = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.08), fenceMat);
        const t = (p / count) - 0.5;
        picket.position.set(
          fp.x + (fp.rot === 0 ? t * fp.len : 0),
          0.55,
          fp.z + (fp.rot !== 0 ? t * fp.len : 0)
        );
        hutGroup.add(picket);
      }
    });

    // Rustic Lantern Post with warm glowing lantern!
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a3e1b });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 2.6, 6), postMat);
    post.position.set(2.4, 1.3, 3.8);
    hutGroup.add(post);

    const lanternArm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.08, 0.08), postMat);
    lanternArm.position.set(2.6, 2.5, 3.8);
    hutGroup.add(lanternArm);

    const lantern = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.24, 0),
      new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0xffaa00,
        emissiveIntensity: 0.95
      })
    );
    lantern.position.set(2.85, 2.3, 3.8);
    lantern.material.userData.lantern = true;
    hutGroup.add(lantern);

    const lanternLight = new THREE.PointLight(0xffbe0b, 1.4, 12);
    lanternLight.position.set(2.85, 2.3, 3.8);
    lanternLight.userData.lantern = true;
    hutGroup.add(lanternLight);

    // Cozy Sitting Bench under the eaves
    const bench = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.65), fenceMat);
    bench.position.set(-2.2, 0.45, 2.6);
    hutGroup.add(bench);
    const benchLeg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.45, 0.55), fenceMat);
    benchLeg1.position.set(-3.0, 0.22, 2.6);
    const benchLeg2 = benchLeg1.clone();
    benchLeg2.position.x = -1.4;
    hutGroup.add(benchLeg1, benchLeg2);

    // Villager NPC standing next to hut
    const npc = this.createKawaiiVillager();
    this.villagerNpc = npc;
    npc.position.set(pos.x + 3.2, 0, pos.z + 2.5);
    this.scene.add(npc);

    this.scene.add(hutGroup);

    // Register wooden hut as solid obstacle box
    this.colliders.push({
      type: 'box',
      minX: pos.x - 2.8,
      maxX: pos.x + 2.8,
      minZ: pos.z - 2.6,
      maxZ: pos.z + 2.6,
      minY: pos.y,
      maxY: pos.y + 4.8
    });
  },


  createKawaiiVillager() {
    const npcGroup = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffccd5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), bodyMat);
    body.position.y = 0.8;
    npcGroup.add(body);

    const earMat = new THREE.MeshLambertMaterial({ color: 0xff758f });
    const ear1 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 5), earMat);
    ear1.position.set(-0.4, 1.5, 0);
    const ear2 = ear1.clone();
    ear2.position.x = 0.4;
    npcGroup.add(ear1, ear2);

    const face = addAnimeFace(npcGroup, { center: new THREE.Vector3(0, 0.8, 0), radius: 0.8, spread: 0.33, eyeSize: 0.2, iris: 0x2bb3a3 });
    if (!this.creatureFaces) this.creatureFaces = [];
    this.creatureFaces.push(face);
    const whiskerMat = new THREE.MeshBasicMaterial({ color: 0x8a5a66 });
    [-1, 1].forEach(side => {
      for (let w = 0; w < 2; w++) {
        const whisker = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.02, 0.02), whiskerMat);
        whisker.position.set(side * 0.5, 0.66 + w * 0.08, 0.62);
        whisker.rotation.set(0, side * -0.5, side * (w ? 0.15 : -0.1));
        npcGroup.add(whisker);
      }
    });
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.8, 4, 8), earMat);
    tail.position.set(0.35, 0.7, -0.75);
    tail.rotation.set(0.9, 0, -0.5);
    npcGroup.add(tail);
    npcGroup.userData = { ears: [ear1, ear2], tail };

    const bubble = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.08, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    bubble.position.set(0, 2.2, 0);
    npcGroup.add(bubble);

    return npcGroup;
  },


  createFlowerOfLifeTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const cx = 512;
    const cy = 512;

    const bgGrad = ctx.createRadialGradient(cx, cy, 40, cx, cy, 512);
    bgGrad.addColorStop(0, '#2b1049');
    bgGrad.addColorStop(0.6, '#1a082e');
    bgGrad.addColorStop(1, '#0e0419');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    ctx.strokeStyle = 'rgba(216, 180, 254, 0.09)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 16; i++) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 1024, Math.random() * 1024);
      ctx.bezierCurveTo(Math.random() * 1024, Math.random() * 1024, Math.random() * 1024, Math.random() * 1024, Math.random() * 1024, Math.random() * 1024);
      ctx.stroke();
    }

    const R = 105;
    const circleCenters = [{ x: cx, y: cy }];

    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      circleCenters.push({
        x: cx + Math.cos(ang) * R,
        y: cy + Math.sin(ang) * R
      });
    }

    for (let i = 0; i < 6; i++) {
      const ang = (i * Math.PI) / 3;
      circleCenters.push({
        x: cx + Math.cos(ang) * (2 * R),
        y: cy + Math.sin(ang) * (2 * R)
      });
      const midAng = ang + Math.PI / 6;
      const midDist = Math.sqrt(3) * R;
      circleCenters.push({
        x: cx + Math.cos(midAng) * midDist,
        y: cy + Math.sin(midAng) * midDist
      });
    }

    ctx.shadowColor = '#c77dff';
    ctx.shadowBlur = 28;

    ctx.strokeStyle = '#d8b4fe';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * R + 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = '#9d4edd';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(cx, cy, 3 * R + 22, 0, Math.PI * 2);
    ctx.stroke();

    circleCenters.forEach((pt, idx) => {
      ctx.shadowColor = idx === 0 ? '#ff70a6' : '#c77dff';
      ctx.shadowBlur = idx === 0 ? 32 : 18;
      ctx.strokeStyle = idx === 0 ? '#f3e8ff' : (idx < 7 ? '#d8b4fe' : '#c77dff');
      ctx.lineWidth = idx === 0 ? 5.5 : 4.0;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, R, 0, Math.PI * 2);
      ctx.stroke();
    });

    ctx.shadowBlur = 12;
    ctx.shadowColor = '#ff70a6';
    ctx.fillStyle = '#ffb3c6';
    circleCenters.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.fill();
    });

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  },


  createLavenderBush() {
    const bushGroup = new THREE.Group();
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x4a7c59 });
    const flowerMats = [
      new THREE.MeshLambertMaterial({ color: 0x7b2cbf }),
      new THREE.MeshLambertMaterial({ color: 0x9d4edd }),
      new THREE.MeshLambertMaterial({ color: 0x8338ec }),
      new THREE.MeshLambertMaterial({ color: 0xc77dff }),
      new THREE.MeshLambertMaterial({ color: 0x6a0dad })
    ];

    const stemCount = 14 + Math.floor(Math.random() * 6);
    for (let i = 0; i < stemCount; i++) {
      const stemGroup = new THREE.Group();
      const spreadAng = Math.random() * Math.PI * 2;
      const spreadDist = Math.random() * 0.45;
      const stemH = 1.0 + Math.random() * 0.45;

      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.028, stemH, 4),
        stemMat
      );
      stem.position.y = stemH / 2;
      stemGroup.add(stem);

      const spikeH = stemH * 0.45;
      const tipCount = 5;
      for (let t = 0; t < tipCount; t++) {
        const mat = flowerMats[(i + t) % flowerMats.length];
        const fl = new THREE.Mesh(
          new THREE.ConeGeometry(0.08 - t * 0.009, 0.12, 5),
          mat
        );
        fl.position.y = stemH - spikeH + t * (spikeH / tipCount);
        stemGroup.add(fl);
      }

      stemGroup.position.set(
        Math.cos(spreadAng) * spreadDist,
        0,
        Math.sin(spreadAng) * spreadDist
      );
      stemGroup.rotation.z = (Math.random() - 0.5) * 0.25;
      stemGroup.rotation.x = (Math.random() - 0.5) * 0.25;
      stemGroup.userData = { phase: Math.random() * 10 };

      this.lavenderStems.push(stemGroup);
      bushGroup.add(stemGroup);
    }

    return bushGroup;
  },


  // ==========================================
  // 4.10 CELESTIAL ANCIENT TEMPLE
  // ==========================================
  buildCelestialTemple(pos) {
    const templeGroup = new THREE.Group();
    templeGroup.position.copy(pos);

    const marbleMat = new THREE.MeshLambertMaterial({ color: 0xf5edf8, flatShading: true });
    const darkPodiumMat = new THREE.MeshLambertMaterial({ color: 0xded2e4, flatShading: true });
    const violetTrimMat = new THREE.MeshLambertMaterial({
      color: 0x8a2be2,
      emissive: 0x3b0b5c,
      emissiveIntensity: 0.35,
      flatShading: true
    });
    const pinkTrimMat = new THREE.MeshLambertMaterial({
      color: 0xff70a6,
      emissive: 0x4a0a25,
      emissiveIntensity: 0.3,
      flatShading: true
    });
    const goldMat = new THREE.MeshLambertMaterial({
      color: 0xffd166,
      emissive: 0x473700,
      emissiveIntensity: 0.4
    });

    const podW = 18;
    const podL = 26;
    const podH = 2.2;

    const basePodium = new THREE.Mesh(
      new THREE.BoxGeometry(podW, podH, podL),
      darkPodiumMat
    );
    basePodium.position.y = podH / 2;
    basePodium.receiveShadow = true;
    basePodium.castShadow = true;
    templeGroup.add(basePodium);

    const podTrimViolet = new THREE.Mesh(
      new THREE.BoxGeometry(podW + 0.5, 0.22, podL + 0.5),
      violetTrimMat
    );
    podTrimViolet.position.y = podH;
    templeGroup.add(podTrimViolet);

    const podTrimPink = new THREE.Mesh(
      new THREE.BoxGeometry(podW + 0.3, 0.12, podL + 0.3),
      pinkTrimMat
    );
    podTrimPink.position.y = podH + 0.12;
    templeGroup.add(podTrimPink);

    // Grand Stairs (+Z front)
    const stepCount = 7;
    const stairW = 13.0;
    const stairL = 5.6;
    const stepDepth = stairL / stepCount;
    for (let s = 0; s < stepCount; s++) {
      const stepH = podH / stepCount;
      const stepY = (s + 0.5) * stepH;
      const localCenterZ = (podL / 2) + stairL - (s + 0.5) * stepDepth;
      const stepBox = new THREE.Mesh(
        new THREE.BoxGeometry(stairW, stepH, stepDepth + 0.12),
        marbleMat
      );
      stepBox.position.set(0, stepY, localCenterZ);
      stepBox.receiveShadow = true;
      templeGroup.add(stepBox);

      const worldCenterZ = pos.z + localCenterZ;
      this.platforms.push({
        type: 'box',
        minX: pos.x - stairW / 2,
        maxX: pos.x + stairW / 2,
        minZ: worldCenterZ - stepDepth * 0.55,
        maxZ: worldCenterZ + stepDepth * 0.55,
        topY: pos.y + (s + 1) * stepH
      });
    }

    // Main Podium Walkable Platform
    this.platforms.push({
      type: 'box',
      minX: pos.x - podW / 2,
      maxX: pos.x + podW / 2,
      minZ: pos.z - podL / 2,
      maxZ: pos.z + podL / 2,
      topY: pos.y + podH
    });

    // Balustrades
    const balustradeMat = new THREE.MeshLambertMaterial({ color: 0xede0f2 });
    [-stairW / 2 - 0.45, stairW / 2 + 0.45].forEach(bx => {
      const bal = new THREE.Mesh(
        new THREE.BoxGeometry(0.8, podH + 0.6, stairL + 0.8),
        balustradeMat
      );
      bal.position.set(bx, (podH + 0.6) / 2, (podL / 2) + stairL / 2);
      bal.castShadow = true;
      templeGroup.add(bal);

      const lavUrn = this.createLavenderBush();
      lavUrn.position.set(bx, podH + 1.1, (podL / 2) + stairL);
      templeGroup.add(lavUrn);
    });

    // Podium Wall Colliders
    this.colliders.push({
      type: 'box',
      minX: pos.x - podW / 2 - 0.2,
      maxX: pos.x - stairW / 2,
      minZ: pos.z - podL / 2 - 0.2,
      maxZ: pos.z + podL / 2 + 0.2,
      minY: pos.y,
      maxY: pos.y + podH - 0.05
    });
    this.colliders.push({
      type: 'box',
      minX: pos.x + stairW / 2,
      maxX: pos.x + podW / 2 + 0.2,
      minZ: pos.z - podL / 2 - 0.2,
      maxZ: pos.z + podL / 2 + 0.2,
      minY: pos.y,
      maxY: pos.y + podH - 0.05
    });
    this.colliders.push({
      type: 'box',
      minX: pos.x - stairW / 2,
      maxX: pos.x + stairW / 2,
      minZ: pos.z - podL / 2 - 0.2,
      maxZ: pos.z - podL / 2,
      minY: pos.y,
      maxY: pos.y + podH - 0.05
    });
    this.colliders.push({
      type: 'box',
      minX: pos.x - stairW / 2 - 0.9,
      maxX: pos.x - stairW / 2,
      minZ: pos.z + podL / 2 - 0.2,
      maxZ: pos.z + podL / 2 + stairL + 0.5,
      minY: pos.y,
      maxY: pos.y + podH + 1.4
    });
    this.colliders.push({
      type: 'box',
      minX: pos.x + stairW / 2,
      maxX: pos.x + stairW / 2 + 0.9,
      minZ: pos.z + podL / 2 - 0.2,
      maxZ: pos.z + podL / 2 + stairL + 0.5,
      minY: pos.y,
      maxY: pos.y + podH + 1.4
    });

    // 20 Fluted Roman Columns
    const colH = 7.4;
    const colR = 0.52;
    const colPlinthMat = new THREE.MeshLambertMaterial({ color: 0xf3e8f7 });

    const columnPositions = [];
    const colXHalf = (podW / 2) - 1.5;
    const colZHalf = (podL / 2) - 1.5;

    for (let c = 0; c < 6; c++) {
      const cx = -colXHalf + (c / 5) * (colXHalf * 2);
      columnPositions.push({ x: cx, z: colZHalf });
      columnPositions.push({ x: cx, z: -colZHalf });
    }
    for (let s = 1; s <= 4; s++) {
      const cz = -colZHalf + (s / 5) * (colZHalf * 2);
      columnPositions.push({ x: -colXHalf, z: cz });
      columnPositions.push({ x: colXHalf, z: cz });
    }

    // Parapet Walls
    const wallH = 1.6;
    const wallThick = 0.45;
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, colZHalf * 2), marbleMat);
    leftWall.position.set(-colXHalf, podH + wallH / 2, 0);
    leftWall.castShadow = true;
    templeGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallH, colZHalf * 2), marbleMat);
    rightWall.position.set(colXHalf, podH + wallH / 2, 0);
    rightWall.castShadow = true;
    templeGroup.add(rightWall);

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(colXHalf * 2, wallH, wallThick), marbleMat);
    backWall.position.set(0, podH + wallH / 2, -colZHalf);
    backWall.castShadow = true;
    templeGroup.add(backWall);

    this.colliders.push({
      type: 'box',
      minX: pos.x - colXHalf - 0.5,
      maxX: pos.x - colXHalf + 0.5,
      minZ: pos.z - colZHalf - 0.5,
      maxZ: pos.z + colZHalf + 0.5,
      minY: pos.y + podH - 0.1,
      maxY: pos.y + podH + wallH + 1.0
    });
    this.colliders.push({
      type: 'box',
      minX: pos.x + colXHalf - 0.5,
      maxX: pos.x + colXHalf + 0.5,
      minZ: pos.z - colZHalf - 0.5,
      maxZ: pos.z + colZHalf + 0.5,
      minY: pos.y + podH - 0.1,
      maxY: pos.y + podH + wallH + 1.0
    });
    this.colliders.push({
      type: 'box',
      minX: pos.x - colXHalf - 0.5,
      maxX: pos.x + colXHalf + 0.5,
      minZ: pos.z - colZHalf - 0.5,
      maxZ: pos.z - colZHalf + 0.5,
      minY: pos.y + podH - 0.1,
      maxY: pos.y + podH + wallH + 1.0
    });

    columnPositions.forEach((cp) => {
      this.colliders.push({
        type: 'cylinder',
        x: pos.x + cp.x,
        z: pos.z + cp.z,
        radius: 0.75,
        minY: pos.y,
        maxY: pos.y + podH + colH
      });

      const colGroup = new THREE.Group();
      colGroup.position.set(cp.x, podH + 0.15, cp.z);

      const plinth = new THREE.Mesh(new THREE.BoxGeometry(1.35, 0.3, 1.35), colPlinthMat);
      plinth.position.y = 0.15;
      colGroup.add(plinth);

      const torus1 = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.1, 8, 16), violetTrimMat);
      torus1.rotation.x = Math.PI / 2;
      torus1.position.y = 0.36;
      colGroup.add(torus1);

      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(colR * 0.88, colR, colH - 1.2, 16), marbleMat);
      shaft.position.y = 0.52 + (colH - 1.2) / 2;
      shaft.castShadow = true;
      colGroup.add(shaft);

      const capAbacus = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.2, 1.4), violetTrimMat);
      capAbacus.position.y = colH - 0.1;
      colGroup.add(capAbacus);

      templeGroup.add(colGroup);
    });

    // Architrave & Entablature
    const entablatureY = podH + 0.15 + colH;
    const architrave = new THREE.Mesh(new THREE.BoxGeometry(podW, 0.65, podL), marbleMat);
    architrave.position.y = entablatureY + 0.32;
    architrave.castShadow = true;
    templeGroup.add(architrave);

    const frieze = new THREE.Mesh(new THREE.BoxGeometry(podW + 0.1, 0.55, podL + 0.1), violetTrimMat);
    frieze.position.y = entablatureY + 0.85;
    templeGroup.add(frieze);

    // Pediments & Roof
    const roofY = entablatureY + 1.25;
    [colZHalf, -colZHalf].forEach((gz, gIdx) => {
      const giebGeo = new THREE.ConeGeometry(podW * 0.56, 3.2, 3);
      const giebel = new THREE.Mesh(giebGeo, marbleMat);
      giebel.position.set(0, roofY + 1.6, gz);
      giebel.rotation.y = gIdx === 0 ? 0 : Math.PI;
      giebel.scale.set(1, 1, 0.45);
      giebel.castShadow = true;
      templeGroup.add(giebel);
    });

    const roofMat = new THREE.MeshLambertMaterial({ color: 0x9b5de5, flatShading: true });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(podW * 0.58, 3.2, 4), roofMat);
    roof.position.set(0, roofY + 1.6, 0);
    roof.rotation.y = Math.PI / 4;
    roof.scale.set(1, 1, podL / podW);
    roof.castShadow = true;
    templeGroup.add(roof);

    // Center Dais: Flower of Life in Purple Marble
    const flowerOfLifeTex = this.createFlowerOfLifeTexture();
    const dais = new THREE.Mesh(new THREE.CylinderGeometry(4.4, 4.6, 0.16, 32), marbleMat);
    dais.position.set(0, podH + 0.15 + 0.08, 0);
    dais.receiveShadow = true;
    templeGroup.add(dais);

    const flowerOfLifeMesh = new THREE.Mesh(
      new THREE.CircleGeometry(4.0, 48),
      new THREE.MeshLambertMaterial({
        map: flowerOfLifeTex,
        emissive: 0x4a1572,
        emissiveIntensity: 0.8,
        side: THREE.DoubleSide
      })
    );
    flowerOfLifeMesh.rotation.x = -Math.PI / 2;
    flowerOfLifeMesh.position.set(0, podH + 0.26, 0);
    flowerOfLifeMesh.receiveShadow = true;
    templeGroup.add(flowerOfLifeMesh);

    this.platforms.push({
      type: 'cylinder',
      x: pos.x,
      z: pos.z,
      radius: 4.6,
      topY: pos.y + podH + 0.24
    });

    // Floating Crystal above Center
    const crystalGeo = new THREE.OctahedronGeometry(1.7, 0);
    const crystalMat = new THREE.MeshPhongMaterial({
      color: 0xc77dff,
      emissive: 0x9d4edd,
      emissiveIntensity: 0.85,
      transparent: true,
      opacity: 0.92,
      shininess: 100
    });
    this.templeCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    this.templeCrystal.position.set(0, podH + 4.2, 0);
    templeGroup.add(this.templeCrystal);

    const templeLight = new THREE.PointLight(0xc77dff, 1.8, 16);
    templeLight.position.set(0, podH + 4.0, 0);
    templeGroup.add(templeLight);

    // Lavender Bushes flanking temple
    const lavenderLocations = [
      { x: -stairW / 2 - 1.2, z: (podL / 2) + 2.0 },
      { x: stairW / 2 + 1.2, z: (podL / 2) + 2.0 },
      { x: -colXHalf, z: colZHalf + 1.2 },
      { x: colXHalf, z: colZHalf + 1.2 },
      { x: -colXHalf - 1.4, z: 0 },
      { x: colXHalf + 1.4, z: 0 }
    ];
    lavenderLocations.forEach(loc => {
      const lavBush = this.createLavenderBush();
      lavBush.position.set(loc.x, 0, loc.z);
      templeGroup.add(lavBush);
    });

    this.scene.add(templeGroup);
  },


  // ==========================================
  // 4.11 OBBY PARKOUR
  // ==========================================
  buildObbyParkour(startPos) {
    const platformMat = new THREE.MeshLambertMaterial({ color: 0x9b5de5 });
    const numSteps = 7;
    for (let i = 0; i < numSteps; i++) {
      const height = 1.2 + i * 1.5;
      const offset = i * 3.8;
      const platGeo = new THREE.CylinderGeometry(1.8 - i * 0.1, 1.8 - i * 0.1, 0.5, 8);
      const plat = new THREE.Mesh(platGeo, platformMat);
      plat.position.set(startPos.x + Math.sin(i * 0.7) * 4, height, startPos.z - offset);
      plat.castShadow = true;
      plat.receiveShadow = true;
      this.scene.add(plat);

      this.platforms.push({
        type: 'cylinder',
        x: plat.position.x,
        z: plat.position.z,
        topY: height + 0.25,
        radius: 1.8 - i * 0.1
      });
    }

    const finalHeight = 1.2 + numSteps * 1.5;
    const finalPlat = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.8, 12), new THREE.MeshLambertMaterial({ color: 0xffd166 }));
    finalPlat.position.set(startPos.x + Math.sin(numSteps * 0.7) * 4, finalHeight, startPos.z - numSteps * 3.8);
    this.scene.add(finalPlat);
    this.platforms.push({
      type: 'cylinder',
      x: finalPlat.position.x,
      z: finalPlat.position.z,
      topY: finalHeight + 0.4,
      radius: 3.5
    });

    const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
    star.position.set(finalPlat.position.x, finalHeight + 2.5, finalPlat.position.z);
    this.scene.add(star);
    this.trophyStar = star;
  }
};
