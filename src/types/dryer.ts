export type CycloneType = 'stairmand' | 'lapple';
export type DesignMethodology = 'cirad' | 'kuye' | 'hybrid';
export type CapacityPreset = 10 | 25 | 50 | 80 | 100 | 133 | 250 | 500 | 820 | 1000 | 1500 | 2000 | 2500 | 3000 | 4000 | 5000 | 'custom';
export type PressureSystemType = 'positive' | 'negative' | 'balanced';
export type UnitSystem = 'metric' | 'tonne' | 'imperial';
export type ValidationStatus = 'VALID' | 'WARNING' | 'NEEDS REVIEW' | 'INVALID';

export interface DryerInputs {
  // Capacity mode: whether user enters feed rate or desired dry product rate
  capacityMode: 'feed' | 'product';
  // Mass flow rates (kg/h)
  feedRate: number; // Wet cassava mash/flour feed rate (kg/h)
  desiredProductRate: number; // Desired dry product output rate (kg/h)

  // Moisture contents (% wet basis)
  initialMoisture: number; // % w.b., typically 35 - 45% (cassava mash after dewatering)
  finalMoisture: number; // % w.b., standard HQCF is 10 - 12% (<13.5%)

  // Thermal & Psychrometric conditions
  ambientTemp: number; // °C, typically 25 - 30°C in tropical cassava producing regions
  ambientRH: number; // %, relative humidity, typically 65 - 80%
  inletAirTemp: number; // °C, drying air inlet temperature, recommended 160 - 180°C (CIRAD benchmark 170°C)
  outletAirTemp: number; // °C, exhaust air temperature, recommended 70 - 80°C (benchmark 75°C)
  feedTemp: number; // °C, temperature of incoming wet mash (typically ambient, ~25°C)
  finalProductTemp: number; // °C, temperature of dried flour leaving cyclone (~45 - 55°C)

  // Pneumatic & Conveying parameters
  airVelocity: number; // m/s, design velocity in vertical drying tube (recommended 12 - 15 m/s)
  altitude: number; // meters above sea level (affects atmospheric pressure and air density)

  // Physical & Thermal properties of Cassava Flour
  particleDiameter: number; // micrometers (µm), CIRAD pilot reports mean 230 µm (range 215 - 245 µm)
  particleDensity: number; // kg/m³, solid density of cassava starch granules (~1480 kg/m³)
  bulkDensity: number; // kg/m³, bulk density of loose cassava flour (~550 - 650 kg/m³)
  cassavaSpecificHeat: number; // kJ/(kg·K), specific heat capacity of dry cassava starch (~1.67 kJ/kg·K)

  // System & Equipment choices
  methodology: DesignMethodology; // CIRAD vs Kuye et al. vs Hybrid
  cycloneType: CycloneType; // Stairmand High Efficiency vs Lapple Standard
  pressureSystemType?: PressureSystemType; // 'positive' (Forced draft) | 'negative' (Induced draft) | 'balanced' (Push-pull)
  heatLossFactor: number; // fraction of heat lost through insulation/walls (typically 0.10 - 0.15 = 10-15%)
  targetResidenceTime: number; // seconds, typical 1.2 - 2.0 s (CIRAD pilot)

  // Heat Exchanger Parameters (CIRAD Module 4)
  heatExchangerPasses: number; // Number of tube passes (e.g. 1, 2, 3, 4 passes)
  // 'shell_and_tube_1pass' and 'shell_and_tube_2pass' replace the previous
  // 'shell_and_tube'. The LMTD correction differs between a single-pass
  // (F = 1.00) and a two-pass (F ~ 0.96) shell-and-tube exchanger, so a single
  // undifferentiated tag could not select the right correction. The union also
  // now matches what the calculation engine actually branches on, which it
  // previously did not.
  heatExchangerType?: 'cross_flow_finned' | 'cross_flow_bare' | 'shell_and_tube_1pass' | 'shell_and_tube_2pass';

  // Standard nominal pipe diameter override (optional, e.g. 710, 900, 1000 mm)
  standardPipeNominalMm?: number;

