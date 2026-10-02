// Player mesh, physics, swimming, footsteps and camera collision. Methods are mixed into the game class (see main.js), so `this` is the game.
import * as THREE from 'three';
import { bridgeDeckY } from '../bridges.js';
import { ChibiRig } from '../characters.js';
import { createShieldMaterial } from '../magicfx.js';
import { sfx, SISTERS } from './shared.js';

export const playerMethods = {

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
  },


  updateSisterAccessory() {
    const variant = this.progression ? this.progression.getSkin(this.activeSisterIdx) : 0;
    this.applySisterLook(this.playerRig, this.activeSisterIdx, variant);
  },


  // Hair/dress style plus the sister's little emblem (also used for remote players)
  applySisterLook(rig, idx, variant = 0) {
    const slot = rig.accessorySlot;
    while (slot.children.length > 0) {
      slot.remove(slot.children[0]);
    }

    rig.setStyle(idx, variant);

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
  },


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
  },


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
  },


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
  },


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
  },


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
  },


  doJump() {
    if (this.isDowned) return;
    if (this.isGrabbed) {
      this.morvanta.onJumpWhileGrabbed();
      return;
    }
    this.jumpBufferTimer = 0.12; // 120ms jump buffer
    const current = SISTERS[this.activeSisterIdx];
    if (this.isGrounded || this.coyoteTimer > 0) {
      // A little dolphin kick helps climbing out of deep water
      this.playerVelY = current.jumpPower * (this.isSwimming ? 1.25 : 1);
      this.isGrounded = false;
      this.coyoteTimer = 0;
      this.jumpBufferTimer = 0;
      sfx.jump();
    } else if (!this.isSwimming && !this.airJumpUsed) {
      // Second press in the air: a higher star jump with a little spin
      this.airJumpUsed = true;
      this.jumpBufferTimer = 0;
      this.playerVelY = current.jumpPower * 1.2;
      this.jumpSpin = 1;
      const p = this.playerGroup.position;
      this.fx.burst(p.clone().setY(p.y + 0.4), [new THREE.Color(2.4, 2.0, 0.8), new THREE.Color(1.8, 1.6, 2.6)], 18, { speed: 2.5, up: -0.5, size: 0.3, gravity: 1 });
      this.fx.ringWave(p.clone(), new THREE.Color(1.8, 1.6, 2.6), 1.6, 0.35);
      sfx.jump();
      sfx.playTone(880, 'sine', 0.12, 0.05);
    }
  },


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
    if (this.isDowned || this.isGrabbed) {
      moveX = 0;
      moveZ = 0;
    }

    // Wish direction relative to the camera; the actual velocity eases towards it
    const wish = new THREE.Vector3(moveX, 0, moveZ);
    if (wish.lengthSq() > 1) wish.normalize();
    const hasInput = wish.lengthSq() > 0.0001;
    if (hasInput) wish.applyEuler(new THREE.Euler(0, this.camera.rotation.y, 0, 'YXZ'));
    const joyMag = Math.hypot(this.joystickDelta.x, this.joystickDelta.y);
    const sprinting = hasInput && !this.isSwimming && (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || joyMag > 0.97);
    this.isSprinting = sprinting;
    const maxStep = current.speed * this.waterSpeedFactor * (this.slowTimer > 0 ? 0.5 : 1) * (sprinting ? 1.45 : 1);
    if (!this.moveVel) this.moveVel = new THREE.Vector3();
    const rate = hasInput ? (this.isGrounded ? 12 : 6) : (this.isGrounded ? 16 : 2.5);
    this.moveVel.lerp(wish.multiplyScalar(maxStep), Math.min(1, rate * delta));
    const speedNow = this.moveVel.length();
    const isMoving = speedNow > 0.012;
    this.playerIsMoving = isMoving && (hasInput || speedNow > 0.05);

    // Turn smoothly towards where we want to go
    if (hasInput) {
      const want = Math.atan2(this.moveVel.x, this.moveVel.z);
      const diff = Math.atan2(Math.sin(want - this.playerGroup.rotation.y), Math.cos(want - this.playerGroup.rotation.y));
      this.playerGroup.rotation.y += diff * Math.min(1, delta * 14);
    }

    if (isMoving) {
      const oldX = this.playerGroup.position.x;
      const oldZ = this.playerGroup.position.z;
      const playerRadius = 0.42;
      const playerY = this.playerGroup.position.y;
      const moveStep = speedNow * dtFactor;

      // X-axis movement & collision (sliding along walls)
      const nextX = oldX + this.moveVel.x * dtFactor;
      if (!this.checkWallCollision(nextX, oldZ, playerRadius, playerY) && this.inWorldBounds(nextX, oldZ)) {
        this.playerGroup.position.x = nextX;
      } else {
        this.moveVel.x = 0;
      }

      // Z-axis movement & collision
      const nextZ = oldZ + this.moveVel.z * dtFactor;
      if (!this.checkWallCollision(this.playerGroup.position.x, nextZ, playerRadius, playerY) && this.inWorldBounds(this.playerGroup.position.x, nextZ)) {
        this.playerGroup.position.z = nextZ;
      } else {
        this.moveVel.z = 0;
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
    this.clampToWorld(this.playerGroup.position);

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

    if (this.isGrounded) this.airJumpUsed = false;
    if (this.jumpSpin > 0) {
      this.jumpSpin = Math.max(0, this.jumpSpin - delta * 2.4);
      this.playerRig.group.rotation.y = (1 - this.jumpSpin) * Math.PI * 2;
      if (this.jumpSpin === 0) this.playerRig.group.rotation.y = 0;
    }

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
  },


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
  },


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
  },


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
  },


  // Third-person helper: while walking, the camera swings gently behind the sister
  // (not while the player turns the camera, and not when walking towards the camera)
  autoFollowCamera(delta) {
    if (!this.camFollow || this.camDragging || !this.playerIsMoving) return;
    if (performance.now() - this.lastCamInput < 1500) return;
    const target = this.controls.target;
    const cam = this.camera.position;
    const ox = cam.x - target.x;
    const oz = cam.z - target.z;
    const yaw = Math.atan2(ox, oz);
    const facing = this.playerGroup.rotation.y;
    if (Math.cos(facing - yaw) > 0.35) return; // walking towards the camera
    const diff = Math.atan2(Math.sin(facing + Math.PI - yaw), Math.cos(facing + Math.PI - yaw));
    const step = diff * Math.min(1, delta * 1.6);
    const c = Math.cos(step);
    const s = Math.sin(step);
    cam.x = target.x + ox * c + oz * s;
    cam.z = target.z + oz * c - ox * s;
  },

  updateHPBar() {
    const bar = document.getElementById('player-hp-bar');
    if (bar) bar.style.width = `${(this.playerHP / this.maxPlayerHP) * 100}%`;
  }
};
