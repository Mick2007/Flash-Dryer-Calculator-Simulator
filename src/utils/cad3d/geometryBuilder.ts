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

  // 1.5 Vertical Downcomer Return Pipe (True circular cylindrical spool)
  const downcomerZ = -params.bendRadiusM * 2;
  const downcomerExitY = Math.max(params.cycloneInletYM + 0.3, 3.2);
  const downcomerHeight = params.riserTopYM - downcomerExitY;
  const downcomerGeo = new THREE.CylinderGeometry(rPipe, rPipe, downcomerHeight, 24);
  const downcomerMesh = new THREE.Mesh(downcomerGeo, mainMat);
  downcomerMesh.position.set(riserBaseX, (params.riserTopYM + downcomerExitY) / 2, downcomerZ);
  downcomerMesh.castShadow = true;
  pipeGroup.add(downcomerMesh);

  // Flanged joint at top of downcomer mating with U-bend
  const downcomerTopFlange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
  downcomerTopFlange.position.set(riserBaseX, params.riserTopYM, downcomerZ);
  pipeGroup.add(downcomerTopFlange);

  // Flanged joint at bottom of vertical downcomer
  const downcomerBotFlange = createFlangeJoint(rPipe, params.flangeThicknessM, materials, 8);
  downcomerBotFlange.position.set(riserBaseX, downcomerExitY, downcomerZ);
  pipeGroup.add(downcomerBotFlange);

  // 1.6 Transition Spool turning smoothly into Cyclone Tangential Inlet Flange
  // Approaches purely horizontally along +X at the terminal point to mate square with cyclone inlet
  const transitionPts = [
    new THREE.Vector3(riserBaseX, downcomerExitY, downcomerZ),
    new THREE.Vector3(riserBaseX + 0.3, downcomerExitY - 0.05, downcomerZ),
    new THREE.Vector3(
      (riserBaseX + params.cycloneInletFlangePoint.x) * 0.5,
      (downcomerExitY + params.cycloneInletFlangePoint.y) * 0.5,
      (downcomerZ + params.cycloneInletFlangePoint.z) * 0.5
    ),
    new THREE.Vector3(
      params.cycloneInletFlangePoint.x - 0.35,
      params.cycloneInletFlangePoint.y,
      params.cycloneInletFlangePoint.z
    ),
    new THREE.Vector3(
      params.cycloneInletFlangePoint.x,
      params.cycloneInletFlangePoint.y,
      params.cycloneInletFlangePoint.z
    ),
  ];
  const transitionCurve = new THREE.CatmullRomCurve3(transitionPts, false, 'catmullrom', 0.15);
  const transitionGeo = new THREE.TubeGeometry(transitionCurve, 32, rPipe, 24, false);
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

  // Square-to-round adapter transition collar bridging circular pipe to rectangular cyclone inlet box
  const adapterLen = 0.18;
  const adapterGeo = new THREE.CylinderGeometry(
    rPipe,
    Math.max(params.cycloneInletWidthM, params.cycloneInletHeightM) * 0.62,
    adapterLen,
    24
  );
  adapterGeo.rotateZ(Math.PI / 2);
  const adapterMesh = new THREE.Mesh(adapterGeo, materials.stainlessSteel);
  adapterMesh.position.set(
    params.cycloneInletFlangePoint.x + adapterLen / 2,
    params.cycloneInletFlangePoint.y,
    params.cycloneInletFlangePoint.z
  );
  adapterMesh.castShadow = true;
  pipeGroup.add(adapterMesh);

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

  // Tangential Inlet Duct Transition Piece
  const inletWidth = params.cycloneInletWidthM;
  const inletHeight = params.cycloneInletHeightM;
  const inletLength = params.cycloneInletLengthM;
  const inletBoxGeo = new THREE.BoxGeometry(inletLength, inletHeight, inletWidth);
  const inletBox = new THREE.Mesh(inletBoxGeo, materials.stainlessSteel);
  inletBox.position.set(-inletLength / 2, cyH - inletHeight / 2 - 0.04, cyR - inletWidth / 2);
  inletBox.castShadow = true;
  cycloneGroup.add(inletBox);

  // Tangential Inlet Connection Flange
  const inletFlange = new THREE.Mesh(
    new THREE.BoxGeometry(0.02, inletHeight * 1.3, inletWidth * 1.4),
    materials.stainlessSteelFlange
  );
  inletFlange.position.set(-inletLength, cyH - inletHeight / 2 - 0.04, cyR - inletWidth / 2);
  cycloneGroup.add(inletFlange);

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
    const uDuctL = Math.max(0.4, (params.hexPosition.x - params.hexWidthM / 2) - (uPos.x + ubR * 0.7));
    const ubOutGeo = new THREE.BoxGeometry(uDuctL, ubR * 0.5, ubW * 0.8);
    const ubOutMesh = new THREE.Mesh(ubOutGeo, materials.stainlessSteel);
    ubOutMesh.position.set(ubR * 0.7 + uDuctL / 2, ubR * 0.55, 0);
    upstreamBlowerGroup.add(ubOutMesh);

    // Mating Flange bolted to Heat Exchanger Inlet Collar
    const ubOutFlange = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, ubR * 0.65, ubW * 0.95),
      materials.stainlessSteelFlange
    );
    ubOutFlange.position.set(ubR * 0.7 + uDuctL, ubR * 0.55, 0);
    upstreamBlowerGroup.add(ubOutFlange);

    // In Balanced Mode: Supply Air Volume Control Balancing Damper
    if (params.pressureMode === 'balanced') {
      const damperHousing = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, ubR * 0.62, ubW * 0.92),
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

    // Axial Suction Nozzle receiving the overhead drop duct
    const dSuctionGeo = new THREE.CylinderGeometry(dbR * 0.45, dbR * 0.50, 0.20, 24);
    dSuctionGeo.rotateX(Math.PI / 2);
    const dSuction = new THREE.Mesh(dSuctionGeo, materials.stainlessSteel);
    dSuction.position.set(0, 0, dbW / 2 + 0.10);
    downstreamBlowerGroup.add(dSuction);

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

    // Vertical Clean Air Exhaust Stack rising from ID Fan Discharge Nozzle
    const stackBaseX = dbR * 0.75;
    const stackBaseY = dbR * 0.55;
    const stackHeight = 2.4;
    const stackR = Math.max(0.12, params.cycloneVortexFinderRadiusM * 0.95);
    const dStackGeo = new THREE.CylinderGeometry(stackR, stackR, stackHeight, 24);
    const dStackMesh = new THREE.Mesh(dStackGeo, materials.stainlessSteel);
    dStackMesh.position.set(stackBaseX, stackBaseY + stackHeight / 2, 0);
    dStackMesh.castShadow = true;
    downstreamBlowerGroup.add(dStackMesh);

    // Flanged connection at stack base
    const dDischFlange = createFlangeJoint(stackR, 0.016, materials, 8);
    dDischFlange.position.set(stackBaseX, stackBaseY + 0.05, 0);
    downstreamBlowerGroup.add(dDischFlange);

    // Weather cowl / diffuser hood at stack discharge
    const dCowlGeo = new THREE.ConeGeometry(stackR * 1.5, 0.28, 20);
    const dCowlMesh = new THREE.Mesh(dCowlGeo, materials.stainlessSteelDark);
    dCowlMesh.position.set(stackBaseX, stackBaseY + stackHeight + 0.14, 0);
    downstreamBlowerGroup.add(dCowlMesh);

    downstreamBlowerGroup.position.set(dbPos.x, dbPos.y, dbPos.z);
    rootGroup.add(downstreamBlowerGroup);

    // 6C. OVERHEAD SUCTION DUCT (Routing from Cyclone Vortex Finder into ID Fan)
    const cyX = params.cycloneCenterXM;
    const cyTopY = params.cycloneBarrelTopYM + 0.4;
    const cyZ = params.cycloneCenterZM;
    const overheadY = cyTopY + 0.65;
    const idSuctionPt = new THREE.Vector3(dbPos.x, dbPos.y, dbPos.z + dbW / 2 + 0.18);

    const overheadDuctGroup = new THREE.Group();
    overheadDuctGroup.name = 'overhead_id_suction_duct';

    const ductR = params.cycloneVortexFinderRadiusM;
    const overheadPts = [
      new THREE.Vector3(cyX, cyTopY, cyZ),
      new THREE.Vector3(cyX, overheadY, cyZ),
      new THREE.Vector3(cyX + 0.35, overheadY + 0.25, cyZ),
      new THREE.Vector3(dbPos.x - 0.35, overheadY + 0.25, cyZ),
      new THREE.Vector3(dbPos.x, overheadY, cyZ),
      new THREE.Vector3(dbPos.x, dbPos.y + 0.45, cyZ),
      new THREE.Vector3(idSuctionPt.x, idSuctionPt.y, idSuctionPt.z),
    ];
    const overheadCurve = new THREE.CatmullRomCurve3(overheadPts, false, 'catmullrom', 0.15);
    const overheadGeo = new THREE.TubeGeometry(overheadCurve, 40, ductR, 24, false);
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

    // Mating Flange at ID fan suction inlet
    const idMatingFlange = createFlangeJoint(ductR, 0.016, materials, 8);
    idMatingFlange.position.copy(idSuctionPt);
    overheadDuctGroup.add(idMatingFlange);

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
  const alBodyGeo = new THREE.CylinderGeometry(alR, alR, alH * 0.7, 24);
  const alBody = new THREE.Mesh(alBodyGeo, materials.castIron);
  alBody.castShadow = true;
  airlockGroup.add(alBody);

  // Top Inlet Flange (Bolts directly to cyclone bottom dust flange)
  const alTopFlange = createFlangeJoint(alR, 0.016, materials, 6);
  alTopFlange.position.set(0, alH / 2, 0);
  airlockGroup.add(alTopFlange);

  // Bottom Outlet Flange
  const alBotFlange = createFlangeJoint(alR, 0.016, materials, 6);
  alBotFlange.position.set(0, -alH / 2, 0);
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
