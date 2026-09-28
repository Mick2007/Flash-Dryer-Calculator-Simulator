import { describe, it, expect } from 'vitest';
import { generateEngineeringPdf, cleanPdfText } from './pdfGenerator';
import { calculateFlashDryer } from './dryerCalculations';
import { DEFAULT_DRYER_INPUTS, CIRAD_BENCHMARKS } from './constants';
import type { DryerInputs } from '../types/dryer';
import type { jsPDF } from 'jspdf';

const base = (patch: Partial<DryerInputs> = {}): DryerInputs => ({ ...DEFAULT_DRYER_INPUTS, ...patch });

/**
 * Extracts every string the report actually drew, with its position, font and
 * size, by parsing the content streams of the finished PDF.
 *
 * Two approaches were tried. Patching the jsPDF prototype to intercept doc.text
 * does not work here: the generator loads the library with a dynamic
 * `await import('jspdf')` while the test imports it statically, and those resolve
 * to SEPARATE module instances, so the patch never sees the drawing calls and
 * every captured string comes back empty. Parsing the output is immune to that.
 *
 * jsPDF writes content streams UNCOMPRESSED by default, so the text operators are
 * directly readable. A drawn line looks like:
 *
 *     /F1 9 Tf              <- font and size, in points
 *     BT
 *     56.69 756.85 Td      <- x y, in points
 *     (some text) Tj
 *     ET
 *
 * Positions are in PDF points, not the millimetres the generator works in, so the
 * overflow check converts: 1 mm = 72/25.4 points.
 */
interface DrawnEntry { xPt: number; yPt: number; text: string; font: string; sizePt: number }

const MM_TO_PT = 72 / 25.4;

function unescapePdfString(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '\\') { out += s[i]; continue; }
    const next = s[++i];
    if (next === 'n') out += '\n';
    else if (next === 'r') out += '\r';
    else if (next === 't') out += '\t';
    else if (next >= '0' && next <= '7') {
      let oct = next;
      while (oct.length < 3 && s[i + 1] >= '0' && s[i + 1] <= '7') oct += s[++i];
      out += String.fromCharCode(parseInt(oct, 8));
    } else out += next;
  }
  return out;
}

function extractDrawnText(doc: jsPDF): DrawnEntry[] {
  const raw = Buffer.from(doc.output('arraybuffer')).toString('latin1');
  const out: DrawnEntry[] = [];
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g;
  let m: RegExpExecArray | null;
  while ((m = streamRe.exec(raw)) !== null) {
    const body = m[1];
    if (!body.includes('Tj') && !body.includes('TJ')) continue;

    let font = 'helvetica';
    let sizePt = 10;
    let xPt = 0;
    let yPt = 0;
    // Walk the stream in order so font, size and position are current at the
    // moment a string is read, rather than assuming defaults.
    const tokenRe = /\/(\S+)\s+([\d.]+)\s+Tf|([-\d.]+)\s+([-\d.]+)\s+Td|\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\]\\]|\\.)*)\]\s*TJ/g;
    let t: RegExpExecArray | null;
    while ((t = tokenRe.exec(body)) !== null) {
      if (t[1] !== undefined) {
        font = t[1];
        sizePt = Number(t[2]);
      } else if (t[3] !== undefined) {
        xPt = Number(t[3]);
        yPt = Number(t[4]);
      } else if (t[5] !== undefined) {
        out.push({ xPt, yPt, text: unescapePdfString(t[5]), font, sizePt });
      } else if (t[6] !== undefined) {
        const parts = t[6].match(/\((?:[^()\\]|\\.)*\)/g) ?? [];
        const text = parts.map((p) => unescapePdfString(p.slice(1, -1))).join('');
        if (text.trim()) out.push({ xPt, yPt, text, font, sizePt });
      }
    }
  }
  return out;
}

