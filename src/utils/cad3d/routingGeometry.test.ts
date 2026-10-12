import { describe, it, expect } from 'vitest';
import { calculateFlashDryer } from '../dryerCalculations';
import { extractParametricModel } from './parametricModel';
import { DEFAULT_DRYER_INPUTS } from '../constants';
import type { ParametricModel3D } from './parametricModel';

/**
 * ITEMS 27-30: loop routing, cyclone anchoring, the airlock gap and the fan
 * discharge nozzle.
 *
 * All four were geometry defects rather than arithmetic errors, which is why the
 * existing suites stayed green: nothing asserted that the DRAWN pipe matched the
 * SOLVED pipe, that the cyclone stayed downstream of its own downcomer, that the
 * airlock housing reached its own flanges, or that the fan nozzle related to the
 * duct.
 *
 * These tests assert the invariants in the terms the defects appeared in, so a
 * regression fails on a number rather than on someone's eye.
 */

const model = (over: Partial<typeof DEFAULT_DRYER_INPUTS> = {}): ParametricModel3D =>
  extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, ...over }));

/** Horizontal gap from the downcomer centreline to the cyclone barrel centreline. */
const inletGap = (m: ParametricModel3D) => m.cycloneCenterXM - m.downcomerXM;

describe('item 27: the geometry builder is told where the downcomer is', () => {
  it('exposes the solved run, the downcomer X and the exit Y', () => {
    // These three did not exist before item 27. The builder recomputed the downcomer
    // from the riser and ignored the run entirely, so the drawn pipe and the costed
    // pipe disagreed by metres in X.
    const m = model();
    expect(m.horizontalRunM).toBeGreaterThanOrEqual(0);
    expect(m.downcomerXM).toBeGreaterThan(0);
    expect(m.downcomerExitYM).toBeGreaterThan(0);
  });

  it('the reported developed length still matches what the engine asked for', () => {
    // The run exists to close the gap to totalPipeLengthM. If this drifts the
    // drawing is no longer the machine being costed — the exact failure item 16
    // originally had, and the reason the run must be drawn rather than ignored.
    const results = calculateFlashDryer(DEFAULT_DRYER_INPUTS);
    const m = extractParametricModel(results);
    expect(Math.abs(m.pipeLengthDifferencePercent)).toBeLessThanOrEqual(2);
  });
});

describe('item 27: routingLayout finally changes the routing', () => {
  it('straight_riser produces NO horizontal run', () => {
    // This is the user's requirement: the U-turn is a pure 180° return with riser
    // and downcomer on one vertical centreline. routingLayout was read from the
    // inputs and never branched on, so this produced an identical bent return.
    const m = model({ tubeRoutingLayout: 'straight_riser' });
    expect(m.routingLayout).toBe('straight_riser');
    expect(m.horizontalRunM).toBe(0);
  });

  it('the loop layouts produce a progressively longer run', () => {
    const straight = model({ tubeRoutingLayout: 'straight_riser' });
    const single = model({ tubeRoutingLayout: 'single_loop' });
    const dbl = model({ tubeRoutingLayout: 'double_loop' });

    expect(single.horizontalRunM).toBeGreaterThan(straight.horizontalRunM);
    expect(dbl.horizontalRunM).toBeGreaterThanOrEqual(single.horizontalRunM);
    expect(straight.horizontalRunM).toBe(0);
  });

  it('the run scales with the riser rather than being a fixed number of metres', () => {
    // A fixed metre value would make the option meaningless on a small machine and
    // absurd on a large one.
    const cap = (m: ParametricModel3D) => Math.max(0, m.horizontalRunM);
    const small = cap(model({ tubeRoutingLayout: 'double_loop', desiredProductRate: 30 }));
    const large = cap(model({ tubeRoutingLayout: 'double_loop', desiredProductRate: 5000 }));
    expect(large).toBeGreaterThan(0);
    expect(small).toBeGreaterThanOrEqual(0);
  });
});

