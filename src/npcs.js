// ==========================================
// TALKING CREATURES: friendly animals all over the valley. Walk up and press F (or tap the
// action button) to chat - they share tips for the puzzles, the bosses, fishing and building.
// ==========================================
import * as THREE from 'three';
import { sfx } from './game/shared.js';
import { createCritter, animateCritter } from './critters.js';
import { blinkFace } from './characters.js';
import { SNOW_BIOME } from './biome.js';
import { LILLI_SPOT } from './forest.js';

const RANGE = 3.2;

// where(game) returns the place the creature lives next to; lines are shown one after the other
const NPCS = [
  {
    id: 'mimi', name: 'Mimi', kind: 'cat', accessory: 'scarf', where: () => ({ x: -10, z: -2 }),
    lines: [
      'Hallo, Schwester! Ich bin Mimi. Willkommen im Himmelsgebirge! 🐱',
      'Für jede gelöste Aufgabe bekommst du Sterntaler 🪙. Auf dem Markt kannst du damit Essen und Material kaufen.',
      'Mit I öffnest du deine Tasche. Essen heilt dich – Äpfel wachsen an manchen Bäumen nach.',
      'Am Abend kannst du in den Häusern im Bett schlafen. Dann ist die Nacht vorbei und du bist wieder fit.'
    ]
  },
  {
    id: 'fips', name: 'Fips', kind: 'fox', accessory: 'scarf', where: () => ({ x: SNOW_BIOME.x - 24, z: SNOW_BIOME.z + 8 }),
    lines: [
      'Brrr, ist das kalt hier im Schnee! Ich bin Fips. 🦊',
      'In der Eis-Arena wohnt Vortox. Wer hineingeht, kommt erst wieder heraus, wenn er besiegt ist!',
      'Wenn Vortox sich lange gedreht hat, wird ihm schwindelig – dann ist der beste Moment zum Zuschlagen.',
      'Lunas Mondschild blockt seinen Wirbel. Und wer KO geht, wacht am Startpunkt auf.'
    ]
  },
  {
    id: 'quaki', name: 'Quaki', kind: 'frog', where: () => ({ x: -9, z: 6 }),
    lines: [
      'Quak! Ich bin Quaki und kenne jeden Fisch im Teich. 🐸',
      'Stell dich ans Ufer, schau aufs Wasser und drück F. Wenn der Schwimmer taucht – schnell nochmal F!',
      'Mondfisch und Sternenaal beißen nur nachts. Die Regenbogenforelle kommt nur bei Regen.',
      'Je größer der Fisch, desto mehr heilt er dich, wenn du ihn isst.'
    ]
  },
  {
    id: 'stachel', name: 'Stachel', kind: 'hedgehog', where: (g) => ({ x: g.stargate.center.x - 9, z: g.stargate.center.z - 2 }),
    lines: [
      'Psst! Ich bin Stachel. Siehst du das Sternen-Tor? 🦔',
      'Beide Platten müssen gleichzeitig gedrückt sein. Zu zweit ist das leicht!',
      'Allein geht es auch: Stell dich auf eine Platte und schieß mit Stella einen Pfeil auf die andere.',
      'Oder kauf beim Zauberkram ein Sternen-Gewicht – das legst du einfach auf eine Platte.'
    ]
  },
  {
    id: 'eulalia', name: 'Eulalia', kind: 'owl', accessory: 'hat', where: (g) => ({ x: g.shrine.center.x + 10, z: g.shrine.center.z }),
    lines: [
      'Huhu! Ich bin Eulalia, die Hüterin des Elemente-Schreins. 🦉',
      'Jeder Altar gehört zu einer Schwester: Luna und Sol zaubern daneben, Stella trifft ihn mit einem Pfeil, Planeta mit einem Ring oder ihrer Tarnung.',
      'Ein Altar brennt 15 Sekunden. Alle vier müssen gleichzeitig leuchten!',
      'Allein wechselst du mit 1–4 die Schwester. Eine Elementkerze vom Markt zündet einen Altar für dich an.'
    ]
  },
  {
    id: 'lilli', name: 'Lilli', kind: 'bunny', where: () => LILLI_SPOT,
    lines: [
      'Ich bin Lilli … da drüben auf der Runen-Lichtung schläft Morvanta in ihrem Kokon. 🐰',
      'Sobald du die Lichtung betrittst, erwacht sie. Weicht ihren leuchtenden Staubkreisen aus!',
      'Packt sie eine von euch, strampelt mit der Sprungtaste – und Freunde schlagen auf sie ein.',
      'Danach ist sie benommen und nimmt doppelten Schaden.'
    ]
  },
  {
    id: 'pingu', name: 'Pingu', kind: 'penguin', where: (g) => ({ x: g.glaciel.center.x - 18, z: g.glaciel.center.z }),
    lines: [
      'Hallo! Pingu hier. Ich mag Kälte – aber Glaciel ist mir zu frostig! 🐧',
      'Er erwacht, sobald Vortox besiegt ist. Sein Eispanzer schluckt fast jeden Schaden. Zerschlagt zuerst die drei leuchtenden Kristalle!',
      'Dann liegt sein Kern frei – jetzt zählt jeder Treffer anderthalbfach.',
      'Über seine Schockwelle kannst du springen. Eine Frostlaterne schützt dich vor dem Einfrieren.'
    ]
  },
  {
    id: 'ole', name: 'Ole', kind: 'bear', where: (g) => ({ x: g.houses.plot.x + 6, z: g.houses.plot.z + 2 }),
    lines: [
      'Moin! Ich bin Ole, Baumeister. 🐻',
      'Auf dem Bauplatz kannst du dir ein eigenes Haus bauen!',
      'Du brauchst 12 Holz, 8 Stein, 3 Glas, 2 Seil und 2 Stoff. Das gibt es am Bau-Stand, in Truhen – oder von Freunden geschenkt.',
      'In deinem Haus steht eine Vorratstruhe für alles, was nicht in die Tasche muss.',
      'An der Haustür kannst du ein Obergeschoss ausbauen: 60 Sterntaler, dann Material – und 5 Minuten Geduld!',
      'Auf dem Bauland ist Platz für noch mehr: Brunnen, Laube, Turm, Beet, Werkstatt und Gästehaus.',
      'Möbel baust du an der Werkbank im Inventar – zum Beispiel einen Stuhl aus 2 Holz und 1 Seil.'
    ]
  }
];

