import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS } from './constants';

/**
 * Screw capacity is verified against the client's own reference implementation,
 * ScrewFeederDesignTool_V1.0.xlsx, sheet "ScrewFeederDesign".
 *
 * The workbook's cell C8 carries the formula (recovered with cellFormula:true):
 *
 *     C8 = C6 * PI() * (C4^2 - C5^2) / 4
 *        = pitch * pi/4 * (D_outer^2 - D_shaft^2)
 *
 * giving the swept volume per revolution at 100% fill, and the flow is then
 *
 *     E  = C8 * C7 * D22 / 60        [m3/s]
 *     F  = C12 * E                   [kg/s]
 *     G  = F * 3600                  [kg/h]
 *
 * The workbook's own inputs are D = 80 mm, shaft = 20 mm, pitch = 80 mm,
 * filling 0.4, bulk density 380 kg/m3, and it reports:
 *     C8 = 0.0003769911184307752 m3/rev
 *     G23 = 123.77372400319211 kg/h at 36 rev/min
 *
 * These are the reference figures reproduced here. They are NOT the Kuye et al.
 * number, which is what the previous (CEMA, constant-fitted) model was tuned to.
 */

/** The workbook's C8 formula, as a standalone reference implementation. */
const workbookSweptVolume = (pitchM: number, dOuterM: number, dShaftM: number): number =>
  pitchM * Math.PI * (dOuterM * dOuterM - dShaftM * dShaftM) / 4;

const WORKBOOK = {
  dOuter: 0.08,
  dShaft: 0.02,
  pitch: 0.08,
  fill: 0.4,
  bulkDensity: 380,
  sweptVolumeM3: 0.0003769911184307752,
  rpm: 36,
  massFlowKgH: 123.77372400319211,
};

describe('screw capacity: matches the client reference workbook', () => {
  it('the workbook formula reproduces its own stored value exactly', () => {
    const v = workbookSweptVolume(WORKBOOK.pitch, WORKBOOK.dOuter, WORKBOOK.dShaft);
    expect(v).toBeCloseTo(WORKBOOK.sweptVolumeM3, 18);
  });

  it('the workbook formula reproduces its own mass flow exactly', () => {
    const v = workbookSweptVolume(WORKBOOK.pitch, WORKBOOK.dOuter, WORKBOOK.dShaft);
    const m3PerSec = (v * WORKBOOK.fill * WORKBOOK.rpm) / 60;
    const kgPerHour = WORKBOOK.bulkDensity * m3PerSec * 3600;
    expect(kgPerHour).toBeCloseTo(WORKBOOK.massFlowKgH, 6);
  });

  it('the engine agrees with the workbook for the workbook geometry', () => {
    const r = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      screwDiameterMm: 80,
      screwShaftDiameterMm: 20,
      screwPitchMm: 80,
      screwLoadingPercent: 40,
      bulkDensity: 380,
    });
    const screw = r.screwFeederDesign;
    // Capacity is reported in ft3/h/rpm. The workbook figure is m3/rev, so compare
    // the swept volume the engine reports in the trace against the workbook.
    const expectedFt3PerHourPerRpm = WORKBOOK.sweptVolumeM3 * WORKBOOK.fill * 60 * 35.3146667;
    expect(screw.capacityFactorPerRpmFt3H).toBeCloseTo(expectedFt3PerHourPerRpm, 6);
  });

  it('the swept-volume form replaces the fitted CEMA constant', () => {
    // Regression guard. The CEMA form with the constant 0.08817 returned
    // 0.3838 ft3/h/rpm for this geometry; the swept-volume form the workbook
    // implements returns 0.3195. That is a 20% overstatement, not the 29x
    // initially claimed — that figure came from comparing an ft3/h/rpm value
    // against a m3/rev value, i.e. two different units. A real but far smaller
    // error than first reported. The form is still corrected: it is exact rather
    // than fitted, and it retains the shaft-annulus term CEMA collapses away.
    const r = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      screwDiameterMm: 80,
      screwShaftDiameterMm: 20,
      screwPitchMm: 80,
      screwLoadingPercent: 40,
    });
    const expected = WORKBOOK.sweptVolumeM3 * WORKBOOK.fill * 60 * 35.3146667;
    expect(r.screwFeederDesign.capacityFactorPerRpmFt3H).toBeCloseTo(expected, 6);
    // And it must not be the old fitted constant's value.
    expect(r.screwFeederDesign.capacityFactorPerRpmFt3H).not.toBeCloseTo(0.3838, 3);
  });

  it('shaft diameter reduces capacity, since the shaft displaces product', () => {
    const light = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      screwDiameterMm: 100,
      screwShaftDiameterMm: 20,
    }).screwFeederDesign.capacityFactorPerRpmFt3H;
    const heavy = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      screwDiameterMm: 100,
      screwShaftDiameterMm: 60,
    }).screwFeederDesign.capacityFactorPerRpmFt3H;
    expect(heavy).toBeLessThan(light);
  });

  it('pitch increases capacity proportionally', () => {
    const shortPitch = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      screwDiameterMm: 100,
      screwPitchMm: 50,
    }).screwFeederDesign.capacityFactorPerRpmFt3H;
    const longPitch = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      screwDiameterMm: 100,
      screwPitchMm: 150,
    }).screwFeederDesign.capacityFactorPerRpmFt3H;
    expect(longPitch / shortPitch).toBeCloseTo(3.0, 3);
  });
});
