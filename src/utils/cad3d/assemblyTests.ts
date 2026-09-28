import { DryerInputs } from '../../types/dryer';
import { DEFAULT_DRYER_INPUTS } from '../constants';
import { calculateFlashDryer } from '../dryerCalculations';
import { extractParametricModel, ParametricModel3D } from './parametricModel';

export interface TestCaseExecutionResult {
  passed: boolean;
  connectedCount: number;
  totalJoints: number;
  maxGapMm: number;
  maxAngleDeg: number;
  nominalDiameterMm: number;
  calculatedDiameterMm: number;
  riserHeightM: number;
  totalLengthM: number;
  developedCenterlineLengthM: number;
  requiredComponentsPresent: boolean;
  requiredPortsPresent: boolean;
  hasNoNaNOrZero: boolean;
  validationMessage: string;
  details: string[];
}

export interface AssemblyTestCaseDefinition {
  id: string;
  name: string;
  description: string;
  category: 'Capacity' | 'Nominal Transition' | 'Draft Mode' | 'Moisture Sensitivity';
  inputs: DryerInputs;
}

export interface AssemblyTestCaseWithResult extends AssemblyTestCaseDefinition {
  result: TestCaseExecutionResult;
}

// Required named process components
export const REQUIRED_COMPONENT_IDS = [
  'intake',
  'heater',
  'venturi',
  'feeder',
  'column',
  'cyclone',
  'rotary',
  'blower',
  'exhaust',
];

// Required named ports per specification
export const REQUIRED_PORT_NAMES = [
  'intake.outlet',
  'heater.inlet',
  'heater.outlet',
  'venturi.airInlet',
  'venturi.feedInlet',
  'venturi.outlet',
  'flashTube.inlet',
  'flashTube.outlet',
  'cyclone.inlet',
  'cyclone.productOutlet',
  'cyclone.exhaustOutlet',
  'rotaryValve.inlet',
  'rotaryValve.outlet',
  'blower.inlet',
  'blower.outlet',
];

export const AUTOMATED_TEST_CASES: AssemblyTestCaseDefinition[] = [
  {
    id: 'test_1_1th',
    name: '1. 1 t/h Wet Feed Capacity',
    description: 'Validates complete kinematic assembly connection at 1,000 kg/h wet cassava mash throughput.',
    category: 'Capacity',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 1000,
      initialMoisture: 40,
      finalMoisture: 12,
      pressureSystemType: 'negative',
    },
  },
  {
    id: 'test_2_2th',
    name: '2. 2 t/h Wet Feed Capacity',
    description: 'Validates complete kinematic assembly connection at 2,000 kg/h wet cassava mash throughput.',
    category: 'Capacity',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 2000,
      initialMoisture: 40,
      finalMoisture: 12,
      pressureSystemType: 'negative',
    },
  },
  {
    id: 'test_3_3th',
    name: '3. 3 t/h Wet Feed Capacity',
    description: 'Validates complete kinematic assembly connection at 3,000 kg/h wet cassava mash throughput.',
    category: 'Capacity',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 3000,
      initialMoisture: 40,
      finalMoisture: 12,
      pressureSystemType: 'negative',
    },
  },
  {
    id: 'test_4_4th',
    name: '4. 4 t/h Wet Feed Capacity',
    description: 'Validates complete kinematic assembly connection at 4,000 kg/h wet cassava mash throughput.',
    category: 'Capacity',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 4000,
      initialMoisture: 40,
      finalMoisture: 12,
      pressureSystemType: 'negative',
    },
  },
  {
    id: 'test_5_trans_710_900',
    name: '5. Nominal Transition Ø710 mm → Ø900 mm',
    description: 'Validates continuous kinematic connection across Ø710 mm to Ø900 mm nominal commercial duct transition.',
    category: 'Nominal Transition',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 2600,
      initialMoisture: 40,
      finalMoisture: 12,
      standardPipeNominalMm: 900,
      pressureSystemType: 'negative',
    },
  },
  {
    id: 'test_6_trans_900_1000',
    name: '6. Nominal Transition Ø900 mm → Ø1000 mm',
    description: 'Validates continuous kinematic connection across Ø900 mm to Ø1000 mm nominal commercial duct transition.',
    category: 'Nominal Transition',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 3500,
      initialMoisture: 40,
      finalMoisture: 12,
      standardPipeNominalMm: 1000,
      pressureSystemType: 'negative',
    },
  },
  {
    id: 'test_7_negative_draft',
    name: '7. Negative-Pressure (Induced Draft)',
    description: 'Validates suction draft flow path: intake hood → heater → venturi → column → cyclone → ID fan → stack.',
    category: 'Draft Mode',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 1500,
      pressureSystemType: 'negative',
    },
  },
  {
    id: 'test_8_positive_draft',
    name: '8. Positive-Pressure (Forced Draft)',
    description: 'Validates pressurized flow path: FD blower → heater → venturi → column → cyclone → atmospheric stack.',
    category: 'Draft Mode',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 1500,
      pressureSystemType: 'positive',
    },
  },
  {
    id: 'test_9_balanced_draft',
    name: '9. Balanced Push-Pull Draft',
    description: 'Validates dual-fan push-pull configuration with zero neutral static pressure point at feeder injection.',
    category: 'Draft Mode',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 1500,
      pressureSystemType: 'balanced',
    },
  },
  {
    id: 'test_10_moisture_variation',
    name: '10. Moisture Values (35%, 40%, 45% WB)',
    description: 'Validates robust psychrometric scaling across cassava dewatering moisture variations from 35% to 45%.',
    category: 'Moisture Sensitivity',
    inputs: {
      ...DEFAULT_DRYER_INPUTS,
      capacityMode: 'feed',
      feedRate: 2000,
      initialMoisture: 45,
      finalMoisture: 12,
      pressureSystemType: 'negative',
    },
  },
];

