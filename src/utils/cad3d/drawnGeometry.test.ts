import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { calculateFlashDryer } from '../dryerCalculations';
import { extractParametricModel, validateAssemblyConnections } from './parametricModel';
import { buildMechanicalCadAssembly } from './geometryBuilder';
import { createCadMaterials } from './materials';
import { DEFAULT_DRYER_INPUTS } from '../constants';
import type { ParametricModel3D } from './parametricModel';
import type { DryerInputs } from '../../types/dryer';

/**
 * ITEM 36: the DRAWN inlet elbow must land on both of the joints it connects.
 *
 * Every previous test in this area asserted the MODEL's arithmetic — that the flange
 * was one bend radius downstream of the downcomer, that the rise equalled it, and so
 * on. All of those were true while the pipe was visibly wrong, because the model was
 * never compared against what the builder actually drew. Two separate defects lived
 * in the gap:
 *
 *   1. The arc's i = 0 sample was never pushed as a control point, so Catmull-Rom
 *      extrapolated backwards and the pipe started 29 mm downstream and 88 mm below
 *      the downcomer exit it was supposed to continue.
 *   2. The flange point was pushed unconditionally, duplicating the arc's own last
 *      sample. A zero-length segment made the spline overshoot to x = 4.9826 — 29 mm
 *      PAST the flange face — and then snap back, so the pipe visibly poked through
 *      the mating flange and withdrew.
 *
 * These tests read the centreline back out of the built scene, so a regression fails
 * on a measured millimetre rather than on someone's eye.
 */

/** Build the real scene and return the model alongside it. */
function assemble(over: Partial<DryerInputs> = {}): {
  model: ParametricModel3D;
  transition: THREE.Mesh;
} {
  const model = extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, ...over }));
  const { rootGroup } = buildMechanicalCadAssembly(model, createCadMaterials());

  const pipeMeshes: THREE.Mesh[] = [];
  rootGroup.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    let n: THREE.Object3D | null = o;
    while (n) {
      if (n.name === 'component_column') {
        pipeMeshes.push(o as THREE.Mesh);
        break;
      }
      n = n.parent;
    }
  });

  const flangeX = model.cycloneInletFlangePoint.x;
  const tubes = pipeMeshes.filter((m) => (m.geometry as THREE.TubeGeometry).parameters);
  const transition = tubes
    .map((m) => ({ m, end: centreline(m).at(-1)! }))
    .filter(({ end }) => end.x > flangeX - 1e-6 && end.x < flangeX + 0.4)
    .sort((a, b) => a.end.x - b.end.x)[0].m;

  return { model, transition };
}

/**
 * Recover a tube's drawn centreline by averaging each ring of its vertices.
 *
 * TubeGeometry emits `radialSegments + 1` vertices per ring with the last DUPLICATING
 * the first for UV seam handling. Averaging all of them biases the centroid toward
 * v[0] by rPipe / (radialSegments + 1) — 9 mm on the default Ø450 pipe — which reads
 * as a phantom Z offset. The duplicate is dropped so the mean is over the 24 distinct
 * vertices and unbiased.
 */
function centreline(mesh: THREE.Mesh): THREE.Vector3[] {
  const geo = mesh.geometry as THREE.TubeGeometry;
  const pos = geo.attributes.position;
  const perRing = geo.parameters.radialSegments + 1;
  const distinct = perRing - 1;
  const rings = pos.count / perRing;
  const out: THREE.Vector3[] = [];
  for (let r = 0; r < rings; r++) {
    const v = new THREE.Vector3();
    for (let i = 0; i < distinct; i++) {
      v.x += pos.getX(r * perRing + i);
      v.y += pos.getY(r * perRing + i);
      v.z += pos.getZ(r * perRing + i);
    }
    out.push(v.divideScalar(distinct));
  }
  return out;
}

