import { DryerInputs } from '../types/dryer';

// Standard nominal duct/tube sizes available for fabrication (in mm)
// Includes standard spiral duct and rolled stainless steel sheet sizes up to industrial capacities (100mm to 1600mm)
export const STANDARD_PIPE_SIZES_MM = [
  100, 125, 145, 150, 160, 180, 200, 225, 250, 280, 300, 315, 355, 387, 400,
  450, 500, 560, 600, 630, 710, 800, 850, 900, 950, 1000, 1050, 1100, 1150, 1200,
  1250, 1300, 1400, 1500, 1600
];

// Stairmand High-Efficiency cyclone geometric ratios (relative to cyclone barrel diameter Dc)
export const STAIRMAND_RATIOS = {
  inletHeight_a: 0.50, // a / Dc
  inletWidth_b: 0.20,  // b / Dc
  vortexFinderDiameter_De: 0.50, // De / Dc
  vortexFinderLength_S: 0.50, // S / Dc
  cylinderHeight_h: 1.50, // h / Dc
  totalHeight_H: 4.00, // H / Dc
  coneHeight: 2.50, // (H - h) / Dc
  dustOutletDiameter_B: 0.375, // B / Dc
  inletAreaFactor: 0.10, // (a * b) / Dc^2 = 0.50 * 0.20 = 0.10
  standardInletVelocityMperS: 15.0, // recommended inlet gas velocity (m/s)
  eulerNumber_Eu: 6.4, // typical pressure drop coefficient (ΔP = Eu * 0.5 * rho * v_in^2)
};

// Lapple Standard cyclone geometric ratios (relative to cyclone barrel diameter Dc)
export const LAPPLE_RATIOS = {
  inletHeight_a: 0.50, // a / Dc
  inletWidth_b: 0.25,  // b / Dc
  vortexFinderDiameter_De: 0.50, // De / Dc
  vortexFinderLength_S: 0.625, // S / Dc
  cylinderHeight_h: 2.00, // h / Dc
  totalHeight_H: 4.00, // H / Dc
  coneHeight: 2.00, // (H - h) / Dc
  dustOutletDiameter_B: 0.25, // B / Dc
  inletAreaFactor: 0.125, // (a * b) / Dc^2 = 0.50 * 0.25 = 0.125
  standardInletVelocityMperS: 15.0,
  eulerNumber_Eu: 8.0,
};

// CIRAD Pilot Benchmark defaults (Chapuis et al. 2015)
export const CIRAD_PILOT_BENCHMARK: DryerInputs = {
  capacityMode: 'feed',
  feedRate: 133.3, // wet feed rate corresponding to 80 kg/h product at 40% initial moisture
  desiredProductRate: 80.0, // 80 kg/h dry product output (pilot benchmark)
  initialMoisture: 40.0, // % wet basis (cassava mash)
  finalMoisture: 12.0, // % wet basis (HQCF flour standard)
  ambientTemp: 27.0, // °C
  ambientRH: 70.0, // %
  inletAirTemp: 180.0, // °C (CIRAD validated range 170 - 180°C)
  outletAirTemp: 70.0, // °C (CIRAD validated range 70 - 80°C)
  feedTemp: 25.0, // °C
  finalProductTemp: 50.0, // °C
  airVelocity: 15.0, // m/s (CIRAD optimal conveying velocity)
  altitude: 100.0, // meters above sea level
  particleDiameter: 230.0, // µm (CIRAD experimental mean for cassava starch/flour)
  particleDensity: 1480.0, // kg/m³: true (solid) density of cassava starch
  // 380 kg/m³, taken from ScrewFeederDesignTool_V1.0.xlsx, sheet "ScrewFeederDesign",
  // row 12 ("Bulk density | 380 | kg.m-3"). That tool's Instructions sheet says the
  // value is the density of the WET product, measured on a container of known
  // volume, at a default filling rate of 40%.
  //
  // This replaced 1380 kg/m³, which was labelled as an IITA/RMRDC reference but
  // implied a bed voidage of only 6.8% against a 1480 kg/m³ particle density. That
  // describes a near-solid block, not a bulk solid, and made every volume derived
  // from it (hopper, feed duct, screw trough) far too small.
  //
  // 380 kg/m³ against 1480 implies 74% voidage, which is high for a dry granular
  // solid but entirely normal for a wet, flocculent cassava mash cake that traps a
  // great deal of water and air. The engine's practical voidage band is widened to
  // admit it, with a note in the validation check, rather than rejecting a value
  // taken from the reference tooling.
  bulkDensity: 380.0, // kg/m³: wet dewatered cassava mash, per ScrewFeederDesignTool_V1.0
  cassavaSpecificHeat: 1.67, // kJ/(kg·K)
  methodology: 'cirad',
  cycloneType: 'stairmand',
  pressureSystemType: 'negative', // CIRAD benchmark uses induced draft suction
  heatLossFactor: 0.12, // 12% heat loss through insulated ductwork
  targetResidenceTime: 1.5, // seconds
  heatExchangerPasses: 2, // 2-pass cross-flow heat exchanger (standard industrial configuration)
  heatExchangerType: 'cross_flow_finned',
  hopperHoldingTimeMin: 10,
  hopperVolumeAllowancePercent: 10,
  hopperTopWidthM: 0.50,
  hopperTopLengthM: 0.50,
  hopperOutletWidthM: 0.32,
  hopperOutletLengthM: 0.22,
  hopperUpperHeightM: 0.10,
  hopperWallAngleADeg: 76,
  hopperWallAngleBDeg: 81,
  screwDiameterMm: 100,
  screwLengthMm: 1000,
  screwLoadingPercent: 30,
  screwSelectedRpm: 55,
  screwMaterialFactor: 1.2,
  screwFlightFactor: 1.0,
  screwBearingFactor: 1.0,
  screwDiameterFactor: 12,
  screwOverloadFactor: 3.0,
  screwDriveEfficiency: 0.88,
  screwShaftDiameterMm: 38,
  screwFlightThicknessMm: 4,
  screwPitchMm: 100,
  practicalMotorPowerKW: 0.75,
  materialPropertyType: 'dewatered_mash_cake',
};

