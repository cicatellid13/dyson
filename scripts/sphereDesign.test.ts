import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateSphereDesign } from '../src/lib/sphereDesign';

test('sphere design converts points to materials and uses the slower overlapping phase', () => {
  const design = { structurePoints: 12_000, cellPoints: 150_000, powerGW: 6 };
  assert.deepEqual(calculateSphereDesign(design, 60, 500), {
    rockets: 12_000, sails: 150_000, powerGW: 6,
    frameMinutes: 200, shellMinutes: 300, overlapMinutes: 300, gwPerThousandRockets: 0.5,
  });
  assert.equal(calculateSphereDesign(design, 30, 500).overlapMinutes, 400);
});

test('sphere design distinguishes empty phases, missing rates, and undefined power efficiency', () => {
  const design = { structurePoints: 0, cellPoints: 500, powerGW: 2 };
  const result = calculateSphereDesign(design, null, 0);
  assert.equal(result.frameMinutes, 0);
  assert.equal(result.shellMinutes, null);
  assert.equal(result.overlapMinutes, null);
  assert.equal(result.gwPerThousandRockets, null);
  assert.equal(calculateSphereDesign({ ...design, structurePoints: null }, 60, 500).overlapMinutes, null);
  assert.equal(calculateSphereDesign({ ...design, structurePoints: 1000, powerGW: null }, 60, 500).gwPerThousandRockets, null);
});