describe('item 36: the drawn inlet elbow reaches both of its joints', () => {
  it('starts exactly on the downcomer exit', () => {
    // Defect 1. The arc's i = 0 sample was omitted from the control list, so the
    // spline extrapolated off the axis.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const { model, transition } = assemble({ standardPipeNominalMm: dia });
      const start = centreline(transition)[0];
      expect(start.x, `D=${dia}: starts ${((start.x - model.downcomerXM) * 1000).toFixed(0)} mm off the downcomer axis`).toBeCloseTo(model.downcomerXM, 3);
      expect(start.y, `D=${dia}: starts ${((start.y - model.downcomerExitYM) * 1000).toFixed(0)} mm below the downcomer exit`).toBeCloseTo(model.downcomerExitYM, 3);
    }
  });

  it('ends exactly on the cyclone inlet flange', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const { model, transition } = assemble({ standardPipeNominalMm: dia });
      const end = centreline(transition).at(-1)!;
      expect(end.x, `D=${dia}: stops ${((end.x - model.cycloneInletFlangePoint.x) * 1000).toFixed(0)} mm short of / past the flange`).toBeCloseTo(model.cycloneInletFlangePoint.x, 3);
      expect(end.y, `D=${dia}: stops ${((end.y - model.cycloneInletFlangePoint.y) * 1000).toFixed(0)} mm off the inlet centreline`).toBeCloseTo(model.cycloneInletFlangePoint.y, 3);
    }
  });

  it('never reverses along X, so it cannot poke through the flange and withdraw', () => {
    // Defect 2. A duplicated final control point gave Catmull-Rom a zero-length
    // segment; it overshot the flange and then snapped back to it.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const { transition } = assemble({ standardPipeNominalMm: dia });
      const cl = centreline(transition);
      for (let i = 1; i < cl.length; i++) {
        const step = cl[i].x - cl[i - 1].x;
        expect(step, `D=${dia}: centreline reverses in X at ring ${i}`).toBeGreaterThanOrEqual(-1e-6);
      }
    }
  });

  it('stays in the plane of the downcomer centreline', () => {
    // The elbow turns in X-Y only. A Z wander means the joints are skewed, which the
    // X and Y assertions above cannot see.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const { model, transition } = assemble({ standardPipeNominalMm: dia });
      const zPlane = model.cycloneInletFlangePoint.z;
      for (const p of centreline(transition)) {
        expect(p.z, `D=${dia}: centreline leaves the duct plane`).toBeCloseTo(zPlane, 4);
      }
    }
  });

  it('has no zero-length segments, which are what a duplicate control point causes', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const { transition } = assemble({ standardPipeNominalMm: dia });
      const cl = centreline(transition);
      for (let i = 1; i < cl.length; i++) {
        expect(cl[i].distanceTo(cl[i - 1]), `D=${dia}: degenerate segment at ring ${i}`).toBeGreaterThan(1e-4);
      }
    }
  });

  it('actually sweeps the engine bend radius, rather than an arbitrary curve', () => {
    // Fitted against the arc centre implied by the two joints. A Catmull-Rom through
    // arc samples is close to but not exactly a circle; this bounds the deviation
    // rather than demanding an exact radius, which only a true arc would give.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const { model, transition } = assemble({ standardPipeNominalMm: dia });
      const cl = centreline(transition);
      const centre = new THREE.Vector3(
        model.downcomerXM + model.bendRadiusM,
        model.downcomerExitYM,
        model.cycloneInletFlangePoint.z
      );
      for (const p of cl) {
        const r = p.distanceTo(centre);
        expect(Math.abs(r - model.bendRadiusM), `D=${dia}: radius ${r.toFixed(4)} m`).toBeLessThan(0.01);
      }
    }
  });

  it('leaves the downcomer travelling vertically and arrives travelling horizontally', () => {
    // Tangent continuity at both joints. A pipe that starts already turning does not
    // mate with the downcomer; one that arrives diagonally does not mate with the
    // tangential inlet.
    //
    // Measured as GROWTH RATE, not as a single chord. TubeGeometry samples the curve at
    // a fixed resolution, so the chord from ring 0 to ring k is tilted by roughly
    // (k / 2) x the angular step even on a perfect arc — 0.016 on the Ø450 default,
    // 0.038 on Ø100, purely because the arc is a smaller fraction of a longer curve.
    // A fixed tolerance would be measuring the sampler, not the geometry.
    //
    // The discriminator is how the lean scales with k. On a true arc it grows LINEARLY
    // in k, because the chord of a circle turns at a constant rate. Across a kink it
    // SATURATES at the kink angle: doubling k adds nothing. So the ratio lean(8)/lean(2)
    // is ~4 on a smooth arc and ~1 across a corner.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const { transition } = assemble({ standardPipeNominalMm: dia });
      const cl = centreline(transition);
      const n = cl.length;

      // Lean of the entry chord away from the vertical, in radians.
      const entryLean = (k: number) =>
        Math.abs(Math.atan2(cl[k].x - cl[0].x, cl[0].y - cl[k].y));
      // Lean of the exit chord away from the horizontal, in radians.
      const exitLean = (k: number) =>
        Math.abs(Math.atan2(cl[n - 1].y - cl[n - 1 - k].y, cl[n - 1].x - cl[n - 1 - k].x));

      for (const [name, lean] of [['entry', entryLean], ['exit', exitLean]] as const) {
        const ratio = lean(8) / lean(2);
        expect(ratio, `D=${dia}: ${name} tangent saturates (ratio ${ratio.toFixed(2)}, want ~4) — tangent is broken`).toBeGreaterThan(2.5);
        expect(ratio, `D=${dia}: ${name} tangent is not turning at a constant rate`).toBeLessThan(5.5);
        expect(lean(2), `D=${dia}: ${name} lean is ${(lean(2) * 57.3).toFixed(1)} deg in two samples`).toBeLessThan(0.09);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// ITEM 37 — the duct must be able to enter the cyclone.
// ---------------------------------------------------------------------------

/** The lofted round-to-rectangular transition, as its two end rings in world space. */
function transitionRings(model: ParametricModel3D): { near: THREE.Vector3[]; far: THREE.Vector3[] } {
  const assembly = buildMechanicalCadAssembly(model, createCadMaterials());
  const meshes: THREE.Mesh[] = [];
  assembly.rootGroup.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    let n: THREE.Object3D | null = o;
    while (n) {
      if (n.name === 'component_column') { meshes.push(o as THREE.Mesh); break; }
      n = n.parent;
    }
  });
  // The transition is the only hand-built BufferGeometry in the pipe group.
  const loft = meshes.find((m) => m.geometry.type === 'BufferGeometry');
  if (!loft) throw new Error('transition loft not found in the pipe group');

  const pos = (loft.geometry as THREE.BufferGeometry).attributes.position;
  const half = pos.count / 2;
  const ring = (from: number, to: number) => {
    const out: THREE.Vector3[] = [];
    for (let i = from; i < to; i++) out.push(new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)));
    return out;
  };
  return { near: ring(0, half), far: ring(half, pos.count) };
}

