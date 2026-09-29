// Scene setup, terrain, water, bridges and stone paths. Methods are mixed into the game class (see main.js), so `this` is the game.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { waterQuery, simplex2, smoothstep, LAKES, RIVERS, WATER_LEVEL, SPRING_LEVEL, WATERFALL } from '../landscape.js';
import { createSkyDome, createDistantRanges, createCloudSea, PostFX, SKY_COLORS } from '../atmosphere.js';
import { WaterSurface, createWaterfall, MistParticles, createRainbow } from '../water.js';
import { buildMoonBridge, buildRomanBridge, buildRopeBridge, buildStarBridge } from '../bridges.js';
import { bakeStaticGroup } from '../bake.js';
import { MagicFX } from '../magicfx.js';
import { PERF_TIERS } from '../perf.js';

export const worldTerrainMethods = {

  initScene() {
    const container = document.getElementById('canvas-container');
    
    // Scene with soft pastel atmosphere (fog doubles as aerial perspective for distant ranges)
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLORS.horizon);
    this.scene.fog = new THREE.FogExp2(SKY_COLORS.fog, 0.0048);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 8, 14);
    // Yaw-first Euler order so camera.rotation.y is the true heading used for movement
    this.camera.rotation.order = 'YXZ';

    // Renderer (Optimized pixelRatio & PCF soft shadows)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.applyPixelRatio();
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Orbit Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05;
    this.controls.minDistance = 4.5;
    this.controls.maxDistance = 30;
    // The camera always follows the player, so panning is pointless; on touch:
    // one finger turns the view, two fingers pinch to zoom
    this.controls.enablePan = false;
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls.rotateSpeed = this.isTouch ? 0.7 : 1.0;

    // Warm Anime Fantasy Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x7289da, 0.85);
    this.scene.add(hemiLight);
    this.hemiLight = hemiLight;

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.35);
    dirLight.position.set(45, 65, 35);
    dirLight.castShadow = true;
    this.dirLight = dirLight;
    dirLight.shadow.mapSize.set(PERF_TIERS[this.perfTier].shadow, PERF_TIERS[this.perfTier].shadow);
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 220;
    const d = 55;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);
    this.sunLight = dirLight;

    // Glowing spell particles, shockwaves & flashes
    this.fx = new MagicFX(this.scene);

    // Gradient sky dome with HDR sun, distant ranges and the cloud sea around the Sky Mountains
    this.skyDome = createSkyDome(dirLight.position.clone().normalize());
    this.scene.add(this.skyDome);
    this.scene.add(createDistantRanges());
    this.cloudSea = createCloudSea();
    this.scene.add(this.cloudSea);

    // Bloom post-processing (high quality only)
    if (this.graphicsQuality === 'high') {
      this.postFX = new PostFX(this.renderer, this.scene, this.camera);
    }

    // Sky & Clouds
    this.createSkyDecorations();
  },


  createSkyDecorations() {
    // Stylized Anime Moon
    const moonGeo = new THREE.SphereGeometry(13, 24, 24);
    const moonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.25, 1.22, 1.1), fog: false });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-150, 120, -260);
    this.moonMesh = moon;
    this.scene.add(moon);

    // Floating Golden Celestial Stars
    const starGeo = new THREE.OctahedronGeometry(1.2, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.15, 0.45) });
    this.skyStarMat = starMat;
    for (let i = 0; i < 28; i++) {
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(
        (Math.random() - 0.5) * 190,
        24 + Math.random() * 32,
        (Math.random() - 0.5) * 190
      );
      this.scene.add(star);
    }

    // Fluffy 3D Anime Clouds slowly drifting across the sky
    this.clouds = [];
    const cloudMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.88,
      flatShading: true
    });

    for (let c = 0; c < 12; c++) {
      const cloudGroup = new THREE.Group();
      const puffCount = 5 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffCount; p++) {
        const radius = 2.4 + Math.random() * 2.2;
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 1), cloudMat);
        puff.position.set(
          (p - puffCount / 2) * 2.2 + (Math.random() - 0.5) * 1.0,
          (Math.random() - 0.5) * 0.8,
          (Math.random() - 0.5) * 2.0
        );
        cloudGroup.add(puff);
      }
      const cx = (Math.random() - 0.5) * 200;
      const cy = 34 + Math.random() * 18;
      const cz = (Math.random() - 0.5) * 200;
      cloudGroup.position.set(cx, cy, cz);
      cloudGroup.userData = { driftSpeed: 0.012 + Math.random() * 0.018 };
      this.scene.add(cloudGroup);
      this.clouds.push(cloudGroup);
    }
  },


  createRealisticGrassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // Rich vibrant anime grass green gradient
    const grad = ctx.createLinearGradient(0, 0, 512, 512);
    grad.addColorStop(0, '#589d44');
    grad.addColorStop(0.5, '#6ebb54');
    grad.addColorStop(1, '#4e8d3b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    // Multi-toned grass blade strokes & clover speckles
    for (let i = 0; i < 2600; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      const bladeCol = Math.random() > 0.5 ? '#7fde64' : (Math.random() > 0.5 ? '#438034' : '#92e970');
      ctx.strokeStyle = bladeCol;
      ctx.lineWidth = 1 + Math.random() * 2.2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (Math.random() - 0.5) * 8, gy - 6 - Math.random() * 8);
      ctx.stroke();
    }

    // Subtle clover and flower dots
    for (let i = 0; i < 120; i++) {
      const cx = Math.random() * 512;
      const cy = Math.random() * 512;
      ctx.fillStyle = Math.random() > 0.5 ? '#ffb3c6' : '#fff3bf';
      ctx.beginPath();
      ctx.arc(cx, cy, 1.8, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    return tex;
  },


  // ==========================================
  // 4. WORLD GENERATION
  // ==========================================
  buildWorld() {
    // 4.1 Terrain mesh: grass, sand, rock and snow blended per vertex
    this.buildTerrain();

    // 4.2 Waterfall, river, crystal pond & southern lake
    this.buildWater();

    // 4.3 Moon bridge, Roman bridge, rope bridge & star bridge
    this.buildBridges();

    // 4.4 Winding Cobblestone Pathways
    this.buildStonePaths();

    // 4.5 Enchanted Giant Trees & Foliage
    this.buildFoliage();

    // 4.6 Instanced 3D Grass Blades (GPU-Instanced, zero CPU sway cost!)
    this.buildInstancedGrass();

    // 4.7 Instanced Wildflowers
    this.buildInstancedFlowers();

    // 4.8 Bioluminescent Magic Mushrooms & Crystals
    this.buildMushroomsAndCrystals();

    // 4.9 Cozy Wooden Village Hut with Picket Fence & Lantern
    this.buildVillageHut(new THREE.Vector3(-14, 0, -8));

    // 4.10 Celestial Ancient Temple
    this.buildCelestialTemple(new THREE.Vector3(22, 0, -20));

    // 4.11 Obby (Stepping Stones Altar)
    this.buildObbyParkour(new THREE.Vector3(-25, 0, 15));

    // 4.12 Cute Starlet NPCs
    this.spawnCuteCreatures();

    // 4.13 Minor Slimes
    this.spawnMinorSlimes();

    // 4.14 Bees & Butterflies
    this.spawnBees(22);
    this.spawnButterflies(26);
  },


  // ==========================================
  // 4.1 TERRAIN MESH
  // Same triangulation as the heightfield, so feet never float or sink
  // ==========================================
  buildTerrain() {
    const hf = this.heightfield;
    const n = hf.n;
    const count = n * n;
    const positions = new Float32Array(count * 3);
    const uvs = new Float32Array(count * 2);
    for (let iz = 0; iz < n; iz++) {
      for (let ix = 0; ix < n; ix++) {
        const i = iz * n + ix;
        positions[i * 3] = -hf.half + ix * hf.cell;
        positions[i * 3 + 1] = hf.heights[i];
        positions[i * 3 + 2] = -hf.half + iz * hf.cell;
        uvs[i * 2] = ix / hf.segments;
        uvs[i * 2 + 1] = iz / hf.segments;
      }
    }
    const segs = hf.segments;
    const indices = new Uint32Array(segs * segs * 6);
    let k = 0;
    for (let iz = 0; iz < segs; iz++) {
      for (let ix = 0; ix < segs; ix++) {
        const a = iz * n + ix;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        indices[k++] = a; indices[k++] = c; indices[k++] = b;
        indices[k++] = b; indices[k++] = c; indices[k++] = d;
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.computeVertexNormals();

    // Surface weights: x = rock, y = snow, z = sand, w = sunny meadow tint
    const normals = geo.attributes.normal.array;
    const surface = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      const slope = 1 - normals[i * 3 + 1];
      const nz = simplex2(x * 0.15, z * 0.15);

      // Alpine meadows on gentle slopes, rock on steep faces & high crags, snow on the peaks
      let rock = smoothstep(0.3, 0.5, slope + nz * 0.06);
      rock = Math.max(rock, smoothstep(26, 34, y + nz * 4) * 0.75);
      let snow = smoothstep(31, 37, y + nz * 4) * (1 - smoothstep(0.5, 0.72, slope));
      snow = Math.max(snow, smoothstep(43, 49, y + nz * 3) * 0.92);

      let sand = 0;
      const shore = hf.waterDist[i];
      if (shore < 2.6) {
        const above = y - hf.waterLevel[i];
        sand = (1 - smoothstep(0.4, 2.4, shore + nz * 0.5)) * (1 - smoothstep(0.35, 1.2, above));
        if (above < 0) sand = 1;
      }
      const tint = smoothstep(0.15, 0.75, simplex2(x * 0.035 + 7.3, z * 0.035 - 2.1)) * (1 - rock);
      surface[i * 4] = rock;
      surface[i * 4 + 1] = snow;
      surface[i * 4 + 2] = sand * (1 - rock * 0.5);
      surface[i * 4 + 3] = tint;
    }
    geo.setAttribute('aSurface', new THREE.BufferAttribute(surface, 4));

    const grassTex = this.createRealisticGrassTexture();
    grassTex.repeat.set(19, 19);
    const rockTex = this.createRockTexture();
    const groundMat = new THREE.MeshLambertMaterial({ map: grassTex, color: 0xffffff });
    groundMat.onBeforeCompile = (shader) => {
      shader.uniforms.uRockMap = { value: rockTex };
      shader.vertexShader = 'attribute vec4 aSurface;\nvarying vec4 vSurface;\nvarying vec3 vTerrainPos;\nvarying vec3 vTerrainNormal;\n' +
        shader.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vSurface = aSurface;
          vTerrainPos = position;
          vTerrainNormal = normal;`
        );
      shader.fragmentShader = 'uniform sampler2D uRockMap;\nvarying vec4 vSurface;\nvarying vec3 vTerrainPos;\nvarying vec3 vTerrainNormal;\n' +
        shader.fragmentShader.replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 tn = abs(normalize(vTerrainNormal));
          tn /= (tn.x + tn.y + tn.z);
          vec3 rp = vTerrainPos * 0.11;
          vec3 rockC = texture2D(uRockMap, rp.xz).rgb * tn.y + texture2D(uRockMap, rp.xy).rgb * tn.z + texture2D(uRockMap, rp.zy).rgb * tn.x;
          vec3 sandC = vec3(0.96, 0.87, 0.68) * (0.92 + 0.08 * texture2D(uRockMap, vTerrainPos.xz * 0.35).r);
          vec3 snowC = mix(vec3(0.84, 0.88, 1.0), vec3(0.99, 0.99, 1.0), tn.y);
          diffuseColor.rgb *= mix(vec3(1.0), vec3(1.1, 1.05, 0.8), vSurface.w * 0.55);
          // Cooler, mossy alpine grass higher up the mountains
          float alpine = smoothstep(5.0, 22.0, vTerrainPos.y);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.72, 0.88, 0.95), alpine);
          diffuseColor.rgb = mix(diffuseColor.rgb, sandC, vSurface.z);
          diffuseColor.rgb = mix(diffuseColor.rgb, rockC, vSurface.x);
          diffuseColor.rgb = mix(diffuseColor.rgb, snowC, vSurface.y);`
        );
    };

    this.groundMesh = new THREE.Mesh(geo, groundMat);
    this.groundMesh.receiveShadow = true;
    this.groundMesh.matrixAutoUpdate = false;
    this.scene.add(this.groundMesh);
  },


  createRockTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 256, 256);
    grad.addColorStop(0, '#7a7fc0');
    grad.addColorStop(0.5, '#6a6fae');
    grad.addColorStop(1, '#8388c8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);

    // Soft light & shadow blotches (no hard stripes, so cliffs don't look contoured)
    for (let i = 0; i < 70; i++) {
      const bx = Math.random() * 256;
      const by = Math.random() * 256;
      const br = 10 + Math.random() * 26;
      const blot = ctx.createRadialGradient(bx, by, 0, bx, by, br);
      const light = Math.random() > 0.5;
      blot.addColorStop(0, light ? 'rgba(170, 164, 228, 0.45)' : 'rgba(78, 80, 150, 0.4)');
      blot.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = blot;
      ctx.fillRect(bx - br, by - br, br * 2, br * 2);
    }
    // Speckles & cracks
    for (let i = 0; i < 900; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(210, 214, 240, 0.5)' : 'rgba(70, 76, 120, 0.45)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    ctx.strokeStyle = 'rgba(70, 74, 118, 0.5)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 14; i++) {
      let x = Math.random() * 256;
      let y = Math.random() * 256;
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (Math.random() - 0.5) * 40;
        y += Math.random() * 26;
        ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  },


  // ==========================================
  // 4.2 WATER: waterfall, river, crystal pond & southern lake
  // ==========================================
  buildWater() {
    const heightAt = (x, z) => this.getTerrainHeight(x, z);

    // Find the cliff lip where the mountain stream drops into the gorge
    let lipZ = -56.25;
    for (let z = -60; z < -50; z += 0.05) {
      if (this.getTerrainHeight(WATERFALL.x, z) < SPRING_LEVEL - 1.8) {
        lipZ = z - 0.35;
        break;
      }
    }
    this.waterfallLipZ = lipZ;

    // Spring pool + mountain stream (upper) and the shared lowland water table
    const upper = new WaterSurface({
      level: SPRING_LEVEL, minX: -4.5, maxX: 7.5, minZ: -74, maxZ: lipZ, res: 0.3, upper: true, heightAt,
      flowBoost: (x, z) => 0.35 * smoothstep(lipZ - 5, lipZ, z)
    });
    const lowland = new WaterSurface({
      level: WATER_LEVEL, minX: -19, maxX: 8, minZ: lipZ + 0.3, maxZ: 54, res: 0.45, upper: false, heightAt,
      flowBoost: (x, z) => 0.45 * (1 - smoothstep(lipZ + 8, lipZ + 16, z))
    });
    this.waterSurfaces = [upper, lowland];
    this.waterSurfaces.forEach(w => this.scene.add(w.mesh));

    // Waterfall sheet, spray and rainbow
    this.waterfall = createWaterfall({
      x: WATERFALL.x, topY: SPRING_LEVEL + 0.02, topZ: lipZ, bottomY: WATER_LEVEL - 0.15,
      reach: 2.4, topHalfWidth: 1.75, bottomHalfWidth: 2.5
    });
    this.scene.add(this.waterfall);
    this.mist = new MistParticles(new THREE.Vector3(WATERFALL.x, WATER_LEVEL, lipZ + 3.0), 4.6, 80);
    this.scene.add(this.mist.points);
    const rainbow = createRainbow(3.3, 4.2);
    this.rainbow = rainbow;
    rainbow.position.set(WATERFALL.x, WATER_LEVEL, lipZ + 5.2);
    rainbow.scale.setScalar(1.25);
    this.scene.add(rainbow);

    this.decorateWaterside(lipZ);
  },


  decorateWaterside(lipZ) {
    const pond = LAKES.find(l => l.id === 'pond');
    const southLake = LAKES.find(l => l.id === 'southlake');
    const spring = LAKES.find(l => l.id === 'spring');

    // Floating lotus lilies
    const padMat = new THREE.MeshLambertMaterial({ color: 0x2d9a5f, side: THREE.DoubleSide });
    const flowerPinkMat = new THREE.MeshLambertMaterial({ color: 0xff70a6 });
    const flowerWhiteMat = new THREE.MeshLambertMaterial({ color: 0xfff0f6 });
    const lotusCenterMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.1, 0.4) });
    const petalGeo = new THREE.ConeGeometry(0.12, 0.28, 5);
    const lilyPositions = [
      { x: pond.x + 3.0, z: pond.z + 2.6 }, { x: pond.x - 3.6, z: pond.z - 2.4 },
      { x: pond.x + 1.2, z: pond.z + 4.4 }, { x: pond.x - 4.4, z: pond.z + 1.6 },
      { x: pond.x + 3.9, z: pond.z - 1.2 }, { x: pond.x - 1.4, z: pond.z - 4.3 },
      { x: southLake.x - 3.5, z: southLake.z - 2.5 }, { x: southLake.x + 3.8, z: southLake.z + 2.2 },
      { x: southLake.x - 4.6, z: southLake.z + 3.2 }, { x: southLake.x + 1.5, z: southLake.z - 5.2 },
      { x: southLake.x + 5.2, z: southLake.z - 1.8 }
    ];
    const lilies = new THREE.Group();
    lilyPositions.forEach((lp, idx) => {
      if (this.isOnBridge(lp.x, lp.z, 0.4)) return;
      const lilyGroup = new THREE.Group();
      lilyGroup.position.set(lp.x, WATER_LEVEL + 0.02, lp.z);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.6, 14, 0, Math.PI * 1.8), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = Math.random() * Math.PI;
      lilyGroup.add(pad);
      if (idx % 3 !== 2) {
        const mat = idx % 2 ? flowerWhiteMat : flowerPinkMat;
        for (let p = 0; p < 7; p++) {
          const ang = (p / 7) * Math.PI * 2;
          const petal = new THREE.Mesh(petalGeo, mat);
          petal.position.set(Math.cos(ang) * 0.16, 0.12, Math.sin(ang) * 0.16);
          petal.rotation.x = Math.sin(ang) * 0.35;
          petal.rotation.z = -Math.cos(ang) * 0.35;
          lilyGroup.add(petal);
        }
        const center = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lotusCenterMat);
        center.position.y = 0.14;
        lilyGroup.add(center);
      }
      lilies.add(lilyGroup);
    });
    this.scene.add(bakeStaticGroup(lilies, { castShadow: false }));

    // Koi fish circling in the crystal pond
    const koiMats = [
      new THREE.MeshLambertMaterial({ color: 0xff7b2e }),
      new THREE.MeshLambertMaterial({ color: 0xfff4e8 }),
      new THREE.MeshLambertMaterial({ color: 0xffb703 })
    ];
    for (let i = 0; i < 6; i++) {
      const koi = new THREE.Group();
      const mat = koiMats[i % koiMats.length];
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mat);
      body.scale.set(1, 0.7, 2.1);
      koi.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 4), mat);
      tail.rotation.x = -Math.PI / 2;
      tail.position.z = -0.52;
      koi.add(tail);
      const spot = new THREE.Mesh(new THREE.SphereGeometry(0.1, 6, 6), koiMats[(i + 1) % koiMats.length]);
      spot.position.set(0, 0.1, 0.12);
      spot.scale.set(1, 0.4, 1.4);
      koi.add(spot);
      koi.userData = {
        cx: pond.x, cz: pond.z,
        radius: 1.6 + (i % 3) * 1.2,
        speed: (0.35 + Math.random() * 0.25) * (i % 2 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
        depth: WATER_LEVEL - 0.3 - (i % 2) * 0.25,
        tail
      };
      this.scene.add(koi);
      this.koiFish.push(koi);
    }

    // Reeds & river rocks along every lowland shore (instanced: 3 draw calls)
    const reedCount = 190;
    const rockCount = 90;
    const stalkInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.02, 0.035, 1, 4), new THREE.MeshLambertMaterial({ color: 0x3f9b62 }), reedCount);
    const tipInst = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 6), new THREE.MeshLambertMaterial({ color: 0x7a4a24 }), reedCount);
    const rockInst = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial({ color: 0xb9b4d6, flatShading: true }), rockCount);
    rockInst.castShadow = true;
    rockInst.receiveShadow = true;
    const dummy = new THREE.Object3D();
    let reeds = 0;
    let rocks = 0;
    let attempts = 0;
    while ((reeds < reedCount || rocks < rockCount) && attempts < 9000) {
      attempts++;
      const x = -19 + Math.random() * 27;
      const z = lipZ + 1 + Math.random() * (54 - lipZ);
      const q = waterQuery(x, z);
      if (q.upper) continue;
      const y = this.getTerrainHeight(x, z);
      if (this.isOnBridge(x, z, 0.8)) continue;
      if (reeds < reedCount && q.dist > -0.4 && q.dist < 1.2 && y > WATER_LEVEL - 0.3 && y < WATER_LEVEL + 0.8) {
        const h = 1.0 + Math.random() * 0.8;
        dummy.position.set(x, y + h / 2, z);
        dummy.rotation.set((Math.random() - 0.5) * 0.2, Math.random() * Math.PI, (Math.random() - 0.5) * 0.2);
        dummy.scale.set(1, h, 1);
        dummy.updateMatrix();
        stalkInst.setMatrixAt(reeds, dummy.matrix);
        dummy.position.set(x, y + h * 0.86, z);
        dummy.scale.set(1, 0.3, 1);
        dummy.updateMatrix();
        tipInst.setMatrixAt(reeds, dummy.matrix);
        reeds++;
      } else if (rocks < rockCount && q.dist > -0.8 && q.dist < 2.2 && this.getTerrainSlope(x, z) < 0.6) {
        const sc = 0.35 + Math.random() * 0.9;
        dummy.position.set(x, y + sc * 0.12, z);
        dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        dummy.scale.set(sc * 1.2, sc * 0.7, sc);
        dummy.updateMatrix();
        rockInst.setMatrixAt(rocks, dummy.matrix);
        rocks++;
      }
    }
    stalkInst.count = reeds;
    tipInst.count = reeds;
    rockInst.count = rocks;
    this.scene.add(stalkInst, tipInst, rockInst);

    // Glowing crystal spring in the mountains (source of the river)
    const springMat = new THREE.MeshLambertMaterial({ color: 0x9be7ff, emissive: 0x3fb8ff, emissiveIntensity: 1.7, transparent: true, opacity: 0.9 });
    const springCrystals = new THREE.Group();
    for (let c = 0; c < 5; c++) {
      const ang = (c / 5) * Math.PI * 2 + 0.4;
      const cx = spring.x + Math.cos(ang) * (spring.r + 0.9);
      const cz = spring.z + Math.sin(ang) * (spring.r + 0.9);
      const cy = this.getTerrainHeight(cx, cz);
      const cluster = new THREE.Group();
      for (let sIdx = 0; sIdx < 3; sIdx++) {
        const h = 0.9 + Math.random() * 1.3;
        const shard = new THREE.Mesh(new THREE.ConeGeometry(0.2 + Math.random() * 0.12, h, 6), springMat);
        shard.position.set((Math.random() - 0.5) * 0.6, h / 2, (Math.random() - 0.5) * 0.6);
        shard.rotation.set((Math.random() - 0.5) * 0.4, Math.random() * Math.PI, (Math.random() - 0.5) * 0.4);
        cluster.add(shard);
      }
      cluster.position.set(cx, cy, cz);
      springCrystals.add(cluster);
    }
    this.scene.add(bakeStaticGroup(springCrystals, { castShadow: false }));
  },


  // Nearest centerline point and flow direction of the lowland river
  getRiverCrossing(x, z) {
    const segs = RIVERS[1].segs;
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i];
      let u = ((x - sg.ax) * sg.dx + (z - sg.az) * sg.dz) / sg.len2;
      u = Math.max(0, Math.min(1, u));
      const px = sg.ax + sg.dx * u;
      const pz = sg.az + sg.dz * u;
      const d = Math.hypot(x - px, z - pz);
      if (d < bestD) {
        bestD = d;
        best = { x: px, z: pz, dirX: sg.dx / sg.len, dirZ: sg.dz / sg.len, width: sg.aw + (sg.bw - sg.aw) * u };
      }
    }
    return best;
  },


  // Walk from the river center along (dirX, dirZ) until the ground reaches targetY
  findBankPoint(x, z, dirX, dirZ, targetY, maxDist = 20) {
    for (let d = 0; d < maxDist; d += 0.1) {
      const px = x + dirX * d;
      const pz = z + dirZ * d;
      if (this.getTerrainHeight(px, pz) >= targetY) return { x: px, z: pz };
    }
    return { x: x + dirX * maxDist, z: z + dirZ * maxDist };
  },


  // ==========================================
  // 4.3 BRIDGES
  // ==========================================
  buildBridges() {
    this.bridgeEnds = {};

    // Perpendicular to the river, oriented so index 0 is the eastern (+x) end
    const across = (c) => {
      let px = -c.dirZ;
      let pz = c.dirX;
      if (px < 0) { px = -px; pz = -pz; }
      return { px, pz };
    };

    // 1. Kawaii moon bridge over the crystal pond (spawn -> village hut)
    const moonA = { x: 1.1, z: 5.0 };
    const moonB = { x: -10.1, z: -4.0 };
    buildMoonBridge(this, moonA, moonB);
    this.bridgeEnds.moon = [moonA, moonB];

    // 2. Roman stone bridge on the temple <-> village loop
    const rc = this.getRiverCrossing(0.6, -19.5);
    const ra = across(rc);
    const span = rc.width + 2.9;
    const romanE = { x: rc.x + ra.px * span, z: rc.z + ra.pz * span };
    const romanW = { x: rc.x - ra.px * span, z: rc.z - ra.pz * span };
    buildRomanBridge(this, romanE, romanW, WATER_LEVEL, this.createFlowerOfLifeTexture());
    this.bridgeEnds.roman = [romanE, romanW];

    // 3. Rope bridge high across the waterfall gorge
    const gc = this.getRiverCrossing(0.8, this.waterfallLipZ + 9.5);
    const ga = across(gc);
    const deckTarget = 6.8;
    const ropeE = this.findBankPoint(gc.x, gc.z, ga.px, ga.pz, deckTarget);
    const ropeW = this.findBankPoint(gc.x, gc.z, -ga.px, -ga.pz, deckTarget);
    buildRopeBridge(this, ropeW, ropeE, this.getTerrainHeight(ropeW.x, ropeW.z), this.getTerrainHeight(ropeE.x, ropeE.z));
    this.bridgeEnds.rope = [ropeW, ropeE];

    // 4. Floating crystal star bridge across the outflow (spawn -> obby)
    const sc = this.getRiverCrossing(-12.3, 11);
    const sa = across(sc);
    this.starBridgePlates = buildStarBridge(this, sc, sa.px, sa.pz, 5, 1.5, WATER_LEVEL + 0.55);
    const sEnd = 3.9;
    const starE = { x: sc.x + sa.px * sEnd, z: sc.z + sa.pz * sEnd };
    const starW = { x: sc.x - sa.px * sEnd, z: sc.z - sa.pz * sEnd };
    this.bridgeEnds.star = [starE, starW];
    this.bridgeFootprints.push({
      ax: starW.x, az: starW.z, dirX: sa.px, dirZ: sa.pz, len: sEnd * 2, halfWidth: 0.9
    });
  },


  // ==========================================
  // 4.4 WINDING COBBLESTONE PATHWAYS
  // ==========================================
  buildStonePaths() {
    const stoneMat1 = new THREE.MeshLambertMaterial({ color: 0xd8c8b8, flatShading: true });
    const stoneMat2 = new THREE.MeshLambertMaterial({ color: 0xbdb0a0, flatShading: true });
    const stoneMat3 = new THREE.MeshLambertMaterial({ color: 0xc4b4d4, flatShading: true });
    const pathMats = [stoneMat1, stoneMat2, stoneMat3];
    const ends = this.bridgeEnds;
    const stoneMatrices = [[], [], []];
    const dummy = new THREE.Object3D();

    // Spline-like paths from Spawn (0, 8); bridge spans and water are skipped automatically
    const paths = [
      // Path 1: Spawn -> Moon Bridge -> Village Hut (-14, -8)
      [{ x: 0, z: 8 }, { x: 0.7, z: 6.4 }, ends.moon[0], ends.moon[1], { x: -12, z: -6 }, { x: -14, z: -8 }],
      // Path 2: Spawn -> Celestial Temple (22, -20)
      [
        { x: 0, z: 8 }, { x: 4, z: 5 }, { x: 8, z: 2 }, { x: 12, z: -3 },
        { x: 15, z: -8 }, { x: 18, z: -14 }, { x: 22, z: -20 }
      ],
      // Path 3: Spawn -> Star Bridge -> Obby Parkour (-25, 15)
      [{ x: 0, z: 8 }, { x: -5, z: 9 }, ends.star[0], ends.star[1], { x: -17, z: 13 }, { x: -22, z: 14 }, { x: -25, z: 15 }],
      // Path 4: Spawn -> Boss Arena (32, 30)
      [
        { x: 0, z: 8 }, { x: 6, z: 12 }, { x: 13, z: 16 }, { x: 20, z: 21 },
        { x: 26, z: 25 }, { x: 32, z: 30 }
      ],
      // Path 5: Temple loop -> Roman Bridge -> Village Hut
      [{ x: 12, z: -3 }, { x: 8.5, z: -9.5 }, ends.roman[0], ends.roman[1], { x: -7, z: -16 }, { x: -10.5, z: -12.5 }],
      // Path 6: Roman Bridge -> up the gorge -> Rope Bridge -> back down to the temple
      [ends.roman[1], { x: -6, z: -26 }, { x: -8, z: -34 }, { x: -7.5, z: -41 }, ends.rope[0], ends.rope[1], { x: 9.5, z: -42 }, { x: 12, z: -37 }]
    ];

    paths.forEach(segmentList => {
      for (let s = 0; s < segmentList.length - 1; s++) {
        const p1 = segmentList[s];
        const p2 = segmentList[s + 1];
        const steps = Math.max(3, Math.round(Math.hypot(p2.x - p1.x, p2.z - p1.z) / 0.9));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * 0.45;
          const pz = p1.z + (p2.z - p1.z) * t + (Math.random() - 0.5) * 0.45;
          if (this.isNearWater(px, pz, 0.35) || this.isOnBridge(px, pz, -0.4)) continue;
          const py = this.getTerrainHeight(px, pz);

          const r = 0.45 + Math.random() * 0.35;
          dummy.position.set(px, py + 0.04, pz);
          dummy.rotation.set(0, Math.random() * Math.PI, 0);
          dummy.scale.set(r, 1, r);
          dummy.updateMatrix();
          stoneMatrices[Math.floor(Math.random() * pathMats.length)].push(dummy.matrix.clone());
        }
      }
    });

    // One instanced draw call per stone color
    const stoneGeo = new THREE.CylinderGeometry(1, 1.05, 0.08, 6);
    stoneMatrices.forEach((list, m) => {
      const inst = new THREE.InstancedMesh(stoneGeo, pathMats[m], list.length);
      list.forEach((mat4, i) => inst.setMatrixAt(i, mat4));
      inst.receiveShadow = true;
      this.scene.add(inst);
    });
  }
};
