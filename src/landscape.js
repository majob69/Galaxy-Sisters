// ==========================================
// LANDSCAPE MODEL (pure math, no THREE dependency)
// Noise-based mountain ranges, carved river bed with waterfall, lakes and
// a precomputed heightfield that matches the rendered terrain mesh exactly.
// ==========================================

// ---------- Deterministic 2D Simplex Noise ----------
// Gradient set: (±1, ±1), (±1, 0), (0, ±1)
function grad(h, x, y) {
  switch (h & 7) {
    case 0: return x + y;
    case 1: return -x + y;
    case 2: return x - y;
    case 3: return -x - y;
    case 4: return x;
    case 5: return -x;
    case 6: return y;
    default: return -y;
  }
}
const PERM = new Uint8Array(512);
(() => {
  let seed = 1337;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const p = [];
  for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) PERM[i] = p[i & 255];
})();

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;

export function simplex2(xin, yin) {
  const s = (xin + yin) * F2;
  const i = Math.floor(xin + s);
  const j = Math.floor(yin + s);
  const t = (i + j) * G2;
  const x0 = xin - (i - t);
  const y0 = yin - (j - t);
  const i1 = x0 > y0 ? 1 : 0;
  const j1 = 1 - i1;
  const x1 = x0 - i1 + G2;
  const y1 = y0 - j1 + G2;
  const x2 = x0 - 1 + 2 * G2;
  const y2 = y0 - 1 + 2 * G2;
  const ii = i & 255;
  const jj = j & 255;

  let n = 0;
  let t0 = 0.5 - x0 * x0 - y0 * y0;
  if (t0 > 0) {
    t0 *= t0;
    n += t0 * t0 * grad(PERM[ii + PERM[jj]], x0, y0);
  }
  let t1 = 0.5 - x1 * x1 - y1 * y1;
  if (t1 > 0) {
    t1 *= t1;
    n += t1 * t1 * grad(PERM[ii + i1 + PERM[jj + j1]], x1, y1);
  }
  let t2 = 0.5 - x2 * x2 - y2 * y2;
  if (t2 > 0) {
    t2 *= t2;
    n += t2 * t2 * grad(PERM[ii + 1 + PERM[jj + 1]], x2, y2);
  }
  return 70 * n; // approx. [-1, 1]
}

export function fbm(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let o = 0; o < octaves; o++) {
    sum += simplex2(x * freq, y * freq) * amp;
    freq *= 2.03;
    amp *= 0.5;
  }
  return sum; // approx. [-1, 1]
}

// Sharp mountain ridges (0..1)
export function ridged(x, y, octaves = 4) {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let weight = 1;
  for (let o = 0; o < octaves; o++) {
    let n = 1 - Math.abs(simplex2(x * freq, y * freq));
    n *= n;
    n *= weight;
    weight = Math.min(1, n * 1.6);
    sum += n * amp;
    freq *= 2.1;
    amp *= 0.48;
  }
  return Math.min(1, sum);
}

export const smoothstep = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------- Water Layout ----------
// Lowland water table shared by river, pond, plunge pool and the southern lake.
export const WATER_LEVEL = -0.3;
export const SPRING_LEVEL = 9.5;

// Lakes: x, z, radius, water level, depth, wall slope
export const LAKES = [
  { id: 'spring', x: 1.5, z: -68, r: 4.2, level: SPRING_LEVEL, depth: 1.5, k: 1.2, upper: true },
  { id: 'plunge', x: 1, z: -50, r: 4.8, level: WATER_LEVEL, depth: 2.6, k: 6.0 },
  { id: 'pond', x: -4.5, z: 0.5, r: 6.0, level: WATER_LEVEL, depth: 2.1, k: 0.9 },
  { id: 'southlake', x: -2, z: 44, r: 8.5, level: WATER_LEVEL, depth: 2.6, k: 0.9 }
];

// River control points: x, z, halfWidth, depth, wall slope
const UPPER_STREAM = [
  [1.5, -68, 1.9, 1.0, 1.2],
  [2.4, -62, 2.0, 1.0, 1.2],
  [1, -56.9, 2.2, 0.9, 1.2]
];
const LOWER_RIVER = [
  [1, -50, 3.0, 2.3, 6.0],
  [0.6, -44.5, 3.1, 2.1, 3.2],
  [-1.5, -37, 3.3, 2.0, 1.2],
  [-1.8, -30, 3.4, 2.0, 0.9],
  [1, -24, 3.4, 2.0, 0.85],
  [0.4, -16, 3.4, 2.0, 0.85],
  [-2.6, -8.5, 3.4, 2.0, 0.85],
  [-4.5, 0.5, 3.4, 2.0, 0.85],
  [-9.6, 4.8, 3.3, 2.0, 0.85],
  [-12.2, 10.8, 3.3, 2.0, 0.85],
  [-13.2, 19, 3.4, 2.0, 0.85],
  [-10.5, 28.5, 3.5, 2.0, 0.85],
  [-5.5, 37, 3.6, 2.0, 0.85],
  [-2, 44, 3.6, 2.0, 0.85]
];