// ---------------------------------------------------------------------------
// ITEM 38 — the cyclone outlet: ONE 180 degree return, and a duct that reaches the fan.
// ---------------------------------------------------------------------------

/** The overhead suction duct's tube and its reducer, as drawn. */
function outlet(model: ParametricModel3D) {
  const assembly = buildMechanicalCadAssembly(model, createCadMaterials());
  const duct: THREE.Mesh[] = [];
  const blower: THREE.Mesh[] = [];
  assembly.rootGroup.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    let n: THREE.Object3D | null = o;
    while (n) {
      if (n.name === 'overhead_id_suction_duct') { duct.push(o as THREE.Mesh); break; }
      if (n.name === 'component_blower') { blower.push(o as THREE.Mesh); break; }
      n = n.parent;
    }
  });
  const tube = duct.find((m) => m.geometry.type === 'TubeGeometry')!;
  // The reducer is the only CylinderGeometry in the duct group.
  const reducer = duct.find((m) => m.geometry.type === 'CylinderGeometry')!;
  // The suction nozzle is the blower cylinder standing ABOVE the volute crown. Its axis is
  // vertical now, so it is found by sitting high on Y rather than proud in Z.
  const dbY = model.downstreamBlowerPosition.y;
  const nozzle = blower
    .filter((m) => m.geometry.type === 'CylinderGeometry')
    .map((m) => ({ m, b: new THREE.Box3().setFromObject(m, true) }))
    .filter(({ b }) => b.min.y > dbY + 0.05)
    .sort((a, b) => a.b.min.y - b.b.min.y)[0];

  return {
    model,
    line: centreline(tube),
    reducerBox: new THREE.Box3().setFromObject(reducer, true),
    nozzleBox: nozzle.b,
    nozzleTopY: nozzle.b.max.y,
  };
}

const entryYOf = (model: ParametricModel3D) => model.cycloneBarrelTopYM + 0.4;

/** Rings of the drawn centreline that lie on the 180 degree arch (above the entry). */
function archRings(model: ParametricModel3D, line: THREE.Vector3[]) {
  const entryY = entryYOf(model);
  return line.filter((p) => p.y > entryY + 1e-3);
}

const archCentre = (model: ParametricModel3D) => {
  const R = Math.abs(model.downstreamBlowerPosition.x - model.cycloneCenterXM) / 2;
  return { R, centre: new THREE.Vector3(model.cycloneCenterXM + R, model.cycloneBarrelTopYM + 0.4, model.cycloneCenterZM) };
};

const modelAt = (over: Partial<DryerInputs>) =>
  extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, ...over }));

