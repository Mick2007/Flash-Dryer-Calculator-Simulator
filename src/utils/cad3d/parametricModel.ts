import {
  CalculationResults,
  ConnectionPort,
  AssemblyConnection,
  AssemblyConnector,
  JointValidationReport,
  AssemblyValidationReport,
  PressureSystemType,
} from '../../types/dryer';

export interface PressureZoneData {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  gaugePressurePa: number;
  status: 'positive' | 'neutral' | 'negative';
  colorHex: string;
  description: string;
}

export interface ParametricModel3D {
  // World Ground Reference
  groundElevationM: number; // Always 0.0 (fixed world coordinate)

  // Pressure System Architecture
  pressureMode: PressureSystemType;
  hasUpstreamBlower: boolean;
  hasDownstreamBlower: boolean;
  hasIntakeHood: boolean;
  upstreamBlowerPosition: { x: number; y: number; z: number };
  upstreamBlowerVoluteRadiusM: number;
  upstreamBlowerWidthM: number;
  /** Discharge nozzle, sized from the duct area. See ITEM 30. */
  upstreamBlowerOutletWidthM: number;
  upstreamBlowerOutletHeightM: number;
  upstreamBlowerMotorRadiusM: number;
  upstreamBlowerMotorLengthM: number;
  upstreamBlowerSkidHeightM: number;
  downstreamBlowerPosition: { x: number; y: number; z: number };
  downstreamBlowerVoluteRadiusM: number;
  downstreamBlowerWidthM: number;
  downstreamBlowerInletRadiusM: number;
  downstreamBlowerOutletWidthM: number;
  downstreamBlowerOutletHeightM: number;
  /**
   * Clean-air exhaust stack radius, m. An equal-area round section on the fan
   * discharge.
   *
   * Sized HERE rather than in the geometry builder so the clearance between the stack
   * and the overhead suction duct can be asserted numerically. The builder used to
   * derive this from `cycloneVortexFinderRadiusM`, an upstream component with no
   * dimensional relationship to the fan. See ITEM 33.
   */
  downstreamStackRadiusM: number;
  /**
   * Length of the concentric reducer between the outlet duct and the fan suction throat, m.
   *
   * REQUIRED, not cosmetic: the duct is 0.579 m and the throat 0.433 m at the IITA load,
   * so the duct overhangs the opening by 146 mm in diameter and cannot enter it. See
   * ITEM 40.
   */
  idSuctionReducerLengthM: number;
  downstreamBlowerMotorRadiusM: number;
  downstreamBlowerMotorLengthM: number;
  downstreamBlowerSkidHeightM: number;
  intakeHoodPosition: { x: number; y: number; z: number };
  intakeHoodWidthM: number;
  intakeHoodHeightM: number;
  pressureZones: PressureZoneData[];

  // Flash Pipe System
  ductCenterlineYM: number;
  pipeRadiusM: number;
  pipeDiameterMm: number;
  pipeDiameterCalculatedMm: number;
  pipeWallThicknessM: number;
  flangeRadiusM: number;
  flangeThicknessM: number;
  riserBaseYM: number;
  riserHeightM: number;
  riserTopYM: number;
  totalLengthM: number;
  bendRadiusM: number;
  loopOffsetZM: number;
  pipeCenterlineLengthM: number;
  pipeLengthDifferencePercent: number;
  /**
   * Solved horizontal run inserted at the top of the loop, m.
   *
   * THIS IS THE AUTHORITATIVE VALUE. The geometry builder previously rebuilt the
   * downcomer at `riserBaseX`, ignoring the run entirely, while this module's
   * own centreline used `downcomerX = riserX + horizontalRunM`. The two disagreed
   * by up to 1.5 m, so the physical pipe and the length the engine was costed
   * were different machines, and the run that the engine's `seg-loop-straight`
   * segment paid for was never drawn.
   */
  horizontalRunM: number;
  /** X of the vertical downcomer. Equals riserX + horizontalRunM. */
  downcomerXM: number;
  /** Y at which the downcomer turns toward the cyclone inlet. */
  downcomerExitYM: number;
  /**
   * Routing layout actually realised. `straight_riser` means the downcomer
   * shares the riser's X, so the only offset is the riser's own plan position.
   */
  routingLayout: 'single_loop' | 'double_loop' | 'straight_riser';

  // Cyclone Separator (Anchored to maintain ground clearance)
  isStairmand: boolean;
  cycloneBarrelRadiusM: number;
  cycloneBarrelDiameterMm: number;
  cycloneCylinderHeightM: number;
  cycloneConeHeightM: number;
  cycloneTotalHeightM: number;
  cycloneVortexFinderRadiusM: number;
  cycloneVortexFinderLengthM: number;
  cycloneDustOutletRadiusM: number;
  cycloneInletHeightM: number;
  cycloneInletWidthM: number;
  cycloneInletLengthM: number;
  /**
   * Length of the round-to-rectangular transition between the flash duct and the
   * tangential inlet, m.
   *
   * REQUIRED, not cosmetic. The duct is a user-chosen round standard size and the
   * cyclone's tangential inlet is 0.2 Dc x 0.5 Dc, so the two sections disagree — at
   * the IITA load the duct is 450 mm round and the inlet is 231 x 579 mm. Something has
   * to carry the section from one to the other, and it has to arrive exactly on the
   * inlet rectangle. See ITEM 37.
   */
  cycloneInletTransitionLengthM: number;
  /**
   * Tangential stub that actually projects into the barrel, m.
   *
   * `cycloneInletLengthM` is the flange-to-barrel-centre spacing; the transition takes
   * its share of that, and the remainder is the nozzle inside the shell.
   */
  cycloneInletStubLengthM: number;
  cycloneCenterXM: number;
  cycloneJunctionYM: number;
  cycloneCenterZM: number;
  cycloneDustOutletYM: number;
  cycloneBarrelTopYM: number;
  cycloneInletYM: number;
  cycloneLugsYM: number;

  // Venturi & Mixing
  venturiThroatRadiusM: number;
  venturiThroatDiameterMm: number;
  venturiInletRadiusM: number;
  venturiConvLengthM: number;
  venturiThroatLengthM: number;
  venturiDivLengthM: number;
  venturiPosition: { x: number; y: number; z: number };

  // Feed Hopper & Screw Conveyor
  hopperTopWidthM: number;
  hopperTopLengthM: number;
  hopperHeightM: number;
  hopperBottomWidthM: number;
  hopperOutletWidthM?: number;
  hopperOutletLengthM?: number;
  hopperUpperHeightM?: number;
  hopperLowerHeightM?: number;
  screwRadiusM: number;
  screwBarrelLengthM: number;
  screwMotorLengthM: number;
  screwPitchM?: number;
  screwShaftRadiusM?: number;
  feederPosition: { x: number; y: number; z: number };

  // Heat Exchanger (Grounded on floor)
  hexWidthM: number;
  hexDepthM: number;
  hexHeightM: number;
  hexPasses: number;
  hexTubesCount: number;
  hexDutyKW: number;
  hexPosition: { x: number; y: number; z: number };

  // Centrifugal Blower (Grounded on floor skid)
  blowerVoluteRadiusM: number;
  blowerWidthM: number;
  blowerInletRadiusM: number;
  blowerOutletWidthM: number;
  blowerOutletHeightM: number;
  blowerMotorRadiusM: number;
  blowerMotorLengthM: number;
  blowerPosition: { x: number; y: number; z: number };
  blowerSkidHeightM: number;

  // Rotary Airlock Valve (Flanged directly below cyclone dust outlet)
  airlockRadiusM: number;
  airlockHeightM: number;
  airlockMotorLengthM: number;
  airlockPosition: { x: number; y: number; z: number };
  clearanceBelowAirlockM: number;

  // Structural Steel Frame
  columnProfileSizeM: number;
  riserTowerWidthM: number;
  riserTowerDepthM: number;
  riserTowerHeightM: number;
  cycloneTowerSpanM: number;
  cycloneTowerHeightM: number;
  platformElevationsM: number[];

  // Centerlines for pipe sweep & particle flow
  centerlinePoints: { x: number; y: number; z: number }[];
  exhaustCenterlinePoints: { x: number; y: number; z: number }[];
  feedCenterlinePoints: { x: number; y: number; z: number }[];
  dryProductCenterlinePoints: { x: number; y: number; z: number }[];

  // Cyclone Tangential Inlet Flange Coordinate (Exact connection target)
  cycloneInletFlangePoint: { x: number; y: number; z: number };

  // Connection & Port System (Kinematic chain verification)
  ports: Record<string, ConnectionPort[]>;
  portsByName: Record<string, ConnectionPort>;
  connectors: AssemblyConnector[];
  connections: AssemblyConnection[];
  validationReport: AssemblyValidationReport;

  // Validation Status
  isValid: boolean;
  validationWarnings: string[];
}

/**
 * Geometry-level faults that the port-to-port check cannot see, keyed by joint id.
 *
 * ITEM 39. `validateAssemblyConnections` compares two DECLARED ports. Both the flash
 * tube outlet port and the cyclone inlet port are derived from the same model
 * quantities, so they agree by construction and the joint reports 0.00 mm and CONNECTED
 * even when the builder has stopped drawing the connection at all.
 *
 * That is exactly what happened to the tangential inlet: once the transition needed more
 * room than the flange standoff allowed, `cycloneInletStubLengthM` clamped to zero and the
 * builder skipped the stub and its flange plate, so the rectangular nozzle vanished from
 * the model while the checker stayed green.
 *
 * These checks are on the quantities the builder actually places geometry from, so they
 * fail when the drawn connection is missing, oversized or unreachable.
 */
function geometryIssuesFor(
  jointId: string,
  model?: ParametricModel3D
): string[] {
  if (!model || jointId !== 'joint_flashtube_cyclone') return [];
  const issues: string[] = [];

  const shellX = model.cycloneCenterXM - model.cycloneBarrelRadiusM;
  const flangeX = model.cycloneInletFlangePoint.x;
  const stubOuterX = flangeX + model.cycloneInletTransitionLengthM;
  const stubInnerX = stubOuterX + model.cycloneInletStubLengthM;

  if (model.cycloneInletStubLengthM <= 0) {
    issues.push(
      `tangential inlet stub is ${model.cycloneInletStubLengthM.toFixed(3)} m — the rectangular nozzle is not drawn at all`
    );
  }
  if (stubOuterX > shellX) {
    issues.push(
      `transition (${model.cycloneInletTransitionLengthM.toFixed(3)} m) overruns the flange-to-shell run by ${((stubOuterX - shellX) * 1000).toFixed(0)} mm, so there is no outside run for it`
    );
  }
  if (stubInnerX <= shellX) {
    issues.push(
      `inlet never reaches the barrel: stub ends ${((shellX - stubInnerX) * 1000).toFixed(0)} mm short of the shell`
    );
  }
  return issues;
}

/**
 * Validates kinematic port connections across the entire 3D mechanical assembly.
 * Checks:
 * - gap <= 0.5 mm
 * - angular misalignment <= 0.5 deg
 * - both connection ports exist
 * - connector has positive length (> 0)
 * - connector is not hidden or zero-sized
 */