// The upper stream plunges over the cliff here (the lip z is found by scanning the terrain)
export const WATERFALL = { x: 1 };

function chaikin(points, iterations) {
  let pts = points;
  for (let it = 0; it < iterations; it++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      out.push(a.map((v, k) => v * 0.75 + b[k] * 0.25));
      out.push(a.map((v, k) => v * 0.25 + b[k] * 0.75));
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function buildRiver(points, level, upper) {
  const pts = chaikin(points, 3);
  const segs = [];
  let s = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az, aw, ad, ak] = pts[i];
    const [bx, bz, bw, bd, bk] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    segs.push({
      ax, az, bx, bz, dx, dz, len, len2: len * len, s0: s,
      aw, bw, ad, bd, ak, bk, level, upper,
      wMax: Math.max(aw, bw), kMin: Math.min(ak, bk), bankH: level + 0.35,
      minX: Math.min(ax, bx), maxX: Math.max(ax, bx),
      minZ: Math.min(az, bz), maxZ: Math.max(az, bz)
    });
    s += len;
  }
  return {
    segs, length: s, points: pts, level, upper, lastHit: 0,
    bankH: level + 0.35,
    wMax: Math.max(...segs.map(g => g.wMax)),
    kMin: Math.min(...segs.map(g => g.kMin)),
    minX: Math.min(...segs.map(g => g.minX)), maxX: Math.max(...segs.map(g => g.maxX)),
    minZ: Math.min(...segs.map(g => g.minZ)), maxZ: Math.max(...segs.map(g => g.maxZ))
  };
}

export const RIVERS = [
  buildRiver(UPPER_STREAM, SPRING_LEVEL, true),
  buildRiver(LOWER_RIVER, WATER_LEVEL, false)
];

// ---------- Terrain Height Functions ----------

// 0 inside architectural/interactive zones, 1 in open landscape
export function flatMask(x, z) {
  const sx = x;
  const sz = z - 8;
  const spawnMask = smoothstep(4.5, 9.5, Math.sqrt(sx * sx + sz * sz));

  const dxTemple = Math.max(0, Math.abs(x - 22) - 11.5);
  const dzTemple = Math.max(0, Math.abs(z - (-18)) - 17.5);
  const templeMask = smoothstep(0, 5.5, Math.sqrt(dxTemple * dxTemple + dzTemple * dzTemple));

  const dxHut = Math.max(0, Math.abs(x - (-14)) - 4.5);
  const dzHut = Math.max(0, Math.abs(z - (-8)) - 4.5);
  const hutMask = smoothstep(0, 5.0, Math.sqrt(dxHut * dxHut + dzHut * dzHut));

  const bx = x - 32;
  const bz = z - 30;
  const bossMask = smoothstep(19.8, 25.5, Math.sqrt(bx * bx + bz * bz));

  const dxObby = Math.max(0, Math.abs(x - (-25)) - 4.5);
  const dzObby = Math.max(0, Math.abs(z - 1.5) - 16.5);
  const obbyMask = smoothstep(0, 5.0, Math.sqrt(dxObby * dxObby + dzObby * dzObby));

  return Math.min(spawnMask, templeMask, hutMask, bossMask, obbyMask);
}