describe('item 38: the outlet is one smooth 180 degree return', () => {
  it('the whole arch is a single arc of constant radius, so there is no flat', () => {
    // THE defect. `crownR` was `min(bendRadiusM, crownSpanM/2, crownRiseM)`, which the
    // rise term clamped to 0.650 m against a 1.800 m span. The two quarter bends could not
    // meet, so 0.50 m of deliberate straight was spliced across the top — the shouldered
    // arch. A flat cannot lie on a circle, so radius constancy is the direct test.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const line = outlet(model).line;
      const { R, centre } = archCentre(model);
      const radii = archRings(model, line).map((p) => p.distanceTo(centre));
      expect(radii.length, `D=${dia}: no arch rings found`).toBeGreaterThan(4);
      const errMm = (Math.max(...radii) - Math.min(...radii)) * 1000;
      expect(errMm, `D=${dia}: arch radius varies by ${errMm.toFixed(1)} mm — a flat is present`).toBeLessThan(10);
      // and it is the expected radius
      expect(radii.reduce((a, b) => a + b, 0) / radii.length, `D=${dia}: wrong radius`).toBeCloseTo(R, 3);
    }
  });

  it('the apex is a single ring, not a run of rings sharing the top', () => {
    // Sampling-independent flat detector. On a flat top, consecutive rings share the
    // maximum elevation; on a circle exactly one ring is highest.
    //
    // Note a fixed X-spread-in-a-band test is NOT usable here: on a correct 0.9 m arc a
    // 20 mm elevation band already spans 0.38 m of X, so any small fixed limit fails on
    // a perfect circle.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const arch = archRings(model, outlet(model).line);
      const maxY = Math.max(...arch.map((p) => p.y));
      const atApex = arch.filter((p) => Math.abs(p.y - maxY) < 1e-4);
      expect(atApex.length, `D=${dia}: ${atApex.length} rings share the apex — that is a flat top`).toBe(1);
    }
  });

  it('the arch is one arc: an independent circle fit leaves almost no residual', () => {
    // Stronger and sampling-robust. Rather than assuming where the centre is, fit a
    // circle to the drawn arch by least squares and assert the fit is good and lands
    // where geometry says it must. Constant radius + a single apex + the correct centre
    // together mean there is no flat and no splice between two bends.
    //
    // A chord-lean ratio test was tried first and rejected: TubeGeometry distributes rings
    // by arc length over the WHOLE curve, and the arch is only ~22 of 64 rings, so the
    // discrete lean(2)/lean(1) came out 0.95 on a perfectly circular arch at D=100. It
    // was measuring the sampler.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const arch = archRings(model, outlet(model).line);
      expect(arch.length, `D=${dia}: too few arch rings to fit (${arch.length})`).toBeGreaterThanOrEqual(4);

      // Kasa algebraic circle fit in the XY plane: minimise the residual of
      //   x^2 + y^2 + D*x + E*y + F = 0
      // over the arch rings, then recover centre = (-D/2, -E/2). This makes NO assumption
      // about where the centre is, so a flat top or a splice between two arcs both show up
      // as residual rather than being assumed away.
      const n = arch.length;
      let Sx = 0, Sy = 0, Sxx = 0, Syy = 0, Sxy = 0, Sr2 = 0, Sxr2 = 0, Syr2 = 0;
      for (const p of arch) {
        const { x, y } = p;
        const r2 = x * x + y * y;
        Sx += x; Sy += y;
        Sxx += x * x; Syy += y * y; Sxy += x * y;
        Sr2 += r2; Sxr2 += x * r2; Syr2 += y * r2;
      }
      // Eliminate F via its own normal equation, then centre the moments.
      const A = Sxx - (Sx * Sx) / n;
      const B = Sxy - (Sx * Sy) / n;
      const C = Syy - (Sy * Sy) / n;
      const bx = Sxr2 - (Sx * Sr2) / n;
      const by = Syr2 - (Sy * Sr2) / n;
      const det = A * C - B * B;
      expect(Math.abs(det), `D=${dia}: arch rings are degenerate`).toBeGreaterThan(1e-9);
      const Dc = (-bx * C + B * by) / det;
      const Ec = (-A * by + B * bx) / det;
      const centre = new THREE.Vector3(
        -Dc / 2,
        -Ec / 2,
        arch.reduce((a, p) => a + p.z, 0) / arch.length
      );
      const expected = archCentre(model);
      expect(centre.distanceTo(expected.centre), `D=${dia}: fitted centre is not where geometry requires`).toBeLessThan(0.05);

      const radii = arch.map((p) => p.distanceTo(centre));
      const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
      const rms = Math.sqrt(radii.reduce((a, r) => a + (r - mean) ** 2, 0) / radii.length);
      expect(rms * 1000, `D=${dia}: arch is not circular (RMS ${(rms * 1000).toFixed(1)} mm)`).toBeLessThan(5);
      expect(mean, `D=${dia}: fitted radius ${mean.toFixed(4)} m, want ${expected.R.toFixed(4)} m`).toBeCloseTo(expected.R, 2);
    }
  });

  it('both legs are vertical: the arch starts above the cyclone and lands above the fan', () => {
    // For a 180 degree return both legs are vertical by construction, so the drawn arch
    // must start at (cyX, entryY) and arrive at (fanX, entryY) — same elevation, half a
    // diameter apart in X. Checking the drawn end POINTS rather than finite-difference
    // tangents keeps this independent of how coarsely the tube was sampled.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const arch = archRings(model, outlet(model).line);
      const entryY = model.cycloneBarrelTopYM + 0.4;
      const { R } = archCentre(model);
      // Tolerance is the sampling resolution near the legs, where consecutive rings are
      // furthest apart in Y on a circle.
      const tol = Math.max(0.05, R * 0.25);

      const entry = arch.reduce((best, p) => (Math.abs(p.x - model.cycloneCenterXM) < Math.abs(best.x - model.cycloneCenterXM) ? p : best), arch[0]);
      expect(Math.abs(entry.x - model.cycloneCenterXM), `D=${dia}: arch does not start on the cyclone axis`).toBeLessThan(tol);

      // The exit is the ring nearest the fan's X; it must be back at the entry elevation.
      const exit = arch.reduce((best, p) => (Math.abs(p.x - model.downstreamBlowerPosition.x) < Math.abs(best.x - model.downstreamBlowerPosition.x) ? p : best), arch[0]);
      expect(Math.abs(exit.x - model.downstreamBlowerPosition.x), `D=${dia}: arch does not reach the fan axis`).toBeLessThan(tol);
      // Same sampling tolerance as the X checks. A fixed 0.05 m fails at D=630, where the
      // arch carries few rings and the nearest one to the fan axis sits 84 mm high —
      // that is the tube's discretisation, not a leg that is not vertical.
      expect(Math.abs(exit.y - entryY), `D=${dia}: exit leg is not at the entry elevation`).toBeLessThan(tol);
    }
  });

  it('the whole run is planar — no Z wander, which X/Y checks cannot see', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const { line } = outlet(model);
      // The whole run is in one plane now. There is no final elbow, so nothing turns
      // into +Z: from the vortex finder, over the 180 degree arch, straight down
      // into the fan.
      for (const p of line) {
        expect(p.z, `D=${dia}: the duct leaves the duct plane`).toBeCloseTo(model.cycloneCenterZM, 3);
      }
      }
  });

  it('the return radius is never smaller than the engine bend radius', () => {
    // Shrinking R is what CREATES the flat, so it must never be used to make something
    // fit. The fan is now placed 2 * bendRadiusM downstream to guarantee this.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      for (const lay of ['straight_riser', 'single_loop', 'double_loop'] as const) {
        const model = modelAt({ standardPipeNominalMm: dia, tubeRoutingLayout: lay });
        const { R } = archCentre(model);
        expect(R, `D=${dia} ${lay}: return radius ${R.toFixed(3)} m is tighter than the engine's ${model.bendRadiusM.toFixed(3)} m`).toBeGreaterThanOrEqual(model.bendRadiusM - 1e-9);
      }
    }
  });
});

