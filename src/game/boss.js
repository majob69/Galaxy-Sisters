// Boss Vortox: model, AI (host / puppet), damage and defeat. Methods are mixed into the game class (see main.js), so `this` is the game.
import * as THREE from 'three';
import { sfx } from './shared.js';

export const bossMethods = {

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
  },


  petrifyEnemies(duration) {
    this.petrifyWisps(duration);
    if (this.morvanta.hittable && this.morvanta.pos.distanceTo(this.playerGroup.position) < 26) {
      if (this.coop.puppetBoss) this.coop.send({ t: 'boss2Hit', dmg: 0, pet: duration });
      else this.morvanta.petrify(duration);
      this.showFloatingText("🪨 MORVANTA VERSTEINERT!", this.morvanta.pos, "#bdc3c7");
    }
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
  },


  petrifyBoss(duration) {
    if (this.bossData.alive) this.bossData.petrifiedTimer = Math.min(10, duration);
  },


  // Hits go to the host, who owns the boss (solo play: this client is the host)
  hitBoss(dmg) {
    if (!this.bossData.alive) return;
    if (this.coop.puppetBoss) {
      this.coop.send({ t: 'bossHit', dmg });
      sfx.hit();
      return;
    }
    this.applyBossDamage(dmg);
  },


  applyBossDamage(dmg) {
    if (!this.bossData.alive) return;
    this.bossData.hp = Math.max(0, this.bossData.hp - dmg);
    sfx.hit();
    this.showFloatingText(`-${dmg} HP!`, this.bossGroup.position, "#00f0ff");
    this.updateBossBar();
    if (this.bossData.hp <= 0) this.defeatBoss();
  },


  updateBossBar() {
    const pct = (this.bossData.hp / this.bossData.maxHp) * 100;
    document.getElementById('boss-hp-bar').style.width = `${pct}%`;
  },


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
    this.progression.addXp(100, 'Vortox besiegt');
    this.morvanta.onVortoxDefeated();
    this.dropLoot(this.bossGroup.position, { dust: 1, heart: 1 });
    this.dropLoot(this.bossGroup.position, { dust: 1, heart: 0.6 });
  },


  setBossStateText() {
    const texts = {
      idle: "Vorsicht: Dreht sich schnell im Kreis!",
      spin: "🌪️ TORNADO-WIRBEL! GEFAHR!",
      dizzy: "💫 Vortox ist schwindelig! SCHLAGT JETZT ZU!"
    };
    document.getElementById('boss-state-text').textContent = texts[this.bossData.state] || texts.idle;
  },


  playBossSpin() {
    sfx.bossSpin();
  },


  killSlimeRemote(i) {
    const slime = this.slimes[i];
    if (!slime || !slime.userData.alive) return;
    slime.userData.alive = false;
    slime.userData.deadAt = this.clock.elapsedTime;
    slime.visible = false;
    this.fx.burst(slime.position.clone().setY(slime.position.y + 0.7), [new THREE.Color(0.6, 2.4, 1.0), new THREE.Color(1.8, 2.4, 1.4)], 40, { speed: 4, up: 2, size: 0.4 });
  },


  // Nearest visible sister (local or remote): the boss chases whoever is closest
  getBossTarget() {
    let best = null;
    let bestDist = Infinity;
    const consider = (pos) => {
      const d = pos.distanceTo(this.bossGroup.position);
      if (d < bestDist) { bestDist = d; best = pos; }
    };
    if (!this.isPlayerInvisible && !this.isDowned) consider(this.playerGroup.position);
    this.remotes.list.forEach(r => { if (r.hasState && !r.invisible && !r.downed) consider(r.group.position); });
    return best;
  },


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
    if (b.state === 'spin' && distToPlayer < 3.8 && !this.isDowned) {
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
};
