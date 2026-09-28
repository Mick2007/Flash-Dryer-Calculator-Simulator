# Cassava Flash Dryer Engineering Calculator

An engineering design tool for sizing pneumatic (flash) drying systems that turn
wet cassava mash into high-quality cassava flour (HQCF). Runs entirely in the
browser — no API keys, no server, no data leaves the page.

Method after:

- Chapuis, A. (2015) — *Pilot Flash Dryer Report: Guidelines for the design and
  construction of an experimental pneumatic dryer for cassava products.*
  CIRAD / CIAT, CGIAR RTB programme.
- Kuye, A., Ayo, D.B., Sanni, L.O. et al. (2011) — *Design and fabrication of a
  flash dryer for the production of high-quality cassava flour.* IITA.

## What it does

- **Mass and energy balance** — feed to dry solids, evaporation load, burner duty,
  specific energy consumption (SEC).
- **Psychrometrics** — ambient humidity ratio, moist-air density, air enthalpy, with
  altitude correction.
- **Aerodynamics** — Archimedes number, Schiller–Naumann terminal velocity by bisection,
  saltation velocity, conveying velocity checks.
- **Dimensional sizing** — drying tube diameter quantised to commercial pipe standards,
  developed length, riser height, venturi throat.
- **Cyclone separation** — Stairmand/Lapple proportions, cut-point diameter d50 and
  single-dust collection efficiency.
- **Feed handling** — hopper geometry with valley-angle mass-flow check, screw feeder
  capacity and power.
- **Ancillary** — indirect air heater sizing, blower and motor selection, system
  pressure profile and dust-leakage risk.
- **Full derivation trace** — every figure above is reproducible: 60 numbered steps,
  each with its equation, variable table, substituted values, result and citation.
- **Validation checks** — each threshold graded valid / review / warning / invalid
  against its source.
- **Export** — engineering dossier as PDF, and 1:1 fabrication geometry as DXF or SVG.

## Running it

Requires Node.js 20.19+ or 22.12+.

```bash
npm install
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run lint       # TypeScript type check, no emit
npm run build      # type check, then production build to dist/
npm run preview    # serve the production build
npm run clean      # remove dist/
```

`npm run build` type checks first, so a type error cannot reach `dist/`.

## Reading the capacity presets

Preset values such as **820 kg/h** are **wet feed** rates — kilograms per hour of
dewatered cassava mash entering the venturi, not dry flour output.

If the capacity mode is set to **Dry product target**, the tool converts each preset by
the dry-solids fraction `(100 − final moisture) / 100`. An 820 kg/h wet feed at 12%
final moisture therefore sizes for 722 kg/h of dry product, not 820 kg/h.

## Design notes

The interface is set as an engineering worksheet rather than a dashboard: measured
quantities are monospace, running argument is serif, and colour carries state only
(verdigris passes, oxide faults, brass for the single accent). Shadows are not used;
hairlines and paper tone do the separating.

`src/index.css` contains a **legacy palette alias** and a **shadow neutralisation**
block. These remap the Tailwind default scales onto the project tokens so that
components not yet migrated still render consistently. They can be deleted once every
component has been converted.

## Status and limitations

This is a **preliminary mechanical engineering design** aid, not a certified design
package. In particular:

- The pressure profile is a preliminary allocation, not a full duct hydraulic
  calculation. Final fan selection requires one.
- The system solves a closed-form energy and mass balance with a lumped drying
  model. It does not model moisture diffusion inside the particle or a two-phase flow
  regime, and it contains no heat-transfer coefficient check confirming the tube can
  deliver the computed duty.
- `F_t`, saltation and several heat-exchanger correlations are engineering
  approximations. The `assumedParameters` array in every result records each one with
  its basis and rationale.

Verify against the primary sources before ordering equipment.

## Project layout

```
src/
  utils/
    dryerCalculations.ts   calculation engine (single source of truth)
    constants.ts           CIRAD / IITA / AMCA thresholds, presets
    unitConversion.ts      metric / tonne / imperial
  components/
    SummaryDashboard.tsx   governing dimensions and verdict
    EngineeringChecks.tsx  validation ledger
    CalculationSteps.tsx   the 60-step derivation trace
    Cad3dViewer.tsx        parametric 3D assembly
  utils/cad3d/             parametric model, geometry, DXF/SVG export
```