// IITA / RMRDC / Kuye et al. Reference Benchmark Worked Example (820 kg/h Wet Feed)
export const IITA_REFERENCE_BENCHMARK: DryerInputs = {
  capacityMode: 'feed',
  feedRate: 820.0, // Primary design input: 820 kg/h wet cassava feed rate (IITA / Kuye et al. worked example)
  desiredProductRate: 559.1, // Calculated downstream from moisture balance: 820 * (100 - 40)/(100 - 12)
  initialMoisture: 40.0, // % wet basis
  finalMoisture: 12.0, // % wet basis
  ambientTemp: 27.0, // °C
  ambientRH: 70.0, // %
  inletAirTemp: 180.0, // °C
  outletAirTemp: 70.0, // °C
  feedTemp: 25.0, // °C
  finalProductTemp: 50.0, // °C
  airVelocity: 14.0, // m/s
  altitude: 100.0,
  particleDiameter: 230.0,
  particleDensity: 1480.0,
  bulkDensity: 380.0, // kg/m³: Dewatered cassava mash cake, per ScrewFeederDesignTool_V1.0.xlsx. Corrected from 1380, which was near-solid against a 1480 particle density.
  cassavaSpecificHeat: 1.67,
  methodology: 'hybrid',
  cycloneType: 'stairmand',
  pressureSystemType: 'negative',
  heatLossFactor: 0.12,
  targetResidenceTime: 1.5,
  heatExchangerPasses: 2,
  heatExchangerType: 'cross_flow_finned',
  
  // Hopper inputs (IITA / Kuye et al. 2011)
  hopperHoldingTimeMin: 10,
  hopperVolumeAllowancePercent: 10,
  hopperTopWidthM: 0.50,
  hopperTopLengthM: 0.50,
  hopperOutletWidthM: 0.32,
  hopperOutletLengthM: 0.22,
  hopperUpperHeightM: 0.10,
  hopperWallAngleADeg: 76,
  hopperWallAngleBDeg: 81,

  // Screw feeder inputs (IITA / Kuye et al. 2011)
  screwDiameterMm: 100,
  screwLengthMm: 1000,
  screwLoadingPercent: 30,
  screwSelectedRpm: 55,
  screwMaterialFactor: 1.2,
  screwFlightFactor: 1.0,
  screwBearingFactor: 1.0,
  screwDiameterFactor: 12,
  screwOverloadFactor: 3.0,
  screwDriveEfficiency: 0.88,
  screwShaftDiameterMm: 38,
  screwFlightThicknessMm: 4,
  screwPitchMm: 100,
  practicalMotorPowerKW: 0.75,
  materialPropertyType: 'dewatered_mash_cake',
};

