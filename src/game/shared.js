// Shared game constants: audio engine, sister definitions, seeded world RNG
import { AudioEngine, DAY_SONGS } from '../audio.js';

// Deterministic PRNG: the world (trees, flowers, stones ...) looks the same on every visit
export const WORLD_SEED = 20260929;
export function mulberry32(seed) {
  return function () {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const sfx = new AudioEngine();
try {
  const saved = localStorage.getItem('gs-song');
  if (DAY_SONGS.some(s => s.key === saved)) sfx.daySong = saved;
} catch (e) { /* storage unavailable */ }
export { DAY_SONGS };

export const SISTERS = [
  {
    name: "Luna",
    title: "Mond-Wächterin (Sanfte Schwerkraft & Heilung)",
    icon: "🌙",
    themeColor: 0xb8c0ff,
    accentColor: "#b8c0ff",
    speed: 0.18,
    jumpPower: 0.17,
    gravity: 0.010,
    hairColor: 0xe0e7ff,
    dressColor: 0x725ac1,
    ability1: {
      name: "Mondschild",
      icon: "🛡️",
      cooldown: 4.0
    },
    ability2: {
      name: "Heilung",
      icon: "💚",
      cooldown: 5.0
    }
  },
  {
    name: "Stella",
    title: "Sternen-Sprinterin (Lichtblitz & Sternenbogen)",
    icon: "⭐",
    themeColor: 0xffe066,
    accentColor: "#ffe066",
    speed: 0.23,
    jumpPower: 0.17,
    gravity: 0.012,
    hairColor: 0xffd166,
    dressColor: 0xffb703,
    ability1: {
      name: "Sternen-Bogen",
      icon: "🏹",
      cooldown: 1.5
    },
    ability2: {
      name: "Sternen-Dash",
      icon: "⚡",
      cooldown: 2.5
    }
  },
  {
    name: "Sol",
    title: "Sonnen-Kämpferin (Supernova & Versteinerung)",
    icon: "☀️",
    themeColor: 0xff7b00,
    accentColor: "#ff7b00",
    speed: 0.19,
    jumpPower: 0.17,
    gravity: 0.012,
    hairColor: 0xffa200,
    dressColor: 0xd90429,
    ability1: {
      name: "Supernova",
      icon: "💥",
      cooldown: 3.0
    },
    ability2: {
      name: "Versteinern",
      icon: "🪨",
      cooldown: 5.5
    }
  },
  {
    name: "Planeta",
    title: "Planeten-Mystikerin (Gravitations-Ringe & Unsichtbarkeit)",
    icon: "🪐",
    themeColor: 0x9d4edd,
    accentColor: "#9d4edd",
    speed: 0.18,
    jumpPower: 0.17,
    gravity: 0.012,
    hairColor: 0x5a189a,
    dressColor: 0x3c096c,
    ability1: {
      name: "Planeten-Ringe",
      icon: "🪐",
      cooldown: 3.0
    },
    ability2: {
      name: "Unsichtbar",
      icon: "👻",
      cooldown: 5.0
    }
  }
];
