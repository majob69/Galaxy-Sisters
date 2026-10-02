// Puzzle helpers from the bag (bought at the magic stall or found in chests).
// Returns true when the item was used up.
import * as THREE from 'three';
import { sfx } from './shared.js';

export const toolMethods = {
  useTool(id) {
    const pp = this.playerGroup.position;
    if (id === 'weight') {
      // Sternen-Gewicht: keeps a plate of the star gate pressed for good
      const sg = this.stargate;
      const plate = sg.plates.find(p => Math.hypot(p.x - pp.x, p.z - pp.z) < 3.2);
      if (!plate) { this.showToast('⚖️ Stell dich neben eine Platte des Sternen-Tors und benutze das Gewicht dort.', 3500); return false; }
      if (plate.weighted) { this.showToast('Auf dieser Platte liegt schon ein Gewicht.', 2500); return false; }
      plate.weighted = true;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.8, 1.0), new THREE.MeshLambertMaterial({ color: 0x8a8fa8, emissive: 0x2a2f55, emissiveIntensity: 0.5, flatShading: true }));
      crate.position.set(plate.x, plate.y + 0.5, plate.z);
      crate.castShadow = true;
      this.scene.add(crate);
      sfx.hit();
      this.showToast('⚖️ Das Gewicht drückt die Platte – jetzt die andere!', 3500);
      return true;
    }
    if (id === 'candle') {
      // Elementkerze: lights the nearest unlit altar of the element shrine
      const sh = this.shrine;
      if (sh.solved || Math.hypot(sh.center.x - pp.x, sh.center.z - pp.z) > 14) { this.showToast('🕯️ Die Kerze wirkt nur am Elemente-Schrein.', 3000); return false; }
      let best = -1;
      let bd = Infinity;
      sh.altars.forEach((a, i) => {
        const d = Math.hypot(a.x - pp.x, a.z - pp.z);
        if (a.lit < 1 && d < bd) { bd = d; best = i; }
      });
      if (best < 0) { this.showToast('Alle Altäre brennen schon!', 2500); return false; }
      sh.light_(best);
      this.showToast(`🕯️ Der Altar von ${sh.altars[best].def.name} brennt!`, 3000);
      return true;
    }
    if (id === 'lantern') {
      this.frostWard = 90;
      this.showToast('🏮 Die Frostlaterne wärmt dich 90 Sekunden – Glaciels Frost macht dich nicht langsamer.', 4000);
      sfx.heal();
      return true;
    }
    return false;
  }
};