export class Npcs {
  constructor(game) {
    this.game = game;
    this.list = [];
    NPCS.forEach((def, i) => {
      const spot = this.findSpot(def.where(game));
      const c = createCritter(def.kind, { scale: 1.15, accessory: def.accessory || null });
      const y = game.getTerrainHeight(spot.x, spot.z);
      c.position.set(spot.x, y, spot.z);
      c.userData.baseY = y;
      game.scene.add(c);
      game.colliders.push({ type: 'cylinder', x: spot.x, z: spot.z, radius: 0.55, minY: y - 1, maxY: y + 1.8 });
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTex(), transparent: true, depthWrite: false }));
      bubble.scale.setScalar(0.7);
      bubble.position.set(spot.x, y + 2.7, spot.z);
      game.scene.add(bubble);
      this.list.push({ def, mesh: c, x: spot.x, z: spot.z, line: 0, seed: i * 1.7, bubble });
    });
    this.buildDialog();
  }

  // Nearby dry ground that is not inside a wall
  findSpot(want) {
    const g = this.game;
    for (let r = 0; r < 12; r += 1.5) {
      for (let a = 0; a < 8; a++) {
        const x = want.x + Math.cos(a * 0.785) * r;
        const z = want.z + Math.sin(a * 0.785) * r;
        if (g.getWaterSurface(x, z) !== null || g.isNearWater(x, z, 1)) continue;
        if (g.checkWallCollision(x, z, 1.0, g.getTerrainHeight(x, z))) continue;
        return { x, z };
      }
    }
    return want;
  }

  getInteraction() {
    const pp = this.game.playerGroup.position;
    let best = null;
    let bd = RANGE;
    this.list.forEach(n => {
      const d = Math.hypot(pp.x - n.x, pp.z - n.z);
      if (d < bd) { bd = d; best = n; }
    });
    if (!best) return null;
    const talking = this.talking === best;
    return { dist: bd, label: talking ? `💬 Weiter (${best.def.name})` : `💬 Mit ${best.def.name} sprechen`, action: () => this.talk(best) };
  }

  talk(n) {
    if (this.talking !== n) {
      this.talking = n;
      n.line = 0;
    } else {
      n.line = (n.line + 1) % n.def.lines.length;
      if (n.line === 0) { this.close(); return; }
    }
    n.met = true;
    sfx.playTone(660 + n.line * 40, 'sine', 0.08, 0.05);
    this.dialogName.textContent = `${n.def.name}`;
    this.dialogText.textContent = n.def.lines[n.line];
    this.dialogMore.textContent = n.line < n.def.lines.length - 1 ? 'F / antippen: weiter' : 'F / antippen: tschüss';
    this.dialog.classList.add('open');
  }

  close() {
    this.talking = null;
    this.dialog.classList.remove('open');
  }

  buildDialog() {
    const d = document.createElement('div');
    d.id = 'npc-dialog';
    d.className = 'npc-dialog clickable';
    this.dialogName = document.createElement('div');
    this.dialogName.className = 'npc-name';
    this.dialogText = document.createElement('div');
    this.dialogText.className = 'npc-text';
    this.dialogMore = document.createElement('div');
    this.dialogMore.className = 'npc-more';
    d.append(this.dialogName, this.dialogText, this.dialogMore);
    d.addEventListener('click', () => { if (this.talking) this.talk(this.talking); });
    document.body.appendChild(d);
    this.dialog = d;
  }

  update() {
    const g = this.game;
    const t = g.clock.elapsedTime;
    const pp = g.playerGroup.position;
    this.list.forEach(n => {
      const d = Math.hypot(pp.x - n.x, pp.z - n.z);
      // far away creatures are not drawn (each one is ~25 small meshes)
      n.mesh.visible = d < 60;
      if (!n.mesh.visible) { n.bubble.visible = false; return; }
      animateCritter(n.mesh, t, n.seed);
      blinkFace(n.mesh.userData.face, t);
      // turn towards a sister who comes close
      if (d < 8) {
        const want = Math.atan2(pp.x - n.x, pp.z - n.z);
        n.mesh.rotation.y += Math.atan2(Math.sin(want - n.mesh.rotation.y), Math.cos(want - n.mesh.rotation.y)) * 0.08;
      }
      // the speech-bubble icon shows who has something to say (until you talked to them)
      n.bubble.visible = !n.met && d < 30;
      n.bubble.position.y = n.mesh.userData.baseY + 2.7 + Math.sin(t * 2 + n.seed) * 0.1;
    });
    if (this.talking && Math.hypot(pp.x - this.talking.x, pp.z - this.talking.z) > RANGE + 2) this.close();
  }
}

function bubbleTex() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = '48px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('💬', 32, 36);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