export function validateAssemblyConnections(
  input: AssemblyConnection[] | ParametricModel3D | { connections?: AssemblyConnection[]; portsByName?: Record<string, ConnectionPort>; connectors?: AssemblyConnector[] }
): AssemblyValidationReport & { details: string[] } {
  let connections: AssemblyConnection[] = [];
  let portsByName: Record<string, ConnectionPort> | undefined;
  let connectors: AssemblyConnector[] | undefined;
  let modelRef: ParametricModel3D | undefined;

  if (Array.isArray(input)) {
    connections = input;
  } else if (input && typeof input === 'object') {
    connections = input.connections || [];
    portsByName = input.portsByName;
    connectors = input.connectors;
    // ITEM 39 — only treat the input as a model if it really is one. The builder's first
    // pass hands in `{ connections, portsByName, connectors }`, which has none of the
    // geometry fields; casting that blindly made the checks below read undefined.
    if (typeof (input as ParametricModel3D).cycloneCenterXM === 'number') {
      modelRef = input as ParametricModel3D;
    }
  }

  const reports: JointValidationReport[] = connections.map((conn) => {
    const fromPort = portsByName ? portsByName[conn.fromPort] : undefined;
    const toPort = portsByName ? portsByName[conn.toPort] : undefined;

    // Measured gap in mm
    let gapMm = conn.distanceMm ?? conn.portDistanceMm ?? 0.0;
    if (fromPort && toPort) {
      const dx = fromPort.position.x - toPort.position.x;
      const dy = fromPort.position.y - toPort.position.y;
      const dz = fromPort.position.z - toPort.position.z;
      gapMm = Math.hypot(dx, dy, dz) * 1000;
    }

    // Angular misalignment in degrees
    let angleDeg = conn.angleDeg ?? conn.angularErrorDeg ?? 0.0;
    if (fromPort && toPort) {
      // Ports facing each other should have opposite vectors (fromPort · (-toPort) ≈ 1)
      const dot =
        fromPort.direction.x * (-toPort.direction.x) +
        fromPort.direction.y * (-toPort.direction.y) +
        fromPort.direction.z * (-toPort.direction.z);
      const clampedDot = Math.min(1.0, Math.max(-1.0, dot));
      angleDeg = (Math.acos(clampedDot) * 180) / Math.PI;
    }

    const connectorLengthM = conn.connectorLengthM ?? 0.5;
    const hasPositiveConnector = connectorLengthM > 0.001;
    const portsExist = !portsByName || (!!fromPort && !!toPort);

    // ITEM 39 — port agreement is necessary but not sufficient. The port-to-port check
    // cannot see whether the builder drew the connection at all, so the geometry the
    // pieces are placed from is checked too.
    const geometryIssues = geometryIssuesFor(conn.id, modelRef);
    const geometryOk = geometryIssues.length === 0;

    // Pass tolerance strictly <= 0.5 mm and <= 0.5 deg
    const passed = gapMm <= 0.5 && angleDeg <= 0.5 && portsExist && hasPositiveConnector && geometryOk;

    return {
      jointId: conn.id,
      jointName: conn.jointName || conn.description || `${conn.fromComponent} → ${conn.toComponent}`,
      upstreamComponent: conn.fromComponent,
      upstreamPort: conn.fromPort,
      downstreamComponent: conn.toComponent,
      downstreamPort: conn.toPort,
      gapMm: Math.round(gapMm * 100) / 100,
      angularMisalignmentDeg: Math.round(angleDeg * 100) / 100,
      connectionType: conn.connectionType.replace('_', ' '),
      status: passed ? 'CONNECTED' : 'FAILED',
      connectorLengthM: Math.round(connectorLengthM * 1000) / 1000,
      passed,
      notes: geometryIssues.length
        ? `${conn.notes || conn.description || ''} | geometry: ${geometryIssues.join('; ')}`.trim()
        : conn.notes || conn.description,
      position: fromPort?.position,
    };
  });

  const totalCount = reports.length;
  const connectedCount = reports.filter((r) => r.passed).length;
  const allConnected = totalCount > 0 && connectedCount === totalCount;
  const failedJoints = reports.filter((r) => !r.passed);

  const statusSummary = `Kinematic Mating Status: ${connectedCount}/${totalCount} CONNECTED`;
  const details = reports.map(
    (r) =>
      `${r.upstreamComponent}.${r.upstreamPort} → ${r.downstreamComponent}.${r.downstreamPort}: ${r.status} (gap: ${r.gapMm.toFixed(1)} mm, angle: ${r.angularMisalignmentDeg.toFixed(1)}°, connection: ${r.connectionType})`
  );

  return {
    allConnected,
    connectedCount,
    totalCount,
    joints: reports,
    failedJoints,
    statusSummary,
    details,
  };
}

/**
 * Validation check ensuring 3D model conforms to physical reality,
 * fixed ground level, realistic proportions, and continuous connections.
 */
export function validateParametricModel(params: ParametricModel3D): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (params.groundElevationM !== 0) {
    warnings.push(`Ground elevation must be 0, found ${params.groundElevationM}`);
  }

  if (params.pipeRadiusM <= 0 || !Number.isFinite(params.pipeRadiusM)) {
    warnings.push(`Invalid pipe radius: ${params.pipeRadiusM}`);
  }

  if (params.riserHeightM < 2.0 || !Number.isFinite(params.riserHeightM)) {
    warnings.push(`Riser height too low or invalid: ${params.riserHeightM}`);
  }

  if (params.cycloneBarrelRadiusM <= 0 || !Number.isFinite(params.cycloneBarrelRadiusM)) {
    warnings.push(`Invalid cyclone radius: ${params.cycloneBarrelRadiusM}`);
  }

  if (params.cycloneDustOutletYM < params.clearanceBelowAirlockM) {
    warnings.push(`Cyclone dust outlet (${params.cycloneDustOutletYM}m) penetrates airlock clearance`);
  }

  if (params.airlockPosition.y - params.airlockHeightM / 2 < 0) {
    warnings.push(`Rotary airlock penetrates ground level (Y < 0)`);
  }

  const cyRatio = params.cycloneTotalHeightM / (params.cycloneBarrelRadiusM * 2);
  if (cyRatio < 2.5 || cyRatio > 5.5) {
    warnings.push(`Cyclone height to diameter ratio (${cyRatio.toFixed(2)}) deviates from Stairmand/Lapple standards`);
  }

  if (params.validationReport && !params.validationReport.allConnected) {
    warnings.push(
      `Assembly has ${params.validationReport.failedJoints.length} disconnected kinematic joints: ` +
        params.validationReport.failedJoints.map((j) => j.jointName).join(', ')
    );
  }

  return {
    isValid: warnings.length === 0,
    warnings,
  };
}

/**
 * Derives true, physically grounded 3D CAD dimensions (in meters)
 * from calculated engineering parameters.
 * 
 * Uses a single deterministic kinematic chain:
 * INTAKE -> AIR HEATER -> HOT-AIR DUCT -> VENTURI -> RISER -> TOP U-BEND ->
 * DOWNCOMER -> CYCLONE -> ROTARY AIRLOCK -> PRODUCT DISCHARGE
 * 
 * Every adjacent component shares an exact common connection port with 0.0 mm gap,
 * zero angular misalignment, and physically grounded structural frame.
 */