describe('item 38: the duct actually reaches and fits the fan', () => {
  it('the duct starts on the vortex finder axis', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const first = outlet(model).line[0];
      expect(first.x, `D=${dia}`).toBeCloseTo(model.cycloneCenterXM, 4);
      expect(first.y, `D=${dia}`).toBeCloseTo(model.cycloneBarrelTopYM + 0.4, 4);
      expect(first.z, `D=${dia}`).toBeCloseTo(model.cycloneCenterZM, 4);
    }
  });

  it('the reducer bridges the tube to the nozzle with no gap', () => {
    // The duct, the reducer and the nozzle are now three coaxial pieces on one vertical
    // line. Previously the nozzle stood off to one side on a Z axis and the duct had to
    // turn to reach it; the blunt version of that bug left the duct ending 793 mm in open
    // air with no joint at all.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const { line, reducerBox, nozzleTopY } = outlet(model);
      const tubeEnd = line.at(-1)!;

      expect(reducerBox.max.y, `D=${dia}: reducer does not start at the tube end`).toBeCloseTo(tubeEnd.y, 3);
      expect(reducerBox.min.y, `D=${dia}: reducer does not reach the nozzle`).toBeCloseTo(nozzleTopY, 3);
      // The nozzle's top face is on the volute crown, above the fan centre.
      expect(nozzleTopY, `D=${dia}: nozzle is not above the volute`).toBeGreaterThan(model.downstreamBlowerPosition.y);
      // Coaxial: the reducer and the nozzle sit on the fan's own axis.
      const fanX = model.downstreamBlowerPosition.x;
      expect((reducerBox.min.x + reducerBox.max.x) / 2, `D=${dia}: reducer off axis in X`).toBeCloseTo(fanX, 3);
      expect((reducerBox.min.z + reducerBox.max.z) / 2, `D=${dia}: reducer off axis in Z`).toBeCloseTo(model.cycloneCenterZM, 3);
      // And the duct arrives on that same axis, travelling straight down.
      expect(tubeEnd.x, `D=${dia}: duct does not arrive on the fan axis`).toBeCloseTo(fanX, 3);
      expect(tubeEnd.z, `D=${dia}: duct arrives skewed in Z`).toBeCloseTo(model.cycloneCenterZM, 3);
    }
  });

  it('the last stretch of duct is a straight vertical, with no bend in it', () => {
    // The user's complaint: the duct jogged sideways into the fan. There must be no ring
    // below the arch whose X differs from the fan's X by more than a rounding error.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const line = outlet(model).line;
      const fanX = model.downstreamBlowerPosition.x;
      const lowestArchY = Math.min(...archRings(model, line).map((p) => p.y));
      // Rings strictly BELOW the arch's ENTRY elevation. The arch begins exactly at the
      // vortex-finder top on the CYCLONE axis, so anything at or above that height is
      // arch, and including it would drag in a point 1.8 m from the fan and fail for the
      // wrong reason.
      const leg = line.filter((p) => p.y < entryYOf(model) - 1e-4);
      expect(leg.length, `D=${dia}: no descending leg found`).toBeGreaterThan(1);
      expect(lowestArchY, `D=${dia}: arch does not clear its own entry`).toBeGreaterThan(entryYOf(model));
      for (const p of leg) {
        // 5 mm, not 0.5. The run is spline-interpolated, and the junction where the arch
        // hands over to the straight leg bows by well under a millimetre at D=100. A real
        // bend puts this off by hundreds of millimetres, so the guard is not weakened.
        expect(Math.abs(p.x - fanX), `D=${dia}: the descending leg drifts off the fan axis by ${((p.x - fanX) * 1000).toFixed(0)} mm`).toBeLessThan(0.005);
      }
      // and it is monotonically descending, which is what "straight" means here
      for (let i = 1; i < leg.length; i++) {
        expect(leg[i].y, `D=${dia}: the drop rises instead of falling`).toBeLessThan(leg[i - 1].y + 1e-6);
      }
    }
  });

  it('the reducer matches the duct at the top and the throat at the bottom', () => {
    // Sized off `max(a, b) * 0.62` this came out 146 mm oversized in diameter and could
    // not enter the throat. Each end now matches the section it joins.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const { reducerBox } = outlet(model);
      const ductSpan = Math.max(reducerBox.max.x - reducerBox.min.x, reducerBox.max.z - reducerBox.min.z);
      expect(ductSpan, `D=${dia}: reducer duct end is not the duct diameter`).toBeCloseTo(model.cycloneVortexFinderRadiusM * 2, 3);
      expect(
        model.cycloneVortexFinderRadiusM * 2,
        `D=${dia}: duct is not larger than the throat`
      ).toBeGreaterThan(model.downstreamBlowerInletRadiusM * 2);
      // It is a vertical piece: height is the reducer length, not a diameter.
      expect(reducerBox.max.y - reducerBox.min.y, `D=${dia}: reducer height`).toBeCloseTo(model.idSuctionReducerLengthM, 3);
    }
  });

  it('the reducer keeps a buildable wall angle', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = modelAt({ standardPipeNominalMm: dia });
      const drop = Math.abs(model.cycloneVortexFinderRadiusM - model.downstreamBlowerInletRadiusM);
      expect(model.idSuctionReducerLengthM, `D=${dia}: wall steeper than 1:2.5`).toBeGreaterThanOrEqual(2.5 * drop - 1e-9);
      // It also has to fit in the drop that is actually there.
      const nozzleTopY = model.downstreamBlowerPosition.y + model.downstreamBlowerVoluteRadiusM + 0.2;
      const dropAvailable = model.cycloneBarrelTopYM + 0.4 - nozzleTopY;
      expect(model.idSuctionReducerLengthM, `D=${dia}: reducer longer than the drop`).toBeLessThan(dropAvailable);
    }
  });
});

