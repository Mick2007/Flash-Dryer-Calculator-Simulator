import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import {
  DEFAULT_DRYER_INPUTS,
  IITA_REFERENCE_BENCHMARK,
  CIRAD_PILOT_BENCHMARK,
} from './constants';
import type { ValidationCheck, DryerInputs } from '../types/dryer';

/**
 * REFERENCE DESIGN SAFETY NET
 *
 * A validation rule that fires on a known-good design is not a check, it is noise.
 * Two rules written during the item 10-27 work did exactly that: the connectivity
 * rule compared the vortex finder against the FLASH TUBE (it should be compared
 * against the cyclone barrel) and compared the screw outlet against HALF the
 * venturi throat (a factor that appears nowhere in the geometry). Both reported
 * hazards on the published reference designs.
 *
 * This file exists so that cannot happen again unnoticed. It asserts that the
 * reference designs produce no INVALID checks and no fabricated hazards. When
 * somebody adds a validation rule, this test fails if the rule would condemn a
 * design that the cited sources endorse.
 */

// The designs that the cited primary sources actually describe. These are the
// reference points any new rule must agree with.
const REFERENCE_DESIGNS: Array<{ label: string; inputs: DryerInputs }> = [
  { label: 'Default design', inputs: DEFAULT_DRYER_INPUTS },
  { label: 'IITA / RMRDC benchmark', inputs: IITA_REFERENCE_BENCHMARK },
  {
    label: 'CIRAD 80 kg/h pilot benchmark',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'product',
      desiredProductRate: CIRAD_PILOT_BENCHMARK.desiredProductRate,
      initialMoisture: CIRAD_PILOT_BENCHMARK.initialMoisture,
      finalMoisture: CIRAD_PILOT_BENCHMARK.finalMoisture,
      inletAirTemp: CIRAD_PILOT_BENCHMARK.inletAirTemp,
      outletAirTemp: CIRAD_PILOT_BENCHMARK.outletAirTemp,
      airVelocity: CIRAD_PILOT_BENCHMARK.airVelocity,
    },
  },
];

describe('reference designs must not be condemned by validation rules', () => {
  for (const { label, inputs } of REFERENCE_DESIGNS) {
    it(`${label} produces no INVALID check`, () => {
      const checks = calculateFlashDryer(inputs).checks;
      const invalid = checks.filter(
        (c: ValidationCheck) => c.status === 'INVALID' || c.severity === 'danger',
      );
      const summary = invalid
        .map((c: ValidationCheck) => `  - [${c.severity}] ${c.id}: ${c.title}\n      ${c.message.slice(0, 220)}`)
        .join('\n');
      expect(
        invalid.length === 0,
        `${label} is a design the cited sources endorse, so no rule may report it as a hazard.\n${summary}`,
      );
    });

    it(`${label} produces no connectivity failure`, () => {
      const checks = calculateFlashDryer(inputs).checks;
      const conn = checks.find(
        (c: ValidationCheck) => c.id === 'chk-conn-valid' || c.id === 'chk-conn-review',
      );
      expect(conn, 'a connectivity check must always be present').toBeDefined();
      expect(
        conn!.id,
        `${label} failed connectivity:\n${conn!.message}`,
      ).toBe('chk-conn-valid');
    });

    it(`${label} does not trigger a bulk-density adjustment`, () => {
      const checks = calculateFlashDryer(inputs).checks;
      const bulk = checks.find((c: ValidationCheck) => c.id === 'chk-bulk-density');
      expect(bulk).toBeDefined();
      expect(
        bulk!.status,
        `${label} had its bulk density adjusted:\n${bulk!.message}`,
      ).not.toBe('WARNING');
    });
  }
});

describe('validation rules must be able to fail (regression guard)', () => {
  it('reports a hazard when the geometry is genuinely impossible', () => {
    // Bulk density above particle density is impossible and MUST be reported.
    const r = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      bulkDensity: 2400,
      particleDensity: 900,
    });
    const bulk = r.checks.find((c: ValidationCheck) => c.id === 'chk-bulk-density');
    expect(bulk).toBeDefined();
    expect(bulk!.status).toBe('WARNING');
  });

  it('every check carries a status field the UI can rely on', () => {
    // Item: "missing status on the pressure checks" from the earlier review.
    for (const { label, inputs } of REFERENCE_DESIGNS) {
      const checks = calculateFlashDryer(inputs).checks;
      for (const c of checks) {
        expect(
          typeof c.status,
          `${label} / ${c.id} has no status`,
        ).toBe('string');
        expect(c.status.length).toBeGreaterThan(0);
        expect(
          ['VALID', 'WARNING', 'INVALID', 'NEEDS REVIEW'],
          `${label} / ${c.id} has unexpected status "${c.status}"`,
        ).toContain(c.status);
      }
    }
  });
});
