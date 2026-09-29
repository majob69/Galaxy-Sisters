// Sister abilities, projectiles and their effects. Methods are mixed into the game class (see main.js), so `this` is the game.
import * as THREE from 'three';
import { sfx, SISTERS } from './shared.js';

export const abilityMethods = {

  switchSister(idx) {
    if (idx < 0 || idx >= SISTERS.length) return;
    this.activeSisterIdx = idx;
    this.updateSisterAccessory();
    if (this.progression) this.progression.render();
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
  },


  // ==========================================
  // 7. ABILITIES
  // ==========================================
  castAbility1() {
    if (this.cooldown1 > 0 || this.isDowned) return;
    const current = SISTERS[this.activeSisterIdx];
    this.cooldown1 = current.ability1.cooldown * this.progression.cooldownMul;
    this.coop.sendCast(1);
    if (this.shrine) this.shrine.onCast(this.activeSisterIdx, 1, this.playerGroup.position);

    if (this.activeSisterIdx === 0) {
      sfx.magicSkill(0);
      this.shieldMesh.material.opacity = 0.75;
      this.playerVelY = 0.28;
      const lp = this.playerGroup.position;
      this.fx.ringWave(lp, new THREE.Color(0.8, 1.5, 2.4), 4.5, 0.6);
      this.fx.burst(lp.clone().setY(lp.y + 1.4), [new THREE.Color(1.0, 1.4, 2.4), new THREE.Color(2.0, 2.0, 2.4)], 36, { speed: 3.5, up: 1.2, size: 0.35 });
      const shieldSeconds = this.progression.has('luna_shield') ? 11 : 7;
      this.showFloatingText(`🌙 Mond-Schild (${shieldSeconds}s) aktiv!`, this.playerGroup.position, "#90e0ef");
      clearTimeout(this.shieldTimeout);
      this.shieldTimeout = setTimeout(() => {
        this.shieldMesh.material.opacity = 0;
      }, shieldSeconds * 1000);

    } else if (this.activeSisterIdx === 1) {
      sfx.arrowShoot();
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerGroup.quaternion);
      this.showFloatingText("🏹 Sternen-Bogen!", this.playerGroup.position, "#ffe066");

      this.spawnStarArrows(this.playerGroup.position, forward, false);

    } else if (this.activeSisterIdx === 2) {
      sfx.magicSkill(2);
      this.showFloatingText("☀️ SUPERNOVA!", this.playerGroup.position, "#ff7b00");
      this.createSupernovaParticles(this.playerGroup.position);
      const novaRadius = this.progression.has('sol_nova') ? 13 : 9;
      if (novaRadius > 9) this.fx.ringWave(this.playerGroup.position, new THREE.Color(1.9, 0.9, 0.25), novaRadius, 0.7);
      this.damageInRadius(this.playerGroup.position, novaRadius, this.scaledDamage(45));

    } else if (this.activeSisterIdx === 3) {
      sfx.magicSkill(3);
      this.showFloatingText("🪐 Planeten-Ringe!", this.playerGroup.position, "#9d4edd");
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerGroup.quaternion);
      this.spawnPlanetRing(this.playerGroup.position, forward, false);
      if (this.progression.has('planeta_rings')) {
        setTimeout(() => {
          const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerGroup.quaternion);
          this.spawnPlanetRing(this.playerGroup.position, fwd, false);
        }, 380);
      }
    }
  },


  // Stella's star arrows; remote = visual only (the caster's client does the damage)
  spawnStarArrows(origin, forward, remote) {
    forward = forward.clone().setY(0).normalize();
    const spread = !remote && this.progression.has('stella_arrows') ? 2.5 : 1.5;
    for (let i = -spread; i <= spread; i += 1.0) {
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
        damage: remote ? 0 : this.scaledDamage(25),
        kind: 'arrow',
        remote,
        trail: new THREE.Color(2.2, 1.7, 0.5)
      });
      this.scene.add(arrowMesh);
    }
  },


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
      damage: remote ? 0 : this.scaledDamage(32),
      kind: 'ring',
      remote,
      pullRadius: 7,
      trail: new THREE.Color(1.4, 0.7, 2.4),
      spin: 0.12
    });
    this.scene.add(ringGroup);
  },


  castAbility2() {
    if (this.cooldown2 > 0 || this.isDowned) return;
    const current = SISTERS[this.activeSisterIdx];
    this.cooldown2 = current.ability2.cooldown * this.progression.cooldownMul;
    this.coop.sendCast(2);
    if (this.shrine) this.shrine.onCast(this.activeSisterIdx, 2, this.playerGroup.position);

    if (this.activeSisterIdx === 0) {
      sfx.heal();
      const healAmount = this.progression.has('luna_heal') ? 75 : 50;
      this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + healAmount);
      this.updateHPBar();
      this.createHealParticles(this.playerGroup.position);
      this.showFloatingText(`💚 HEILUNG! +${healAmount} HP`, this.playerGroup.position, "#2ecc71");

    } else if (this.activeSisterIdx === 1) {
      // Stella: Safe Sub-stepped Star-Dash
      sfx.magicSkill(1);
      const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.playerGroup.quaternion);
      const dashDist = this.progression.has('stella_dash') ? 11 : 7.5;
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
      const stoneSeconds = this.progression.has('sol_stone') ? 7 : 4;
      this.petrifyEnemies(stoneSeconds);
      this.fx.ringWave(this.playerGroup.position, new THREE.Color(1.4, 1.1, 0.8), 22, 1.0);
      this.showFloatingText(`🪨 VERSTEINERUNG! (${stoneSeconds}s)`, this.playerGroup.position, "#e67e22");

    } else if (this.activeSisterIdx === 3) {
      sfx.invisible();
      this.fx.burst(this.playerGroup.position.clone().setY(this.playerGroup.position.y + 1.2), [new THREE.Color(1.6, 0.8, 2.6), new THREE.Color(2.2, 1.6, 2.6)], 40, { speed: 2.5, up: 1, size: 0.35, gravity: -1 });
      this.isPlayerInvisible = true;
      this.invisibleTimer = this.progression.has('planeta_veil') ? 9.0 : 5.0;
      this.playerRig.setOpacity(0.25);
      this.showFloatingText(`👻 UNSICHTBAR! (${Math.round(this.invisibleTimer)}s)`, this.playerGroup.position, "#c77dff");
    }
  },


  createHealParticles(pos) {
    this.fx.ringWave(pos, new THREE.Color(0.6, 2.4, 1.2), 3, 0.7);
    this.fx.spiral(pos, [new THREE.Color(0.5, 2.4, 1.0), new THREE.Color(0.8, 2.4, 2.0), new THREE.Color(2.0, 2.4, 1.6)], 40, 0.9, 2.6);
  },


  createSupernovaParticles(pos) {
    const core = pos.clone().setY(pos.y + 1.2);
    this.fx.flash(core, new THREE.Color(2.2, 1.2, 0.35), 6.5, 0.4);
    this.fx.ringWave(pos, new THREE.Color(1.9, 0.9, 0.25), 9, 0.55);
    this.fx.ringWave(pos, new THREE.Color(1.5, 1.35, 0.9), 6, 0.4);
    this.fx.burst(core, [new THREE.Color(3.0, 1.0, 0.2), new THREE.Color(2.8, 1.8, 0.4), new THREE.Color(2.4, 2.2, 1.2)], 90, { speed: 9, up: 3, size: 0.5, life: 0.9, gravity: 5 });
  },


  damageInRadius(pos, radius, dmg) {
    if (this.bossData.alive) {
      const d = pos.distanceTo(this.bossGroup.position);
      if (d < radius + 3) {
        this.hitBoss(dmg);
      }
    }
    if (this.morvanta.hittable && pos.distanceTo(this.morvanta.hitPoint) < radius + 3.5) {
      this.morvanta.hit(dmg);
    }
    this.glaciel.areaHit(pos, radius, dmg);
    this.slimes.forEach(slime => {
      if (slime.userData.alive && pos.distanceTo(slime.position) < radius) {
        slime.userData.hp -= dmg;
        sfx.hit();
        this.showFloatingText(`-${dmg}`, slime.position, "#ff4d6d");
        if (slime.userData.hp <= 0) {
          slime.userData.alive = false;
          slime.visible = false;
          this.onSlimeKilledLocal(slime);
          this.showFloatingText("⭐ Slime besiegt!", slime.position, "#ffe066");
        }
      }
    });
    this.hitWisps(pos, radius, dmg);
  },

  // Damage after the star level bonus
  scaledDamage(base) {
    return Math.round(base * this.progression.damageMul);
  },


  healPlayer(amount, from) {
    // A heal from a friend also wakes a knocked-out sister
    if (this.isDowned) {
      this.revive(Math.max(0.3, amount / this.maxPlayerHP));
      this.showFloatingText(`💚 ${from} hat dich geheilt!`, this.playerGroup.position, "#2ecc71");
      return;
    }
    this.playerHP = Math.min(this.maxPlayerHP, this.playerHP + amount);
    this.updateHPBar();
    sfx.heal();
    this.showFloatingText(`💚 +${amount} von ${from}`, this.playerGroup.position, "#2ecc71");
  },


  sfxLevelUp() {
    sfx.heal();
    sfx.collect();
  },

  // Play a sound effect from a spot in the world: quieter with distance, panned to the side it is on
  playSpatial(pos, play) {
    const cam = this.camera.position;
    const dx = pos.x - cam.x;
    const dz = pos.z - cam.z;
    const d = Math.hypot(dx, dz);
    const volume = Math.pow(Math.max(0, 1 - d / 48), 1.6);
    if (volume < 0.03) return;
    const fwd = this._sfxDir || (this._sfxDir = new THREE.Vector3());
    this.camera.getWorldDirection(fwd);
    const len = Math.hypot(fwd.x, fwd.z) || 1;
    const rightX = -fwd.z / len;
    const rightZ = fwd.x / len;
    const pan = Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / Math.max(d, 1))) * 0.85;
    sfx.spatial(volume, pan, play);
  },

  // Remote spells: the matching sound, coming from where the friend stands
  sfxCast(si, pos) {
    this.playSpatial(pos, () => {
      if (si === -1) sfx.heal();
      else if (si === 1) sfx.arrowShoot();
      else sfx.magicSkill(si);
    });
  },


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

      if (!p.remote && this.glaciel.tryHit(p.mesh.position, p.damage)) {
        this.fx.flash(p.mesh.position, p.trail || new THREE.Color(2, 2, 2), 3, 0.25);
        this.fx.burst(p.mesh.position, [p.trail || new THREE.Color(2, 2, 2), new THREE.Color(1.4, 2.4, 3.0)], 20, { speed: 4, up: 1.5, size: 0.35 });
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

      if (!p.remote && this.morvanta.hittable && p.mesh.position.distanceTo(this.morvanta.hitPoint) < 4.6) {
        this.fx.flash(p.mesh.position, p.trail || new THREE.Color(2, 2, 2), 3, 0.25);
        this.fx.burst(p.mesh.position, [p.trail || new THREE.Color(2, 2, 2), new THREE.Color(2.2, 2.2, 2.2)], 22, { speed: 4, up: 1.5, size: 0.35 });
        this.morvanta.hit(p.damage);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
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
            this.onSlimeKilledLocal(slime);
            this.fx.burst(slime.position.clone().setY(slime.position.y + 0.7), [new THREE.Color(0.6, 2.4, 1.0), new THREE.Color(1.8, 2.4, 1.4)], 40, { speed: 4, up: 2, size: 0.4 });
            this.fx.ringWave(slime.position, new THREE.Color(0.6, 2.2, 1.0), 3, 0.5);
          }
        }
      });

      if (!p.remote && this.hitWisps(p.mesh.position, 1.5, p.damage)) {
        this.fx.flash(p.mesh.position, p.trail || new THREE.Color(2, 2, 2), 2, 0.2);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }

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
};