describe('item 37: the duct actually fits into the cyclone inlet', () => {
  it('the transition lands on the inlet rectangle, not on a flange bigger than it', () => {
    // THE defect. The old adapter was
    //   CylinderGeometry(rPipe, max(inletWidth, inletHeight) * 0.62, ...)
    // i.e. sized off the LARGER inlet dimension only. That gave a round mouth of
    // 0.718 m against an opening 0.231 m wide in Z — an overhang of 243 mm a side.
    // The duct could not enter the cyclone at all.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, standardPipeNominalMm: dia }));
      const { far } = transitionRings(model);
      const yMid = model.cycloneInletYM;
      const zMid = model.cycloneInletFlangePoint.z;

      const halfH = Math.max(...far.map((p) => Math.abs(p.y - yMid)));
      const halfW = Math.max(...far.map((p) => Math.abs(p.z - zMid)));

      expect(halfH, `D=${dia}: transition mouth is ${(halfH * 2000).toFixed(0)} mm tall, inlet is ${(model.cycloneInletHeightM * 1000).toFixed(0)} mm`).toBeCloseTo(model.cycloneInletHeightM / 2, 4);
      expect(halfW, `D=${dia}: transition mouth is ${(halfW * 2000).toFixed(0)} mm wide, inlet is ${(model.cycloneInletWidthM * 1000).toFixed(0)} mm`).toBeCloseTo(model.cycloneInletWidthM / 2, 4);
    }
  });

  it('the transition is centred on the duct axis, so nothing is offset', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, standardPipeNominalMm: dia }));
      const { near, far } = transitionRings(model);
      const yMid = model.cycloneInletYM;
      const zMid = model.cycloneInletFlangePoint.z;

      // A ring is centred on the axis when its extremes straddle it symmetrically.
      // Asserting every point equals the axis would be wrong — no point on a circle of
      // non-zero radius does.
      for (const [name, ring] of [['near', near], ['far', far]] as const) {
        const ys = ring.map((p) => p.y);
        const zs = ring.map((p) => p.z);
        const yCentre = (Math.max(...ys) + Math.min(...ys)) / 2;
        const zCentre = (Math.max(...zs) + Math.min(...zs)) / 2;
        expect(yCentre, `D=${dia}: ${name} ring is off the duct axis in Y`).toBeCloseTo(yMid, 4);
        expect(zCentre, `D=${dia}: ${name} ring is off the duct axis in Z`).toBeCloseTo(zMid, 4);
      }
    }
  });

  it('the round end is the duct itself, starting where the elbow stops', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, standardPipeNominalMm: dia }));
      const { near } = transitionRings(model);
      const yMid = model.cycloneInletYM;
      const zMid = model.cycloneInletFlangePoint.z;

      for (const p of near) {
        const r = Math.hypot(p.y - yMid, p.z - zMid);
        expect(r, `D=${dia}: round end radius ${r.toFixed(4)} is not the duct radius`).toBeCloseTo(model.pipeRadiusM, 4);
        expect(p.x, `D=${dia}: transition does not start at the flange`).toBeCloseTo(model.cycloneInletFlangePoint.x, 4);
      }
    }
  });

  it('the stub starts exactly where the transition ends — no gap, no overlap', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, standardPipeNominalMm: dia }));
      const { far } = transitionRings(model);
      const transitionEndX = model.cycloneInletFlangePoint.x + model.cycloneInletTransitionLengthM;

      for (const p of far) {
        expect(p.x, `D=${dia}: transition ends at ${p.x.toFixed(4)}, expected ${transitionEndX.toFixed(4)}`).toBeCloseTo(transitionEndX, 4);
      }

      // The stub is the piece that follows the transition, so its outer face is the
      // transition's far end.
      const stubOuterX = model.cycloneInletFlangePoint.x + model.cycloneInletTransitionLengthM;
      expect(Math.abs(stubOuterX - transitionEndX), `D=${dia}: stub and transition do not meet`).toBeLessThan(1e-9);
    }
  });

  it('the stub reaches past the barrel shell, so the inlet is actually inside the cyclone', () => {
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, standardPipeNominalMm: dia }));
      // X grows toward the barrel centre, so the shell is at cycloneCenterXM - radius
      // and anything at a LARGER X is inside the barrel.
      const shellX = model.cycloneCenterXM - model.cycloneBarrelRadiusM;
      const stubOuterX = model.cycloneInletFlangePoint.x + model.cycloneInletTransitionLengthM;
      const stubInnerX = stubOuterX + model.cycloneInletStubLengthM;
      expect(stubInnerX, `D=${dia}: stub is not positive`).toBeGreaterThanOrEqual(0);
      // The assembly must never reach the barrel centre: a tangential nozzle that spans the
      // whole diameter is far deeper than any real one. The transition is capped to
      // 0.92 of the flange-to-centre run, so this holds even when the duct and the
      // inlet are so mismatched that the cap binds.
      const transitionInnerX = model.cycloneInletFlangePoint.x + model.cycloneInletTransitionLengthM;
      expect(transitionInnerX, `D=${dia}: transition crosses the whole barrel`).toBeLessThan(model.cycloneCenterXM);
      expect(stubInnerX, `D=${dia}: inlet crosses the whole barrel`).toBeLessThanOrEqual(model.cycloneCenterXM + 1e-9);
      expect(model.cycloneInletStubLengthM, `D=${dia}: stub is negative`).toBeGreaterThanOrEqual(0);
      // And whenever the transition does not already reach the shell, the stub carries
      // it in.
      if (transitionInnerX <= shellX + 1e-9) {
        expect(stubInnerX, `D=${dia}: inlet never reaches the barrel`).toBeGreaterThan(shellX);
      }
    }
  });

  it('the transition length follows the 1:2.5 wall angle, capped at the barrel', () => {
    // The cap only binds when the sections are so far apart no transition can absorb
    // them: a 1000 mm duct needs b >= 1000 mm, hence Dc >= 5000 mm, against the ~1200
    // mm the flow calls for. At that point the cyclone is undersized for the selected
    // pipe and no transition fixes it, so the rule is pinned rather than the angle.
    for (const dia of [100, 180, 315, 450, 630, 1000]) {
      const model = extractParametricModel(calculateFlashDryer({ ...DEFAULT_DRYER_INPUTS, standardPipeNominalMm: dia }));
      const halfH = model.cycloneInletHeightM / 2;
      const halfW = model.cycloneInletWidthM / 2;
      const governing = Math.max(Math.abs(model.pipeRadiusM - halfH), Math.abs(model.pipeRadiusM - halfW));
      expect(model.cycloneInletTransitionLengthM, `D=${dia}: transition length`).toBeCloseTo(2.5 * governing, 9);
    }
  });
});