// Meadow hills + mountain ranges (without water carving)
export function baseHeight(x, z) {
  const dist = Math.sqrt(x * x + z * z);

  // Flat masks for architectural and interactive zones
  const flatFactor = flatMask(x, z);
  if (flatFactor <= 0) return 0;

  // Rolling organic meadow hills
  let hill = Math.sin(x * 0.075) * Math.cos(z * 0.075) * 0.85 + Math.sin(x * 0.032 + z * 0.038) * 0.45;
  hill += fbm(x * 0.05 + 11.3, z * 0.05 - 4.1, 2) * 0.45;

  // Mountain ranges: rim distance varies with direction, pulled closer in the north
  const inv = dist > 0.001 ? 1 / dist : 0;
  const ca = x * inv;
  const sa = z * inv;
  let rim = 50 + simplex2(ca * 1.4 + 3.1, sa * 1.4 - 7.7) * 5;
  rim -= 4 * Math.exp(-8 * (1 + sa)); // 1 + sin(angle) ~ half squared angle to north

  const t = smoothstep(rim, rim + 38, dist);
  const falloff = 1 - smoothstep(104, 122, dist); // mountains sink into the cloud sea
  const dzRidge = z + 53.5;
  const nearRidge = Math.abs(dzRidge) < 24 && Math.abs(x) < 46;
  let mountains = 0;
  if (falloff <= 0) {
    mountains = -22;
  } else if (t > 0 || nearRidge) {
    const ridge = ridged(x * 0.019 + 5.2, z * 0.019 - 1.7, 4);
    const detail = fbm(x * 0.07, z * 0.07, 2);
    mountains = (Math.pow(t, 1.7) * (9 + ridge * 34 + detail * 4) + t * 4) * falloff;
    mountains -= (1 - falloff) * 22;

    // Northern ridge forming the waterfall cliff
    if (nearRidge) {
      const crest = 13 + ridged(x * 0.07 + 1.3, z * 0.05 - 0.4, 3) * 7 + detail * 1.5;
      const ridgeN = crest * Math.exp(-(dzRidge * dzRidge) / (2 * 6.5 * 6.5)) * (1 - smoothstep(24, 46, Math.abs(x)));
      mountains = Math.max(mountains, ridgeN + t * 3);
    }
  }

  return (hill + mountains) * flatFactor;
}

// Nearest water edge found by the last carve() call (signed distance, water level)
export const carveInfo = { dist: Infinity, level: 0 };

// Water carving (river channels, gorge walls, lake basins and dry banks)
export function carve(x, z, B) {
  // Nearest channel sample of every river (level is constant per river, so the
  // nearest segment defines the carved profile)
  let L = -Infinity;
  let riverCh0 = Infinity;
  let riverCh1 = Infinity;
  carveInfo.dist = Infinity;
  carveInfo.level = 0;
  for (let r = 0; r < RIVERS.length; r++) {
    const river = RIVERS[r];
    const bx = x < river.minX ? river.minX - x : (x > river.maxX ? x - river.maxX : 0);
    const bz = z < river.minZ ? river.minZ - z : (z > river.maxZ ? z - river.maxZ : 0);
    const reach = river.wMax + Math.max(LIFT_REACH, (B - river.bankH) / river.kMin);
    if (bx * bx + bz * bz > reach * reach) continue;
    const q = nearestOnRiver(river, x, z);
    if (!q) continue;
    const sg = q.seg;
    const u = q.u;
    const e = q.d - q.w;
    if (e < carveInfo.dist) {
      carveInfo.dist = e;
      carveInfo.level = sg.level;
    }
    if (e < LIFT_REACH) {
      const lift = sg.bankH - Math.max(0, e) * LIFT_SLOPE;
      if (lift > L) L = lift;
    }
    const depth = sg.ad + (sg.bd - sg.ad) * u;
    const k = sg.ak + (sg.bk - sg.ak) * u;
    const bed = sg.level - depth;
    const ch = q.d < q.w
      ? bed + (sg.bankH - bed) * smoothstep(0.15, 1.0, q.d / q.w)
      : sg.bankH + e * k;
    if (r === 0) riverCh0 = ch; else riverCh1 = ch;
  }

  let C = Math.min(riverCh0, riverCh1);
  for (let i = 0; i < LAKES.length; i++) {
    const lk = LAKES[i];
    const bankH = lk.level + 0.35;
    const dx = x - lk.x;
    const dz = z - lk.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    const e = d - lk.r;
    if (e < carveInfo.dist) {
      carveInfo.dist = e;
      carveInfo.level = lk.level;
    }
    if (e < LIFT_REACH) {
      const lift = bankH - Math.max(0, e) * LIFT_SLOPE;
      if (lift > L) L = lift;
    }
    const bed = lk.level - lk.depth;
    const ch = d < lk.r
      ? bed + (bankH - bed) * smoothstep(0.3, 1.0, d / lk.r)
      : bankH + e * lk.k;
    if (ch < C) C = ch;
  }
  return Math.min(Math.max(B, L), C);
}

