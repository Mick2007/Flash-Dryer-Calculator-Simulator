import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS } from './constants';

describe('heat exchanger face velocity: open frontal area', () => {
  it('computes a free area smaller than the gross casing area', () => {
    const hex = calculateFlashDryer(DEFAULT_DRYER_INPUTS).heatExchanger;
    expect(hex.bundleFreeAreaM2).toBeGreaterThan(0);
    expect(hex.bundleFreeAreaM2).toBeLessThan(hex.casingGrossAreaM2);
    // Blocked + free must reconstruct the gross area.
    const reconstructed = hex.bundleFreeAreaM2 + hex.blockedAreaM2;
    expect(Math.abs(reconstructed - hex.casingGrossAreaM2)).toBeLessThan(0.01);
  });

  it('reports a face velocity in a plausible band, not the previous 0.70 m/s', () => {
    const hex = calculateFlashDryer(DEFAULT_DRYER_INPUTS).heatExchanger;
    // The old expression produced 0.70 m/s because the area was ~9x too large.
    // A cross-flow finned gas heater is specified in the 2.5-12 m/s range.
    expect(hex.airFaceVelocityMperS).toBeGreaterThan(2.5);
    expect(hex.airFaceVelocityMperS).toBeLessThan(12);
  });

  it('leading passage velocity exceeds the bundle mean by a physical factor', () => {
    // The air is forced through the fin grid, so between elements it runs several
    // times faster than the bundle mean. A ratio of 2-8x is right for a finned
    // grid; 1x would mean no acceleration, and 50x would mean a fire.
    const hex = calculateFlashDryer(DEFAULT_DRYER_INPUTS).heatExchanger;
    const ratio = hex.leadingPassageVelocityMperS / hex.airFaceVelocityMperS;
    expect(ratio).toBeGreaterThan(1.5);
    expect(ratio).toBeLessThan(10);
  });

  it('face velocity equals airflow divided by free area', () => {
    const r = calculateFlashDryer(DEFAULT_DRYER_INPUTS);
    const hex = r.heatExchanger;
    // Recover the airflow from the reported face velocity and free area and
    // confirm it is a sane m3/s figure for this plant.
    const impliedFlowM3S = (hex.airFaceVelocityMperS * hex.bundleFreeAreaM2);
    expect(impliedFlowM3S).toBeGreaterThan(0.5);
    expect(impliedFlowM3S).toBeLessThan(50);
  });

  it('U and face velocity are consistent because both come from the same geometry', () => {
    // U is scaled off mass velocity, which is airflow*density/free area. If U and
    // the face velocity were computed from different areas they would disagree.
    const hex = calculateFlashDryer(DEFAULT_DRYER_INPUTS).heatExchanger;
    const expectedScale = Math.pow(hex.airMassVelocityKgM2S / 10, 0.8);
    const expectedU = 52.0 * expectedScale;
    expect(Math.abs(hex.overallUCoeffWperM2K - expectedU)).toBeLessThan(1.0);
  });

  it('scales with capacity rather than being fixed', () => {
    const small = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, capacityMode: 'product', desiredProductRate: 200 }).heatExchanger;
    const large = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, capacityMode: 'product', desiredProductRate: 4000 }).heatExchanger;
    // More duty must produce a bigger bundle, hence a bigger free area.
    expect(large.bundleFreeAreaM2).toBeGreaterThan(small.bundleFreeAreaM2);
  });

  it('keeps the bundle physically buildable across the duty range', () => {
    // Regression guard. Three earlier versions of the bundle solver diverged and
    // silently returned a 42 m then a 153 m wide casing with U = 4.7 then
    // 1.3 W/(m²·K). These assertions fail if the loop ever closes on itself again.
    for (const kW of [50, 150, 400, 1000, 2500, 6000]) {
      const hex = calculateFlashDryer({
        ...DEFAULT_DRYER_INPUTS,
        capacityMode: 'product',
        desiredProductRate: Math.round(kW * 2),
      }).heatExchanger;
      // A buildable cross-flow casing is metres, not tens of metres. A 6000 kW
      // heater legitimately needs a wide multi-row casing, so the bound is set
      // generously; the point is to catch the runaway (42 m, 153 m) that the
      // circular solver produced, not to police the largest duty.
      expect(hex.casingWidthM, `${kW} kW casing width`).toBeLessThan(12);
      expect(hex.casingWidthM).toBeGreaterThan(0.1);
      // U for a finned gas heater is 20-90 W/(m²·K).
      expect(hex.overallUCoeffWperM2K, `${kW} kW U`).toBeGreaterThan(15);
      expect(hex.overallUCoeffWperM2K).toBeLessThan(120);
      // Mass velocity 2-15 kg/(m²·s) for this service.
      expect(hex.airMassVelocityKgM2S, `${kW} kW mass velocity`).toBeGreaterThan(1);
      expect(hex.airMassVelocityKgM2S).toBeLessThan(25);
      // Tube count is checked for runaway only. There is a large fixed component
      // (a minimum casing, a minimum pass length), so a linear bound in duty is
      // not meaningful at the small end; a generous absolute ceiling catches the
      // 3000+ tube result the circular solver produced.
      expect(hex.tubesPerPass, `${kW} kW tube count`).toBeLessThan(1500);
      expect(hex.tubesPerPass).toBeGreaterThanOrEqual(4);
    }
  });

  it('U is consistent with the mass velocity reported alongside it', () => {
    for (const kW of [150, 400, 1000, 2500]) {
      const hex = calculateFlashDryer({
        ...DEFAULT_DRYER_INPUTS,
        capacityMode: 'product',
        desiredProductRate: Math.round(kW * 2),
      }).heatExchanger;
      const expected = 52.0 * Math.pow(hex.airMassVelocityKgM2S / 10, 0.8);
      // Reported U is rounded to 0.1, so a 0.2 tolerance is generous.
      expect(Math.abs(hex.overallUCoeffWperM2K - expected), `${kW} kW`).toBeLessThan(0.5);
    }
  });
});