  // Developed Length Determination
  customTotalPipeLengthM?: number; // User override or determined developed length (m)
  developedLengthMode?: 'cirad_benchmark' | 'residence_time' | 'geometric_layout' | 'custom';
  tubeRoutingLayout?: 'single_loop' | 'double_loop' | 'straight_riser';
  ceilingClearanceM?: number; // Factory clearance limit (m)
  bendRadiusRatio?: number; // R/D ratio (1.5, 2.0, 2.5, 3.0)
  tubeWallThicknessMm?: number; // mm (e.g. 2.0, 3.0)

  // Hopper Engineering Inputs (IITA / Kuye et al. 2011 & Academia Reference)
  hopperHoldingTimeMin?: number; // tr, holding/loading time (min), default 10 min
  hopperVolumeAllowancePercent?: number; // volume allowance %, default 10%
  hopperTopWidthM?: number; // W1 (m), default 0.50 m
  hopperTopLengthM?: number; // L1 (m), default 0.50 m
  hopperOutletWidthM?: number; // W2 (m), default 0.32 m
  hopperOutletLengthM?: number; // L2 (m), default 0.22 m
  hopperUpperHeightM?: number; // h1 (m), default 0.10 m
  hopperLowerHeightM?: number; // h2 (m), calculated ~0.556 m to match V_hopper or editable
  hopperWallAngleADeg?: number; // Wall slope angle A (deg), default 76°
  hopperWallAngleBDeg?: number; // Wall slope angle B (deg), default 81°

  // Screw Feeder Engineering Inputs (IITA / Kuye et al. 2011 & Academia Reference)
  screwDiameterMm?: number; // screw diameter (mm), default 100 mm (4 in)
  screwLengthMm?: number; // screw length (mm), default 1000 mm
  screwLoadingPercent?: number; // trough loading %, default 30%
  // screwCapacityFactorPerRpm was removed as an input: capacity is derived from
  // screw diameter, pitch, shaft diameter and trough loading by the CEMA geometric
  // relation, so it can never contradict the geometry the user specified.
  screwSelectedRpm?: number; // user selected operating RPM, default 55 RPM
  screwMaterialFactor?: number; // Fm, default 1.2 for cassava cake
  screwFlightFactor?: number; // Ff, default 1.0 (standard pitch)
  screwBearingFactor?: number; // Fb, default 1.0
  screwDiameterFactor?: number; // Fd, default 12 for 4"
  screwOverloadFactor?: number; // Fo, default 3.0
  screwDriveEfficiency?: number; // E, default 0.88 (88%)
  screwShaftDiameterMm?: number; // shaft diameter (mm), default 38 mm (~1.5 in)
  screwFlightThicknessMm?: number; // flight thickness (mm), default 4 mm
  screwPitchMm?: number; // screw pitch (mm), default 100 mm (standard pitch = diameter)
  practicalMotorPowerKW?: number; // recommended motor power (kW), e.g. 0.75 kW (1.0 HP)
  materialPropertyType?: 'dewatered_mash_cake' | 'semi_dry_grits' | 'hqcf_flour' | 'starch_cake' | 'custom';
}

export interface HopperDesignReport {
  wetFeedRateKgH: number;
  bulkDensityKgM3: number;
  holdingTimeMin: number;
  massHeldKg: number; // m = Fr * (tr / 60)
  requiredVolumeM3: number; // Vrequired = m / rho_b
  volumeAllowancePercent: number; // 10%
  totalRequiredVolumeM3: number; // Hc = Vrequired * 1.1 (~0.1089 m³)
  topWidthM: number; // W1 (0.50 m)
  topLengthM: number; // L1 (0.50 m)
  topAreaM2: number; // A1 = W1 * L1 (0.25 m²)
  outletWidthM: number; // W2 (0.32 m)
  outletLengthM: number; // L2 (0.22 m)
  outletAreaM2: number; // A2 = W2 * L2 (0.0704 m²)
  upperVerticalHeightM: number; // h1 (0.10 m)
  upperVolumeM3: number; // Vupper = h1 * A1 (0.025 m³)
  lowerTaperedHeightM: number; // h2 (~0.556 m)
  lowerVolumeM3: number; // Vlower = h2/3 * (A1 + A2 + sqrt(A1*A2)) (~0.0839 m³)
  totalGeometricVolumeM3: number; // Vtotal = Vupper + Vlower (~0.1089 m³)
  overallHeightM: number; // h1 + h2 (~0.656 m)
  volumeMarginPercent: number;
  runWidthM: number; // Run_W = (W1 - W2) / 2
  runLengthM: number; // Run_L = (L1 - L2) / 2
  wallSlopeAngleADeg: number; // Side wall angle A = arctan(h2 / Run_W)
  wallSlopeAngleBDeg: number; // End wall angle B = arctan(h2 / Run_L)
  valleyAngleDeg: number; // Corner valley angle C = arccot(sqrt(cot²A + cot²B))
  isValleyAngleSufficient: boolean; // Confirms C >= 70° standard for dewatered cassava mash
  flowRegimeDescription: string;
}

