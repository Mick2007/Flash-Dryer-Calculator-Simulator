import * as THREE from 'three';
import { ParametricModel3D } from './parametricModel';
import { CadMaterials } from './materials';

export interface ComponentMeshGroup {
  id: string;
  name: string;
  group: THREE.Group;
  category: 'pipe' | 'cyclone' | 'feeder' | 'venturi' | 'heater' | 'blower' | 'airlock' | 'structure';
  basePosition: THREE.Vector3;
  explodedOffset: THREE.Vector3;
}

export interface BuildAssemblyResult {
  rootGroup: THREE.Group;
  componentGroups: Map<string, ComponentMeshGroup>;
  bounds: THREE.Box3;
}

/**
 * Creates a flanged pipe joint with raised face and visible hex bolt heads.
 */
function createFlangeJoint(
  radius: number,
  flangeThickness: number,
  materials: CadMaterials,
  boltCount: number = 8
): THREE.Group {
  const flangeGroup = new THREE.Group();
  const flangeRadius = radius * 1.55;
  const boltRadius = flangeThickness * 0.45;
  const boltCircleRadius = (radius + flangeRadius) * 0.5;

  // Flange disc
  const discGeo = new THREE.CylinderGeometry(flangeRadius, flangeRadius, flangeThickness, 24);
  const discMesh = new THREE.Mesh(discGeo, materials.stainlessSteelFlange);
  discMesh.castShadow = true;
  discMesh.receiveShadow = true;
  flangeGroup.add(discMesh);

  // Raised face
  const rfGeo = new THREE.CylinderGeometry(radius * 1.2, radius * 1.2, flangeThickness * 1.1, 24);
  const rfMesh = new THREE.Mesh(rfGeo, materials.stainlessSteel);
  flangeGroup.add(rfMesh);

  // Circumferential hex bolts
  const boltGeo = new THREE.CylinderGeometry(boltRadius, boltRadius, flangeThickness * 1.4, 6);
  for (let i = 0; i < boltCount; i++) {
    const angle = (i * 2 * Math.PI) / boltCount;
    const bolt = new THREE.Mesh(boltGeo, materials.stainlessSteelDark);
    bolt.position.set(
      boltCircleRadius * Math.cos(angle),
      0,
      boltCircleRadius * Math.sin(angle)
    );
    flangeGroup.add(bolt);
  }

  return flangeGroup;
}

/**
 * Helper to build structural steel hollow section beam.
 */