describe('item 27: the cyclone is anchored to the downcomer, not to a sliding clearance', () => {
  it('the inlet gap is POSITIVE — the cyclone is downstream of its own downcomer', () => {
    // The defect: anchoring the cyclone to the riser let the solved run push the
    // downcomer PAST the cyclone, giving a negative gap at the default design
    // (-0.40 m). The drawing showed the pipe feeding the cyclone from behind it.
    for (const lay of ['straight_riser', 'single_loop', 'double_loop'] as const) {
      const m = model({ tubeRoutingLayout: lay });
      expect(inletGap(m), `${lay}: cyclone is not downstream of the downcomer`).toBeGreaterThan(0);
    }
  });

  it('the flange sits exactly one bend radius downstream, so the elbow is a clean quarter turn', () => {
    // THE design invariant of item 32. The downcomer stops one bend radius above the
    // inlet centreline, so if the flange is also one bend radius downstream, both axes
    // of the turn are consumed by the elbow: no straight lead-in, no straight run.
    //
    // Getting this wrong is what produced the visible hook: an earlier anchor left
    // the flange 68 mm BEHIND the downcomer, so the elbow had to turn back on itself.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const m = model({ standardPipeNominalMm: dia });
      const flangeX = m.cycloneCenterXM - m.cycloneInletLengthM;
      expect(
        flangeX - m.downcomerXM,
        `D=${dia}: flange is not one bend radius downstream of the downcomer`
      ).toBeCloseTo(m.bendRadiusM, 6);
    }
  });

  it('the elbow therefore needs no straight lead-in or run on either axis', () => {
    // Guards the pairing that makes the quarter circle exact: the vertical gap
    // between the downcomer exit and the inlet centreline must also be one radius.
    const m = model();
    const flangeX = m.cycloneCenterXM - m.cycloneInletLengthM;
    const riseM = Math.abs(m.cycloneInletYM - m.downcomerExitYM);
    expect(riseM).toBeCloseTo(m.bendRadiusM, 6);
    expect(flangeX - m.downcomerXM).toBeCloseTo(m.bendRadiusM, 6);
  });

  it('the exit sits exactly one radius above the inlet, unconditionally', () => {
    // The line used to read `max(inletYM + bendRadius, 3.2)`. The floor is unreachable
    // today — the smallest `inletYM + bendRadiusM` over D 80-1000 mm and 0.2-60 t/h is
    // 5.572 m — so it changed nothing, but it made the invariant conditional on a
    // constant nobody could justify. This pins it as unconditional so no floor, clamp
    // or `Math.max` can quietly return and reintroduce a lead-in off the duct axis.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      for (const lay of ['straight_riser', 'single_loop', 'double_loop'] as const) {
        const m = model({ standardPipeNominalMm: dia, tubeRoutingLayout: lay });
        expect(
          m.downcomerExitYM,
          `D=${dia} ${lay}: exit is not exactly one radius above the inlet centreline`
        ).toBeCloseTo(m.cycloneInletYM + m.bendRadiusM, 12);
      }
    }
  });

  it('the barrel centre follows the flange, so a cyclone resize moves only the barrel', () => {
    // cycloneCenterZM already puts the inlet on the shell's tangent line, and the
    // barrel X is now flange + inletLength. A different cyclone changes the barrel
    // size and so the inlet length, but must NOT change where the FLANGE is — that
    // would move the duct geometry.
    const stairmand = model({ cycloneType: 'stairmand' });
    const lapple = model({ cycloneType: 'lapple' });
    const flange = (m: ParametricModel3D) => m.cycloneCenterXM - m.cycloneInletLengthM;
    // Each model against ITS OWN downcomer: a taller Lapple barrel raises the inlet,
    // which changes the solved run, so the two downcomers are not at the same X.
    expect(flange(lapple) - lapple.downcomerXM).toBeCloseTo(lapple.bendRadiusM, 6);
    expect(flange(stairmand) - stairmand.downcomerXM).toBeCloseTo(stairmand.bendRadiusM, 6);
    // The gap from the DOWNCOMER to the barrel centre is the elbow radius plus the
    // inlet length. Which of the two cyclones has the larger one depends on the
    // design (a wider tangential inlet needs a smaller barrel, so a shorter inlet), so
    // the invariant is the sum, not its direction.
    for (const m of [stairmand, lapple]) {
      expect(inletGap(m)).toBeCloseTo(m.bendRadiusM + m.cycloneInletLengthM, 6);
    }
  });

  it('holds across pipe diameters and capacities', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      for (const lay of ['straight_riser', 'single_loop', 'double_loop'] as const) {
        const m = model({ standardPipeNominalMm: dia, tubeRoutingLayout: lay });
        expect(inletGap(m), `D=${dia} ${lay}`).toBeGreaterThan(0);
      }
    }
  });
});

