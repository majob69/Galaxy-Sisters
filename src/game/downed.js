// Knocked out (0 HP): the sister lies down. A friend standing close (or Luna's heal) revives her;
// alone, or if nobody comes, she wakes up at the start point after a while.
import * as THREE from 'three';
import { sfx } from './shared.js';

const REVIVE_TIME = 3;      // seconds a friend has to stay close
const REVIVE_RANGE = 3.4;
const SOLO_RESPAWN = 5;     // seconds until she wakes up at the start when playing alone
const COOP_RESPAWN = 22;    // ... and when playing with friends who do not come to help
const SPAWN = { x: 0, z: 8 };

export const downedMethods = {
  goDown() {
    if (this.isDowned) return;
    this.isDowned = true;
    this.downedTimer = 0;
    this.reviveProgress = 0;
    this.playerVelY = 0;
    this.joystickDelta.x = 0;
    this.joystickDelta.y = 0;
    this.shieldMesh.material.opacity = 0;
    this.isPlayerInvisible = false;
    this.playerRig.setOpacity(1);
    sfx.hit();
    const p = this.playerGroup.position;
    this.fx.burst(p.clone().setY(p.y + 1), [new THREE.Color(1.6, 1.4, 2.4), new THREE.Color(2.4, 2.0, 1.2)], 26, { speed: 2.5, up: 1.5, size: 0.35, gravity: 2 });
    document.getElementById('ko-overlay').classList.add('visible');
    this.coop.sendEmote('🆘');
  },

  revive(fraction) {
    if (!this.isDowned) return;
    this.isDowned = false;
    this.reviveProgress = 0;
    this.playerHP = Math.max(1, Math.round(this.maxPlayerHP * fraction));
    this.updateHPBar();
    document.getElementById('ko-overlay').classList.remove('visible');
    this.createHealParticles(this.playerGroup.position);
    sfx.heal();
  },

  respawnAtStart() {
    const p = this.playerGroup.position;
    p.set(SPAWN.x, this.getTerrainHeight(SPAWN.x, SPAWN.z), SPAWN.z);
    this.revive(0.6);
    this.showToast('✨ Du bist am Startpunkt wieder aufgewacht');
  },

  updateDowned(delta) {
    if (!this.isDowned) {
      if (this.playerHP <= 0) this.goDown();
      return;
    }
    this.downedTimer += delta;
    const pp = this.playerGroup.position;
    const near = this.remotes.list.some(r => r.hasState && !r.downed && r.group.position.distanceTo(pp) < REVIVE_RANGE);
    this.reviveProgress = near
      ? Math.min(1, this.reviveProgress + delta / REVIVE_TIME)
      : Math.max(0, this.reviveProgress - delta * 0.4);

    const limit = this.coop.active ? COOP_RESPAWN : SOLO_RESPAWN;
    const left = Math.max(0, Math.ceil(limit - this.downedTimer));
    const text = near ? '💚 Deine Freundin hilft dir auf …'
      : this.coop.active ? `Bleib liegen – Freunde können dich wiederbeleben (Startpunkt in ${left} s)`
        : `Du wachst am Startpunkt auf in ${left} s`;
    document.getElementById('ko-text').textContent = text;
    document.getElementById('ko-fill').style.width = `${this.reviveProgress * 100}%`;

    if (this.reviveProgress >= 1) this.revive(0.5);
    else if (this.downedTimer >= limit) this.respawnAtStart();
  }
};