// Nearest point on a river polyline (bbox-pruned, starts from the last hit for coherence)
const _near = { seg: null, u: 0, d: 0, w: 0 };
function nearestOnRiver(river, x, z) {
  const segs = river.segs;
  let bestD2 = Infinity;
  let bestSeg = null;
  let bestU = 0;
  const start = river.lastHit || 0;
  for (let n = 0; n < segs.length; n++) {
    const i = (start + n) % segs.length;
    const sg = segs[i];
    const bx = x < sg.minX ? sg.minX - x : (x > sg.maxX ? x - sg.maxX : 0);
    const bz = z < sg.minZ ? sg.minZ - z : (z > sg.maxZ ? z - sg.maxZ : 0);
    if (bx * bx + bz * bz >= bestD2) continue;
    let u = ((x - sg.ax) * sg.dx + (z - sg.az) * sg.dz) / sg.len2;
    u = u < 0 ? 0 : (u > 1 ? 1 : u);
    const ex = x - (sg.ax + sg.dx * u);
    const ez = z - (sg.az + sg.dz * u);
    const d2 = ex * ex + ez * ez;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestSeg = sg;
      bestU = u;
      river.lastHit = i;
    }
  }
  if (!bestSeg) return null;
  _near.seg = bestSeg;
  _near.u = bestU;
  _near.d = Math.sqrt(bestD2);
  _near.w = bestSeg.aw + (bestSeg.bw - bestSeg.aw) * bestU;
  return _near;
}

const LIFT_SLOPE = 0.3;
const LIFT_REACH = 8;
export function analyticHeight(x, z) {
  return carve(x, z, baseHeight(x, z));
}

// Signed distance to the nearest water edge (negative = inside water) plus water info
// upperFilter: undefined = all water, true = spring system only, false = lowland only
export function waterQuery(x, z, upperFilter) {
  let best = { dist: Infinity, level: null, upper: false, dirX: 0, dirZ: 0, s: 0, width: 0, isLake: false };
  for (let r = 0; r < RIVERS.length; r++) {
    if (upperFilter !== undefined && RIVERS[r].upper !== upperFilter) continue;
    const q = nearestOnRiver(RIVERS[r], x, z);
    if (!q) continue;
    const sd = q.d - q.w;
    if (sd < best.dist) {
      const sg = q.seg;
      best = {
        dist: sd, level: sg.level, upper: sg.upper,
        dirX: sg.dx / sg.len, dirZ: sg.dz / sg.len,
        s: sg.s0 + sg.len * q.u, width: q.w, isLake: false
      };
    }
  }
  for (let i = 0; i < LAKES.length; i++) {
    const lk = LAKES[i];
    if (upperFilter !== undefined && !!lk.upper !== upperFilter) continue;
    const sd = Math.hypot(x - lk.x, z - lk.z) - lk.r;
    // Inside a basin the lake wins (calm water)
    if (sd < best.dist || sd < 0) {
      best = { dist: sd, level: lk.level, upper: !!lk.upper, dirX: 0, dirZ: 0, s: 0, width: lk.r, isLake: true, lake: lk };
    }
  }
  return best;
}

// ---------- Heightfield ----------
export class Heightfield {
  constructor(size, segments) {
    this.size = size;
    this.half = size / 2;
    this.segments = segments;
    this.cell = size / segments;
    this.n = segments + 1;
    this.heights = new Float32Array(this.n * this.n);
    // Signed distance to the nearest shore & its water level (used for sandy banks)
    this.waterDist = new Float32Array(this.n * this.n);
    this.waterLevel = new Float32Array(this.n * this.n);
    for (let iz = 0; iz < this.n; iz++) {
      const z = -this.half + iz * this.cell;
      for (let ix = 0; ix < this.n; ix++) {
        const x = -this.half + ix * this.cell;
        const i = iz * this.n + ix;
        this.heights[i] = analyticHeight(x, z);
        this.waterDist[i] = carveInfo.dist;
        this.waterLevel[i] = carveInfo.level;
      }
    }
  }

  // Exact interpolation on the same triangulation used by the terrain mesh:
  // each cell is split along the diagonal (ix,iz+1)-(ix+1,iz).
  height(x, z) {
    const fx = (x + this.half) / this.cell;
    const fz = (z + this.half) / this.cell;
    let ix = Math.floor(fx);
    let iz = Math.floor(fz);
    ix = Math.max(0, Math.min(this.segments - 1, ix));
    iz = Math.max(0, Math.min(this.segments - 1, iz));
    const tx = Math.max(0, Math.min(1, fx - ix));
    const tz = Math.max(0, Math.min(1, fz - iz));
    const n = this.n;
    const h00 = this.heights[iz * n + ix];
    const h10 = this.heights[iz * n + ix + 1];
    const h01 = this.heights[(iz + 1) * n + ix];
    const h11 = this.heights[(iz + 1) * n + ix + 1];
    if (tx + tz <= 1) {
      return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    }
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }
}