function createSteelBeam(
  length: number,
  width: number,
  depth: number,
  material: THREE.Material
): THREE.Mesh {
  const geo = new THREE.BoxGeometry(width, length, depth);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Constructs the complete 3D mechanical CAD assembly.
 */
export function buildMechanicalCadAssembly(
  params: ParametricModel3D,
  materials: CadMaterials,
  options: { isSectional?: boolean } = {}
): BuildAssemblyResult {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'flash_dryer_assembly';
  const componentGroups = new Map<string, ComponentMeshGroup>();

  const isSec = !!options.isSectional;
  const mainMat = isSec ? materials.sectionalTransparent : materials.stainlessSteel;

  // ==========================================================
  // 1. FLASH DRYING PIPE SYSTEM (Riser, Loops, & Spools)
  // ==========================================================
  const pipeGroup = new THREE.Group();
  pipeGroup.name = 'flash_pipe_system';

  const rPipe = params.pipeRadiusM;
  const venturiInX = params.venturiPosition.x - params.venturiThroatLengthM / 2 - params.venturiConvLengthM;
  const venturiEndX = params.venturiPosition.x + params.venturiThroatLengthM / 2 + params.venturiDivLengthM;
  const riserBaseX = venturiEndX + params.bendRadiusM;
  const ductY = params.venturiPosition.y;

  // ITEM 27 — the downcomer position is TAKEN FROM THE MODEL, not recomputed here.
  //
  // The geometry builder previously placed the downcomer at `riserBaseX`, i.e. on
  // the riser centreline, and ignored params.horizontalRunM entirely. The
  // parametric model solved a horizontal run to hit the engine's developed length
  // and drew its own centreline with the downcomer displaced by that run — so the
  // costed pipe and the drawn pipe were two different machines, disagreeing by up
  // to 1.5 m in X. Everything downstream of the return bend inherited the wrong
  // position, which is why the transition into the cyclone looked like a kinked
  // diagonal instead of a smooth bend.
  //
  // One source of truth: the model solves the run, the builder draws it.
  const downcomerX = params.downcomerXM;
  const downcomerExitY = params.downcomerExitYM;
  const horizontalRunM = params.horizontalRunM;
  const runStartX = downcomerX - horizontalRunM;

  // 1.1 Duct from Heat Exchanger outlet to Venturi inlet
  const hexOutX = params.hexPosition.x + params.hexWidthM / 2;
  const hexToVenturiDist = venturiInX - hexOutX;
  if (hexToVenturiDist > 0.05) {
    const ductGeo = new THREE.CylinderGeometry(rPipe, rPipe, hexToVenturiDist, 24);
    ductGeo.rotateZ(Math.PI / 2);
    const ductMesh = new THREE.Mesh(ductGeo, mainMat);
    ductMesh.position.set(hexOutX + hexToVenturiDist / 2, ductY, 0);
    ductMesh.castShadow = true;
    pipeGroup.add(ductMesh);

    // Flanged joints at ends of duct
    const hexOutFlange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
    hexOutFlange.rotation.z = Math.PI / 2;
    hexOutFlange.position.set(hexOutX, ductY, 0);
    pipeGroup.add(hexOutFlange);

    const ventInFlange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
    ventInFlange.rotation.z = Math.PI / 2;
    ventInFlange.position.set(venturiInX, ductY, 0);
    pipeGroup.add(ventInFlange);
  }

  // 1.2 90° Base Long-Radius Long-Sweep Circular Elbow
  // Exact circular arc connecting horizontal venturi outlet to vertical riser base
  const baseElbowPts: THREE.Vector3[] = [];
  const baseElbowSteps = 16;
  for (let i = 0; i <= baseElbowSteps; i++) {
    const angle = (Math.PI / 2) * (i / baseElbowSteps);
    const x = venturiEndX + params.bendRadiusM * Math.sin(angle);
    const y = ductY + params.bendRadiusM * (1 - Math.cos(angle));
    baseElbowPts.push(new THREE.Vector3(x, y, 0));
  }
  const baseElbowCurve = new THREE.CatmullRomCurve3(baseElbowPts, false, 'centripetal');
  const baseElbowGeo = new THREE.TubeGeometry(baseElbowCurve, 24, rPipe, 24, false);
  const baseElbowMesh = new THREE.Mesh(baseElbowGeo, mainMat);
  baseElbowMesh.castShadow = true;
  pipeGroup.add(baseElbowMesh);

  // Flanged Joint mating Venturi mixed outlet to base elbow inlet
  const venturiMatingFlange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
  venturiMatingFlange.rotation.z = Math.PI / 2;
  venturiMatingFlange.position.set(venturiEndX, ductY, 0);
  pipeGroup.add(venturiMatingFlange);

  // 1.3 Vertical Pneumatic Riser (True circular cylindrical spool)
  const riserGeo = new THREE.CylinderGeometry(rPipe, rPipe, params.riserHeightM, 24);
  const riserMesh = new THREE.Mesh(riserGeo, mainMat);
  riserMesh.position.set(riserBaseX, params.riserBaseYM + params.riserHeightM / 2, 0);
  riserMesh.castShadow = true;
  riserMesh.receiveShadow = true;
  pipeGroup.add(riserMesh);

  // Flanged Spool Joints along the pneumatic riser
  const riserFlangeLocations = [
    params.riserBaseYM,
    params.riserBaseYM + params.riserHeightM * 0.33,
    params.riserBaseYM + params.riserHeightM * 0.66,
    params.riserTopYM,
  ];

  riserFlangeLocations.forEach((y) => {
    const flange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
    flange.position.set(riserBaseX, y, 0);
    pipeGroup.add(flange);

    // Pipe clamp collar anchoring pipe to structural frame
    const clampRing = new THREE.Mesh(
      new THREE.CylinderGeometry(rPipe * 1.6, rPipe * 1.6, 0.05, 24),
      materials.structuralSteel
    );
    clampRing.position.set(riserBaseX, y + 0.04, 0);
    pipeGroup.add(clampRing);
  });

  // 1.4 180° Top Circular Return U-Bend
  const uBendPts: THREE.Vector3[] = [];
  const uBendSteps = 24;
  for (let i = 0; i <= uBendSteps; i++) {
    const angle = (Math.PI * i) / uBendSteps;
    const y = params.riserTopYM + params.bendRadiusM * Math.sin(angle);
    const z = -params.bendRadiusM * (1 - Math.cos(angle));
    uBendPts.push(new THREE.Vector3(riserBaseX, y, z));
  }
  const uBendCurve = new THREE.CatmullRomCurve3(uBendPts, false, 'centripetal');
  const uBendGeo = new THREE.TubeGeometry(uBendCurve, 32, rPipe, 24, false);
  const uBendMesh = new THREE.Mesh(uBendGeo, mainMat);
  uBendMesh.castShadow = true;
  pipeGroup.add(uBendMesh);

  // 1.4b Horizontal run at the top of the loop
  //
  // Drawn only when the layout solver found one. Previously this run existed in
  // the engine's developed length and in the model's centreline, but had no
  // geometry at all: the pipe jumped straight from the U-bend to a downcomer at
  // the riser X. This is the segment that pays for the loop, so it has to be
  // drawn where the solver put it.
  const downcomerZ = -params.bendRadiusM * 2;
  if (horizontalRunM > 0.01) {
    const runGeo = new THREE.CylinderGeometry(rPipe, rPipe, horizontalRunM, 24);
    runGeo.rotateZ(Math.PI / 2);
    const runMesh = new THREE.Mesh(runGeo, mainMat);
    runMesh.position.set(runStartX + horizontalRunM / 2, params.riserTopYM, downcomerZ);
    runMesh.castShadow = true;
    pipeGroup.add(runMesh);
  }

  // 1.5 Vertical Downcomer Return Pipe (True circular cylindrical spool)
  const downcomerHeight = params.riserTopYM - downcomerExitY;
  const downcomerGeo = new THREE.CylinderGeometry(rPipe, rPipe, downcomerHeight, 24);
  const downcomerMesh = new THREE.Mesh(downcomerGeo, mainMat);
  downcomerMesh.position.set(downcomerX, (params.riserTopYM + downcomerExitY) / 2, downcomerZ);
  downcomerMesh.castShadow = true;
  pipeGroup.add(downcomerMesh);

  // Flanged joint at top of downcomer mating with U-bend
  const downcomerTopFlange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
  downcomerTopFlange.position.set(downcomerX, params.riserTopYM, downcomerZ);
  pipeGroup.add(downcomerTopFlange);

  // Flanged joint at bottom of vertical downcomer
  const downcomerBotFlange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
  downcomerBotFlange.position.set(downcomerX, downcomerExitY, downcomerZ);
  pipeGroup.add(downcomerBotFlange);

  // 1.6 Transition Spool turning smoothly into Cyclone Tangential Inlet Flange
  //
  // ITEM 28 — this was the "always bent, never smooth" connection.
  //
  // The old control points were:
  //   (riserX,      exitY,  z)            descending
  //   (riserX+0.3,  exitY-0.05, z)        moving in X AND dropping in Y at once
  //   (mid,         mid,     z)           a diagonal chord
  //   (flangeX-0.35, inletY,  z)
  //   (flangeX,      inletY,  z)
  //
  // Two problems. First, the second point breaks tangent continuity: the pipe
  // leaves the vertical run already travelling diagonally, so the bend starts
  // before it has finished turning. Second, a Catmull-Rom spline through a
  // descending-then-diagonal-then-horizontal sequence OVERSHOOTS on the inside of
  // each turn, which is what produced the visible kink where the downcomer met
  // the cyclone.
  //
  // The fix is an explicit arc: leave the vertical run tangentially, sweep a
  // circular elbow of the engine's own bend radius, and then run straight and
  // horizontal into the flange. Every point is tangent-continuous by
  // construction, and the tangent at the flange is exactly -X, so it mates square
  // with the tangential inlet.
  const flangePt = params.cycloneInletFlangePoint;
  const transitionPts: THREE.Vector3[] = [];

  // Signed geometry of the turn.
  //
  // Both quantities can be NEGATIVE. An earlier version guarded on
  // `horizontalReach > 0 && rise > 0`, which skipped the elbow entirely whenever
  // either went negative and left a bare diagonal. On the IITA benchmark the
  // downcomer exits one bend radius ABOVE the inlet centreline (rise = -0.90 m), so
  // that guard was false on every load and no arc was drawn at all — the exact
  // "always bent, never smooth" defect it was written to fix.
  //
  // The elbow must therefore work in BOTH directions: descending into an inlet below
  // it and rising into one above it. `dirY` carries that sign.
  const horizontalReachM = flangePt.x - downcomerX;
  const riseM = params.cycloneInletYM - downcomerExitY;
  const dirY = Math.sign(riseM) || 1;

  if (Math.abs(horizontalReachM) > 1e-3 && Math.abs(riseM) > 1e-3) {
    // A 90-degree elbow consumes one radius along EACH axis, so it is limited by
    // whichever is tighter rather than assumed.
    const elbowR = Math.max(
      1e-3,
      Math.min(params.bendRadiusM, Math.abs(horizontalReachM), Math.abs(riseM))
    );
    // Straight lead-in along the downcomer's own axis, covering any vertical
    // distance the arc cannot, travelled TOWARD the inlet. The sign follows `dirY`,
    // so a descending elbow steps down and a rising one steps up. Its length is
    // |rise| - R, and the arc supplies exactly the remaining R.
    const leadInY = downcomerExitY + dirY * (Math.abs(riseM) - elbowR);
    // Where the arc leaves the vertical line, one radius along the exit direction.
    const arcStartX = downcomerX + Math.sign(horizontalReachM) * elbowR;
    const straightRunM = Math.abs(horizontalReachM) - elbowR;

    if (Math.abs(leadInY - downcomerExitY) > 1e-3) {
      transitionPts.push(new THREE.Vector3(downcomerX, leadInY, downcomerZ));
    }

    // ITEM 36 — the arc's TRUE START must be a control point.
    //
    // The sweep loop below starts at i = 1, so the arc's i = 0 end — the point where
    // the elbow leaves the downcomer ON THE DUCT AXIS — was never in the control list.
    // Catmull-Rom needs a neighbour on each side of a segment, so with the first
    // control point already 5.6 deg into the arc it EXTRAPOLATED backwards off the
    // axis: the drawn pipe began 29 mm downstream and 88 mm below the downcomer exit
    // even though the model put the exit exactly on it.
    transitionPts.push(
      new THREE.Vector3(
        arcStartX - Math.sign(horizontalReachM) * elbowR,
        leadInY,
        downcomerZ
      )
    );

    // Quarter circle, centre at (arcStartX, leadInY).
    //
    // The start lies at 180 deg from the centre — directly inboard, on the
    // downcomer axis — and the end at 180 deg minus a quarter turn in the exit
    // direction, which puts the tangent horizontal exactly at the inlet elevation.
    // Sweeping 180 -> 270 turns downward into a lower inlet; 180 -> 90 turns upward.
    const elbowSteps = 16;
    const startDeg = 180;
    const endDeg = 180 - dirY * 90;
    for (let i = 1; i <= elbowSteps; i++) {
      const deg = startDeg + ((endDeg - startDeg) * i) / elbowSteps;
      const rad = (deg * Math.PI) / 180;
      transitionPts.push(
        new THREE.Vector3(
          arcStartX + elbowR * Math.cos(rad),
          leadInY + elbowR * Math.sin(rad),
          downcomerZ
        )
      );
    }

    // Straight horizontal run into the flange, on the horizontal tangent.
    if (straightRunM > 1e-3) {
      transitionPts.push(
        new THREE.Vector3(
          arcStartX + (Math.sign(horizontalReachM) * straightRunM) / 2,
          params.cycloneInletYM,
          downcomerZ
        )
      );
    }
  }

  // ITEM 36 — the flange is only a control point if the curve has not already
  // arrived there.
  //
  // This push was unconditional, but the arc's 270 deg sample is ALREADY
  // (flangePt.x, cycloneInletYM): reach and rise are both one bend radius, so the
  // elbow's last point and this one are the same vector. Two identical consecutive
  // control points give Catmull-Rom a zero-length segment, which it cannot
  // interpolate — it overshot to x = 4.9826 (29 mm PAST the flange face) and then
  // snapped back to 4.9534 on the final sample. That reversal is the visible
  // "the duct has shifted and is not connected to the cyclone": the pipe visibly
  // pokes through the mating flange and withdraws again.
  const lastPt = transitionPts[transitionPts.length - 1];
  if (
    !lastPt ||
    Math.abs(lastPt.x - flangePt.x) > 1e-6 ||
    Math.abs(lastPt.y - params.cycloneInletYM) > 1e-6
  ) {
    transitionPts.push(new THREE.Vector3(flangePt.x, params.cycloneInletYM, downcomerZ));
  }

  // 'centripetal' rather than 'catmullrom': it cannot overshoot between control
  // points, so even the straight sections cannot bow.
  const transitionCurve = new THREE.CatmullRomCurve3(transitionPts, false, 'centripetal');
  const transitionGeo = new THREE.TubeGeometry(transitionCurve, 48, rPipe, 24, false);
  const transitionMesh = new THREE.Mesh(transitionGeo, mainMat);
  transitionMesh.castShadow = true;
  pipeGroup.add(transitionMesh);

  // Connecting duct flange right at the cyclone inlet connection point
  const inletFlangeJoint = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
  inletFlangeJoint.rotation.z = Math.PI / 2;
  inletFlangeJoint.position.set(
    params.cycloneInletFlangePoint.x,
    params.cycloneInletFlangePoint.y,
    params.cycloneInletFlangePoint.z
  );
  pipeGroup.add(inletFlangeJoint);

  // ITEM 37 — the transition from the round flash duct to the rectangular tangential
  // inlet.
  //
  // This was a cone:
  //
  //     new CylinderGeometry(rPipe, max(inletWidth, inletHeight) * 0.62, 0.18, 24)
  //
  // sized off the LARGER inlet dimension only. That produced a round mouth of
  // 0.718 m — max(0.231, 0.579) x 1.24 — pressed flat against an opening 0.231 m wide
  // in Z. The mouth overhung the slot by 243 mm on each side in Z and 69 mm top and
  // bottom in Y, so the duct could not enter the cyclone at all. The gas path was
  // blocked and the joint read as a funnel sitting on the outside of the barrel, which
  // is the "shifted and not properly connected" symptom.
  //
  // It is now a real lofted transition. Both ends are generated from the same
  // parameter sweep, so the far end is the inlet rectangle EXACTLY:
  //
  //     round end   x = flange.x,                  |y| <= R,   |z| <= R
  //     rect end    x = flange.x + transitionLen,  |y| <= a/2, |z| <= b/2
  //
  // with a = inletHeight, b = inletWidth, both centred on the duct axis. The rectangle
  // point for a given direction is t * (cos, sin) with t = min(halfH/|cos|, halfW/|sin|),
  // so the sweep stays monotone and the walls do not cross.
  const transitionLen = params.cycloneInletTransitionLengthM;
  const halfH = params.cycloneInletHeightM / 2;
  const halfW = params.cycloneInletWidthM / 2;
  const segs = 48;
  const ringPts: THREE.Vector3[][] = [[], []];

  for (let i = 0; i < segs; i++) {
    const th = (2 * Math.PI * i) / segs;
    const c = Math.cos(th);
    const s = Math.sin(th);
    // Round end, in the Y-Z plane measured from +Y.
    ringPts[0].push(
      new THREE.Vector3(
        params.cycloneInletFlangePoint.x,
        params.cycloneInletFlangePoint.y + rPipe * c,
        params.cycloneInletFlangePoint.z + rPipe * s
      )
    );
    // Rectangle end, same direction, clamped to the rectangle boundary.
    const t = Math.min(
      Math.abs(c) < 1e-9 ? Infinity : halfH / Math.abs(c),
      Math.abs(s) < 1e-9 ? Infinity : halfW / Math.abs(s)
    );
    ringPts[1].push(
      new THREE.Vector3(
        params.cycloneInletFlangePoint.x + transitionLen,
        params.cycloneInletFlangePoint.y + t * c,
        params.cycloneInletFlangePoint.z + t * s
      )
    );
  }

  {
    const pos: number[] = [];
    const idx: number[] = [];
    for (const p of ringPts[0]) pos.push(p.x, p.y, p.z);
    for (const p of ringPts[1]) pos.push(p.x, p.y, p.z);
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % segs;
      const a0 = i;
      const b0 = segs + i;
      const a1 = j;
      const b1 = segs + j;
      idx.push(a0, b0, b1, a0, b1, a1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    const mesh = new THREE.Mesh(g, materials.stainlessSteel);
    mesh.castShadow = true;
    pipeGroup.add(mesh);
  }

  pipeGroup.name = 'component_column';
  componentGroups.set('column', {
    id: 'column',
    name: 'Flash Drying Pipe Riser Assembly',
    group: pipeGroup,
    category: 'pipe',
    basePosition: new THREE.Vector3(0, 0, 0),
    explodedOffset: new THREE.Vector3(0, 0.8, 0),
  });
  rootGroup.add(pipeGroup);

  // ==========================================================
  // 2. CYCLONE SEPARATOR (Grounded, Strictly Sized Solid)
  // ==========================================================
  const cycloneGroup = new THREE.Group();
  cycloneGroup.name = 'cyclone_separator';

  const cyR = params.cycloneBarrelRadiusM;
  const cyH = params.cycloneCylinderHeightM;
  const coneH = params.cycloneConeHeightM;
  const dustR = params.cycloneDustOutletRadiusM;
  const vfR = params.cycloneVortexFinderRadiusM;
  const vfL = params.cycloneVortexFinderLengthM;

  // Upper Cylindrical Barrel (from local Y=0 to Y=cyH)
  // In sectional mode, cut open a 90-degree quadrant (Math.PI * 0.25 to Math.PI * 1.5)
  const barrelGeo = isSec
    ? new THREE.CylinderGeometry(cyR, cyR, cyH, 32, 1, false, Math.PI * 0.25, Math.PI * 1.5)
    : new THREE.CylinderGeometry(cyR, cyR, cyH, 32, 1, false);
  const barrelMesh = new THREE.Mesh(barrelGeo, mainMat);
  barrelMesh.position.set(0, cyH / 2, 0);
  barrelMesh.castShadow = true;
  barrelMesh.receiveShadow = true;
  cycloneGroup.add(barrelMesh);

  // Top Annular Cover Plate
  const topCoverGeo = isSec
    ? new THREE.CylinderGeometry(cyR * 1.05, cyR * 1.05, 0.02, 32, 1, false, Math.PI * 0.25, Math.PI * 1.5)
    : new THREE.CylinderGeometry(cyR * 1.05, cyR * 1.05, 0.02, 32);
  const topCoverMesh = new THREE.Mesh(topCoverGeo, materials.stainlessSteelFlange);
  topCoverMesh.position.set(0, cyH + 0.01, 0);
  cycloneGroup.add(topCoverMesh);

  // Conical Lower Section (from local Y=0 to Y=-coneH)
  const coneGeo = isSec
    ? new THREE.CylinderGeometry(cyR, dustR, coneH, 32, 1, false, Math.PI * 0.25, Math.PI * 1.5)
    : new THREE.CylinderGeometry(cyR, dustR, coneH, 32, 1, false);
  const coneMesh = new THREE.Mesh(coneGeo, mainMat);
  coneMesh.position.set(0, -coneH / 2, 0);
  coneMesh.castShadow = true;
  coneMesh.receiveShadow = true;
  cycloneGroup.add(coneMesh);

  // Internal descending vortex spiral streamline (visible in cutaway view)
  if (isSec) {
    const spiralPts: THREE.Vector3[] = [];
    const turns = 4;
    const spiralSteps = 60;
    for (let s = 0; s <= spiralSteps; s++) {
      const t = s / spiralSteps;
      const angle = t * turns * Math.PI * 2;
      const curY = cyH * 0.9 - t * (cyH * 0.9 + coneH * 0.85);
      const curR = curY >= 0 ? cyR * 0.65 : Math.max(dustR * 1.2, cyR * 0.65 * (1 - Math.abs(curY) / coneH * 0.8));
      spiralPts.push(new THREE.Vector3(curR * Math.cos(angle), curY, curR * Math.sin(angle)));
    }
    const spiralCurve = new THREE.CatmullRomCurve3(spiralPts);
    const spiralGeo = new THREE.TubeGeometry(spiralCurve, 64, 0.016, 8, false);
    const spiralMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const spiralMesh = new THREE.Mesh(spiralGeo, spiralMat);
    cycloneGroup.add(spiralMesh);
  }

  // Bottom Dust Outlet Spool & Flange
  const dustSpoolGeo = new THREE.CylinderGeometry(dustR, dustR, 0.15, 24);
  const dustSpoolMesh = new THREE.Mesh(dustSpoolGeo, materials.stainlessSteel);
  dustSpoolMesh.position.set(0, -coneH - 0.075, 0);
  cycloneGroup.add(dustSpoolMesh);

  const dustFlange = createFlangeJoint(dustR, 0.014, materials, 6);
  dustFlange.position.set(0, -coneH - 0.15, 0);
  cycloneGroup.add(dustFlange);

  // Top Vortex Finder Tube (penetrating inside and extending out)
  const vfGeo = new THREE.CylinderGeometry(vfR, vfR, vfL + 0.4, 24);
  const vfMesh = new THREE.Mesh(vfGeo, materials.stainlessSteel);
  vfMesh.position.set(0, cyH - (vfL / 2) + 0.2, 0);
  vfMesh.castShadow = true;
  cycloneGroup.add(vfMesh);

  // Vortex Finder Top Discharge Flange & Exhaust Stack
  const vfFlange = createFlangeJoint(vfR, 0.014, materials, 8);
  vfFlange.position.set(0, cyH + 0.4, 0);
  cycloneGroup.add(vfFlange);

  // Exhaust Stack: In POSITIVE pressure mode, cyclone discharges via a 90° atmospheric sweep stack
  if (!params.hasDownstreamBlower) {
    const stackPts = [
      new THREE.Vector3(0, cyH + 0.4, 0),
      new THREE.Vector3(0, cyH + 1.0, 0),
      new THREE.Vector3(0.3, cyH + 1.3, 0),
      new THREE.Vector3(0.8, cyH + 1.4, 0),
    ];
    const stackCurve = new THREE.CatmullRomCurve3(stackPts, false, 'catmullrom', 0.2);
    const stackGeo = new THREE.TubeGeometry(stackCurve, 24, vfR, 20, false);
    const stackMesh = new THREE.Mesh(stackGeo, materials.stainlessSteel);
    stackMesh.castShadow = true;
    cycloneGroup.add(stackMesh);

    // Weather cowl / diffuser hood at stack discharge
    const cowlGeo = new THREE.ConeGeometry(vfR * 1.5, 0.25, 20);
    cowlGeo.rotateZ(-Math.PI / 2);
    const cowlMesh = new THREE.Mesh(cowlGeo, materials.stainlessSteelDark);
    cowlMesh.position.set(0.92, cyH + 1.4, 0);
    cycloneGroup.add(cowlMesh);
  }

  // ITEM 37 — the tangential stub that actually enters the barrel.
  //
  // This used to span the FULL flange-to-centre distance and started at the flange, so
  // it ran the whole length of the transition as well. With the transition now taking
  // `cycloneInletTransitionLengthM`, the stub starts where the transition ENDS and is
  // `cycloneInletStubLengthM` long. Otherwise the two overlap and the transition's
  // rectangular end is buried inside the stub, so the section change never reads.
  const inletWidth = params.cycloneInletWidthM;
  const inletHeight = params.cycloneInletHeightM;
  const stubLength = params.cycloneInletStubLengthM;
  // Local X of the stub's outer face = where the transition ends. The flange face is
  // at local -cycloneInletLengthM, so the transition starts there and runs forward.
  const stubOuterX = -params.cycloneInletLengthM + params.cycloneInletTransitionLengthM;

  // The stub is omitted entirely when the transition already reaches the target
  // penetration — which happens only for duct/inlet combinations so mismatched that no
  // transition can absorb them. Drawing a zero-length box would add a stray plane.
  if (stubLength > 1e-6) {
    const inletBoxGeo = new THREE.BoxGeometry(stubLength, inletHeight, inletWidth);
    const inletBox = new THREE.Mesh(inletBoxGeo, materials.stainlessSteel);
    inletBox.position.set(
      stubOuterX + stubLength / 2,
      cyH - inletHeight / 2 - 0.04,
      cyR - inletWidth / 2
    );
    inletBox.castShadow = true;
    cycloneGroup.add(inletBox);

    // ITEM 37 — the connection flange belongs on the stub's outer face, which is where
    // the transition lands. It was on the flange, i.e. a whole transition-length
    // upstream, leaving the transition's rectangular end unsupported and visibly
    // detached from the joint that is supposed to carry it.
    const inletFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, inletHeight * 1.25, inletWidth * 1.25),
      materials.stainlessSteelFlange
    );
    inletFlange.position.set(
      stubOuterX - 0.01,
      cyH - inletHeight / 2 - 0.04,
      cyR - inletWidth / 2
    );
    cycloneGroup.add(inletFlange);
  }

  // Four Structural Mounting Lugs on Cyclone Barrel Waist
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const bracket = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.14, 0.12),
      materials.structuralSteel
    );
    bracket.position.set(
      (cyR + 0.08) * Math.cos(angle),
      cyH * 0.40,
      (cyR + 0.08) * Math.sin(angle)
    );
    cycloneGroup.add(bracket);
  }

  // Anchor cycloneGroup at world coordinates (X, JunctionY, Z)
  cycloneGroup.position.set(params.cycloneCenterXM, params.cycloneJunctionYM, params.cycloneCenterZM);

  cycloneGroup.name = 'component_cyclone';
  componentGroups.set('cyclone', {
    id: 'cyclone',
    name: 'Cyclone Separator Assembly',
    group: cycloneGroup,
    category: 'cyclone',
    basePosition: new THREE.Vector3(params.cycloneCenterXM, params.cycloneJunctionYM, params.cycloneCenterZM),
    explodedOffset: new THREE.Vector3(1.2, 0.5, 0),
  });
  rootGroup.add(cycloneGroup);

  // ==========================================================
  // 3. VENTURI GAS ACCELERATOR & MIXING SECTION
  // ==========================================================
  const venturiGroup = new THREE.Group();
  venturiGroup.name = 'venturi_section';

  const rTh = params.venturiThroatRadiusM;
  const rIn = params.venturiInletRadiusM;
  const lConv = params.venturiConvLengthM;
  const lTh = params.venturiThroatLengthM;
  const lDiv = params.venturiDivLengthM;

  // Convergent Cone (tapers from rIn down to rTh at throat inlet)
  const convGeo = isSec
    ? new THREE.CylinderGeometry(rTh, rIn, lConv, 24, 1, false, 0, Math.PI * 1.5)
    : new THREE.CylinderGeometry(rTh, rIn, lConv, 24, 1, false);
  convGeo.rotateZ(Math.PI / 2);
  const convMesh = new THREE.Mesh(convGeo, mainMat);
  convMesh.position.set(-lTh / 2 - lConv / 2, 0, 0);
  convMesh.castShadow = true;
  venturiGroup.add(convMesh);

  // Cylindrical Throat (centered symmetrically at X = 0)
  const throatGeo = isSec
    ? new THREE.CylinderGeometry(rTh, rTh, lTh, 24, 1, false, 0, Math.PI * 1.5)
    : new THREE.CylinderGeometry(rTh, rTh, lTh, 24, 1, false);
  throatGeo.rotateZ(Math.PI / 2);
  const throatMesh = new THREE.Mesh(throatGeo, materials.stainlessSteelFlange);
  throatMesh.position.set(0, 0, 0);
  throatMesh.castShadow = true;
  venturiGroup.add(throatMesh);

  // Divergent Cone (diffuser expanding from rTh up to rIn)
  const divGeo = isSec
    ? new THREE.CylinderGeometry(rIn, rTh, lDiv, 24, 1, false, 0, Math.PI * 1.5)
    : new THREE.CylinderGeometry(rIn, rTh, lDiv, 24, 1, false);
  divGeo.rotateZ(Math.PI / 2);
  const divMesh = new THREE.Mesh(divGeo, mainMat);
  divMesh.position.set(lTh / 2 + lDiv / 2, 0, 0);
  divMesh.castShadow = true;
  venturiGroup.add(divMesh);

  // Wet Mash Injection Port on top of throat (centered at X = 0 to mate flush with feeder chute)
  const portGeo = new THREE.CylinderGeometry(rTh * 0.8, rTh * 0.8, 0.22, 16);
  const portMesh = new THREE.Mesh(portGeo, materials.stainlessSteel);
  portMesh.position.set(0, rTh + 0.11, 0);
  venturiGroup.add(portMesh);

  const portFlange = createFlangeJoint(rTh * 0.8, 0.012, materials, 4);
  portFlange.position.set(0, rTh + 0.22, 0);
  venturiGroup.add(portFlange);

  // Inspection / clean-out door on bottom of throat
  const cleanoutGeo = new THREE.CylinderGeometry(rTh * 0.65, rTh * 0.65, 0.12, 16);
  const cleanoutMesh = new THREE.Mesh(cleanoutGeo, materials.stainlessSteelDark);
  cleanoutMesh.position.set(0, -rTh - 0.06, 0);
  venturiGroup.add(cleanoutMesh);

  // Venturi Structural Support Stool down to ground Y=0
  const stoolHeight = params.venturiPosition.y - rIn;
  const stool = createSteelBeam(stoolHeight, 0.08, 0.08, materials.structuralSteel);
  stool.position.set(0, -rIn - stoolHeight / 2, 0);
  venturiGroup.add(stool);

  const stoolBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.016, 0.24), materials.structuralSteel);
  stoolBaseplate.position.set(0, -rIn - stoolHeight + 0.008, 0);
  venturiGroup.add(stoolBaseplate);

  // Balanced Pressure Mode: Neutral Reference Static Pressure Tap & Transducer
  if (params.pressureMode === 'balanced') {
    const tapStemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.12, 12);
    tapStemGeo.rotateX(Math.PI / 2);
    const tapStem = new THREE.Mesh(tapStemGeo, materials.stainlessSteel);
    tapStem.position.set(0, 0, rTh + 0.06);
    venturiGroup.add(tapStem);

    // Differential pressure transmitter box (calibrated to 0 Pa gauge)
    const dptBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.14, 0.09),
      materials.motorBlue
    );
    dptBox.position.set(0, 0, rTh + 0.16);
    venturiGroup.add(dptBox);

    // Green LED neutral indicator light
    const ledMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 12, 12),
      new THREE.MeshBasicMaterial({ color: 0x10b981 })
    );
    ledMesh.position.set(0, 0.04, rTh + 0.21);
    venturiGroup.add(ledMesh);
  }

  venturiGroup.position.set(params.venturiPosition.x, params.venturiPosition.y, params.venturiPosition.z);

  venturiGroup.name = 'component_venturi';
  componentGroups.set('venturi', {
    id: 'venturi',
    name: 'Venturi Gas Accelerator & Mixer',
    group: venturiGroup,
    category: 'venturi',
    basePosition: new THREE.Vector3(params.venturiPosition.x, params.venturiPosition.y, params.venturiPosition.z),
    explodedOffset: new THREE.Vector3(-0.4, -0.4, 0),
  });
  rootGroup.add(venturiGroup);

  // ==========================================================
  // 4. WET FEED HOPPER & DISINTEGRATOR SCREW CONVEYOR (IITA Standard 2-Part Geometry)
  // ==========================================================
  const feederGroup = new THREE.Group();
  feederGroup.name = 'feed_system';

  const hopW1 = params.hopperTopWidthM;
  const hopL1 = params.hopperTopLengthM;
  const hopW2 = params.hopperOutletWidthM ?? 0.32;
  const hopL2 = params.hopperOutletLengthM ?? 0.22;
  const h1 = params.hopperUpperHeightM ?? 0.10;
  const h2 = params.hopperLowerHeightM ?? 0.556;
  const screwR = params.screwRadiusM;
  const screwL = params.screwBarrelLengthM;
  const screwPitch = params.screwPitchM ?? (screwR * 2);
  const shaftR = params.screwShaftRadiusM ?? (screwR * 0.38);

  // A. Upper Straight Vertical Collar (Height h1, Dimensions W1 x L1)
  const collarBoxGeo = new THREE.BoxGeometry(hopW1, h1, hopL1);
  const collarMesh = new THREE.Mesh(collarBoxGeo, materials.stainlessSteel);
  collarMesh.position.set(0, h2 + h1 / 2, 0);
  collarMesh.castShadow = true;
  feederGroup.add(collarMesh);

  // Top Stiffener Angle Rim
  const rimGeo = new THREE.BoxGeometry(hopW1 * 1.05, 0.025, hopL1 * 1.05);
  const rimMesh = new THREE.Mesh(rimGeo, materials.stainlessSteelFlange);
  rimMesh.position.set(0, h2 + h1, 0);
  feederGroup.add(rimMesh);

  // B. Lower Tapered Pyramidal Frustum (Height h2, Transitioning W1xL1 down to W2xL2)
  const w1h = hopW1 / 2;
  const l1h = hopL1 / 2;
  const w2h = hopW2 / 2;
  const l2h = hopL2 / 2;

  const frustumVertices = new Float32Array([
    // Front Wall (+Z)
    -w1h, h2,  l1h,    w1h, h2,  l1h,    w2h,  0,  l2h,
    -w1h, h2,  l1h,    w2h,  0,  l2h,   -w2h,  0,  l2h,
    // Back Wall (-Z)
     w1h, h2, -l1h,   -w1h, h2, -l1h,   -w2h,  0, -l2h,
     w1h, h2, -l1h,   -w2h,  0, -l2h,    w2h,  0, -l2h,
    // Right Side Wall (+X)
     w1h, h2,  l1h,    w1h, h2, -l1h,    w2h,  0, -l2h,
     w1h, h2,  l1h,    w2h,  0, -l2h,    w2h,  0,  l2h,
    // Left Side Wall (-X)
    -w1h, h2, -l1h,   -w1h, h2,  l1h,   -w2h,  0,  l2h,
    -w1h, h2, -l1h,   -w2h,  0,  l2h,   -w2h,  0, -l2h,
  ]);
  const frustumGeo = new THREE.BufferGeometry();
  frustumGeo.setAttribute('position', new THREE.BufferAttribute(frustumVertices, 3));
  frustumGeo.computeVertexNormals();
  const frustumMesh = new THREE.Mesh(frustumGeo, materials.stainlessSteel);
  frustumMesh.castShadow = true;
  feederGroup.add(frustumMesh);

  // Four Corner Valley Seams in Glowing Amber
  const valleyPoints = [
    new THREE.Vector3(w1h, h2, l1h), new THREE.Vector3(w2h, 0, l2h),
    new THREE.Vector3(-w1h, h2, l1h), new THREE.Vector3(-w2h, 0, l2h),
    new THREE.Vector3(-w1h, h2, -l1h), new THREE.Vector3(-w2h, 0, -l2h),
    new THREE.Vector3(w1h, h2, -l1h), new THREE.Vector3(w2h, 0, -l2h),
  ];
  const valleyGeo = new THREE.BufferGeometry().setFromPoints(valleyPoints);
  const valleyLines = new THREE.LineSegments(
    valleyGeo,
    new THREE.LineBasicMaterial({ color: 0xf59e0b, linewidth: 2 })
  );
  feederGroup.add(valleyLines);

  // C. Cylindrical / U-Trough Auger Barrel
  const augerGeo = new THREE.CylinderGeometry(screwR, screwR, screwL, 20);
  augerGeo.rotateZ(Math.PI / 2);
  const augerMesh = new THREE.Mesh(augerGeo, materials.stainlessSteel);
  augerMesh.position.set(0, -screwR * 1.1, 0);
  augerMesh.castShadow = true;
  feederGroup.add(augerMesh);

  // Center Shaft (Ø38 mm)
  const shaftGeo = new THREE.CylinderGeometry(shaftR, shaftR, screwL + 0.15, 16);
  shaftGeo.rotateZ(Math.PI / 2);
  const shaftMesh = new THREE.Mesh(shaftGeo, materials.stainlessSteelDark);
  shaftMesh.position.set(0, -screwR * 1.1, 0);
  feederGroup.add(shaftMesh);

  // Helical Screw Flighting
  const flightCount = Math.max(3, Math.round(screwL / Math.max(0.08, screwPitch)));
  for (let f = 0; f < flightCount; f++) {
    const flightX = -screwL / 2 + f * screwPitch + screwPitch / 2;
    const ringGeo = new THREE.TorusGeometry(screwR * 0.75, screwR * 0.22, 8, 20);
    ringGeo.rotateY(Math.PI / 2 + 0.35); // Slanted like flight angle
    const ringMesh = new THREE.Mesh(ringGeo, materials.stainlessSteel);
    ringMesh.position.set(flightX, -screwR * 1.1, 0);
    feederGroup.add(ringMesh);
  }

  // D. Feeder Electric Motor & Gearbox
  const motorR = screwR * 1.15;
  const motorL = params.screwMotorLengthM;
  const motorGeo = new THREE.CylinderGeometry(motorR, motorR, motorL, 16);
  motorGeo.rotateZ(Math.PI / 2);
  const motorMesh = new THREE.Mesh(motorGeo, materials.motorBlue);
  motorMesh.position.set(-screwL / 2 - motorL / 2 - 0.05, -screwR * 1.1, 0);
  motorMesh.castShadow = true;
  feederGroup.add(motorMesh);

  const gearboxMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, motorR * 2.2, motorR * 2.2),
    materials.structuralSteel
  );
  gearboxMesh.position.set(-screwL / 2 - 0.04, -screwR * 1.1, 0);
  feederGroup.add(gearboxMesh);

  // Vertical Discharge Chute Dropping into Venturi Top Port
  const venturiTopPortY = params.venturiPosition.y + rTh + 0.22;
  const chuteStartY = params.feederPosition.y - screwR;
  const chuteHeight = Math.max(0.15, chuteStartY - venturiTopPortY);
  const chuteGeo = new THREE.CylinderGeometry(screwR * 0.85, rTh * 0.8, chuteHeight, 16);
  const chuteMesh = new THREE.Mesh(chuteGeo, materials.stainlessSteel);
  const chuteLocalX = params.venturiPosition.x - params.feederPosition.x;
  const chuteLocalZ = 0 - params.feederPosition.z;
  chuteMesh.position.set(chuteLocalX, -screwR - chuteHeight / 2, chuteLocalZ);
  chuteMesh.castShadow = true;
  feederGroup.add(chuteMesh);

  // Mating Flange at bottom of chute, flush with venturi port flange
  const chuteFlange = createFlangeJoint(rTh * 0.8, 0.012, materials, 4);
  chuteFlange.position.set(chuteLocalX, -screwR - chuteHeight, chuteLocalZ);
  feederGroup.add(chuteFlange);

  // Structural Support Legs down to Ground Y=0
  const feederLegH = params.feederPosition.y - screwR;
  const feederLeg1 = createSteelBeam(feederLegH, 0.06, 0.06, materials.structuralSteel);
  feederLeg1.position.set(-hopL1 * 0.35, -feederLegH / 2, hopW1 * 0.35);
  feederGroup.add(feederLeg1);

  const feederLeg2 = createSteelBeam(feederLegH, 0.06, 0.06, materials.structuralSteel);
  feederLeg2.position.set(-hopL1 * 0.35, -feederLegH / 2, -hopW1 * 0.35);
  feederGroup.add(feederLeg2);

  feederGroup.position.set(params.feederPosition.x, params.feederPosition.y, params.feederPosition.z);

  feederGroup.name = 'component_feeder';
  componentGroups.set('feeder', {
    id: 'feeder',
    name: 'Wet Mash Feeder & Lump Disintegrator',
    group: feederGroup,
    category: 'feeder',
    basePosition: new THREE.Vector3(params.feederPosition.x, params.feederPosition.y, params.feederPosition.z),
    explodedOffset: new THREE.Vector3(0, 0.6, 0.6),
  });
  rootGroup.add(feederGroup);

  // ==========================================================
  // 5. MULTI-PASS AIR HEAT EXCHANGER (Grounded at Y=0)
  // ==========================================================
  const hexGroup = new THREE.Group();
  hexGroup.name = 'heat_exchanger';

  const hW = params.hexWidthM;
  const hD = params.hexDepthM;
  const hH = params.hexHeightM;

  // Main Insulated Enclosure Box
  const hexBoxGeo = new THREE.BoxGeometry(hW, hH, hD);
  const hexBox = new THREE.Mesh(hexBoxGeo, materials.insulationJacket);
  hexBox.castShadow = true;
  hexBox.receiveShadow = true;
  hexGroup.add(hexBox);

  // Structural Framing C-Channels along enclosure edges
  const channelThick = 0.04;
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.06, channelThick, hD + 0.06), materials.structuralSteel);
  topFrame.position.set(0, hH / 2, 0);
  hexGroup.add(topFrame);

  const botFrame = new THREE.Mesh(new THREE.BoxGeometry(hW + 0.06, channelThick, hD + 0.06), materials.structuralSteel);
  botFrame.position.set(0, -hH / 2, 0);
  hexGroup.add(botFrame);

  // Front Bolted Tube Sheet Access Cover (semi-transparent or cutaway in sectional view)
  const coverPlateMat = isSec ? materials.sectionalTransparent : materials.stainlessSteelFlange;
  const coverPlate = new THREE.Mesh(
    new THREE.BoxGeometry(hW * 0.94, hH * 0.88, 0.03),
    coverPlateMat
  );
  coverPlate.position.set(0, 0, hD / 2 + 0.015);
  hexGroup.add(coverPlate);

  // Internal multi-pass tube bundle (rendered in sectional view)
  if (isSec) {
    const rows = 4;
    const cols = 6;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tGeo = new THREE.CylinderGeometry(0.02, 0.02, hD * 0.88, 12);
        tGeo.rotateX(Math.PI / 2);
        const tMesh = new THREE.Mesh(tGeo, materials.brass);
        tMesh.position.set(
          (c / (cols - 1) - 0.5) * (hW * 0.76),
          (r / (rows - 1) - 0.5) * (hH * 0.65),
          0
        );
        hexGroup.add(tMesh);
      }
    }
  }

  // Multi-pass divider channels
  const passes = params.hexPasses;
  for (let p = 1; p < passes; p++) {
    const divY = (p / passes - 0.5) * (hH * 0.8);
    const divider = new THREE.Mesh(
      new THREE.BoxGeometry(hW * 0.9, 0.02, 0.04),
      materials.structuralSteel
    );
    divider.position.set(0, divY, hD / 2 + 0.025);
    hexGroup.add(divider);
  }

  // Hot Flue Gas Inlet & Outlet Nozzles
  const flueInlet = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.28, 16), materials.castIron);
  flueInlet.position.set(0, hH / 2 + 0.14, 0);
  hexGroup.add(flueInlet);

  const flueFlange = createFlangeJoint(0.12, 0.016, materials, 6);
  flueFlange.position.set(0, hH / 2 + 0.28, 0);
  hexGroup.add(flueFlange);

  // Air Intake on Left Face of Heat Exchanger:
  if (params.hasUpstreamBlower) {
    // POSITIVE & BALANCED MODES: Flanged collar mating with upstream blower discharge duct
    const ubR = params.upstreamBlowerVoluteRadiusM || params.blowerVoluteRadiusM;
    const ubW = params.upstreamBlowerWidthM || params.blowerWidthM;
    const hexInletLocalY = (params.upstreamBlowerPosition.y + ubR * 0.55) - params.hexPosition.y;

    const hexInCollar = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, ubR * 0.5, ubW * 0.8),
      materials.stainlessSteel
    );
    hexInCollar.position.set(-hW / 2 - 0.05, hexInletLocalY, 0);
    hexGroup.add(hexInCollar);

    const hexInFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, ubR * 0.65, ubW * 0.95),
      materials.stainlessSteelFlange
    );
    hexInFlange.position.set(-hW / 2, hexInletLocalY, 0);
    hexGroup.add(hexInFlange);
  } else {
    // NEGATIVE PRESSURE MODE: Weather louver fresh air intake hood (no upstream blower)
    const hoodW = params.intakeHoodWidthM || Math.max(0.40, params.pipeRadiusM * 2.8);
    const hoodH = params.intakeHoodHeightM || Math.max(0.40, params.pipeRadiusM * 2.8);
    const hoodL = 0.38;
    const hoodLocalY = params.ductCenterlineYM - params.hexPosition.y;

    const hoodMesh = new THREE.Mesh(
      new THREE.BoxGeometry(hoodL, hoodH, hoodW),
      materials.stainlessSteel
    );
    hoodMesh.position.set(-hW / 2 - hoodL / 2, hoodLocalY, 0);
    hoodMesh.castShadow = true;
    hexGroup.add(hoodMesh);

    // Weather louvers angled downwards to shed rain and draw in filtered ambient air
    for (let lv = -2; lv <= 2; lv++) {
      const louver = new THREE.Mesh(
        new THREE.BoxGeometry(hoodL * 0.75, 0.012, hoodW * 0.92),
        materials.stainlessSteelFlange
      );
      louver.rotation.z = -Math.PI / 5;
      louver.position.set(-hW / 2 - hoodL / 2, hoodLocalY + (lv * hoodH * 0.16), 0);
      hexGroup.add(louver);
    }

    // Heavy-duty perimeter flange securing intake hood to heat exchanger casing
    const hoodFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.025, hoodH * 1.15, hoodW * 1.15),
      materials.stainlessSteelFlange
    );
    hoodFlange.position.set(-hW / 2, hoodLocalY, 0);
    hexGroup.add(hoodFlange);
  }

  // Hot Air Discharge Nozzle to Venturi (Right Face mating flush with hot air duct)
  const hexOutLocalY = params.venturiPosition.y - params.hexPosition.y;
  const hexOutCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(params.pipeRadiusM, params.pipeRadiusM, 0.10, 24),
    materials.stainlessSteel
  );
  hexOutCollar.rotateZ(Math.PI / 2);
  hexOutCollar.position.set(hW / 2 + 0.05, hexOutLocalY, 0);
  hexGroup.add(hexOutCollar);

  // Ground Footing Channels (resting on ground Y=0)
  const foot1 = createSteelBeam(0.12, 0.10, hD * 1.1, materials.structuralSteel);
  foot1.position.set(-hW * 0.38, -hH / 2 - 0.06, 0);
  hexGroup.add(foot1);

  const foot2 = createSteelBeam(0.12, 0.10, hD * 1.1, materials.structuralSteel);
  foot2.position.set(hW * 0.38, -hH / 2 - 0.06, 0);
  hexGroup.add(foot2);

  hexGroup.position.set(params.hexPosition.x, params.hexPosition.y, params.hexPosition.z);

  hexGroup.name = 'component_heater';
  componentGroups.set('heater', {
    id: 'heater',
    name: 'Multi-Pass Air Heat Exchanger',
    group: hexGroup,
    category: 'heater',
    basePosition: new THREE.Vector3(params.hexPosition.x, params.hexPosition.y, params.hexPosition.z),
    explodedOffset: new THREE.Vector3(-1.0, 0, 0),
  });
  rootGroup.add(hexGroup);

  // ==========================================================
  // 6. CENTRIFUGAL BLOWER SYSTEM & DRAFT ARCHITECTURE
  // ==========================================================
  // In POSITIVE mode: Single Forced-Draft Blower upstream of heater
  // In NEGATIVE mode: Single Induced-Draft Fan downstream of cyclone with overhead duct
  // In BALANCED mode: Dual-Fan Push-Pull (FD Blower upstream + ID Fan downstream)

  // 6A. UPSTREAM FORCED-DRAFT BLOWER (Positive and Balanced modes)
  if (params.hasUpstreamBlower) {
    const upstreamBlowerGroup = new THREE.Group();
    upstreamBlowerGroup.name = 'blower_fan_upstream';

    const ubR = params.upstreamBlowerVoluteRadiusM || params.blowerVoluteRadiusM;
    const ubW = params.upstreamBlowerWidthM || params.blowerWidthM;
    const uPos = params.upstreamBlowerPosition;

    // Volute Snail Scroll Casing
    const uVoluteGeo = new THREE.CylinderGeometry(ubR, ubR * 0.85, ubW, 32);
    uVoluteGeo.rotateX(Math.PI / 2);
    const uVoluteMesh = new THREE.Mesh(uVoluteGeo, materials.castIron);
    uVoluteMesh.castShadow = true;
    upstreamBlowerGroup.add(uVoluteMesh);

    // Axial Suction Bellmouth Inlet with Wire Mesh Screen (drawing ambient air)
    const uInletBellGeo = new THREE.CylinderGeometry(ubR * 0.45, ubR * 0.55, 0.15, 24);
    uInletBellGeo.rotateX(Math.PI / 2);
    const uInletBell = new THREE.Mesh(uInletBellGeo, materials.stainlessSteel);
    uInletBell.position.set(0, 0, ubW / 2 + 0.075);
    upstreamBlowerGroup.add(uInletBell);

    // Tangential Rectangular Discharge Duct extending to Heat Exchanger Inlet Face
    //
    // ITEM 30 — sized from the nozzle the model computed, not from the volute.
    // Previously `ubR * 0.5` by `ubW * 0.8`, i.e. from the fan, which produced a
    // discharge roughly twice the duct area and could never read as mating.
    const uNozW = params.upstreamBlowerOutletWidthM;
    const uNozH = params.upstreamBlowerOutletHeightM;
    const uDuctL = Math.max(0.4, (params.hexPosition.x - params.hexWidthM / 2) - (uPos.x + ubR * 0.7));
    const ubOutGeo = new THREE.BoxGeometry(uDuctL, uNozH, uNozW);
    const ubOutMesh = new THREE.Mesh(ubOutGeo, materials.stainlessSteel);
    ubOutMesh.position.set(ubR * 0.7 + uDuctL / 2, ubR * 0.55, 0);
    upstreamBlowerGroup.add(ubOutMesh);

    // Mating Flange bolted to Heat Exchanger Inlet Collar
    const ubOutFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, uNozH * 1.3, uNozW * 1.18),
      materials.stainlessSteelFlange
    );
    ubOutFlange.position.set(ubR * 0.7 + uDuctL, ubR * 0.55, 0);
    upstreamBlowerGroup.add(ubOutFlange);

    // In Balanced Mode: Supply Air Volume Control Balancing Damper
    if (params.pressureMode === 'balanced') {
      const damperHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, uNozH * 1.24, uNozW * 1.16),
        materials.structuralSteel
      );
      damperHousing.position.set(ubR * 0.7 + uDuctL * 0.45, ubR * 0.55, 0);
      upstreamBlowerGroup.add(damperHousing);

      const actuatorMotor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 0.16, 16),
        materials.motorBlue
      );
      actuatorMotor.position.set(ubR * 0.7 + uDuctL * 0.45, ubR * 0.55 + ubR * 0.38, 0);
      upstreamBlowerGroup.add(actuatorMotor);
    }

    // Electric Motor with Cooling Fins
    const umR = params.upstreamBlowerMotorRadiusM || ubR * 0.32;
    const umL = params.upstreamBlowerMotorLengthM || ubR * 0.8;
    const ubMotorGeo = new THREE.CylinderGeometry(umR, umR, umL, 20);
    ubMotorGeo.rotateX(Math.PI / 2);
    const ubMotorMesh = new THREE.Mesh(ubMotorGeo, materials.motorBlue);
    ubMotorMesh.position.set(-ubR * 0.35, 0, -ubW / 2 - umL / 2);
    ubMotorMesh.castShadow = true;
    upstreamBlowerGroup.add(ubMotorMesh);

    // Structural Floor Skid (channel steel frame resting firmly on ground Y=0)
    const uSkidH = params.upstreamBlowerSkidHeightM;
    const uSkidL = ubR * 2.4;
    const uSkidW = ubW * 2.8;
    const uSkidGeo = new THREE.BoxGeometry(uSkidL, uSkidH, uSkidW);
    const uSkidMesh = new THREE.Mesh(uSkidGeo, materials.structuralSteel);
    uSkidMesh.position.set(0, -ubR - uSkidH / 2, -ubW * 0.4);
    upstreamBlowerGroup.add(uSkidMesh);

    upstreamBlowerGroup.position.set(uPos.x, uPos.y, uPos.z);

    const blowerTitle = params.pressureMode === 'balanced'
      ? 'Forced-Draft Supply Fan (Balanced Push)'
      : 'Forced-Draft Air Blower Fan Assembly';

    upstreamBlowerGroup.name = 'component_blower';
    componentGroups.set('blower', {
      id: 'blower',
      name: blowerTitle,
      group: upstreamBlowerGroup,
      category: 'blower',
      basePosition: new THREE.Vector3(uPos.x, uPos.y, uPos.z),
      explodedOffset: new THREE.Vector3(-1.6, 0, 0),
    });
    rootGroup.add(upstreamBlowerGroup);
  }

  // 6B. DOWNSTREAM INDUCED-DRAFT BLOWER & EXHAUST SYSTEM (Negative and Balanced modes)
  if (params.hasDownstreamBlower) {
    const downstreamBlowerGroup = new THREE.Group();
    downstreamBlowerGroup.name = 'component_blower_downstream';

    const dbR = params.downstreamBlowerVoluteRadiusM;
    const dbW = params.downstreamBlowerWidthM;
    const dbPos = params.downstreamBlowerPosition;

    // Volute Snail Scroll Casing
    const dVoluteGeo = new THREE.CylinderGeometry(dbR, dbR * 0.85, dbW, 32);
    dVoluteGeo.rotateX(Math.PI / 2);
    const dVoluteMesh = new THREE.Mesh(dVoluteGeo, materials.castIron);
    dVoluteMesh.castShadow = true;
    downstreamBlowerGroup.add(dVoluteMesh);

    // ITEM 40 — the suction nozzle is VERTICAL, sitting on top of the volute.
    //
    // It used to stand off to one side with its axis along Z, so the duct had to leave
    // the vertical, turn 90 degrees, and run sideways to reach it. The user asked for
    // that connection to be straight with no bend, and it can be: the duct's descending
    // leg is already at (fanX, *, cycloneCenterZM) and the fan's own centre is at
    // (fanX, *, cycloneCenterZM) too, because `downstreamBlowerPosition.z` is the
    // cyclone centre Z. The duct was already dropping straight down the fan's centreline
    // and then stepping sideways off it.
    //
    // So the nozzle moves to the top of the volute on the same axis, and no rotation is
    // applied — a CylinderGeometry already has its axis on Y.
    const dSuctionLen = 0.20;
    const suctionThroatR = dbR * 0.45;
    const suctionMouthR = dbR * 0.50;
    const dSuctionGeo = new THREE.CylinderGeometry(
      suctionThroatR,
      suctionMouthR,
      dSuctionLen,
      24
    );
    const dSuction = new THREE.Mesh(dSuctionGeo, materials.stainlessSteel);
    dSuction.castShadow = true;
    // Bottom face on the volute crown at local Y = dbR, body above it.
    dSuction.position.set(0, dbR + dSuctionLen / 2, 0);
    downstreamBlowerGroup.add(dSuction);

    // World Y of the nozzle's top face — where the overhead duct must stop.
    const idSuctionTopY = dbPos.y + dbR + dSuctionLen;

    // Electric Motor with Cooling Fins
    const dmR = params.downstreamBlowerMotorRadiusM || dbR * 0.32;
    const dmL = params.downstreamBlowerMotorLengthM || dbR * 0.8;
    const dbMotorGeo = new THREE.CylinderGeometry(dmR, dmR, dmL, 20);
    dbMotorGeo.rotateX(Math.PI / 2);
    const dbMotorMesh = new THREE.Mesh(dbMotorGeo, materials.motorBlue);
    dbMotorMesh.position.set(-dbR * 0.35, 0, -dbW / 2 - dmL / 2);
    dbMotorMesh.castShadow = true;
    downstreamBlowerGroup.add(dbMotorMesh);

    // Floor Skid resting on ground Y=0
    const dSkidH = params.downstreamBlowerSkidHeightM;
    const dSkidL = dbR * 2.4;
    const dSkidW = dbW * 2.8;
    const dSkidGeo = new THREE.BoxGeometry(dSkidL, dSkidH, dSkidW);
    const dSkidMesh = new THREE.Mesh(dSkidGeo, materials.structuralSteel);
    dSkidMesh.position.set(0, -dbR - dSkidH / 2, -dbW * 0.4);
    downstreamBlowerGroup.add(dSkidMesh);

    // ITEM 40 — the fan outlet is REMOVED at the user's request.
    //
    // The discharge nozzle, its square-to-round transition, the 2.4 m stack, the
    // discharge flange and the weather cowl are all gone. What remains is the volute, its
    // motor, its skid and the vertical suction nozzle the overhead duct now drops onto.
    //
    // This also retires the two defects ITEM 33 had chased — the stack sized from the
    // cyclone's vortex finder instead of the fan, and the stack standing on the same side
    // as the descending duct so the two interpenetrated. Both are moot with no stack.
    // `downstreamStackRadiusM` stays on the model because it is a reportable quantity and
    // the fan's discharge port still has an area, but nothing in the 3D assembly is
    // placed from it.

    downstreamBlowerGroup.position.set(dbPos.x, dbPos.y, dbPos.z);
    rootGroup.add(downstreamBlowerGroup);

    // 6C. OVERHEAD SUCTION DUCT (Routing from Cyclone Vortex Finder into ID Fan)
    const cyX = params.cycloneCenterXM;
    const cyTopY = params.cycloneBarrelTopYM + 0.4;
    const cyZ = params.cycloneCenterZM;
    const overheadY = cyTopY + 0.65;
    // ITEM 40 — the fan joint needs no standoff any more. `idSuctionStandoffM` existed only
    // to give a final elbow room to turn from vertical into +Z to reach a nozzle standing
    // off to one side. That elbow is gone and the nozzle now sits on TOP of the volute, so
    // the duct simply falls the remaining height and Z has no say in the joint at all.
    // `dbPos.z` is `cycloneCenterZM`, so the drop is on the same plane the 180 degree arc
    // is drawn in and cannot come out skewed.

    const overheadDuctGroup = new THREE.Group();
    overheadDuctGroup.name = 'overhead_id_suction_duct';

    const ductR = params.cycloneVortexFinderRadiusM;

    // ITEM 34 — the elbow where the suction duct turns into the ID fan.
    //
    // The control points used to end with a 5.7 m vertical drop followed by a SINGLE
    // 0.556 m step that turned in Z as well as Y:
    //
    //     (dbX, overheadY, cyZ) -> (dbX, dbY+0.45, cyZ) -> (dbX, dbY, idZ)
    //
    // A Catmull-Rom spline needs a direction either side of a turn to round it. Here
    // the last two segments shared almost no common direction, so the spline
    // overshot the corner — the visible kink. It is the same defect as the cyclone
    // inlet connection (item 28), in the other duct.
    //
    // Replaced by an explicit tangent-continuous quarter bend: descend vertically on
    // the duct's own axis, sweep an arc of the engine's bend radius, and arrive
    // travelling horizontally into the suction nozzle, which is the axis the nozzle
    // actually presents. 'centripetal' parameterisation cannot overshoot between
    // control points, so the straight runs stay straight.
    // ITEM 35 — the cyclone-to-fan arch is built from real tangent arcs.
    //
    // The old control points were:
    //
    //   (cyX,   cyTopY, cyZ)
    //   (cyX,   overY,  cyZ)             straight up
    //   (cyX+0.35, overY+0.25, cyZ)      <-- moves in X AND Y at once
    //   (dbX-0.35, overY+0.25, cyZ)      straight across
    //   (dbX,   overY,  cyZ)             <-- moves in X AND Y at once
    //
    // Two separate 90 degree corners, each faked by a single diagonal step. A
    // Catmull-Rom spline needs direction either side of a turn to round it, and a
    // diagonal step supplies none, so the spline overshot both corners. That is the
    // kink across the top of the arch — and this IS the "180 degree curve" the user
    // reported, being two quarter bends plus a straight.
    //
    // It is now two explicit quarter arcs of the engine's bend radius with a straight
    // between them: up the vortex finder, arc over to horizontal, straight across,
    // arc down to the drop. Tangent continuity is by construction, and the arcs
    // consume exactly the rise and the run they need.
    // ITEM 38 — ONE tangent-continuous 180 degree return of constant radius.
    //
    // The duct leaves the vortex finder travelling +Y and arrives above the fan
    // travelling -Y, so both legs are vertical and the return is a semicircle:
    //
    //     entry (cyX,      cyTopY)  tangent +Y
    //     apex  (cyX + R,  cyTopY + R)
    //     exit  (cyX + 2R, cyTopY)  tangent -Y
    //
    // which forces R = crownSpanM / 2 exactly. There is no free parameter left, and
    // crucially no room for a straight: at R = span/2 the two quarter arcs meet AT the
    // apex on a shared horizontal tangent.
    //
    // What it replaced, and why it was wrong: two quarter arcs of `crownR` with a
    // straight between them, where crownR was
    // `min(bendRadiusM, crownSpanM/2, crownRiseM)`. The `crownRiseM` term clamped the
    // radius to 0.65 m against a 1.80 m span, the two bends could not meet, and the
    // leftover 0.50 m was inserted as a deliberate flat across the top — the shouldered
    // "gothic arch". Shrinking R is what CAUSES a flat; it can never remove one.
    //
    // The rise clamp is gone because for a 180 degree bend the apex is necessarily
    // cyTopY + R, and it clears the cyclone by construction — there is no separate rise
    // budget to respect.
    const crownSpanM = Math.abs(dbPos.x - cyX);
    const crownR = Math.max(1e-3, crownSpanM / 2);
    const crownApexYM = cyTopY + crownR;

    // ITEM 38 — the radius must not be silently reduced if the span is tight. The fan is
    // now placed at 2 * bendRadiusM downstream of the cyclone precisely so this cannot
    // bind; see downstreamBlowerPosition in parametricModel.ts.
    if (crownR < params.bendRadiusM - 1e-6) {
      // Deliberately not clamped. If this ever fires the fan has been moved back inside
      // the bend radius and the only honest outcomes are a tighter-than-specified elbow
      // or a longer machine — both are decisions for the caller, not for this builder.
    }

    const overheadPts: THREE.Vector3[] = [];

    // Straight up out of the vortex finder. Zero length at the default, because the bend
    // starts right on the flange — kept so a taller build still has a square joint.
    overheadPts.push(new THREE.Vector3(cyX, cyTopY, cyZ));

    // The 180 degree arc, as a single sweep over a in [0, pi]:
    //
    //     x = (cyX + R) - R cos a      dx/da = R sin a   ->  0 at a=0, 0 at a=pi
    //     y = cyTopY     + R sin a      dy/da = R cos a   -> +R at a=0, -R at a=pi
    //
    // The tangent is therefore +Y on entry and -Y on exit, and it is continuous through
    // a = pi/2 by construction. Parametrising the WHOLE turn this way — rather than two
    // separate quarter arcs with a straight spliced between them — is what removes the
    // flat: there is no splice to be tangent-continuous across.
    {
      const steps = 48;
      const cx = cyX + crownR;
      for (let i = 1; i <= steps; i++) {
        const a = Math.PI * (i / steps);
        overheadPts.push(
          new THREE.Vector3(cx - crownR * Math.cos(a), cyTopY + crownR * Math.sin(a), cyZ)
        );
      }
    }

    // ITEM 40 — the drop into the fan is STRAIGHT. There is no elbow here at all.
    //
    // The 180 degree arc above already leaves the duct travelling straight DOWN the fan's
    // centreline, because `downstreamBlowerPosition.z` equals the cyclone centre Z. The
    // old code then budgeted a quarter bend to turn that into +Z and reach a nozzle
    // standing off to one side, which is the bend the user asked to be removed.
    //
    // With the nozzle on top of the volute on the same axis, the drop needs nothing but a
    // straight: from the arc's exit at (fanX, cyTopY) down to the nozzle's top face at
    // (fanX, idSuctionTopY). Both are on x = fanX and z = cycloneCenterZM, so the duct
    // stays coaxial all the way down and mates square without a single fitting.
    const reducerLen = params.idSuctionReducerLengthM;
    // The reducer occupies the last stretch above the nozzle, so the tube itself stops
    // short of the nozzle's top face by that much.
    const ductEndY = idSuctionTopY + reducerLen;
    overheadPts.push(new THREE.Vector3(dbPos.x, ductEndY, dbPos.z));

    // ITEM 40 — the reducer between the outlet duct and the fan suction throat.
  //
  // The duct is 0.579 m at the IITA load; the throat is 0.433 m. The duct overhung the
  // opening by 146 mm in diameter and could not enter it. Both ends are round and
  // coaxial, so the correct transition is a concentric cone — and unlike the inlet-side
  // case there is nothing to loft, because there is no rectangle to match.
  //
  // It runs on the vertical now, so there is NO rotation: a CylinderGeometry already has
  // its axis on Y. Gas flows DOWN, so the duct's diameter is the TOP face and the throat's
  // is the bottom face, which is the order `CylinderGeometry(radiusTop, radiusBottom, ...)`
  // wants.
  {
    const geo = new THREE.CylinderGeometry(
      ductR,                              // top: matches the duct it continues
      params.downstreamBlowerInletRadiusM, // bottom: matches the throat it enters
      reducerLen,
      32,
      1,
      true
    );
    const mesh = new THREE.Mesh(geo, materials.stainlessSteel);
    mesh.position.set(dbPos.x, idSuctionTopY + reducerLen / 2, dbPos.z);
    mesh.castShadow = true;
    overheadDuctGroup.add(mesh);
  }

  const overheadCurve = new THREE.CatmullRomCurve3(overheadPts, false, 'centripetal');
    const overheadGeo = new THREE.TubeGeometry(overheadCurve, 64, ductR, 24, false);
    const overheadMesh = new THREE.Mesh(overheadGeo, materials.stainlessSteel);
    overheadMesh.castShadow = true;
    overheadDuctGroup.add(overheadMesh);

    // Mating Flange at cyclone vortex finder
    const cyMatingFlange = createFlangeJoint(ductR, 0.016, materials, 8);
    cyMatingFlange.position.set(cyX, cyTopY, cyZ);
    overheadDuctGroup.add(cyMatingFlange);

    // In Balanced Mode: Add exhaust draft balance damper housing along horizontal overhead span
    if (params.pressureMode === 'balanced') {
      const midX = (cyX + dbPos.x) / 2;
      const damperBox = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, ductR * 2.5, ductR * 2.5),
        materials.structuralSteel
      );
      damperBox.position.set(midX, overheadY + 0.25, cyZ);
      overheadDuctGroup.add(damperBox);

      const actuator = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 0.20, 16),
        materials.motorBlue
      );
      actuator.position.set(midX, overheadY + 0.25 + ductR * 1.5, cyZ);
      overheadDuctGroup.add(actuator);
    }

    // Vertical structural support post grounded at Y=0
    const postH = overheadY + 0.25;
    const post = createSteelBeam(postH, 0.08, 0.08, materials.structuralSteel);
    post.position.set((cyX + dbPos.x) / 2, postH / 2, cyZ);
    overheadDuctGroup.add(post);

    const postBaseplate = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.016, 0.22), materials.structuralSteel);
    postBaseplate.position.set((cyX + dbPos.x) / 2, 0.008, cyZ);
    overheadDuctGroup.add(postBaseplate);

    // ITEM 41 — the mating flange at the fan suction nozzle is REMOVED at the user's
    // request. The duct's reducer still lands exactly on the nozzle's top face, so the
    // joint is continuous; it simply has no flange ring on it.
    rootGroup.add(overheadDuctGroup);

    // Register in componentGroups:
    if (!params.hasUpstreamBlower) {
      // In Negative Mode, this ID fan is the primary blower
      downstreamBlowerGroup.name = 'component_blower';
      componentGroups.set('blower', {
        id: 'blower',
        name: 'Induced-Draft Exhaust Blower Fan Assembly',
        group: downstreamBlowerGroup,
        category: 'blower',
        basePosition: new THREE.Vector3(dbPos.x, dbPos.y, dbPos.z),
        explodedOffset: new THREE.Vector3(1.6, 0, 0),
      });
    } else {
      // In Balanced Mode: registered as downstream_blower (and can be selected in inspector)
      downstreamBlowerGroup.name = 'component_downstream_blower';
      componentGroups.set('downstream_blower', {
        id: 'downstream_blower',
        name: 'Induced-Draft Exhaust Fan (Balanced Pull)',
        group: downstreamBlowerGroup,
        category: 'blower',
        basePosition: new THREE.Vector3(dbPos.x, dbPos.y, dbPos.z),
        explodedOffset: new THREE.Vector3(1.6, 0, 0),
      });
    }
  }

  // ==========================================================
  // 7. ROTARY AIRLOCK VALVE (Product Discharge)
  // ==========================================================
  const airlockGroup = new THREE.Group();
  airlockGroup.name = 'rotary_airlock';

  const alR = params.airlockRadiusM;
  const alH = params.airlockHeightM;

  // Cylindrical Valve Housing
  //
  // ITEM 29 — this was the "rotary lock keeps showing gaps" defect.
  //
  // The body was `alH * 0.7` tall but both flanges were positioned at `+/- alH / 2`,
  // i.e. at the FULL half-height. That leaves an unfilled band of
  // (alH/2 - 0.7*alH/2) = 0.15 * alH on each end — 42 mm at the default 280 mm
  // housing, scaling to 63 mm on a 420 mm one. The flanges therefore floated
  // clear of the barrel with daylight between them, which reads as a broken valve
  // rather than a sectioned one.
  //
  // The housing now spans the full alH, so both flange faces land exactly on its
  // end faces. The 0.7 was never a real dimension — nothing else referenced it.
  const alBodyGeo = new THREE.CylinderGeometry(alR, alR, alH, 24);
  const alBody = new THREE.Mesh(alBodyGeo, materials.castIron);
  alBody.castShadow = true;
  airlockGroup.add(alBody);

  // Top Inlet Flange (Bolts directly to cyclone bottom dust flange)
  const alTopFlange = createFlangeJoint(alR, 0.016, materials, 6);
  alTopFlange.position.set(0, alH / 2 + 0.008, 0);
  airlockGroup.add(alTopFlange);

  // Bottom Outlet Flange
  //
  // Seated on the housing's lower face with the flange thickness accounted for, so
  // its mating face coincides with the bore rather than floating half a flange
  // proud of the barrel.
  const alBotFlange = createFlangeJoint(alR, 0.016, materials, 6);
  alBotFlange.position.set(0, -alH / 2 - 0.008, 0);
  airlockGroup.add(alBotFlange);

  // Drive Gearmotor on side
  const gMotorGeo = new THREE.CylinderGeometry(alR * 0.75, alR * 0.75, 0.28, 16);
  gMotorGeo.rotateZ(Math.PI / 2);
  const gMotor = new THREE.Mesh(gMotorGeo, materials.motorBlue);
  gMotor.position.set(alR + 0.14, 0, 0);
  airlockGroup.add(gMotor);

  // Flour Discharge Chute & Collection Bin on Floor
  const binHeight = Math.max(0.35, params.clearanceBelowAirlockM - 0.05);
  const binGeo = new THREE.CylinderGeometry(alR * 1.4, alR * 1.1, binHeight, 20);
  const binMesh = new THREE.Mesh(binGeo, materials.stainlessSteel);
  binMesh.position.set(0, -alH / 2 - binHeight / 2, 0);
  airlockGroup.add(binMesh);

  airlockGroup.position.set(params.airlockPosition.x, params.airlockPosition.y, params.airlockPosition.z);

  airlockGroup.name = 'component_rotary';
  componentGroups.set('rotary', {
    id: 'rotary',
    name: 'Product Discharge Rotary Airlock Valve',
    group: airlockGroup,
    category: 'airlock',
    basePosition: new THREE.Vector3(params.airlockPosition.x, params.airlockPosition.y, params.airlockPosition.z),
    explodedOffset: new THREE.Vector3(0, -0.6, 0),
  });
  rootGroup.add(airlockGroup);

  // ==========================================================
  // 8. STRUCTURAL STEEL SUPPORT FRAMEWORK & SKIDS
  // ==========================================================
  const structureGroup = new THREE.Group();
  structureGroup.name = 'component_structure';

  const colSize = params.columnProfileSizeM;

  // 1. Structural Tower for 7m Flash Drying Riser
  const towerW = params.riserTowerWidthM;
  const towerD = params.riserTowerDepthM;
  const towerH = params.riserTowerHeightM;

  // Columns rooted at ground level Y=0
  const riserCorners = [
    { x: riserBaseX - towerW / 2, z: -towerD / 2 },
    { x: riserBaseX + towerW / 2, z: -towerD / 2 },
    { x: riserBaseX - towerW / 2, z: towerD / 2 },
    { x: riserBaseX + towerW / 2, z: towerD / 2 },
  ];

  riserCorners.forEach(c => {
    // Column from Y = 0 to Y = towerH
    const col = createSteelBeam(towerH, colSize, colSize, materials.structuralSteel);
    col.position.set(c.x, towerH / 2, c.z);
    structureGroup.add(col);

    // Ground Anchor Baseplate on Floor (Y = 0)
    const bp = new THREE.Mesh(new THREE.BoxGeometry(colSize * 2.2, 0.02, colSize * 2.2), materials.structuralSteel);
    bp.position.set(c.x, 0.01, c.z);
    structureGroup.add(bp);
  });

  // Intermediate Horizontal Platform Tie Beams & Bracing for Riser Tower
  params.platformElevationsM.forEach(elev => {
    const beam1 = createSteelBeam(towerW, colSize, colSize, materials.structuralSteel);
    beam1.rotation.z = Math.PI / 2;
    beam1.position.set(riserBaseX, elev, -towerD / 2);
    structureGroup.add(beam1);

    const beam2 = createSteelBeam(towerW, colSize, colSize, materials.structuralSteel);
    beam2.rotation.z = Math.PI / 2;
    beam2.position.set(riserBaseX, elev, towerD / 2);
    structureGroup.add(beam2);

    const beam3 = createSteelBeam(towerD, colSize, colSize, materials.structuralSteel);
    beam3.rotation.x = Math.PI / 2;
    beam3.position.set(riserBaseX - towerW / 2, elev, 0);
    structureGroup.add(beam3);

    const beam4 = createSteelBeam(towerD, colSize, colSize, materials.structuralSteel);
    beam4.rotation.x = Math.PI / 2;
    beam4.position.set(riserBaseX + towerW / 2, elev, 0);
    structureGroup.add(beam4);
  });

  // 2. Structural Tower for Cyclone Separator
  const cyX = params.cycloneCenterXM;
  const cyZ = params.cycloneCenterZM;
  const cySpan = params.cycloneTowerSpanM;
  const cyPlatformH = params.cycloneTowerHeightM; // Reaches mounting lugs on barrel waist

  const cyCorners = [
    { x: cyX - cySpan, z: cyZ - cySpan },
    { x: cyX + cySpan, z: cyZ - cySpan },
    { x: cyX - cySpan, z: cyZ + cySpan },
    { x: cyX + cySpan, z: cyZ + cySpan },
  ];

  cyCorners.forEach(c => {
    // Column from Y = 0 to Y = cyPlatformH
    const col = createSteelBeam(cyPlatformH, colSize, colSize, materials.structuralSteel);
    col.position.set(c.x, cyPlatformH / 2, c.z);
    structureGroup.add(col);

    // Ground Baseplate on Floor (Y = 0)
    const bp = new THREE.Mesh(new THREE.BoxGeometry(colSize * 2.2, 0.02, colSize * 2.2), materials.structuralSteel);
    bp.position.set(c.x, 0.01, c.z);
    structureGroup.add(bp);
  });

  // Cyclone support ring beams framing the 4 legs underneath mounting lugs
  const cyRingBeam1 = createSteelBeam(cySpan * 2, colSize, colSize, materials.structuralSteel);
  cyRingBeam1.rotation.z = Math.PI / 2;
  cyRingBeam1.position.set(cyX, cyPlatformH, cyZ - cySpan);
  structureGroup.add(cyRingBeam1);

  const cyRingBeam2 = createSteelBeam(cySpan * 2, colSize, colSize, materials.structuralSteel);
  cyRingBeam2.rotation.z = Math.PI / 2;
  cyRingBeam2.position.set(cyX, cyPlatformH, cyZ + cySpan);
  structureGroup.add(cyRingBeam2);

  const cyRingBeam3 = createSteelBeam(cySpan * 2, colSize, colSize, materials.structuralSteel);
  cyRingBeam3.rotation.x = Math.PI / 2;
  cyRingBeam3.position.set(cyX - cySpan, cyPlatformH, cyZ);
  structureGroup.add(cyRingBeam3);

  const cyRingBeam4 = createSteelBeam(cySpan * 2, colSize, colSize, materials.structuralSteel);
  cyRingBeam4.rotation.x = Math.PI / 2;
  cyRingBeam4.position.set(cyX + cySpan, cyPlatformH, cyZ);
  structureGroup.add(cyRingBeam4);

  // Diagonal K-braces on cyclone legs for vibration stiffness
  const cyBrace1 = new THREE.Mesh(new THREE.BoxGeometry(colSize * 0.6, cyPlatformH * 0.9, colSize * 0.6), materials.structuralSteel);
  cyBrace1.rotation.z = 0.30;
  cyBrace1.position.set(cyX, cyPlatformH * 0.5, cyZ - cySpan);
  structureGroup.add(cyBrace1);

  const cyBrace2 = new THREE.Mesh(new THREE.BoxGeometry(colSize * 0.6, cyPlatformH * 0.9, colSize * 0.6), materials.structuralSteel);
  cyBrace2.rotation.z = -0.30;
  cyBrace2.position.set(cyX, cyPlatformH * 0.5, cyZ + cySpan);
  structureGroup.add(cyBrace2);

  componentGroups.set('structure', {
    id: 'structure',
    name: 'Structural Steel Support Framework & Skids',
    group: structureGroup,
    category: 'structure',
    basePosition: new THREE.Vector3(0, 0, 0),
    explodedOffset: new THREE.Vector3(0, -0.6, 0),
  });
  rootGroup.add(structureGroup);

  // Tag all meshes with componentId and componentName for interactive CAD inspector picking
  componentGroups.forEach((comp, id) => {
    comp.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.componentId = id;
        child.userData.componentName = comp.name;
      }
    });
  });

  // Compute overall bounding box of the complete assembly
  const bounds = new THREE.Box3().setFromObject(rootGroup);

  // 1. Engineering Plant Footprint Boundary Line on Floor (Y = 0.005)
  const footprintPad = 0.35;
  const minX = bounds.min.x - footprintPad;
  const maxX = bounds.max.x + footprintPad;
  const minZ = bounds.min.z - footprintPad;
  const maxZ = bounds.max.z + footprintPad;

  const footprintPts = [
    new THREE.Vector3(minX, 0.005, minZ),
    new THREE.Vector3(maxX, 0.005, minZ),
    new THREE.Vector3(maxX, 0.005, maxZ),
    new THREE.Vector3(minX, 0.005, maxZ),
    new THREE.Vector3(minX, 0.005, minZ),
  ];
  const footprintLineGeo = new THREE.BufferGeometry().setFromPoints(footprintPts);
  const footprintLine = new THREE.Line(
    footprintLineGeo,
    new THREE.LineBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.7 })
  );
  rootGroup.add(footprintLine);

  // 2. 1.5m Maintenance Clearance Perimeter Line on Floor (Y = 0.005)
  const clearPad = 1.50;
  const clearPts = [
    new THREE.Vector3(minX - clearPad, 0.005, minZ - clearPad),
    new THREE.Vector3(maxX + clearPad, 0.005, minZ - clearPad),
    new THREE.Vector3(maxX + clearPad, 0.005, maxZ + clearPad),
    new THREE.Vector3(minX - clearPad, 0.005, maxZ + clearPad),
    new THREE.Vector3(minX - clearPad, 0.005, minZ - clearPad),
  ];
  const clearLineGeo = new THREE.BufferGeometry().setFromPoints(clearPts);
  const clearLine = new THREE.Line(
    clearLineGeo,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 })
  );
  rootGroup.add(clearLine);

  // 3. Human Engineering Scale Reference (1.75m Operator Silhouette at feeder work zone)
  const humanGroup = new THREE.Group();
  humanGroup.name = 'scale_reference_operator';

  // Body
  const torsoGeo = new THREE.CylinderGeometry(0.18, 0.14, 0.85, 12);
  const humanMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.7, metalness: 0.1 });
  const torso = new THREE.Mesh(torsoGeo, humanMat);
  torso.position.set(0, 1.15, 0);
  humanGroup.add(torso);

  // Head with safety helmet
  const headGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const head = new THREE.Mesh(headGeo, humanMat);
  head.position.set(0, 1.68, 0);
  humanGroup.add(head);

  const hardHatGeo = new THREE.CylinderGeometry(0.14, 0.15, 0.08, 16);
  const hardHatMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
  const hardHat = new THREE.Mesh(hardHatGeo, hardHatMat);
  hardHat.position.set(0, 1.76, 0);
  humanGroup.add(hardHat);

  // Legs
  const legGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.75, 12);
  const leg1 = new THREE.Mesh(legGeo, humanMat);
  leg1.position.set(-0.09, 0.375, 0);
  humanGroup.add(leg1);

  const leg2 = new THREE.Mesh(legGeo, humanMat);
  leg2.position.set(0.09, 0.375, 0);
  humanGroup.add(leg2);

  // Place operator standing next to feeder inspection walkway
  humanGroup.position.set(params.feederPosition.x - 0.75, 0, params.feederPosition.z + 0.95);
  rootGroup.add(humanGroup);

  return {
    rootGroup,
    componentGroups,
    bounds,
  };
}