/** Generate the report and read back everything it drew. */
async function renderCaptured(patch: Partial<DryerInputs> = {}): Promise<{ doc: jsPDF; drawn: DrawnEntry[] }> {
  const doc = await generateEngineeringPdf(calculateFlashDryer(base(patch)));
  return { doc, drawn: extractDrawnText(doc) };
}
describe('item 21: PDF text contains no characters above U+00FF', () => {
  it('the specific cases from the review are transliterated', () => {
    // "₂" in kJ/kg H2O and "−" in Negative pressure (-) were rendering as
    // garbled letter-spaced text, because neither has a Latin-1 glyph.
    expect(cleanPdfText('kJ/kg H₂O')).toBe('kJ/kg H2O');
    expect(cleanPdfText('Negative pressure (−)')).toBe('Negative pressure (-)');
  });

  it('handles subscripts, superscripts, Greek, units and ligatures', () => {
    const cases: Array<[string, string]> = [
      ['H₂O', 'H2O'],
      ['H₃PO₄', 'H3PO4'],
      ['x² + y³', 'x^2 + y^3'],
      ['ΔP', 'Delta_P'],
      ['π', 'pi'],
      ['µm', 'um'],
      ['≥ 20 m', '>= 20 m'],
      ['≤ 5 m', '<= 5 m'],
      ['ﬁnal', 'final'],
    ];
    for (const [input, expected] of cases) {
      expect(cleanPdfText(input), input).toBe(expected);
    }
  });

  it('anything unanticipated degrades to a visible placeholder, not a blank', () => {
    // The generic fallback. A dropped glyph is worse than a '?' because the reader
    // cannot tell a missing character from an intentional omission.
    expect(cleanPdfText('日本')).toBe('??');
    // And nothing survives above U+00FF.
    for (const s of ['日本語', 'Ω ≈ ±', 'café', '⅓']) {
      const bad = [...cleanPdfText(s)].filter((c) => c.codePointAt(0)! > 0xff);
      expect(bad, s).toEqual([]);
    }
  });

  it('the default report draws nothing above U+00FF', async () => {
    const { drawn } = await renderCaptured();
    expect(drawn.length).toBeGreaterThan(50);
    const offenders: string[] = [];
    for (const e of drawn) {
      for (const ch of e.text) {
        if (ch.codePointAt(0)! > 0xff) {
          offenders.push(
            `${ch} (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}) in "${e.text.slice(0, 60)}"`,
          );
        }
      }
    }
    expect(offenders.slice(0, 10), `${offenders.length} offending characters`).toEqual([]);
  });

  it('three further input sets also draw clean text', async () => {
    const variants: Array<[string, Partial<DryerInputs>]> = [
      ['high moisture', { initialMoisture: 47, finalMoisture: 10 }],
      ['hot and humid', { ambientTemp: 38, ambientRH: 88, inletAirTemp: 210 }],
      ['large capacity', { capacityMode: 'product', desiredProductRate: 4500 }],
    ];
    for (const [label, patch] of variants) {
      const { drawn } = await renderCaptured(patch);
      const offenders: string[] = [];
      for (const e of drawn) {
        for (const ch of e.text) {
          if (ch.codePointAt(0)! > 0xff) offenders.push(`${label}: ${ch} in "${e.text.slice(0, 50)}"`);
        }
      }
      expect(offenders.slice(0, 5), label).toEqual([]);
    }
  });
});

/** ITEM 22: no drawn line may cross the content right edge. */
describe('item 22: no drawn line overflows the content right edge', () => {
  const MARGIN_MM = 14;
  const PAGE_WIDTH_MM = 210;
  const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - 2 * MARGIN_MM;
  const RIGHT_EDGE_MM = MARGIN_MM + CONTENT_WIDTH_MM;

  it('every line drawn on the default report fits within the content width', async () => {
    const { doc, drawn } = await renderCaptured();
    expect(drawn.length).toBeGreaterThan(50);

    const rightEdgePt = RIGHT_EDGE_MM * MM_TO_PT;
    const overflowing: string[] = [];
    for (const e of drawn) {
      // Measure with the font size the line was actually DRAWN in, which the parse
      // recovered from the stream's Tf operator. Measuring with an arbitrary size
      // would miss the defect: the whole point is that a line wrapped for one size
      // can overflow when drawn in a larger one.
      doc.setFontSize(e.sizePt);
      const widthPt = doc.getTextWidth(e.text) || 0;
      const endPt = e.xPt + widthPt;
      if (endPt > rightEdgePt + 1) {
        overflowing.push(
          `"${e.text.slice(0, 50)}" ${e.sizePt}pt at x=${(e.xPt / MM_TO_PT).toFixed(1)}mm ends ` +
            `${(endPt / MM_TO_PT).toFixed(1)}mm > ${RIGHT_EDGE_MM}mm`,
        );
      }
    }
    expect(overflowing.slice(0, 10), `${overflowing.length} overflowing lines`).toEqual([]);
  });

  it('the check block wraps within its own narrower box', async () => {
    // The checks are indented 2.5 mm inside the margin, so their right edge is
    // the content edge minus that inset. This is the block that overflowed on
    // page 10 of the default report.
    const { doc, drawn } = await renderCaptured();
    // Check titles begin with the bracketed category, which is how they are
    // identified in the drawn output.
    const checkText = drawn.filter((e) => /\[[A-Z ]+\]/.test(e.text));
    expect(checkText.length, 'the check block must be drawn').toBeGreaterThan(0);

    const rightEdgePt = RIGHT_EDGE_MM * MM_TO_PT;
    const worst: string[] = [];
    for (const e of checkText) {
      doc.setFontSize(e.sizePt);
      const endPt = e.xPt + (doc.getTextWidth(e.text) || 0);
      if (endPt > rightEdgePt + 1) {
        worst.push(`"${e.text.slice(0, 60)}" ends ${(endPt / MM_TO_PT).toFixed(1)}mm`);
      }
    }
    expect(worst.slice(0, 5)).toEqual([]);
  });

  it('a deliberately unwrapped long string would be detected', async () => {
    // Guard on the guard: prove the overflow check can fail. Measure a long
    // unwrapped line and confirm it reads as overflowing.
    const { doc } = await renderCaptured();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    const long = 'X'.repeat(400);
    const endMm = MARGIN_MM + 2.5 + (doc.getTextWidth(long) || 0) / MM_TO_PT;
    expect(endMm).toBeGreaterThan(RIGHT_EDGE_MM);
  });
});

