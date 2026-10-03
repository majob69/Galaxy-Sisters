// ==========================================
// CRITTERS: small, cute animal characters (shop keepers, villagers that give tips ...).
// Built from simple shapes with the same anime face as the slimes and starlets.
// ==========================================
import * as THREE from 'three';
import { addAnimeFace } from './characters.js';
import { bakeStaticGroup } from './bake.js';

const KINDS = {
  cat: { body: 0xf6c28b, belly: 0xfff1de, ears: 'cat', tail: 'long', iris: 0x3aa655 },
  bunny: { body: 0xf4f0f8, belly: 0xffffff, ears: 'bunny', tail: 'puff', iris: 0xd94f8a },
  fox: { body: 0xf08a3c, belly: 0xfff1de, ears: 'cat', tail: 'bushy', iris: 0x7a4b1e },
  bear: { body: 0xa8794f, belly: 0xe6c9a3, ears: 'round', tail: 'puff', iris: 0x3b2a1c },
  owl: { body: 0x8f7bb8, belly: 0xe9dcff, ears: 'tufts', tail: 'none', iris: 0xffb000, wings: true },
  frog: { body: 0x6cc551, belly: 0xdaf5c8, ears: 'none', tail: 'none', iris: 0x2b6b1e, frogEyes: true },
  penguin: { body: 0x2b2f45, belly: 0xffffff, ears: 'none', tail: 'none', iris: 0x3b6fd6, wings: true, beak: true },
  hedgehog: { body: 0x8b6a4f, belly: 0xf3dfc6, ears: 'round', tail: 'none', iris: 0x2a1c12, spikes: true }
};

