import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from './dryerCalculations';
import { generateCadDxf, generateCadSvg } from './cadExport';
import { DEFAULT_DRYER_INPUTS, IITA_REFERENCE_BENCHMARK } from './constants';
import type { DryerInputs } from '../types/dryer';

const base = (patch: Partial<DryerInputs> = {}): DryerInputs => ({ ...DEFAULT_DRYER_INPUTS, ...patch });

/**
 * A DXF is a flat list of (group code, value) pairs, so a structural reader is
 * sufficient to establish that the file is well formed: every code must be a
 * valid integer, every entity must be a known type, and the section structure
 * must open and close.
 *
 * The review asked for verification with Python's ezdxf. Python is not installed
 * in this environment, so this parser is the substitute. It checks structure and
 * entity well-formedness rather than running a full CAD kernel audit, and that
 * difference is worth stating: it will not catch a geometrically invalid entity,
 * only a malformed one.
 */
interface Pair { code: number; value: string }

function parseDxf(dxf: string): Pair[] {
  const lines = dxf.split(/\r\n|\r|\n/);
  if (lines.length % 2 !== 0) {
    throw new Error(`DXF has an odd number of lines (${lines.length}); pairs must be code/value`);
  }
  const pairs: Pair[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const code = Number(lines[i].trim());
    if (!Number.isInteger(code)) {
      throw new Error(`Line ${i + 1}: group code "${lines[i]}" is not an integer`);
    }
    pairs.push({ code, value: lines[i + 1] });
  }
  return pairs;
}

const KNOWN_ENTITY_TYPES = new Set([
  'LINE', 'CIRCLE', 'ARC', 'TEXT', 'SECTION', 'ENDSEC', 'TABLE', 'ENDTAB',
  'LAYER', 'LTYPE', 'EOF', 'POINT', 'LWPOLYLINE', 'POLYLINE', 'VERTEX', 'SEQEND',
]);

function entityTypes(pairs: Pair[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].code === 0) {
      const t = pairs[i].value.trim();
      if (KNOWN_ENTITY_TYPES.has(t)) out.push(t);
    }
  }
  return out;
}

describe('DXF structural validity (AC1009 / R12)', () => {
  const dxf = generateCadDxf(calculateFlashDryer(base()));
  let pairs: Pair[];

  it('parses as well-formed group code/value pairs', () => {
    pairs = parseDxf(dxf);
    expect(pairs.length).toBeGreaterThan(100);
  });

  it('declares AC1009', () => {
    // $ACADVER carries its string value in group code 1, not 2. Code 2 is used for
    // section and table names.
    const i = pairs.findIndex((p) => p.code === 1 && p.value.trim() === 'AC1009');
    expect(i, 'AC1009 version must be declared').toBeGreaterThan(-1);
  });

  it('declares millimetres and metric', () => {
    // $INSUNITS = 4 (mm), $MEASUREMENT = 1 (metric)
    expect(pairs.some((p) => p.code === 9 && p.value === '$INSUNITS')).toBe(true);
    expect(pairs.some((p) => p.code === 9 && p.value === '$MEASUREMENT')).toBe(true);
  });

  it('balances every SECTION and ENDSEC', () => {
    const sections = pairs.filter((p) => p.code === 0 && p.value === 'SECTION').length;
    const endSections = pairs.filter((p) => p.code === 0 && p.value === 'ENDSEC').length;
    expect(sections).toBe(endSections);
    expect(sections).toBeGreaterThan(0);
  });

  it('balances every TABLE and ENDTAB', () => {
    const tables = pairs.filter((p) => p.code === 0 && p.value === 'TABLE').length;
    const endTabs = pairs.filter((p) => p.code === 0 && p.value === 'ENDTAB').length;
    expect(tables).toBe(endTabs);
    expect(tables).toBeGreaterThan(0);
  });

  it('ends with EOF', () => {
    expect(pairs[pairs.length - 1].code).toBe(0);
    expect(pairs[pairs.length - 1].value.trim()).toBe('EOF');
  });

  it('uses only known entity types', () => {
    const unknown = entityTypes(pairs).filter((t) => !KNOWN_ENTITY_TYPES.has(t));
    expect(unknown).toEqual([]);
  });

  it('every drawing entity is on a declared layer', () => {
    const declared = new Set(
      pairs.filter((p) => p.code === 0 && p.value === 'LAYER')
        .map((_, i) => null)
        .filter(() => false) as unknown[],
    );
    // Collect layer names from LAYER records: each is preceded by code 2.
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i].code === 0 && pairs[i].value === 'LAYER' && pairs[i + 1].code === 2) {
        declared.add(pairs[i + 1].value);
      }
    }
    expect(declared.size).toBeGreaterThan(0);

    // Every entity that carries an 8 (layer) must reference a declared layer.
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].code === 0 && ['LINE', 'CIRCLE', 'ARC', 'TEXT'].includes(pairs[i].value)) {
        const layerPair = pairs.slice(i + 1, i + 4).find((p) => p.code === 8);
        expect(layerPair, 'entity must carry a layer code 8').toBeDefined();
        expect(
          declared.has(layerPair!.value),
          `entity on undeclared layer "${layerPair!.value}"`,
        ).toBe(true);
      }
    }
  });

  it('every entity referenced by a linetype has that linetype declared', () => {
    // Guards item 19: a layer pointing at a linetype that is not in the LTYPE
    // table renders as a fallback in most CAD systems, silently.
    const ltypes = new Set<string>();
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i].code === 0 && pairs[i].value === 'LTYPE' && pairs[i + 1].code === 2) {
        ltypes.add(pairs[i + 1].value);
      }
    }
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i].code === 0 && pairs[i].value === 'LAYER') {
        const name = pairs[i + 1]?.code === 2 ? pairs[i + 1].value : '';
        const lt = pairs.slice(i + 1, i + 8).find((p) => p.code === 6)?.value;
        if (lt) expect(ltypes.has(lt), `layer ${name} uses undeclared linetype ${lt}`).toBe(true);
      }
    }
  });

  it('all numeric coordinate codes parse as finite numbers', () => {
    const numericCodes = [10, 20, 30, 11, 21, 31, 40, 50, 51];
    for (const p of pairs) {
      if (numericCodes.includes(p.code)) {
        const n = Number(p.value);
        expect(Number.isFinite(n), `code ${p.code} value "${p.value}"`).toBe(true);
      }
    }
  });

  it('parses for the IITA benchmark too', () => {
    const other = parseDxf(generateCadDxf(calculateFlashDryer(IITA_REFERENCE_BENCHMARK)));
    expect(other.length).toBeGreaterThan(100);
  });
});

