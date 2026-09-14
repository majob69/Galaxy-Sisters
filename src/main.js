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
    jumpPower: 0.32,
    gravity: 0.008, // floaty
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
    speed: 0.24,
    jumpPower: 0.28,
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
    name: "Sol", // renamed from Solana
    title: "Sonnen-Kämpferin (Supernova & Versteinerung)",
    icon: "☀️",
    themeColor: 0xff7b00,
    accentColor: "#ff7b00",
    speed: 0.19,
    jumpPower: 0.27,
    gravity: 0.013,
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
    name: "Planeta", // renamed from Saturna
    title: "Planeten-Mystikerin (Gravitations-Ringe & Unsichtbarkeit)",
    icon: "🪐",
    themeColor: 0x9d4edd,
    accentColor: "#9d4edd",
    speed: 0.18,
    jumpPower: 0.26,
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
    
    // Movement & Physics
    this.keys = {};
    this.playerVelY = 0;
    this.isGrounded = false;
    this.projectiles = [];
    this.particles = [];
    this.treePetals = [];
    this.treeCanopies = [];
    this.runningParticles = [];
    this.grassBlades = [];
    this.joystickDelta = { x: 0, y: 0 };
    
    // Interactive Objects in World
    this.platforms = [];
    this.slimes = [];
    this.creatures = [];
    
    this.initScene();
    this.buildWorld();
    this.createPlayerMesh();
    this.createBossVortox();
    this.setupUI();
    this.setupEvents();
    this.setupRobloxControls();
    this.animate();
  }

  initScene() {
    const container = document.getElementById('canvas-container');
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xdce7fe);
    this.scene.fog = new THREE.FogExp2(0xdce7fe, 0.012);

    // Camera
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 8, 14);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    // Orbit Controls for smooth camera orbit/inspection
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05; // don't go below ground
    this.controls.minDistance = 5;
    this.controls.maxDistance = 28;

    // Lighting (Warm Anime Fantasy lighting)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x7687a4, 0.8);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.3);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 200;
    const d = 50;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    this.scene.add(dirLight);

    // Celestial Sky objects (Floating pastel stars and cute moon in sky)
    this.createSkyDecorations();
  }

  createSkyDecorations() {
    // Distant stylized cute moon
    const moonGeo = new THREE.SphereGeometry(6, 16, 16);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff9db });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    moon.position.set(-60, 50, -90);
    this.scene.add(moon);

    // Floating sky stars
    const starGeo = new THREE.OctahedronGeometry(1.2, 0);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xffd166 });
    for (let i = 0; i < 25; i++) {
      const star = new THREE.Mesh(starGeo, starMat);
      star.position.set(
        (Math.random() - 0.5) * 180,
        25 + Math.random() * 30,
        (Math.random() - 0.5) * 180
      );
      this.scene.add(star);
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
    for (let i = 0; i < 2400; i++) {
      const gx = Math.random() * 512;
      const gy = Math.random() * 512;
      const bladeCol = Math.random() > 0.5 ? '#7fde64' : (Math.random() > 0.5 ? '#438034' : '#92e970');
      ctx.strokeStyle = bladeCol;
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + (Math.random() - 0.5) * 8, gy - 6 - Math.random() * 8);
      ctx.stroke();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(16, 16);
    return tex;
  }

  buildGrassBlades() {
    this.grassBlades = [];
    const bladeGeo = new THREE.PlaneGeometry(0.48, 0.65);
    const bladeMats = [
      new THREE.MeshLambertMaterial({ color: 0x5ebd4c, side: THREE.DoubleSide }),
      new THREE.MeshLambertMaterial({ color: 0x73d360, side: THREE.DoubleSide }),
      new THREE.MeshLambertMaterial({ color: 0x479e39, side: THREE.DoubleSide })
    ];

    for (let i = 0; i < 420; i++) {
      const x = (Math.random() - 0.5) * 85;
      const z = (Math.random() - 0.5) * 85;
      if (Math.abs(x) < 5 && Math.abs(z) < 5) continue;
      if (x > 14 && z > 14) continue; // avoid boss center

      const tuft = new THREE.Group();
      const mat = bladeMats[i % bladeMats.length];

      // Cross planes for 3D grass tuft
      const p1 = new THREE.Mesh(bladeGeo, mat);
      p1.position.y = 0.32;
      tuft.add(p1);

      const p2 = new THREE.Mesh(bladeGeo, mat);
      p2.position.y = 0.32;
      p2.rotation.y = Math.PI / 2;
      tuft.add(p2);

      const p3 = new THREE.Mesh(bladeGeo, mat);
      p3.position.y = 0.32;
      p3.rotation.y = Math.PI / 4;
      tuft.add(p3);

      tuft.position.set(x, 0, z);
      tuft.userData = { swayOffset: Math.random() * 10 };
      this.scene.add(tuft);
      this.grassBlades.push(tuft);
    }
  }

  // ==========================================
  // 4. WORLD GENERATION (Meadow, Mountains, Temple, Obby)
  // ==========================================
  buildWorld() {
    // 4.1 Ground Meadow with realistic texture
    const groundGeo = new THREE.PlaneGeometry(160, 160, 64, 64);
    // Add subtle wave to terrain
    const pos = groundGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const distFromCenter = Math.sqrt(x * x + y * y);
      let z = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.8;
      // Make mountains higher at edges
      if (distFromCenter > 45) {
        z += Math.pow((distFromCenter - 45) * 0.45, 1.4);
      }
      pos.setZ(i, z);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshLambertMaterial({
      map: this.createRealisticGrassTexture(),
      color: 0xffffff
    });
    this.groundMesh = new THREE.Mesh(groundGeo, groundMat);
    this.groundMesh.rotation.x = -Math.PI / 2;
    this.groundMesh.receiveShadow = true;
    this.scene.add(this.groundMesh);

    // 4.2 Distant Mountain Peaks (Gebirge)
    this.buildMountains();

    // 4.3 Cute Trees & Bushes & Flowers
    this.buildFoliage();

    // 4.3b Visible 3D Grass Blades swaying in wind
    this.buildGrassBlades();

    // 4.4 Cozy Wooden Hut (Hütte)
    this.buildVillageHut(new THREE.Vector3(-14, 0, -8));

    // 4.5 Celestial Ancient Temple (Versteckter Tempel)
    this.buildCelestialTemple(new THREE.Vector3(22, 0, -20));

    // 4.6 Obby (Floating Jumping Platforms leading to high Star Altar)
    this.buildObbyParkour(new THREE.Vector3(-25, 0, 15));

    // 4.7 Cute Creature NPCs (Starlets)
    this.spawnCuteCreatures();

    // 4.8 Minor Slime Enemies (Bösewichte)
    this.spawnMinorSlimes();
  }

  buildMountains() {
    const mountainColors = [0x5f749d, 0x7688ad, 0x8ea2c4];
    for (let i = 0; i < 14; i++) {
      const angle = (i / 14) * Math.PI * 2;
      const dist = 65 + Math.random() * 15;
      const height = 28 + Math.random() * 20;
      const radius = 14 + Math.random() * 8;

      const mntGeo = new THREE.ConeGeometry(radius, height, 6);
      const mntMat = new THREE.MeshLambertMaterial({ 
        color: mountainColors[i % mountainColors.length], 
        flatShading: true 
      });
      const mnt = new THREE.Mesh(mntGeo, mntMat);
      mnt.position.set(Math.cos(angle) * dist, height / 2 - 2, Math.sin(angle) * dist);
      mnt.castShadow = true;
      mnt.receiveShadow = true;
      this.scene.add(mnt);

      // Snow cap
      const snowGeo = new THREE.ConeGeometry(radius * 0.38, height * 0.35, 6);
      const snowMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
      const snow = new THREE.Mesh(snowGeo, snowMat);
      snow.position.set(mnt.position.x, mnt.position.y + height * 0.33, mnt.position.z);
      this.scene.add(snow);
    }
  }

  createBlackPinkBarkTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Deep black base
    ctx.fillStyle = '#120b16';
    ctx.fillRect(0, 0, 128, 256);

    // Subtle dark vertical bark grain
    for (let i = 0; i < 40; i++) {
      ctx.strokeStyle = i % 2 === 0 ? '#22142d' : '#08050c';
      ctx.lineWidth = 1 + Math.random() * 2.5;
      ctx.beginPath();
      const x = Math.random() * 128;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 10, 256);
      ctx.stroke();
    }

    // Stylized vibrant pink bark rings, swirls & highlights
    const pinkTones = ['#ff2a85', '#ff70a6', '#ff4d94', '#ff85a1', '#f72585'];
    for (let y = 15; y < 256; y += 32) {
      const col = pinkTones[Math.floor(Math.random() * pinkTones.length)];
      ctx.strokeStyle = col;
      ctx.lineWidth = 4 + Math.random() * 4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(35, y + 14, 85, y - 14, 128, y + 6);
      ctx.stroke();

      // Soft pastel pink inner highlight line
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
    // Trees (Enchanted Giant Trees: Black-Pink Trunk & Lush Purple Foliage)
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

    // Purple / Lila Foliage palette
    const purpleFoliageMats = [
      new THREE.MeshLambertMaterial({ color: 0x8a2be2, flatShading: true }), // Blueviolet / rich purple
      new THREE.MeshLambertMaterial({ color: 0x9d4edd, flatShading: true }), // Bright amethyst
      new THREE.MeshLambertMaterial({ color: 0x7b2cbf, flatShading: true }), // Deep royal purple
      new THREE.MeshLambertMaterial({ color: 0xa855f7, flatShading: true }), // Vivid violet
      new THREE.MeshLambertMaterial({ color: 0xb565d8, flatShading: true })  // Soft lilac purple
    ];

    this.treeCanopies = [];

    for (let i = 0; i < 40; i++) {
      const x = (Math.random() - 0.5) * 85;
      const z = (Math.random() - 0.5) * 85;
      // Don't spawn on center spawn or boss arena
      if (Math.abs(x) < 8 && Math.abs(z) < 8) continue;
      if (x > 15 && z > 15) continue; // boss area

      const treeGroup = new THREE.Group();

      // Trunk: significantly bigger (height ~ 5.5 - 7.2)
      const trunkHeight = 5.5 + Math.random() * 1.8;
      const trunkTopRadius = 0.55 + Math.random() * 0.15;
      const trunkBottomRadius = 0.95 + Math.random() * 0.25;

      const trunkGeo = new THREE.CylinderGeometry(trunkTopRadius, trunkBottomRadius, trunkHeight, 8);
      const trunk = new THREE.Mesh(trunkGeo, treeTrunkMat);
      trunk.position.y = trunkHeight / 2;
      trunk.castShadow = true;
      trunk.receiveShadow = true;
      treeGroup.add(trunk);

      // Stylized pink accent root ring / collar at bottom
      const rootRingGeo = new THREE.TorusGeometry(trunkBottomRadius * 0.95, 0.16, 6, 12);
      const rootRing = new THREE.Mesh(rootRingGeo, pinkAccentMat);
      rootRing.rotation.x = Math.PI / 2;
      rootRing.position.y = 0.2;
      treeGroup.add(rootRing);

      // Stylized pink accent ring at upper trunk junction
      const collarRingGeo = new THREE.TorusGeometry(trunkTopRadius * 1.05, 0.12, 6, 10);
      const collarRing = new THREE.Mesh(collarRingGeo, pinkAccentMat);
      collarRing.rotation.x = Math.PI / 2;
      collarRing.position.y = trunkHeight * 0.88;
      treeGroup.add(collarRing);

      // Foliage Crown: All Purple (Lila) and much bigger
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

      // 2-3 side foliage puffs for voluminous anime silhouette
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

      treeGroup.position.set(x, 0, z);
      this.scene.add(treeGroup);

      // Save canopy location for falling particles
      this.treeCanopies.push({
        x: x,
        z: z,
        y: trunkHeight + 2.0,
        radius: mainCrownRadius + 1.0
      });
    }

    // Small Falling Lila & Rosa Particles
    this.createFallingTreePetals();

    // Cute Kawaii Flowers - each flower has a bright yellow center!
    const flowerPetalColors = [0xff4d6d, 0xff70a6, 0x3a86ff, 0xa855f7, 0xff99c8, 0x06b6d4];
    const yellowCenterMat = new THREE.MeshLambertMaterial({ color: 0xffe600 });
    const stemMat = new THREE.MeshLambertMaterial({ color: 0x388e3c });

    for (let i = 0; i < 90; i++) {
      const fx = (Math.random() - 0.5) * 80;
      const fz = (Math.random() - 0.5) * 80;
      if (Math.abs(fx) < 6 && Math.abs(fz) < 6) continue;
      if (fx > 15 && fz > 15) continue;

      const flowerGroup = new THREE.Group();

      // Bright yellow center dot (Gelber Punkt in der Mitte)
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 8), yellowCenterMat);
      center.position.y = 0.24;
      flowerGroup.add(center);

      // Surrounding colorful petals
      const petalMat = new THREE.MeshLambertMaterial({ color: flowerPetalColors[i % flowerPetalColors.length] });
      const petalCount = 5;
      for (let p = 0; p < petalCount; p++) {
        const pAng = (p / petalCount) * Math.PI * 2;
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), petalMat);
        petal.position.set(Math.cos(pAng) * 0.22, 0.20, Math.sin(pAng) * 0.22);
        petal.scale.set(1.1, 0.6, 1.1);
        flowerGroup.add(petal);
      }

      // Small green stem
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 5), stemMat);
      stem.position.y = 0.12;
      flowerGroup.add(stem);

      flowerGroup.position.set(fx, 0, fz);
      flowerGroup.rotation.y = Math.random() * Math.PI;
      this.scene.add(flowerGroup);
    }
  }

  createFallingTreePetals() {
    this.treePetals = [];
    if (!this.treeCanopies || this.treeCanopies.length === 0) return;

    // Rich Lila and Rosa palette for falling particles
    const petalColors = [
      0xff70a6, 0xff99c8, 0xf72585, 0xff5390,
      0xc77dff, 0x9d4edd, 0xd8b4fe, 0xb5179e
    ];
    const petalMaterials = petalColors.map(c => new THREE.MeshBasicMaterial({
      color: c,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88
    }));

    const petalGeo = new THREE.PlaneGeometry(0.22, 0.28);
    const petalCount = 350;

    for (let i = 0; i < petalCount; i++) {
      const mat = petalMaterials[i % petalMaterials.length];
      const mesh = new THREE.Mesh(petalGeo, mat);

      const tree = this.treeCanopies[i % this.treeCanopies.length];
      const ang = Math.random() * Math.PI * 2;
      const dist = Math.random() * tree.radius;

      // Start distributed at various heights so world feels alive instantly
      const initialY = 0.3 + Math.random() * (tree.y + 1.2);
      mesh.position.set(
        tree.x + Math.cos(ang) * dist,
        initialY,
        tree.z + Math.sin(ang) * dist
      );
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );

      this.scene.add(mesh);
      this.treePetals.push({
        mesh: mesh,
        fallSpeed: 0.018 + Math.random() * 0.024,
        swaySeed: Math.random() * 100,
        swaySpeed: 0.8 + Math.random() * 0.9,
        rotX: (Math.random() - 0.5) * 0.05,
        rotY: (Math.random() - 0.5) * 0.06,
        rotZ: (Math.random() - 0.5) * 0.04
      });
    }
  }

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

    // Kawaii Roof (Pastel red/pink)
    const roofMat = new THREE.MeshLambertMaterial({ color: 0xe63946, flatShading: true });
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.2, 2.8, 4), roofMat);
    roof.position.y = 4.6;
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    hutGroup.add(roof);

    // Door
    const doorMat = new THREE.MeshLambertMaterial({ color: 0x4a2810 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2, 0.2), doorMat);
    door.position.set(0, 1, 2.3);
    hutGroup.add(door);

    // Chimney with smoke
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2, 6), new THREE.MeshLambertMaterial({ color: 0x6c757d }));
    chimney.position.set(1.5, 4.8, 0.5);
    hutGroup.add(chimney);

    // Villager NPC (Kawaii Cat/Bear) standing next to hut
    const npc = this.createKawaiiVillager();
    npc.position.set(pos.x + 3.2, 0, pos.z + 2.5);
    this.scene.add(npc);

    this.scene.add(hutGroup);
  }

  createKawaiiVillager() {
    const npcGroup = new THREE.Group();
    // Body
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffccd5 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 16), bodyMat);
    body.position.y = 0.8;
    npcGroup.add(body);

    // Ears
    const earMat = new THREE.MeshLambertMaterial({ color: 0xff758f });
    const ear1 = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.4, 5), earMat);
    ear1.position.set(-0.4, 1.5, 0);
    const ear2 = ear1.clone();
    ear2.position.x = 0.4;
    npcGroup.add(ear1, ear2);

    // Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x111 });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
    eye1.position.set(-0.25, 0.95, 0.72);
    const eye2 = eye1.clone();
    eye2.position.x = 0.25;
    npcGroup.add(eye1, eye2);

    // Cute speech indicator floating
    const bubble = new THREE.Mesh(
      new THREE.TorusGeometry(0.3, 0.08, 8, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    bubble.position.set(0, 2.2, 0);
    npcGroup.add(bubble);

    return npcGroup;
  }

  buildCelestialTemple(pos) {
    const templeGroup = new THREE.Group();
    templeGroup.position.copy(pos);

    // Base podium
    const podMat = new THREE.MeshLambertMaterial({ color: 0xd8e2dc });
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(7, 7.5, 1.2, 8), podMat);
    podium.position.y = 0.6;
    podium.receiveShadow = true;
    templeGroup.add(podium);

    // 4 Ancient Pillars
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0xf8edeb });
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 5, 8), pillarMat);
      pil.position.set(Math.cos(angle) * 4.5, 3.1, Math.sin(angle) * 4.5);
      pil.castShadow = true;
      templeGroup.add(pil);
    }

    // Floating Crystal Altar
    const crystalGeo = new THREE.OctahedronGeometry(1.6, 0);
    const crystalMat = new THREE.MeshPhongMaterial({
      color: 0x00f5d4,
      emissive: 0x00bbf9,
      emissiveIntensity: 0.6,
      transparent: true,
      opacity: 0.88,
      shininess: 90
    });
    this.templeCrystal = new THREE.Mesh(crystalGeo, crystalMat);
    this.templeCrystal.position.set(0, 4.5, 0);
    templeGroup.add(this.templeCrystal);

    this.scene.add(templeGroup);
  }

  buildObbyParkour(startPos) {
    // Stepping stones climbing upward in a spiral/line
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

      // Save for jump collision
      this.platforms.push({
        box: new THREE.Box3().setFromObject(plat),
        topY: height + 0.25,
        radius: 1.8
      });
    }

    // Top Platform with Celestial Star Trophy
    const finalHeight = 1.2 + numSteps * 1.5;
    const finalPlat = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.8, 12), new THREE.MeshLambertMaterial({ color: 0xffd166 }));
    finalPlat.position.set(startPos.x + Math.sin(numSteps * 0.7) * 4, finalHeight, startPos.z - numSteps * 3.8);
    this.scene.add(finalPlat);
    this.platforms.push({
      box: new THREE.Box3().setFromObject(finalPlat),
      topY: finalHeight + 0.4,
      radius: 3.5
    });

    // Star Trophy floating on top
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(1.4, 0), new THREE.MeshBasicMaterial({ color: 0xffbe0b }));
    star.position.set(finalPlat.position.x, finalHeight + 2.5, finalPlat.position.z);
    this.scene.add(star);
    this.trophyStar = star;
  }

  spawnCuteCreatures() {
    // Cute little starlets jumping
    for (let i = 0; i < 4; i++) {
      const creature = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.5, 12, 12),
        new THREE.MeshLambertMaterial({ color: 0xfec5bb })
      );
      body.position.y = 0.5;
      creature.add(body);

      // Kawaii eyes
      const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0x000 }));
      eye1.position.set(-0.16, 0.6, 0.45);
      const eye2 = eye1.clone();
      eye2.position.x = 0.16;
      creature.add(eye1, eye2);

      creature.position.set(-8 + i * 4, 0, 4 + (i % 2) * 3);
      creature.userData = { initialY: 0, hopOffset: Math.random() * 5 };
      this.creatures.push(creature);
      this.scene.add(creature);
    }
  }

  spawnMinorSlimes() {
    // 3 bouncy cute weak slimes
    for (let i = 0; i < 3; i++) {
      const slime = new THREE.Group();
      const slimeMat = new THREE.MeshLambertMaterial({ color: 0x80ed99, transparent: true, opacity: 0.85 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.7, 12, 12), slimeMat);
      body.position.y = 0.7;
      body.scale.set(1, 0.8, 1);
      slime.add(body);

      // Red evil/cute eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x582f0e });
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), eyeMat);
      eye.position.set(-0.2, 0.8, 0.6);
      const eye2 = eye.clone();
      eye2.position.x = 0.2;
      slime.add(eye, eye2);

      slime.position.set(10 + i * 5, 0, -2 - i * 4);
      slime.userData = {
        hp: 30,
        maxHp: 30,
        basePos: slime.position.clone(),
        alive: true
      };
      this.slimes.push(slime);
      this.scene.add(slime);
    }
  }

  // ==========================================
  // 5. BOSS 1: VORTOX (Der Klauenwächter)
  // Grün-blaues Monster, 1 großes blaues Auge, Schweif, langes Haar, Flügel, Riesenklauen!
  // ==========================================
  createBossVortox() {
    this.bossGroup = new THREE.Group();
    this.bossGroup.position.set(32, 0, 30); // in the Boss Arena

    // 5.1 Main Body: Big green-blue torso
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1db99f, flatShading: true }); // grün-blau
    const bodyGeo = new THREE.DodecahedronGeometry(2.8, 1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 3.8;
    body.castShadow = true;
    this.bossGroup.add(body);

    // 5.2 Single Large Glowing Blue Eye in center!
    const eyeSclera = new THREE.Mesh(
      new THREE.SphereGeometry(0.95, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    eyeSclera.position.set(0, 4.2, 2.2);
    eyeSclera.scale.set(1, 1, 0.4);
    this.bossGroup.add(eyeSclera);

    const pupilMat = new THREE.MeshBasicMaterial({ color: 0x0066ff }); // leuchtend blau
    this.bossEyePupil = new THREE.Mesh(new THREE.SphereGeometry(0.48, 12, 12), pupilMat);
    this.bossEyePupil.position.set(0, 4.2, 2.5);
    this.bossEyePupil.scale.set(1, 1, 0.2);
    this.bossGroup.add(this.bossEyePupil);

    // 5.3 Long Flowing Wild Hair
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

    // 5.4 Small Wings on Back
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x94d2bd, side: THREE.DoubleSide });
    this.leftWing = new THREE.Mesh(new THREE.ConeGeometry(0.8, 2.5, 4), wingMat);
    this.leftWing.position.set(-1.8, 4.5, -1.8);
    this.leftWing.rotation.set(-0.4, 0.6, 1.2);
    this.rightWing = this.leftWing.clone();
    this.rightWing.position.x = 1.8;
    this.rightWing.rotation.set(-0.4, -0.6, -1.2);
    this.bossGroup.add(this.leftWing, this.rightWing);

    // 5.5 Small Cute Tail
    const tailMat = new THREE.MeshLambertMaterial({ color: 0x1db99f });
    this.bossTail = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.6, 2.2, 6), tailMat);
    this.bossTail.position.set(0, 2.4, -2.4);
    this.bossTail.rotation.x = -Math.PI / 3;
    this.bossGroup.add(this.bossTail);

    // 5.6 Massive Arms & Hands with Sharp Claws!
    const armMat = new THREE.MeshLambertMaterial({ color: 0x1db99f });
    const clawMat = new THREE.MeshLambertMaterial({ color: 0xedf6f9 }); // sharp white/metallic claws

    this.bossArms = new THREE.Group();
    
    // Left Arm + Claws
    const leftArmGroup = new THREE.Group();
    const leftArm = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 3.2, 6), armMat);
    leftArm.position.set(-3.2, 3.2, 0.5);
    leftArm.rotation.z = Math.PI / 4;
    leftArmGroup.add(leftArm);

    // 3 Sharp Claws
    for (let c = 0; c < 3; c++) {
      const claw = new THREE.Mesh(new THREE.ConeGeometry(0.2, 1.1, 4), clawMat);
      claw.position.set(-4.5 + c * 0.35, 1.8, 1.2);
      claw.rotation.x = Math.PI / 2;
      leftArmGroup.add(claw);
    }
    this.bossArms.add(leftArmGroup);

    // Right Arm + Claws
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

    // 5.7 Boss Arena Pillars surrounding him
    const arenaGroup = new THREE.Group();
    arenaGroup.position.set(32, 0, 30);
    const pillarMat = new THREE.MeshLambertMaterial({ color: 0x495057 });
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2;
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.9, 6, 8), pillarMat);
      pil.position.set(Math.cos(ang) * 16, 3, Math.sin(ang) * 16);
      pil.castShadow = true;
      arenaGroup.add(pil);
    }
    this.scene.add(arenaGroup);

    // Boss State
    this.bossData = {
      hp: 150,
      maxHp: 150,
      state: 'idle', // 'idle', 'spin', 'dizzy', 'clawAttack'
      timer: 0,
      spinAngle: 0,
      alive: true
    };

    this.scene.add(this.bossGroup);
  }

  // ==========================================
  // 6. PLAYABLE SISTER MESH
  // ==========================================
  createPlayerMesh() {
    this.playerGroup = new THREE.Group();
    this.playerGroup.position.set(0, 0, 8);

    // Torso / Dress
    this.playerDressMat = new THREE.MeshLambertMaterial({ color: SISTERS[0].dressColor });
    this.playerDress = new THREE.Mesh(new THREE.ConeGeometry(0.65, 1.3, 8), this.playerDressMat);
    this.playerDress.position.y = 1.0;
    this.playerDress.castShadow = true;
    this.playerGroup.add(this.playerDress);

    // Head
    const skinMat = new THREE.MeshLambertMaterial({ color: 0xffdfba });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.48, 16, 16), skinMat);
    head.position.y = 1.95;
    head.castShadow = true;
    this.playerGroup.add(head);

    // Kawaii Hair
    this.playerHairMat = new THREE.MeshLambertMaterial({ color: SISTERS[0].hairColor });
    this.playerHair = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), this.playerHairMat);
    this.playerHair.position.set(0, 2.05, -0.05);
    this.playerGroup.add(this.playerHair);

    // Cute Anime Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x22223b });
    const eye1 = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), eyeMat);
    eye1.position.set(-0.16, 1.98, 0.42);
    const eye2 = eye1.clone();
    eye2.position.x = 0.16;
    this.playerGroup.add(eye1, eye2);

    // Cosmic Celestial Accessory on head (Mond / Stern / Sonne / Saturn)
    this.accessoryGroup = new THREE.Group();
    this.accessoryGroup.position.set(0, 2.65, 0);
    this.playerGroup.add(this.accessoryGroup);
    this.updateSisterAccessory();

    // Shield Mesh for Luna Ability
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
    // Clear old accessory
    while (this.accessoryGroup.children.length > 0) {
      this.accessoryGroup.remove(this.accessoryGroup.children[0]);
    }

    const current = SISTERS[this.activeSisterIdx];
    this.playerDressMat.color.setHex(current.dressColor);
    this.playerHairMat.color.setHex(current.hairColor);

    if (this.activeSisterIdx === 0) {
      // 🌙 Luna: Crescent Moon
      const moon = new THREE.Mesh(
        new THREE.TorusGeometry(0.32, 0.08, 8, 16, Math.PI * 1.3),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      this.accessoryGroup.add(moon);
    } else if (this.activeSisterIdx === 1) {
      // ⭐ Stella: Golden Star & Celestial Star Bow
      const star = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.35, 0),
        new THREE.MeshBasicMaterial({ color: 0xffe066 })
      );
      this.accessoryGroup.add(star);

      // Star Bow held on back / side
      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.5, 0.04, 6, 16, Math.PI),
        new THREE.MeshBasicMaterial({ color: 0xffd166 })
      );
      bow.position.set(0.3, -0.6, -0.25);
      bow.rotation.y = Math.PI / 2;
      this.accessoryGroup.add(bow);
    } else if (this.activeSisterIdx === 2) {
      // ☀️ Sol: Blazing Sun with Solar Ribbons
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
      // 🪐 Planeta: Dual Cosmic Planetary Rings & Mini Satellites
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

      // Mini satellite planet
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

    // Update UI elements
    const s = SISTERS[idx];
    document.getElementById('char-name').innerHTML = `${s.name} <span style="font-size:0.9rem">${s.icon}</span>`;
    document.getElementById('char-title').textContent = s.title;
    document.getElementById('char-avatar').textContent = s.icon;

    // Update Roblox Action Circles
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

    // Active button styling
    const btns = document.querySelectorAll('.sister-btn[data-sister]');
    btns.forEach((b, i) => {
      b.classList.toggle('active', i === idx);
    });

    this.showFloatingText(`✨ ${s.name} ausgewählt!`, this.playerGroup.position, s.accentColor);
  }

  doJump() {
    if (this.isGrounded) {
      this.playerVelY = SISTERS[this.activeSisterIdx].jumpPower;
      this.isGrounded = false;
      sfx.jump();
    }
  }

  // ==========================================
  // 7. ABILITY 1 (Hauptkraft)
  // ==========================================
  castAbility1() {
    if (this.cooldown1 > 0) return;
    const current = SISTERS[this.activeSisterIdx];
    this.cooldown1 = current.ability1.cooldown;

    if (this.activeSisterIdx === 0) {
      // Luna: Mond-Schild (Verlängert auf 7 Sekunden mit Mondsatelliten)
      sfx.magicSkill(0);
      this.shieldMesh.material.opacity = 0.75;
      this.playerVelY = 0.28; // gentle lunar rise
      this.showFloatingText("🌙 Mond-Schild (7s) aktiv!", this.playerGroup.position, "#90e0ef");
      setTimeout(() => {
        this.shieldMesh.material.opacity = 0;
      }, 7000);

    } else if (this.activeSisterIdx === 1) {
      // Stella: Sternen-Bogen (Feuert Sternenpfeile mit Bogenanimation!)
      sfx.arrowShoot();
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerGroup.quaternion);
      this.showFloatingText("🏹 Sternen-Bogen!", this.playerGroup.position, "#ffe066");

      // Fire 4 rapid glowing star arrows in spread
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
      // Sol: Solar-Supernova (AoE Blast mit Feuersäulen)
      sfx.magicSkill(2);
      this.showFloatingText("☀️ SUPERNOVA!", this.playerGroup.position, "#ff7b00");
      this.createSupernovaParticles(this.playerGroup.position);
      this.damageInRadius(this.playerGroup.position, 9, 45);

    } else if (this.activeSisterIdx === 3) {
      // Planeta: Planeten-Ringe mit Satelliten & Gravitationssog
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

  // ==========================================
  // 7b. ABILITY 2 (Zweitkraft)
  // ==========================================
  castAbility2() {
    if (this.cooldown2 > 0) return;
    const current = SISTERS[this.activeSisterIdx];
    this.cooldown2 = current.ability2.cooldown;

    if (this.activeSisterIdx === 0) {
      // Luna: Heilzauber (+HP für Luna & Mitspieler)
      sfx.heal();
      this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + 50);
      document.getElementById('player-hp-bar').style.width = `${(this.playerHP / this.maxPlayerHP) * 100}%`;
      this.createHealParticles(this.playerGroup.position);
      this.showFloatingText("💚 HEILUNG! +50 HP", this.playerGroup.position, "#2ecc71");

    } else if (this.activeSisterIdx === 1) {
      // Stella: Sternen-Dash
      sfx.magicSkill(1);
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.playerGroup.quaternion);
      this.playerGroup.position.addScaledVector(forward, 7.5);
      this.showFloatingText("⚡ Sternen-Dash!", this.playerGroup.position, "#ffe066");

      // Star spark burst
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
      // Sol: Versteinerung (Gegner 4 Sekunden zu Stein erstarren lassen!)
      sfx.petrify();
      this.petrifyEnemies(4.0);
      this.showFloatingText("🪨 VERSTEINERUNG! (4s)", this.playerGroup.position, "#e67e22");

    } else if (this.activeSisterIdx === 3) {
      // Planeta: Unsichtbarkeit (5 Sekunden ätherische Tarnung)
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
    // Petrify Boss
    if (this.bossData.alive) {
      const dist = this.bossGroup.position.distanceTo(this.playerGroup.position);
      if (dist < 26) {
        this.bossData.petrifiedTimer = duration;
        this.showFloatingText("🪨 VORTOX VERSTEINERT!", this.bossGroup.position, "#bdc3c7");
      }
    }

    // Petrify Slimes
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
    // Check boss
    if (this.bossData.alive) {
      const d = pos.distanceTo(this.bossGroup.position);
      if (d < radius + 3) {
        this.hitBoss(dmg);
      }
    }
    // Check slimes
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

    // Update Boss UI
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
      // 1 - 4 to switch sister
      if (e.key === '1') this.switchSister(0);
      if (e.key === '2') this.switchSister(1);
      if (e.key === '3') this.switchSister(2);
      if (e.key === '4') this.switchSister(3);
      if (e.key.toLowerCase() === 'q') {
        this.switchSister((this.activeSisterIdx + 1) % 4);
      }
      // E to trigger Power 1
      if (e.key.toLowerCase() === 'e') {
        this.castAbility1();
      }
      // R to trigger Power 2
      if (e.key.toLowerCase() === 'r') {
        this.castAbility2();
      }
      // Space to Jump (preventDefault stops unwanted browser button triggering!)
      if (e.code === 'Space') {
        e.preventDefault();
        this.doJump();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    // UI Click Events for Sisters Switcher
    document.querySelectorAll('.sister-btn[data-sister]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.sister);
        this.switchSister(idx);
        btn.blur(); // Remove focus so Space won't re-trigger
      });
    });

    // Boss 2 Modal
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

    // Audio toggle
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
    // 1. Intro Screen Start Button
    const btnStart = document.getElementById('btn-start-game');
    const introScreen = document.getElementById('intro-screen');
    if (btnStart && introScreen) {
      btnStart.addEventListener('click', () => {
        sfx.startBGM();
        introScreen.classList.add('hidden');
      });
    }

    // 2. Roblox Action Circles (Jump, Power 1, Power 2)
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

    // 3. Virtual Joystick on Bottom Left (Touch & Mouse dragging)
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

    // Convert 3D position to screen
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

  // Running particles behind character feet
  spawnRunningParticle() {
    if (Math.random() > 0.4) return;
    const s = SISTERS[this.activeSisterIdx];
    const pMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 4, 4),
      new THREE.MeshBasicMaterial({ color: s.themeColor, transparent: true, opacity: 0.85 })
    );
    pMesh.position.set(
      this.playerGroup.position.x + (Math.random() - 0.5) * 0.35,
      0.15,
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
  // 9. GAME LOOP & ANIMATION
  // ==========================================
  animate() {
    requestAnimationFrame(() => this.animate());

    // Update Ability Cooldown UI for Power 1
    const p1CdOverlay = document.getElementById('circle-power1-cd');
    if (this.cooldown1 > 0) {
      this.cooldown1 -= 0.016;
      if (p1CdOverlay) {
        p1CdOverlay.classList.add('active');
        p1CdOverlay.textContent = `${this.cooldown1.toFixed(1)}s`;
      }
    } else if (p1CdOverlay) {
      p1CdOverlay.classList.remove('active');
      p1CdOverlay.textContent = '';
    }

    // Update Ability Cooldown UI for Power 2
    const p2CdOverlay = document.getElementById('circle-power2-cd');
    if (this.cooldown2 > 0) {
      this.cooldown2 -= 0.016;
      if (p2CdOverlay) {
        p2CdOverlay.classList.add('active');
        p2CdOverlay.textContent = `${this.cooldown2.toFixed(1)}s`;
      }
    } else if (p2CdOverlay) {
      p2CdOverlay.classList.remove('active');
      p2CdOverlay.textContent = '';
    }

    // Invisibility timer for Planeta
    if (this.isPlayerInvisible) {
      this.invisibleTimer -= 0.016;
      if (this.invisibleTimer <= 0) {
        this.isPlayerInvisible = false;
        this.playerDressMat.transparent = false;
        this.playerDressMat.opacity = 1.0;
        this.playerHairMat.transparent = false;
        this.playerHairMat.opacity = 1.0;
        this.showFloatingText("✨ Wieder sichtbar!", this.playerGroup.position, "#c77dff");
      }
    }

    // 9.1 Player Movement
    this.updatePlayerMovement();

    // 9.2 Projectiles & Particles
    this.updateProjectiles();

    // 9.3 Boss Vortox AI & Attacks
    this.updateBossAI();

    // 9.4 Ambient Animations (Creatures hopping, grass sway, tree petals)
    this.updateWorldAmbience();

    // Dynamic BGM based on distance to boss
    if (this.bossData && this.bossData.alive) {
      const dist = this.bossGroup.position.distanceTo(this.playerGroup.position);
      sfx.setBGMMode(dist < 28 ? 'boss' : 'peaceful');
    }

    // Camera follow smoothly
    this.controls.target.lerp(
      new THREE.Vector3(this.playerGroup.position.x, this.playerGroup.position.y + 1.6, this.playerGroup.position.z),
      0.08
    );
    this.controls.update();

    this.renderer.render(this.scene, this.camera);
  }

  updatePlayerMovement() {
    const current = SISTERS[this.activeSisterIdx];
    let moveX = 0;
    let moveZ = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) moveZ -= 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) moveZ += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) moveX -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) moveX += 1;

    // Merge with Virtual Joystick input
    if (this.joystickDelta.x !== 0 || this.joystickDelta.y !== 0) {
      moveX += this.joystickDelta.x;
      moveZ += this.joystickDelta.y;
    }

    const isMoving = (moveX !== 0 || moveZ !== 0);

    if (isMoving) {
      const moveVec = new THREE.Vector3(moveX, 0, moveZ);
      if (moveVec.length() > 1) moveVec.normalize();
      
      // Align movement with camera orientation
      const camEuler = new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ');
      moveVec.applyEuler(camEuler);

      this.playerGroup.position.x += moveVec.x * current.speed;
      this.playerGroup.position.z += moveVec.z * current.speed;

      // Face direction of movement
      const targetAngle = Math.atan2(moveVec.x, moveVec.z);
      this.playerGroup.rotation.y = targetAngle;

      // Cute run wobble
      this.playerDress.rotation.z = Math.sin(Date.now() * 0.015) * 0.08;

      // Running footstep particles!
      if (this.isGrounded) {
        this.spawnRunningParticle();
      }
    } else {
      this.playerDress.rotation.z = 0;
    }

    // Gravity & Obby Platform Collision
    this.playerVelY -= current.gravity;
    this.playerGroup.position.y += this.playerVelY;

    // Check platform collision
    let onPlatform = false;
    for (const plat of this.platforms) {
      const dx = this.playerGroup.position.x - plat.box.getCenter(new THREE.Vector3()).x;
      const dz = this.playerGroup.position.z - plat.box.getCenter(new THREE.Vector3()).z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < plat.radius && this.playerGroup.position.y >= plat.topY - 0.4 && this.playerGroup.position.y <= plat.topY + 0.5) {
        if (this.playerVelY <= 0) {
          this.playerGroup.position.y = plat.topY;
          this.playerVelY = 0;
          this.isGrounded = true;
          onPlatform = true;
          break;
        }
      }
    }

    // Ground check (y = 0)
    if (!onPlatform) {
      if (this.playerGroup.position.y <= 0) {
        this.playerGroup.position.y = 0;
        this.playerVelY = 0;
        this.isGrounded = true;
      }
    }
  }

  updateProjectiles() {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.mesh.position.addScaledVector(p.dir, p.speed);
      p.life--;

      // Hit boss
      if (this.bossData.alive && p.mesh.position.distanceTo(this.bossGroup.position) < 3.8) {
        this.hitBoss(p.damage);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      // Hit slimes
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

    // Particles
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

  updateBossAI() {
    if (!this.bossData.alive) return;

    // Check if boss is currently petrified by Sol
    if (this.bossData.petrifiedTimer > 0) {
      this.bossData.petrifiedTimer -= 0.016;
      document.getElementById('boss-state-text').textContent = `🪨 VERSTEINERT! (${this.bossData.petrifiedTimer.toFixed(1)}s)`;
      return; // Freeze all movement and attacks!
    }

    const distToPlayer = this.bossGroup.position.distanceTo(this.playerGroup.position);
    const bossBanner = document.getElementById('boss-banner');

    // Show boss banner when near arena
    if (distToPlayer < 24) {
      bossBanner.classList.add('visible');
    } else {
      bossBanner.classList.remove('visible');
    }

    this.bossData.timer += 0.016;

    // Wing flap
    const wingFlap = Math.sin(Date.now() * 0.008) * 0.4;
    this.leftWing.rotation.y = 0.6 + wingFlap;
    this.rightWing.rotation.y = -0.6 - wingFlap;

    // If player is invisible, boss loses target
    if (this.isPlayerInvisible) {
      return;
    }

    // AI Phase State Machine
    if (this.bossData.state === 'idle') {
      // Look at player
      this.bossGroup.lookAt(this.playerGroup.position.x, 0, this.playerGroup.position.z);

      if (distToPlayer < 18) {
        // Trigger signature Tornado-Spin!
        this.bossData.state = 'spin';
        this.bossData.timer = 0;
        document.getElementById('boss-state-text').textContent = "🌪️ TORNADO-WIRBEL! GEFAHR!";
        sfx.bossSpin();
      }
    } else if (this.bossData.state === 'spin') {
      // TORNADO SPIN ATTACK: spins super fast and charges towards player!
      this.bossGroup.rotation.y += 0.35;
      
      const dir = new THREE.Vector3().subVectors(this.playerGroup.position, this.bossGroup.position).normalize();
      this.bossGroup.position.addScaledVector(dir, 0.12);

      // Hit player check
      if (distToPlayer < 3.8) {
        if (this.activeSisterIdx === 0 && this.shieldMesh.material.opacity > 0) {
          // Luna's shield deflects!
          this.showFloatingText("🛡️ Mond-Schild blockt Wirbel!", this.playerGroup.position, "#90e0ef");
        } else {
          this.playerHP = Math.max(0, this.playerHP - 0.4);
          document.getElementById('player-hp-bar').style.width = `${this.playerHP}%`;
        }
      }

      // After 3.5 seconds of spinning, Boss gets dizzy!
      if (this.bossData.timer > 3.5) {
        this.bossData.state = 'dizzy';
        this.bossData.timer = 0;
        document.getElementById('boss-state-text').textContent = "💫 Vortox ist schwindelig! SCHLAGT JETZT ZU!";
        this.showFloatingText("💫 Boss ist schwindelig!", this.bossGroup.position, "#ffdf6b");
      }
    } else if (this.bossData.state === 'dizzy') {
      // Wobble in place dizzy
      this.bossGroup.rotation.z = Math.sin(Date.now() * 0.01) * 0.25;
      
      // Vulnerability window: recovers after 4 seconds
      if (this.bossData.timer > 4.0) {
        this.bossGroup.rotation.z = 0;
        this.bossData.state = 'idle';
        this.bossData.timer = 0;
        document.getElementById('boss-state-text').textContent = "Vorsicht: Dreht sich schnell im Kreis!";
      }
    }
  }

  updateWorldAmbience() {
    const now = Date.now();

    // Temple Crystal rotation
    if (this.templeCrystal) {
      this.templeCrystal.rotation.y += 0.015;
      this.templeCrystal.rotation.x = Math.sin(now * 0.001) * 0.2;
    }

    // Trophy Star
    if (this.trophyStar) {
      this.trophyStar.rotation.y += 0.02;
    }

    // Starlet Creatures bouncing
    this.creatures.forEach((c) => {
      c.position.y = Math.abs(Math.sin(now * 0.004 + c.userData.hopOffset)) * 0.8;
    });

    // Visible 3D Grass Blades swaying gently in the breeze
    if (this.grassBlades) {
      const grassTime = now * 0.003;
      for (let g of this.grassBlades) {
        g.rotation.z = Math.sin(grassTime + g.userData.swayOffset) * 0.12;
      }
    }

    // Slimes idle squish and petrify check
    this.slimes.forEach((s) => {
      if (s.userData.alive) {
        if (s.userData.petrifiedTimer > 0) {
          s.userData.petrifiedTimer -= 0.016;
          return; // stone frozen
        }
        const squish = 0.8 + Math.sin(now * 0.005) * 0.15;
        s.children[0].scale.set(1 / squish, squish, 1 / squish);
      }
    });

    // Running footstep particles
    this.updateRunningParticles();

    // Falling lila & rosa particles from enchanted trees
    this.updateFallingPetals();
  }

  updateFallingPetals() {
    if (!this.treePetals || this.treePetals.length === 0) return;
    const time = Date.now() * 0.002;

    for (let i = 0; i < this.treePetals.length; i++) {
      const p = this.treePetals[i];
      p.mesh.position.y -= p.fallSpeed;
      p.mesh.position.x += Math.sin(time * p.swaySpeed + p.swaySeed) * 0.016;
      p.mesh.position.z += Math.cos(time * p.swaySpeed * 1.3 + p.swaySeed) * 0.016;

      p.mesh.rotation.x += p.rotX;
      p.mesh.rotation.y += p.rotY;
      p.mesh.rotation.z += p.rotZ;

      // When reaching near ground, respawn at random tree canopy
      if (p.mesh.position.y <= 0.2) {
        const tree = this.treeCanopies[Math.floor(Math.random() * this.treeCanopies.length)];
        if (tree) {
          const ang = Math.random() * Math.PI * 2;
          const dist = Math.random() * tree.radius;
          p.mesh.position.set(
            tree.x + Math.cos(ang) * dist,
            tree.y + 0.3 + Math.random() * 1.2,
            tree.z + Math.sin(ang) * dist
          );
        }
      }
    }
  }
}

// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
  new GalaxySistersGame();
});