// colors: optional { body, belly, iris } to recolour a kind (white snow fox, glowing forest bunny ...)
// glow: extra self-light (forest animals shine softly in the twilight)
export function createCritter(kind = 'cat', { scale = 1, accessory = null, colors = null, glow = 0.18 } = {}) {
  const k = { ...(KINDS[kind] || KINDS.cat), ...(colors || {}) };
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const bodyMat = lam(k.body);
  const bellyMat = lam(k.belly);
  bodyMat.emissive = new THREE.Color(k.body).multiplyScalar(glow);
  if (glow > 0.3) bodyMat.userData.noNightGlow = true;
  const g = new THREE.Group();

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), bodyMat);
  body.scale.set(1, 1.1, 0.95);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.36, 14, 10), bellyMat);
  belly.position.set(0, 0.5, 0.2);
  belly.scale.set(1, 1.1, 0.6);
  g.add(belly);

  const head = new THREE.Group();
  head.position.y = 1.35;
  g.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.48, 18, 14), bodyMat);
  skull.castShadow = true;
  head.add(skull);
  const face = addAnimeFace(skull, { center: new THREE.Vector3(0, -0.02, 0), radius: 0.49, spread: 0.36, eyeSize: 0.13, iris: k.iris });

  // ears
  if (k.ears === 'cat') {
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 6), bodyMat);
      ear.position.set(s * 0.28, 0.42, 0);
      ear.rotation.z = -s * 0.35;
      head.add(ear);
    });
  } else if (k.ears === 'bunny') {
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.55, 4, 8), bodyMat);
      ear.position.set(s * 0.18, 0.72, -0.02);
      ear.rotation.z = -s * 0.15;
      head.add(ear);
    });
  } else if (k.ears === 'round') {
    [-1, 1].forEach(s => {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
      ear.position.set(s * 0.33, 0.36, 0);
      head.add(ear);
    });
  } else if (k.ears === 'tufts') {
    [-1, 1].forEach(s => {
      const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.3, 5), bodyMat);
      tuft.position.set(s * 0.3, 0.45, 0);
      tuft.rotation.z = -s * 0.5;
      head.add(tuft);
    });
  }
  if (k.frogEyes) {
    [-1, 1].forEach(s => {
      const bump = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), bodyMat);
      bump.position.set(s * 0.22, 0.38, 0.1);
      head.add(bump);
    });
  }
  if (k.beak) {
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), lam(0xffa62b));
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, -0.08, 0.5);
    head.add(beak);
  }
  if (k.spikes) {
    for (let i = 0; i < 14; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.26, 4), lam(0x5a4130));
      const a = (i / 14) * Math.PI * 2;
      sp.position.set(Math.cos(a) * 0.32, 0.65 + Math.sin(a) * 0.32, -0.32);
      sp.rotation.set(-0.8, 0, -a + Math.PI / 2);
      g.add(sp);
    }
  }

  // arms / wings, feet
  [-1, 1].forEach(s => {
    const arm = new THREE.Mesh(k.wings ? new THREE.SphereGeometry(0.22, 10, 8) : new THREE.CapsuleGeometry(0.08, 0.22, 4, 8), bodyMat);
    arm.position.set(s * 0.48, 0.65, 0.05);
    if (k.wings) arm.scale.set(0.5, 1.2, 0.9);
    else arm.rotation.z = s * 0.5;
    g.add(arm);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), k.beak ? lam(0xffa62b) : bellyMat);
    foot.position.set(s * 0.2, 0.07, 0.15);
    foot.scale.set(1, 0.6, 1.4);
    g.add(foot);
  });

  // tail
  if (k.tail === 'long') {
    const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.6, 4, 8), bodyMat);
    tail.position.set(0, 0.6, -0.5);
    tail.rotation.x = -0.9;
    g.add(tail);
    g.userData.tail = tail;
  } else if (k.tail === 'bushy') {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), bodyMat);
    tail.scale.set(0.8, 0.8, 1.6);
    tail.position.set(0, 0.55, -0.6);
    g.add(tail);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), bellyMat);
    tip.position.set(0, 0.6, -0.95);
    g.add(tip);
    g.userData.tail = tail;
  } else if (k.tail === 'puff') {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), bellyMat);
    tail.position.set(0, 0.45, -0.5);
    g.add(tail);
  }

  if (accessory === 'apron') {
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 0.5, 14, 1, true, -1, 2), lam(0xff8fb1));
    apron.position.set(0, 0.45, 0.05);
    g.add(apron);
  } else if (accessory === 'scarf') {
    const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 6, 16), lam(0x6c8cff));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.0;
    g.add(scarf);
  } else if (accessory === 'hat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 18), lam(0x5b2a9e));
    brim.position.y = 1.78;
    g.add(brim);
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 14), lam(0x5b2a9e));
    top.position.y = 2.08;
    g.add(top);
  }

  g.scale.setScalar(scale);
  g.userData.head = head;
  g.userData.face = face;
  g.userData.kind = kind;
  return g;
}

// The same critter with its body and head merged into a few meshes (for roaming animals, where
// dozens of them would otherwise cost hundreds of draw calls). The head still turns and blinks.
export function createCritterLite(kind, opts = {}) {
  const c = createCritter(kind, { ...opts, scale: 1 });
  const head = c.userData.head;
  const face = c.userData.face;
  const body = new THREE.Group();
  [...c.children].forEach(ch => { if (ch !== head) body.add(ch); });
  c.add(bakeStaticGroup(body, { receiveShadow: false }));
  const hp = head.position.clone();
  head.position.set(0, 0, 0);
  face.parent.remove(face);
  const parts = new THREE.Group();
  [...head.children].forEach(ch => parts.add(ch));
  head.add(bakeStaticGroup(parts, { receiveShadow: false }));
  head.add(face);
  head.position.copy(hp);
  c.userData.tail = null;
  c.scale.setScalar(opts.scale || 1);
  return c;
}

// Idle animation: bob, look around, wag
export function animateCritter(c, t, seed = 0) {
  c.userData.head.rotation.y = Math.sin(t * 0.7 + seed) * 0.35;
  c.userData.head.rotation.z = Math.sin(t * 1.3 + seed) * 0.06;
  c.position.y = (c.userData.baseY ?? c.position.y) + Math.abs(Math.sin(t * 2 + seed)) * 0.04;
  if (c.userData.tail) c.userData.tail.rotation.y = Math.sin(t * 3 + seed) * 0.4;
}
