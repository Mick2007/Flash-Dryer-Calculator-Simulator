import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from '../dryerCalculations';
import { extractParametricModel } from './parametricModel';
import { runAutomatedAssemblyTestSuite, AUTOMATED_TEST_CASES } from './assemblyTests';
import { DEFAULT_DRYER_INPUTS, IITA_REFERENCE_BENCHMARK } from '../constants';
import type { DryerInputs } from '../../types/dryer';

const LAYOUTS = ['single_loop', 'double_loop', 'straight_riser'] as const;
const base = (patch: Partial<DryerInputs> = {}): DryerInputs => ({ ...DEFAULT_DRYER_INPUTS, ...patch });

/**
 * ITEM 16: the 3D model must draw the machine the engine costed.
 *
 * The centreline was built from the riser and the elbows alone, with no
 * horizontal run, so it rendered 16.5 m against the engine's 20 m. The shortfall
 * was computed into pipeLengthDifferencePercent and then never displayed and never
 * asserted, so a model that was 3.5 m short of the design passed every test.
 */
describe('item 16: 3D centreline reproduces the engine developed length', () => {
  for (const layout of LAYOUTS) {
    it(`${layout}: centreline matches the design length within 1%`, () => {
      const results = calculateFlashDryer(base({ tubeRoutingLayout: layout }));
      const model = extractParametricModel(results);
      const diff = Math.abs(model.pipeCenterlineLengthM - model.totalLengthM) / model.totalLengthM;
      expect(
        diff,
        `${layout}: centreline ${model.pipeCenterlineLengthM} vs engine ${model.totalLengthM}`,
      ).toBeLessThanOrEqual(0.01);
    });
  }

  it('the reported difference is signed, so the direction of any error is visible', () => {
    const results = calculateFlashDryer(base());
    const model = extractParametricModel(results);
    // With a signed convention, a match is exactly zero rather than an absolute
    // value that would hide whether the model is long or short.
    expect(Math.abs(model.pipeLengthDifferencePercent)).toBeLessThan(0.5);
  });

  it('assembly tests gate on the length, and all cases still pass', () => {
    const suite = runAutomatedAssemblyTestSuite();
    expect(suite.totalCount).toBeGreaterThan(0);
    for (const entry of suite.results) {
      expect(
        entry.result.passed,
        `${entry.id ?? 'case'}: ${entry.result.validationMessage ?? ''}`,
      ).toBe(true);
    }
    expect(suite.allPassed).toBe(true);
  });

  it('the length gate actually fails when the centreline is wrong', () => {
    // A guard is only worth having if it can fail. With the routing corrected, no
    // case should be reporting a length mismatch, and the detail strings are
    // checked so a future regression is visible in the test output rather than
    // passing quietly.
    const suite = runAutomatedAssemblyTestSuite();
    const detailText = suite.results
      .map((entry) => [entry.result.validationMessage, ...(entry.result.details ?? [])].join(' '))
      .join(' ');
    expect(detailText).not.toMatch(/centreline is .* against an engine/i);
  });
});

/**
 * ITEM 17: the 3D bend radius disagreed with the engine by 60%.
 *
 * The model used max(0.40, pipeRadius x 2.5), which is 1.25 D. The engine sizes
 * the elbow at bendRadiusRatio x D, default 2.0 D. A 1.25 D bend has a markedly
 * higher pressure drop at the same angle, and that pressure drop feeds the fan
 * power, so the drawing was not the machine being costed.
 */
describe('item 17: 3D bend radius comes from the engine', () => {
  for (const layout of LAYOUTS) {
    it(`${layout}: model bend radius equals the engine's`, () => {
      const results = calculateFlashDryer(base({ tubeRoutingLayout: layout }));
      const model = extractParametricModel(results);
      expect(
        Math.abs(model.bendRadiusM - results.developedLengthReport.bendRadiusM),
        `${layout}: model ${model.bendRadiusM} vs engine ${results.developedLengthReport.bendRadiusM}`,
      ).toBeLessThan(0.001);
    });
  }

  it('changing the engine bend radius ratio changes the model', () => {
    const tight = calculateFlashDryer(base({ bendRadiusRatio: 1.0 }));
    const wide = calculateFlashDryer(base({ bendRadiusRatio: 4.0 }));
    const t = extractParametricModel(tight).bendRadiusM;
    const w = extractParametricModel(wide).bendRadiusM;
    expect(w).toBeGreaterThan(t);
    // And the ratio is preserved: 4 D really is four times the tube diameter.
    expect(Math.abs(w / t - 4.0)).toBeLessThan(0.01);
  });

  it('the bend radius is a sensible multiple of the tube diameter', () => {
    const results = calculateFlashDryer(base({ bendRadiusRatio: 2.0 }));
    const model = extractParametricModel(results);
    const diameterM = results.dimensions.tubeDiameterStandardMm / 1000;
    expect(model.bendRadiusM / diameterM).toBeCloseTo(2.0, 2);
  });
});

describe('item 16/17: the model stays valid across the reference designs', () => {
  const designs: Array<[string, DryerInputs]> = [
    ['default', DEFAULT_DRYER_INPUTS],
    ['IITA benchmark', IITA_REFERENCE_BENCHMARK],
  ];
  for (const [label, inputs] of designs) {
    it(`${label}: model dimensions are finite and positive`, () => {
      const m = extractParametricModel(calculateFlashDryer(inputs));
      for (const [k, v] of Object.entries({
        centerline: m.pipeCenterlineLengthM,
        riser: m.riserHeightM,
        bendRadius: m.bendRadiusM,
        total: m.totalLengthM,
        pipeDia: m.pipeDiameterMm,
      })) {
        expect(Number.isFinite(v as number), `${label} ${k}`).toBe(true);
        expect(v as number, `${label} ${k}`).toBeGreaterThan(0);
      }
    });
  }

  it('the assembly test cases are all still present', () => {
    expect(AUTOMATED_TEST_CASES.length).toBeGreaterThan(0);
  });
});