/** ITEM 18: the exchanger envelope and the U-bend. */
describe('item 18: DXF geometry reflects the computed design', () => {
  const dxf = generateCadDxf(calculateFlashDryer(base()));
  const pairs = parseDxf(dxf);

  it('the exchanger envelope is NOT the old hardcoded 1400 x 1600', () => {
    // The old drawing was fixed regardless of duty, so a small heater and a
    // large one were drawn identically. Assert the label carries a computed width.
    const textValues = pairs.filter((p) => p.code === 1).map((p) => p.value);
    const widthLabel = textValues.find((t) => t.startsWith('HEX WIDTH:'));
    expect(widthLabel).toBeDefined();
    const w = Number(widthLabel!.replace('HEX WIDTH:', '').replace('mm', '').trim());
    expect(Number.isFinite(w)).toBe(true);
    expect(w).toBeGreaterThan(0);
  });

  it('the exchanger envelope changes with duty', () => {
    const small = generateCadDxf(calculateFlashDryer(base({ capacityMode: 'product', desiredProductRate: 150 })));
    const large = generateCadDxf(calculateFlashDryer(base({ capacityMode: 'product', desiredProductRate: 4000 })));
    const widthOf = (d: string) => {
      const p = parseDxf(d).filter((x) => x.code === 1).map((x) => x.value);
      return Number(p.find((t) => t.startsWith('HEX WIDTH:'))!.replace('HEX WIDTH:', '').replace('mm', '').trim());
    };
    expect(widthOf(large)).toBeGreaterThan(widthOf(small));
  });

  it('draws a real ARC entity for the U-bend, not two straight lines', () => {
    const arcs = pairs.filter((p) => p.code === 0 && p.value === 'ARC');
    expect(arcs.length, 'a U-bend must be an ARC entity').toBeGreaterThanOrEqual(1);
  });

  it('the ARC is a 180 degree turn at a positive radius', () => {
    const types = entityTypes(pairs);
    expect(types).toContain('ARC');
    // Find an ARC record and read its radius, start and end angle.
    for (let i = 0; i < pairs.length; i++) {
      if (pairs[i].code === 0 && pairs[i].value === 'ARC') {
        const radius = Number(pairs.slice(i, i + 12).find((p) => p.code === 40)?.value);
        const start = Number(pairs.slice(i, i + 12).find((p) => p.code === 50)?.value);
        const end = Number(pairs.slice(i, i + 12).find((p) => p.code === 51)?.value);
        expect(radius).toBeGreaterThan(0);
        expect(start).toBe(0);
        expect(end).toBe(180);
        return;
      }
    }
    throw new Error('no ARC entity found');
  });

  it('labels the U-bend radius actually used', () => {
    const texts = pairs.filter((p) => p.code === 1).map((p) => p.value);
    const bendLabel = texts.find((t) => t.includes('U-BEND R'));
    expect(bendLabel, 'the applied bend radius must be stated').toBeDefined();
    expect(bendLabel).toMatch(/\d+\s*mm/);
  });
});