export interface MaterialPropertyPreset {
  id: string;
  name: string;
  description: string;
  bulkDensityKgM3: number;
  bulkDensityLbFt3: number;
  materialFactorFm: number;
  standardTroughLoadingPercent: number;
  cemaClassification: string;
}

export const MATERIAL_PROPERTY_PRESETS: MaterialPropertyPreset[] = [
  {
    id: 'dewatered_mash_cake',
    name: 'Dewatered Cassava Mash Cake (IITA/RMRDC Reference)',
    description: 'Mechanically pressed cassava mash cake (40-45% moisture w.b.). Cohesive, semi-abrasive, packs easily, requires steep hopper walls to avoid bridging.',
    // 380 kg/m3 per ScrewFeederDesignTool_V1.0.xlsx (sheet ScrewFeederDesign, row 12).
    // Implies ~74% bed voidage against a 1480 kg/m3 particle density, which is high
    // for a dry solid but normal for a wet, flocculent mash cake. The previous
    // value of 1380 implied 6.8% voidage, i.e. a near-solid block, and is not
    // achievable for a cake.
    bulkDensityKgM3: 380,
    bulkDensityLbFt3: 23.72,
    materialFactorFm: 1.2,
    standardTroughLoadingPercent: 30,
    cemaClassification: 'Class 30 - Semi-abrasive, cohesive cake',
  },
  {
    id: 'semi_dry_grits',
    name: 'Semi-Dry Granulated Cassava Grits / Mash',
    description: 'Granulated or partially dried cassava mash with improved free-flowing granules.',
    bulkDensityKgM3: 850,
    bulkDensityLbFt3: 53.06,
    materialFactorFm: 1.0,
    standardTroughLoadingPercent: 30,
    cemaClassification: 'Class 30 - Granular solids',
  },
  {
    id: 'hqcf_flour',
    name: 'High-Quality Cassava Flour (HQCF Loose Dry Flour)',
    description: 'Dried cassava starch/flour (10-12% moisture w.b.), aerated, free-flowing, prone to dusting.',
    bulkDensityKgM3: 600,
    bulkDensityLbFt3: 37.46,
    materialFactorFm: 0.8,
    standardTroughLoadingPercent: 30,
    cemaClassification: 'Class 30 - Fine powders',
  },
  {
    id: 'starch_cake',
    name: 'Centrifuged Cassava Starch Cake',
    description: 'Dense dewatered starch cake from peeler centrifuge (35-38% moisture), very dense and dilatant.',
    bulkDensityKgM3: 1250,
    bulkDensityLbFt3: 78.03,
    materialFactorFm: 1.4,
    standardTroughLoadingPercent: 25,
    cemaClassification: 'Class 25 - Dense cohesive cake',
  },
];

// Preset capacities for instant switching (Primary design input: Wet Cassava Feed Rate kg/h)
export interface PresetOption {
  value: number;
  label: string;
  description: string;
  category: 'Experimental/Lab' | 'Pilot Plant' | 'Small-scale Commercial' | 'Medium Commercial';
}

// Throughput presets. Every value is a WET FEED rate in kg/h — the mass of
// dewatered cassava mash entering the venturi. Where the tool is in "dry product
// target" mode, these are converted by the dry-solids fraction rather than being
// written across as a product rate.
export const PRESET_CAPACITIES: PresetOption[] = [
  { value: 133, label: '133 kg/h Wet Feed', description: 'CIRAD Pilot Plant. Wet feed 133 kg/h gives roughly 80 kg/h dry product.', category: 'Pilot Plant' },
  { value: 500, label: '500 kg/h Wet Feed', description: 'Small Commercial Cassava Processing Unit (Kuye et al. reference line)', category: 'Small-scale Commercial' },
  { value: 820, label: '820 kg/h Wet Feed', description: 'IITA / RMRDC / Kuye et al. Reference Benchmark Case', category: 'Small-scale Commercial' },
  { value: 1000, label: '1,000 kg/h Wet Feed', description: '1.0 t/h wet feed processing facility', category: 'Medium Commercial' },
  { value: 1500, label: '1,500 kg/h Wet Feed', description: '1.5 t/h wet feed commercial flash dryer line', category: 'Medium Commercial' },
  { value: 2500, label: '2,500 kg/h Wet Feed', description: '2.5 t/h wet feed industrial processing line', category: 'Medium Commercial' },
  { value: 5000, label: '5,000 kg/h Wet Feed', description: '5.0 t/h wet feed high-capacity commercial plant', category: 'Medium Commercial' },
];

export const DEFAULT_DRYER_INPUTS: DryerInputs = IITA_REFERENCE_BENCHMARK;

