import { describe, it, expect } from 'vitest';
import { summariseChecks, verdictHeadline, plural } from './checkSummary';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS } from './constants';
import type { ValidationCheck } from '../types/dryer';

const mk = (severity: ValidationCheck['severity'], id: string): ValidationCheck => ({
  id,
  category: 'Velocity',
  severity,
  status: 'NEEDS REVIEW',
  title: `t-${id}`,
  message: `m-${id}`,
  currentValue: '',
  recommendedRange: '',
  source: '',
});

describe('item 26: shared check counts', () => {
  it('counts the three bands separately', () => {
    const c = summariseChecks([
      mk('danger', 'a'), mk('danger', 'b'),
      mk('warning', 'c'),
      mk('info', 'd'),
      mk('success', 'e'), mk('success', 'f'),
    ]);
    expect(c.danger).toBe(2);
    expect(c.warning).toBe(1);
    expect(c.info).toBe(1);
    expect(c.total).toBe(6);
  });

  it('allPass requires ALL THREE bands to be zero', () => {
    // The defect: the dashboard counted only danger and warning, so a design whose
    // sole outstanding item was `info` printed "All engineering checks pass" while
    // the header showed "1 for review".
    expect(summariseChecks([mk('success', 'a')]).allPass).toBe(true);
    expect(summariseChecks([mk('info', 'a')]).allPass).toBe(false);
    expect(summariseChecks([mk('warning', 'a')]).allPass).toBe(false);
    expect(summariseChecks([mk('danger', 'a')]).allPass).toBe(false);
    expect(summariseChecks([]).allPass).toBe(true);
  });

  it('reports the most serious outstanding check first', () => {
    const c = summariseChecks([mk('info', 'i'), mk('warning', 'w'), mk('danger', 'd')]);
    expect(c.firstOutstanding?.id).toBe('d');
    expect(c.outstandingIds).toEqual(['d', 'w', 'i']);
  });

  it('excludes passing checks from the outstanding list', () => {
    const c = summariseChecks([mk('success', 'ok'), mk('info', 'i')]);
    expect(c.outstandingIds).toEqual(['i']);
  });

  describe('headline wording follows the counts', () => {
    it('all clear', () => {
      expect(verdictHeadline(summariseChecks([mk('success', 'a')]))).toBe(
        'All engineering checks pass.',
      );
    });

    it('danger gives hazards', () => {
      const h = verdictHeadline(summariseChecks([mk('danger', 'a'), mk('danger', 'b')]));
      expect(h).toMatch(/2 hazards/);
    });

    it('warning gives limits exceeded', () => {
      const h = verdictHeadline(summariseChecks([mk('warning', 'a')]));
      expect(h).toMatch(/1 limit exceeded/);
    });

    it('info-only says no failures but items need review', () => {
      // This is the exact case the review reported: the dashboard claimed all-clear
      // while the header showed an outstanding review item.
      const h = verdictHeadline(summariseChecks([mk('info', 'a')]));
      expect(h).toMatch(/No failures/);
      expect(h).toMatch(/1 item needs review/);
    });

    it('info is pluralised correctly', () => {
      const h = verdictHeadline(summariseChecks([mk('info', 'a'), mk('info', 'b')]));
      expect(h).toMatch(/2 items need review/);
    });

    it('danger outranks warning outranks info', () => {
      const h = verdictHeadline(summariseChecks([mk('info', 'i'), mk('warning', 'w'), mk('danger', 'd')]));
      expect(h).toMatch(/hazard/);
    });
  });

  it('plural helper is correct', () => {
    expect(plural(1, 'check')).toBe('check');
    expect(plural(2, 'check')).toBe('checks');
    expect(plural(0, 'check')).toBe('checks');
  });
});

describe('item 26: the two components cannot disagree', () => {
  it('the default design yields one consistent verdict', () => {
    const results = calculateFlashDryer(DEFAULT_DRYER_INPUTS);
    const c = summariseChecks(results.checks);
    const headline = verdictHeadline(c);

    // The dashboard renders `verdictHeadline(c)` and the header renders
    // c.danger / c.warning / c.info. Both read the same object, so if the
    // headline says all-clear then all three counts must be zero, and vice versa.
    if (headline === 'All engineering checks pass.') {
      expect(c.danger).toBe(0);
      expect(c.warning).toBe(0);
      expect(c.info).toBe(0);
    } else {
      expect(c.danger + c.warning + c.info).toBeGreaterThan(0);
    }
  });

  it('a design with only info items must not be reported as all-clear', () => {
    // The default design carries a severity `info` check (the air-to-starch ratio
    // above benchmark), which is exactly the contradiction the review found.
    const results = calculateFlashDryer(DEFAULT_DRYER_INPUTS);
    const c = summariseChecks(results.checks);
    const infoOnly = results.checks.filter((x) => x.severity === 'info');
    const dangerCount = results.checks.filter((x) => x.severity === 'danger').length;
    const warningCount = results.checks.filter((x) => x.severity === 'warning').length;

    if (dangerCount === 0 && warningCount === 0 && infoOnly.length > 0) {
      // Exactly the reported case. The verdict must acknowledge the review items.
      expect(c.allPass).toBe(false);
      expect(verdictHeadline(c)).toMatch(/need(s)? review/);
    }
  });
});