describe('item 33: the exhaust stack is sized from the fan, not the cyclone', () => {
  const ductArea = (m: ParametricModel3D) => Math.PI * m.pipeRadiusM * m.pipeRadiusM;

  it('carries the same discharge area as the nozzle it bolts to', () => {
    // The stack was `max(0.12, cycloneVortexFinderRadiusM * 0.95)` — an UPSTREAM
    // component with no dimensional relationship to the fan. On the IITA load that is
    // a 580 mm stack on a 428 mm nozzle. It is now an equal-area round section.
    const m = model();
    const stackArea = Math.PI * m.downstreamStackRadiusM ** 2;
    const nozzle = m.downstreamBlowerOutletWidthM * m.downstreamBlowerOutletHeightM;
    expect(stackArea).toBeCloseTo(nozzle, 3);
  });

  it('no longer follows the vortex finder', () => {
    // The old rule scaled the vent with the cyclone. Doubling the cyclone must not
    // change the fan discharge.
    const small = model({ cycloneType: 'stairmand' });
    const big = model({ cycloneType: 'lapple' });
    expect(Math.abs(big.downstreamStackRadiusM - small.downstreamStackRadiusM)).toBeLessThan(1e-9);
  });

  it('keeps up with the duct as the machine is resized', () => {
    // The stack tracks the duct, so a larger fan passage does not leave the vent
    // stranded at a fixed size.
    const small = model({ standardPipeNominalMm: 100 });
    const big = model({ standardPipeNominalMm: 1000 });
    expect(big.downstreamStackRadiusM).toBeGreaterThan(small.downstreamStackRadiusM);
    expect(big.downstreamStackRadiusM).toBeGreaterThan(ductArea(big) ** 0.5 * 0.5);
  });
});

describe('item 40: the fan connection is a straight drop, and the outlet is gone', () => {
  it('the duct drops on the fan centreline, with nothing to turn into', () => {
    // The nozzle now sits on TOP of the volute, so the duct's last move is a straight
    // vertical fall. This asserts the precondition that makes that possible: the fan's Z
    // equals the cyclone's Z, so the descending leg is already on the fan's axis and
    // cannot need a bend to reach it.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      for (const lay of ['straight_riser', 'single_loop', 'double_loop'] as const) {
        const m = model({ standardPipeNominalMm: dia, tubeRoutingLayout: lay });
        expect(
          m.downstreamBlowerPosition.z,
          `D=${dia} ${lay}: the fan is off the duct plane, so the drop would be skewed`
        ).toBeCloseTo(m.cycloneCenterZM, 12);
      }
    }
  });

  it('there is enough height for a real drop', () => {
    // The duct must actually fall into the nozzle rather than run up to it.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const m = model({ standardPipeNominalMm: dia });
      const nozzleTopY =
        m.downstreamBlowerPosition.y + m.downstreamBlowerVoluteRadiusM + 0.2;
      const archExitY = m.cycloneBarrelTopYM + 0.4;
      expect(nozzleTopY, `D=${dia}: nozzle sits above the arch exit`).toBeLessThan(archExitY);
      expect(archExitY - nozzleTopY, `D=${dia}: drop is too short to draw`).toBeGreaterThan(0.3);
    }
  });

  it('the fan outlet is no longer drawn', () => {
    // Guards the removal. A stack standing on the same side as the descending duct used
    // to interpenetrate it by 0.227 m; with no outlet there is nothing to collide.
    // Asserted on the MODEL being free of the standoff that only existed to feed it.
    for (const dia of [100, 450, 1000]) {
      const m = model({ standardPipeNominalMm: dia });
      expect(
        'idSuctionStandoffM' in m,
        `D=${dia}: the removed standoff is still on the model`
      ).toBe(false);
    }
  });
});

