/**
 * Converts the plain-text `substitution` string of a calculation step into LaTeX.
 *
 * WHY A CONVERTER AND NOT A LOOKUP TABLE
 *
 * The equation table in `stepLatex.ts` is keyed by symbol and holds SYMBOLIC LaTeX
 * (`D_c = \sqrt{...}`), so a hand-written entry cannot go stale. The substitution is the
 * opposite: it holds LIVE COMPUTED NUMBERS — `820.00 x (1 - 0.400)` is whatever the
 * current inputs produce. A hand-written LaTeX substitution would hard-code today's
 * values and be wrong the instant anyone changes a feed rate, so it would have to be
 * regenerated on every edit. Converting the string that is actually about to be shown
 * means the typeset line and the plain line cannot disagree by construction.
 *
 * GRAMMAR — a small recursive descent, not a general parser:
 *
 *     line       := statement ( (';' | '|') statement )*
 *     statement  := equality ( ('=' | '=>') equality )*
 *     equality   := fraction | term
 *     fraction   := term '/' term
 *     term       := function '(' ... ')' | 'sqrt[' ... ']' | group | atom*
 *
 * ORDERING IS THE WHOLE PROBLEM, so it is worth stating. Three things must happen in this
 * sequence, and reversing any pair breaks the output:
 *
 *   1. Escape LaTeX specials FIRST. After this nothing may be escaped again, because
 *      every later step inserts braces of its own.
 *   2. Claim units, by swapping them for sentinels. Otherwise the word wrapper steals
 *      `kg` out of `kg/h` and leaves a stray slash behind.
 *   3. Wrap bare words, then operators, around whatever survives.
 *
 * Bracketed groups are lifted out into sentinels before any of this, which is how a
 * slash buried inside `[...]` is found at all.
 */

/** LaTeX specials in these strings. Escaped before anything is inserted. */
const SPECIALS: [RegExp, string][] = [
  [/%/g, '\\%'],
  [/&/g, '\\&'],
  [/#/g, '\\#'],
  [/\$/g, '\\$'],
  [/_/g, '\\_'],
];

/**
 * Units, longest first so `kg/m3` is claimed before `m`.
 *
 * The source strings write the exponent as a literal superscript character, `m3` with
 * U+00B3, not `m^3`.
 */
const UNITS = [
  'kg/m³', 'lb/ft³', 'm³/rev', 'kg/h', 'kg/m²', 'kg/s', 'm/s', 'm³/h', 'm²/s',
  'HP', 'RPM', 'Pa', 'kW', 'min', 'm³', 'm²', 'kg', 'cm', 'mm', '°C',
  'minutes', 'hours', 'minute', 'hour',
];

/** Macro names that must never be mistaken for a bare word. */
const MACROS = new Set([
  'text', 'mathrm', 'frac', 'dfrac', 'sqrt', 'left', 'right', 'cdot', 'times',
  'div', 'pi', 'geq', 'leq', 'Rightarrow', 'bmod',
]);

/** Function calls that take a bracketed argument. */
const FUNCTIONS = new Set([
  'sqrt', 'max', 'min', 'arctan', 'arcsin', 'arccos', 'sin', 'cos', 'tan', 'log', 'ln', 'exp',
]);

/**
 * Sentinel markers, built from char codes rather than written literally.
 *
 * A control character pasted into source is silently dropped by some editors, and two
 * distinct sentinels that both collapse to the empty string collide with each other — a
 * group placeholder would then be substituted where a unit was meant.
 */
const MARK_GROUP = String.fromCharCode(1);
const MARK_UNIT = String.fromCharCode(2);

/**
 * Scratch storage for the two kinds of placeholder this module lifts out of a string.
 *
 * Module scope because a placeholder is created deep in the recursion and only resolved
 * once the whole line exists. Safe here: `substitutionToLatex` resets both arrays on
 * entry, the work is synchronous, and the app never calls this re-entrantly.
 */
let groups: string[] = [];
let units: string[] = [];

const groupPh = (i: number) => `${MARK_GROUP}G${i}${MARK_GROUP}`;
const unitPh = (i: number) => `${MARK_UNIT}U${i}${MARK_UNIT}`;

/** Splits on `sep` at bracket depth zero. Returns null when `sep` is absent there. */
function splitTopLevel(s: string, sep: string): string[] | null {
  let depth = 0;
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '(' || ch === '[') depth++;
    else if (ch === ')' || ch === ']') depth--;
    else if (depth === 0 && ch === sep) {
      // `>=`, `<=` and `=>` are not equalities. Guard the character on BOTH sides: a
      // forward-only guard reads `55 >= 55` as `55 >` split from `55`.
      const prev = s[i - 1];
      const next = s[i + 1];
      if (prev === '>' || prev === '<' || next === '=' || next === '>') continue;
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  if (!out.length) return null;
  out.push(s.slice(start));
  const parts = out.map((p) => p.trim()).filter(Boolean);
  return parts.length ? parts : null;
}

/** Claims every unit token, replacing it with a sentinel. */
function claimUnits(s: string): string {
  let out = s;
  for (const u of UNITS) {
    const esc = u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // The unit MUST be a capturing group: the replacement reads the matched text back out
    // of capture 2 to store it. With `(?:...)` the capture is undefined and every unit
    // resolves to the text "undefined".
    out = out.replace(
      new RegExp(`(^|[^A-Za-z0-9_.\\\\])(${esc})(?![A-Za-z0-9_])`, 'g'),
      (_m, pre: string, tok: string) => `${pre}${unitPh(units.push(tok) - 1)}`
    );
  }
  return out;
}

/**
 * Lifts every innermost bracket group out into a sentinel, converting its contents.
 *
 * Runs AFTER function names are handled, or `sqrt[...]` loses its name.
 */
function liftGroups(s: string): string {
  for (;;) {
    let open = -1;
    let close = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] !== '(' && s[i] !== '[') continue;
      let depth = 0;
      let end = -1;
      for (let j = i; j < s.length; j++) {
        if (s[j] === '(' || s[j] === '[') depth++;
        else if (s[j] === ')' || s[j] === ']') {
          depth--;
          if (depth === 0) { end = j; break; }
        }
      }
      if (end === -1) continue;
      if (/[()[\]]/.test(s.slice(i + 1, end))) continue; // not innermost
      open = i;
      close = end;
      break;
    }
    if (open === -1) return s;
    const opener = s[open];
    const closer = s[close] === ')' ? ')' : ']';
    groups.push(`\\left${opener}${expression(s.slice(open + 1, close))}\\right${closer}`);
    s = s.slice(0, open) + groupPh(groups.length - 1) + s.slice(close + 1);
  }
}

