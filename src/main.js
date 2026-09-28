import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ==========================================
// 1. SOUND SYSTEM (Web Audio API Synthesizer & Dynamic BGM)
// ==========================================
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.bgmPlaying = false;
    this.bgmMode = 'peaceful'; // 'peaceful' or 'boss'
    this.bgmStep = 0;
    this.bgmTimer = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startBGM() {
    this.init();
    if (!this.enabled || !this.ctx || this.bgmPlaying) return;
    this.bgmPlaying = true;
    this.runBGMStep();
  }

  setBGMMode(mode) {
    this.bgmMode = mode;
  }

  runBGMStep() {
    if (!this.bgmPlaying || !this.ctx || !this.enabled) {
      this.bgmTimer = setTimeout(() => this.runBGMStep(), 300);
      return;
    }

    const isBoss = this.bgmMode === 'boss';
    const intervalMs = isBoss ? 160 : 340;

    // Peaceful: Pentatonic calming tones (C, D, E, G, A) in gentle octave
    const peacefulNotes = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25];
    // Boss: Driving dramatic minor bassline and adventurous lead
    const bossBass = [73.42, 82.41, 87.31, 98.00, 110.00, 130.81];
    const bossLead = [293.66, 311.13, 349.23, 392.00, 440.00, 466.16, 523.25, 587.33];

    try {
      if (isBoss) {
        // Dramatic adventurous boss pulse
        const bassFreq = bossBass[this.bgmStep % bossBass.length];
        this.playTone(bassFreq, 'sawtooth', 0.16, 0.14);

        if (this.bgmStep % 2 === 0) {
          const leadFreq = bossLead[(this.bgmStep * 3) % bossLead.length];
          this.playTone(leadFreq, 'triangle', 0.2, 0.12);
        }
      } else {
        // Calm, gentle meadow ambience
        if (this.bgmStep % 2 === 0) {
          const n = peacefulNotes[(this.bgmStep + Math.floor(this.bgmStep / 8)) % peacefulNotes.length];
          this.playTone(n, 'sine', 0.35, 0.045);
        } else if (this.bgmStep % 4 === 1) {
          const n2 = peacefulNotes[(this.bgmStep * 2) % peacefulNotes.length];
          this.playTone(n2 * 1.5, 'triangle', 0.25, 0.025);
        }
      }
    } catch (e) {}

    this.bgmStep++;
    this.bgmTimer = setTimeout(() => this.runBGMStep(), intervalMs);
  }

  playTone(freq, type = 'sine', duration = 0.15, gainVal = 0.1) {
    if (!this.enabled || !this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(gainVal, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {}
  }

  jump() {
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(280, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(560, this.ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.12, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.18);
    } catch (e) {}
  }

  arrowShoot() {
    this.init();
    this.playTone(660, 'sine', 0.08, 0.14);
    setTimeout(() => this.playTone(880, 'triangle', 0.12, 0.12), 35);
  }

  heal() {
    this.init();
    [440, 554, 659, 880, 1108].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.25, 0.1), i * 50);
    });
  }

  petrify() {
    this.init();
    this.playTone(180, 'sawtooth', 0.35, 0.2);
    setTimeout(() => this.playTone(95, 'triangle', 0.45, 0.22), 70);
  }

  invisible() {
    this.init();
    [587, 493, 440, 329].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'sine', 0.3, 0.09), i * 50);
    });
  }

  magicSkill(sisterIdx) {
    this.init();
    if (!this.ctx) return;
    const freqs = [
      [330, 440, 660],       // Luna
      [523, 659, 784, 1046], // Stella
      [220, 330, 440, 880],  // Sol
      [180, 270, 360, 540]   // Planeta
    ][sisterIdx] || [440, 880];

    freqs.forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.15, 0.1), i * 40);
    });
  }

  hit() {
    this.init();
    this.playTone(140, 'sawtooth', 0.15, 0.18);
  }

  bossSpin() {
    this.init();
    this.playTone(90, 'sawtooth', 0.4, 0.15);
  }

  victory() {
    this.init();
    [440, 554, 659, 880].forEach((f, i) => {
      setTimeout(() => this.playTone(f, 'triangle', 0.3, 0.15), i * 90);
    });
  }
}

