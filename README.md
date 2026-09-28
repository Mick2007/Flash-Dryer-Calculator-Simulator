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

## How the physics is implemented

Several correlations here were corrected during review. The ones worth knowing about,
because they change reported numbers rather than just internals:

- **Moist-air density** uses the ASHRAE relation
  `ρ = P(1 + W) / (R_da · T · (1 + 1.608W))`. The `1 + 1.608W` term sits in the
  *denominator*, which is what makes humid air come out *lighter* than dry air. An
  earlier version had the two bracketed terms the wrong way round, making humid air
  heavier than dry air and inflating every volumetric flow downstream.

- **Fan motor power** is `P_air / η_fan / η_belt × SF`. The service factor is a
  multiplier because it is a nameplate margin; the two efficiencies are divisors
  because both represent power *lost* before the shaft.

- **Cyclone collection** uses the Lapple form `η = 1/(1 + (d50/d)²)`, which returns
  exactly 50% at the cut point by definition and 90% at three times the cut point. A
  hand-stepped staircase previously returned 80% and 99% at those points.

- **Heat exchanger correction factor** depends on exchanger geometry. Cross-flow units
  use `F_t = 0.90` because the two streams never mix and cannot achieve the
  parallel-flow LMTD; a single-pass shell-and-tube unit uses `F_t = 1.00`. These were
  previously conflated, which understated cross-flow surface area by about 11%.

- **Product temperature**, not exhaust air temperature, is checked against
  gelatinization. Cassava starch gelatinizes from roughly 58–70 °C, and the product
  runs below the exhaust air because ongoing evaporation absorbs energy. The estimate
  is a disclosed bound, not a resolved particle temperature.

- **Condensation** is checked as exhaust temperature minus dew point, using the dew
  point back-calculated from the computed humidity ratio. Testing against a fixed
  temperature ignored the moisture the engine had already calculated.

- **Screw feeder capacity** is derived from the screw's own geometry by the CEMA
  relation, scaling with the square of the diameter. It is no longer a free input,
  because a capacity entered independently of the specified screw could contradict
  the geometry with no check to catch it. A 4-inch screw at 30% loading returns
  0.410 ft³/h/rpm, matching the 0.41 quoted in Kuye et al.

- **Bulk density is bounded by particle density.** A settled bed always contains void
  space, so bulk density cannot exceed the density of the solid material. The
  relationship is enforced through bed voidage and any substitution is disclosed.

Every value in the engine is sanitised on entry. A field containing text, nothing, or
an out-of-range number is replaced with a stated default and the substitution is
recorded in the validation ledger, rather than propagating `NaN` or `Infinity` into a
report.

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
- The overall heat transfer coefficient `U` is scaled from a reference gas-side mass
  velocity rather than resolved from a bundle geometry, and the saltation velocity
  uses a first-order solids-loading correction. Both are disclosed in the
  `assumedParameters` array in every result, each with its basis and rationale.
- Product temperature is reported as a bound (exhaust air temperature less a stated
  evaporative cooling allowance), not as a solved particle temperature. Gelatinization
  is assessed against that bound.
- The hopper valley-angle test is geometric screening, not a Jenike flow-property
  analysis. Confirm mass flow with a Jenike or equivalent test on the actual cake.

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
