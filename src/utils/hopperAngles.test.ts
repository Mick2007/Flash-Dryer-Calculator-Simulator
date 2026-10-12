import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS } from './constants';

/**
 * HOPPER WALL ANGLE ATTRIBUTION
 *
 * A wall's slope is set by the horizontal offset between its top and bottom
 * edges, measured PERPENDICULAR to that edge:
 *
 *   - a SIDE wall is a left/right panel, so its top edge runs along the hopper
 *     LENGTH and its offset is Run_L = (L1 - L2) / 2
 *   - an END wall is a front/back panel, so its top edge runs along the WIDTH
 *     and its offset is Run_W = (W1 - W2) / 2
 *
 * yielding
 *
 *     A (side) = arctan(h2 / Run_L)
 *     B (end)  = arctan(h2 / Run_W)
 *
 * These were previously transposed (A from Run_W, B from Run_L). Nothing caught
 * it because no test asserted the angles, and both numbers are individually
 * plausible — 87.9 and 86.7 deg are both perfectly reasonable hopper wall slopes.
 * Only the NAMES were wrong, and no surface compared a name to a formula.
 *
 * The assertions below are written against the RELATIONSHIP (cot A = Run_L / h2)
 * rather than only the numeric result, so a future re-introduction of the
 * transposition fails even if the hardcoded expectations are updated to match.
 *
 * NOTE ON THE 76/81 REFERENCE. The hopper UI prints "IITA ref: 76" and "81"
 * beside these angles, but at the default geometry the engine solves h2 = 2.454 m
 * (from 136.67 kg held at 380 kg/m3 with 10% volume allowance), which yields
 * 86.7 and 87.9 deg. Neither pairing reproduces 76/81, so that printed reference
 * does not describe this geometry and is a pre-existing inaccuracy, unrelated to
 * the A/B transposition. These tests therefore assert the attribution and the
 * geometry, not agreement with that figure.
 */

const rad = (deg: number) => (deg * Math.PI) / 180;

describe('hopper wall angle attribution (side = length run, end = width run)', () => {
  const h = calculateFlashDryer(DEFAULT_DRYER_INPUTS).hopperDesign;
  const h2 = h.lowerTaperedHeightM;

  it('reports the runs the two angles are built from', () => {
    // W1 500, W2 320 -> Run_W 90 mm. L1 500, L2 220 -> Run_L 140 mm.
    expect(h.runWidthM).toBeCloseTo(0.09, 3);
    expect(h.runLengthM).toBeCloseTo(0.14, 3);
    // h2 is SOLVED from the required volume, not assumed. The stale "~0.556 m"
    // figure in the HopperDesignReport type comment is wrong; see the note above.
    expect(h2).toBeCloseTo(2.454, 2);
  });

  it('angle A is the side wall, driven by the LENGTH run', () => {
    expect(h.wallSlopeAngleADeg).toBeCloseTo(86.7, 1);
    // cot A must equal Run_L / h2, NOT Run_W / h2. Tolerance is 2 dp because the
    // reported angle is rounded to 0.1 deg, so inverting it is not exact.
    expect(1 / Math.tan(rad(h.wallSlopeAngleADeg))).toBeCloseTo(h.runLengthM / h2, 2);
    // And it must NOT be the width run, which is the transposed case.
    expect(1 / Math.tan(rad(h.wallSlopeAngleADeg))).not.toBeCloseTo(h.runWidthM / h2, 2);
  });

  it('angle B is the end wall, driven by the WIDTH run', () => {
    expect(h.wallSlopeAngleBDeg).toBeCloseTo(87.9, 1);
    // cot B must equal Run_W / h2, NOT Run_L / h2.
    expect(1 / Math.tan(rad(h.wallSlopeAngleBDeg))).toBeCloseTo(h.runWidthM / h2, 2);
    expect(1 / Math.tan(rad(h.wallSlopeAngleBDeg))).not.toBeCloseTo(h.runLengthM / h2, 2);
  });

  it('is steep enough for mass flow', () => {
    // Both walls clear the 70 deg threshold comfortably at this geometry.
    expect(h.wallSlopeAngleADeg).toBeGreaterThan(70);
    expect(h.wallSlopeAngleBDeg).toBeGreaterThan(70);
  });

  it('the side wall is shallower than the end wall when the outlet is longer than it is wide', () => {
    // L2 (220) > W2 (320) is false; the length run (140) exceeds the width run
    // (90), so the side wall must be the shallower of the two.
    expect(h.runLengthM).toBeGreaterThan(h.runWidthM);
    expect(h.wallSlopeAngleADeg).toBeLessThan(h.wallSlopeAngleBDeg);
  });

  it('leaves the corner valley angle C unchanged by the relabelling', () => {
    // cot²(C) is the SUM of the two cotangents, so it is symmetric in A and B.
    // C must be identical before and after the swap — proof the fix is a pure
    // relabel and never moved a dimension.
    expect(h.valleyAngleDeg).toBeCloseTo(86.1, 1);
    const cotA = 1 / Math.tan(rad(h.wallSlopeAngleADeg));
    const cotB = 1 / Math.tan(rad(h.wallSlopeAngleBDeg));
    const cFromFormula = Math.atan(1 / Math.sqrt(cotA ** 2 + cotB ** 2)) * (180 / Math.PI);
    expect(cFromFormula).toBeCloseTo(h.valleyAngleDeg, 1);
  });

  it('still clears the 70 deg mass-flow threshold on the reference design', () => {
    expect(h.isValleyAngleSufficient).toBe(true);
    expect(h.valleyAngleDeg).toBeGreaterThanOrEqual(70);
  });
});

describe('the relabelling moves no dimension', () => {
  it('leaves the hopper volume, height and outlet untouched', () => {
    const h = calculateFlashDryer(DEFAULT_DRYER_INPUTS).hopperDesign;
    // These are the figures a fabricator cuts to, and they were always correct;
    // only the angle labels were wrong.
    expect(h.totalGeometricVolumeM3).toBeCloseTo(0.3956, 4);
    expect(h.overallHeightM).toBeCloseTo(2.554, 2);
    expect(h.outletWidthM).toBeCloseTo(0.32, 3);
    expect(h.outletLengthM).toBeCloseTo(0.22, 3);
  });
});