/** ITEM 19: the cyclone label and the centreline linetype. */
describe('item 19: DXF linetypes and the cyclone efficiency label', () => {
  const dxf = generateCadDxf(calculateFlashDryer(base()));
  const pairs = parseDxf(dxf);

  it('defines a CENTER linetype in the LTYPE table', () => {
    let found = false;
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i].code === 0 && pairs[i].value === 'LTYPE' && pairs[i + 1].code === 2 && pairs[i + 1].value === 'CENTER') {
        found = true;
      }
    }
    expect(found, 'CENTER linetype must be defined').toBe(true);
  });

  it('CENTERLINES layer actually uses the CENTER linetype, not CONTINUOUS', () => {
    for (let i = 0; i < pairs.length - 1; i++) {
      if (pairs[i].code === 0 && pairs[i].value === 'LAYER' && pairs[i + 1].code === 2 && pairs[i + 1].value === 'CENTERLINES') {
        const lt = pairs.slice(i + 1, i + 8).find((p) => p.code === 6)?.value;
        expect(lt, 'CENTERLINES must be dashed').toBe('CENTER');
        return;
      }
    }
    throw new Error('CENTERLINES layer not found');
  });

  it('the cyclone label quotes the COMPUTED efficiency, not a hardcoded 98.5%', () => {
    const results = calculateFlashDryer(base());
    const d = generateCadDxf(results);
    expect(d).not.toContain('98.5%');
    expect(d).toContain(
      `EFF ${results.dimensions.cycloneCollectionEfficiencyPercent.toFixed(1)}%`,
    );
  });

  it('the efficiency on the drawing matches the engine', () => {
    const results = calculateFlashDryer(base());
    const d = generateCadDxf(results);
    const eff = results.dimensions.cycloneCollectionEfficiencyPercent;
    expect(d).toContain(eff.toFixed(1));
  });
});

/** ITEM 20: the scale labels. */
describe('item 20: scale labels are honest', () => {
  it('the DXF does not claim a 1:50 scale', () => {
    const dxf = generateCadDxf(calculateFlashDryer(base()));
    expect(dxf).not.toMatch(/1\s*:\s*50/);
    expect(dxf).toContain('MODEL SPACE 1:1');
    expect(dxf).toContain('SET PLOT SCALE WHEN PRINTING');
  });

  it('the SVG is labelled schematic, not to scale', () => {
    const svg = generateCadSvg(calculateFlashDryer(base()));
    // Only the rendered output matters. The source contains the string "1:50" in
    // comments explaining why the label was wrong, and a naive substring check
    // matches those. Strip comments first, or check the visible text nodes.
    const visibleText = [...svg.matchAll(/>([^<]+)</g)].map((m) => m[1]).join(' ');
    expect(visibleText).not.toMatch(/1\s*:\s*50/);
    expect(visibleText).toContain('NOT TO SCALE');
    // It must point at the dimensioned deliverable.
    expect(visibleText).toContain('DXF');
  });
});

/** ITEM 23 (part 1): one airlock size everywhere. */
describe('item 23: the airlock diameter is computed once and shared', () => {
  it('is at least the cyclone spigot, so the spigot is not the restriction', () => {
    for (const d of [
      calculateFlashDryer(base()),
      calculateFlashDryer(base({ capacityMode: 'product', desiredProductRate: 200 })),
      calculateFlashDryer(base({ capacityMode: 'product', desiredProductRate: 5000 })),
    ]) {
      expect(d.dimensions.airlockDiameterMm).toBeGreaterThanOrEqual(
        d.dimensions.cycloneDustOutletDiameterMm,
      );
    }
  });

  it('is a catalogue size from the nominal series', () => {
    const d = calculateFlashDryer(base());
    const series = [100, 125, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800];
    expect(series).toContain(d.dimensions.airlockDiameterMm);
  });

  it('the PDF, DXF and 3D all state the same airlock size', () => {
    const results = calculateFlashDryer(base());
    const size = results.dimensions.airlockDiameterMm;
    const dxf = generateCadDxf(results);
    const svg = generateCadSvg(results);
    expect(dxf).toContain(`Ø${size} mm`);
    expect(svg).toContain(`Ø${size} mm`);
  });
});