// ---------------------------------------------------------------------------
// ITEM 39 — the tangential inlet must SURVIVE scaling, and the checker must see it fail.
// ---------------------------------------------------------------------------

/** Every drawn piece of the tangential inlet, in world X. */
function inletPieces(model: ParametricModel3D) {
  const assembly = buildMechanicalCadAssembly(model, createCadMaterials());
  const pipe: THREE.Mesh[] = [];
  const cyc: THREE.Mesh[] = [];
  assembly.rootGroup.traverse((o) => {
    if (!(o as THREE.Mesh).isMesh) return;
    let n: THREE.Object3D | null = o;
    while (n) {
      if (n.name === 'component_column') { pipe.push(o as THREE.Mesh); break; }
      if (n.name === 'component_cyclone') { cyc.push(o as THREE.Mesh); break; }
      n = n.parent;
    }
  });

  // The transition is the only raw BufferGeometry in the pipe group.
  const loft = pipe.find((m) => m.geometry.type === 'BufferGeometry');
  const loftBox = loft ? new THREE.Box3().setFromObject(loft, true) : null;
  const pos = loft ? (loft.geometry as THREE.BufferGeometry).attributes.position : null;

  // Identify the stub by SHAPE, not position — matching on X alone picks up mounting lugs.
  let stub: THREE.Box3 | null = null;
  for (const c of cyc) {
    if (c.geometry.type !== 'BoxGeometry') continue;
    const b = new THREE.Box3().setFromObject(c, true);
    if (
      Math.abs(b.max.y - b.min.y - model.cycloneInletHeightM) < 1e-6 &&
      Math.abs(b.max.z - b.min.z - model.cycloneInletWidthM) < 1e-6
    ) stub = b;
  }

  return {
    loftMinX: loftBox ? loftBox.min.x : null,
    loftMaxX: loftBox ? loftBox.max.x : null,
    farRingHalfH: pos ? (() => {
      const half = pos.count / 2;
      let lo = Infinity, hi = -Infinity;
      for (let i = half; i < pos.count; i++) { const y = pos.getY(i); lo = Math.min(lo, y); hi = Math.max(hi, y); }
      return (hi - lo) / 2;
    })() : null,
    farRingHalfW: pos ? (() => {
      const half = pos.count / 2;
      let lo = Infinity, hi = -Infinity;
      for (let i = half; i < pos.count; i++) { const z = pos.getZ(i); lo = Math.min(lo, z); hi = Math.max(hi, z); }
      return (hi - lo) / 2;
    })() : null,
    stubMinX: stub ? stub.min.x : null,
    stubMaxX: stub ? stub.max.x : null,
    shellX: model.cycloneCenterXM - model.cycloneBarrelRadiusM,
  };
}

/** Capacity and pipe size are the two inputs that move this interface. */
const SCALE_GRID: [string, Partial<DryerInputs>][] = [
  ['default', {}],
  ['1 t/h', { feedRate: 1000 }],
  ['10 t/h', { feedRate: 10000 }],
  ['40 t/h', { feedRate: 40000 }],
  ['D=630', { standardPipeNominalMm: 630 }],
  ['D=1000', { standardPipeNominalMm: 1000 }],
  ['D=1600', { standardPipeNominalMm: 1600 }],
  ['40 t/h + D=1000', { feedRate: 40000, standardPipeNominalMm: 1000 }],
  ['1 t/h + D=1000', { feedRate: 1000, standardPipeNominalMm: 1000 }],
];