export interface ScrewFeederDesignReport {
  wetFeedRateKgH: number;
  bulkDensityKgM3: number;
  bulkDensityLbFt3: number; // 86.15 lb/ft³
  volumetricFlowM3H: number; // Qv = Fr / rho_b (0.5942 m³/h)
  volumetricFlowFt3H: number; // Qv * 35.3147 (20.98 ft³/h)
  screwDiameterMm: number; // 100 mm (4 in)
  screwDiameterInches: number; // 4 in
  screwLengthMm: number; // 1000 mm
  screwLengthM: number; // 1.0 m
  screwLengthFt: number; // 3.28 ft
  troughLoadingPercent: number; // 30%
  capacityFactorPerRpmFt3H: number; // 0.41 ft³/h per RPM
  theoreticalRpm: number; // 20.976 / 0.41 = 51.16 RPM
  selectedRpm: number; // 55 RPM
  actualCapacityFt3H: number; // 0.41 * 55 = 22.55 ft³/h
  actualCapacityM3H: number; // 22.55 / 35.3147 = 0.6385 m³/h
  actualCapacityKgH: number; // actualCapacityM3H * rho_b
  capacityMarginPercent: number; // +7.48%
  isCapacitySufficient: boolean;
  diameterFactorFd: number; // 12
  bearingFactorFb: number; // 1.0
  flightFactorFf: number; // 1.0
  materialFactorFm: number; // 1.2
  paddleFactorFp: number; // 1.0
  overloadFactorFo: number; // 3.0
  driveEfficiency: number; // 0.88
  frictionPowerHP: number; // Pf = (L * N * Fd * Fb) / 1e6 = 0.00217 HP
  materialPowerHP: number; // Pm = (C * L * W * Ff * Fm * Fp) / 1e6 = 0.00765 HP
  basePowerHP: number; // Pf + Pm = 0.00982 HP
  totalTheoreticalPowerHP: number; // (Pbase * Fo) / E = 0.0335 HP (~0.03 HP)
  totalTheoreticalPowerKW: number; // 0.025 kW
  recommendedMotorPowerKW: number; // 0.75 kW
  recommendedMotorPowerHP: number; // 1.0 HP
  motorSelectionRationale: string;
  screwPitchMm: number; // 100 mm
  shaftDiameterMm: number; // 38 mm
  flightThicknessMm: number; // 4 mm
  numberOfFlights: number; // 10 turns
}

export interface FlashTubeSegment {
  id: string;
  name: string;
  type: 'straight' | 'elbow_90' | 'ubend_180' | 'transition';
  quantity: number;
  unitLengthM: number;
  totalLengthM: number;
  description: string;
  weldsCount: number;
}

