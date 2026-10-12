# AGENTS.md

## Who I'm talking to

A **student engineer**. No web development background. Comfortable with engineering
(geometry, thermodynamics, CAD, fabrication) — **not** with web/JS tooling jargon.

## How to explain

- **Short.** Lead with the answer. No preamble, no restating the question.
- **Simple words.** Assume an undergraduate engineering education, not a web one.
- **Plain English for anything code-related.** Say "the joint checker" not "the
  validation predicate". Say "the code checks the wrong thing" not "the assertion is
  on model algebra rather than drawn geometry". If I must use a web term, explain it in
  the same sentence.
- **Numbers, not adjectives.** "29 mm too big" beats "slightly misaligned". Give the
  measured value.
- **Use engineering analogies** — flanges, gaskets, pipe fittings, clearances, bend
  radii, wall thickness. They already know these.
- **Spend tokens on doing the work, not on talking about it.** Long explanations are a
  cost, not a courtesy.

## Answer this first

When reporting on a change, answer in this order:

1. What was wrong (one line, with the number).
2. What I changed (one line).
3. Anything I could not verify — be explicit. Never imply I looked at something
  visually if I only measured it.

## Project: cassava flash dryer calculator

A Vite + React + TypeScript + three.js engineering calculator with a 3D CAD view.
See the section below for hard-won lessons.

### Rules

- `npx vitest run` — `src/utils/scalingEvaluation.test.ts` is a KNOWN pre-existing
  failure (stale field names). **Do not try to fix it.** It is not in scope.
- `npx tsc --noEmit` must be clean; `npx vite build` must succeed.
- Browser screenshots fail ("needs a visible tab"). To actually *see* geometry, write
  a throwaway software renderer (triangle raster + PNG encoder) and read the PNG. Use
  painter's algorithm, **not** a z-buffer fed linearly interpolated z — that silently
  drops most of the scene and makes a full model look empty.

### The lesson that keeps costing time

**Never trust the numbers the model reports about itself. Measure the geometry that
actually gets drawn.**

Every bug in this project looked correct in the model and was wrong in the 3D view,
because the tests checked the model's own arithmetic — which is self-consistent by
construction. Both the flash-tube port and the cyclone inlet port are derived from the
same variables, so they always agreed with each other no matter what the builder drew.

To test properly:

- Build the scene in Node, walk the mesh graph, read the centreline back out of the
  tube's vertices. Average each ring — but drop the duplicated seam vertex or the
  centroid is pulled toward it by `pipeRadius / (radialSegments + 1)`.
- Identify parts by their **shape/size**, never by position. Matching on X alone picks
  up the wrong bolt or bracket.
- Sweep the input range. Bugs hide at the ends. The capacity input is `feedRate`, not
  `wetFeedRateKgH` — the latter is silently ignored.
- If a test fails, check whether the **geometry** or the **test** is wrong first. I
  rewrote correct geometry to match wrong assumptions twice.
- Prove new tests bite: reintroduce the bug, confirm the test fails, then undo.

### Tangential inlet sizing

The duct (user-chosen standard pipe) and the cyclone inlet (`0.2 Dc x 0.5 Dc`,
Stairmand/Lapple) are sized independently and never match, so a transition is always
needed. **Never change the inlet proportions** — they are correct cyclone design, and
the engine's inlet velocity and efficiency depend on them. Absorb the mismatch in the
transition instead. If the transition needs more room than there is, move the flange
further out. Never shrink the transition or clamp a part's length to zero; a clamped
length means the part silently stops being drawn.