const sfx = new SoundFX();

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
    this.waterMesh = null;
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
    this.mountainsData = [];
    
    this.initMountainsData();
    this.initScene();
    this.buildWorld();
    this.createPlayerMesh();
    this.createBossVortox();
    this.setupUI();
    this.setupEvents();
    this.setupRobloxControls();
    this.animate();
  }

  // ==========================================
  // 3.0 MOUNTAINS GEOMETRY DATA
  // Deterministic mountain peaks allowing seamless climbing and matching visuals
  // ==========================================
  initMountainsData() {
    this.mountainsData = [];
    const mountainColors = [0x5f749d, 0x6e81a8, 0x7c90b6, 0x8fa4c8];
    for (let i = 0; i < 18; i++) {
      const angle = (i / 18) * Math.PI * 2;
      const pRand1 = ((i * 137.5) % 100) / 100;
      const pRand2 = ((i * 241.7 + 37) % 100) / 100;
      const pRand3 = ((i * 389.1 + 83) % 100) / 100;

      const dist = 68 + pRand1 * 16;
      const height = 30 + pRand2 * 22;
      const radius = 17 + pRand3 * 8;
      const mx = Math.cos(angle) * dist;
      const mz = Math.sin(angle) * dist;
      const color = mountainColors[i % mountainColors.length];

      // Foothills elevation at center
      const baseY = this.getBaseTerrainHeight(mx, mz);
      this.mountainsData.push({ mx, mz, radius, height, color, baseY });
    }
  }

  // ==========================================
  // 3.1 BASE TERRAIN ELEVATION (Without mountain cones)
  // Ensures precise physics, grounded flora, and smooth rolling hills
  // ==========================================
  getBaseTerrainHeight(x, z) {
    const dist = Math.hypot(x, z);

    // 1. Surrounding mountain foothills rising naturally towards boundary
    let outerMountains = 0;
    if (dist > 46) {
      const ramp = (dist - 46) * 0.36;
      outerMountains = Math.pow(ramp, 1.48);
    }

    // 2. Rolling organic meadow hills
    const hill = Math.sin(x * 0.075) * Math.cos(z * 0.075) * 0.85 + Math.sin(x * 0.032 + z * 0.038) * 0.45;

    // 3. Flat masks for architectural and interactive zones
    // A. Center Spawn
    const dSpawn = Math.hypot(x, z - 8);
    const spawnMask = Math.min(1, Math.max(0, (dSpawn - 4.5) / 5.0));

    // B. Celestial Temple [11, 33] x [-35, 1]
    const dxTemple = Math.max(0, Math.abs(x - 22) - 11.5);
    const dzTemple = Math.max(0, Math.abs(z - (-18)) - 17.5);
    const dTemple = Math.hypot(dxTemple, dzTemple);
    const templeMask = Math.min(1, Math.max(0, dTemple / 5.5));

    // C. Village Hut [-18, -10] x [-12, -4]
    const dxHut = Math.max(0, Math.abs(x - (-14)) - 4.5);
    const dzHut = Math.max(0, Math.abs(z - (-8)) - 4.5);
    const dHut = Math.hypot(dxHut, dzHut);
    const hutMask = Math.min(1, Math.max(0, dHut / 5.0));

    // D. Boss Arena (32, 30)
    const dBoss = Math.hypot(x - 32, z - 30);
    const bossMask = Math.min(1, Math.max(0, (dBoss - 16.5) / 6.0));

    // E. Obby Parkour Start (-25, 15)
    const dxObby = Math.max(0, Math.abs(x - (-25)) - 4.5);
    const dzObby = Math.max(0, Math.abs(z - 1.5) - 16.5);
    const dObby = Math.hypot(dxObby, dzObby);
    const obbyMask = Math.min(1, Math.max(0, dObby / 5.0));

    // F. Enchanted Crystal Pond Basin depression at (-4.5, 0.5)
    const dPond = Math.hypot(x - (-4.5), z - 0.5);
    let pondDepression = 0;
    if (dPond < 5.8) {
      pondDepression = Math.cos((dPond / 5.8) * (Math.PI / 2)) * -0.72;
    }

    const flatFactor = Math.min(spawnMask, templeMask, hutMask, bossMask, obbyMask);
    return (hill * flatFactor) + pondDepression + outerMountains;
  }

  // ==========================================
  // 3.2 FULL TERRAIN ELEVATION MODEL
  // Includes mountain cone slopes so player walks up the peaks
  // ==========================================
  getTerrainHeight(x, z, includeMountains = true) {
    let baseH = this.getBaseTerrainHeight(x, z);

    if (includeMountains && this.mountainsData && this.mountainsData.length > 0) {
      const dist = Math.hypot(x, z);
      if (dist > 45) {
        for (let i = 0; i < this.mountainsData.length; i++) {
          const m = this.mountainsData[i];
          const dm = Math.hypot(x - m.mx, z - m.mz);
          if (dm < m.radius) {
            // Cone surface slope: base is at m.baseY - 2, peak at m.baseY - 2 + m.height
            const coneH = (m.baseY - 2) + (1 - dm / m.radius) * m.height;
            if (coneH > baseH) {
              baseH = coneH;
            }
          }
        }
      }
    }

    return baseH;
  }

  initScene() {
    const container = document.getElementById('canvas-container');
    
    // Scene with soft pastel atmosphere
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdbeafe);
    this.scene.fog = new THREE.FogExp2(0xdbeafe, 0.010);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 8, 14);

    // Renderer (Optimized pixelRatio & PCF soft shadows)
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
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

    // Warm Anime Fantasy Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x7289da, 0.85);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.35);
    dirLight.position.set(45, 65, 35);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 220;
    const d = 55;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0004;
    this.scene.add(dirLight);

    // Sky & Clouds
    this.createSkyDecorations();
  }

  createSkyDecorations() {
    // Stylized Anime Moon
    const moonGeo = new THREE.SphereGeometry(6.5, 18, 18);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-65, 52, -95);
    this.scene.add(moon);

    // Floating Golden Celestial Stars
    const starGeo = new THREE.OctahedronGeometry(1.2, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
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
    // 4.1 Ground Terrain Mesh with continuous analytical height
    const groundGeo = new THREE.PlaneGeometry(210, 210, 140, 140);
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const localX = pos.getX(i);
      const localY = pos.getY(i);
      const worldX = localX;
      const worldZ = -localY;
      const worldY = this.getTerrainHeight(worldX, worldZ, false);
      pos.setZ(i, worldY);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshLambertMaterial({
      map: this.createRealisticGrassTexture(),
      color: 0xffffff
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.groundMesh.matrixAutoUpdate = false;
    this.groundMesh.updateMatrix();
    this.scene.add(this.groundMesh);

    // 4.2 Distant Mountain Peaks
    this.buildMountains();

    // 4.3 Enchanted Crystal Pond & Water Lilies
    this.buildCrystalPond();

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

  buildMountains() {
    if (!this.mountainsData || this.mountainsData.length === 0) return;
    for (let i = 0; i < this.mountainsData.length; i++) {
      const m = this.mountainsData[i];
      const mntGeo = new THREE.ConeGeometry(m.radius, m.height, 7);
      const mntMat = new THREE.MeshLambertMaterial({ 
        color: m.color, 
        flatShading: true 
      });
      const mnt = new THREE.Mesh(mntGeo, mntMat);
      mnt.position.set(m.mx, m.baseY + m.height / 2 - 2, m.mz);
      mnt.castShadow = true;
      mnt.receiveShadow = true;
      mnt.matrixAutoUpdate = false;
      mnt.updateMatrix();
      this.scene.add(mnt);

      // Glistening Snow Cap
      const snowGeo = new THREE.ConeGeometry(m.radius * 0.38, m.height * 0.34, 7);
      const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.set(mnt.position.x, mnt.position.y + m.height * 0.33, mnt.position.z);
      snow.matrixAutoUpdate = false;
      snow.updateMatrix();
      this.scene.add(snow);
    }
  }

  // ==========================================
  // 4.3 ENCHANTED CRYSTAL POND & WATER LILIES
  // ==========================================
  buildCrystalPond() {
    const pondCenter = new THREE.Vector3(-4.5, -0.15, 0.5);
    const pondRadius = 5.5;

    // Translucent shimmering water surface
    const waterGeo = new THREE.CircleGeometry(pondRadius, 36);
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.12,
      metalness: 0.15,
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide
    });
    this.waterMesh = new THREE.Mesh(waterGeo, waterMat);
    this.waterMesh.rotation.x = -Math.PI / 2;
    this.waterMesh.position.set(pondCenter.x, pondCenter.y, pondCenter.z);
    this.waterMesh.receiveShadow = true;
    this.scene.add(this.waterMesh);

    // Glowing subtle water edge foam ring
    const foamRingGeo = new THREE.RingGeometry(pondRadius - 0.25, pondRadius + 0.15, 36);
    const foamMat = new THREE.MeshBasicMaterial({
      color: 0xdcfce7,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const foamRing = new THREE.Mesh(foamRingGeo, foamMat);
    foamRing.rotation.x = -Math.PI / 2;
    foamRing.position.set(pondCenter.x, pondCenter.y + 0.01, pondCenter.z);
    this.scene.add(foamRing);

    // Stepping Stones across the pond so players can hop across!
    const stoneMat = new THREE.MeshLambertMaterial({ color: 0xa8b2d1, flatShading: true });
    const stoneOffsets = [
      { x: -3.0, z: -2.2, r: 0.8 },
      { x: -4.2, z: -0.8, r: 0.85 },
      { x: -4.8, z: 0.8, r: 0.9 },
      { x: -5.4, z: 2.2, r: 0.78 }
    ];
    stoneOffsets.forEach(st => {
      const sMesh = new THREE.Mesh(new THREE.CylinderGeometry(st.r, st.r * 1.1, 0.45, 8), stoneMat);
      sMesh.position.set(st.x, pondCenter.y + 0.18, st.z);
      sMesh.castShadow = true;
      sMesh.receiveShadow = true;
      this.scene.add(sMesh);

      this.platforms.push({
        type: 'cylinder',
        x: st.x,
        z: st.z,
        radius: st.r,
        topY: pondCenter.y + 0.4
      });
    });

    // Floating Lotus Lilies on the pond
    const padMat = new THREE.MeshLambertMaterial({ color: 0x2d6a4f, side: THREE.DoubleSide });
    const flowerPinkMat = new THREE.MeshLambertMaterial({ color: 0xff70a6 });
    const lotusCenterMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });

    const lilyPositions = [
      { x: -2.2, z: 1.5 },
      { x: -6.0, z: -1.2 },
      { x: -3.8, z: 2.8 },
      { x: -6.5, z: 1.0 },
      { x: -2.6, z: -0.6 }
    ];

    lilyPositions.forEach(lp => {
      const lilyGroup = new THREE.Group();
      lilyGroup.position.set(lp.x, pondCenter.y + 0.02, lp.z);

      // Lotus Leaf Pad
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12, 0, Math.PI * 1.8), padMat);
      pad.rotation.x = -Math.PI / 2;
      pad.rotation.z = Math.random() * Math.PI;
      lilyGroup.add(pad);

      // Pink Blossom
      const petalGeo = new THREE.ConeGeometry(0.12, 0.28, 5);
      for (let p = 0; p < 7; p++) {
        const ang = (p / 7) * Math.PI * 2;
        const petal = new THREE.Mesh(petalGeo, flowerPinkMat);
        petal.position.set(Math.cos(ang) * 0.16, 0.12, Math.sin(ang) * 0.16);
        petal.rotation.x = Math.sin(ang) * 0.35;
        petal.rotation.z = -Math.cos(ang) * 0.35;
        lilyGroup.add(petal);
      }

      // Golden Center
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), lotusCenterMat);
      center.position.y = 0.14;
      lilyGroup.add(center);

      this.scene.add(lilyGroup);
    });

    // River Reeds along pond edge
    const reedMat = new THREE.MeshLambertMaterial({ color: 0x40916c });
    const tipMat = new THREE.MeshLambertMaterial({ color: 0x582f0e });
    for (let r = 0; r < 24; r++) {
      const ang = (r / 24) * Math.PI * 2;
      const rx = pondCenter.x + Math.cos(ang) * (pondRadius + 0.3 + Math.random() * 0.5);
      const rz = pondCenter.z + Math.sin(ang) * (pondRadius + 0.3 + Math.random() * 0.5);
      const ry = this.getTerrainHeight(rx, rz);

      const reedGroup = new THREE.Group();
      const rH = 1.2 + Math.random() * 0.6;
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, rH, 4), reedMat);
      stalk.position.y = rH / 2;
      reedGroup.add(stalk);

      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.32, 6), tipMat);
      tip.position.y = rH * 0.88;
      reedGroup.add(tip);

      reedGroup.position.set(rx, ry, rz);
      reedGroup.rotation.y = Math.random() * Math.PI;
      reedGroup.rotation.z = (Math.random() - 0.5) * 0.15;
      this.scene.add(reedGroup);
    }
  }

  // ==========================================
  // 4.4 WINDING COBBLESTONE PATHWAYS
  // ==========================================
  buildStonePaths() {
    const stoneMat1 = new THREE.MeshLambertMaterial({ color: 0xd8c8b8, flatShading: true });
    const stoneMat2 = new THREE.MeshLambertMaterial({ color: 0xbdb0a0, flatShading: true });
    const stoneMat3 = new THREE.MeshLambertMaterial({ color: 0xc4b4d4, flatShading: true });
    const pathMats = [stoneMat1, stoneMat2, stoneMat3];

    // Spline-like paths from Spawn (0, 8)
    const paths = [
      // Path 1: Spawn -> Village Hut (-14, -8)
      [
        { x: 0, z: 8 }, { x: -3, z: 6 }, { x: -6, z: 3 }, { x: -8, z: 0 },
        { x: -10, z: -3 }, { x: -12, z: -6 }, { x: -14, z: -8 }
      ],
      // Path 2: Spawn -> Celestial Temple (22, -20)
      [
        { x: 0, z: 8 }, { x: 4, z: 5 }, { x: 8, z: 2 }, { x: 12, z: -3 },
        { x: 15, z: -8 }, { x: 18, z: -14 }, { x: 22, z: -20 }
      ],
      // Path 3: Spawn -> Obby Parkour (-25, 15)
      [
        { x: 0, z: 8 }, { x: -5, z: 9 }, { x: -11, z: 11 }, { x: -17, z: 13 },
        { x: -22, z: 14 }, { x: -25, z: 15 }
      ],
      // Path 4: Spawn -> Boss Arena (32, 30)
      [
        { x: 0, z: 8 }, { x: 6, z: 12 }, { x: 13, z: 16 }, { x: 20, z: 21 },
        { x: 26, z: 25 }, { x: 32, z: 30 }
      ]
    ];

    paths.forEach(segmentList => {
      for (let s = 0; s < segmentList.length - 1; s++) {
        const p1 = segmentList[s];
        const p2 = segmentList[s + 1];
        const steps = 7;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const px = p1.x + (p2.x - p1.x) * t + (Math.random() - 0.5) * 0.45;
          const pz = p1.z + (p2.z - p1.z) * t + (Math.random() - 0.5) * 0.45;
          const py = this.getTerrainHeight(px, pz);

          const r = 0.45 + Math.random() * 0.35;
          const stoneGeo = new THREE.CylinderGeometry(r, r * 1.05, 0.08, 6);
          const mat = pathMats[Math.floor(Math.random() * pathMats.length)];
          const stone = new THREE.Mesh(stoneGeo, mat);
          stone.position.set(px, py + 0.04, pz);
          stone.rotation.y = Math.random() * Math.PI;
          stone.receiveShadow = true;
          stone.matrixAutoUpdate = false;
          stone.updateMatrix();
          this.scene.add(stone);
        }
      }
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

    const purpleFoliageMats = [
      new THREE.MeshLambertMaterial({ color: 0x8a2be2, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0x9d4edd, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0x7b2cbf, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0xa855f7, flatShading: true }),
      new THREE.MeshLambertMaterial({ color: 0xb565d8, flatShading: true })
    ];

    this.treeCanopies = [];

    for (let i = 0; i < 42; i++) {
      const x = (Math.random() - 0.5) * 88;
      const z = (Math.random() - 0.5) * 88;
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      if (x > 15 && z > 15) continue; // boss arena
      if (x >= 10 && x <= 34 && z >= -36 && z <= 2) continue; // Celestial Temple area
      if (x >= -19 && x <= -9 && z >= -13 && z <= -3) continue; // Village hut area
      if (Math.hypot(x - (-4.5), z - 0.5) < 7.0) continue; // Pond area

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

      // Lush Purple Crown
      const crownMat = purpleFoliageMats[i % purpleFoliageMats.length];
      const mainCrownRadius = 3.6 + Math.random() * 0.8;
      const crown = new THREE.Mesh(
        new THREE.DodecahedronGeometry(mainCrownRadius),
        crownMat
      );
      crown.position.y = trunkHeight + 1.2;
      crown.castShadow = true;
      crown.receiveShadow = true;
      treeGroup.add(crown);

      const puffCount = 2 + Math.floor(Math.random() * 2);
      for (let p = 0; p < puffCount; p++) {
        const puffMat = purpleFoliageMats[(i + p + 1) % purpleFoliageMats.length];
        const puffRadius = 1.9 + Math.random() * 0.7;
        const puff = new THREE.Mesh(new THREE.DodecahedronGeometry(puffRadius), puffMat);
        const ang = (p / puffCount) * Math.PI * 2 + Math.random() * 0.5;
        const dist = 1.8 + Math.random() * 0.6;
        puff.position.set(
          Math.cos(ang) * dist,
          trunkHeight + 0.6 + (Math.random() - 0.3) * 1.2,
          Math.sin(ang) * dist
        );
        puff.castShadow = true;
        treeGroup.add(puff);
      }

      const ty = this.getTerrainHeight(x, z);
      treeGroup.position.set(x, ty, z);
      this.scene.add(treeGroup);

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

    this.createFallingTreePetals();
  }

  // ==========================================
  // 4.6 HIGH-PERFORMANCE INSTANCED GRASS BLADES
  // 2,500 blades rendered in 2 draw calls with GPU vertex shader wind!
  // ==========================================
  buildInstancedGrass() {
    const tuftGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      -0.24, 0, 0,   0.24, 0, 0,   0.24, 0.75, 0,
      -0.24, 0, 0,   0.24, 0.75, 0, -0.24, 0.75, 0,
      0, 0, -0.24,   0, 0, 0.24,   0, 0.75, 0.24,
      0, 0, -0.24,   0, 0.75, 0.24, 0, 0.75, -0.24
    ]);
    const normals = new Float32Array([
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,
      0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0,  0, 1, 0
    ]);
    tuftGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    tuftGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

    const createGrassShaderMat = (colorHex) => {
      const mat = new THREE.MeshLambertMaterial({
        color: colorHex,
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
    this.grassMat1 = createGrassShaderMat(0x60c04e);
    this.grassMat2 = createGrassShaderMat(0x499c3b);

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
        if (Math.hypot(x - (-4.5), z - 0.5) < 5.8) continue; // pond

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
      if (Math.hypot(fx - (-4.5), fz - 0.5) < 5.8) continue;

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
      { x: -10, z: 12 }, { x: 8, z: -12 }, { x: -20, z: -15 },
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
    hutGroup.add(lantern);

    const lanternLight = new THREE.PointLight(0xffbe0b, 1.4, 12);
    lanternLight.position.set(2.85, 2.3, 3.8);
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

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111 });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
    eye1.position.set(-0.25, 0.95, 0.72);
    const eye2 = eye1.clone();
    eye2.position.x = 0.25;
    npcGroup.add(eye1, eye2);

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
    for (let i = 0; i < 4; i++) {
      const creature = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 12),
        new THREE.MeshLambertMaterial({ color: 0xfec5bb })
      );
      body.position.y = 0.5;
      creature.add(body);

      const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0x000 }));
      eye1.position.set(-0.16, 0.6, 0.45);
      const eye2 = eye1.clone();
      eye2.position.x = 0.16;
      creature.add(eye1, eye2);

      const cx = -8 + i * 4;
      const cz = 4 + (i % 2) * 3;
      const cy = this.getTerrainHeight(cx, cz);
      creature.position.set(cx, cy, cz);
      creature.userData = { initialY: cy, hopOffset: Math.random() * 5 };
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

      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x582f0e });
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
      eye.position.set(-0.2, 0.8, 0.6);
      const eye2 = eye.clone();
      eye2.position.x = 0.2;
      slime.add(eye, eye2);

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

    this.playerDressMat = new THREE.MeshLambertMaterial({ color: SISTERS[0].dressColor });
    this.playerDress = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.3, 8), this.playerDressMat);
    this.playerDress.position.y = 1.0;
    this.playerDress.castShadow = true;
    this.playerGroup.add(this.playerDress);

    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdfba });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), skinMat);
    head.position.y = 1.95;
    head.castShadow = true;
    this.playerGroup.add(head);

    this.playerHairMat = new THREE.MeshLambertMaterial({ color: SISTERS[0].hairColor });
    this.playerHair = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), this.playerHairMat);
    this.playerHair.position.set(0, 2.05, -0.05);
    this.playerGroup.add(this.playerHair);

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x22223b });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
    eye1.position.set(-0.16, 1.98, 0.42);
    const eye2 = eye1.clone();
    eye2.position.x = 0.16;
    this.playerGroup.add(eye1, eye2);

    this.accessoryGroup = new THREE.Group();
    this.accessoryGroup.position.set(0, 2.65, 0);
    this.playerGroup.add(this.accessoryGroup);
    this.updateSisterAccessory();

    const shieldGeo = new THREE.SphereGeometry(1.6, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x90e0ef,
      wireframe: true,
      transparent: true,
      opacity: 0
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 1.5;
    this.playerGroup.add(this.shieldMesh);

    this.scene.add(this.playerGroup);
  }

  updateSisterAccessory() {
    while (this.accessoryGroup.children.length > 0) {
      this.accessoryGroup.remove(this.accessoryGroup.children[0]);
    }

    const current = SISTERS[this.activeSisterIdx];
    this.playerDressMat.color.setHex(current.dressColor);
    this.playerHairMat.color.setHex(current.hairColor);

    if (this.activeSisterIdx === 0) {
      const moon = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.08, 8, 16, Math.PI * 1.3),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      this.accessoryGroup.add(moon);
    } else if (this.activeSisterIdx === 1) {
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshBasicMaterial({ color: 0xffe066 })
      );
      this.accessoryGroup.add(star);

      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.04, 6, 16, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0xffd166 })
      );
      bow.position.set(0.3, -0.6, -0.25);
      bow.rotation.y = Math.PI / 2;
      this.accessoryGroup.add(bow);
    } else if (this.activeSisterIdx === 2) {
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 10),
        new THREE.MeshBasicMaterial({ color: 0xff7b00 })
      );
      this.accessoryGroup.add(sun);
      const corona = new THREE.Mesh(
        new THREE.RingGeometry(0.36, 0.52, 12),
        new THREE.MeshBasicMaterial({ color: 0xffc300, side: THREE.DoubleSide })
      );
      this.accessoryGroup.add(corona);
    } else if (this.activeSisterIdx === 3) {
      const ring1 = new THREE.Mesh(
        new THREE.TorusGeometry(0.48, 0.05, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0xc77dff })
      );
      ring1.rotation.x = Math.PI / 3;
      this.accessoryGroup.add(ring1);

      const ring2 = new THREE.Mesh(
        new THREE.TorusGeometry(0.65, 0.03, 6, 20),
        new THREE.MeshBasicMaterial({ color: 0x9d4edd })
      );
      ring2.rotation.x = Math.PI / 2.5;
      this.accessoryGroup.add(ring2);

      const sat = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffde59 })
      );
      sat.position.set(0.55, 0.1, 0);
      this.accessoryGroup.add(sat);
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

    if (this.activeSisterIdx === 0) {
      sfx.magicSkill(0);
      this.shieldMesh.material.opacity = 0.75;
      this.playerVelY = 0.28;
      this.showFloatingText("🌙 Mond-Schild (7s) aktiv!", this.playerGroup.position, "#90e0ef");
      setTimeout(() => {
        this.shieldMesh.material.opacity = 0;
      }, 7000);

    } else if (this.activeSisterIdx === 1) {
      sfx.arrowShoot();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerGroup.quaternion);
      this.showFloatingText("🏹 Sternen-Bogen!", this.playerGroup.position, "#ffe066");

      for (let i = -1.5; i <= 1.5; i += 1.0) {
        const arrowMesh = new THREE.Group();
        const head = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.32, 0),
          new THREE.MeshBasicMaterial({ color: 0xffea00 })
        );
        const shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6),
          new THREE.MeshBasicMaterial({ color: 0xffffff })
        );
        shaft.rotation.x = Math.PI / 2;
        shaft.position.z = 0.2;
        arrowMesh.add(head, shaft);

        arrowMesh.position.copy(this.playerGroup.position).add(new THREE.Vector3(0, 1.3, 0));
        const dir = forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), i * 0.18);
        arrowMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), dir);

        this.projectiles.push({
          mesh: arrowMesh,
          dir: dir,
          speed: 0.75,
          life: 65,
          damage: 25
        });
        this.scene.add(arrowMesh);
      }

    } else if (this.activeSisterIdx === 2) {
      sfx.magicSkill(2);
      this.showFloatingText("☀️ SUPERNOVA!", this.playerGroup.position, "#ff7b00");
      this.createSupernovaParticles(this.playerGroup.position);
      this.damageInRadius(this.playerGroup.position, 9, 45);

    } else if (this.activeSisterIdx === 3) {
      sfx.magicSkill(3);
      this.showFloatingText("🪐 Planeten-Ringe!", this.playerGroup.position, "#9d4edd");
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerGroup.quaternion);
      const ringGroup = new THREE.Group();

      const r1 = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.12, 8, 24),
        new THREE.MeshBasicMaterial({ color: 0xc77dff })
      );
      r1.rotation.x = Math.PI / 2;
      ringGroup.add(r1);

      const r2 = new THREE.Mesh(
        new THREE.TorusGeometry(1.8, 0.08, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xff99c8 })
      );
      r2.rotation.x = Math.PI / 2.2;
      ringGroup.add(r2);

      ringGroup.position.copy(this.playerGroup.position).add(new THREE.Vector3(0, 1.5, 0));
      this.projectiles.push({
        mesh: ringGroup,
        dir: forward,
        speed: 0.5,
        life: 80,
        damage: 32,
        pullRadius: 7
      });
      this.scene.add(ringGroup);
    }
  }

  castAbility2() {
    if (this.cooldown2 > 0) return;
    const current = SISTERS[this.activeSisterIdx];
    this.cooldown2 = current.ability2.cooldown;

    if (this.activeSisterIdx === 0) {
      sfx.heal();
      this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + 50);
      document.getElementById('player-hp-bar').style.width = `${(this.playerHP / this.maxPlayerHP) * 100}%`;
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
      this.showFloatingText("🪨 VERSTEINERUNG! (4s)", this.playerGroup.position, "#e67e22");

    } else if (this.activeSisterIdx === 3) {
      sfx.invisible();
      this.isPlayerInvisible = true;
      this.invisibleTimer = 5.0;
      this.playerDressMat.transparent = true;
      this.playerDressMat.opacity = 0.25;
      this.playerHairMat.transparent = true;
      this.playerHairMat.opacity = 0.25;
      this.showFloatingText("👻 UNSICHTBAR! (5s)", this.playerGroup.position, "#c77dff");
    }
  }

  petrifyEnemies(duration) {
    if (this.bossData.alive) {
      const dist = this.bossGroup.position.distanceTo(this.playerGroup.position);
      if (dist < 26) {
        this.bossData.petrifiedTimer = duration;
        this.showFloatingText("🪨 VORTOX VERSTEINERT!", this.bossGroup.position, "#bdc3c7");
      }
    }

    this.slimes.forEach(slime => {
      if (slime.userData.alive) {
        const dist = slime.position.distanceTo(this.playerGroup.position);
        if (dist < 22) {
          slime.userData.petrifiedTimer = duration;
          this.showFloatingText("🪨 Versteinert!", slime.position, "#bdc3c7");
        }
      }
    });
  }

  createHealParticles(pos) {
    for (let i = 0; i < 25; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 6, 6),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0x2ecc71 : 0x64ffda })
      );
      p.position.copy(pos).add(new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0.3 + Math.random() * 1.5,
        (Math.random() - 0.5) * 2
      ));
      this.particles.push({
        mesh: p,
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.05, 0.08 + Math.random() * 0.06, (Math.random() - 0.5) * 0.05),
        life: 40
      });
      this.scene.add(p);
    }
  }

  createSupernovaParticles(pos) {
    for (let i = 0; i < 30; i++) {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 4, 4),
        new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xff4800 : 0xffaa00 })
      );
      p.position.copy(pos).add(new THREE.Vector3(0, 1.2, 0));
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        Math.random() * 0.3,
        (Math.random() - 0.5) * 0.5
      );
      this.particles.push({ mesh: p, vel: vel, life: 35 });
      this.scene.add(p);
    }
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
          this.showFloatingText("⭐ Slime besiegt!", slime.position, "#ffe066");
        }
      }
    });
  }

  hitBoss(dmg) {
    if (!this.bossData.alive) return;
    this.bossData.hp = Math.max(0, this.bossData.hp - dmg);
    sfx.hit();
    this.showFloatingText(`-${dmg} HP!`, this.bossGroup.position, "#00f0ff");

    const pct = (this.bossData.hp / this.bossData.maxHp) * 100;
    document.getElementById('boss-hp-bar').style.width = `${pct}%`;

    if (this.bossData.hp <= 0) {
      this.bossData.alive = false;
      this.bossGroup.visible = false;
      sfx.victory();
      this.showFloatingText("🎉 VORTOX BESIEGT! VICTORY! 🎉", this.playerGroup.position, "#ffe066");
      document.getElementById('boss-state-text').textContent = "Besiegt! Das Himmelsgebirge ist gerettet!";
    }
  }

  // ==========================================
  // 8. EVENT LISTENERS & UI
  // ==========================================
  setupEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('keydown', (e) => {
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
  }

  setupRobloxControls() {
    const btnStart = document.getElementById('btn-start-game');
    const introScreen = document.getElementById('intro-screen');
    if (btnStart && introScreen) {
      btnStart.addEventListener('click', () => {
        sfx.startBGM();
        introScreen.classList.add('hidden');
      });
    }

    const btnJump = document.getElementById('circle-jump');
    if (btnJump) {
      const handleJump = (e) => {
        e.preventDefault();
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
      let startX = 0;
      let startY = 0;
      const maxRadius = 42;

      const startJoy = (clientX, clientY) => {
        isDragging = true;
        const rect = joystickBase.getBoundingClientRect();
        startX = rect.left + rect.width / 2;
        startY = rect.top + rect.height / 2;
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
        this.joystickDelta.x = dx / maxRadius;
        this.joystickDelta.y = dy / maxRadius;
      };

      const endJoy = () => {
        isDragging = false;
        joystickThumb.style.transform = 'translate(0px, 0px)';
        this.joystickDelta.x = 0;
        this.joystickDelta.y = 0;
      };

      joystickBase.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches.length > 0) startJoy(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false });

      window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        if (e.touches.length > 0) moveJoy(e.touches[0].clientX, e.touches[0].clientY);
      }, { passive: false });

      window.addEventListener('touchend', endJoy);
      window.addEventListener('touchcancel', endJoy);

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

    const delta = Math.min(this.clock.getDelta(), 0.05);
    const dtFactor = delta * 60; // normalized to 60fps baseline

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
        this.playerDressMat.transparent = false;
        this.playerDressMat.opacity = 1.0;
        this.playerHairMat.transparent = false;
        this.playerHairMat.opacity = 1.0;
        this.showFloatingText("✨ Wieder sichtbar!", this.playerGroup.position, "#c77dff");
      }
    }

    // 9.1 Player Movement with verified physics
    this.updatePlayerMovement(delta, dtFactor);

    // 9.2 Projectiles & Particles
    this.updateProjectiles();

    // 9.3 Boss Vortox AI & Attacks
    this.updateBossAI(delta);

    // 9.4 Ambient Animations (Creatures, Grass Sway, Water, Petals, Bees)
    this.updateWorldAmbience(delta);

    // Dynamic BGM based on distance to boss
    if (this.bossData && this.bossData.alive) {
      const dist = this.bossGroup.position.distanceTo(this.playerGroup.position);
      sfx.setBGMMode(dist < 28 ? 'boss' : 'peaceful');
    }

    // Camera follow
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

    this.renderer.render(this.scene, this.camera);
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

  doJump() {
    this.jumpBufferTimer = 0.12; // 120ms jump buffer
    const current = SISTERS[this.activeSisterIdx];
    if (this.isGrounded || this.coyoteTimer > 0) {
      this.playerVelY = current.jumpPower;
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

    if (isMoving) {
      const moveVec = new THREE.Vector3(moveX, 0, moveZ);
      if (moveVec.length() > 1) moveVec.normalize();
      
      const camEuler = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
      moveVec.applyEuler(camEuler);

      const oldX = this.playerGroup.position.x;
      const oldZ = this.playerGroup.position.z;
      const playerRadius = 0.42;
      const playerY = this.playerGroup.position.y;
      const moveStep = current.speed * dtFactor;

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

      const targetAngle = Math.atan2(moveVec.x, moveVec.z);
      this.playerGroup.rotation.y = targetAngle;

      this.playerDress.rotation.z = Math.sin(Date.now() * 0.015) * 0.08;

      if (this.isGrounded) {
        this.spawnRunningParticle();
      }
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

    // Platform collision check (AABB boxes for temple/stairs & cylinders for obby)
    let bestPlatform = null;
    for (let i = 0; i < this.platforms.length; i++) {
      const plat = this.platforms[i];
      let isInside = false;

      if (plat.type === 'box') {
        isInside = (px >= plat.minX && px <= plat.maxX && pz >= plat.minZ && pz <= plat.maxZ);
      } else if (plat.type === 'cylinder') {
        const dx = px - plat.x;
        const dz = pz - plat.z;
        isInside = (dx * dx + dz * dz <= plat.radius * plat.radius);
      }

      if (isInside) {
        // Continuous swept collision: checks landing from prevY down to py
        const minCheckY = py - 0.35;
        const maxCheckY = Math.max(prevY + 0.15, py + 0.55);
        if (plat.topY >= minCheckY && plat.topY <= maxCheckY) {
          if (!bestPlatform || plat.topY > bestPlatform.topY) {
            bestPlatform = plat;
          }
        }
      }
    }

    // Ground elevation from analytical terrain function
    const groundY = this.getTerrainHeight(px, pz);

    if (bestPlatform && this.playerVelY <= 0.1) {
      this.playerGroup.position.y = bestPlatform.topY;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
    } else if (this.playerGroup.position.y <= groundY) {
      this.playerGroup.position.y = groundY;
      this.playerVelY = 0;
      this.isGrounded = true;
      this.coyoteTimer = 0.12;
    } else {
      this.isGrounded = false;
      this.coyoteTimer = Math.max(0, this.coyoteTimer - delta);
    }

    // Jump Buffering check
    if (this.jumpBufferTimer > 0) {
      this.jumpBufferTimer -= delta;
      if (this.isGrounded) {
        this.playerVelY = current.jumpPower;
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

      if (this.bossData.alive && p.mesh.position.distanceTo(this.bossGroup.position) < 3.8) {
        this.hitBoss(p.damage);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      this.slimes.forEach(slime => {
        if (slime.userData.alive && p.mesh.position.distanceTo(slime.position) < 1.6) {
          slime.userData.hp -= p.damage;
          this.showFloatingText(`-${p.damage}`, slime.position, "#ffd166");
          if (slime.userData.hp <= 0) {
            slime.userData.alive = false;
            slime.visible = false;
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
      pt.mesh.position.add(pt.vel);
      pt.life--;
      if (pt.life <= 0) {
        this.scene.remove(pt.mesh);
        this.particles.splice(i, 1);
      }
    }
  }

  updateBossAI(delta) {
    if (!this.bossData.alive) return;

    if (this.bossData.petrifiedTimer > 0) {
      this.bossData.petrifiedTimer -= delta;
      document.getElementById('boss-state-text').textContent = `🪨 VERSTEINERT! (${this.bossData.petrifiedTimer.toFixed(1)}s)`;
      return;
    }

    const distToPlayer = this.bossGroup.position.distanceTo(this.playerGroup.position);
    const bossBanner = document.getElementById('boss-banner');

    if (distToPlayer < 24) {
      bossBanner.classList.add('visible');
    } else {
      bossBanner.classList.remove('visible');
    }

    this.bossData.timer += delta;

    const wingFlap = Math.sin(Date.now() * 0.008) * 0.4;
    this.leftWing.rotation.y = 0.6 + wingFlap;
    this.rightWing.rotation.y = -0.6 - wingFlap;

    if (this.isPlayerInvisible) {
      return;
    }

    if (this.bossData.state === 'idle') {
      this.bossGroup.lookAt(this.playerGroup.position.x, this.bossGroup.position.y, this.playerGroup.position.z);

      if (distToPlayer < 18) {
        this.bossData.state = 'spin';
        this.bossData.timer = 0;
        document.getElementById('boss-state-text').textContent = "🌪️ TORNADO-WIRBEL! GEFAHR!";
        sfx.bossSpin();
      }
    } else if (this.bossData.state === 'spin') {
      this.bossGroup.rotation.y += 0.35;
      
      const dir = new THREE.Vector3().subVectors(this.playerGroup.position, this.bossGroup.position).normalize();
      dir.y = 0;
      this.bossGroup.position.addScaledVector(dir, 0.12);

      if (distToPlayer < 3.8) {
        if (this.activeSisterIdx === 0 && this.shieldMesh.material.opacity > 0) {
          this.showFloatingText("🛡️ Mond-Schild blockt Wirbel!", this.playerGroup.position, "#90e0ef");
        } else {
          this.playerHP = Math.max(0, this.playerHP - 0.4);
          document.getElementById('player-hp-bar').style.width = `${this.playerHP}%`;
        }
      }

      if (this.bossData.timer > 3.5) {
        this.bossData.state = 'dizzy';
        this.bossData.timer = 0;
        document.getElementById('boss-state-text').textContent = "💫 Vortox ist schwindelig! SCHLAGT JETZT ZU!";
        this.showFloatingText("💫 Boss ist schwindelig!", this.bossGroup.position, "#ffdf6b");
      }
    } else if (this.bossData.state === 'dizzy') {
      this.bossGroup.rotation.z = Math.sin(Date.now() * 0.01) * 0.25;
      
      if (this.bossData.timer > 4.0) {
        this.bossGroup.rotation.z = 0;
        this.bossData.state = 'idle';
        this.bossData.timer = 0;
        document.getElementById('boss-state-text').textContent = "Vorsicht: Dreht sich schnell im Kreis!";
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

    // Water ripple / opacity shimmer
    if (this.waterMesh) {
      this.waterMesh.material.opacity = 0.76 + Math.sin(secTime * 1.5) * 0.04;
    }

    // Temple Crystal rotation
    if (this.templeCrystal) {
      this.templeCrystal.rotation.y += 0.015;
      this.templeCrystal.rotation.x = Math.sin(now * 0.001) * 0.2;
    }

    // Trophy Star rotation
    if (this.trophyStar) {
      this.trophyStar.rotation.y += 0.02;
    }

    // Starlet Creatures bouncing
    this.creatures.forEach((c) => {
      c.position.y = c.userData.initialY + Math.abs(Math.sin(now * 0.004 + c.userData.hopOffset)) * 0.8;
    });

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
      const y = b.centerPos.y + Math.sin(now * 0.006 + b.bobPhase) * b.heightVar;

      b.mesh.position.set(x, y, z);

      // Bee head is along local +X axis: Math.atan2(-dz, dx) points head strictly into flight direction
      const dx = x - prevX;
      const dz = z - prevZ;
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
      const y = b.basePos.y + Math.sin(now * 0.003 + b.timeOffset) * b.heightVar;

      b.mesh.position.set(x, y, z);

      // Butterfly head is along local +Z axis: Math.atan2(dx, dz) points head strictly into flight direction
      const dx = x - prevX;
      const dz = z - prevZ;
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
  new GalaxySistersGame();
});