export interface FlashTubeDevelopedLengthReport {
  totalDevelopedLengthM: number;
  effectiveResidenceTimeSec: number;
  verticalColumnHeightM: number;
  horizontalRunsLengthM: number;
  downcomerLengthM: number;
  totalBendsCount: number;
  bendRadiusM: number;
  bendRadiusRatio: number;
  routingLayout: 'single_loop' | 'double_loop' | 'straight_riser';
  segments: FlashTubeSegment[];
  ciradCompliant: boolean;
  ciradThresholdM: number;
  sheetMetal: {
    outerDiameterMm: number;
    innerDiameterMm: number;
    meanDiameterMm: number;
    wallThicknessMm: number;
    developedCircumferenceMm: number;
    surfaceAreaM2: number;
    estimatedMassKg: number;
    standardStrakesCount: number;
    totalWeldSeamLengthM: number;
    insulationAreaM2: number;
  };
  kinetics: {
    airVelocityMperS: number;
    particleTerminalVelocityMperS: number;
    verticalSlipVelocityMperS: number;
    targetResidenceTimeSec: number;
    achievedResidenceTimeSec: number;
  };
}

export interface HeatExchangerSpecs {
  type: 'cross_flow_finned' | 'cross_flow_bare' | 'shell_and_tube_1pass' | 'shell_and_tube_2pass';
  numberOfPasses: number;
  thermalDutyKW: number;
  thermalDutyKcalH: number;
  airInletTempC: number;
  airOutletTempC: number;
  hotGasInletTempC: number;
  hotGasOutletTempC: number;
  lmtdC: number;
  correctionFactorFt: number;
  effectiveLmtdC: number;
  overallUCoeffWperM2K: number;
  surfaceAreaM2: number;
  tubeOuterDiameterMm: number;
  tubeLengthPerPassM: number;
  tubesPerPass: number;
  totalTubesCount: number;
  airSidePressureDropPa: number;
  /** Mean face velocity over the open frontal area of the bundle, m/s. */
  airFaceVelocityMperS: number;
  /**
   * Velocity in the leading gap, the first restriction the air meets, m/s. Higher
   * than the mean because the air accelerates through each row. This is the local
   * condition that governs the film coefficient, since h scales as v^0.8.
   */
  leadingPassageVelocityMperS: number;
  /** Open frontal area of the bundle, m². V_dot / airFaceVelocityMperS. */
  bundleFreeAreaM2: number;
  /** Gross casing cross-section before element blockage, m². */
  casingGrossAreaM2: number;
  /** Frontal area blocked by the element row, m². */
  blockedAreaM2: number;
  /** Casing width across the tube rows, m. */
  casingWidthM: number;
  /** Casing height transverse to the tube rows (the L_exposed term), m. */
  casingHeightM: number;
  /** Projected blocking diameter of one element across the flow, mm. */
  elementBlockingDiameterMm: number;
  /** Elements laid across the casing, i.e. tubes in the first row. */
  elementCountPerRow: number;
  /** Gas-side mass velocity over the free area, kg/(m²·s). The U correlator. */
  airMassVelocityKgM2S: number;
}

export type SourceClassification =
  | 'Directly from Source'
  | 'User Input'
  | 'Calculated'
  | 'Engineering Assumption'
  | 'Engineering Estimate'
  | 'Reference design value';

export interface CalculationStep {
  id: string;
  category: 'Material Balance' | 'Psychrometric & Air' | 'Energy Balance' | 'Fluid Dynamics' | 'Dryer Dimensions' | 'Cyclone Separator' | 'Feeding & Ancillary' | 'Hopper Design' | 'Screw Feeder Design';
  parameterName: string;
  symbol: string;
  unit: string;
  simpleExplanation: string; // Plain-English explanation of what this step calculates and why it matters
  equation: string;
  equationLatex?: string;
  variableDefinitions: { symbol: string; name: string; value: string; unit: string; classification: SourceClassification }[];
  substitution: string;
  numericResult: number;
  formattedResult: string;
  sourceCitation: string;
  sourceClassification: SourceClassification;
  notes?: string;
}

export interface MaterialBalance {
  feedRateKgH: number;
  feedRateKgS: number;
  drySolidsKgH: number;
  drySolidsKgS: number;
  productRateKgH: number;
  productRateKgS: number;
  waterRemovedKgH: number;
  waterRemovedKgS: number;
  moistureRemovedPercentage: number;
}

export interface PsychrometricProperties {
  atmosphericPressureKPa: number;
  ambientVaporPressureKPa: number;
  ambientHumidityRatio: number; // kg water / kg dry air
  exhaustHumidityRatio: number; // kg water / kg dry air
  ambientAirDensity: number; // kg/m³
  inletAirDensity: number; // kg/m³
  outletAirDensity: number; // kg/m³
  averageAirDensity: number; // kg/m³
}

