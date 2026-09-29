// ==========================================
// PERFORMANCE GOVERNOR: measures the real frame rate while playing and steps the
// graphics down one tier when the device cannot keep up (auto mode only).
// ==========================================

export const PERF_TIERS = [
  { name: 'Hoch', bloom: true, cap: 1.5, scale: 1, shadow: 2048 },
  { name: 'Niedrig', bloom: false, cap: 1.0, scale: 1, shadow: 2048 },
  { name: 'Sparsam', bloom: false, cap: 1.0, scale: 0.8, shadow: 1024 },
  { name: 'Minimal', bloom: false, cap: 1.0, scale: 0.65, shadow: 1024 }
];

export class PerformanceGovernor {
  // onStep(tier, fps) is called when the governor wants the next lower tier
  constructor(getTier, onStep, { targetFps = 34, windowSec = 2.5, badWindows = 2, warmupSec = 2 } = {}) {
    this.getTier = getTier;
    this.onStep = onStep;
    this.targetFps = targetFps;
    this.windowSec = windowSec;
    this.badWindows = badWindows;
    this.warmupSec = warmupSec;
    this.enabled = false;
    this.armed = false;
    this.fps = 0;
    this.restart();
  }

  restart() {
    this.warmup = this.warmupSec;
    this.time = 0;
    this.frames = 0;
    this.bad = 0;
  }

  // Start measuring (called when the adventure starts or the mode is changed)
  arm() {
    this.armed = true;
    this.restart();
  }

  // rawDt: seconds since the last frame, not clamped
  update(rawDt) {
    if (!this.enabled || !this.armed) return;
    // A hidden tab or a long stall says nothing about the GPU
    if (rawDt > 0.25 || document.hidden) {
      this.restart();
      return;
    }
    if (this.warmup > 0) {
      this.warmup -= rawDt;
      return;
    }
    this.time += rawDt;
    this.frames++;
    if (this.time < this.windowSec) return;

    this.fps = this.frames / this.time;
    this.bad = this.fps < this.targetFps ? this.bad + 1 : 0;
    this.time = 0;
    this.frames = 0;
    if (this.bad >= this.badWindows && this.getTier() < PERF_TIERS.length - 1) {
      const fps = this.fps;
      this.restart();
      this.onStep(this.getTier() + 1, fps);
    }
  }
}