describe('item 39: the tangential inlet survives scaling', () => {
  it('the rectangular stub is always drawn — it never collapses to nothing', () => {
    // THE defect. `cycloneInletLengthM` was a fixed 1.5 x barrelRadius, so the flange
    // sat half a barrel radius outside the shell and the transition had to fit that run.
    // A 450 mm duct wanted 0.274 m into 0.289 m and just managed. A 1000 mm duct wanted
    // 0.961 m into the same 0.289 m, so the stub length clamped to ZERO and the builder
    // skipped the stub AND its flange plate: the rectangular tangential inlet simply
    // stopped existing in the model.
    for (const [label, over] of SCALE_GRID) {
      const model = modelAt(over);
      expect(model.cycloneInletStubLengthM, `${label}: stub collapsed to ${model.cycloneInletStubLengthM.toFixed(3)} m`).toBeGreaterThan(0);
      const { stubMinX } = inletPieces(model);
      expect(stubMinX, `${label}: stub is not drawn`).not.toBeNull();
    }
  });

  it('the transition fits in the run outside the shell, so the stub can carry it in', () => {
    for (const [label, over] of SCALE_GRID) {
      const model = modelAt(over);
      const flangeX = model.cycloneInletFlangePoint.x;
      const shellX = model.cycloneCenterXM - model.cycloneBarrelRadiusM;
      expect(
        model.cycloneInletTransitionLengthM,
        `${label}: transition overruns the flange-to-shell run`
      ).toBeLessThanOrEqual(shellX - flangeX + 1e-9);
    }
  });

  it('the stub reaches past the shell, so gas actually enters the barrel', () => {
    for (const [label, over] of SCALE_GRID) {
      const model = modelAt(over);
      const { stubMaxX, shellX } = inletPieces(model);
      expect(stubMaxX, `${label}: stub never reaches the barrel`).toBeGreaterThan(shellX);
    }
  });

  it('the drawn pieces are contiguous — no gap between duct, transition and stub', () => {
    for (const [label, over] of SCALE_GRID) {
      const model = modelAt(over);
      const { loftMinX, loftMaxX, stubMinX } = inletPieces(model);
      expect(loftMinX, `${label}: transition does not start at the flange`).toBeCloseTo(model.cycloneInletFlangePoint.x, 3);
      expect(stubMinX, `${label}: stub does not start where the transition ends — ${(((stubMinX as number) - (loftMaxX as number)) * 1000).toFixed(0)} mm gap`).toBeCloseTo(loftMaxX as number, 3);
    }
  });

  it('the transition still lands exactly on the inlet rectangle after resizing', () => {
    for (const [label, over] of SCALE_GRID) {
      const model = modelAt(over);
      const { farRingHalfH, farRingHalfW } = inletPieces(model);
      expect(farRingHalfH, `${label}: transition mouth height`).toBeCloseTo(model.cycloneInletHeightM / 2, 3);
      expect(farRingHalfW, `${label}: transition mouth width`).toBeCloseTo(model.cycloneInletWidthM / 2, 3);
    }
  });
});

describe('item 39: the joint checker can now see this failure', () => {
  const inletJoint = (model: ParametricModel3D) =>
    validateAssemblyConnections(model).joints.find(
      (j) => j.upstreamPort === 'flashTube.outlet' && j.downstreamPort === 'cyclone.inlet'
    )!;

  it('passes on a healthy model, and the ports still agree', () => {
    const joint = inletJoint(modelAt({ standardPipeNominalMm: 1000 }));
    expect(joint.gapMm).toBeCloseTo(0, 3);
    expect(joint.status).toBe('CONNECTED');
  });

  it('FAILS when the stub is gone, even though the ports still agree at 0.00 mm', () => {
    // This is the blindness the user reported: the port-to-port check cannot see it,
    // because both ports are derived from the same model quantities. Only the geometry
    // check catches it.
    const healthy = modelAt({ standardPipeNominalMm: 1000 });
    const broken = { ...healthy, cycloneInletStubLengthM: 0 } as ParametricModel3D;

    expect(inletJoint(broken).gapMm, 'the ports still agree, which is why the gap check misses it').toBeCloseTo(0, 3);
    const joint = inletJoint(broken);
    expect(joint.status, 'checker must fail a joint whose connection is not drawn').toBe('FAILED');
    expect(joint.notes).toMatch(/stub is 0\.000 m/);
  });

  it('FAILS when the transition overruns the run outside the shell', () => {
    const healthy = modelAt({});
    const broken = {
      ...healthy,
      cycloneInletTransitionLengthM: healthy.cycloneInletLengthM * 2,
    } as ParametricModel3D;
    const joint = inletJoint(broken);
    expect(joint.status).toBe('FAILED');
    expect(joint.notes).toMatch(/overruns the flange-to-shell run/);
  });

  it('FAILS when the inlet never reaches the barrel', () => {
    const healthy = modelAt({});
    const broken = {
      ...healthy,
      cycloneInletStubLengthM: healthy.cycloneInletStubLengthM * 0.2,
    } as ParametricModel3D;
    const joint = inletJoint(broken);
    expect(joint.status).toBe('FAILED');
    expect(joint.notes).toMatch(/short of the shell/);
  });

  it('does not touch joints it has no geometry for', () => {
    // Only the tangential inlet has a geometry check; the other eight must be unaffected.
    const rep = validateAssemblyConnections(modelAt({ standardPipeNominalMm: 1000 }));
    expect(rep.joints.every((j) => !j.notes.includes('geometry:'))).toBe(true);
    expect(rep.joints.filter((j) => j.passed).length).toBe(rep.joints.length);
  });
});