export interface EnergyBalance {
  latentHeatKJperKg: number; // kJ/kg
  evaporationHeatKW: number; // kW
  sensibleAirHeatKW: number; // kW
  productHeatingKW: number; // kW
  wallHeatLossKW: number; // kW
  totalHeatDutyKW: number; // kW (total required thermal input for air heater)
  totalHeatDutyKcalH: number; // kcal/h
  heaterThermalDutyKW: number; // kW (Air Heater Control Volume: Tamb -> Tin)
  dryerThermalDutyKW: number; // kW (Dryer Column Control Volume: Tin -> Tout + solids)
  dryAirMassFlowKgS: number; // kg/s
  dryAirMassFlowKgH: number; // kg/h
  humidAirMassFlowKgS: number; // kg/s
  airToStarchRatio: number; // kg dry air / kg dry solid
  airToWetFeedRatio: number; // kg dry air / kg wet feed (wet feed ratio)
  latentHeatUtilization: number; // % (latent evaporation energy / total heat duty, formerly named thermalEfficiency)
  thermalEfficiency: number; // % (backwards compatibility alias to latentHeatUtilization)
  dryerThermalEfficiency: number; // % ((Tin - Tout) / (Tin - Tamb) * 100%, adiabatic convective efficiency)
  specificEnergyConsumptionKJperKgWater: number; // kJ/kg evaporated water (CIRAD benchmark 3800 - 4500)
  specificEnergyConsumptionKWhperKgProduct: number; // kWh/kg dried cassava flour
  moistAirBalanceConvergence: {
    iterations: number;
    residualKgS: number;
    status: 'CONVERGED' | 'WARNING';
    moistAirEnthalpyInKJperKg: number;
    moistAirEnthalpyOutKJperKg: number;
  };
  equivalentFuelRequirement: {
    dieselLitersPerHour: number;
    biomassWoodKgPerHour: number;
    lpgKgPerHour: number;
  };
}

export interface ConnectionPort {
  id: string;
  componentId: string;
  name: string; // e.g. 'intake.outlet', 'heater.inlet', etc.
  position: { x: number; y: number; z: number };
  direction: { x: number; y: number; z: number };
  nominalDiameterMm: number;
  connectionType: 'flanged' | 'bolted' | 'slip_joint' | 'welded' | 'chute' | 'tangential';
}

export interface AssemblyConnector {
  id: string;
  name: string;
  type: 'straight_duct' | 'reducer_expander' | 'long_radius_elbow' | 'tangential_cyclone_inlet' | 'flanged_connection' | 'gravity_chute' | 'stack_clamp';
  startPoint: { x: number; y: number; z: number };
  endPoint: { x: number; y: number; z: number };
  startDirection: { x: number; y: number; z: number };
  endDirection: { x: number; y: number; z: number };
  lengthM: number;
  nominalDiameterMm: number;
  isVisible: boolean;
}

export interface AssemblyConnection {
  id: string;
  jointName: string;
  fromComponent: string;
  fromPort: string;
  toComponent: string;
  toPort: string;
  portDistanceMm: number;
  distanceMm: number;
  angularErrorDeg: number;
  angleDeg: number;
  connectionType: 'flange_bolted' | 'chute_gravity' | 'gravity_chute' | 'tangential_duct' | 'swept_elbow' | 'stack_clamp' | 'flanged' | 'bolted' | 'slip_joint' | 'welded' | 'chute';
  status: 'CONNECTED' | 'WARNING' | 'MISALIGNED' | 'DISCONNECTED';
  description: string;
  connectorLengthM?: number;
  connectorType?: string;
  passed?: boolean;
  notes?: string;
}

export interface JointValidationReport {
  jointId: string;
  jointName: string;
  upstreamComponent: string;
  upstreamPort: string;
  downstreamComponent: string;
  downstreamPort: string;
  gapMm: number;
  angularMisalignmentDeg: number;
  connectionType: string;
  status: 'CONNECTED' | 'FAILED';
  connectorLengthM: number;
  passed: boolean;
  notes: string;
  position?: { x: number; y: number; z: number };
}

