import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import {
  Heightfield, waterQuery, simplex2, smoothstep,
  LAKES, RIVERS, WATER_LEVEL, SPRING_LEVEL, WATERFALL
} from './landscape.js';
import {
  applyCelShading, createSkyDome, createDistantRanges, createCloudSea, PostFX, SKY_COLORS
} from './atmosphere.js';
import { WaterSurface, createWaterfall, MistParticles, createRainbow } from './water.js';
import { buildMoonBridge, buildRomanBridge, buildRopeBridge, buildStarBridge, bridgeDeckY } from './bridges.js';
import { bakeStaticGroup } from './bake.js';
import { AudioEngine } from './audio.js';
import { DayNightCycle } from './daynight.js';
import { ChibiRig, addAnimeFace, blinkFace } from './characters.js';
import { QuestSystem, QUEST_DEFS } from './quests.js';
import { MagicFX, createShieldMaterial } from './magicfx.js';
import { Compass } from './compass.js';
import { PerformanceGovernor, PERF_TIERS } from './perf.js';
import { RemotePlayers } from './remote.js';
import { CoopSession } from './coop.js';

applyCelShading();

// Deterministic PRNG: the world (trees, flowers, stones ...) looks the same on every visit
const WORLD_SEED = 20260929;
function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==========================================
// 1. SOUND SYSTEM (Web Audio API Synthesizer & Dynamic BGM)
// ==========================================
const sfx = new AudioEngine();

// ==========================================
// 2. SISTERS DATA & CONFIG
// ==========================================
const SISTERS = [
  {
    name: "Luna",
    title: "Mond-Wächterin (Sanfte Schwerkraft & Heilung)",
    icon: "🌙",
    themeColor: 0xb8c0ff,
    accentColor: "#b8c0ff",
    speed: 0.18,
    jumpPower: 0.17,
    gravity: 0.010,
    hairColor: 0xe0e7ff,
    dressColor: 0x725ac1,
    ability1: {
      name: "Mondschild",
      icon: "🛡️",
      cooldown: 7.0
    },
    ability2: {
      name: "Heilung",
      icon: "💚",
      cooldown: 8.0
    }
  },
  {
    name: "Stella",
    title: "Sternen-Sprinterin (Lichtblitz & Sternenbogen)",
    icon: "⭐",
    themeColor: 0xffe066,
    accentColor: "#ffe066",
    speed: 0.23,
    jumpPower: 0.17,
    gravity: 0.012,
    hairColor: 0xffd166,
    dressColor: 0xffb703,
    ability1: {
      name: "Sternen-Bogen",
      icon: "🏹",
      cooldown: 2.5
    },
    ability2: {
      name: "Sternen-Dash",
      icon: "⚡",
      cooldown: 4.0
    }
  },
  {
    name: "Sol",
    title: "Sonnen-Kämpferin (Supernova & Versteinerung)",
    icon: "☀️",
    themeColor: 0xff7b00,
    accentColor: "#ff7b00",
    speed: 0.19,
    jumpPower: 0.17,
    gravity: 0.012,
    hairColor: 0xffa200,
    dressColor: 0xd90429,
    ability1: {
      name: "Supernova",
      icon: "💥",
      cooldown: 5.0
    },
    ability2: {
      name: "Versteinern",
      icon: "🪨",
      cooldown: 9.0
    }
  },
  {
    name: "Planeta",
    title: "Planeten-Mystikerin (Gravitations-Ringe & Unsichtbarkeit)",
    icon: "🪐",
    themeColor: 0x9d4edd,
    accentColor: "#9d4edd",
    speed: 0.18,
    jumpPower: 0.17,
    gravity: 0.012,
    hairColor: 0x5a189a,
    dressColor: 0x3c096c,
    ability1: {
      name: "Planeten-Ringe",
      icon: "🪐",
      cooldown: 5.5
    },
    ability2: {
      name: "Unsichtbar",
      icon: "👻",
      cooldown: 8.5
    }
  }
];

// ==========================================
// 3. MAIN GAME APPLICATION
// ==========================================
class GalaxySistersGame {
  constructor() {
    this.activeSisterIdx = 0;
    this.playerHP = 100;
    this.maxPlayerHP = 100;
    this.cooldown1 = 0;
    this.cooldown2 = 0;
    this.isPlayerInvisible = false;
    this.invisibleTimer = 0;
    
    // Physics, Clock & Responsiveness
    this.clock = new THREE.Clock();
    this.keys = {};
    this.playerVelY = 0;
    this.isGrounded = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.projectiles = [];
    this.particles = [];
    this.treePetalsData = [];
    this.treeCanopies = [];
    this.runningParticles = [];
    this.clouds = [];
    this.bees = [];
    this.butterflies = [];
    this.lavenderStems = [];
    this.joystickDelta = { x: 0, y: 0 };
    
    // Interactive Objects in World
    this.platforms = [];
    this.colliders = [];
    this.slimes = [];
    this.creatures = [];
    this.prevPlayerPos = null;
    this.bridgeFootprints = [];
    this.waterSurfaces = [];
    this.starBridgePlates = [];
    this.koiFish = [];
    this.isSwimming = false;
    this.waterSpeedFactor = 1;
    this.swimHintShown = false;
    this.isTouch = document.documentElement.classList.contains('touch');
    this.graphicsMode = this.loadGraphicsMode();
    this.perfTier = this.startTier();
    this.graphicsQuality = PERF_TIERS[this.perfTier].bloom ? 'high' : 'low';
    this.renderScale = PERF_TIERS[this.perfTier].scale;
    this.perf = new PerformanceGovernor(() => this.perfTier, (tier, fps) => this.onAutoTierDown(tier, fps));
    this.perf.enabled = this.graphicsMode === 'auto';

    // Landscape heightfield: noise mountains + carved river, matches the terrain mesh exactly
    this.heightfield = new Heightfield(250, 360);

    // Build the world with a seeded Math.random, then restore real randomness for gameplay
    const nativeRandom = Math.random;
    Math.random = mulberry32(WORLD_SEED);
    try {
      this.initScene();
      this.buildWorld();
      this.createPlayerMesh();
      this.createBossVortox();
      this.buildWorldQuests();
    } finally {
      Math.random = nativeRandom;
    }

    // Co-op: other sisters and the session that syncs them (inactive until someone joins a room)
    this.remotes = new RemotePlayers(this);
    this.coop = new CoopSession(this);

    // Day & night: sun/moon arc, palettes, night glow, fireflies
    this.dayNight = new DayNightCycle(this, {
      dayLength: 480,
      start: 0.1,
      onNightfall: () => {
        this.showFloatingText('🌙 Die Nacht bricht an …', this.playerGroup.position, '#b8c4ff');
        sfx.nightfall();
      },
      onSunrise: () => {
        this.showFloatingText('☀️ Guten Morgen!', this.playerGroup.position, '#ffd166');
        sfx.sunrise();
      }
    });

    // Compass with open quest goals (and the boss while he is alive)
    this.compass = new Compass(this, () => {
      const targets = this.quests.getTargets();
      if (this.bossData && this.bossData.alive) {
        targets.push({ id: 'boss', icon: '👾', label: 'Vortox', x: this.bossGroup.position.x, z: this.bossGroup.position.z });
      }
      return targets;
    });

    this.setupUI();
    this.setupEvents();
    this.setupRobloxControls();
    this.animate();
  }

  // ==========================================
  // 3.0 TERRAIN ELEVATION
  // Precomputed heightfield (see landscape.js) - physics, flora and mesh share it
  // ==========================================
  getTerrainHeight(x, z) {
    return this.heightfield.height(x, z);
  }

  // 0 = flat ground, 1 = vertical cliff
  getTerrainSlope(x, z) {
    const e = 0.6;
    const dx = this.getTerrainHeight(x + e, z) - this.getTerrainHeight(x - e, z);
    const dz = this.getTerrainHeight(x, z + e) - this.getTerrainHeight(x, z - e);
    const ny = (2 * e) / Math.sqrt(dx * dx + dz * dz + 4 * e * e);
    return 1 - ny;
  }

  // True when (x, z) is water or within `margin` of a shore
  isNearWater(x, z, margin = 0) {
    return waterQuery(x, z).dist < margin;
  }

  isOnBridge(x, z, margin = 0) {
    for (let i = 0; i < this.bridgeFootprints.length; i++) {
      const b = this.bridgeFootprints[i];
      const rx = x - b.ax;
      const rz = z - b.az;
      const along = rx * b.dirX + rz * b.dirZ;
      const side = -rx * b.dirZ + rz * b.dirX;
      if (along > -margin - 0.6 && along < b.len + margin + 0.6 && Math.abs(side) < b.halfWidth + margin + 0.6) return true;
    }
    return false;
  }

  // Water surface height at (x, z) or null
  getWaterSurface(x, z) {
    for (let i = 0; i < this.waterSurfaces.length; i++) {
      const y = this.waterSurfaces[i].surfaceAt(x, z);
      if (y !== null) return y;
    }
    return null;
  }

  // Graphics mode: 'auto' (measure the frame rate and adapt), or a fixed 'high' / 'low'
  loadGraphicsMode() {
    try {
      const saved = localStorage.getItem('gs-graphics');
      if (saved === 'high' || saved === 'low' || saved === 'auto') return saved;
    } catch (e) { /* storage unavailable */ }
    return 'auto';
  }

  // Quality tier to begin with (see PERF_TIERS): phones and tablets start on 'Niedrig'
  startTier() {
    if (this.graphicsMode === 'high') return 0;
    if (this.graphicsMode === 'low') return 1;
    const small = this.isTouch && Math.min(window.innerWidth, window.innerHeight) < 900;
    return small ? 1 : 0;
  }