export function extractParametricModel(results: CalculationResults): ParametricModel3D {
  const { dimensions, heatExchanger, inputs } = results;

  // ITEM 3: The piping routing layout now drives the 3D model geometry.
  // The user's selection (single_loop, double_loop, straight_riser) determines
  // the overall piping configuration. The engine's developed length report
  // already accounts for the chosen layout, so the 3D model must match it.
  const routingLayout: 'single_loop' | 'double_loop' | 'straight_riser' =
    inputs.tubeRoutingLayout || 'single_loop';

  // 1. Permanent World Coordinate Ground Level
  const groundElevationM = 0.0;

  // 2. Nominal Pipe Diameter & Flash Drying System
  const pipeDiameterMm =
    Number.isFinite(dimensions?.tubeDiameterStandardMm) && dimensions.tubeDiameterStandardMm > 0
      ? dimensions.tubeDiameterStandardMm
      : 180;
  const pipeDiameterCalculatedMm =
    Number.isFinite(dimensions?.tubeDiameterCalculatedMm) && dimensions.tubeDiameterCalculatedMm > 0
      ? dimensions.tubeDiameterCalculatedMm
      : pipeDiameterMm;
  const pipeRadiusM = Math.max(0.04, pipeDiameterMm / 2000);
  const pipeWallThicknessM = Math.max(0.002, pipeRadiusM * 0.008);
  const flangeRadiusM = pipeRadiusM * 1.55;
  const flangeThicknessM = Math.max(0.016, pipeRadiusM * 0.045);

  // Let the riser be extended later, to absorb any length the layout cannot take in
  // a horizontal run. Declared `let` because item 27 raises it for straight_riser.
  let riserHeightM =
    Number.isFinite(dimensions?.verticalColumnHeightM) && dimensions.verticalColumnHeightM >= 3.0
      ? dimensions.verticalColumnHeightM
      : 7.0;
  let totalLengthM =
    Number.isFinite(dimensions?.totalPipeLengthM) && dimensions.totalPipeLengthM >= riserHeightM
      ? dimensions.totalPipeLengthM
      : Math.max(20.0, riserHeightM * 2.2);

  // ITEM 17: the 3D bend radius is now taken from the calculation engine rather
  // than re-derived in the geometry module.
  //
  // It was previously `max(0.40, pipeRadius x 2.5)`, which is 1.25 D because the
  // pipe radius is half the diameter. The engine sizes the elbow at
  // bendRadiusRatio x D, default 2.0 D, which is a long-radius ASME B16.9
  // 3D bend. The two disagreed by 60%, so the 3D model drew a tighter elbow than
  // the one the engine costed and the one the fabrication report specified: a
  // 1.25 D bend has a much higher pressure drop than a 2 D bend at the same
  // angle, and that pressure drop feeds the fan power. The drawing was therefore
  // not the machine being costed.
  //
  // developedLengthReport.bendRadiusM is authoritative, so changing the engine's
  // bend radius ratio changes the model, the elbow arc lengths used in the
  // centerline length, and the fabrication report together.
  const engineBendRadiusM = results.developedLengthReport?.bendRadiusM;
  const bendRadiusM =
    Number.isFinite(engineBendRadiusM) && engineBendRadiusM > 0
      ? engineBendRadiusM
      : Math.max(0.40, pipeRadiusM * 2.0); // fallback: long-radius 2 D elbow
  const loopOffsetZM = -bendRadiusM * 2.0;

  // Duct cross-sectional area. Declared here because both blower discharge nozzles
  // are sized from it (see ITEM 30) and they are computed above the elevation block.
  const ductAreaM2 = Math.PI * pipeRadiusM * pipeRadiusM;

  // Consistent Centerline Elevation Logic:
  // Must provide floor clearance for heater, flanges, and piping at all nominal diameters
  const ductCenterlineYM = Math.max(1.25, pipeRadiusM + 0.85);
  const riserBaseYM = ductCenterlineYM + bendRadiusM;
  // `riserTopYM` is recomputed after the run solve, because item 27 may raise the
  // riser to absorb length that the layout cannot take sideways.
  let riserTopYM = riserBaseYM + riserHeightM;

  // 3. Pressure System Architecture
  const pressureMode: PressureSystemType =
    results.pressureSystem?.type ?? results.inputs?.pressureSystemType ?? 'negative';

  const hasUpstreamBlower = pressureMode === 'positive' || pressureMode === 'balanced';
  const hasDownstreamBlower = pressureMode === 'negative' || pressureMode === 'balanced';
  const hasIntakeHood = pressureMode === 'negative';

  const fanPowerKW = Number.isFinite(dimensions?.fanMotorPowerKW) ? dimensions.fanMotorPowerKW : 7.5;

  // 4. Multi-Pass Air Heat Exchanger (Grounded on floor)
  const hexPasses = Math.max(1, Math.min(8, heatExchanger?.numberOfPasses || 2));
  const hexTubesCount = heatExchanger?.totalTubesCount || 24;
  const hexDutyKW = heatExchanger?.thermalDutyKW || 120;
  const hexWidthM = Math.max(0.9, 0.75 + hexPasses * 0.14 + pipeRadiusM * 0.6);
  const hexDepthM = Math.max(0.9, 0.7 + Math.sqrt(hexTubesCount) * 0.08 + pipeRadiusM * 0.8);
  const hexHeightM = Math.max(1.4, ductCenterlineYM + pipeRadiusM + 0.35);

  // 5. Upstream Forced-Draft Blower (Cold Air Intake before Heater)
  const upstreamBlowerPowerKW = pressureMode === 'balanced' ? fanPowerKW * 0.45 : fanPowerKW;
  const upstreamBlowerVoluteRadiusM = Math.max(0.36, 0.30 + Math.sqrt(upstreamBlowerPowerKW) * 0.045 + pipeRadiusM * 0.2);
  const upstreamBlowerWidthM = Math.max(0.28, upstreamBlowerVoluteRadiusM * 0.65);
  const upstreamBlowerInletRadiusM = upstreamBlowerVoluteRadiusM * 0.45;
  // Same duct-derived discharge nozzle as the downstream fan. See the note there.
  const upstreamNozzleAreaM2 = ductAreaM2 * 1.15;
  const upstreamBlowerOutletWidthM = Math.max(pipeRadiusM * 1.6, Math.sqrt(upstreamNozzleAreaM2));
  const upstreamBlowerOutletHeightM = Math.max(
    pipeRadiusM * 1.6,
    upstreamNozzleAreaM2 / upstreamBlowerOutletWidthM
  );
  const upstreamBlowerMotorRadiusM = upstreamBlowerVoluteRadiusM * 0.32;
  const upstreamBlowerMotorLengthM = upstreamBlowerVoluteRadiusM * 0.8;
  const upstreamBlowerSkidHeightM = 0.15;
  const upstreamBlowerCenterYM = upstreamBlowerSkidHeightM + upstreamBlowerVoluteRadiusM;

  // 6. Venturi Gas Accelerator & Mixing Section
  const venturiThroatDiameterMm =
    Number.isFinite(dimensions?.venturiThroatDiameterMm) && dimensions.venturiThroatDiameterMm > 0
      ? dimensions.venturiThroatDiameterMm
      : Math.round(pipeDiameterMm * 0.75);
  const venturiThroatRadiusM = Math.max(0.03, venturiThroatDiameterMm / 2000);
  const venturiInletRadiusM = pipeRadiusM;
  const venturiConvLengthM = Math.max(0.30, pipeRadiusM * 2.2);
  const venturiThroatLengthM = Math.max(0.20, pipeRadiusM * 1.5);
  const venturiDivLengthM = Math.max(0.40, pipeRadiusM * 3.5);

  // 7. Kinematic Placement along Process Centerline:
  // Venturi throat center is placed at X = 0.0
  const venturiPosition = { x: 0.0, y: ductCenterlineYM, z: 0.0 };
  const venturiInletX = venturiPosition.x - venturiThroatLengthM / 2 - venturiConvLengthM;
  const venturiOutletX = venturiPosition.x + venturiThroatLengthM / 2 + venturiDivLengthM;

  // Hot-air straight duct connector between Heat Exchanger and Venturi
  const hotAirDuctLengthM = Math.max(0.65, pipeRadiusM * 2.2);
  const hexOutletX = venturiInletX - hotAirDuctLengthM;
  const hexInletX = hexOutletX - hexWidthM;
  const hexPosition = {
    x: (hexInletX + hexOutletX) / 2,
    y: hexHeightM / 2,
    z: 0.0,
  };

  // Upstream Blower / Intake Hood Placement:
  const intakeHoodWidthM = Math.max(0.40, pipeRadiusM * 2.8);
  const intakeHoodHeightM = Math.max(0.40, pipeRadiusM * 2.8);
  const intakeHoodPosition = { x: hexInletX, y: ductCenterlineYM, z: 0.0 };

  const upstreamBlowerDuctLengthM = Math.max(0.50, pipeRadiusM * 1.8);
  const upstreamBlowerPosition = {
    x: hexInletX - upstreamBlowerDuctLengthM - upstreamBlowerVoluteRadiusM * 0.7,
    y: upstreamBlowerCenterYM,
    z: 0.0,
  };

  // 8. Feed Hopper & Metering Screw Conveyor
  const hopDesign = results.hopperDesign;
  const screwDesign = results.screwFeederDesign;

  const hopperTopWidthM = hopDesign?.topWidthM ?? Math.max(0.50, pipeRadiusM * 3.2);
  const hopperTopLengthM = hopDesign?.topLengthM ?? Math.max(0.50, pipeRadiusM * 4.2);
  const hopperOutletWidthM = hopDesign?.outletWidthM ?? 0.32;
  const hopperOutletLengthM = hopDesign?.outletLengthM ?? 0.22;
  const hopperUpperHeightM = hopDesign?.upperVerticalHeightM ?? 0.10;
  const hopperLowerHeightM = hopDesign?.lowerTaperedHeightM ?? 0.556;
  const hopperHeightM = hopDesign?.overallHeightM ?? (hopperUpperHeightM + hopperLowerHeightM);
  const hopperBottomWidthM = hopperOutletWidthM;

  const screwRadiusM = screwDesign ? (screwDesign.screwDiameterMm / 2000) : Math.max(0.05, (dimensions?.screwDiameterMm || 100) / 2000);
  const screwBarrelLengthM = screwDesign ? (screwDesign.screwLengthMm / 1000) : Math.max(1.0, hopperTopLengthM + 0.35);
  const screwPitchM = screwDesign ? (screwDesign.screwPitchMm / 1000) : (screwRadiusM * 2);
  const screwShaftRadiusM = screwDesign ? (screwDesign.shaftDiameterMm / 2000) : (screwRadiusM * 0.38);
  const screwMotorLengthM = 0.35;
  const chuteHeightM = Math.max(0.30, pipeRadiusM + 0.15);

  // Mounted directly above the venturi throat (Z = 0 for perfect vertical gravity chute drop)
  const feederPosition = {
    x: venturiPosition.x - screwBarrelLengthM * 0.35,
    y: ductCenterlineYM + venturiThroatRadiusM + chuteHeightM + screwRadiusM,
    z: 0.0,
  };

  // 9. Vertical Flash Drying Riser & Loops:
  const riserX = venturiOutletX + bendRadiusM;
  const downcomerZ = loopOffsetZM; // -2 * bendRadiusM

  // ITEM 27 — the plan offset of the downcomer IS the horizontal run, and nothing else.
  //
  // An earlier attempt added a separate `layoutPlanOffsetM` on top of the run. That
  // double-counted the displacement: the run already moves the downcomer in X, so a
  // second offset on top of it pushed the downcomer downstream of the cyclone it was
  // meant to feed.
  //
  // There is exactly one X displacement in this routing, and it is the run:
  //
  //     riser -> U-bend (pure Z-Y arc, no X change)
  //          -> horizontal run  (the ONLY X displacement, = runX)
  //          -> downcomer (vertical)
  //          -> fixed elbow + fixed inlet spool into the tangential flange
  //
  // `straight_riser` is then simply the case where that run is zero, which puts the
  // riser and the downcomer on one vertical centreline with a pure 180° return — the
  // "U-turn is straight" arrangement. `routingLayout` was previously read from the
  // inputs and then never branched on, so every layout drew the same bent return and
  // the option appeared to do nothing. The layout now CAPS the run, which is what
  // actually distinguishes the three options.
  //
  // The cap is expressed as a fraction of the riser height rather than an absolute,
  // so it scales with the machine instead of being a fixed number of metres.

  // 10. Cyclone Separator (Strictly Sized & Grounded)
  const isStairmand = (dimensions?.cycloneType ?? inputs?.cycloneType ?? 'stairmand') === 'stairmand';
  const rawCycloneDiameterMm =
    Number.isFinite(dimensions?.cycloneDiameterMm) && dimensions.cycloneDiameterMm > 0
      ? dimensions.cycloneDiameterMm
      : 450;
  const cycloneDiameterMm = Math.max(180, rawCycloneDiameterMm);
  const cycloneBarrelRadiusM = cycloneDiameterMm / 2000;

  const cycloneCylinderHeightM =
    Number.isFinite(dimensions?.cycloneCylinderHeightMm) && dimensions.cycloneCylinderHeightMm > 0
      ? dimensions.cycloneCylinderHeightMm / 1000
      : cycloneBarrelRadiusM * 2 * (isStairmand ? 1.5 : 2.0);
  const cycloneConeHeightM =
    Number.isFinite(dimensions?.cycloneConeHeightMm) && dimensions.cycloneConeHeightMm > 0
      ? dimensions.cycloneConeHeightMm / 1000
      : cycloneBarrelRadiusM * 2 * (isStairmand ? 2.5 : 2.0);
  const cycloneTotalHeightM = cycloneCylinderHeightM + cycloneConeHeightM;

  const cycloneVortexFinderRadiusM =
    Number.isFinite(dimensions?.cycloneVortexFinderDiameterMm) && dimensions.cycloneVortexFinderDiameterMm > 0
      ? dimensions.cycloneVortexFinderDiameterMm / 2000
      : cycloneBarrelRadiusM * 0.5;
  const cycloneVortexFinderLengthM = Math.max(0.2, cycloneBarrelRadiusM * 2 * (isStairmand ? 0.5 : 0.625));
  const cycloneDustOutletRadiusM =
    Number.isFinite(dimensions?.cycloneDustOutletDiameterMm) && dimensions.cycloneDustOutletDiameterMm > 0
      ? dimensions.cycloneDustOutletDiameterMm / 2000
      : cycloneBarrelRadiusM * (isStairmand ? 0.375 : 0.25);

  const cycloneInletHeightM =
    Number.isFinite(dimensions?.cycloneInletHeightMm) && dimensions.cycloneInletHeightMm > 0
      ? dimensions.cycloneInletHeightMm / 1000
      : cycloneBarrelRadiusM * 2 * 0.5;
  const cycloneInletWidthM =
    Number.isFinite(dimensions?.cycloneInletWidthMm) && dimensions.cycloneInletWidthMm > 0
      ? dimensions.cycloneInletWidthMm / 1000
      : cycloneBarrelRadiusM * 2 * (isStairmand ? 0.2 : 0.25);
  // ITEM 39 — the tangential inlet needs the transition to FIT OUTSIDE the barrel, with a
  // stub left to carry it through the shell.
  //
  // `cycloneInletLengthM` used to be `barrelRadiusM * 1.5`, which put the flange a fixed
  // half-barrel-radius OUTSIDE the shell and then asked the transition to fit in that
  // space. On a 450 mm duct it just about managed (0.274 m of transition into 0.289 m of
  // room); on a 1000 mm duct it wanted 0.961 m into the same 0.289 m and did not fit.
  //
  // When it did not fit, the old code clamped the stub to zero:
  //
  //     stubLen = max(0, min(stubInnerTarget - stubOuter, -stubOuter))
  //
  // and the builder SKIPS the stub and its flange plate when stubLen is zero. So the
  // rectangular tangential inlet simply stopped being drawn — the connection the user was
  // looking at ceased to exist — while `validateAssemblyConnections` went on reporting
  // 0.00 mm and CONNECTED, because it only ever compared the two declared ports and never
  // looked at a drawn vertex.
  //
  // The standoff is now DERIVED from the transition it has to host: the flange sits far
  // enough outside the shell that the 1:2.5 transition always fits with room to spare,
  // and the stub is then whatever is left plus the shell penetration. That makes a
  // positive stub and a positive penetration a consequence of the sizing rather than
  // something that has to be clamped back into existence.
  const inletHalfHeightM = cycloneInletHeightM / 2;
  const inletHalfWidthM = cycloneInletWidthM / 2;
  const ductOuterRadiusM = pipeRadiusM;
  // Length the transition needs at a 1:2.5 wall angle (~22 deg, the usual limit for a
  // spun or flued sheet-metal transition), driven by the LARGER half-dimension change.
  const inletWallAngleLengthM =
    2.5 * Math.max(
      Math.abs(ductOuterRadiusM - inletHalfHeightM),
      Math.abs(ductOuterRadiusM - inletHalfWidthM)
    );
  // How far the tangential nozzle must project past the shell to read as an inlet.
  // Measured from the shell, not from the barrel centre.
  const inletPenetrationM = Math.min(0.15, cycloneBarrelRadiusM / 2);
  // Flange standoff from the shell. 0.75 leaves a quarter of the outside run for the
  // stub, so the stub cannot be squeezed out.
  const inletFlangeStandOffM = Math.max(inletWallAngleLengthM / 0.75, 0.25);
  // Flange to barrel centre, so the barrel still sits one inlet length beyond the flange
  // and the existing `inletGap === bendRadius + inletLength` invariant still holds.
  const cycloneInletLengthM = cycloneBarrelRadiusM + inletFlangeStandOffM;
  const cycloneInletTransitionLengthM = inletWallAngleLengthM;
  const cycloneInletStubLengthM = inletFlangeStandOffM + inletPenetrationM - cycloneInletTransitionLengthM;

  // The transition itself — a REAL one, landing exactly on the inlet rectangle — is
  // specified in ITEM 39 above, together with the standoff that hosts it. What is easy to
  // get wrong and worth restating here: the duct and the inlet are sized independently
  // and they do NOT match. On the IITA load the duct is 450 mm round and the tangential
  // inlet is 231 x 579 mm. The Stairmand/Lapple inlet proportions are correct cyclone
  // design and stay; the duct is a user-chosen standard size; the transition absorbs the
  // difference. Sizing the transition off only the half-WIDTH change would put a 1:1.7
  // wall on the converging side at narrow inlets, which is not buildable, so it is driven
  // by the larger of the two.

  // 11. Rotary Airlock Valve & Ground Clearance
  const clearanceBelowAirlockM = 0.45;
  // ITEM 23: the rotor is sized from the engine's airlock diameter, so the 3D
  // model, the DXF and the PDF all show the same valve. It previously used
  // spigotRadius x 1.15, a third figure that matched neither the PDF's 150 mm nor
  // the spigot it discharges from.
  const airlockRadiusM = Math.max(0.12, (dimensions.airlockDiameterMm ?? 2 * cycloneDustOutletRadiusM * 1000) / 2000);
  const airlockHeightM = Math.max(0.28, airlockRadiusM * 2.1);
  const airlockMotorLengthM = 0.32;

  // Cyclone Elevation Anchoring:
  const airlockCenterYM = clearanceBelowAirlockM + airlockHeightM / 2;
  const cycloneDustOutletYM = clearanceBelowAirlockM + airlockHeightM;
  const coneTipYM = cycloneDustOutletYM + 0.15;
  const cycloneJunctionYM = coneTipYM + cycloneConeHeightM;
  const cycloneBarrelTopYM = cycloneJunctionYM + cycloneCylinderHeightM;
  const cycloneLugsYM = cycloneJunctionYM + cycloneCylinderHeightM * 0.40;
  const cycloneInletYM = cycloneBarrelTopYM - cycloneInletHeightM / 2 - 0.04;

  // 12. Cyclone Spatial Coordinate Derivation:
  // Mathematical key: cycloneCenterZM is calculated so the tangential inlet box
  // perfectly coincides with downcomerZ (-2 * bendRadiusM)
  const cycloneCenterZM = downcomerZ - cycloneBarrelRadiusM + cycloneInletWidthM / 2;

  // ITEM 27 — the inlet transition is a FIXED quarter elbow, not a spool.
  //
  // It is sized from the bend radius only, deliberately NOT from the cyclone
  // diameter: anchoring the cyclone to a clearance that included the barrel radius
  // made the barrel slide sideways whenever the cyclone was resized, which changed
  // the transition length, which changed the solved run, which moved the downcomer.
  // Every input tweak reshuffled the inlet.
  //
  // The cyclone's X is assigned AFTER the run is solved, below, so the chain is
  // strictly one-directional:
  //
  //     riser -> U-bend -> [ run ] -> downcomer -> [ quarter elbow ] -> inlet
  //
  // and nothing reads the cyclone back into the run. That removes what would
  // otherwise be a cycle, since downcomerX is needed to place the cyclone and the
  // run is needed to place the downcomer.

  // ITEM 36 — the downcomer exit is placed from the elbow's REACH, with no floor.
  //
  // The exit must sit exactly one bend radius above the inlet centreline, because the
  // inlet elbow's reach is also exactly one bend radius. With both equal the elbow is
  // a clean quarter circle: no straight lead-in, no straight run, tangent-continuous
  // into the downcomer above and square onto the tangential inlet below.
  //
  // This was `Math.max(cycloneInletYM + bendRadiusM, 3.2)`. The floor is a latent
  // version of the same bug this line already guards against in the other direction:
  // a short inlet for a small cyclone would be silently overridden, `downcomerExitYM`
  // would report the floored value, and the drawn rise would stop matching the reach,
  // reintroducing a lead-in that pushes the elbow off the duct axis.
  //
  // It is worth being precise about the floor's actual reach: it is DEAD CODE. Across
  // pipe diameters 80-1000 mm and feed rates 0.2-60 t/h the smallest value of
  // `inletYM + bendRadiusM` is 5.572 m, so the 3.2 m clamp never fires on anything the
  // app can produce. Removing it changes no output; it makes the quarter-circle
  // invariant unconditional instead of conditional, and leaves nothing to mislead the
  // next reader into believing a floor is load-bearing.
  //
  // An earlier note here blamed the inlet centre sitting below the barrel top for a
  // visible 29 mm misalignment at the flange. That was wrong — it measured
  // `cycloneBarrelTopYM` where the code reads `cycloneInletYM`, making the rise look
  // like 1.2295 m instead of 0.900 m. At the IITA load reach and rise were, and still
  // are, both exactly 0.900 m. The misalignment was in the BUILDER's control points;
  // see ITEM 36 in geometryBuilder.ts.
  const inletElbowReachM = bendRadiusM;
  const downcomerExitY = cycloneInletYM + inletElbowReachM;

  // ---- SOLVE THE HORIZONTAL RUN (hoisted above the cyclone anchor) -------------
  //
  // ITEM 16 / ITEM 27. The engine's developed length puts only the column height in
  // the riser and the balance in a horizontal spool, so the 3D model has to
  // reproduce that spool or it is not the machine being costed. Earlier this was
  // solved with a bisection because the transition into the cyclone shrank as the
  // run grew, making the objective nonlinear.
  //
  // It is hoisted above the cyclone anchor because the anchor is now derived FROM
  // the downcomer, and the downcomer from the run. Solving the run after placing the
  // cyclone would make the two mutually dependent.
  //
  // With a fixed inlet transition the objective is linear — a metre of run is a
  // metre of pipe — so this is a subtraction and a clamp, not an iteration.
  const l_base_elbow_est = (Math.PI / 2) * bendRadiusM;
  const l_riser_est = riserHeightM;
  const l_top_ubend_est = Math.PI * bendRadiusM;
  const l_downcomer_est = riserTopYM - downcomerExitY;
  const l_venturi_duct_est = venturiDivLengthM + venturiConvLengthM + venturiThroatLengthM + hotAirDuctLengthM;
  // The turn from the downcomer's vertical run into the tangential inlet.
  //
  // With the flange one bend radius downstream and the exit one bend radius above the
  // inlet (both established above), the elbow consumes the ENTIRE turn: a single
  // quarter circle, with no straight lead-in and no straight run. So the transition
  // length is exactly one quarter arc.
  //
  // An earlier version charged a full elbow PLUS a separate spool here, which
  // overcounted the transition by 1.35 m at the default design — the model claimed
  // more pipe between the downcomer and the cyclone than the drawn geometry contains.
  const l_inlet_transition_est = (Math.PI / 2) * bendRadiusM;

  const lengthExcludingRunAndTransition =
    l_base_elbow_est +
    l_riser_est +
    l_top_ubend_est +
    l_downcomer_est +
    l_venturi_duct_est +
    l_inlet_transition_est;

  const runDeficitM = totalLengthM - lengthExcludingRunAndTransition;

  // LAYOUT CAP — this is what finally makes `routingLayout` mean something.
  //   straight_riser — no run at all, so the return is a pure 180° bend and the
  //                   riser and downcomer share one vertical centreline. This is the
  //                   arrangement the user asked for.
  //   single_loop    — a modest run.
  //   double_loop    — a long run, twice the single-loop allowance.
  // Caps scale with the riser height so they follow the machine rather than being a
  // fixed number of metres.
  const layoutRunCapFactor =
    routingLayout === 'straight_riser' ? 0 : routingLayout === 'double_loop' ? 1.0 : 0.5;
  const layoutRunCapM = riserHeightM * layoutRunCapFactor;

  const horizontalRunM = Math.max(0, Math.min(Math.max(0, runDeficitM), layoutRunCapM));
  const transitionLengthAt = (_runX: number): number => l_inlet_transition_est;

  // Whatever the layout cap could not absorb — in EITHER direction — is taken by the
  // riser, which is the one remaining degree of freedom.
  //
  // The engine's developed length is a hard requirement of item 16: the drawing must
  // be the machine being costed. With the riser pinned by the engine's column height,
  // two failures were possible and both occurred:
  //
  //   - a straight_riser caps the run at zero, so the routing fell SHORT of the target;
  //   - a large cyclone makes the fixed elbow+spool generous enough that the routing
  //     came out LONG, by 4-6% on the 2 and 3 t/h capacity cases.
  //
  // So the riser is adjusted in whichever direction is needed, by half the residual.
  // HALF, because the downcomer descends from riserTopYM: moving riserTopYM by X
  // changes the riser AND the return by X each, so one metre of riser change
  // supplies or removes TWO metres of pipe.
  //
  // Physically this is the right place to spend the adjustment. A vertical column
  // contributes to pressure drop only through its own friction, whereas the same
  // metre spent sideways in a horizontal run adds bend losses and needs supports.
  const runAfterCapM = horizontalRunM;
  const residualM = totalLengthM - (lengthExcludingRunAndTransition + runAfterCapM);
  if (Math.abs(residualM) > 0.001) {
    // Floor the column so a large negative residual cannot drive the riser below a
    // structurally sensible height. The residual then stays visible in
    // pipeLengthDifferencePercent rather than being silently absorbed.
    const MIN_RISER_HEIGHT_M = 3.0;
    const nextRiserHeightM = Math.max(MIN_RISER_HEIGHT_M, riserHeightM + residualM / 2);
    riserHeightM = nextRiserHeightM;
    riserTopYM = riserBaseYM + riserHeightM;
  }

  const downcomerX = riserX + horizontalRunM;

  // ITEM 32 — the cyclone hangs off the DOWNCOMER, with the inlet turned to face the
  // duct.
  //
  // Two earlier anchors were both wrong in different ways:
  //
  //   riser + minClearance        let the solved run push the downcomer PAST the
  //                               cyclone, so the duct fed it from behind (negative
  //                               gap, -0.40 m at the default design).
  //   downcomer + inletSpool      sized the spool from the pipe and bend while the
  //                               barrel centre sat a further inletLength on, which
  //                               left the flange 68 mm BEHIND the downcomer. The
  //                               elbow then had to turn back on itself — the hook
  //                               visible where the duct met the barrel.
  //
  // The flange must sit exactly ONE BEND RADIUS downstream, and the barrel centre one
  // inlet length beyond that:
  //
  //     downcomer ──┐
  //                 │  rise  = bendRadius  (downcomerExitY is inletYM + bendRadius)
  //                 └──►  flange   advance = bendRadius
  //                       ──► barrel centre   + cycloneInletLength
  //
  // Both axes of the turn are then consumed by the elbow itself, leaving NO straight
  // lead-in and NO straight run: a single tangent-continuous quarter circle from the
  // vertical downcomer to the horizontal tangential inlet. That is the compact
  // arrangement, and it is why the two radii have to match — the exit elevation is
  // derived from the same bend radius.
  //
  // The inlet stays tangential: the barrel centre in Z is already offset so the duct
  // meets the shell on its tangent line, which is unchanged by this edit.
  const cycloneCenterXM = downcomerX + bendRadiusM + cycloneInletLengthM;

  const airlockPosition = {
    x: cycloneCenterXM,
    y: airlockCenterYM,
    z: cycloneCenterZM,
  };

  const cycloneInletFlangePoint = {
    x: cycloneCenterXM - cycloneInletLengthM,
    y: cycloneInletYM,
    z: downcomerZ,
  };

  // 13. Downstream Induced-Draft Blower (after Cyclone)
  const downstreamBlowerPowerKW = pressureMode === 'balanced' ? fanPowerKW * 0.55 : fanPowerKW;
  const downstreamBlowerVoluteRadiusM = Math.max(0.36, 0.30 + Math.sqrt(downstreamBlowerPowerKW) * 0.045 + pipeRadiusM * 0.2);
  const downstreamBlowerWidthM = Math.max(0.28, downstreamBlowerVoluteRadiusM * 0.65);
  const downstreamBlowerInletRadiusM = downstreamBlowerVoluteRadiusM * 0.45;

  // ITEM 30 — the discharge nozzle is sized FROM THE DUCT, not from the volute.
  //
  // The outlet was `voluteRadius x 0.45` wide by `voluteRadius x 0.55` tall, which
  // scales with the FAN rather than with the AIR. At the default 450 mm volute that
  // is 203 x 248 mm = 0.050 m^2 against a 180 mm duct's 0.025 m^2 — the nozzle was
  // 1.97x the area of the pipe it had to mate with. A discharge 2x oversized on
  // area passes at half the duct velocity, so the drawn transition read as a
  // sudden expansion and the connection could never look like it flowed.
  //
  // The nozzle area is now held to 1.15x the duct area (a normal discharge
  // transition, slightly oversized to keep velocity up), and then made
  // SQUARE-AROUND, which is how a fan discharge nozzle is actually specified. The
  // aspect follows from the area and the volute width rather than being invented.
  const nozzleAreaM2 = ductAreaM2 * 1.15;
  const downstreamBlowerOutletWidthM = Math.max(pipeRadiusM * 1.6, Math.sqrt(nozzleAreaM2));
  const downstreamBlowerOutletHeightM = Math.max(
    pipeRadiusM * 1.6,
    nozzleAreaM2 / downstreamBlowerOutletWidthM
  );
  const downstreamBlowerMotorRadiusM = downstreamBlowerVoluteRadiusM * 0.32;
  // ITEM 33 — the exhaust stack is an equal-area round section on the fan discharge.
  // Equal area means the same mass flow at the same velocity, which is what makes it
  // a correct discharge rather than an arbitrary size.
  //
  // NOTE: the stack itself is no longer drawn — the fan outlet was removed at the user's
  // request. The radius is retained because it is a reportable quantity (the discharge
  // area the fan is sized against) and `downstreamBlowerOutletWidthM/HeightM` remain the
  // fan's own discharge port. Nothing in the 3D assembly places geometry from it.
  const downstreamStackRadiusM = Math.max(0.10, Math.sqrt(nozzleAreaM2 / Math.PI));
  // ITEM 40 — the reducer that lets the outlet duct enter the fan suction throat.
  //
  // The overhead duct is sized from the cyclone vortex finder (0.2895 m radius at the
  // IITA load, giving a 0.579 m duct) while the fan suction throat is
  // `downstreamBlowerVoluteRadiusM * 0.45` (0.2167 m, a 0.433 m opening). The duct
  // overhung the throat by 146 mm in DIAMETER: it could not enter it.
  //
  // Both ends are round and coaxial, so the correct transition is a concentric cone and
  // its length follows the same 1:2.5 wall rule used for the cyclone inlet transition
  // (ITEM 37).
  //
  // There is no length cap now. `idSuctionStandoffM` used to bound this, because the duct
  // had to turn from vertical into +Z to reach a nozzle standing off to one side, and
  // that turn ate most of the available straight. The connection is now a plain vertical
  // drop onto a nozzle sitting on TOP of the volute, so the run is the full height of the
  // drop and the wall angle is the only limit.
  const idSuctionReducerLengthM = Math.max(
    0.06,
    2.5 * Math.abs(cycloneVortexFinderRadiusM - downstreamBlowerInletRadiusM)
  );
  const downstreamBlowerMotorLengthM = downstreamBlowerVoluteRadiusM * 0.8;
  const downstreamBlowerSkidHeightM = 0.15;
  const downstreamBlowerCenterYM = downstreamBlowerSkidHeightM + downstreamBlowerVoluteRadiusM;

  const downstreamBlowerPosition = {
    // ITEM 38 — the fan must stand far enough downstream for a TRUE 180 degree return
    // bend.
    //
    // The cyclone outlet leaves the vortex finder travelling +Y and must arrive above
    // the fan travelling −Y, so both legs are vertical and the return is a semicircle
    // whose radius is exactly half the horizontal span between them:
    //
    //     R = |fanX - cycloneX| / 2
    //
    // For that to be a proper long-radius elbow, R must be at least bendRadiusM, i.e.
    // the span must be at least 2 * bendRadiusM. The previous spacing,
    // `max(1.8, cycloneBarrelRadiusM + 1.2)`, is a fixed metre figure with no relation
    // to the engine's bend radius, and 27 of 81 swept input combinations violated it —
    // worst case a span of 1.8 m needing R = 2.0 m, short by 1.1 m.
    //
    // The only way out of that is to move the fan. Shrinking R instead is what produced
    // the shouldered arch: two tight bends unable to meet, so a straight had to be
    // inserted across the top.
    x: cycloneCenterXM + Math.max(2 * bendRadiusM, cycloneBarrelRadiusM + 1.2, 1.8),
    y: downstreamBlowerCenterYM,
    z: cycloneCenterZM,
  };

  const blowerPosition = hasUpstreamBlower ? upstreamBlowerPosition : downstreamBlowerPosition;
  const blowerVoluteRadiusM = hasUpstreamBlower ? upstreamBlowerVoluteRadiusM : downstreamBlowerVoluteRadiusM;
  const blowerWidthM = hasUpstreamBlower ? upstreamBlowerWidthM : downstreamBlowerWidthM;
  const blowerInletRadiusM = hasUpstreamBlower ? upstreamBlowerInletRadiusM : downstreamBlowerInletRadiusM;
  const blowerOutletWidthM = hasUpstreamBlower ? upstreamBlowerOutletWidthM : downstreamBlowerOutletWidthM;
  const blowerOutletHeightM = hasUpstreamBlower ? upstreamBlowerOutletHeightM : downstreamBlowerOutletHeightM;
  const blowerMotorRadiusM = hasUpstreamBlower ? upstreamBlowerMotorRadiusM : downstreamBlowerMotorRadiusM;
  const blowerMotorLengthM = hasUpstreamBlower ? upstreamBlowerMotorLengthM : downstreamBlowerMotorLengthM;
  const blowerSkidHeightM = hasUpstreamBlower ? upstreamBlowerSkidHeightM : downstreamBlowerSkidHeightM;

  // 14. Structural Framework:
  const columnProfileSizeM = 0.10; // 100mm HSS
  const riserTowerWidthM = Math.max(1.2, pipeRadiusM * 6.0);
  const riserTowerDepthM = Math.max(1.2, Math.abs(loopOffsetZM) + 0.6);
  const riserTowerHeightM = riserTopYM + 0.6;
  const cycloneTowerSpanM = cycloneBarrelRadiusM * 1.6;
  const cycloneTowerHeightM = cycloneLugsYM;
  const platformElevationsM = [
    2.4,
    4.8,
    Math.min(riserTowerHeightM - 0.4, riserTopYM - 0.2),
  ];

  // 15. Pipe Swept Centerline (100% continuous without breaks):
  const centerlinePoints: { x: number; y: number; z: number }[] = [];

  if (hasUpstreamBlower) {
    centerlinePoints.push({ x: upstreamBlowerPosition.x - upstreamBlowerVoluteRadiusM * 0.6, y: upstreamBlowerPosition.y, z: 0 });
    centerlinePoints.push({ x: upstreamBlowerPosition.x + upstreamBlowerVoluteRadiusM * 0.75, y: ductCenterlineYM, z: 0 });
    centerlinePoints.push({ x: hexInletX, y: ductCenterlineYM, z: 0 });
  } else {
    centerlinePoints.push({ x: hexInletX - 0.45, y: ductCenterlineYM, z: 0 });
    centerlinePoints.push({ x: hexInletX, y: ductCenterlineYM, z: 0 });
  }

  // Through Heat Exchanger
  centerlinePoints.push({ x: hexOutletX, y: ductCenterlineYM, z: 0 });
  // Hot Air Duct to Venturi
  centerlinePoints.push({ x: venturiInletX, y: ductCenterlineYM, z: 0 });
  centerlinePoints.push({ x: venturiPosition.x, y: ductCenterlineYM, z: 0 });
  centerlinePoints.push({ x: venturiOutletX, y: ductCenterlineYM, z: 0 });

  // 90° Base long-radius elbow
  const baseElbowSteps = 8;
  for (let i = 1; i <= baseElbowSteps; i++) {
    const angle = (Math.PI / 2) * (i / baseElbowSteps);
    const x = venturiOutletX + bendRadiusM * Math.sin(angle);
    const y = ductCenterlineYM + bendRadiusM * (1 - Math.cos(angle));
    centerlinePoints.push({ x, y, z: 0 });
  }

  // Vertical Flash Riser
  centerlinePoints.push({ x: riserX, y: riserBaseYM, z: 0 });
  centerlinePoints.push({ x: riserX, y: riserBaseYM + riserHeightM * 0.5, z: 0 });
  centerlinePoints.push({ x: riserX, y: riserTopYM, z: 0 });

  // 180° Top Circular U-Bend looping into -Z
  const uBendSteps = 12;
  for (let i = 1; i <= uBendSteps; i++) {
    const angle = (Math.PI * i) / uBendSteps;
    const y = riserTopYM + bendRadiusM * Math.sin(angle);
    const z = -bendRadiusM * (1 - Math.cos(angle));
    centerlinePoints.push({ x: riserX, y, z });
  }

  // ITEM 16: the 3D routing must reproduce the engine's developed length.
  //
  // The centreline previously ran venturi -> base elbow -> riser -> U-bend ->
  // downcomer -> transition, with no horizontal run at all. The engine's
  // single_loop layout puts only the column height in the riser and the balance
  // in a horizontal spool, so the 3D model came out about 3.5 m SHORT: 16.5 m
  // against the engine's 20 m. The drawing was not the machine being costed, and
  // the shortfall was computed into pipeLengthDifferencePercent and then never
  // displayed, so it was invisible.
  //
  // A horizontal run is inserted between the U-bend and the downcomer, matching
  // the engine's `seg-loop-straight`.
  //
  // The run length is not simply the deficit. Moving the downcomer out by runX
  // shortens the transition into the cyclone by almost the same amount, so simply
  // adding the deficit would land back at the original total. The run is therefore
  // solved for, by bisection on
  //
  // The run, its cap and the transition length are all solved further UP, next to
  // next to the run solve, because the cyclone anchor below is derived from
  // `downcomerX` and so cannot be placed before the run is known.

  // Horizontal run from the U-bend exit to the top of the downcomer. An
  // intermediate point so it renders as a straight run rather than one long segment.
  if (horizontalRunM > 0.01) {
    centerlinePoints.push({ x: riserX + horizontalRunM * 0.5, y: riserTopYM, z: downcomerZ });
  }
  centerlinePoints.push({ x: downcomerX, y: riserTopYM, z: downcomerZ });

  // Downcomer vertical descent
  centerlinePoints.push({ x: downcomerX, y: (riserTopYM + downcomerExitY) * 0.5, z: downcomerZ });
  centerlinePoints.push({ x: downcomerX, y: downcomerExitY, z: downcomerZ });

  // Transition into the cyclone tangential inlet. When the downcomer already sits
  // on the inlet centreline there is no turn to make and the two points are the
  // same; otherwise this is the diagonal leg.
  centerlinePoints.push({ x: cycloneInletFlangePoint.x, y: cycloneInletYM, z: downcomerZ });

  // Calculate true developed centerline length
  const l_base_elbow = (Math.PI / 2) * bendRadiusM;
  const l_riser = riserHeightM;
  const l_top_ubend = Math.PI * bendRadiusM;
  const l_downcomer = riserTopYM - downcomerExitY;
  const l_horizontal_run = horizontalRunM;
  const l_transition = transitionLengthAt(horizontalRunM);
  const l_venturi_duct = venturiDivLengthM + venturiConvLengthM + venturiThroatLengthM + hotAirDuctLengthM;
  const pipeCenterlineLengthM =
    Math.round(
      (l_base_elbow + l_riser + l_top_ubend + l_downcomer + l_horizontal_run + l_transition + l_venturi_duct) * 100,
    ) / 100;
  // Signed, not absolute. The absolute form hid the direction of the error; a
  // signed value is what a reviewer needs to see, and it is now displayed in the
  // viewer rather than computed and discarded.
  const pipeLengthDifferencePercent =
    Math.round(((pipeCenterlineLengthM - totalLengthM) / Math.max(0.1, totalLengthM)) * 1000) / 10;

  // 15B. Wet Feed Centerline Flow Path (Hopper -> Screw Barrel -> Drop Chute -> Venturi Throat)
  const feedCenterlinePoints: { x: number; y: number; z: number }[] = [
    { x: feederPosition.x - hopperTopLengthM * 0.35, y: feederPosition.y + hopperHeightM * 0.5, z: 0 },
    { x: feederPosition.x, y: feederPosition.y, z: 0 },
    { x: venturiPosition.x, y: feederPosition.y - screwRadiusM, z: 0 },
    { x: venturiPosition.x, y: ductCenterlineYM, z: 0 },
  ];

  // 15C. Clean Exhaust Air Centerline Flow Path (Cyclone Vortex Finder -> Overhead Duct / ID Fan -> Clean Exhaust Stack)
  const exhaustCenterlinePoints: { x: number; y: number; z: number }[] = [];
  if (hasDownstreamBlower) {
    const cyTopY = cycloneBarrelTopYM + 0.4;
    const overheadY = cyTopY + 0.65;
    const idSuctionPt = { x: downstreamBlowerPosition.x, y: downstreamBlowerPosition.y, z: cycloneCenterZM };
    exhaustCenterlinePoints.push(
      { x: cycloneCenterXM, y: cycloneJunctionYM + 0.5, z: cycloneCenterZM },
      { x: cycloneCenterXM, y: cyTopY, z: cycloneCenterZM },
      { x: cycloneCenterXM, y: overheadY, z: cycloneCenterZM },
      { x: downstreamBlowerPosition.x, y: overheadY, z: cycloneCenterZM },
      { x: idSuctionPt.x, y: idSuctionPt.y + 0.45, z: idSuctionPt.z },
      {
        x: downstreamBlowerPosition.x + downstreamBlowerVoluteRadiusM * 0.75,
        y: downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55 + 0.3,
        z: cycloneCenterZM,
      },
      {
        x: downstreamBlowerPosition.x + downstreamBlowerVoluteRadiusM * 0.75,
        y: downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55 + 2.7,
        z: cycloneCenterZM,
      }
    );
  } else {
    exhaustCenterlinePoints.push(
      { x: cycloneCenterXM, y: cycloneJunctionYM + 0.5, z: cycloneCenterZM },
      { x: cycloneCenterXM, y: cycloneBarrelTopYM + 0.5, z: cycloneCenterZM },
      { x: cycloneCenterXM, y: cycloneBarrelTopYM + 1.2, z: cycloneCenterZM },
      { x: cycloneCenterXM + 0.8, y: cycloneBarrelTopYM + 2.3, z: cycloneCenterZM }
    );
  }

  // 16. Named Ports System (Exposed for Kinematic Port Verification)
  const portsByName: Record<string, ConnectionPort> = {};

  // Port: intake.outlet
  const intakeOutletPort: ConnectionPort = {
    id: 'intake.outlet',
    componentId: 'intake',
    name: 'intake.outlet',
    position: hasUpstreamBlower
      ? { x: upstreamBlowerPosition.x - upstreamBlowerVoluteRadiusM * 0.6, y: upstreamBlowerPosition.y, z: 0.0 }
      : { x: hexInletX, y: ductCenterlineYM, z: 0.0 },
    direction: { x: 1, y: 0, z: 0 },
    nominalDiameterMm: pipeDiameterMm,
    connectionType: 'flanged',
  };
  portsByName['intake.outlet'] = intakeOutletPort;

  // Port: blower.inlet (if upstream blower exists)
  const blowerInletPort: ConnectionPort = {
    id: 'blower.inlet',
    componentId: 'blower',
    name: 'blower.inlet',
    position: hasUpstreamBlower
      ? { x: upstreamBlowerPosition.x - upstreamBlowerVoluteRadiusM * 0.6, y: upstreamBlowerPosition.y, z: 0.0 }
      : { x: downstreamBlowerPosition.x, y: downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55, z: cycloneCenterZM },
    direction: hasUpstreamBlower ? { x: -1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 },
    nominalDiameterMm: Math.round(
      (hasUpstreamBlower ? upstreamBlowerInletRadiusM : downstreamBlowerInletRadiusM) * 2000
    ),
    connectionType: 'flanged',
  };
  portsByName['blower.inlet'] = blowerInletPort;

  // Port: blower.outlet (Primary or upstream supply blower)
  const blowerOutletPort: ConnectionPort = {
    id: 'blower.outlet',
    componentId: 'blower',
    name: 'blower.outlet',
    position: hasUpstreamBlower
      ? { x: hexInletX, y: ductCenterlineYM, z: 0.0 }
      : {
          x: downstreamBlowerPosition.x + downstreamBlowerVoluteRadiusM * 0.75,
          y: downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55 + 0.3,
          z: cycloneCenterZM,
        },
    direction: hasUpstreamBlower ? { x: 1, y: 0, z: 0 } : { x: 0, y: 1, z: 0 },
    nominalDiameterMm: Math.round(
      (hasUpstreamBlower ? upstreamBlowerInletRadiusM : downstreamBlowerInletRadiusM) * 2000
    ),
    connectionType: 'flanged',
  };
  portsByName['blower.outlet'] = blowerOutletPort;

  // Dedicated ports for downstream ID fan in balanced / dual-fan mode
  const downstreamBlowerOutletPort: ConnectionPort = {
    id: 'downstreamBlower.outlet',
    componentId: 'blower',
    name: 'downstreamBlower.outlet',
    position: {
      x: downstreamBlowerPosition.x + downstreamBlowerVoluteRadiusM * 0.75,
      y: downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55 + 0.3,
      z: cycloneCenterZM,
    },
    direction: { x: 0, y: 1, z: 0 },
    nominalDiameterMm: Math.round(downstreamBlowerInletRadiusM * 2000),
    connectionType: 'flanged',
  };
  portsByName['downstreamBlower.outlet'] = downstreamBlowerOutletPort;
  portsByName['supplyBlower.outlet'] = {
    id: 'supplyBlower.outlet',
    componentId: 'blower',
    name: 'supplyBlower.outlet',
    position: { x: hexInletX, y: ductCenterlineYM, z: 0.0 },
    direction: { x: 1, y: 0, z: 0 },
    nominalDiameterMm: Math.round(upstreamBlowerInletRadiusM * 2000),
    connectionType: 'flanged',
  };

  // Port: overheadDuct.inlet (for negative and balanced draft modes)
  const overheadDuctInletPort: ConnectionPort = {
    id: 'overheadDuct.inlet',
    componentId: 'overhead_duct',
    name: 'overheadDuct.inlet',
    position: { x: cycloneCenterXM, y: cycloneBarrelTopYM + 0.4, z: cycloneCenterZM },
    direction: { x: 0, y: -1, z: 0 },
    nominalDiameterMm: Math.round(cycloneVortexFinderRadiusM * 2000),
    connectionType: 'flanged',
  };
  portsByName['overheadDuct.inlet'] = overheadDuctInletPort;

  // Port: overheadDuct.outlet
  const overheadDuctOutletPort: ConnectionPort = {
    id: 'overheadDuct.outlet',
    componentId: 'overhead_duct',
    name: 'overheadDuct.outlet',
    position: {
      x: downstreamBlowerPosition.x,
      y: downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55,
      z: cycloneCenterZM,
    },
    direction: { x: 0, y: -1, z: 0 },
    nominalDiameterMm: Math.round(downstreamBlowerInletRadiusM * 2000),
    connectionType: 'flanged',
  };
  portsByName['overheadDuct.outlet'] = overheadDuctOutletPort;

  // Port: heater.inlet
  const heaterInletPort: ConnectionPort = {
    id: 'heater.inlet',
    componentId: 'heater',
    name: 'heater.inlet',
    position: { x: hexInletX, y: ductCenterlineYM, z: 0.0 },
    direction: { x: -1, y: 0, z: 0 },
    nominalDiameterMm: pipeDiameterMm,
    connectionType: 'flanged',
  };
  portsByName['heater.inlet'] = heaterInletPort;

  // Port: heater.outlet (at hot-air duct discharge mating with venturi inlet)
  const heaterOutletPort: ConnectionPort = {
    id: 'heater.outlet',
    componentId: 'heater',
    name: 'heater.outlet',
    position: { x: venturiInletX, y: ductCenterlineYM, z: 0.0 },
    direction: { x: 1, y: 0, z: 0 },
    nominalDiameterMm: pipeDiameterMm,
    connectionType: 'flanged',
  };
  portsByName['heater.outlet'] = heaterOutletPort;

  // Port: venturi.airInlet
  const venturiAirInletPort: ConnectionPort = {
    id: 'venturi.airInlet',
    componentId: 'venturi',
    name: 'venturi.airInlet',
    position: { x: venturiInletX, y: ductCenterlineYM, z: 0.0 },
    direction: { x: -1, y: 0, z: 0 },
    nominalDiameterMm: pipeDiameterMm,
    connectionType: 'flanged',
  };
  portsByName['venturi.airInlet'] = venturiAirInletPort;

  // Port: venturi.feedInlet
  const venturiFeedInletPort: ConnectionPort = {
    id: 'venturi.feedInlet',
    componentId: 'venturi',
    name: 'venturi.feedInlet',
    position: { x: venturiPosition.x, y: ductCenterlineYM + venturiThroatRadiusM + 0.22, z: 0.0 },
    direction: { x: 0, y: 1, z: 0 },
    nominalDiameterMm: Math.round(venturiThroatRadiusM * 2000 * 0.8),
    connectionType: 'chute',
  };
  portsByName['venturi.feedInlet'] = venturiFeedInletPort;

  // Port: feeder.discharge / feeder.outlet
  const feederDischargePort: ConnectionPort = {
    id: 'feeder.discharge',
    componentId: 'feeder',
    name: 'feeder.outlet',
    position: { x: venturiPosition.x, y: ductCenterlineYM + venturiThroatRadiusM + 0.22, z: 0.0 },
    direction: { x: 0, y: -1, z: 0 },
    nominalDiameterMm: Math.round(venturiThroatRadiusM * 2000 * 0.8),
    connectionType: 'chute',
  };
  portsByName['feeder.outlet'] = feederDischargePort;
  portsByName['feeder.discharge'] = feederDischargePort;

  // Port: venturi.outlet
  const venturiOutletPort: ConnectionPort = {
    id: 'venturi.outlet',
    componentId: 'venturi',
    name: 'venturi.outlet',
    position: { x: venturiOutletX, y: ductCenterlineYM, z: 0.0 },
    direction: { x: 1, y: 0, z: 0 },
    nominalDiameterMm: pipeDiameterMm,
    connectionType: 'flanged',
  };
  portsByName['venturi.outlet'] = venturiOutletPort;

  // Port: flashTube.inlet
  const flashTubeInletPort: ConnectionPort = {
    id: 'flashTube.inlet',
    componentId: 'column',
    name: 'flashTube.inlet',
    position: { x: venturiOutletX, y: ductCenterlineYM, z: 0.0 },
    direction: { x: -1, y: 0, z: 0 },
    nominalDiameterMm: pipeDiameterMm,
    connectionType: 'flanged',
  };
  portsByName['flashTube.inlet'] = flashTubeInletPort;

  // Port: flashTube.outlet
  const flashTubeOutletPort: ConnectionPort = {
    id: 'flashTube.outlet',
    componentId: 'column',
    name: 'flashTube.outlet',
    position: { x: cycloneInletFlangePoint.x, y: cycloneInletFlangePoint.y, z: cycloneInletFlangePoint.z },
    direction: { x: 1, y: 0, z: 0 },
    nominalDiameterMm: pipeDiameterMm,
    connectionType: 'tangential',
  };
  portsByName['flashTube.outlet'] = flashTubeOutletPort;

  // Port: cyclone.inlet
  const cycloneInletPort: ConnectionPort = {
    id: 'cyclone.inlet',
    componentId: 'cyclone',
    name: 'cyclone.inlet',
    position: { x: cycloneInletFlangePoint.x, y: cycloneInletFlangePoint.y, z: cycloneInletFlangePoint.z },
    direction: { x: -1, y: 0, z: 0 },
    nominalDiameterMm: Math.round(cycloneInletWidthM * 1000),
    connectionType: 'tangential',
  };
  portsByName['cyclone.inlet'] = cycloneInletPort;

  // Port: cyclone.productOutlet
  const cycloneProductOutletPort: ConnectionPort = {
    id: 'cyclone.productOutlet',
    componentId: 'cyclone',
    name: 'cyclone.productOutlet',
    position: { x: cycloneCenterXM, y: cycloneDustOutletYM, z: cycloneCenterZM },
    direction: { x: 0, y: -1, z: 0 },
    nominalDiameterMm: Math.round(cycloneDustOutletRadiusM * 2000),
    connectionType: 'flanged',
  };
  portsByName['cyclone.productOutlet'] = cycloneProductOutletPort;

  // Port: rotaryValve.inlet
  const rotaryValveInletPort: ConnectionPort = {
    id: 'rotaryValve.inlet',
    componentId: 'rotary',
    name: 'rotaryValve.inlet',
    position: { x: cycloneCenterXM, y: cycloneDustOutletYM, z: cycloneCenterZM },
    direction: { x: 0, y: 1, z: 0 },
    nominalDiameterMm: Math.round(cycloneDustOutletRadiusM * 2000),
    connectionType: 'flanged',
  };
  portsByName['rotaryValve.inlet'] = rotaryValveInletPort;

  // Port: rotaryValve.outlet
  const rotaryValveOutletPort: ConnectionPort = {
    id: 'rotaryValve.outlet',
    componentId: 'rotary',
    name: 'rotaryValve.outlet',
    position: { x: cycloneCenterXM, y: cycloneDustOutletYM - airlockHeightM, z: cycloneCenterZM },
    direction: { x: 0, y: -1, z: 0 },
    nominalDiameterMm: Math.round(cycloneDustOutletRadiusM * 2000),
    connectionType: 'chute',
  };
  portsByName['rotaryValve.outlet'] = rotaryValveOutletPort;

  // Port: discharge.inlet
  const dischargeInletPort: ConnectionPort = {
    id: 'discharge.inlet',
    componentId: 'rotary',
    name: 'discharge.inlet',
    position: { x: cycloneCenterXM, y: cycloneDustOutletYM - airlockHeightM, z: cycloneCenterZM },
    direction: { x: 0, y: 1, z: 0 },
    nominalDiameterMm: Math.round(cycloneDustOutletRadiusM * 2000),
    connectionType: 'chute',
  };
  portsByName['discharge.inlet'] = dischargeInletPort;

  // Port: cyclone.exhaustOutlet
  const cycloneExhaustOutletPort: ConnectionPort = {
    id: 'cyclone.exhaustOutlet',
    componentId: 'cyclone',
    name: 'cyclone.exhaustOutlet',
    position: { x: cycloneCenterXM, y: cycloneBarrelTopYM + 0.4, z: cycloneCenterZM },
    direction: { x: 0, y: 1, z: 0 },
    nominalDiameterMm: Math.round(cycloneVortexFinderRadiusM * 2000),
    connectionType: 'flanged',
  };
  portsByName['cyclone.exhaustOutlet'] = cycloneExhaustOutletPort;

  // Port: exhaust.inlet
  const exhaustInletPort: ConnectionPort = {
    id: 'exhaust.inlet',
    componentId: 'exhaust',
    name: 'exhaust.inlet',
    position: hasDownstreamBlower
      ? {
          x: downstreamBlowerPosition.x + downstreamBlowerVoluteRadiusM * 0.75,
          y: downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55 + 0.3,
          z: cycloneCenterZM,
        }
      : { x: cycloneCenterXM, y: cycloneBarrelTopYM + 0.4, z: cycloneCenterZM },
    direction: { x: 0, y: -1, z: 0 },
    nominalDiameterMm: Math.round(cycloneVortexFinderRadiusM * 2000),
    connectionType: 'flanged',
  };
  portsByName['exhaust.inlet'] = exhaustInletPort;

  // Group ports by component
  const ports: Record<string, ConnectionPort[]> = {
    intake: [intakeOutletPort],
    heater: [heaterInletPort, heaterOutletPort],
    venturi: [venturiAirInletPort, venturiFeedInletPort, venturiOutletPort],
    feeder: [feederDischargePort],
    column: [flashTubeInletPort, flashTubeOutletPort],
    cyclone: [cycloneInletPort, cycloneProductOutletPort, cycloneExhaustOutletPort],
    rotary: [rotaryValveInletPort, rotaryValveOutletPort],
    blower: [blowerInletPort, blowerOutletPort],
    exhaust: [exhaustInletPort],
  };

  // 17. Mechanical Connectors (Between ports):
  const connectors: AssemblyConnector[] = [];

  // Connector 1: Intake to Heater (or Intake to Blower in positive mode)
  connectors.push({
    id: 'conn_geom_intake_heater',
    name: hasUpstreamBlower ? 'Blower Cold-Air Supply Duct Spool' : 'Fresh-Air Intake Weather Louver Hood',
    type: hasUpstreamBlower ? 'straight_duct' : 'flanged_connection',
    startPoint: hasUpstreamBlower ? blowerOutletPort.position : intakeOutletPort.position,
    endPoint: heaterInletPort.position,
    startDirection: { x: 1, y: 0, z: 0 },
    endDirection: { x: 1, y: 0, z: 0 },
    lengthM: hasUpstreamBlower ? upstreamBlowerDuctLengthM : 0.38,
    nominalDiameterMm: pipeDiameterMm,
    isVisible: true,
  });

  // Connector 2: Hot-Air Duct from Heater to Venturi
  connectors.push({
    id: 'conn_geom_heater_venturi',
    name: 'Insulated Hot-Air Pneumatic Duct Spool',
    type: 'straight_duct',
    startPoint: heaterOutletPort.position,
    endPoint: venturiAirInletPort.position,
    startDirection: { x: 1, y: 0, z: 0 },
    endDirection: { x: 1, y: 0, z: 0 },
    lengthM: hotAirDuctLengthM,
    nominalDiameterMm: pipeDiameterMm,
    isVisible: true,
  });

  // Connector 3: Sealed Gravity Drop Chute from Feeder to Venturi Throat
  connectors.push({
    id: 'conn_geom_feeder_venturi',
    name: 'Sealed Wet-Mash Gravity Injection Chute',
    type: 'gravity_chute',
    startPoint: { x: venturiPosition.x, y: feederPosition.y - screwRadiusM, z: 0.0 },
    endPoint: venturiFeedInletPort.position,
    startDirection: { x: 0, y: -1, z: 0 },
    endDirection: { x: 0, y: -1, z: 0 },
    lengthM: chuteHeightM,
    nominalDiameterMm: Math.round(venturiThroatRadiusM * 2000 * 0.8),
    isVisible: true,
  });

  // Connector 4: 90° Long-Radius Circular Swept Base Elbow
  connectors.push({
    id: 'conn_geom_venturi_column',
    name: '90° Long-Radius Circular Swept Base Elbow',
    type: 'long_radius_elbow',
    startPoint: venturiOutletPort.position,
    endPoint: { x: riserX, y: riserBaseYM, z: 0.0 },
    startDirection: { x: 1, y: 0, z: 0 },
    endDirection: { x: 0, y: 1, z: 0 },
    lengthM: (Math.PI / 2) * bendRadiusM,
    nominalDiameterMm: pipeDiameterMm,
    isVisible: true,
  });

  // Connector 5: Downcomer Transition into Cyclone Tangential Inlet Box
  connectors.push({
    id: 'conn_geom_column_cyclone',
    name: 'Cyclone Tangential Inlet Transition Spool',
    type: 'tangential_cyclone_inlet',
    startPoint: flashTubeOutletPort.position,
    endPoint: cycloneInletPort.position,
    startDirection: { x: 1, y: 0, z: 0 },
    endDirection: { x: 1, y: 0, z: 0 },
    lengthM: cycloneInletLengthM,
    nominalDiameterMm: Math.round(cycloneInletWidthM * 1000),
    isVisible: true,
  });

  // Connector 6: Cyclone Conical Dust Outlet Spool to Rotary Valve
  connectors.push({
    id: 'conn_geom_cyclone_rotary',
    name: 'Cyclone Dust Discharge Spool & Flange',
    type: 'flanged_connection',
    startPoint: cycloneProductOutletPort.position,
    endPoint: rotaryValveInletPort.position,
    startDirection: { x: 0, y: -1, z: 0 },
    endDirection: { x: 0, y: -1, z: 0 },
    lengthM: 0.15,
    nominalDiameterMm: Math.round(cycloneDustOutletRadiusM * 2000),
    isVisible: true,
  });

  // Connector 7: Rotary Airlock Discharge Chute to Flour Collection Bin
  connectors.push({
    id: 'conn_geom_rotary_discharge',
    name: 'Dried Flour Discharge Chute & Collection Spool',
    type: 'gravity_chute',
    startPoint: rotaryValveOutletPort.position,
    endPoint: dischargeInletPort.position,
    startDirection: { x: 0, y: -1, z: 0 },
    endDirection: { x: 0, y: -1, z: 0 },
    lengthM: clearanceBelowAirlockM,
    nominalDiameterMm: Math.round(cycloneDustOutletRadiusM * 2000),
    isVisible: true,
  });

  // Connector 8 & 9: Cyclone Gas Exhaust and Blower Stack
  if (hasDownstreamBlower) {
    connectors.push({
      id: 'conn_geom_cyclone_overhead',
      name: 'Overhead ID Fan Suction Duct',
      type: 'straight_duct',
      startPoint: cycloneExhaustOutletPort.position,
      endPoint: blowerInletPort.position,
      startDirection: { x: 0, y: 1, z: 0 },
      endDirection: { x: 0, y: 1, z: 0 },
      lengthM: Math.hypot(
        downstreamBlowerPosition.x - cycloneCenterXM,
        downstreamBlowerPosition.y - cycloneBarrelTopYM
      ),
      nominalDiameterMm: Math.round(cycloneVortexFinderRadiusM * 2000),
      isVisible: true,
    });

    connectors.push({
      id: 'conn_geom_blower_stack',
      name: 'Clean Air Vertical Exhaust Stack',
      type: 'stack_clamp',
      startPoint: blowerOutletPort.position,
      endPoint: exhaustInletPort.position,
      startDirection: { x: 0, y: 1, z: 0 },
      endDirection: { x: 0, y: 1, z: 0 },
      lengthM: 2.4,
      nominalDiameterMm: Math.round(cycloneVortexFinderRadiusM * 2000),
      isVisible: true,
    });
  } else {
    connectors.push({
      id: 'conn_geom_cyclone_stack',
      name: 'Atmospheric Exhaust Sweep Stack',
      type: 'stack_clamp',
      startPoint: cycloneExhaustOutletPort.position,
      endPoint: exhaustInletPort.position,
      startDirection: { x: 0, y: 1, z: 0 },
      endDirection: { x: 0, y: 1, z: 0 },
      lengthM: 1.8,
      nominalDiameterMm: Math.round(cycloneVortexFinderRadiusM * 2000),
      isVisible: true,
    });
  }

  // 18. Kinematic Assembly Connections (Always exactly 9 Process Joints in every mode):
  const connections: AssemblyConnection[] = [];

  // Helper Euclidean distance in mm
  const distMm = (p1: { x: number; y: number; z: number }, p2: { x: number; y: number; z: number }) =>
    Math.round(Math.hypot(p1.x - p2.x, p1.y - p2.y, p1.z - p2.z) * 10000) / 10;

  if (pressureMode === 'positive') {
    // POSITIVE DRAFT (9 JOINTS):
    // 1. Intake -> Blower Suction
    connections.push({
      id: 'joint_1_intake_blower',
      jointName: 'Fresh-Air Intake to FD Blower Suction',
      fromComponent: 'intake',
      fromPort: 'intake.outlet',
      toComponent: 'blower',
      toPort: 'blower.inlet',
      connectionType: 'flange_bolted',
      portDistanceMm: distMm(intakeOutletPort.position, blowerInletPort.position),
      distanceMm: distMm(intakeOutletPort.position, blowerInletPort.position),
      angularErrorDeg: 0,
      angleDeg: 0,
      status: 'CONNECTED',
      connectorLengthM: 0.35,
      connectorType: 'straight_duct',
      passed: true,
      description: 'Ambient air intake bellmouth screened flange mated to forced-draft blower suction nozzle',
      notes: 'Ambient air intake bellmouth screened flange mated to forced-draft blower suction nozzle',
    });

    // 2. Blower -> Air Heater
    connections.push({
      id: 'joint_2_blower_heater',
      jointName: 'FD Blower Discharge to Air Heater Inlet',
      fromComponent: 'blower',
      fromPort: 'blower.outlet',
      toComponent: 'heater',
      toPort: 'heater.inlet',
      connectionType: 'flange_bolted',
      portDistanceMm: distMm(blowerOutletPort.position, heaterInletPort.position),
      distanceMm: distMm(blowerOutletPort.position, heaterInletPort.position),
      angularErrorDeg: 0,
      angleDeg: 0,
      status: 'CONNECTED',
      connectorLengthM: upstreamBlowerDuctLengthM,
      connectorType: 'straight_duct',
      passed: true,
      description: 'Forced-draft supply duct flanged to heat exchanger cold-air inlet plenum',
      notes: 'Forced-draft supply duct flanged to heat exchanger cold-air inlet plenum',
    });
  } else {
    // NEGATIVE / BALANCED DRAFT:
    // 1. Intake / Supply Air to Air Heater
    const fromComp = hasUpstreamBlower ? 'blower' : 'intake';
    const fromP = hasUpstreamBlower ? blowerOutletPort : intakeOutletPort;
    connections.push({
      id: 'joint_1_intake_heater',
      jointName: hasUpstreamBlower ? 'FD Supply Fan Discharge to Air Heater' : 'Fresh-Air Intake Weather Hood to Air Heater',
      fromComponent: fromComp,
      fromPort: hasUpstreamBlower ? 'blower.outlet' : 'intake.outlet',
      toComponent: 'heater',
      toPort: 'heater.inlet',
      connectionType: 'flange_bolted',
      portDistanceMm: distMm(fromP.position, heaterInletPort.position),
      distanceMm: distMm(fromP.position, heaterInletPort.position),
      angularErrorDeg: 0,
      angleDeg: 0,
      status: 'CONNECTED',
      connectorLengthM: hasUpstreamBlower ? upstreamBlowerDuctLengthM : 0.38,
      connectorType: hasUpstreamBlower ? 'straight_duct' : 'flanged_connection',
      passed: true,
      description: hasUpstreamBlower
        ? 'Forced-draft balancing supply fan discharge duct flanged to heat exchanger'
        : 'Fresh air intake weather louver hood flanged directly to heat exchanger intake plenum',
      notes: hasUpstreamBlower
        ? 'Forced-draft balancing supply fan discharge duct flanged to heat exchanger'
        : 'Fresh air intake weather louver hood flanged directly to heat exchanger intake plenum',
    });
  }

  // Joint: Heater to Venturi
  connections.push({
    id: 'joint_heater_venturi',
    jointName: 'Air Heater Discharge to Venturi Gas Inlet',
    fromComponent: 'heater',
    fromPort: 'heater.outlet',
    toComponent: 'venturi',
    toPort: 'venturi.airInlet',
    connectionType: 'flange_bolted',
    portDistanceMm: 0.0,
    distanceMm: 0.0,
    angularErrorDeg: 0,
    angleDeg: 0,
    status: 'CONNECTED',
    connectorLengthM: hotAirDuctLengthM,
    connectorType: 'straight_duct',
    passed: true,
    description: 'Insulated hot air duct spool connecting heat exchanger discharge to venturi gas accelerator inlet',
    notes: 'Insulated hot air duct spool connecting heat exchanger discharge to venturi gas accelerator inlet',
  });

  // Joint: Feeder to Venturi Throat
  connections.push({
    id: 'joint_feeder_venturi',
    jointName: 'Screw Feeder Chute to Venturi Throat Injection Port',
    fromComponent: 'feeder',
    fromPort: 'feeder.outlet',
    toComponent: 'venturi',
    toPort: 'venturi.feedInlet',
    connectionType: 'gravity_chute',
    portDistanceMm: distMm(feederDischargePort.position, venturiFeedInletPort.position),
    distanceMm: distMm(feederDischargePort.position, venturiFeedInletPort.position),
    angularErrorDeg: 0,
    angleDeg: 0,
    status: 'CONNECTED',
    connectorLengthM: chuteHeightM,
    connectorType: 'gravity_chute',
    passed: true,
    description: 'Wet mash gravity drop chute sealed directly over venturi high-velocity dispersion throat',
    notes: 'Wet mash gravity drop chute sealed directly over venturi high-velocity dispersion throat',
  });

  // Joint: Venturi to Flash Drying Tube
  connections.push({
    id: 'joint_venturi_flashtube',
    jointName: 'Venturi Diffuser to Flash Drying Tube Base Sweep Elbow',
    fromComponent: 'venturi',
    fromPort: 'venturi.outlet',
    toComponent: 'column',
    toPort: 'flashTube.inlet',
    connectionType: 'swept_elbow',
    portDistanceMm: distMm(venturiOutletPort.position, flashTubeInletPort.position),
    distanceMm: distMm(venturiOutletPort.position, flashTubeInletPort.position),
    angularErrorDeg: 0,
    angleDeg: 0,
    status: 'CONNECTED',
    connectorLengthM: (Math.PI / 2) * bendRadiusM,
    connectorType: 'long_radius_elbow',
    passed: true,
    description: 'Venturi diffuser outlet flanged to pneumatic drying tube base 90° long-radius swept elbow',
    notes: 'Venturi diffuser outlet flanged to pneumatic drying tube base 90° long-radius swept elbow',
  });

  // Joint: Flash Tube to Cyclone Tangential Inlet
  connections.push({
    id: 'joint_flashtube_cyclone',
    jointName: 'Flash Tube Downcomer to Cyclone Tangential Inlet',
    fromComponent: 'column',
    fromPort: 'flashTube.outlet',
    toComponent: 'cyclone',
    toPort: 'cyclone.inlet',
    connectionType: 'tangential_duct',
    portDistanceMm: distMm(flashTubeOutletPort.position, cycloneInletPort.position),
    distanceMm: distMm(flashTubeOutletPort.position, cycloneInletPort.position),
    angularErrorDeg: 0,
    angleDeg: 0,
    status: 'CONNECTED',
    connectorLengthM: cycloneInletLengthM,
    connectorType: 'tangential_cyclone_inlet',
    passed: true,
    description: 'Downcomer transition spool bolted directly to cyclone tangential rectangular entry box',
    notes: 'Downcomer transition spool bolted directly to cyclone tangential rectangular entry box',
  });

  // Joint: Cyclone Dust Outlet to Rotary Valve
  connections.push({
    id: 'joint_cyclone_rotary',
    jointName: 'Cyclone Conical Dust Spool to Rotary Valve Top Inlet',
    fromComponent: 'cyclone',
    fromPort: 'cyclone.productOutlet',
    toComponent: 'rotary',
    toPort: 'rotaryValve.inlet',
    connectionType: 'flange_bolted',
    portDistanceMm: distMm(cycloneProductOutletPort.position, rotaryValveInletPort.position),
    distanceMm: distMm(cycloneProductOutletPort.position, rotaryValveInletPort.position),
    angularErrorDeg: 0,
    angleDeg: 0,
    status: 'CONNECTED',
    connectorLengthM: 0.15,
    connectorType: 'flanged_connection',
    passed: true,
    description: 'Cyclone conical dust outlet flanged to rotary airlock valve top inlet flange',
    notes: 'Cyclone conical dust outlet flanged to rotary airlock valve top inlet flange',
  });

  // Joint: Rotary Valve to Product Discharge Chute
  connections.push({
    id: 'joint_rotary_discharge',
    jointName: 'Rotary Valve Discharge to Flour Collection Chute',
    fromComponent: 'rotary',
    fromPort: 'rotaryValve.outlet',
    toComponent: 'rotary',
    toPort: 'discharge.inlet',
    connectionType: 'gravity_chute',
    portDistanceMm: distMm(rotaryValveOutletPort.position, dischargeInletPort.position),
    distanceMm: distMm(rotaryValveOutletPort.position, dischargeInletPort.position),
    angularErrorDeg: 0,
    angleDeg: 0,
    status: 'CONNECTED',
    connectorLengthM: clearanceBelowAirlockM,
    connectorType: 'gravity_chute',
    passed: true,
    description: 'Rotary airlock valve discharge spool flanged to bagging drop chute above ground',
    notes: 'Rotary airlock valve discharge spool flanged to bagging drop chute above ground',
  });

  // Joints for Exhaust Stream:
  if (hasDownstreamBlower) {
    // 8. Cyclone Vortex Finder to Overhead ID Suction Duct
    connections.push({
      id: 'joint_cyclone_overhead',
      jointName: 'Cyclone Vortex Finder to Overhead ID Suction Duct',
      fromComponent: 'cyclone',
      fromPort: 'cyclone.exhaustOutlet',
      toComponent: 'overhead_duct',
      toPort: 'overheadDuct.inlet',
      connectionType: 'flange_bolted',
      portDistanceMm: distMm(cycloneExhaustOutletPort.position, overheadDuctInletPort.position),
      distanceMm: distMm(cycloneExhaustOutletPort.position, overheadDuctInletPort.position),
      angularErrorDeg: 0,
      angleDeg: 0,
      status: 'CONNECTED',
      connectorLengthM: Math.hypot(
        downstreamBlowerPosition.x - cycloneCenterXM,
        downstreamBlowerPosition.y - cycloneBarrelTopYM
      ),
      connectorType: 'straight_duct',
      passed: true,
      description: 'Cyclone vortex finder flanged to overhead ID fan suction connecting duct',
      notes: 'Cyclone vortex finder flanged to overhead ID fan suction connecting duct',
    });

    // 9. ID Fan Discharge to Clean Air Exhaust Stack
    const idDischargePort = hasUpstreamBlower ? downstreamBlowerOutletPort : blowerOutletPort;
    const idDischargePortName = hasUpstreamBlower ? 'downstreamBlower.outlet' : 'blower.outlet';
    connections.push({
      id: 'joint_blower_stack',
      jointName: 'Induced-Draft Fan Discharge to Vertical Exhaust Stack',
      fromComponent: 'blower',
      fromPort: idDischargePortName,
      toComponent: 'exhaust',
      toPort: 'exhaust.inlet',
      connectionType: 'stack_clamp',
      portDistanceMm: distMm(idDischargePort.position, exhaustInletPort.position),
      distanceMm: distMm(idDischargePort.position, exhaustInletPort.position),
      angularErrorDeg: 0,
      angleDeg: 0,
      status: 'CONNECTED',
      connectorLengthM: 2.4,
      connectorType: 'stack_clamp',
      passed: true,
      description: 'Induced-draft fan discharge nozzle flanged to vertical exhaust stack',
      notes: 'Induced-draft fan discharge nozzle flanged to vertical exhaust stack',
    });
  } else {
    // In POSITIVE mode: Joint 9 is Cyclone Vortex Finder to Atmospheric Sweep Stack
    connections.push({
      id: 'joint_cyclone_stack',
      jointName: 'Cyclone Vortex Finder to Atmospheric Sweep Stack',
      fromComponent: 'cyclone',
      fromPort: 'cyclone.exhaustOutlet',
      toComponent: 'exhaust',
      toPort: 'exhaust.inlet',
      connectionType: 'stack_clamp',
      portDistanceMm: distMm(cycloneExhaustOutletPort.position, exhaustInletPort.position),
      distanceMm: distMm(cycloneExhaustOutletPort.position, exhaustInletPort.position),
      angularErrorDeg: 0,
      angleDeg: 0,
      status: 'CONNECTED',
      connectorLengthM: 1.8,
      connectorType: 'stack_clamp',
      passed: true,
      description: 'Cyclone top vortex finder flanged to 90° swept atmospheric exhaust stack',
      notes: 'Cyclone top vortex finder flanged to 90° swept atmospheric exhaust stack',
    });
  }

  // 19. Calculated Aerodynamic Pressure Profile Zones
  const ductGaugePa =
    results.pressureSystem?.ductGaugePressurePa ??
    (pressureMode === 'negative' ? -1800 : pressureMode === 'positive' ? 1400 : -350);
  const cycloneGaugePa =
    results.pressureSystem?.cycloneGaugePressurePa ??
    (pressureMode === 'negative' ? -2500 : pressureMode === 'positive' ? 700 : -1100);
  const feederGaugePa =
    results.pressureSystem?.feederGaugePressurePa ??
    (pressureMode === 'negative' ? -900 : pressureMode === 'positive' ? 2100 : 0);
  const totalDeltaP = dimensions?.fanTotalPressureDropPa ?? 3200;

  const pressureZones: PressureZoneData[] = [
    {
      id: 'zone_intake',
      name: pressureMode === 'negative' ? 'Ambient Air Intake' : 'FD Blower Fan Discharge',
      position: { x: hexInletX - 0.7, y: ductCenterlineYM + 0.45, z: 0 },
      gaugePressurePa: pressureMode === 'negative' ? 0 : pressureMode === 'positive' ? Math.round(totalDeltaP) : 450,
      status: pressureMode === 'negative' ? 'neutral' : 'positive',
      colorHex: pressureMode === 'negative' ? '#10b981' : '#f59e0b',
      description:
        pressureMode === 'negative'
          ? 'Fresh atmospheric air (0 Pa gauge) entering intake hood'
          : 'Peak positive pressure driving airflow into air heater',
    },
    {
      id: 'zone_heater',
      name: 'Air Heat Exchanger',
      position: { x: hexPosition.x, y: hexPosition.y + hexHeightM / 2 + 0.35, z: 0 },
      gaugePressurePa:
        pressureMode === 'negative' ? -250 : pressureMode === 'positive' ? Math.round(totalDeltaP * 0.85) : 250,
      status: pressureMode === 'negative' ? 'negative' : 'positive',
      colorHex: pressureMode === 'negative' ? '#6366f1' : '#f59e0b',
      description:
        pressureMode === 'negative'
          ? 'Heater tubes under slight induced vacuum (-250 Pa)'
          : 'Heater operates under positive pressure pushing hot air forward',
    },
    {
      id: 'zone_venturi',
      name: 'Venturi Feed Disperser',
      position: { x: venturiPosition.x, y: venturiPosition.y + 0.55, z: 0 },
      gaugePressurePa: feederGaugePa,
      status: feederGaugePa > 50 ? 'positive' : feederGaugePa < -50 ? 'negative' : 'neutral',
      colorHex: feederGaugePa > 50 ? '#ef4444' : feederGaugePa < -50 ? '#6366f1' : '#10b981',
      description:
        pressureMode === 'balanced'
          ? 'Neutral Pressure Point (0 Pa gauge) — no net pressure bias either way'
          : pressureMode === 'negative'
          ? `Negative pressure (−${Math.abs(feederGaugePa)} Pa) draws wet mash inward`
          : `Positive pressure (+${feederGaugePa} Pa) requires sealed feeder to avoid blowback`,
    },
    {
      id: 'zone_riser',
      name: 'Vertical Flash Drying Riser',
      position: { x: riserX, y: riserBaseYM + riserHeightM * 0.45, z: 0 },
      gaugePressurePa: ductGaugePa,
      status: ductGaugePa >= 0 ? 'positive' : 'negative',
      colorHex: ductGaugePa >= 0 ? '#f59e0b' : '#3b82f6',
      description:
        'Convective drying column: ' +
        (ductGaugePa >= 0 ? 'positive conveying pressure' : 'induced vacuum draft'),
    },
    {
      id: 'zone_cyclone',
      name: 'Cyclone Separator Body',
      position: { x: cycloneCenterXM, y: cycloneJunctionYM + 0.5, z: cycloneCenterZM },
      gaugePressurePa: cycloneGaugePa,
      status: cycloneGaugePa >= 0 ? 'positive' : 'negative',
      colorHex: cycloneGaugePa >= 0 ? '#f59e0b' : '#6366f1',
      description:
        'Centrifugal vortex core: ' + (cycloneGaugePa >= 0 ? 'positive separation' : 'induced suction vortex'),
    },
    {
      id: 'zone_exhaust',
      name: 'Clean Air Exhaust Stack',
      position: {
        x: hasDownstreamBlower
          ? downstreamBlowerPosition.x + downstreamBlowerVoluteRadiusM * 0.75
          : cycloneCenterXM + 0.8,
        y: hasDownstreamBlower
          ? downstreamBlowerPosition.y + downstreamBlowerVoluteRadiusM * 0.55 + 1.8
          : cycloneBarrelTopYM + 1.8,
        z: cycloneCenterZM,
      },
      gaugePressurePa: 0,
      status: 'neutral',
      colorHex: '#10b981',
      description: 'Clean air vented to atmosphere at ambient pressure (0 Pa gauge)',
    },
  ];

  const validationReport = validateAssemblyConnections({
    connections,
    portsByName,
    connectors,
  });

  const model: ParametricModel3D = {
    groundElevationM,

    pressureMode,
    hasUpstreamBlower,
    hasDownstreamBlower,
    hasIntakeHood,
    upstreamBlowerPosition,
    upstreamBlowerVoluteRadiusM,
    upstreamBlowerWidthM,
    upstreamBlowerOutletWidthM,
    upstreamBlowerOutletHeightM,
    upstreamBlowerMotorRadiusM,
    upstreamBlowerMotorLengthM,
    upstreamBlowerSkidHeightM,
    downstreamBlowerPosition,
    downstreamBlowerVoluteRadiusM,
    downstreamBlowerWidthM,
    downstreamBlowerInletRadiusM,
    downstreamBlowerOutletWidthM,
    downstreamBlowerOutletHeightM,
    downstreamStackRadiusM,
    idSuctionReducerLengthM,
    downstreamBlowerMotorRadiusM,
    downstreamBlowerMotorLengthM,
    downstreamBlowerSkidHeightM,
    intakeHoodPosition,
    intakeHoodWidthM,
    intakeHoodHeightM,
    pressureZones,

    ductCenterlineYM,
    pipeRadiusM,
    pipeDiameterMm,
    pipeDiameterCalculatedMm,
    pipeWallThicknessM,
    flangeRadiusM,
    flangeThicknessM,
    riserBaseYM,
    riserHeightM,
    riserTopYM,
    totalLengthM,
    bendRadiusM,
    loopOffsetZM,
    pipeCenterlineLengthM,
    pipeLengthDifferencePercent,
    horizontalRunM,
    downcomerXM: downcomerX,
    downcomerExitYM: downcomerExitY,
    routingLayout,

    isStairmand,
    cycloneBarrelRadiusM,
    cycloneBarrelDiameterMm: cycloneDiameterMm,
    cycloneCylinderHeightM,
    cycloneConeHeightM,
    cycloneTotalHeightM,
    cycloneVortexFinderRadiusM,
    cycloneVortexFinderLengthM,
    cycloneDustOutletRadiusM,
    cycloneInletHeightM,
    cycloneInletWidthM,
    cycloneInletLengthM,
    cycloneInletTransitionLengthM,
    cycloneInletStubLengthM,
    cycloneCenterXM,
    cycloneJunctionYM,
    cycloneCenterZM,
    cycloneDustOutletYM,
    cycloneBarrelTopYM,
    cycloneInletYM,
    cycloneLugsYM,

    venturiThroatRadiusM,
    venturiThroatDiameterMm,
    venturiInletRadiusM,
    venturiConvLengthM,
    venturiThroatLengthM,
    venturiDivLengthM,
    venturiPosition,

    hopperTopWidthM,
    hopperTopLengthM,
    hopperHeightM,
    hopperBottomWidthM,
    screwRadiusM,
    screwBarrelLengthM,
    screwMotorLengthM,
    feederPosition,

    hexWidthM,
    hexDepthM,
    hexHeightM,
    hexPasses,
    hexTubesCount,
    hexDutyKW,
    hexPosition,

    blowerVoluteRadiusM,
    blowerWidthM,
    blowerInletRadiusM,
    blowerOutletWidthM,
    blowerOutletHeightM,
    blowerMotorRadiusM,
    blowerMotorLengthM,
    blowerPosition,
    blowerSkidHeightM,

    airlockRadiusM,
    airlockHeightM,
    airlockMotorLengthM,
    airlockPosition,
    clearanceBelowAirlockM,

    columnProfileSizeM,
    riserTowerWidthM,
    riserTowerDepthM,
    riserTowerHeightM,
    cycloneTowerSpanM,
    cycloneTowerHeightM,
    platformElevationsM,

    centerlinePoints,
    exhaustCenterlinePoints,
    feedCenterlinePoints,
    dryProductCenterlinePoints: [],
    cycloneInletFlangePoint,

    ports,
    portsByName,
    connectors,
    connections,
    validationReport,

    isValid: true,
    validationWarnings: [],
  };

  const validation = validateParametricModel(model);
  model.isValid = validation.isValid;
  model.validationWarnings = validation.warnings;

  // ITEM 39 — re-run the joint validation now that the model EXISTS, so the geometry
  // checks are included.
  //
  // The first pass above runs before the model object is assembled and can only compare
  // ports. That is the blindness the user reported: both the flash tube outlet port and
  // the cyclone inlet port are derived from the same quantities, so they agreed at 0.00 mm
  // and reported CONNECTED while the builder was not drawing the tangential inlet at all.
  model.validationReport = validateAssemblyConnections(model);

  return model;
}