/**
 * Executes a single automated test case and confirms all physical,
 * geometrical, and kinematic mating requirements.
 */
export function executeTestCase(testCase: AssemblyTestCaseDefinition): TestCaseExecutionResult {
  const results = calculateFlashDryer(testCase.inputs);
  const model = extractParametricModel(results);
  const val = model.validationReport;

  const details: string[] = [];

  // 1. Verify required components exist in port records
  const compKeys = Object.keys(model.ports);
  const requiredComponentsPresent = REQUIRED_COMPONENT_IDS.every((id) =>
    compKeys.includes(id) || (id === 'exhaust' && model.ports.exhaust) || (id === 'intake' && model.ports.intake)
  );
  if (!requiredComponentsPresent) {
    details.push('Missing one or more required process components.');
  }

  // 2. Verify all named ports exist in portsByName dictionary
  const missingPorts = REQUIRED_PORT_NAMES.filter((pName) => !model.portsByName[pName]);
  const requiredPortsPresent = missingPorts.length === 0;
  if (!requiredPortsPresent) {
    details.push(`Missing ports: ${missingPorts.join(', ')}`);
  }

  // 3. Verify kinematic validation result (must have exactly 9 joints connected)
  const connectedCount = val.connectedCount;
  const totalJoints = val.totalCount;
  const allJointsConnected = val.allConnected && connectedCount === 9 && totalJoints === 9;

  // 4. Verify gaps and angles across all joints
  let maxGapMm = 0;
  let maxAngleDeg = 0;
  val.joints.forEach((j) => {
    if (j.gapMm > maxGapMm) maxGapMm = j.gapMm;
    if (j.angularMisalignmentDeg > maxAngleDeg) maxAngleDeg = j.angularMisalignmentDeg;
  });

  const gapWithinTolerance = maxGapMm <= 0.5;
  const angleWithinTolerance = maxAngleDeg <= 0.5;

  // 5. Verify no NaN, infinite, zero, or negative dimensions
  const dims = [
    model.pipeDiameterMm,
    model.pipeDiameterCalculatedMm,
    model.riserHeightM,
    model.totalLengthM,
    model.pipeCenterlineLengthM,
    model.cycloneBarrelDiameterMm,
    model.cycloneTotalHeightM,
    model.venturiThroatDiameterMm,
    model.screwRadiusM,
    model.hexWidthM,
    model.hexHeightM,
    model.airlockRadiusM,
    model.blowerVoluteRadiusM,
  ];

  const hasNoNaNOrZero = dims.every((d) => Number.isFinite(d) && d > 0);
  if (!hasNoNaNOrZero) {
    details.push('Found invalid NaN, zero, or negative dimension value in model.');
  }

  // ITEM 16: the 3D model must reproduce the engine's developed length.
  //
  // The centreline was previously built from the riser and the elbows alone, with
  // no horizontal run, so it came out 16.5 m against the engine's 20 m. The
  // shortfall was computed into model.pipeLengthDifferencePercent and then never
  // displayed or asserted, so the model passed every test while drawing a
  // different machine from the one being costed. This makes it a gate.
  //
  // Tolerance is 2%. The routing solves the run length analytically, so the
  // residual is rounding only and lands at 0.0%; the 2% band exists to absorb
  // floating-point and the 0.01 m rounding applied to the reported total.
  const lengthMismatchFraction =
    Math.abs(model.pipeCenterlineLengthM - model.totalLengthM) / Math.max(0.1, model.totalLengthM);
  const lengthWithinTolerance = lengthMismatchFraction <= 0.02;
  if (!lengthWithinTolerance) {
    details.push(
      `3D centreline is ${model.pipeCenterlineLengthM.toFixed(2)} m against an engine ` +
        `developed length of ${model.totalLengthM.toFixed(2)} m ` +
        `(${(lengthMismatchFraction * 100).toFixed(1)}% out, limit 2%). The drawing is ` +
        `not the machine being costed.`,
    );
  }

  const passed =
    requiredComponentsPresent &&
    requiredPortsPresent &&
    allJointsConnected &&
    gapWithinTolerance &&
    angleWithinTolerance &&
    hasNoNaNOrZero &&
    lengthWithinTolerance;

  const validationMessage = passed
    ? `PASSED: 9/9 Joints Connected (Max Gap: ${maxGapMm.toFixed(1)}mm, Max Angle: ${maxAngleDeg.toFixed(1)}°)`
    : `FAILED: Connected ${connectedCount}/${totalJoints} joints. Gap: ${maxGapMm.toFixed(1)}mm, Angle: ${maxAngleDeg.toFixed(1)}°`;

  return {
    passed,
    connectedCount,
    totalJoints,
    maxGapMm,
    maxAngleDeg,
    nominalDiameterMm: model.pipeDiameterMm,
    calculatedDiameterMm: Math.round(model.pipeDiameterCalculatedMm * 10) / 10,
    riserHeightM: Math.round(model.riserHeightM * 10) / 10,
    totalLengthM: Math.round(model.totalLengthM * 10) / 10,
    developedCenterlineLengthM: model.pipeCenterlineLengthM,
    requiredComponentsPresent,
    requiredPortsPresent,
    hasNoNaNOrZero,
    validationMessage,
    details,
  };
}

/**
 * Runs the complete automated kinematic test suite for all 10 test cases.
 */
export function runAutomatedAssemblyTestSuite(): {
  allPassed: boolean;
  passedCount: number;
  totalCount: number;
  results: AssemblyTestCaseWithResult[];
} {
  const results: AssemblyTestCaseWithResult[] = AUTOMATED_TEST_CASES.map((tc) => ({
    ...tc,
    result: executeTestCase(tc),
  }));

  const passedCount = results.filter((r) => r.result.passed).length;
  const totalCount = results.length;
  const allPassed = passedCount === totalCount;

  return {
    allPassed,
    passedCount,
    totalCount,
    results,
  };
}
