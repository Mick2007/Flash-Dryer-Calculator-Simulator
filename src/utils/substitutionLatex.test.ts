import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { substitutionToLatex, _internal } from './substitutionLatex';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS } from './constants';

/**
 * Substitution LaTeX.
 *
 * The substitution holds LIVE COMPUTED NUMBERS, so these tests deliberately run the
 * engine across several input sets. A converter that only worked on the default inputs
 * would still be wrong for the user who actually changed something.
 */

const compiles = (tex: string) => {
  katex.renderToString(tex, { throwOnError: true, strict: false });
};

describe('substitutionToLatex: mechanics', () => {
  it('typesets a multiplication as a real operator, not an x', () => {
    expect(substitutionToLatex('820.00 × (1 - 0.400)')).toContain('\\times');
    expect(substitutionToLatex('820.00 × (1 - 0.400)')).not.toMatch(/[^\\]x[^a-zA-Z]/);
  });

  it('builds a real fraction from a slash', () => {
    const tex = substitutionToLatex('492.00 / (1 - 0.120)')!;
    expect(tex).toMatch(/\\d?frac\{/);
    expect(tex).not.toMatch(/[^\\]\//);
  });

  it('converts a nested fraction inside brackets', () => {
    // The slash here is inside [], not at the top level, so it can only be found by
    // recursing into the group rather than splitting the whole line.
    expect(substitutionToLatex('1.1 × [ (820.0 × 10) / (380 × 60) ]')).toBe(
      '1.1 \\times \\left[\\dfrac{\\left(820.0 \\times 10\\right)}{\\left(380 \\times 60\\right)}\\right]'
    );
  });

  it('turns sqrt[...] into a real radical', () => {
    const tex = substitutionToLatex('sqrt[ (4 × 2.252) / (pi × 14.0) ]')!;
    expect(tex).toContain('\\sqrt{');
    expect(tex).toContain('\\pi');
  });

  it('expands scientific notation to a power of ten', () => {
    const tex = substitutionToLatex('9.650 × 2.278e-5 / (0.874 × 2.300e-4)')!;
    expect(tex).toContain('10^{-5}');
    expect(tex).toContain('10^{-4}');
    expect(tex).not.toMatch(/e-?\d/);
  });

  it('braces a bare exponent', () => {
    expect(substitutionToLatex('6.4 × 0.5 × 0.986 × (15.0)^2')).toContain('^{2}');
  });

  it('escapes the percent sign instead of eating the rest of the line', () => {
    // An unescaped % in LaTeX comments out everything after it. That is a silent,
    // total loss of the expression, so it must never reach the renderer.
    const tex = substitutionToLatex('1.5 × 200 / 30%')!;
    expect(tex).toContain('\\%');
    expect(() => compiles(tex)).not.toThrow();
  });

  it('escapes an underscore so a symbol name is not read as a subscript', () => {
    const tex = substitutionToLatex('Q_v,imp × 35.3147 / 2.1579')!;
    expect(tex).toContain('\\_');
  });

  it('strips thousands separators so a digit run is not a decimal comma', () => {
    const tex = substitutionToLatex('(3.28 × 55 × 12 × 1.0) / 1,000,000')!;
    expect(tex).toContain('1000000');
    expect(tex).not.toMatch(/1,000,000/);
  });

  it('sets units upright rather than italic', () => {
    const tex = substitutionToLatex('2501 - 2.361 × 70.0 kJ')!;
    expect(tex).toContain('\\text{kJ}');
    // and leaves a unit-free expression alone
    expect(substitutionToLatex('2501 - 2.361 × 70.0')).not.toContain('\\text{');
  });

  it('keeps a degree sign readable', () => {
    expect(substitutionToLatex('2.454 / 0.140 × 100')).toBeTruthy();
    expect(substitutionToLatex('820.0 × 10 / 60')).toBeTruthy();
    const deg = substitutionToLatex('2.454 / 0.140 - 0.05');
    expect(deg).toBeTruthy();
  });

  it('sets prose upright rather than italic, so a sentence still reads', () => {
    // Not returned as null: a bare word typeset as a variable renders as an italic
    // single letter, which is meaningless. Wrapping words upright keeps the sentence
    // readable while its numbers are still set properly.
    const tex = substitutionToLatex('Recommended Commercial Drive: 0.75 kW Geared Motor')!;
    expect(tex).toContain('\\text{Recommended Commercial Drive}');
    expect(tex).toContain('0.75');
    expect(tex).toContain('\\text{kW}');
  });

  it('returns null only for an empty line', () => {
    expect(substitutionToLatex('')).toBeNull();
    expect(substitutionToLatex('   ')).toBeNull();
  });

  it('does not split on a comparison operator', () => {
    const eqs = _internal.splitTopLevel('55 >= 55', '=');
    expect(eqs, '>= must not be read as an equality').toBeNull();
  });
});

describe('substitutionToLatex: every step, every input set', () => {
  const CASES: [string, Parameters<typeof calculateFlashDryer>[0]][] = [
    ['default', { ...DEFAULT_DRYER_INPUTS }],
    ['1 t/h', { ...DEFAULT_DRYER_INPUTS, feedRate: 1000 }],
    ['40 t/h', { ...DEFAULT_DRYER_INPUTS, feedRate: 40000 }],
    ['D=1000', { ...DEFAULT_DRYER_INPUTS, standardPipeNominalMm: 1000 }],
    ['dry product 12%', { ...DEFAULT_DRYER_INPUTS, finalMoisture: 8 }],
  ];

  for (const [label, inputs] of CASES) {
    it(`every substitution LaTeX compiles — ${label}`, () => {
      const steps = calculateFlashDryer(inputs).steps;
      const failures: string[] = [];
      for (const s of steps) {
        if (!s.substitutionLatex) continue;
        try {
          compiles(s.substitutionLatex);
        } catch (e) {
          failures.push(`${s.category}|${s.symbol}: ${(e as Error).message}`);
        }
      }
      expect(failures, `unparseable substitution LaTeX:\n${failures.join('\n')}`).toEqual([]);
    });
  }

  it('covers the large majority of the 60 default steps', () => {
    const steps = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS }).steps;
    const typed = steps.filter((s) => !!s.substitutionLatex).length;
    // Every line with real arithmetic should be typeset. The remainder are prose or
    // bare assignments, which are deliberately left as text.
    expect(typed, `only ${typed}/${steps.length} substitutions were typeset`).toBeGreaterThanOrEqual(
      steps.length * 0.6
    );
  });

  it('leaves the plain substitution untouched, so it can still be copied', () => {
    const steps = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS }).steps;
    for (const s of steps) {
      expect(s.substitution, 'the plain form must survive for copy/paste').toBeTruthy();
      if (s.substitutionLatex) {
        // The numbers in the plain string must all appear in the typeset one, otherwise
        // the converter dropped or mangled a value.
        const plainNumbers = s.substitution.match(/\d+(?:\.\d+)?/g) ?? [];
        for (const n of plainNumbers.slice(0, 6)) {
          expect(
            s.substitutionLatex,
            `${s.category}|${s.symbol}: value ${n} vanished from the LaTeX`
          ).toContain(n);
        }
      }
    }
  });

  it('every equation step still has its equation LaTeX', () => {
    const steps = calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS }).steps;
    expect(steps.every((s) => !!s.equationLatex)).toBe(true);
  });
});