// Pure-logic tests (no browser, no packages). Run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Heightfield, waterQuery, WATER_LEVEL } from '../src/landscape.js';
import { PerformanceGovernor, PERF_TIERS } from '../src/perf.js';

test('terrain is deterministic and stays within sensible bounds', () => {
  const a = new Heightfield(250, 120);
  const b = new Heightfield(250, 120);
  for (const [x, z] of [[0, 8], [32, 30], [-54, -48], [90, -90], [-20, 44]]) {
    assert.equal(a.height(x, z), b.height(x, z));
    assert.ok(a.height(x, z) > -40 && a.height(x, z) < 120, `height at ${x},${z}`);
  }
});

test('the river and lakes are found by the water query', () => {
  assert.ok(waterQuery(-4.5, 0.5).dist < 6, 'pond');
  assert.ok(waterQuery(-2, 44).dist < 9, 'south lake');
  assert.ok(waterQuery(80, 80).dist > 5, 'far away from water');
  assert.ok(WATER_LEVEL < 0);
});

test('performance governor steps down only after two bad windows and ignores stalls', () => {
  globalThis.document = { hidden: false };
  let tier = 0;
  const steps = [];
  const gov = new PerformanceGovernor(() => tier, (t, fps) => { tier = t; steps.push([t, Math.round(fps)]); });
  gov.enabled = true;
  gov.arm();
  for (let i = 0; i < 700; i++) gov.update(1 / 60); // healthy frame rate: no change
  assert.equal(tier, 0);
  for (let i = 0; i < 40; i++) gov.update(0.6); // stalls (tab hidden etc.) are ignored
  assert.equal(tier, 0);
  for (let i = 0; i < 400; i++) gov.update(0.05); // 20 fps
  assert.ok(tier >= 1, 'stepped down');
  assert.equal(steps[0][0], 1);
  for (let i = 0; i < 3000; i++) gov.update(0.05);
  assert.equal(tier, PERF_TIERS.length - 1, 'stops at the lowest tier');
});