/**
 * Text-level normalisation, applied ONCE to the whole line before any splitting.
 *
 * This ordering is not a style choice. `kg/h` and `kg/m3` both CONTAIN a slash, so if
 * units are recognised after the fraction split, `F_r = 820.0 kg/h` becomes
 * `\dfrac{820.0 kg}{h}` — the slash inside a unit is read as a division. Claiming the
 * unit first hides its slash behind a sentinel, and every later step then sees a unit
 * as one indivisible token.
 *
 * Escaping also belongs here. `%` is the dangerous one: unescaped it comments out the
 * whole remainder of the line, so `Loading = 30%` would silently lose everything after
 * the sign. `_` turns `Q_v` into a subscript on the preceding character.
 */
function normalise(s: string): string {
  let out = s;
  // Strip thousands separators, or `1,000,000` renders with a decimal point. The whole
  // run is matched in one go: a per-group pattern only strips the first `,000` and leaves
  // `1,000,000` as `1000,000`.
  out = out.replace(/\d+(?:,\d{3})+/g, (run) => run.replace(/,/g, ''));
  for (const [re, rep] of SPECIALS) out = out.replace(re, rep);
  return claimUnits(out);
}

/** Converts one leaf: no `=`, `/`, function call or bracket group remains. */
function leaf(s: string): string {
  let out = s;

  // Scientific notation: 2.278e-5 -> 2.278 \times 10^{-5}
  out = out.replace(
    /(\d+(?:\.\d+)?)[eE]([-+]?\d+)/g,
    (_m, num: string, ex: string) => {
      const e = Number(ex);
      return `${num} \\times 10^{${e < 0 ? '-' : ''}${Math.abs(e)}}`;
    }
  );

  // Bare superscripts: ^2, ^-5, ^5.25588 -> ^{...}
  out = out.replace(
    /\^\{([^}]*)\}|\^(-?\d+(?:\.\d+)?)/g,
    (_m, braced: string | undefined, bare: string | undefined) =>
      braced !== undefined ? `^{${braced}}` : `^{${bare}}`
  );

  // pi, before the word wrapper so it is not treated as an ordinary word.
  out = out.replace(/(^|[^A-Za-z0-9_\\])pi(?![A-Za-z0-9_])/g, '$1\\pi');

  out = claimUnits(out);

  // Wrap every remaining bare word run upright, so an English phrase reads as text
  // instead of a row of italic variables.
  out = out.replace(
    /[A-Za-z][A-Za-z0-9_\\]*(?:[ ][A-Za-z][A-Za-z0-9_\\]*)*/g,
    (word: string, at: number, whole: string) => {
      const before = at > 0 ? whole[at - 1] : '';
      if (before === '\\' || before === MARK_GROUP || before === MARK_UNIT) return word;
      if (MACROS.has(word)) return word;
      return `\\text{${word}}`;
    }
  );

  out = out
    .replace(/×/g, '\\times ')
    .replace(/·/g, '\\cdot ')
    .replace(/÷/g, '\\div ')
    .replace(/[–—]/g, '-')
    .replace(/°/g, '^{\\circ}')
    .replace(/²/g, '^{2}')
    .replace(/\bmod\b/g, '\\bmod ');

  return out;
}