export interface ReferenceItem {
  id: string;
  title: string;
  authors: string;
  institution: string;
  publication: string;
  year: string;
  url: string;
  description: string;
  summary: string;
  keyParameters: string[];
}

export const REFERENCES: ReferenceItem[] = [
  {
    id: 'ref-kuye',
    title: 'Design and Fabrication of a Flash Dryer for the Production of High-Quality Cassava Flour',
    authors: 'A. Kuye, D.B. Ayo, L.O. Sanni, A.O. Raji, E.I. Kwaya, O.O. Otuu, R. Okechukwu',
    institution: 'International Institute of Tropical Agriculture (IITA)',
    publication: 'IITA / Academia.edu',
    year: '2011 / 2017',
    url: 'https://www.academia.edu/40091307/Design_and_fabrication_of_a_flash_dryer_for_the_production_of_high_quality_cassava_flour#outer_page_15',
    description: 'Pioneering design and fabrication methodology of a 500 kg/h flash dryer in Nigeria. Established continuity equations for drying column diameter, pneumatic conveying transport velocity, cyclone recovery, and empirical operational parameters.',
    summary: 'Empirical and semi-theoretical sizing of cassava flash drying columns, continuity relations, residence time L = τ · us, cyclone collection, and pressure drops for 500 kg/h processing lines.',
    keyParameters: [
      '500 kg/h industrial processing baseline',
      'Column diameter calculation via continuity: D = sqrt(4·V / (π·v))',
      'Operating temperature 160 - 180°C inlet; 70 - 80°C outlet',
      'Lapple cyclone standard proportions and pressure drops',
      'Cassava specific heat C_ps = 1.67 kJ/(kg·K)'
    ]
  },
  {
    id: 'ref-cirad-pilot',
    title: 'Pilot Flash Dryer Report: Guidelines for the design and construction of an experimental pneumatic dryer for cassava products',
    authors: 'Arnaud Chapuis (CIRAD / CIAT / Univalle)',
    institution: 'CIRAD / CIAT (Cali, Colombia)',
    publication: 'CGIAR Research Program on Roots, Tubers and Bananas (RTB)',
    year: '2015',
    url: 'https://flashdryer.cirad.fr/content/download/4152/31238/version/1/file/201512_Pilot_flash_dryer_report_VF.pdf',
    description: 'Comprehensive experimental and theoretical 1D numerical model of heat and mass transfer in pneumatic drying pipes. Validated on an 80 kg/h pilot plant, proving that air-to-starch mass ratio must be 9:1 - 11:1 and pipe length L ≥ 20m for optimal energy efficiency.',
    summary: 'Detailed theoretical 1D momentum, energy, and moisture transfer model along the drying pipe, particle tracking (mean dp = 230 µm), pipe length L > 20 m, velocity 10-15 m/s, and air/starch mass ratio ~9:1.',
    keyParameters: [
      'Validated 80 kg/h pilot plant benchmark data',
      'Air-to-starch mass ratio benchmark: 9.0 : 1 to 11.0 : 1 (SEC < 4,500 kJ/kg H2O)',
      'Total developed pipe length threshold: L ≥ 20 meters (with return loops)',
      'Optimal air velocity: 12 - 18 m/s (15 m/s benchmark)',
      'Cassava starch particle size mean dp = 230 µm, particle density = 1480 kg/m³',
      'Venturi feeder throat acceleration to ~25 m/s to disintegrate lumps'
    ]
  },
  {
    id: 'ref-cirad-tool',
    title: 'CIRAD Flash Dryer Design Tools Suite',
    authors: 'CIRAD & Alliance Bioversity International - CIAT',
    institution: 'Alliance Bioversity-CIAT & CIRAD',
    publication: 'Open-access Flash Dryer Engineering Platform',
    year: '2018 - present',
    url: 'https://flashdryer.cirad.fr/design-tools',
    description: 'Online software suite developed by international agricultural engineering researchers. Integrates modular calculation engines for flash drying pipe sizing, cyclone separation, screw feeding, indirect air heating, and blower matching.',
    summary: 'Comprehensive engineering web tool suite covering 5 modules: flash drying pipe dimensions, screw feeder sizing, Lapple/Stairmand cyclones, heat exchanger generator (with multi-pass calculations), and blower system.',
    keyParameters: [
      'Modular 5-component flash dryer architecture (Pipe, Feeder, Cyclone, Heat Exchanger, Blower)',
      'Multi-pass heat exchanger thermal area & pressure drop modeling',
      'Stairmand High Efficiency cyclone modeling (Eu = 6.4)',
      'Fluid dynamic saltation velocity & terminal velocity bounds',
      'Fan pressure drop accumulation (ΔP_total = ΔP_heater + ΔP_pipe + ΔP_venturi + ΔP_cyclone)',
      'Starch gelatinization risk boundary: T_out < 85°C'
    ]
  }
];