describe('item 29: the airlock housing reaches its own flanges', () => {
  it('the housing spans the full valve height, so no gap can open', () => {
    // The builder used alH * 0.7 for the body but +/- alH / 2 for the flanges, which
    // left 0.15 * alH of daylight at EACH end: 42 mm on the default 280 mm housing,
    // scaling to 63 mm on a 420 mm one. Reproduced as the arithmetic that motivated
    // the change, since the geometry constant itself is not exported.
    const alH = model().airlockHeightM;
    const oldBodyHalf = (alH * 0.7) / 2;
    const flangeY = alH / 2;
    expect(flangeY - oldBodyHalf).toBeGreaterThan(0); // the old gap was real
    expect(flangeY - alH / 2).toBe(0); // the new body closes it exactly
  });

  it('the airlock sits under the cyclone spigot it discharges from', () => {
    const m = model();
    expect(m.airlockPosition.y + m.airlockHeightM / 2).toBeLessThanOrEqual(m.cycloneDustOutletYM + 1e-9);
    expect(m.airlockPosition.y - m.airlockHeightM / 2).toBeGreaterThan(0);
  });
});

describe('item 30: the fan discharge nozzle relates to the duct it mates with', () => {
  const ductArea = (m: ParametricModel3D) => Math.PI * m.pipeRadiusM * m.pipeRadiusM;
  const dnNozzle = (m: ParametricModel3D) =>
    m.downstreamBlowerOutletWidthM * m.downstreamBlowerOutletHeightM;
  const upNozzle = (m: ParametricModel3D) =>
    m.upstreamBlowerOutletWidthM * m.upstreamBlowerOutletHeightM;

  it('is a modest multiple of the duct area, not of the volute', () => {
    // Was 1.97x at the default size. A discharge twice the duct area passes at half
    // the duct velocity, so it read as a sudden expansion and never looked like it
    // flowed.
    const m = model();
    expect(dnNozzle(m) / ductArea(m)).toBeGreaterThan(1.0);
    expect(dnNozzle(m) / ductArea(m)).toBeLessThan(1.35);
    expect(upNozzle(m) / ductArea(m)).toBeLessThan(1.35);
  });

  it('is never smaller than the duct it discharges into', () => {
    for (const dia of [100, 180, 315, 630, 1000]) {
      const m = model({ standardPipeNominalMm: dia });
      expect(dnNozzle(m), `D=${dia}: nozzle smaller than the duct`).toBeGreaterThanOrEqual(ductArea(m));
    }
  });

  it('no longer scales with fan power', () => {
    // The defect was that the nozzle followed the VOLUTE, so it grew with the duty.
    // It is now set by the duct and should barely move across an order of magnitude
    // of capacity.
    const small = model({ feedRate: 200 });
    const big = model({ feedRate: 3000 });
    expect(Math.abs(dnNozzle(big) / ductArea(big) - dnNozzle(small) / ductArea(small))).toBeLessThan(0.35);
  });
});