/** Lifts bracket groups out of a string, then converts what is left as a leaf. */
function liftGroupsAndLeaf(s: string): string {
  return leaf(liftGroups(s));
}

/** Converts one expression, recursing through equalities, functions, fractions, groups. */
function expression(s: string): string {
  const t = s.trim();
  if (!t) return '';

  const eq = splitTopLevel(t, '=');
  if (eq && eq.length > 1) return eq.map(expression).join(' = ');

  const fr = splitTopLevel(t, '/');
  if (fr && fr.length === 2) {
    return `\\dfrac{${expression(fr[0])}}{${expression(fr[1])}}`;
  }

  // A function call, handled before group lifting so the name survives.
  for (const fn of FUNCTIONS) {
    let from = 0;
    for (;;) {
      const at = t.indexOf(fn, from);
      if (at === -1) break;
      from = at + fn.length;
      if (at > 0 && /[A-Za-z0-9_\\]/.test(t[at - 1])) continue;
      const open = t[at + fn.length];
      if (open !== '(' && open !== '[') continue;
      let depth = 0;
      let end = -1;
      for (let j = at + fn.length; j < t.length; j++) {
        if (t[j] === '(' || t[j] === '[') depth++;
        else if (t[j] === ')' || t[j] === ']') {
          depth--;
          if (depth === 0) { end = j; break; }
        }
      }
      if (end === -1) continue;
      const arg = expression(t.slice(at + fn.length + 1, end));
      const tail = liftGroupsAndLeaf(t.slice(end + 1));
      return fn === 'sqrt'
        ? `${expression(t.slice(0, at))}\\sqrt{${arg}}${tail}`
        : `${expression(t.slice(0, at))}\\${fn}\\left(${arg}\\right)${tail}`;
    }
  }

  return liftGroupsAndLeaf(t);
}

/**
 * The LaTeX form of a step's substitution, or null for an empty line.
 *
 * Everything is typeset, including prose: words are wrapped upright, so a sentence such
 * as `Recommended Commercial Drive: 0.75 kW ...` renders as readable text with its
 * numbers set properly, rather than as a row of italic variables.
 */
export function substitutionToLatex(plain: string): string | null {
  const trimmed = plain.trim();
  if (!trimmed) return null;

  groups = [];
  units = [];

  // Normalise the WHOLE line first: escape specials, strip thousands separators and
  // claim units. Doing it later lets the slash inside `kg/h` be read as a division.
  const guarded = normalise(trimmed)
    .replace(/=>/g, ' \\Rightarrow ')
    .replace(/>=/g, ' \\geq ')
    .replace(/<=/g, ' \\leq ');

  const statements = guarded
    .split(/\s*[;|]\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const parts = statements.map((st) => expression(st)).filter(Boolean);
  if (!parts.length) return null;

  let out = parts.join(' \\quad ');

  // Resolve every sentinel that is PRESENT, repeatedly, until none is left.
  //
  // A unit can be claimed inside a bracket group, and that group's own text only enters
  // the line when its sentinel is substituted. Resolving units first and groups second
  // therefore leaves unit sentinels stranded inside group text, which is exactly what
  // KaTeX then rejected. Repeating to a fixed point makes the order irrelevant.
  const sentinel = new RegExp(
    `${MARK_GROUP}G(\\d+)${MARK_GROUP}|${MARK_UNIT}U(\\d+)${MARK_UNIT}`,
    'g'
  );
  for (let pass = 0; pass < 200; pass++) {
    const next = out.replace(sentinel, (match, g: string | undefined, u: string | undefined) =>
      g !== undefined ? groups[Number(g)] : `\\text{${units[Number(u)]}}`
    );
    if (next === out) break;
    out = next;
  }

  // Anything still unresolved means the parse lost a sentinel. Returning null drops the
  // line back to plain text rather than emitting markup KaTeX will reject.
  if (out.includes(MARK_GROUP) || out.includes(MARK_UNIT)) return null;

  return out.replace(/\s+/g, ' ').trim();
}

/** Exported for tests. */
export const _internal = { expression, leaf, splitTopLevel, claimUnits, liftGroups, normalise };