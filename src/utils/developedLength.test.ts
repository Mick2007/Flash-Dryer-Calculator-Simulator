import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS, CIRAD_BENCHMARKS } from './constants';
import type { DryerInputs } from '../types/dryer';

const LAYOUTS = ['single_loop', 'double_loop', 'straight_riser'] as const;
const RESIDENCE_TIMES = [0.8, 1.5, 3.0];

const base = (patch: Partial<DryerInputs> = {}): DryerInputs => ({
  ...DEFAULT_DRYER_INPUTS,
  ...patch,
});

/**
 * ITEM 12: one authoritative developed length.
 *
 * The length was previously computed twice by independent paths. Path A sized the
 * tube from the residence-time rule plus the CIRAD floor and fed the residence
 * time, the length checks and the dimensions block. Path B built the segment list
 * to REACH that figure, summed it, and reported max(A, sum) — so the report could
 * show a different length from the checks. double_loop reported 21.2 m while the
 * compliance test graded 20.0 m.
 */
describe('item 12: the developed length is computed once and agrees everywhere', () => {
  for (const layout of LAYOUTS) {
    for (const tau of RESIDENCE_TIMES) {
      it(`${layout} at ${tau} s: dimensions, report and segment sum all agree`, () => {
        const r = calculateFlashDryer(
          base({ tubeRoutingLayout: layout, targetResidenceTime: tau }),
        );

        // 1. The report's total is the sum of its own segments.
        const segmentSum = Math.round(
          r.developedLengthReport.segments.reduce((a, s) => a + s.totalLengthM, 0) * 10,
        ) / 10;
        expect(
          Math.abs(r.developedLengthReport.totalDevelopedLengthM - segmentSum),
          `${layout} @ ${tau}s: report total ${r.developedLengthReport.totalDevelopedLengthM} vs segment sum ${segmentSum}`,
        ).toBeLessThanOrEqual(0.05);

        // 2. The dimensions block reports the SAME number.
        expect(
          Math.abs(r.dimensions.totalPipeLengthM - r.developedLengthReport.totalDevelopedLengthM),
          `${layout} @ ${tau}s: dimensions ${r.dimensions.totalPipeLengthM} vs report ${r.developedLengthReport.totalDevelopedLengthM}`,
        ).toBeLessThanOrEqual(0.05);

        // 3. And the check messages quote the same figure.
        const lenCheck = r.checks.find((c) => c.id.startsWith('chk-len-'));
        if (lenCheck) {
          expect(lenCheck.currentValue).toContain(
            r.developedLengthReport.totalDevelopedLengthM.toFixed(1),
          );
        }
      });
    }
  }

  it('ciradCompliant is graded against the same length the report prints', () => {
    for (const layout of LAYOUTS) {
      const r = calculateFlashDryer(base({ tubeRoutingLayout: layout }));
      const expected =
        r.developedLengthReport.totalDevelopedLengthM >= CIRAD_BENCHMARKS.minDevelopedPipeLengthM;
      expect(r.developedLengthReport.ciradCompliant, `${layout}`).toBe(expected);
    }
  });

  it('a deliberately short custom length is reported short, and flagged non-compliant', () => {
    const r = calculateFlashDryer(base({ customTotalPipeLengthM: 12 }));
    expect(r.developedLengthReport.totalDevelopedLengthM).toBeLessThan(
      CIRAD_BENCHMARKS.minDevelopedPipeLengthM,
    );
    expect(r.developedLengthReport.ciradCompliant).toBe(false);
    // And the length check must notice, using that same figure.
    const lenCheck = r.checks.find((c) => c.id.startsWith('chk-len-'));
    expect(lenCheck, 'a short length must raise a length check').toBeDefined();
  });
});

/**
 * ITEM 12, second half: downcomerLengthM must come from the segment that was
 * built, and be zero where the layout has no downcomer at all.
 */
describe('item 12: downcomerLengthM reflects the segment actually built', () => {
  for (const layout of LAYOUTS) {
    it(`${layout}: reported downcomer matches the downcomer segment, or is 0 if absent`, () => {
      const r = calculateFlashDryer(base({ tubeRoutingLayout: layout }));
      const segment = r.developedLengthReport.segments.find((s) => s.id === 'seg-downcomer');
      const reported = r.developedLengthReport.downcomerLengthM;

      if (segment) {
        expect(segment.totalLengthM).toBeGreaterThan(0);
        expect(
          Math.abs(reported - segment.totalLengthM),
          `${layout}: reported ${reported} vs segment ${segment.totalLengthM}`,
        ).toBeLessThanOrEqual(0.05);
      } else {
        // The previous code published max(1.5, H - 2.5) for EVERY layout, so a
        // straight_riser design — which has no downcomer — reported a 5.5 m
        // downcomer segment that does not exist.
        expect(segment, `${layout} should have no downcomer segment`).toBeUndefined();
        expect(reported, `${layout} must report 0, not an invented length`).toBe(0);
      }
    });
  }
});

/**
 * ITEM 13: bend radius and wall thickness were unguarded. A negative bend ratio
 * gave a negative arc length; a 300 mm wall gave a negative inner diameter and a
 * negative steel mass.
 */
