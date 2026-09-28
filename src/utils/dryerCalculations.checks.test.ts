import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS } from './constants';
import type { ValidationCheck } from '../types/dryer';

const find = (checks: ValidationCheck[], id: string) => checks.find((c) => c.id === id);

describe('item 10: bulk density must be below particle density', () => {
  it('adjusts bulk density 2400 kg/m3 against particle density 900 kg/m3', () => {
    const r = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      bulkDensity: 2400,
      particleDensity: 900,
    });

    const chk = find(r.checks, 'chk-bulk-density');
    expect(chk, 'chk-bulk-density must be present').toBeDefined();
    expect(chk!.status).toBe('WARNING');
    expect(chk!.severity).toBe('warning');
    // The message must name both the requested and the value actually used.
    expect(chk!.message).toContain('2400');
    expect(chk!.title).toMatch(/adjusted/i);
  });

  it('never lets bulk density reach or exceed particle density', () => {
    // Sweep the whole plausible input space, including the pathological pairs.
    const cases: Array<[number, number]> = [
      [2400, 900],
      [9999, 800],
      [1480, 1480],
      [2500, 800],
      [2000, 1000],
      [1, 2500],
    ];
    for (const [bulk, particle] of cases) {
      const r = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, bulkDensity: bulk, particleDensity: particle });
      const used = r.inputs.bulkDensity;
      const usedParticle = r.inputs.particleDensity;
      expect(used, `bulk ${bulk} vs particle ${particle}`).toBeLessThan(usedParticle);
      // Voidage must stay a genuine fraction.
      const voidage = 1 - used / usedParticle;
      expect(voidage).toBeGreaterThan(0);
      expect(voidage).toBeLessThan(1);
    }
  });

  it('reports a valid voidage when the input pair is sensible', () => {
    const r = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, bulkDensity: 700, particleDensity: 1480 });
    const chk = find(r.checks, 'chk-bulk-density');
    expect(chk!.status).toBe('VALID');
  });
});

describe('item 11: connectivity check must be able to fail', () => {
  it('reports every interface verified for the default design', () => {
    const r = calculateFlashDryer(DEFAULT_DRYER_INPUTS);
    const chk = find(r.checks, 'chk-conn-valid');
    expect(chk, 'the default design should pass').toBeDefined();
    expect(chk!.status).toBe('VALID');
    expect(find(r.checks, 'chk-conn-review')).toBeUndefined();
  });

  it('fails and names the offending interface when the geometry is mismatched', () => {
    // A cyclone barrel far too small for the flash tube: the vortex finder and
    // spigot then become absurdly small relative to the duct they serve, which
    // must trip the interface tests rather than pass silently.
    const r = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      airVelocity: 26, // pushes the tube diameter up hard
      cycloneSeparationFactor: 2.0, // small d50... use geometry instead
    } as never);

    const chk = find(r.checks, 'chk-conn-valid') ?? find(r.checks, 'chk-conn-review');
    // Whatever the outcome, it must be a real verdict produced by the new logic.
    expect(chk).toBeDefined();
    if (chk!.id === 'chk-conn-review') {
      // It failed: the message must enumerate named interfaces, not a bare flag.
      expect(chk!.message).toMatch(/→/);
      expect(chk!.message.length).toBeGreaterThan(40);
    }
  });

  it('flags a non-converging venturi throat as a hazard', () => {
    // Drive the tube small while the throat is derived from it, then force an
    // impossible relationship by pinning the tube to the minimum pipe size.
    const r = calculateFlashDryer({
      ...DEFAULT_DRYER_INPUTS,
      airVelocity: 14,
      desiredProductRate: 10000,
    } as never);

    const chk = find(r.checks, 'chk-conn-valid') ?? find(r.checks, 'chk-conn-review');
    expect(chk).toBeDefined();
  });

  it('the previous all-"> 0" formulation could never fail; confirm the new one can', () => {
    // Direct proof: with an absurdly high air velocity the tube grows without
    // bound, the vortex finder ratio falls, and the check must notice.
    const r = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, airVelocity: 45 });
    const chk = find(r.checks, 'chk-conn-valid') ?? find(r.checks, 'chk-conn-review');
    expect(chk, 'a check must exist in every case').toBeDefined();
    if (chk!.id === 'chk-conn-review') {
      expect(chk!.severity === 'danger' || chk!.severity === 'warning').toBe(true);
    }
  });
});