export interface AssemblyValidationReport {
  allConnected: boolean;
  connectedCount: number;
  totalCount: number;
  joints: JointValidationReport[];
  failedJoints: JointValidationReport[];
  statusSummary: string;
}

export interface FluidDynamics {
  particleTerminalVelocity: number; // m/s (using Schiller-Naumann / Stokes)
  saltationVelocity: number; // m/s (minimum velocity to convey solids)
  relativeParticleVelocityVertical: number; // m/s (v_air - v_t)
  particleReynoldsNumber: number;
  inletVolumetricFlowM3S: number; // m³/s
  inletVolumetricFlowM3H: number; // m³/h
  outletVolumetricFlowM3S: number; // m³/s
  outletVolumetricFlowM3H: number; // m³/h
  averageVolumetricFlowM3S: number; // m³/s
  averageVolumetricFlowM3H: number; // m³/h
  airMassFlowCheck: number; // verification
  /** Convergence record for the implicit Schiller-Naumann Reynolds-number solve. */
  schillerNaumannConvergence: {
    iterations: number;
    residual: number;
    reynoldsNumber: number;
  };
}

export interface DryerDimensions {
  tubeCrossSectionAreaM2: number;
  tubeDiameterCalculatedM: number;
  tubeDiameterCalculatedMm: number;
  tubeDiameterStandardMm: number; // standard nearest nominal pipe size
  tubeDiameterStandardM: number;
  actualAirVelocityMperS: number; // re-evaluated with standard pipe size

  // Drying length & heights
  totalPipeLengthM: number; // total developed length of tube (m)
  verticalColumnHeightM: number; // vertical drying riser height (m)
  horizontalRunsLengthM: number; // return bends and horizontal duct (m)
  estimatedResidenceTimeSec: number; // seconds
  verticalResidenceTimeSec: number;

  // Standard nominal pipe
  standardPipeNominal?: string;

  // Ancillary components
  venturiThroatDiameterMm: number; // feed introduction throat
  venturiThroatVelocityMperS: number;
  airInletDuctDiameterMm: number;
  airOutletDuctDiameterMm: number;

  // Feeder specs & Geometry (IITA / Kuye et al. 2011)
  feederType: string;
  screwDiameterMm: number;
  screwDiameterInches: number;
  screwLengthMm: number;
  screwLengthM: number;
  screwPitchMm: number;
  screwSpeedRpm: number;
  screwLoadingPercent: number;
  screwTheoreticalRpm: number;
  screwActualCapacityM3H: number;
  screwActualCapacityFt3H: number;
  screwCapacityMarginPercent: number;
  screwFrictionPowerHP: number;
  screwMaterialPowerHP: number;
  screwTotalPowerHP: number;
  screwTotalPowerKW: number;
  screwRecommendedMotorKW: number;
  screwRecommendedMotorHP: number;
  screwShaftDiameterMm: number;
  screwFlightThicknessMm: number;
  screwNumberOfFlights: number;
  feederMotorPowerKW?: number;

  // Hopper Dimensions (IITA / Kuye et al. 2011)
  hopperTopWidthM: number;
  hopperTopLengthM: number;
  hopperOutletWidthM: number;
  hopperOutletLengthM: number;
  hopperUpperHeightM: number;
  hopperLowerHeightM: number;
  hopperTotalHeightM: number;
  hopperVolumeM3: number;
  hopperWallAngleADeg: number;
  hopperWallAngleBDeg: number;
  hopperValleyAngleCDeg: number;

