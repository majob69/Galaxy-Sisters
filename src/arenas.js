// ==========================================
// ARENA LOCK: walk into a boss arena while the boss lives and a glowing wall seals it -
// you can only leave once the boss is beaten (or if you are knocked out and wake up at the start).
// The bosses are kept inside their arena as well (see clampToArena).
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';

export class ArenaLock {
  constructor(game) {
    this.game = game;
    this.locked = null;
    const g = game;
    this.arenas = [
      { name: 'Vortox', x: 32, z: 30, r: 16, color: 0x7fe0ff, active: () => g.bossData.alive },
      { name: 'Morvanta', x: g.morvanta.center.x, z: g.morvanta.center.z, r: 17, color: 0xff7ee3, active: () => g.morvanta.d.alive && g.morvanta.d.awake },
      { name: 'Glaciel', x: g.glaciel.center.x, z: g.glaciel.center.z, r: 14, color: 0x9fe8ff, active: () => g.glaciel.d.alive && g.glaciel.d.awake }
    ];
    this.arenas.forEach(a => {
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(a.color).multiplyScalar(1.4), transparent: true, opacity: 0, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending
      });
      mat.userData.noNightGlow = true;
      const wall = new THREE.Mesh(new THREE.CylinderGeometry(a.r, a.r, 7, 64, 1, true), mat);
      wall.position.set(a.x, g.getTerrainHeight(a.x, a.z) + 3.2, a.z);
      wall.visible = false;
      g.scene.add(wall);
      a.wall = wall;
    });
  }

  // Keep a boss (or anything) inside an arena
  static clamp(pos, cx, cz, r) {
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d = Math.hypot(dx, dz);
    if (d > r) {
      pos.x = cx + (dx / d) * r;
      pos.z = cz + (dz / d) * r;
    }
  }

  update(delta) {
    const g = this.game;
    const pp = g.playerGroup.position;
    const t = g.clock.elapsedTime;
    this.arenas.forEach(a => {
      const active = a.active();
      const d = Math.hypot(pp.x - a.x, pp.z - a.z);
      const near = active && d < a.r + 18;
      const isLocked = this.locked === a;
      a.wall.visible = near || isLocked;
      if (a.wall.visible) a.wall.material.opacity = (isLocked ? 0.32 : 0.12) + Math.sin(t * 3) * 0.04;

      if (!this.locked && active && d < a.r - 0.6 && !g.isDowned) {
        this.locked = a;
        sfx.bossSpin();
        g.showToast(`🔒 Die Arena ist versiegelt! Besiege ${a.name}, um sie wieder zu verlassen.`, 5000);
      }
    });

    const a = this.locked;
    if (!a) return;
    const d = Math.hypot(pp.x - a.x, pp.z - a.z);
    if (!a.active()) {
      this.locked = null;
      g.showToast(`🔓 ${a.name} ist besiegt – die Arena ist wieder offen!`, 4000);
      return;
    }
    // Teleported away (knocked out and woke up at the start): the seal lets go
    if (d > a.r + 4) {
      this.locked = null;
      return;
    }
    if (d > a.r - 0.8) {
      ArenaLock.clamp(pp, a.x, a.z, a.r - 0.8);
      if (g.moveVel) {
        const nx = (pp.x - a.x) / d;
        const nz = (pp.z - a.z) / d;
        const out = g.moveVel.x * nx + g.moveVel.z * nz;
        if (out > 0) { g.moveVel.x -= nx * out; g.moveVel.z -= nz * out; }
      }
    }
  }
}
