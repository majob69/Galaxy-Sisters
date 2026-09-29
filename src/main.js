import * as THREE from 'three';
import { Heightfield, waterQuery } from './landscape.js';
import { applyCelShading } from './atmosphere.js';
import { DayNightCycle } from './daynight.js';
import { QuestSystem, QUEST_DEFS } from './quests.js';
import { Compass } from './compass.js';
import { PerformanceGovernor, PERF_TIERS } from './perf.js';
import { RemotePlayers } from './remote.js';
import { CoopSession } from './coop.js';
import { Progression } from './progression.js';
import { StarGate } from './stargate.js';
import { Morvanta } from './morvanta.js';
import { WORLD_SEED, mulberry32, sfx } from './game/shared.js';
import { worldTerrainMethods } from './game/world-terrain.js';
import { worldPropsMethods } from './game/world-props.js';
import { creatureMethods } from './game/creatures.js';
import { bossMethods } from './game/boss.js';
import { abilityMethods } from './game/abilities.js';
import { playerMethods } from './game/player.js';
import { uiMethods } from './game/ui.js';
import { downedMethods } from './game/downed.js';
import { enemyMethods } from './game/enemies.js';

applyCelShading();

// ==========================================
// MAIN GAME APPLICATION
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

    // Star level, XP and unlockable outfits; knocked-out state; enemies and loot
    this.progression = new Progression(this);
    this.isDowned = false;
    this.downedTimer = 0;
    this.reviveProgress = 0;
    this.initEnemies();
    this.isGrabbed = false;
    this.applyQuestRewards(false);

    // Co-op puzzle and the second boss (positions are found deterministically, so all players agree)
    this.stargate = new StarGate(this);
    this.morvanta = new Morvanta(this);

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
      targets.push(...this.stargate.getTargets(), ...this.morvanta.getTargets(), ...this.coop.getCompassTargets());
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
      velY: this.playerVelY,
      downed: this.isDowned
    });

    // 9.2 Projectiles & Particles
    this.updateProjectiles();

    // 9.2b Enemies, loot and the knocked-out state
    this.updateEnemies(delta);
    this.updateDowned(delta);
    this.stargate.update(delta);
    this.morvanta.update(delta);

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


  // River & night quests (see quests.js); every finished quest adds +10 max HP
  buildWorldQuests() {
    this.quests = new QuestSystem(this, {
      onCollect: (text) => {
        this.showFloatingText(text, this.playerGroup.position, '#9ff3ff');
        sfx.collect();
      },
      onQuestDone: (quest) => {
        this.applyQuestRewards(true);
        this.progression.addXp(40);
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
    this.maxPlayerHP = 100 + done * 10 + (this.progression ? this.progression.hpBonus : 0);
    this.playerHP = heal ? this.maxPlayerHP : Math.min(this.playerHP, this.maxPlayerHP);
    this.updateHPBar();
  }
}

// Feature areas live in their own files; their methods become methods of the game
Object.assign(
  GalaxySistersGame.prototype,
  worldTerrainMethods,
  worldPropsMethods,
  creatureMethods,
  bossMethods,
  abilityMethods,
  playerMethods,
  uiMethods,
  downedMethods,
  enemyMethods
);


// Start game when page loads
window.addEventListener('DOMContentLoaded', () => {
  const btnStart = document.getElementById('btn-start-game');
  const startLabel = btnStart ? (btnStart.dataset.label || btnStart.innerHTML) : '';
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.style.opacity = '0.75';
    btnStart.innerHTML = '<span>⏳</span> Welt wird gebaut …';
  }

  // Let the intro screen paint before the world generation blocks the main thread
  // (a timer instead of requestAnimationFrame: rAF never fires in a background tab)
  setTimeout(() => {
    let game;
    try {
      game = new GalaxySistersGame();
    } catch (err) {
      console.error(err);
      if (window.__gsWarn) window.__gsWarn('⚠️ Beim Aufbau der Welt ist ein Fehler aufgetreten: ' + err.message + '. Bitte mit Strg+F5 neu laden.');
      return;
    }
    window.__gsReady = true;
    const warning = document.getElementById('load-warning');
    if (warning) warning.hidden = true;
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
  }, 80);
});