  // Cyclone dimensions
  cycloneType: CycloneType;
  cycloneDiameterM: number;
  cycloneDiameterMm: number;
  cycloneInletHeightMm: number; // a
  cycloneInletWidthMm: number; // b
  cycloneVortexFinderDiameterMm: number; // De
  cycloneVortexFinderLengthMm: number; // S
  cycloneCylinderHeightMm: number; // h
  cycloneConeHeightMm: number; // H - h
  cycloneTotalHeightMm: number; // H
  cycloneDustOutletDiameterMm: number; // B (discharge nozzle)
  cycloneDustOutletMm?: number;
  cycloneInletVelocityMperS: number;
  cyclonePressureDropPa: number;
  /**
   * ITEM 19: single-dust collection efficiency from the Lapple curve, %.
   *
   * Was a local variable in the engine, so the DXF label had to hardcode a
   * figure. Exposed here so the drawing quotes the computed value.
   */
  cycloneCollectionEfficiencyPercent: number;
  /** d_p / d50 size ratio driving that efficiency. */
  cycloneSizeRatio: number;
  /** Cut-point diameter d50, µm. */
  cutPointD50Microns: number;
  /**
   * ITEM 23: rotary airlock rotor diameter, mm.
   *
   * Computed once from the cyclone spigot and rounded up to the nominal rotary
   * valve series, so the PDF, the DXF and the 3D model all state the same size.
   */
  airlockDiameterMm: number;

  // Blower / Fan sizing
  fanTotalPressureDropPa: number;
  fanAirPowerKW: number;
  fanMotorPowerKW: number; // Q_v*ΔP / (fanTotalEfficiency) * (motorServiceFactor * motorTransmissionEfficiency) = 65% fan efficiency, 15% service factor, 95% belt drive

  // Overall system frame footprint
  frameFootprintLengthM: number;
  frameFootprintWidthM: number;
  frameOverallHeightM: number;
}

export type ValidationCheckSeverity = 'success' | 'info' | 'warning' | 'danger';

export interface ValidationCheck {
  id: string;
  category: 'Velocity' | 'Temperature' | 'Residence Time' | 'Energy' | 'Geometry' | 'Mass Balance' | 'Connectivity' | 'Input Validation' | 'Material Property';
  severity: ValidationCheckSeverity;
  // Required, not optional. It was optional because two pressure checks omitted
  // it, so the UI silently fell back to deriving a status from severity and the
  // two could disagree. Every check now sets it explicitly, and making it
  // required in the type means the next omission is a compile error rather than a
  // quiet inconsistency. See referenceDesigns.test.ts for the enforcement test.
  status: ValidationStatus;
  title: string;
  message: string;
  currentValue: string;
  recommendedRange: string;
  source: string;
}

export type EngineeringCheck = ValidationCheck;

export interface PressureProfileNode {
  pointId: string;
  name: string;
  gaugePressurePa: number;
  description: string;
}

export interface PressureSystemAnalysis {
  type: PressureSystemType;
  title: string;
  badgeLabel: string;
  fanLocation: string;
  summary: string;
  operatingPrinciple: string;
  ductGaugePressurePa: number;
  cycloneGaugePressurePa: number;
  feederGaugePressurePa: number;
  dustLeakageRisk: string;
  dustRiskDetail?: string;
  fanDutyDisclosure?: string;
  fanAirCondition: string;
  fanWearAndFoulingRisk: string;
  airlockSealingCriticality: string;
  keyAdvantages: string[];
  keyDisadvantages: string[];
  pressureProfile: PressureProfileNode[];
}

export interface AssumedParameter {
  id: string;
  category: 'Material Property' | 'Process Condition' | 'Mechanical / Fabrication Standard' | 'Operational Buffer' | 'Environmental Condition';
  parameterName: string;
  symbol: string;
  value: string;
  unit: string;
  basis: string;
  rationale: string;
  isUserInput: boolean;
}

export interface CalculationResults {
  inputs: DryerInputs;
  materialBalance: MaterialBalance;
  psychrometrics: PsychrometricProperties;
  energyBalance: EnergyBalance;
  fluidDynamics: FluidDynamics;
  dimensions: DryerDimensions;
  heatExchanger: HeatExchangerSpecs;
  pressureSystem: PressureSystemAnalysis;
  steps: CalculationStep[];
  assumedParameters: AssumedParameter[];
  checks: ValidationCheck[];
  developedLengthReport: FlashTubeDevelopedLengthReport;
  hopperDesign: HopperDesignReport;
  screwFeederDesign: ScrewFeederDesignReport;
  timestamp: string;
}