export const REFERENCE_DOCUMENTS = REFERENCES;

// Standard Fuel Properties & Combustion Efficiencies
export const FUEL_STANDARDS = {
  diesel: {
    name: 'Industrial Diesel #2',
    lhvMJperKg: 42.8,
    lhvKJperKg: 42800,
    densityKgPerL: 0.84,
    lhvKJperL: 36000, // 36.0 MJ/L
    burnerEfficiency: 0.88, // 88% commercial forced-draft pressure burner
    unit: 'L/h',
    source: 'Perry\'s Chemical Engineers\' Handbook / CIRAD',
  },
  lpg: {
    name: 'Liquefied Petroleum Gas (LPG Propane/Butane)',
    lhvMJperKg: 46.1,
    lhvKJperKg: 46100,
    burnerEfficiency: 0.90, // 90% high-efficiency direct/indirect burner
    unit: 'kg/h',
    source: 'ASHRAE / CIRAD',
  },
  biomassWood: {
    name: 'Air-Dried Biomass Firewood (20% MC)',
    lhvMJperKg: 15.5,
    lhvKJperKg: 15500,
    burnerEfficiency: 0.70, // 70% refractory grate furnace with heat exchanger
    unit: 'kg/h',
    source: 'CIRAD Agro-Waste Combustion Standard',
  },
};

// Fan & Blower Constants
export const BLOWER_STANDARDS = {
  fanTotalEfficiency: 0.65, // 65% total aerodynamic efficiency for backward-curved industrial centrifugal blower
  motorTransmissionEfficiency: 0.95, // 95% V-belt drive transmission
  motorServiceFactor: 1.15, // 15% nameplate safety margin (CEMA / AMCA standard)
};

// CIRAD Cassava Flash Dryer Process Benchmarks
//
// Single source of truth for every CIRAD threshold used by the calculation engine.
// Previously the air:starch range appeared in three mutually inconsistent places
// (9-11, 9-11.5 and 18-28) and the pipe-length rule as 18 m, 20 m and 22 m.
//
// The values below follow the cited primary source — Chapuis et al. (2015),
// CIRAD Pilot Flash Dryer Report — which states an air-to-starch ratio of
// 9:1 - 11:1 measured on a DRY SOLIDS basis, L >= 20 m, and 12-18 m/s.
// The earlier 18-28 entry contradicted that same source and has been removed.
export const CIRAD_BENCHMARKS = {
  // Air-to-starch mass ratio, dry air per kg DRY SOLIDS (Chapuis et al. 2015).
  // Validated on mechanically dewatered cassava cake at <= 33% moisture content.
  airToStarchRatioMin: 9.0,
  airToStarchRatioMax: 11.0,
  // Upper bound of the narrow benchmark band before a design is considered to be
  // running surplus air purely to supply evaporation duty at high feed moisture.
  airToStarchRatioSurplusMax: 16.5,
  // Air-to-wet-feed ratio is reported for information ONLY. It is a different
  // denominator and must never be compared against the dry-solids range above.
  // Retained because it is a useful mass-balance cross-check.
  airToWetFeedRatioMin: 9.0,
  airToWetFeedRatioMax: 14.0,

  // Specific Energy Consumption (SEC) benchmark range — the efficiency criterion
  // used by the source literature. This was previously defined but never checked.
  secKJperKgWaterMin: 3800,
  secKJperKgWaterMax: 4800,
  secOptimalTargetKJperKgWater: 4200,
  secPassTolerancePercent: 10, // within +/-10% of the 4200 optimum counts as on-target

  // Total developed pipe length, including return loops.
  minDevelopedPipeLengthM: 20.0,
  // Below this the design is flagged outright rather than merely warned.
  criticalDevelopedPipeLengthM: 18.0,

  // Conveying air velocity envelope.
  recommendedAirVelocityMinMperS: 12.0,
  recommendedAirVelocityMaxMperS: 18.0,
  optimalAirVelocityMperS: 15.0,
  // Above this, abrasion and fan power become the governing concern.
  criticalAirVelocityMaxMperS: 22.0,
};