  applyTier(tier) {
    const t = PERF_TIERS[tier];
    this.perfTier = tier;
    this.graphicsQuality = t.bloom ? 'high' : 'low';
    this.renderScale = t.scale;
    this.applyPixelRatio();
    const shadow = this.dirLight && this.dirLight.shadow;
    if (shadow && shadow.mapSize.x !== t.shadow) {
      shadow.mapSize.set(t.shadow, t.shadow);
      shadow.dispose();
      shadow.map = null;
    }
    if (t.bloom && !this.postFX) {
      this.postFX = new PostFX(this.renderer, this.scene, this.camera);
    }
    if (this.postFX) this.postFX.setSize();
    this.updateGraphicsButton();
  }

  applyPixelRatio() {
    const t = PERF_TIERS[this.perfTier];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, t.cap) * this.renderScale);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  cycleGraphicsMode() {
    const order = ['auto', 'high', 'low'];
    this.graphicsMode = order[(order.indexOf(this.graphicsMode) + 1) % order.length];
    try { localStorage.setItem('gs-graphics', this.graphicsMode); } catch (e) { /* ignore */ }
    this.perf.enabled = this.graphicsMode === 'auto';
    this.perf.arm();
    this.applyTier(this.startTier());
  }

  onAutoTierDown(tier, fps) {
    this.applyTier(tier);
    this.showToast(`🔋 Grafik automatisch angepasst: ${PERF_TIERS[tier].name} (${Math.round(fps)} FPS)`);
  }

  updateGraphicsButton() {
    const btn = document.getElementById('btn-graphics');
    if (!btn) return;
    const name = PERF_TIERS[this.perfTier].name;
    btn.textContent = this.graphicsMode === 'auto' ? `🤖 Grafik: Auto · ${name}`
      : this.graphicsMode === 'high' ? '✨ Grafik: Hoch' : '🔋 Grafik: Niedrig';
  }

  showToast(text, ms = 4000) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add('visible');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  // Walk from the river center along (dirX, dirZ) until the ground reaches targetY
  findBankPoint(x, z, dirX, dirZ, targetY, maxDist = 20) {
    for (let d = 0; d < maxDist; d += 0.1) {
      const px = x + dirX * d;
      const pz = z + dirZ * d;
      if (this.getTerrainHeight(px, pz) >= targetY) return { x: px, z: pz };
    }
    return { x: x + dirX * maxDist, z: z + dirZ * maxDist };
  }

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
  }

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

  createBlackPinkBarkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#120b16';
    ctx.fillRect(0, 0, 128, 256);

    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = i % 2 === 0 ? '#22142d' : '#08050c';
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath();
      const x = Math.random() * 128;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 10, 256);
      ctx.stroke();
    }

    const pinkTones = ['#ff2a85', '#ff70a6', '#ff4d94', '#ff85a1', '#f72585'];
    for (let y = 15; y < 256; y += 32) {
      const col = pinkTones[Math.floor(Math.random() * pinkTones.length)];
      ctx.strokeStyle = col;
      ctx.lineWidth = 4 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(35, y + 14, 85, y - 14, 128, y + 6);
      ctx.stroke();

      ctx.strokeStyle = '#ffc2d4';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y - 2);
      ctx.bezierCurveTo(35, y + 12, 85, y - 16, 128, y + 4);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1.5, 2);
    return tex;
  }

  buildFoliage() {
    const barkTexture = this.createBlackPinkBarkTexture();
    const treeTrunkMat = new THREE.MeshLambertMaterial({
      map: barkTexture,
      flatShading: true
    });
    const pinkAccentMat = new THREE.MeshLambertMaterial({
      color: 0xff3385,
      emissive: 0x440022,
      flatShading: true
    });

    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const crownPalettes = [
      [lam(0x9d4edd), lam(0xb565d8), lam(0x8a3fe0)], // violet
      [lam(0xff9ecf), lam(0xffb8dc), lam(0xf27fbc)], // pink blossom
      [lam(0xe6d8ff), lam(0xf4ecff), lam(0xd2bdfa)]  // lilac-white
    ];
    const blossomGeo = new THREE.IcosahedronGeometry(0.22, 0);
    const blossomMats = [lam(0xffffff), lam(0xffe066), lam(0xff70a6)];
    const forest = new THREE.Group();

    this.treeCanopies = [];

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
      const trunkHeight = 5.5 + Math.random() * 1.8;
      const trunkTopRadius = 0.55 + Math.random() * 0.15;
      const trunkBottomRadius = 0.95 + Math.random() * 0.25;

      const trunkGeo = new THREE.CylinderGeometry(trunkTopRadius, trunkBottomRadius, trunkHeight, 8);
      const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      const rootRingGeo = new THREE.TorusGeometry(trunkBottomRadius * 0.95, 0.16, 6, 12);
      const rootRing = new THREE.Mesh(rootRingGeo, pinkAccentMat);
      rootRing.rotation.x = Math.PI / 2;
      rootRing.position.y = 0.2;
      treeGroup.add(rootRing);

      const collarRingGeo = new THREE.TorusGeometry(trunkTopRadius * 1.05, 0.12, 6, 10);
      const collarRing = new THREE.Mesh(collarRingGeo, pinkAccentMat);
      collarRing.rotation.x = Math.PI / 2;
      collarRing.position.y = trunkHeight * 0.88;
      treeGroup.add(collarRing);

      // Fluffy cloud crown: a soft dome of round puffs (purple, pink blossom or lilac-white)
      const palette = crownPalettes[i % 7 < 4 ? 0 : (i % 7 < 6 ? 1 : 2)];
      const mainCrownRadius = 3.2 + Math.random() * 0.8;
      const crown = new THREE.Group();
      crown.position.y = trunkHeight + 1.0;
      treeGroup.add(crown);
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(mainCrownRadius, 1), palette[0]);
      core.scale.set(1, 0.82, 1);
      crown.add(core);
      const puffCount = 8;
      for (let p = 0; p < puffCount; p++) {
        const ang = (p / puffCount) * Math.PI * 2 + Math.random() * 0.4;
        const ring = mainCrownRadius * (0.72 + Math.random() * 0.15);
        const puffR = mainCrownRadius * (0.42 + Math.random() * 0.14);
        const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(puffR, 1), palette[(p % 2) + 1]);
        puff.position.set(Math.cos(ang) * ring, (Math.random() - 0.35) * mainCrownRadius * 0.5, Math.sin(ang) * ring);
        crown.add(puff);
      }
      const top = new THREE.Mesh(new THREE.IcosahedronGeometry(mainCrownRadius * 0.55, 1), palette[1]);
      top.position.y = mainCrownRadius * 0.62;
      crown.add(top);
      // Little blossoms dotting the crown
      for (let d = 0; d < 10; d++) {
        const u = Math.random() * Math.PI * 2;
        const v = Math.random() * 0.9;
        const blossom = new THREE.Mesh(blossomGeo, blossomMats[(i + d) % blossomMats.length]);
        blossom.position.set(
          Math.cos(u) * Math.cos(v) * mainCrownRadius * 1.02,
          Math.sin(v) * mainCrownRadius * 0.85,
          Math.sin(u) * Math.cos(v) * mainCrownRadius * 1.02
        );
        crown.add(blossom);
      }

      const ty = this.getTerrainHeight(x, z);
      treeGroup.position.set(x, ty, z);
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
        y: ty + trunkHeight + 2.0,
        radius: mainCrownRadius + 1.0
      });
    }

    // All trees merged into a handful of draw calls
    this.scene.add(bakeStaticGroup(forest));

    this.createFallingTreePetals();
  }

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
  }

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
  }

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
  }

  // ==========================================
  // 4.5 INSTANCED FALLING SAKURA & PURPLE PETALS
  // 400 petals rendered in 1 single draw call!
  // ==========================================
  createFallingTreePetals() {
    this.treePetalsData = [];
    if (!this.treeCanopies || this.treeCanopies.length === 0) return;

    const count = 400;
    const petalGeo = new THREE.PlaneGeometry(0.24, 0.3);
    const petalMat = new THREE.MeshBasicMaterial({
      color: 0xff99c8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });

    this.petalsInstanced = new THREE.InstancedMesh(petalGeo, petalMat, count);
    const dummy = new THREE.Object3D();

    const petalColors = [
      new THREE.Color(0xff70a6), new THREE.Color(0xff99c8),
      new THREE.Color(0xf72585), new THREE.Color(0xc77dff),
      new THREE.Color(0x9d4edd), new THREE.Color(0xd8b4fe)
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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

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
  }

  spawnMinorSlimes() {
    for (let i = 0; i < 3; i++) {
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

      const sx = 10 + i * 5;
      const sz = -2 - i * 4;
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
    }
  }

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
  }

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
  }

  // ==========================================
  // 5. BOSS 1: VORTOX
  // ==========================================
  createBossVortox() {
    this.bossGroup = new THREE.Group();
    const bx = 32;
    const bz = 30;
    const by = this.getTerrainHeight(bx, bz);
    this.bossGroup.position.set(bx, by, bz);

    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1db99f, flatShading: true });
    const bodyGeo = new THREE.DodecahedronGeometry(2.8, 1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 3.8;
    body.castShadow = true;
    this.bossGroup.add(body);

    const eyeSclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    eyeSclera.position.set(0, 4.2, 2.2);
    eyeSclera.scale.set(1, 1, 0.4);
    this.bossGroup.add(eyeSclera);

    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0066ff });
    this.bossEyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), pupilMat);
    this.bossEyePupil.position.set(0, 4.2, 2.5);
    this.bossEyePupil.scale.set(1, 1, 0.2);
    this.bossGroup.add(this.bossEyePupil);
    const bossShine = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.6) });
    const shine1 = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bossShine);
    shine1.position.set(-0.2, 4.45, 2.6);
    shine1.scale.set(1, 1, 0.3);
    const shine2 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), bossShine);
    shine2.position.set(0.18, 4.0, 2.6);
    shine2.scale.set(1, 1, 0.3);
    this.bossGroup.add(shine1, shine2);

    const hairMat = new THREE.MeshLambertMaterial({ color: 0x0a9396, flatShading: true });
    const hairGroup = new THREE.Group();
    for (let i = 0; i < 7; i++) {
      const strand = new THREE.Mesh(new THREE.ConeGeometry(0.55, 3.2, 5), hairMat);
      strand.position.set((i - 3) * 0.65, 5.5, -0.6 - Math.abs(i - 3) * 0.2);
      strand.rotation.x = -Math.PI * 0.45;
      strand.rotation.z = (i - 3) * 0.15;
      hairGroup.add(strand);
    }
    this.bossHair = hairGroup;
    this.bossGroup.add(hairGroup);

    const wingMat = new THREE.MeshLambertMaterial({ color: 0x94d2bd, side: THREE.DoubleSide });
    this.leftWing = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.5, 4), wingMat);
    this.leftWing.position.set(-1.8, 4.5, -1.8);
    this.leftWing.rotation.set(-0.4, 0.6, 1.2);
    this.rightWing = this.leftWing.clone();
    this.rightWing.position.x = 1.8;
    this.rightWing.rotation.set(-0.4, -0.6, -1.2);
    this.bossGroup.add(this.leftWing, this.rightWing);

    const tailMat = new THREE.MeshLambertMaterial({ color: 0x1db99f });
    this.bossTail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.6, 2.2, 6), tailMat);
    this.bossTail.position.set(0, 2.4, -2.4);
    this.bossTail.rotation.x = -Math.PI / 3;
    this.bossGroup.add(this.bossTail);

    const armMat = new THREE.MeshLambertMaterial({ color: 0x1db99f });
    const clawMat = new THREE.MeshLambertMaterial({ color: 0xedf6f9 });

    this.bossArms = new THREE.Group();
    const leftArmGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.2, 6), armMat);
    leftArm.position.set(-3.2, 3.2, 0.5);
    leftArm.rotation.z = Math.PI / 4;
    leftArmGroup.add(leftArm);

    for (let c = 0; c < 3; c++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 4), clawMat);
      claw.position.set(-4.5 + c * 0.35, 1.8, 1.2);
      claw.rotation.x = Math.PI / 2;
      leftArmGroup.add(claw);
    }
    this.bossArms.add(leftArmGroup);

    const rightArmGroup = new THREE.Group();
    const rightArm = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.2, 6), armMat);
    rightArm.position.set(3.2, 3.2, 0.5);
    rightArm.rotation.z = -Math.PI / 4;
    rightArmGroup.add(rightArm);

    for (let c = 0; c < 3; c++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 4), clawMat);
      claw.position.set(4.5 - c * 0.35, 1.8, 1.2);
      claw.rotation.x = Math.PI / 2;
      rightArmGroup.add(claw);
    }
    this.bossArms.add(rightArmGroup);
    this.bossGroup.add(this.bossArms);

    const arenaGroup = new THREE.Group();
    arenaGroup.position.set(bx, by, bz);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x495057 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 6, 8), pillarMat);
      pil.position.set(Math.cos(ang) * 16, 3, Math.sin(ang) * 16);
      pil.castShadow = true;
      arenaGroup.add(pil);
    }
    this.scene.add(arenaGroup);

    this.bossData = {
      hp: 150,
      maxHp: 150,
      state: 'idle',
      timer: 0,
      spinAngle: 0,
      alive: true,
      petrifiedTimer: 0
    };

    this.scene.add(this.bossGroup);
  }

  // ==========================================
  // 6. PLAYABLE SISTER MESH
  // ==========================================
  createPlayerMesh() {
    this.playerGroup = new THREE.Group();
    const spawnY = this.getTerrainHeight(0, 8);
    this.playerGroup.position.set(0, spawnY, 8);

    // Chibi anime sister (see characters.js)
    this.playerRig = new ChibiRig();
    this.playerGroup.add(this.playerRig.group);
    this.playerDress = this.playerRig.skirt;
    this.playerDressMat = this.playerRig.mats.dress;
    this.playerHairMat = this.playerRig.mats.hair;
    this.playerRig.group.traverse(o => { if (o.isMesh) o.castShadow = true; });

    this.accessoryGroup = this.playerRig.accessorySlot;
    this.updateSisterAccessory();

    const shieldGeo = new THREE.SphereGeometry(1.6, 32, 20);
    const shieldMat = createShieldMaterial(); // fresnel bubble, opacity 0 = off
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.5;
    this.playerGroup.add(this.shieldMesh);

    this.scene.add(this.playerGroup);
  }

  updateSisterAccessory() {
    this.applySisterLook(this.playerRig, this.activeSisterIdx);
  }

  // Hair/dress style plus the sister's little emblem (also used for remote players)
  applySisterLook(rig, idx) {
    const slot = rig.accessorySlot;
    while (slot.children.length > 0) {
      slot.remove(slot.children[0]);
    }

    rig.setStyle(idx);

    if (idx === 0) {
      const moon = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.08, 8, 16, Math.PI * 1.3),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      slot.add(moon);
    } else if (idx === 1) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshBasicMaterial({ color: 0xffe066 })
      );
      slot.add(star);

      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.04, 6, 16, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0xffd166 })
      );
      bow.position.set(0.3, -0.6, -0.25);
      bow.rotation.y = Math.PI / 2;
      slot.add(bow);
    } else if (idx === 2) {
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xff7b00 })
      );
      slot.add(sun);
      const corona = new THREE.Mesh(
        new THREE.RingGeometry(0.36, 0.52, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc300, side: THREE.DoubleSide })
      );
      slot.add(corona);
    } else if (idx === 3) {
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.05, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xc77dff })
      );
      ring1.rotation.x = Math.PI / 3;
      slot.add(ring1);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.03, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0x9d4edd })
      );
      ring2.rotation.x = Math.PI / 2.5;
      slot.add(ring2);

      const sat = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffde59 })
      );
      sat.position.set(0.55, 0.1, 0);
      slot.add(sat);
    }
  }

  switchSister(idx) {
    if (idx < 0 || idx >= SISTERS.length) return;
    this.activeSisterIdx = idx;
    this.updateSisterAccessory();
    sfx.magicSkill(idx);

    const s = SISTERS[idx];
    document.getElementById('char-name').innerHTML = `${s.name} <span style="font-size:0.9rem">${s.icon}</span>`;
    document.getElementById('char-title').textContent = s.title;
    document.getElementById('char-avatar').textContent = s.icon;

    const p1Icon = document.getElementById('circle-power1-icon');
    const p1Name = document.getElementById('circle-power1-name');
    if (p1Icon && p1Name) {
      p1Icon.textContent = s.ability1.icon;
      p1Name.textContent = s.ability1.name;
    }
    const p2Icon = document.getElementById('circle-power2-icon');
    const p2Name = document.getElementById('circle-power2-name');
    if (p2Icon && p2Name) {
      p2Icon.textContent = s.ability2.icon;
      p2Name.textContent = s.ability2.name;
    }

    const btns = document.querySelectorAll('.sister-btn[data-sister]');
    btns.forEach((b, i) => {
      b.classList.toggle('active', i === idx);
    });

    this.showFloatingText(`✨ ${s.name} ausgewählt!`, this.playerGroup.position, s.accentColor);
  }

  // ==========================================
  // 7. ABILITIES
  // ==========================================
  castAbility1() {
    if (this.cooldown1 > 0) return;
    const current = SISTERS[this.activeSisterIdx];
    this.cooldown1 = current.ability1.cooldown;
    this.coop.sendCast(1);

    if (this.activeSisterIdx === 0) {
      sfx.magicSkill(0);
      this.shieldMesh.material.opacity = 0.75;
      this.playerVelY = 0.28;
      const lp = this.playerGroup.position;
      this.fx.ringWave(lp, new THREE.Color(0.8, 1.5, 2.4), 4.5, 0.6);
      this.fx.burst(lp.clone().setY(lp.y + 1.4), [new THREE.Color(1.0, 1.4, 2.4), new THREE.Color(2.0, 2.0, 2.4)], 36, { speed: 3.5, up: 1.2, size: 0.35 });
      this.showFloatingText("🌙 Mond-Schild (7s) aktiv!", this.playerGroup.position, "#90e0ef");
      setTimeout(() => {
        this.shieldMesh.material.opacity = 0;
      }, 7000);

    } else if (this.activeSisterIdx === 1) {
      sfx.arrowShoot();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerGroup.quaternion);
      this.showFloatingText("🏹 Sternen-Bogen!", this.playerGroup.position, "#ffe066");

      this.spawnStarArrows(this.playerGroup.position, forward, false);

    } else if (this.activeSisterIdx === 2) {
      sfx.magicSkill(2);
      this.showFloatingText("☀️ SUPERNOVA!", this.playerGroup.position, "#ff7b00");
      this.createSupernovaParticles(this.playerGroup.position);
      this.damageInRadius(this.playerGroup.position, 9, 45);

    } else if (this.activeSisterIdx === 3) {
      sfx.magicSkill(3);
      this.showFloatingText("🪐 Planeten-Ringe!", this.playerGroup.position, "#9d4edd");
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerGroup.quaternion);
      this.spawnPlanetRing(this.playerGroup.position, forward, false);
    }
  }

  // Stella's star arrows; remote = visual only (the caster's client does the damage)
  spawnStarArrows(origin, forward, remote) {
    forward = forward.clone().setY(0).normalize();
    for (let i = -1.5; i <= 1.5; i += 1.0) {
      const arrowMesh = new THREE.Group();
      const head = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.32, 0),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 2.1, 0.6) })
      );
      const shaft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.6) })
      );
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = 0.2;
      arrowMesh.add(head, shaft);

      arrowMesh.position.copy(origin).add(new THREE.Vector3(0, 1.3, 0));
      const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.18);
      arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);

      this.projectiles.push({
        mesh: arrowMesh,
        dir: dir,
        speed: 0.75,
        life: 65,
        damage: 25,
        remote,
        trail: new THREE.Color(2.2, 1.7, 0.5)
      });
      this.scene.add(arrowMesh);
    }
  }

  spawnPlanetRing(origin, forward, remote) {
    forward = forward.clone().setY(0).normalize();
    const ringGroup = new THREE.Group();

    const r1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.4, 0.12, 8, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.8, 2.6) })
    );
    r1.rotation.x = Math.PI / 2;
    ringGroup.add(r1);

    const r2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.8, 0.08, 6, 32),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 1.0, 1.8) })
    );
    r2.rotation.x = Math.PI / 2.2;
    ringGroup.add(r2);

    ringGroup.position.copy(origin).add(new THREE.Vector3(0, 1.5, 0));
    this.projectiles.push({
      mesh: ringGroup,
      dir: forward,
      speed: 0.5,
      life: 80,
      damage: 32,
      remote,
      pullRadius: 7,
      trail: new THREE.Color(1.4, 0.7, 2.4),
      spin: 0.12
    });
    this.scene.add(ringGroup);
  }

  castAbility2() {
    if (this.cooldown2 > 0) return;
    const current = SISTERS[this.activeSisterIdx];
    this.cooldown2 = current.ability2.cooldown;
    this.coop.sendCast(2);

    if (this.activeSisterIdx === 0) {
      sfx.heal();
      this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + 50);
      this.updateHPBar();
      this.createHealParticles(this.playerGroup.position);
      this.showFloatingText("💚 HEILUNG! +50 HP", this.playerGroup.position, "#2ecc71");

    } else if (this.activeSisterIdx === 1) {
      // Stella: Safe Sub-stepped Star-Dash
      sfx.magicSkill(1);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerGroup.quaternion);
      const dashDist = 7.5;
      const steps = 6;
      const stepDist = dashDist / steps;
      const pRad = 0.42;
      const dashStart = this.playerGroup.position.clone();

      for (let s = 0; s < steps; s++) {
        const nextX = this.playerGroup.position.x + forward.x * stepDist;
        const nextZ = this.playerGroup.position.z + forward.z * stepDist;
        const curY = this.playerGroup.position.y;
        if (!this.checkWallCollision(nextX, nextZ, pRad, curY) && Math.abs(nextX) < 96 && Math.abs(nextZ) < 96) {
          this.playerGroup.position.x = nextX;
          this.playerGroup.position.z = nextZ;
        } else {
          break;
        }
      }

      this.showFloatingText("⚡ Sternen-Dash!", this.playerGroup.position, "#ffe066");
      const dashEnd = this.playerGroup.position;
      for (let k = 0; k < 40; k++) {
        const t = k / 40;
        const sp = new THREE.Vector3().lerpVectors(dashStart, dashEnd, t).add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0.4 + Math.random() * 1.4, (Math.random() - 0.5) * 0.6));
        this.fx.emit(sp, new THREE.Vector3(0, 0.4, 0), k % 2 ? new THREE.Color(2.6, 2.0, 0.5) : new THREE.Color(2.2, 2.2, 2.0), { size: 0.4, life: 0.4 + t * 0.5 });
      }

      for (let i = 0; i < 20; i++) {
        const sp = new THREE.Mesh(
          new THREE.SphereGeometry(0.18, 4, 4),
          new THREE.MeshBasicMaterial({ color: 0xffe066 })
        );
        sp.position.copy(this.playerGroup.position).add(new THREE.Vector3(
          (Math.random() - 0.5) * 1.5,
          Math.random() * 1.5,
          (Math.random() - 0.5) * 1.5
        ));
        this.scene.add(sp);
        this.particles.push({
          mesh: sp,
          vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, Math.random() * 0.2, (Math.random() - 0.5) * 0.2),
          life: 25
        });
      }

    } else if (this.activeSisterIdx === 2) {
      sfx.petrify();
      this.petrifyEnemies(4.0);
      this.fx.ringWave(this.playerGroup.position, new THREE.Color(1.4, 1.1, 0.8), 22, 1.0);
      this.showFloatingText("🪨 VERSTEINERUNG! (4s)", this.playerGroup.position, "#e67e22");

    } else if (this.activeSisterIdx === 3) {
      sfx.invisible();
      this.fx.burst(this.playerGroup.position.clone().setY(this.playerGroup.position.y + 1.2), [new THREE.Color(1.6, 0.8, 2.6), new THREE.Color(2.2, 1.6, 2.6)], 40, { speed: 2.5, up: 1, size: 0.35, gravity: -1 });
      this.isPlayerInvisible = true;
      this.invisibleTimer = 5.0;
      this.playerRig.setOpacity(0.25);
      this.showFloatingText("👻 UNSICHTBAR! (5s)", this.playerGroup.position, "#c77dff");
    }
  }

  petrifyEnemies(duration) {
    if (this.bossData.alive) {
      const dist = this.bossGroup.position.distanceTo(this.playerGroup.position);
      if (dist < 26) {
        if (this.coop.puppetBoss) this.coop.send({ t: 'bossPetrify', dur: duration });
        else this.petrifyBoss(duration);
        this.showFloatingText("🪨 VORTOX VERSTEINERT!", this.bossGroup.position, "#bdc3c7");
      }
    }

    this.slimes.forEach(slime => {
      if (slime.userData.alive) {
        const dist = slime.position.distanceTo(this.playerGroup.position);
        if (dist < 22) {
          slime.userData.petrifiedTimer = duration;
          this.fx.burst(slime.position.clone().setY(slime.position.y + 0.8), [new THREE.Color(1.3, 1.2, 1.1), new THREE.Color(0.9, 0.8, 0.7)], 18, { speed: 1.5, up: 1, size: 0.3 });
          this.showFloatingText("🪨 Versteinert!", slime.position, "#bdc3c7");
        }
      }
    });
  }

  petrifyBoss(duration) {
    if (this.bossData.alive) this.bossData.petrifiedTimer = Math.min(10, duration);
  }

  createHealParticles(pos) {
    this.fx.ringWave(pos, new THREE.Color(0.6, 2.4, 1.2), 3, 0.7);
    this.fx.spiral(pos, [new THREE.Color(0.5, 2.4, 1.0), new THREE.Color(0.8, 2.4, 2.0), new THREE.Color(2.0, 2.4, 1.6)], 40, 0.9, 2.6);
  }

  createSupernovaParticles(pos) {
    const core = pos.clone().setY(pos.y + 1.2);
    this.fx.flash(core, new THREE.Color(2.2, 1.2, 0.35), 6.5, 0.4);
    this.fx.ringWave(pos, new THREE.Color(1.9, 0.9, 0.25), 9, 0.55);
    this.fx.ringWave(pos, new THREE.Color(1.5, 1.35, 0.9), 6, 0.4);
    this.fx.burst(core, [new THREE.Color(3.0, 1.0, 0.2), new THREE.Color(2.8, 1.8, 0.4), new THREE.Color(2.4, 2.2, 1.2)], 90, { speed: 9, up: 3, size: 0.5, life: 0.9, gravity: 5 });
  }

  damageInRadius(pos, radius, dmg) {
    if (this.bossData.alive) {
      const d = pos.distanceTo(this.bossGroup.position);
      if (d < radius + 3) {
        this.hitBoss(dmg);
      }
    }
    this.slimes.forEach(slime => {
      if (slime.userData.alive && pos.distanceTo(slime.position) < radius) {
        slime.userData.hp -= dmg;
        sfx.hit();
        this.showFloatingText(`-${dmg}`, slime.position, "#ff4d6d");
        if (slime.userData.hp <= 0) {
          slime.userData.alive = false;
          slime.visible = false;
          this.coop.send({ t: 'slime', i: this.slimes.indexOf(slime) });
          this.showFloatingText("⭐ Slime besiegt!", slime.position, "#ffe066");
        }
      }
    });
  }

  // Hits go to the host, who owns the boss (solo play: this client is the host)
  hitBoss(dmg) {
    if (!this.bossData.alive) return;
    if (this.coop.puppetBoss) {
      this.coop.send({ t: 'bossHit', dmg });
      sfx.hit();
      return;
    }
    this.applyBossDamage(dmg);
  }

  applyBossDamage(dmg) {
    if (!this.bossData.alive) return;
    this.bossData.hp = Math.max(0, this.bossData.hp - dmg);
    sfx.hit();
    this.showFloatingText(`-${dmg} HP!`, this.bossGroup.position, "#00f0ff");
    this.updateBossBar();
    if (this.bossData.hp <= 0) this.defeatBoss();
  }

  updateBossBar() {
    const pct = (this.bossData.hp / this.bossData.maxHp) * 100;
    document.getElementById('boss-hp-bar').style.width = `${pct}%`;
  }

  defeatBoss() {
    if (!this.bossData.alive) return;
    this.bossData.alive = false;
    this.bossData.hp = 0;
    this.updateBossBar();
    this.bossGroup.visible = false;
    document.getElementById('boss-banner').classList.remove('visible');
    sfx.victory();
    this.showFloatingText("🎉 VORTOX BESIEGT! VICTORY! 🎉", this.playerGroup.position, "#ffe066");
    document.getElementById('boss-state-text').textContent = "Besiegt! Das Himmelsgebirge ist gerettet!";
  }

  setBossStateText() {
    const texts = {
      idle: "Vorsicht: Dreht sich schnell im Kreis!",
      spin: "🌪️ TORNADO-WIRBEL! GEFAHR!",
      dizzy: "💫 Vortox ist schwindelig! SCHLAGT JETZT ZU!"
    };
    document.getElementById('boss-state-text').textContent = texts[this.bossData.state] || texts.idle;
  }

  playBossSpin() {
    sfx.bossSpin();
  }

  killSlimeRemote(i) {
    const slime = this.slimes[i];
    if (!slime || !slime.userData.alive) return;
    slime.userData.alive = false;
    slime.visible = false;
    this.fx.burst(slime.position.clone().setY(slime.position.y + 0.7), [new THREE.Color(0.6, 2.4, 1.0), new THREE.Color(1.8, 2.4, 1.4)], 40, { speed: 4, up: 2, size: 0.4 });
  }

  healPlayer(amount, from) {
    this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + amount);
    this.updateHPBar();
    sfx.heal();
    this.showFloatingText(`💚 +${amount} von ${from}`, this.playerGroup.position, "#2ecc71");
  }

  // Remote spells: a matching sound if the caster is near
  sfxCast(si) {
    if (si === -1) sfx.heal();
    else if (si === 1) sfx.arrowShoot();
    else sfx.magicSkill(si);
  }

  // ==========================================
  // 8. EVENT LISTENERS & UI
  // ==========================================
  setupEvents() {
    this.setupTouchMode();
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      if (this.postFX) this.postFX.setSize();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return; // typing the player name / room code
      this.keys[e.code] = true;
      if (e.key === '1') this.switchSister(0);
      if (e.key === '2') this.switchSister(1);
      if (e.key === '3') this.switchSister(2);
      if (e.key === '4') this.switchSister(3);
      if (e.key.toLowerCase() === 'q') {
        this.switchSister((this.activeSisterIdx + 1) % 4);
      }
      if (e.key.toLowerCase() === 'e') {
        this.castAbility1();
      }
      if (e.key.toLowerCase() === 'r') {
        this.castAbility2();
      }
      if (e.key.toLowerCase() === 'h') {
        const controlsPopup = document.getElementById('controls-popup');
        const btnHelp = document.getElementById('btn-toggle-help');
        if (controlsPopup) {
          const isHidden = controlsPopup.classList.toggle('hidden');
          if (btnHelp) btnHelp.classList.toggle('active', !isHidden);
        }
      }
      if (e.code === 'Space') {
        e.preventDefault();
        this.doJump();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // Toggle Controls Popup Dialog
    const controlsPopup = document.getElementById('controls-popup');
    const btnToggleHelp = document.getElementById('btn-toggle-help');
    const btnCloseCtrl = document.getElementById('btn-close-controls');

    if (btnCloseCtrl && controlsPopup) {
      btnCloseCtrl.addEventListener('click', (e) => {
        e.stopPropagation();
        controlsPopup.classList.add('hidden');
        if (btnToggleHelp) btnToggleHelp.classList.remove('active');
        btnCloseCtrl.blur();
      });
    }

    if (btnToggleHelp && controlsPopup) {
      btnToggleHelp.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = controlsPopup.classList.toggle('hidden');
        btnToggleHelp.classList.toggle('active', !isHidden);
        btnToggleHelp.blur();
      });
    }

    document.querySelectorAll('.sister-btn[data-sister]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.sister);
        this.switchSister(idx);
        btn.blur();
      });
    });

    const modal = document.getElementById('boss2-modal');
    const btnBoss2 = document.getElementById('btn-boss2');
    if (btnBoss2) {
      btnBoss2.addEventListener('click', () => {
        modal.classList.add('open');
        btnBoss2.blur();
      });
    }
    const modalClose = document.getElementById('modal-close-btn');
    if (modalClose) {
      modalClose.addEventListener('click', () => {
        modal.classList.remove('open');
      });
    }

    const soundBtn = document.getElementById('btn-sound');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        sfx.enabled = !sfx.enabled;
        soundBtn.textContent = sfx.enabled ? "🔊 Audio: An" : "🔇 Audio: Aus";
        soundBtn.blur();
      });
    }

    const daytimeBtn = document.getElementById('btn-daytime');
    if (daytimeBtn) {
      daytimeBtn.addEventListener('click', () => {
        this.dayNight.skipToNextPhase();
        this.coop.send({ t: 'skipTime' });
        daytimeBtn.blur();
      });
    }

    const graphicsBtn = document.getElementById('btn-graphics');
    if (graphicsBtn) {
      this.updateGraphicsButton();
      graphicsBtn.addEventListener('click', () => {
        this.cycleGraphicsMode();
        graphicsBtn.blur();
      });
    }

    const fullscreenBtn = document.getElementById('btn-fullscreen');
    if (fullscreenBtn) {
      if (!document.documentElement.requestFullscreen) fullscreenBtn.remove();
      else fullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) document.exitFullscreen();
        else this.enterFullscreen();
        fullscreenBtn.blur();
      });
    }
  }

  // ---------- Touch devices ----------
  setupTouchMode() {
    const html = document.documentElement;
    const enable = () => {
      html.classList.add('touch');
      this.isTouch = true;
      this.controls.rotateSpeed = 0.7;
    };
    if (this.isTouch) enable();
    // Hybrid devices: switch to the touch layout on the first real touch
    window.addEventListener('touchstart', () => { if (!this.isTouch) enable(); }, { passive: true });

    // Quest / settings panel is a slide-in menu on touch screens
    const menuBtn = document.getElementById('btn-menu');
    if (menuBtn) {
      menuBtn.addEventListener('click', () => {
        const open = html.classList.toggle('menu-open');
        menuBtn.textContent = open ? '✕' : '📜';
        menuBtn.blur();
      });
    }

    // No long-press menu or accidental page gestures while playing
    window.addEventListener('contextmenu', (e) => { if (this.isTouch) e.preventDefault(); });
    ['gesturestart', 'gesturechange'].forEach(t =>
      document.addEventListener(t, (e) => e.preventDefault(), { passive: false }));
    window.addEventListener('orientationchange', () => {
      setTimeout(() => window.dispatchEvent(new Event('resize')), 250);
    });
  }

  enterFullscreen() {
    const root = document.documentElement;
    if (!root.requestFullscreen) return;
    root.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => { /* denied or unsupported (e.g. iPhone Safari) */ });
  }

  haptic(ms = 12) {
    if (this.isTouch && navigator.vibrate) navigator.vibrate(ms);
  }

  setupRobloxControls() {
    const btnStart = document.getElementById('btn-start-game');
    const introScreen = document.getElementById('intro-screen');
    if (btnStart && introScreen) {
      const startAdventure = () => {
        sfx.startBGM();
        introScreen.classList.add('hidden');
        this.perf.arm();
        if (this.isTouch) {
          this.enterFullscreen();
          if (window.matchMedia('(orientation: portrait)').matches) {
            this.showToast('📱 Tipp: Halte das Handy quer, dann spielt es sich besser', 6000);
          }
        }
      };
      btnStart.addEventListener('click', startAdventure);

      // Co-op lobby: name + room code, then join the relay server this page came from
      const btnCoop = document.getElementById('btn-start-coop');
      const nameInput = document.getElementById('player-name');
      const roomInput = document.getElementById('room-code');
      const status = document.getElementById('coop-status');
      if (btnCoop && nameInput && roomInput && status) {
        try {
          nameInput.value = localStorage.getItem('gs-player-name') || '';
          roomInput.value = localStorage.getItem('gs-room') || 'GALAXY';
        } catch (e) { /* storage unavailable */ }
        const roomParam = new URLSearchParams(location.search).get('room');
        if (roomParam) roomInput.value = roomParam;

        btnCoop.addEventListener('click', async () => {
          const name = nameInput.value.trim() || 'Spieler';
          const room = roomInput.value.trim() || 'GALAXY';
          try {
            localStorage.setItem('gs-player-name', name);
            localStorage.setItem('gs-room', room);
          } catch (e) { /* ignore */ }
          btnCoop.disabled = true;
          status.textContent = '📡 Verbinde …';
          try {
            await this.coop.join({ name, room });
            startAdventure();
          } catch (err) {
            status.textContent = err.message === 'full'
              ? '🚫 Dieser Raum ist voll (max. 4 Spieler).'
              : '📡 Kein Koop-Server erreichbar. Starte start_multiplayer.bat und öffne die dort angezeigte Adresse.';
          } finally {
            btnCoop.disabled = false;
          }
        });
      }
    }

    const btnJump = document.getElementById('circle-jump');
    if (btnJump) {
      const handleJump = (e) => {
        e.preventDefault();
        this.haptic(10);
        this.doJump();
        btnJump.blur();
      };
      btnJump.addEventListener('touchstart', handleJump, { passive: false });
      btnJump.addEventListener('mousedown', handleJump);
    }

    const btnP1 = document.getElementById('circle-power1');
    if (btnP1) {
      const handleP1 = (e) => {
        e.preventDefault();
        this.haptic(14);
        this.castAbility1();
        btnP1.blur();
      };
      btnP1.addEventListener('touchstart', handleP1, { passive: false });
      btnP1.addEventListener('mousedown', handleP1);
    }

    const btnP2 = document.getElementById('circle-power2');
    if (btnP2) {
      const handleP2 = (e) => {
        e.preventDefault();
        this.haptic(14);
        this.castAbility2();
        btnP2.blur();
      };
      btnP2.addEventListener('touchstart', handleP2, { passive: false });
      btnP2.addEventListener('mousedown', handleP2);
    }

    const joystickBase = document.getElementById('joystick-base');
    const joystickThumb = document.getElementById('joystick-thumb');
    if (joystickBase && joystickThumb) {
      let isDragging = false;
      let touchId = null; // the finger that owns the stick (the other hand turns the camera)
      let startX = 0;
      let startY = 0;
      let maxRadius = 42;

      const startJoy = (clientX, clientY) => {
        isDragging = true;
        const rect = joystickBase.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
        maxRadius = rect.width * 0.35;
        moveJoy(clientX, clientY);
      };

      const moveJoy = (clientX, clientY) => {
        if (!isDragging) return;
        let dx = clientX - startX;
        let dy = clientY - startY;
        const dist = Math.hypot(dx, dy);
        if (dist > maxRadius) {
          dx = (dx / dist) * maxRadius;
          dy = (dy / dist) * maxRadius;
        }
        joystickThumb.style.transform = `translate(${dx}px, ${dy}px)`;
        // Small dead zone so a resting thumb does not creep
        const mag = Math.hypot(dx, dy) / maxRadius;
        const dead = 0.14;
        const k = mag < dead ? 0 : (mag - dead) / (1 - dead) / mag;
        this.joystickDelta.x = (dx / maxRadius) * k;
        this.joystickDelta.y = (dy / maxRadius) * k;
      };

      const endJoy = () => {
        isDragging = false;
        touchId = null;
        joystickThumb.style.transform = 'translate(0px, 0px)';
        this.joystickDelta.x = 0;
        this.joystickDelta.y = 0;
      };

      const findTouch = (list) => {
        for (let i = 0; i < list.length; i++) if (list[i].identifier === touchId) return list[i];
        return null;
      };

      joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (touchId !== null || e.changedTouches.length === 0) return;
        const t = e.changedTouches[0];
        touchId = t.identifier;
        startJoy(t.clientX, t.clientY);
      }, { passive: false });

      window.addEventListener('touchmove', (e) => {
        if (!isDragging || touchId === null) return;
        const t = findTouch(e.touches);
        if (t) moveJoy(t.clientX, t.clientY);
      }, { passive: false });

      const touchEnd = (e) => {
        if (touchId !== null && findTouch(e.changedTouches)) endJoy();
      };
      window.addEventListener('touchend', touchEnd);
      window.addEventListener('touchcancel', touchEnd);

      joystickBase.addEventListener('mousedown', (e) => {
        e.preventDefault();
        startJoy(e.clientX, e.clientY);
      });
      window.addEventListener('mousemove', (e) => {
        if (isDragging) moveJoy(e.clientX, e.clientY);
      });
      window.addEventListener('mouseup', endJoy);
    }
  }

  setupUI() {
    this.switchSister(0);
  }

  showFloatingText(text, worldPos, color = '#fff') {
    const el = document.createElement('div');
    el.className = 'floating-text';
    el.textContent = text;
    el.style.color = color;

    const screenPos = worldPos.clone().project(this.camera);
    const x = (screenPos.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-(screenPos.y * 0.5) + 0.5) * window.innerHeight;

    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    document.body.appendChild(el);

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1200);
  }

  spawnRunningParticle() {
    if (Math.random() > 0.4) return;
    const s = SISTERS[this.activeSisterIdx];
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 4, 4),
      new THREE.MeshBasicMaterial({ color: s.themeColor, transparent: true, opacity: 0.85 })
    );
    pMesh.position.set(
      this.playerGroup.position.x + (Math.random() - 0.5) * 0.35,
      this.playerGroup.position.y + 0.15,
      this.playerGroup.position.z + (Math.random() - 0.5) * 0.35
    );
    this.scene.add(pMesh);
    this.runningParticles.push({
      mesh: pMesh,
      vel: new THREE.Vector3((Math.random() - 0.5) * 0.02, 0.02 + Math.random() * 0.02, (Math.random() - 0.5) * 0.02),
      life: 20
    });
  }

  updateRunningParticles() {
    for (let i = this.runningParticles.length - 1; i >= 0; i--) {
      const pt = this.runningParticles[i];
      pt.mesh.position.add(pt.vel);
      pt.mesh.scale.multiplyScalar(0.92);
      pt.life--;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.runningParticles.splice(i, 1);
      }
    }
  }

  // ==========================================
  // 9. GAME LOOP, PHYSICS & ANIMATION
  // ==========================================
  animate() {
    requestAnimationFrame(() => this.animate());

    const rawDelta = this.clock.getDelta();
    const delta = Math.min(rawDelta, 0.05);
    const dtFactor = delta * 60; // normalized to 60fps baseline
    this.perf.update(rawDelta);

    // Ability Cooldown Timers
    if (this.cooldown1 > 0) {
      this.cooldown1 = Math.max(0, this.cooldown1 - delta);
      const p1CdOverlay = document.getElementById('circle-power1-cd');
      if (p1CdOverlay) {
        if (this.cooldown1 > 0) {
          p1CdOverlay.classList.add('active');
          p1CdOverlay.textContent = `${this.cooldown1.toFixed(1)}s`;
        } else {
          p1CdOverlay.classList.remove('active');
          p1CdOverlay.textContent = '';
        }
      }
    }

    if (this.cooldown2 > 0) {
      this.cooldown2 = Math.max(0, this.cooldown2 - delta);
      const p2CdOverlay = document.getElementById('circle-power2-cd');
      if (p2CdOverlay) {
        if (this.cooldown2 > 0) {
          p2CdOverlay.classList.add('active');
          p2CdOverlay.textContent = `${this.cooldown2.toFixed(1)}s`;
        } else {
          p2CdOverlay.classList.remove('active');
          p2CdOverlay.textContent = '';
        }
      }
    }

    // Invisibility timer for Planeta
    if (this.isPlayerInvisible) {
      this.invisibleTimer = Math.max(0, this.invisibleTimer - delta);
      if (this.invisibleTimer <= 0) {
        this.isPlayerInvisible = false;
        this.playerRig.setOpacity(1.0);
        this.showFloatingText("✨ Wieder sichtbar!", this.playerGroup.position, "#c77dff");
      }
    }

    // 9.1 Player Movement with verified physics
    this.updatePlayerMovement(delta, dtFactor);
    this.playerRig.update(delta, {
      moving: this.playerIsMoving,
      grounded: this.isGrounded,
      swimming: this.isSwimming,
      velY: this.playerVelY
    });

    // 9.2 Projectiles & Particles
    this.updateProjectiles();

    // 9.3 Boss Vortox AI & Attacks
    this.updateBossAI(delta);

    // 9.3b Co-op: send our state, move the other sisters, follow the host's boss
    this.coop.update(delta, dtFactor);

    // 9.4 Ambient Animations (Creatures, Grass Sway, Water, Petals, Bees)
    this.updateWorldAmbience(delta);

    // Dynamic BGM based on distance to boss
    if (this.bossData && this.bossData.alive) {
      const dist = this.bossGroup.position.distanceTo(this.playerGroup.position);
      sfx.setBGMMode(dist < 28 ? 'boss' : 'peaceful');
    }

    // Camera follow (undo last frame's collision push so the chosen zoom is kept)
    if (this.cameraDesired) this.camera.position.copy(this.cameraDesired);
    const playerPos = this.playerGroup.position;
    if (!this.prevPlayerPos) {
      this.prevPlayerPos = playerPos.clone();
    }
    const deltaMove = new THREE.Vector3().subVectors(playerPos, this.prevPlayerPos);
    this.camera.position.add(deltaMove);
    this.prevPlayerPos.copy(playerPos);

    const targetY = playerPos.y + 1.6;
    this.controls.target.lerp(
      new THREE.Vector3(playerPos.x, targetY, playerPos.z),
      0.22
    );
    this.controls.update();
    if (!this.cameraDesired) this.cameraDesired = new THREE.Vector3();
    this.cameraDesired.copy(this.camera.position);
    this.resolveCameraCollision();

    // Sky dome stays centered on the camera
    this.skyDome.position.copy(this.camera.position);

    if (this.graphicsQuality === 'high' && this.postFX) {
      this.postFX.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Keep the camera out of hills, cliffs and water: pull it in along the view ray
  resolveCameraCollision() {
    const target = this.controls.target;
    const cam = this.camera.position;
    const dir = this._camDir || (this._camDir = new THREE.Vector3());
    dir.subVectors(cam, target);
    const dist = dir.length();
    if (dist < 0.01) return;
    dir.divideScalar(dist);

    let allowed = dist;
    const samples = 18;
    for (let i = 1; i <= samples; i++) {
      const d = (i / samples) * dist;
      const px = target.x + dir.x * d;
      const pz = target.z + dir.z * d;
      if (target.y + dir.y * d < this.getTerrainHeight(px, pz) + 0.5) {
        allowed = Math.max(1.4, d - dist / samples);
        break;
      }
    }
    // Snap in quickly when blocked, glide back out smoothly
    if (this.camAllowed === undefined || allowed < this.camAllowed) this.camAllowed = allowed;
    else this.camAllowed += (allowed - this.camAllowed) * 0.08;

    cam.copy(target).addScaledVector(dir, Math.min(dist, this.camAllowed));
    const ground = this.getTerrainHeight(cam.x, cam.z) + 0.5;
    const water = this.getWaterSurface(cam.x, cam.z);
    const floor = water !== null ? Math.max(ground, water + 0.4) : ground;
    if (cam.y < floor) {
      cam.y = floor;
      this.camera.lookAt(target);
    }
  }

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
  }

  // Keeps bees, butterflies & fireflies out of walls, columns, trunks, ground, water and platforms
  constrainFlyer(pos, clearance = 0.35, radius = 0.3) {
    // Two passes so a push out of one obstacle cannot leave the flyer inside a neighbour
    for (let pass = 0; pass < 2; pass++) this.pushFlyerOutOfColliders(pos, clearance, radius);
    const floor = this.getFlyerFloor(pos.x, pos.y, pos.z) + clearance;
    if (pos.y < floor) pos.y = floor;
    return pos;
  }

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

  checkWallCollision(px, pz, radius, py) {
    const footY = py;
    const headY = py + 1.8;

    for (let i = 0; i < this.colliders.length; i++) {
      const c = this.colliders[i];
      if (headY < c.minY || footY > c.maxY) continue;

      if (c.type === 'cylinder') {
        const dx = px - c.x;
        const dz = pz - c.z;
        const minDist = c.radius + radius;
        if (dx * dx + dz * dz < minDist * minDist) {
          return true;
        }
      } else if (c.type === 'box') {
        if (
          px + radius > c.minX &&
          px - radius < c.maxX &&
          pz + radius > c.minZ &&
          pz - radius < c.maxZ
        ) {
          return true;
        }
      }
    }
    return false;
  }

  // River & night quests (see quests.js); every finished quest adds +10 max HP
  buildWorldQuests() {
    this.quests = new QuestSystem(this, {
      onCollect: (text) => {
        this.showFloatingText(text, this.playerGroup.position, '#9ff3ff');
        sfx.collect();
      },
      onQuestDone: (quest) => {
        this.applyQuestRewards(true);
        this.showFloatingText(`🏆 Quest geschafft: ${quest.name}! +10 max. HP`, this.playerGroup.position, '#ffd166');
        this.createSupernovaParticles(this.playerGroup.position.clone());
        sfx.victory();
      },
      onAllDone: () => {
        setTimeout(() => {
          this.showFloatingText('🌟 Alle Quests geschafft – die Himmelsgebirge danken dir!', this.playerGroup.position, '#ffb3ec');
          sfx.victory();
        }, 1500);
      }
    });
    this.applyQuestRewards(false);
  }

  applyQuestRewards(heal) {
    const done = QUEST_DEFS.filter(q => this.quests.state.done[q.id]).length;
    this.maxPlayerHP = 100 + done * 10;
    this.playerHP = heal ? this.maxPlayerHP : Math.min(this.playerHP, this.maxPlayerHP);
    this.updateHPBar();
  }

  updateHPBar() {
    const bar = document.getElementById('player-hp-bar');
    if (bar) bar.style.width = `${(this.playerHP / this.maxPlayerHP) * 100}%`;
  }

  onEnterWater(waterY) {
    const pos = this.playerGroup.position;
    for (let i = 0; i < 16; i++) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.09 + Math.random() * 0.06, 6, 6),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.4 ? 0xe0fbff : 0x7fd8ff })
      );
      drop.position.set(pos.x, waterY + 0.1, pos.z);
      const ang = Math.random() * Math.PI * 2;
      const spd = 0.04 + Math.random() * 0.06;
      this.particles.push({
        mesh: drop,
        vel: new THREE.Vector3(Math.cos(ang) * spd, 0.12 + Math.random() * 0.1, Math.sin(ang) * spd),
        gravity: 0.012,
        life: 26
      });
      this.scene.add(drop);
    }
    this.spawnSwimRipple(true);
    sfx.splash();
    if (!this.swimHintShown) {
      this.swimHintShown = true;
      this.showFloatingText('🌊 Schwimmen! (Leertaste = raus springen)', pos, '#5ce1e6');
    }
  }

  playFootstep(moveStep) {
    this.stepDistance = (this.stepDistance || 0) + moveStep;
    const stride = this.isSwimming ? 2.2 : 1.15;
    if (this.stepDistance < stride) return;
    this.stepDistance = 0;
    if (this.isSwimming) {
      sfx.swim();
      return;
    }
    if (!this.isGrounded) return;
    let surface = 'grass';
    if (this.currentBridge) surface = this.currentBridge.kind || 'wood';
    else if (this.waterSpeedFactor < 1) surface = 'water';
    else if (this.standingOnPlatform) surface = this.standingOnPlatform.type === 'cylinder' && this.standingOnPlatform.crystal ? 'crystal' : 'stone';
    sfx.step(surface);
  }

  updateDaytimeButton() {
    const btn = document.getElementById('btn-daytime');
    if (!btn) return;
    const ph = this.dayNight.phase;
    if (ph === this.lastPhaseShown) return;
    this.lastPhaseShown = ph;
    btn.textContent = `${ph.icon} ${ph.name} ⏩`;
  }

  spawnSwimRipple(force) {
    const now = this.clock.elapsedTime;
    if (!force && now - (this.lastRippleTime || 0) < 0.28) return;
    this.lastRippleTime = now;
    if (!this.rippleMat) {
      this.rippleMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
      this.rippleGeo = new THREE.RingGeometry(0.42, 0.52, 28);
      this.rippleGeo.rotateX(-Math.PI / 2);
      this.ripples = [];
    }
    const waterY = this.getWaterSurface(this.playerGroup.position.x, this.playerGroup.position.z);
    if (waterY === null) return;
    const ring = new THREE.Mesh(this.rippleGeo, this.rippleMat.clone());
    ring.position.set(this.playerGroup.position.x, waterY + 0.03, this.playerGroup.position.z);
    ring.renderOrder = 3;
    this.scene.add(ring);
    this.ripples.push({ mesh: ring, life: 0 });
  }

  updateSwimRipples(delta) {
    if (!this.ripples) return;
    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.life += delta;
      const s = 1 + r.life * 3.2;
      r.mesh.scale.set(s, 1, s);
      r.mesh.material.opacity = Math.max(0, 0.6 * (1 - r.life / 1.1));
      if (r.life > 1.1) {
        this.scene.remove(r.mesh);
        r.mesh.material.dispose();
        this.ripples.splice(i, 1);
      }
    }
  }

  doJump() {
    this.jumpBufferTimer = 0.12; // 120ms jump buffer
    const current = SISTERS[this.activeSisterIdx];
    if (this.isGrounded || this.coyoteTimer > 0) {
      // A little dolphin kick helps climbing out of deep water
      this.playerVelY = current.jumpPower * (this.isSwimming ? 1.25 : 1);
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      sfx.jump();
    }
  }

  // ==========================================
  // 9.1 VERIFIED SMOOTH PHYSICS & MOVEMENT
  // ==========================================
  updatePlayerMovement(delta, dtFactor) {
    const current = SISTERS[this.activeSisterIdx];
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    if (this.joystickDelta.x !== 0 || this.joystickDelta.y !== 0) {
      moveX += this.joystickDelta.x;
      moveZ += this.joystickDelta.y;
    }

    const isMoving = (moveX !== 0 || moveZ !== 0);
    this.playerIsMoving = isMoving;

    if (isMoving) {
      const moveVec = new THREE.Vector3(moveX, 0, moveZ);
      if (moveVec.length() > 1) moveVec.normalize();
      
      const camEuler = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
      moveVec.applyEuler(camEuler);

      const oldX = this.playerGroup.position.x;
      const oldZ = this.playerGroup.position.z;
      const playerRadius = 0.42;
      const playerY = this.playerGroup.position.y;
      const moveStep = current.speed * dtFactor * this.waterSpeedFactor;

      // X-axis movement & collision
      const nextX = oldX + moveVec.x * moveStep;
      if (!this.checkWallCollision(nextX, oldZ, playerRadius, playerY) && Math.abs(nextX) <= 96) {
        this.playerGroup.position.x = nextX;
      }

      // Z-axis movement & collision
      const nextZ = oldZ + moveVec.z * moveStep;
      if (!this.checkWallCollision(this.playerGroup.position.x, nextZ, playerRadius, playerY) && Math.abs(nextZ) <= 96) {
        this.playerGroup.position.z = nextZ;
      }

      // Bridge rails: keep the player on the deck while walking across
      const br = this.currentBridge;
      if (br) {
        const rx = this.playerGroup.position.x - br.ax;
        const rz = this.playerGroup.position.z - br.az;
        const along = rx * br.dirX + rz * br.dirZ;
        const side = -rx * br.dirZ + rz * br.dirX;
        if (along > 0.3 && along < br.len - 0.3 && Math.abs(side) > br.railLimit) {
          const corr = (Math.sign(side) * br.railLimit - side) * 0.5;
          this.playerGroup.position.x += -br.dirZ * corr;
          this.playerGroup.position.z += br.dirX * corr;
        }
      }

      const targetAngle = Math.atan2(moveVec.x, moveVec.z);
      this.playerGroup.rotation.y = targetAngle;

      this.playerDress.rotation.z = Math.sin(Date.now() * 0.015) * 0.04;

      if (this.isSwimming) {
        this.spawnSwimRipple(false);
      } else if (this.isGrounded) {
        this.spawnRunningParticle();
      }
      this.playFootstep(moveStep);
    } else {
      this.playerDress.rotation.z = 0;
    }

    // World boundary protection (Allows scaling the surrounding mountain peaks)
    this.playerGroup.position.x = Math.max(-96, Math.min(96, this.playerGroup.position.x));
    this.playerGroup.position.z = Math.max(-96, Math.min(96, this.playerGroup.position.z));

    // Vertical Physics
    const prevY = this.playerGroup.position.y;
    this.playerVelY -= current.gravity * dtFactor;
    this.playerGroup.position.y += this.playerVelY * dtFactor;

    const px = this.playerGroup.position.x;
    const pz = this.playerGroup.position.z;
    const py = this.playerGroup.position.y;

    // Platform collision check (AABB boxes for temple/stairs, cylinders for obby, arched bridges)
    let bestPlatform = null;
    let bestTopY = -Infinity;
    for (let i = 0; i < this.platforms.length; i++) {
      const plat = this.platforms[i];
      let isInside = false;
      let topY = plat.topY;

      if (plat.type === 'box') {
        isInside = (px >= plat.minX && px <= plat.maxX && pz >= plat.minZ && pz <= plat.maxZ);
      } else if (plat.type === 'cylinder') {
        const dx = px - plat.x;
        const dz = pz - plat.z;
        isInside = (dx * dx + dz * dz <= plat.radius * plat.radius);
      } else if (plat.type === 'bridge') {
        const rx = px - plat.ax;
        const rz = pz - plat.az;
        const along = rx * plat.dirX + rz * plat.dirZ;
        const side = -rx * plat.dirZ + rz * plat.dirX;
        isInside = along >= 0 && along <= plat.len && Math.abs(side) <= plat.halfWidth;
        if (isInside) topY = bridgeDeckY(plat, along / plat.len);
      }

      if (isInside) {
        // Continuous swept collision: checks landing from prevY down to py
        const minCheckY = py - 0.35;
        const maxCheckY = Math.max(prevY + 0.15, py + 0.55);
        if (topY >= minCheckY && topY <= maxCheckY && topY > bestTopY) {
          bestPlatform = plat;
          bestTopY = topY;
        }
      }
    }

    // Ground elevation from the terrain heightfield
    const groundY = this.getTerrainHeight(px, pz);

    // Water: deep enough -> swim with head & shoulders above the surface
    const waterY = this.getWaterSurface(px, pz);
    const swimFloatY = waterY !== null ? waterY - 1.05 : -Infinity;
    const canSwim = waterY !== null && groundY < swimFloatY - 0.05;
    const wasSwimming = this.isSwimming;

    this.currentBridge = null;
    this.standingOnPlatform = null;
    if (bestPlatform && this.playerVelY <= 0.1) {
      if (bestPlatform.type === 'bridge') this.currentBridge = bestPlatform;
      else this.standingOnPlatform = bestPlatform;
      this.playerGroup.position.y = bestTopY;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
      this.isSwimming = false;
    } else if (canSwim && this.playerGroup.position.y <= swimFloatY + 0.02) {
      const bob = Math.sin(this.clock.elapsedTime * 3.2) * 0.05;
      const target = swimFloatY + bob;
      this.playerGroup.position.y += (target - this.playerGroup.position.y) * Math.min(1, 0.18 * dtFactor);
      this.playerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
      this.isSwimming = true;
    } else if (this.playerGroup.position.y <= groundY) {
      this.playerGroup.position.y = groundY;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
      this.isSwimming = false;
    } else {
      this.isGrounded = false;
      this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
      this.isSwimming = false;
    }

    if (this.isSwimming && !wasSwimming) {
      this.onEnterWater(waterY);
    }

    // Wading slows down, swimming even more
    const feetDepth = waterY !== null && !bestPlatform ? waterY - this.playerGroup.position.y : 0;
    this.waterSpeedFactor = this.isSwimming ? 0.62 : (feetDepth > 0.35 ? 0.8 : 1);

    // Jump Buffering check
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
      if (this.isGrounded) {
        this.playerVelY = current.jumpPower * (this.isSwimming ? 1.25 : 1);
        this.isGrounded = false;
        this.jumpBufferTimer = 0;
        this.coyoteTimer = 0;
        sfx.jump();
      }
    }
  }

  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.addScaledVector(p.dir, p.speed);
      p.life--;
      if (p.spin) p.mesh.rotation.y += p.spin;
      if (p.trail) {
        for (let k = 0; k < 2; k++) {
          const jitter = new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3);
          this.fx.emit(p.mesh.position.clone().add(jitter), jitter.multiplyScalar(0.5), p.trail, { size: 0.32, life: 0.35 });
        }
      }

      if (!p.remote && this.bossData.alive && p.mesh.position.distanceTo(this.bossGroup.position) < 3.8) {
        this.fx.flash(p.mesh.position, p.trail || new THREE.Color(2, 2, 2), 3, 0.25);
        this.fx.burst(p.mesh.position, [p.trail || new THREE.Color(2, 2, 2), new THREE.Color(2.2, 2.2, 2.2)], 22, { speed: 4, up: 1.5, size: 0.35 });
        this.hitBoss(p.damage);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (!p.remote) this.slimes.forEach(slime => {
        if (slime.userData.alive && p.mesh.position.distanceTo(slime.position) < 1.6) {
          slime.userData.hp -= p.damage;
          this.showFloatingText(`-${p.damage}`, slime.position, "#ffd166");
          this.fx.burst(p.mesh.position, [p.trail || new THREE.Color(2, 2, 2)], 10, { speed: 3, up: 1, size: 0.3 });
          if (slime.userData.hp <= 0) {
            slime.userData.alive = false;
            slime.visible = false;
            this.coop.send({ t: 'slime', i: this.slimes.indexOf(slime) });
            this.fx.burst(slime.position.clone().setY(slime.position.y + 0.7), [new THREE.Color(0.6, 2.4, 1.0), new THREE.Color(1.8, 2.4, 1.4)], 40, { speed: 4, up: 2, size: 0.4 });
            this.fx.ringWave(slime.position, new THREE.Color(0.6, 2.2, 1.0), 3, 0.5);
          }
        }
      });

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
      }
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const pt = this.particles[i];
      if (pt.gravity) pt.vel.y -= pt.gravity;
      pt.mesh.position.add(pt.vel);
      pt.life--;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  // Nearest visible sister (local or remote): the boss chases whoever is closest
  getBossTarget() {
    let best = null;
    let bestDist = Infinity;
    const consider = (pos) => {
      const d = pos.distanceTo(this.bossGroup.position);
      if (d < bestDist) { bestDist = d; best = pos; }
    };
    if (!this.isPlayerInvisible) consider(this.playerGroup.position);
    this.remotes.list.forEach(r => { if (r.hasState && !r.invisible) consider(r.group.position); });
    return best;
  }

  updateBossAI(delta) {
    const b = this.bossData;
    if (!b.alive) return;
    const puppet = this.coop.puppetBoss; // another player is the host: state arrives over the network

    if (b.petrifiedTimer > 0) {
      if (!puppet) b.petrifiedTimer -= delta;
      document.getElementById('boss-state-text').textContent = `🪨 VERSTEINERT! (${Math.max(0, b.petrifiedTimer).toFixed(1)}s)`;
      this.bossWasPetrified = true;
      return;
    }
    if (this.bossWasPetrified) {
      this.bossWasPetrified = false;
      this.setBossStateText();
    }

    const distToPlayer = this.bossGroup.position.distanceTo(this.playerGroup.position);
    document.getElementById('boss-banner').classList.toggle('visible', distToPlayer < 24);

    const wingFlap = Math.sin(Date.now() * 0.008) * 0.4;
    this.leftWing.rotation.y = 0.6 + wingFlap;
    this.rightWing.rotation.y = -0.6 - wingFlap;

    // The whirl hurts whoever is caught by it: every client checks its own sister
    if (b.state === 'spin' && distToPlayer < 3.8) {
      if (this.activeSisterIdx === 0 && this.shieldMesh.material.opacity > 0) {
        this.showFloatingText("🛡️ Mond-Schild blockt Wirbel!", this.playerGroup.position, "#90e0ef");
      } else {
        this.playerHP = Math.max(0, this.playerHP - 0.4);
        this.updateHPBar();
      }
    }

    if (puppet) return;

    b.timer += delta;
    const target = this.getBossTarget();
    if (!target) return;
    const distToTarget = target.distanceTo(this.bossGroup.position);

    if (b.state === 'idle') {
      this.bossGroup.lookAt(target.x, this.bossGroup.position.y, target.z);

      if (distToTarget < 18) {
        b.state = 'spin';
        b.timer = 0;
        this.setBossStateText();
        sfx.bossSpin();
      }
    } else if (b.state === 'spin') {
      this.bossGroup.rotation.y += 0.35;

      const dir = new THREE.Vector3().subVectors(target, this.bossGroup.position);
      dir.y = 0;
      dir.normalize();
      this.bossGroup.position.addScaledVector(dir, 0.12);

      if (b.timer > 3.5) {
        b.state = 'dizzy';
        b.timer = 0;
        this.setBossStateText();
        this.showFloatingText("💫 Boss ist schwindelig!", this.bossGroup.position, "#ffdf6b");
      }
    } else if (b.state === 'dizzy') {
      this.bossGroup.rotation.z = Math.sin(Date.now() * 0.01) * 0.25;

      if (b.timer > 4.0) {
        this.bossGroup.rotation.z = 0;
        b.state = 'idle';
        b.timer = 0;
        this.setBossStateText();
      }
    }
  }

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
  }

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
  }

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
  }

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
  }

  updateLavender() {
    if (!this.lavenderStems || this.lavenderStems.length === 0) return;
    const windTime = Date.now() * 0.0028;
    for (let i = 0; i < this.lavenderStems.length; i++) {
      const stem = this.lavenderStems[i];
      stem.rotation.z = Math.sin(windTime + stem.userData.phase) * 0.08;
      stem.rotation.x = Math.cos(windTime * 0.85 + stem.userData.phase) * 0.05;
    }
  }
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btn-start-game');
  const startLabel = btnStart ? btnStart.innerHTML : '';
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.style.opacity = '0.75';
    btnStart.innerHTML = '<span>⏳</span> Welt wird gebaut …';
  }

  // Let the intro screen paint before the world generation blocks the main thread
  requestAnimationFrame(() => setTimeout(() => {
    const game = new GalaxySistersGame();
    if (btnStart) {
      btnStart.disabled = false;
      btnStart.style.opacity = '';
      btnStart.innerHTML = startLabel;
    }
    // Handy for tweaking the world from the dev console on a local server
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      window.galaxyGame = game;
      window.galaxySfx = sfx;
    }
  }, 30));
});
