// ==========================================
// SPOTS: helpers to find places in the (seeded, identical for everybody) world.
// ==========================================

// Fixed places of the valley that nothing new may be built on (x, z, footprint radius)
export const LANDMARKS = [
  { x: 0, z: 8, r: 6 },        // start
  { x: -14, z: -8, r: 10 },    // village hut
  { x: 22, z: -20, r: 20 },    // temple
  { x: -25, z: 15, r: 12 },    // obby
  { x: 32, z: 30, r: 19 },     // Vortox' arena
  { x: 34, z: 32, r: 26 },     // snow biome
  { x: -4.5, z: 0.5, r: 9 },   // pond
  { x: -2, z: 44, r: 11 },     // south lake
  // slime packs (see spawnMinorSlimes)
  { x: 10, z: -2, r: 8 },
  { x: -32, z: -30, r: 6 },
  { x: 48, z: -42, r: 6 },
  { x: -58, z: 22, r: 6 },
  { x: 18, z: 62, r: 6 },
  { x: -22, z: 58, r: 6 }
];

// The flattest, driest, emptiest patch of ground near `target`.
// (LANDMARKS are always avoided in addition to `avoid`.)
//   radius   size of the area that has to be clear
//   avoid    [{ x, z, r }] places that are already taken
export function findFlatSpot(game, { target = { x: 0, z: 0 }, radius = 12, extent = 78, step = 4, avoid = [], pull = 0.05 } = {}) {
  let best = null;
  for (let x = -extent; x <= extent; x += step) {
    for (let z = -extent; z <= extent; z += step) {
      if (LANDMARKS.some(a => Math.hypot(a.x - x, a.z - z) < a.r + radius * 0.7) || avoid.some(a => Math.hypot(a.x - x, a.z - z) < a.r + radius * 0.5)) continue;
      const points = [[0, 0]];
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        points.push([Math.cos(ang) * radius * 0.5, Math.sin(ang) * radius * 0.5], [Math.cos(ang) * radius, Math.sin(ang) * radius]);
      }
      let minH = Infinity;
      let maxH = -Infinity;
      let score = Math.hypot(x - target.x, z - target.z) * pull;
      for (const [dx, dz] of points) {
        const px = x + dx;
        const pz = z + dz;
        const h = game.getTerrainHeight(px, pz);
        minH = Math.min(minH, h);
        maxH = Math.max(maxH, h);
        if (game.getWaterSurface(px, pz) !== null) score += 60;
        if (game.checkWallCollision(px, pz, 1.2, h)) score += 5;
      }
      score += (maxH - minH) * 4;
      game.treeCanopies.forEach(t => {
        if (Math.hypot(t.x - x, t.z - z) < t.radius + radius) score += 4;
      });
      if (!best || score < best.score) best = { x, z, score };
    }
  }
  return best || { x: target.x, z: target.z, score: 999 };
}

// n well-spread random dry points (rng is a seeded generator, so all players get the same points)
export function scatterSpots(game, rng, n, { minGap = 18, minR = 14, maxR = 88, avoid = [], clearance = 1.6 } = {}) {
  const out = [];
  let guard = 0;
  while (out.length < n && guard++ < 4000) {
    const ang = rng() * Math.PI * 2;
    const r = minR + rng() * (maxR - minR);
    const x = Math.cos(ang) * r;
    const z = Math.sin(ang) * r;
    if (Math.abs(x) > 90 || Math.abs(z) > 90) continue;
    const h = game.getTerrainHeight(x, z);
    if (game.isNearWater(x, z, 2.5) || game.getWaterSurface(x, z) !== null) continue;
    if (game.getTerrainSlope(x, z) > 0.2) continue;
    if (game.checkWallCollision(x, z, clearance, h)) continue;
    if (LANDMARKS.some(a => Math.hypot(a.x - x, a.z - z) < a.r + 2) || avoid.some(a => Math.hypot(a.x - x, a.z - z) < a.r)) continue;
    if (out.some(o => Math.hypot(o.x - x, o.z - z) < minGap)) continue;
    out.push({ x, z });
  }
  return out;
}
