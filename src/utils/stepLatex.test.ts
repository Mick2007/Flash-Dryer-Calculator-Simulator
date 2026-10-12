import { describe, it, expect } from 'vitest';
import katex from 'katex';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS, CIRAD_PILOT_BENCHMARK, IITA_REFERENCE_BENCHMARK } from './constants';
import { allLatexKeys, latexForStep, allInlineLatexKeys, INLINE_LATEX } from './stepLatex';

/**
 * LATEX COVERAGE AND VALIDITY
 *
 * The typeset equations live in a lookup table keyed by `category|symbol`, joined
 * to the engine in `addStep`. A table like that fails in one specific way: a new
 * step is added to the engine and silently has no LaTeX, so the reader sees
 * plain text in a page that is otherwise typeset, and nobody notices because
 * plain text still renders.
 *
 * So the guarantee has to be mechanical rather than visual. These tests assert
 * that every step the engine emits for the reference designs has an entry, that
 * every entry actually compiles under KaTeX, and that no entry is orphaned.
 */

const DESIGNS: Array<{ label: string; inputs: typeof DEFAULT_DRYER_INPUTS }> = [
  { label: 'Default (IITA)', inputs: DEFAULT_DRYER_INPUTS },
  { label: 'CIRAD pilot', inputs: { ...DEFAULT_DRYER_INPUTS, ...CIRAD_PILOT_BENCHMARK } },
  { label: 'IITA benchmark', inputs: IITA_REFERENCE_BENCHMARK },
];

describe('every derivation step has a LaTeX form', () => {
  for (const { label, inputs } of DESIGNS) {
    it(`${label}: all steps resolve to a LaTeX expression`, () => {
      const steps = calculateFlashDryer(inputs).steps;
      const missing = steps
        .filter((s) => !s.equationLatex)
        .map((s) => `${s.category}|${s.symbol} (${s.parameterName})`);
      expect(
        missing,
        `these steps would render as plain text: \n  ${missing.join('\n  ')}`,
      ).toEqual([]);
    });
  }

  it('covers every step across a wide input sweep, not just the defaults', () => {
    // Different moisture, temperature, capacity and capacityMode produce
    // different values but the same step set. If a branch ever adds a step
    // without LaTeX, this is where it surfaces.
    const missing: string[] = [];
    for (const feedRate of [10, 500, 820, 5000]) {
      for (const initialMoisture of [12, 40, 75]) {
        for (const inletAirTemp of [110, 180, 250]) {
          const steps = calculateFlashDryer({
            ...DEFAULT_DRYER_INPUTS,
            feedRate,
            initialMoisture,
            finalMoisture: Math.min(11, initialMoisture - 2),
            inletAirTemp,
            outletAirTemp: Math.min(inletAirTemp - 20, 95),
          }).steps;
          for (const s of steps) if (!s.equationLatex) missing.push(`${s.category}|${s.symbol}`);
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });
});

describe('every LaTeX expression compiles', () => {
  it('KaTeX renders all of them without error', () => {
    const broken: string[] = [];
    for (const key of allLatexKeys()) {
      const tex = LATEX_SAMPLE[key];
      try {
        const html = katex.renderToString(tex, { displayMode: true, throwOnError: true, strict: false });
        // A silent no-op would still "compile"; require real output.
        if (!html || html.length < 20) broken.push(`${key} -> empty output`);
      } catch (e) {
        broken.push(`${key} -> ${(e as Error).message}`);
      }
    }
    expect(broken, `KaTeX could not render:\n  ${broken.join('\n  ')}`).toEqual([]);
  });

  it('produces no undefined control sequences in the rendered output', () => {
    // KaTeX renders an unknown macro as a red "\text{ParseError}" or leaves the
    // raw backslash command visible. catch it here rather than in the page.
    for (const key of allLatexKeys()) {
      const html = katex.renderToString(LATEX_SAMPLE[key], { displayMode: true, throwOnError: true, strict: false });
      expect(html, `${key} rendered a parse error`).not.toContain('ParseError');
    }
  });

  it('compiles the inline card LaTeX used by DimensionCalculator', () => {
    // The nine cyclone cards in DimensionCalculator never pass through addStep —
    // they build their formula strings in JSX — so their LaTeX lives in a
    // separate table and needs its own compile check.
    const keys = allInlineLatexKeys();
    expect(keys.length, 'expected the nine cyclone card equations').toBe(9);
    for (const key of keys) {
      const html = katex.renderToString(INLINE_LATEX[key], { displayMode: false, throwOnError: true, strict: false });
      expect(html.length, `${key} rendered empty`).toBeGreaterThan(20);
      expect(html, `${key} rendered a parse error`).not.toContain('ParseError');
    }
  });
});

describe('the LaTeX table has no orphans', () => {
  it('every key corresponds to a step the engine actually emits', () => {
    // Guards against a renamed symbol leaving a dead entry behind, which would
    // otherwise read as coverage that does not exist.
    const live = new Set<string>();
    for (const { inputs } of DESIGNS) {
      for (const s of calculateFlashDryer(inputs).steps) live.add(`${s.category}|${s.symbol}`);
    }
    const orphans = allLatexKeys().filter((k) => !live.has(k));
    expect(orphans, `these LaTeX entries match no step: ${orphans.join(', ')}`).toEqual([]);
  });
});

// Resolved from the shipped table so the compile test exercises exactly what the
// app renders, rather than a hand-copied duplicate that could itself drift.
const LATEX_SAMPLE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const key of allLatexKeys()) {
    const [category, symbol] = key.split('|');
    const tex = latexForStep(category, symbol);
    if (tex) out[key] = tex;
  }
  return out;
})();