describe('item 13: bend radius and wall thickness are sanitised', () => {
  it('extreme inputs never yield negative or NaN geometry', () => {
    const cases: Array<[number, number]> = [
      [300, 300],
      [0, 0],
      [-3, -2],
      [1e9, 1e9],
      [NaN, NaN],
      [-Infinity, Infinity],
    ];
    for (const [ratio, wall] of cases) {
      const r = calculateFlashDryer(
        base({ bendRadiusRatio: ratio, tubeWallThicknessMm: wall }),
      );
      const d = r.developedLengthReport;
      expect(Number.isFinite(d.bendRadiusM), `ratio ${ratio}`).toBe(true);
      expect(d.bendRadiusM, `ratio ${ratio}`).toBeGreaterThan(0);
      expect(Number.isFinite(d.totalDevelopedLengthM), `ratio ${ratio}`).toBe(true);
      expect(d.totalDevelopedLengthM).toBeGreaterThan(0);
      for (const s of d.segments) {
        expect(Number.isFinite(s.totalLengthM), `segment ${s.id}, ratio ${ratio}`).toBe(true);
        expect(s.totalLengthM, `segment ${s.id}, ratio ${ratio}`).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(s.unitLengthM), `unit ${s.id}`).toBe(true);
      }
    }
  });

  it('bend radius ratio is held within 1.0-6.0', () => {
    expect(calculateFlashDryer(base({ bendRadiusRatio: -3 })).developedLengthReport.bendRadiusRatio).toBeGreaterThanOrEqual(1);
    expect(calculateFlashDryer(base({ bendRadiusRatio: 99 })).developedLengthReport.bendRadiusRatio).toBeLessThanOrEqual(6);
  });

  it('wall thickness stays below 5% of the outside diameter', () => {
    for (const wall of [1, 2, 6, 300]) {
      const r = calculateFlashDryer(base({ tubeWallThicknessMm: wall }));
      const od = r.dimensions.tubeDiameterStandardMm;
      const applied = r.developedLengthReport.sheetMetal.wallThicknessMm;
      expect(applied, `requested ${wall} on OD ${od}`).toBeLessThanOrEqual(od * 0.05 + 1e-9);
    }
  });

  it('steel mass is always positive and finite', () => {
    for (const wall of [-2, 0, 1, 2.5, 6, 300, NaN]) {
      const r = calculateFlashDryer(base({ tubeWallThicknessMm: wall }));
      const m = r.developedLengthReport.sheetMetal.estimatedMassKg;
      expect(Number.isFinite(m), `wall ${wall}`).toBe(true);
      expect(m, `wall ${wall}`).toBeGreaterThan(0);
    }
  });
});

/**
 * ITEM 14: residence time was L / (v_air - v_t) for the whole tube, applying the
 * riser condition — the slowest leg — to every metre of duct.
 */
describe('item 14: residence time is evaluated per leg', () => {
  it('a loop layout has a SHORTER residence time than a straight riser of the same length', () => {
    // Both are the same total developed length, but they put very different
    // fractions of it into the SLOW leg. A straight riser carries nearly all of
    // it upward at (v - v_t); a loop layout caps the riser at the column height
    // and puts the remainder into the horizontal run (v x slip) and the downcomer
    // (v + v_t). So for an equal length the loop machine holds the product for
    // LESS time, and the per-leg model shows that where the old single-speed
    // expression L/(v - v_t) made the two layouts look identical.
    const riser = calculateFlashDryer(base({ tubeRoutingLayout: 'straight_riser' }));
    const loop = calculateFlashDryer(base({ tubeRoutingLayout: 'single_loop' }));
    expect(
      loop.developedLengthReport.effectiveResidenceTimeSec,
      'loop layout should hold the product for less time at equal developed length',
    ).toBeLessThan(riser.developedLengthReport.effectiveResidenceTimeSec);
  });

  it('the straight riser puts more of its length in the slow upward leg', () => {
    // This is the mechanism behind the previous assertion, asserted directly so
    // the test fails for the right reason if the per-leg model is removed.
    const riserLen = (layout: string) =>
      calculateFlashDryer(base({ tubeRoutingLayout: layout as DryerInputs['tubeRoutingLayout'] }))
        .developedLengthReport.segments
        .filter((s) => s.id === 'seg-riser')
        .reduce((a, s) => a + s.totalLengthM, 0);
    expect(riserLen('straight_riser')).toBeGreaterThan(riserLen('single_loop'));
  });

  it('residence time is consistent with the per-leg sum of the segments', () => {
    for (const layout of LAYOUTS) {
      const r = calculateFlashDryer(base({ tubeRoutingLayout: layout }));
      const d = r.developedLengthReport;
      // Reconstruct the legs from the segments and confirm the reported time.
      const riserLen = d.segments
        .filter((s) => s.id === 'seg-riser')
        .reduce((a, s) => a + s.totalLengthM, 0);
      const downcomerLen = d.segments
        .filter((s) => s.id === 'seg-downcomer')
        .reduce((a, s) => a + s.totalLengthM, 0);
      const horizontalLen = d.horizontalRunsLengthM;

      const vAir = r.dimensions.actualAirVelocityMperS;
      const vT = r.fluidDynamics.particleTerminalVelocity;
      const uVert = Math.max(0.1, vAir - vT);
      const uHoriz = Math.max(0.1, vAir * 0.85);
      const uDown = vAir + vT;

      const expected =
        riserLen / uVert + horizontalLen / uHoriz + downcomerLen / uDown;
      expect(
        Math.abs(d.effectiveResidenceTimeSec - expected),
        `${layout}: reported ${d.effectiveResidenceTimeSec} vs per-leg ${expected.toFixed(3)}`,
      ).toBeLessThan(0.05);
    }
  });

  it('residence time is positive and finite for every layout', () => {
    for (const layout of LAYOUTS) {
      const t = calculateFlashDryer(base({ tubeRoutingLayout: layout }))
        .developedLengthReport.effectiveResidenceTimeSec;
      expect(Number.isFinite(t), layout).toBe(true);
      expect(t, layout).toBeGreaterThan(0);
    }
  });
});
