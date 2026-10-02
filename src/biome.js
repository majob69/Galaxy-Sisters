// ==========================================
// BIOMES: the snow biome around Vortox' arena (north-east of the valley).
// snowAt(x, z) gives 0 (meadow) .. 1 (deep snow) with a soft, noisy border.
// ==========================================
import { simplex2, smoothstep } from './landscape.js';

export const SNOW_BIOME = { x: 34, z: 32, r: 30 };

export function snowAt(x, z) {
  const d = Math.hypot(x - SNOW_BIOME.x, z - SNOW_BIOME.z);
  const edge = simplex2(x * 0.08 + 3.1, z * 0.08 - 1.7) * 3.5;
  return 1 - smoothstep(SNOW_BIOME.r - 7, SNOW_BIOME.r, d + edge);
}