/** ITEM 23: the airlock size in the PDF matches the engine. */
describe('item 23: the PDF states the computed airlock size', () => {
  it('does not contain the old hardcoded 150 mm rotor', async () => {
    const { drawn } = await renderCaptured();
    const all = drawn.map((e) => e.text).join('\n');
    expect(all).not.toContain('150 mm / 6-inch rotor');
  });

  it('states the engine airlock diameter, with the spigot it came from', async () => {
    const results = calculateFlashDryer(base());
    const { drawn } = await renderCaptured();
    // The cell is NARROW, so the string wraps mid-phrase: the drawn output
    // contains "Size: 500 mm rotor (from Ø469" and then "mm spigot)" on the next
    // line. Joining the drawn fragments reconstructs the cell text.
    const all = drawn.map((e) => e.text).join(' ').replace(/\s+/g, ' ');
    expect(all).toContain(`${results.dimensions.airlockDiameterMm} mm rotor`);
    expect(all).toContain(
      `Ø${results.dimensions.cycloneDustOutletDiameterMm} mm spigot`,
    );
  });

  it('the rotor is never smaller than the spigot', () => {
    for (const d of [
      calculateFlashDryer(base()),
      calculateFlashDryer(base({ capacityMode: 'product', desiredProductRate: 300 })),
      calculateFlashDryer(base({ capacityMode: 'product', desiredProductRate: 5000 })),
    ]) {
      expect(d.dimensions.airlockDiameterMm).toBeGreaterThanOrEqual(
        d.dimensions.cycloneDustOutletDiameterMm,
      );
    }
  });
});

/** ITEM 24: benchmark text must come from CIRAD_BENCHMARKS, not be typed in. */
describe('item 24: benchmark ranges are not hardcoded in the PDF', () => {
  it('the PDF quotes the same velocity band the checks apply', async () => {
    const { drawn } = await renderCaptured();
    const all = drawn.map((e) => e.text).join('\n');
    const { recommendedAirVelocityMinMperS: vMin, recommendedAirVelocityMaxMperS: vMax } = CIRAD_BENCHMARKS;
    expect(all).toContain(`CIRAD conveying range: ${vMin.toFixed(0)} - ${vMax.toFixed(0)} m/s`);
    // The stale 12 - 15 band must not appear as a live label.
    expect(all).not.toContain('CIRAD optimal transport velocity: 12 - 15 m/s');
  });

  it('the PDF velocity band equals the band the velocity check recommends', async () => {
    const results = calculateFlashDryer(base());
    const { drawn } = await renderCaptured();
    // Joined with a space and re-normalised: these cells are narrow, so phrases
    // wrap mid-string and a naive join('\n') would split them.
    const all = drawn.map((e) => e.text).join(' ').replace(/\s+/g, ' ');
    const velCheck = results.checks.find((c) => c.id.startsWith('chk-vel-'));
    expect(velCheck, 'a velocity check must exist').toBeDefined();
    // The check's recommended range and the inputs table must state the same band.
    expect(velCheck!.recommendedRange).toContain(
      CIRAD_BENCHMARKS.recommendedAirVelocityMinMperS.toFixed(1),
    );
    expect(velCheck!.recommendedRange).toContain(
      CIRAD_BENCHMARKS.recommendedAirVelocityMaxMperS.toFixed(1),
    );
    expect(all).toContain('CIRAD conveying range');
  });

  it('the developed-length rule in the PDF matches CIRAD_BENCHMARKS', async () => {
    const { drawn } = await renderCaptured();
    // The dimension column is 45 mm, so this note wraps over several lines. Join
    // with a space and re-normalise to reconstruct the wrapped cell text.
    const all = drawn.map((e) => e.text).join(' ').replace(/\s+/g, ' ');
    expect(all).toContain(
      `CIRAD L >= ${CIRAD_BENCHMARKS.minDevelopedPipeLengthM.toFixed(0)} m rule`,
    );
  });

  it('the source file contains no hardcoded velocity or ratio ranges', () => {
    // Read the source and strip comments, so this checks live code, not prose.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = require('node:fs').readFileSync(
      require('node:path').join(process.cwd(), 'src/utils/pdfGenerator.ts'),
      'utf8',
    ) as string;
    const codeOnly = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/12\s*-\s*15/);
    expect(codeOnly).not.toMatch(/9\s*-\s*11/);
    expect(codeOnly).not.toMatch(/recommendedRange:\s*['"`]\s*1[0-9]\s*-\s*1[0-9]\s*m\/s/);
  });
});
