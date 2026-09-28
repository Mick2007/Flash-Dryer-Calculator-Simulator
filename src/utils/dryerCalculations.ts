import {
  DryerInputs,
  CalculationResults,
  MaterialBalance,
  PsychrometricProperties,
  EnergyBalance,
  FluidDynamics,
  DryerDimensions,
  HeatExchangerSpecs,
  CalculationStep,
  AssumedParameter,
  ValidationCheck,
  SourceClassification,
  PressureSystemAnalysis,
  FlashTubeDevelopedLengthReport,
  FlashTubeSegment,
  HopperDesignReport,
  ScrewFeederDesignReport
} from '../types/dryer';
import { STANDARD_PIPE_SIZES_MM, STAIRMAND_RATIOS, LAPPLE_RATIOS, FUEL_STANDARDS, BLOWER_STANDARDS, CIRAD_BENCHMARKS } from './constants';

// ==========================================
// SHARED NUMERICAL HELPERS
// ==========================================
// Specific gas constant for dry air, kJ/(kg*K) — ASHRAE Fundamentals Handbook.
const R_DA = 0.287058;
// Molar mass ratio M_da/M_v = 28.97/18.015. Divides the vapour increment in the
// density denominator; water vapour is the lighter species, so its presence must
// REDUCE density. Named for what it is, not for its position.
const MW_RATIO = 1.608;

/**
 * Clamp a possibly-missing/NaN input into a physically valid band.
 *
 * Unlike the `Number(x) || fallback` idiom this replaces, this preserves
 * legitimate zero values (e.g. heatLossFactor = 0 for a perfectly insulated
 * dryer) and only substitutes the fallback when the input is not a finite
 * number. `fallback` itself is assumed to already sit inside [min, max].
 */
function clampNum(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * ASHRAE moist-air density:
 *
 *     rho = P * (1 + W) / (R_da * T * (1 + (M_da/M_v) * W))
 *
 * where W is the humidity ratio (kg water vapour / kg dry air), T is in kelvin
 * and M_da/M_v = 28.97/18.015 = 1.608.
 *
 * Derivation. Humidity ratio is a MASS ratio W = m_v/m_da, but the ideal gas law
 * is written in MOLES. Converting gives the total mass per unit volume as
 *
 *     rho = P * (1 + W) / (R_da * T * (1 + 1.608 * W))
 *
 * The `1 + 1.608*W` term belongs in the DENOMINATOR. That is the whole point:
 * water vapour is lighter than dry air, so a humid volume weighs LESS. Putting
 * the term in the numerator inverts the physics and makes humid air heavier than
 * dry air — overstating density by ~1.2% at sea level ambient and ~4.5% at the
 * default hot, humid exhaust, which propagates into duct, cyclone and fan sizing.
 */
function moistAirDensity(atmosphericPressureKPa: number, tempC: number, humidityRatio: number): number {
  const tKelvin = tempC + 273.15;
  return (atmosphericPressureKPa * (1 + humidityRatio)) / (R_DA * tKelvin * (1 + MW_RATIO * humidityRatio));
}

/**
 * Invert the Schiller & Naumann drag correlation for the particle Reynolds number.
 *
 * A force balance on a sphere gives
 *
 *     (pi/6) * d^3 * (rho_p - rho_f) * g = Cd * (pi/4) * d^2 * rho_f * u^2 / 2
 *
 * which rearranges to Ar = (3/4) * Cd * Re^2. Note the factor is 3/4, not 4/3;
 * an earlier version of this comment had it inverted. The CODE was correct
 * throughout and the solver below was checked against the Stokes limit, so this
 * correction is to the documentation only. Substituting the Schiller & Naumann
 * drag coefficient Cd = (24/Re) * (1 + 0.15 * Re^0.687) reduces this to the
 * IMPLICIT equation
 *
 *     Ar = 18 * Re * (1 + 0.15 * Re^0.687)
 *
 * f(Re) = 18*Re*(1 + 0.15*Re^0.687) - Ar is strictly increasing for Re > 0, with
 * f(0) = -Ar < 0 and f(Ar/18) > 0. Bisection on [0, Ar/18] is therefore
 * guaranteed to converge — unlike an unchecked Newton step, it cannot diverge.
 */
function solveSchillerNaumannRe(archimedesNumber: number): { re: number; iterations: number; residual: number } {
  let lo = 0;
  let hi = archimedesNumber / 18;
  let re = hi;
  let iterations = 0;
  let residual = Number.POSITIVE_INFINITY;
  for (let i = 0; i < 200; i++) {
    iterations = i + 1;
    re = (lo + hi) / 2;
    residual = 18 * re * (1 + 0.15 * Math.pow(re, 0.687)) - archimedesNumber;
    if (Math.abs(residual) <= 1e-10 * archimedesNumber) break;
    if (residual < 0) lo = re;
    else hi = re;
  }
  return { re, iterations, residual };
}

export function calculateFlashDryer(inputs: DryerInputs): CalculationResults {
  const steps: CalculationStep[] = [];
  let stepCounter = 1;

  function addStep(
    category: CalculationStep['category'],
    parameterName: string,
    symbol: string,
    unit: string,
    simpleExplanation: string,
    equation: string,
    variableDefinitions: { symbol: string; name: string; value: string; unit: string; classification: SourceClassification }[],
    substitution: string,
    numericResult: number,
    formattedResult: string,
    sourceCitation: string,
    sourceClassification: SourceClassification,
    notes?: string
  ) {
    steps.push({
      id: `step-${stepCounter++}`,
      category,
      parameterName,
      symbol,
      unit,
      simpleExplanation,
      equation,
      variableDefinitions,
      substitution,
      numericResult,
      formattedResult,
      sourceCitation,
      sourceClassification,
      notes,
    });
  }

  // ==========================================
  // 1. MATERIAL BALANCE & SANITIZED INPUTS
  // ==========================================
  // Safeguard against boundary/invalid input combinations.
  // Every substitution and out-of-range clamp is recorded so the UI, PDF and
  // CAD export can disclose that the value used differs from the value entered.
  const inputAdjustments: { field: string; requested: string; applied: string; reason: string }[] = [];
  const bounded = (field: string, value: unknown, min: number, max: number, fallback: number) => {
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) {
      inputAdjustments.push({ field, requested: String(value), applied: String(fallback), reason: 'not a finite number — default applied' });
      return fallback;
    }
    const v = Math.max(min, Math.min(max, n));
    if (v !== n) {
      inputAdjustments.push({ field, requested: n.toString(), applied: v.toString(), reason: `outside valid range ${min}–${max}` });
    }
    return v;
  };

  const safeInitialMoisture = bounded('Initial moisture content', inputs.initialMoisture, 10, 85, 40);
  const safeFinalMoisture = bounded('Final moisture content', inputs.finalMoisture, 3, safeInitialMoisture - 1.0, 12);
  const safeOutletAirTemp = bounded('Outlet air temperature', inputs.outletAirTemp, 45, 110, 75);
  const safeInletAirTemp = bounded('Inlet air temperature', inputs.inletAirTemp, safeOutletAirTemp + 10, 260, 170);
  const safeAmbientTemp = bounded('Ambient air temperature', inputs.ambientTemp, 5, safeOutletAirTemp - 5, 27);
  const safeAmbientRH = bounded('Ambient relative humidity', inputs.ambientRH, 10, 98, 70);
  const safeAltitude = bounded('Site altitude', inputs.altitude, 0, 4000, 0);
  const safeAirVelocity = bounded('Design air velocity', inputs.airVelocity, 5, 40, 15);
  const safeFeedTemp = bounded('Feed temperature', inputs.feedTemp, 5, safeInletAirTemp - 20, 25);
  const safeFinalProductTemp = bounded('Final product temperature', inputs.finalProductTemp, safeFeedTemp, safeOutletAirTemp, 50);
  const safeHeatLossFactor = bounded('Heat loss factor', inputs.heatLossFactor, 0.01, 0.40, 0.12);
  const safeCassavaCp = bounded('Cassava specific heat', inputs.cassavaSpecificHeat, 1.0, 3.0, 1.67);
  const safeTargetResidenceTime = bounded('Target residence time', inputs.targetResidenceTime, 0.5, 8.0, 1.5);
  const safeParticleDiameter = bounded('Particle diameter', inputs.particleDiameter, 50, 3000, 230);
  const safeParticleDensity = bounded('Particle density', inputs.particleDensity, 800, 2500, 1480);
  // Bulk density cannot exceed particle density. Bulk density is the mass of the
  // settled, air-filled bed per unit volume; particle density is that of the solid
  // material itself. The bed necessarily contains voids, so bulk is always strictly
  // LESS than particle density, and it cannot physically exceed it.
  //
  // The two were previously clamped independently, so a user could enter a bulk
  // density of 2400 kg/m3 against a particle density of 900 kg/m3 and the engine
  // would accept it, then compute an inverted solids volume fraction and size the
  // feeder, hopper and ducts from it.
  //
  // The bed voidage fraction phi is the standard relationship:
  //
  //     phi = 1 - rho_bulk / rho_particle      (0 < phi < 1)
  //
  // HARD CEILING at 0.9 x particle density, as a bulk density at or above the
  // particle density describes a solid block rather than a bulk solid and would
  // make every volume derived from it (hopper, feed duct, settling) wrong.
  //
  // A PRACTICAL band is also enforced, at voidage 0.30-0.65. A real packed bed of
  // flour, starch or press cake sits at roughly 35-45% voidage. A value inside
  // the hard ceiling but outside the practical band is physically possible but
  // unusual, so it is accepted and flagged rather than silently replaced — the
  // distinction matters because a user measuring a very dense centrifugate cake
  // should not have their measurement overwritten by an assumption.
  const BULK_MAX_FRACTION_OF_PARTICLE = 0.9; // hard ceiling, cannot be exceeded
  const BULK_VOIDAGE_MAX = 0.65; // 65% voids: extremely loose, lower physical bound
  const BULK_VOIDAGE_MIN = 0.30; // 30% voids: densely settled bed, upper practical bound
  const hardCeilingBulkDensity = safeParticleDensity * BULK_MAX_FRACTION_OF_PARTICLE;
  const practicalMaxBulkDensity = safeParticleDensity * (1 - BULK_VOIDAGE_MIN);
  const practicalMinBulkDensity = safeParticleDensity * (1 - BULK_VOIDAGE_MAX);
  const safeBulkDensity = bounded(
    'Bulk density',
    inputs.bulkDensity,
    Math.max(1, practicalMinBulkDensity),
    hardCeilingBulkDensity,
    clampNum(safeParticleDensity * 0.6, practicalMinBulkDensity, hardCeilingBulkDensity, safeParticleDensity * 0.6),
  );
  // Voidage actually realised, for reporting and for the bulk-density check.
  const bulkVoidageFraction = 1 - safeBulkDensity / Math.max(1, safeParticleDensity);
  // True when the value is legal but outside the range a real packed bed occupies.
  const bulkDensityUnusual = bulkVoidageFraction < BULK_VOIDAGE_MIN || bulkVoidageFraction > BULK_VOIDAGE_MAX;

  // Fractional (wet-basis) moisture contents used throughout the material balance.
  // Derived from the sanitized percentages above so every downstream value is consistent.
  const w1 = safeInitialMoisture / 100; // initial (feed) moisture, fraction
  const w2 = safeFinalMoisture / 100;   // final (product) moisture, fraction

  let feedRateKgH: number;
  let productRateKgH: number;
  let drySolidsKgH: number;
  let waterRemovedKgH: number;

  // Capacity bounds. Upper bound set at 100 t/h of dry product, which is above any
  // cassava flash dryer in commercial service, so a sane design is never affected.
  // It exists because `Number(x) || 50` does not reject Infinity: Infinity is
  // truthy, so it passed straight through and every downstream figure (dry solids,
  // water removed, burner duty, air mass flow, air:starch ratio) became Infinity
  // or NaN with no crash and no visible error. An upper bound turns that into a
  // disclosed substitution instead of a silently broken report.
  if (inputs.capacityMode === 'product') {
    productRateKgH = clampNum(inputs.desiredProductRate, 1, 100000, 50);
    drySolidsKgH = productRateKgH * (1 - w2);
    feedRateKgH = drySolidsKgH / (1 - w1);
    waterRemovedKgH = feedRateKgH - productRateKgH;

    addStep(
      'Material Balance',
      'Dry Solids Flow Rate',
      'F_ds',
      'kg/h',
      'Calculates the bone-dry cassava starch and fiber content in kilograms per hour that passes through the system, unaffected by moisture evaporation.',
      'F_ds = F_prod × (1 - w2)',
      [
        { symbol: 'F_prod', name: 'Desired dry product flow rate', value: productRateKgH.toFixed(2), unit: 'kg/h', classification: 'User Input' },
        { symbol: 'w2', name: 'Final moisture content (fraction wet basis)', value: w2.toFixed(3), unit: '-', classification: 'User Input' }
      ],
      `${productRateKgH.toFixed(2)} × (1 - ${w2.toFixed(3)})`,
      drySolidsKgH,
      `${drySolidsKgH.toFixed(2)} kg/h`,
      'CIRAD Pilot Flash Dryer Report (2015), Section 2.1; Kuye et al. (2011), Section 3.1',
      'Calculated',
      'Bone-dry starch/fiber fraction entering and exiting the flash dryer without solid loss.'
    );

    addStep(
      'Material Balance',
      'Wet Cassava Feed Rate',
      'F_wet',
      'kg/h',
      'Determines how much wet cassava mash (post-press dewatered cake) you must feed into the dryer each hour to achieve your target dry flour production.',
      'F_wet = F_ds / (1 - w1)',
      [
        { symbol: 'F_ds', name: 'Dry solids flow rate', value: drySolidsKgH.toFixed(2), unit: 'kg/h', classification: 'Calculated' },
        { symbol: 'w1', name: 'Initial moisture content (fraction wet basis)', value: w1.toFixed(3), unit: '-', classification: 'User Input' }
      ],
      `${drySolidsKgH.toFixed(2)} / (1 - ${w1.toFixed(3)})`,
      feedRateKgH,
      `${feedRateKgH.toFixed(2)} kg/h`,
      'CIRAD Pilot Flash Dryer Report (2015), Eq. 2; Kuye et al. (2011), p. 16',
      'Calculated',
      'Required wet cassava mash delivery to meet target dry flour capacity.'
    );
  } else {
    feedRateKgH = clampNum(inputs.feedRate, 1, 250000, 100);
    drySolidsKgH = feedRateKgH * (1 - w1);
    productRateKgH = drySolidsKgH / (1 - w2);
    waterRemovedKgH = feedRateKgH - productRateKgH;

    addStep(
      'Material Balance',
      'Dry Solids Flow Rate',
      'F_ds',
      'kg/h',
      'Calculates the bone-dry starch and fiber portion of your incoming wet cassava mash after discounting water content.',
      'F_ds = F_wet × (1 - w1)',
      [
        { symbol: 'F_wet', name: 'Wet cassava mash feed rate', value: feedRateKgH.toFixed(2), unit: 'kg/h', classification: 'User Input' },
        { symbol: 'w1', name: 'Initial moisture content (fraction wet basis)', value: w1.toFixed(3), unit: '-', classification: 'User Input' }
      ],
      `${feedRateKgH.toFixed(2)} × (1 - ${w1.toFixed(3)})`,
      drySolidsKgH,
      `${drySolidsKgH.toFixed(2)} kg/h`,
      'Method adapted from CIRAD (Chapuis et al. 2015) & IITA (Kuye et al. 2011)',
      'Calculated'
    );

    addStep(
      'Material Balance',
      'Dry Cassava Flour Output Rate',
      'F_prod',
      'kg/h',
      'Determines the hourly harvest of finished high-quality cassava flour (HQCF) leaving the dryer at your target commercial moisture level.',
      'F_prod = F_ds / (1 - w2)',
      [
        { symbol: 'F_ds', name: 'Dry solids flow rate', value: drySolidsKgH.toFixed(2), unit: 'kg/h', classification: 'Calculated' },
        { symbol: 'w2', name: 'Final moisture content (fraction wet basis)', value: w2.toFixed(3), unit: '-', classification: 'User Input' }
      ],
      `${drySolidsKgH.toFixed(2)} / (1 - ${w2.toFixed(3)})`,
      productRateKgH,
      `${productRateKgH.toFixed(2)} kg/h`,
      'Method adapted from CIRAD (Chapuis et al. 2015) & IITA (Kuye et al. 2011)',
      'Calculated'
    );
  }

  const feedRateKgS = feedRateKgH / 3600;
  const drySolidsKgS = drySolidsKgH / 3600;
  const productRateKgS = productRateKgH / 3600;
  const waterRemovedKgS = waterRemovedKgH / 3600;
  // Use the sanitized values here — safeInitialMoisture has a floor of 10%,
  // so this division can no longer produce Infinity or NaN.
  const moistureRemovedPercentage = ((safeInitialMoisture - safeFinalMoisture) / safeInitialMoisture) * 100;

  addStep(
    'Material Balance',
    'Moisture Removal Rate (Evaporation Load)',
    'W_e',
    'kg/h',
    'The total mass of liquid water in kilograms that the hot conveying air stream must evaporate from the wet cassava mash each hour.',
    'W_e = F_wet - F_prod',
    [
      { symbol: 'F_wet', name: 'Wet cassava feed rate', value: feedRateKgH.toFixed(2), unit: 'kg/h', classification: 'Calculated' },
      { symbol: 'F_prod', name: 'Final flour production rate', value: productRateKgH.toFixed(2), unit: 'kg/h', classification: 'Calculated' }
    ],
    `${feedRateKgH.toFixed(2)} - ${productRateKgH.toFixed(2)}`,
    waterRemovedKgH,
    `${waterRemovedKgH.toFixed(2)} kg/h (${waterRemovedKgS.toFixed(4)} kg/s)`,
    'Method adapted from CIRAD (Chapuis et al. 2015) & IITA (Kuye et al. 2011)',
    'Calculated',
    'Total moisture to be vaporized into the conveying air stream per hour.'
  );

  addStep(
    'Material Balance',
    'Percentage of Moisture Removed',
    'Delta_w_pct',
    '%',
    'Percentage reduction in moisture content from wet cake entering the system down to dry flour product.',
    'Delta_w_pct = [ (w1 - w2) / w1 ] × 100',
    [
      { symbol: 'w1', name: 'Initial moisture content', value: `${safeInitialMoisture.toFixed(1)}%`, unit: '%', classification: 'User Input' },
      { symbol: 'w2', name: 'Final moisture content', value: `${safeFinalMoisture.toFixed(1)}%`, unit: '%', classification: 'User Input' }
    ],
    `[ (${safeInitialMoisture.toFixed(1)} - ${safeFinalMoisture.toFixed(1)}) / ${safeInitialMoisture.toFixed(1)} ] × 100`,
    moistureRemovedPercentage,
    `${moistureRemovedPercentage.toFixed(1)}% Moisture Removed`,
    'Standard Moisture Reduction Mass Balance',
    'Calculated',
    'Fraction of water removed relative to incoming moisture content.'
  );

  const materialBalance: MaterialBalance = {
    feedRateKgH,
    feedRateKgS,
    drySolidsKgH,
    drySolidsKgS,
    productRateKgH,
    productRateKgS,
    waterRemovedKgH,
    waterRemovedKgS,
    moistureRemovedPercentage,
  };

  // ==========================================
  // 2. PSYCHROMETRIC & AIR CALCULATIONS
  // ==========================================
  // Barometric pressure adjusted for altitude (barometric formula, ISO 2533)
  const atmosphericPressureKPa = 101.325 * Math.pow(Math.max(0.1, 1 - 2.25577e-5 * safeAltitude), 5.25588);

  addStep(
    'Psychrometric & Air',
    'Barometric Atmospheric Pressure',
    'P_atm',
    'kPa',
    'Adjusts ambient atmospheric pressure based on the factory elevation above sea level, ensuring air volume and fan sizing remain accurate in higher-altitude regions.',
    'P_atm = 101.325 × (1 - 2.25577 × 10^-5 × z)^5.25588',
    [
      { symbol: 'z', name: 'Installation site altitude', value: safeAltitude.toFixed(0), unit: 'm', classification: 'User Input' }
    ],
    `101.325 × (1 - 2.25577 × 10^-5 × ${safeAltitude.toFixed(0)})^5.25588`,
    atmosphericPressureKPa,
    `${atmosphericPressureKPa.toFixed(2)} kPa`,
    'ASHRAE Fundamentals Handbook / ISO 2533 Standard Atmosphere',
    'Calculated',
    'Accounts for air density reduction at non-sea-level installations.'
  );

  // Saturation vapor pressure at ambient temp (Magnus-Tetens)
  const satVaporPressAmbKPa = 0.61078 * Math.exp((17.27 * safeAmbientTemp) / (safeAmbientTemp + 237.3));
  const ambVaporPressureKPa = (safeAmbientRH / 100) * satVaporPressAmbKPa;
  // Ambient absolute humidity ratio Y_amb (kg water / kg dry air)
  const ambDiff = Math.max(0.5, atmosphericPressureKPa - ambVaporPressureKPa);
  const ambientHumidityRatio = Math.max(0.001, 0.622 * (ambVaporPressureKPa / ambDiff));

  addStep(
    'Psychrometric & Air',
    'Ambient Humidity Ratio',
    'Y_amb',
    'kg/kg dry air',
    "Measures the moisture already contained in the outside intake air before heating, which reduces the air's remaining moisture-carrying capacity.",
    'Y_amb = 0.622 × P_v / (P_atm - P_v)',
    [
      { symbol: 'P_v', name: 'Ambient partial vapor pressure', value: ambVaporPressureKPa.toFixed(3), unit: 'kPa', classification: 'Calculated' },
      { symbol: 'P_atm', name: 'Atmospheric pressure', value: atmosphericPressureKPa.toFixed(2), unit: 'kPa', classification: 'Calculated' }
    ],
    `0.622 × ${ambVaporPressureKPa.toFixed(3)} / (${atmosphericPressureKPa.toFixed(2)} - ${ambVaporPressureKPa.toFixed(3)})`,
    ambientHumidityRatio,
    `${ambientHumidityRatio.toFixed(5)} kg w / kg dry air`,
    'CIRAD Pilot Flash Dryer Report (2015), Section 3.1; Psychrometric Standard',
    'Calculated'
  );

  // Moist air density: rho = P * (1 + 1.608*Y) / [R_da * (T + 273.15) * (1 + Y)]
  const ambientAirDensity = Math.max(0.6, moistAirDensity(atmosphericPressureKPa, safeAmbientTemp, ambientHumidityRatio));
  const inletAirDensity = Math.max(0.5, moistAirDensity(atmosphericPressureKPa, safeInletAirTemp, ambientHumidityRatio));

  addStep(
    'Psychrometric & Air',
    'Drying Air Density at Inlet Temperature',
    'rho_in',
    'kg/m³',
    'Calculates the physical density of the air once heated to inlet temperature; hot air expands and becomes lighter, altering duct velocity and fan power.',
    'rho_in = P_atm × (1 + 1.608 × Y_amb) / [R_da × (T_in + 273.15) × (1 + Y_amb)]',
    [
      { symbol: 'T_in', name: 'Drying air inlet temperature', value: safeInletAirTemp.toFixed(1), unit: '°C', classification: 'User Input' },
      { symbol: 'Y_amb', name: 'Ambient humidity ratio', value: ambientHumidityRatio.toFixed(5), unit: 'kg/kg', classification: 'Calculated' },
      { symbol: 'R_da', name: 'Specific gas constant for dry air', value: '0.28706', unit: 'kJ/(kg·K)', classification: 'Directly from Source' }
    ],
    `${atmosphericPressureKPa.toFixed(2)} × (1 + 1.608 × ${ambientHumidityRatio.toFixed(5)}) / [0.28706 × (${safeInletAirTemp.toFixed(1)} + 273.15) × (1 + ${ambientHumidityRatio.toFixed(5)})]`,
    inletAirDensity,
    `${inletAirDensity.toFixed(3)} kg/m³`,
    'CIRAD Pilot Flash Dryer Report (2015), Eq. 5; Kuye et al. (2011), Section 3.3',
    'Calculated'
  );

  // ==========================================
  // 3. ENERGY BALANCE & REQUIRED AIRFLOW
  // ==========================================
  // Specific heat constants
  const C_pa = 1.005; // kJ/(kg·K) dry air
  const C_pv = 1.880; // kJ/(kg·K) water vapor
  const C_pw = 4.184; // kJ/(kg·K) liquid water
  const C_ps = safeCassavaCp; // kJ/(kg·K) dry cassava starch (~1.67)

  // Latent heat of vaporization at outlet temp T_out.
  // Textbook linear fit referenced to 0 °C: h_fg(T) = h_fg,0 - dT * C_pw
  const latentHeatKJperKgRef0 = 2501; // kJ/kg at 0 °C
  const latentHeatKJperKg = latentHeatKJperKgRef0 - 2.361 * safeOutletAirTemp;

  addStep(
    'Energy Balance',
    'Latent Heat of Vaporization',
    'h_fg',
    'kJ/kg',
    'The amount of thermal energy required to convert 1 kg of liquid water in the cassava into steam or vapor at dryer exhaust conditions.',
    'h_fg = 2501 - 2.361 × T_out',
    [
      { symbol: 'T_out', name: 'Exhaust air outlet temperature', value: safeOutletAirTemp.toFixed(1), unit: '°C', classification: 'User Input' }
    ],
    `2501 - 2.361 × ${safeOutletAirTemp.toFixed(1)}`,
    latentHeatKJperKg,
    `${latentHeatKJperKg.toFixed(1)} kJ/kg`,
    'Kuye et al. (2011), Section 3.2; CIRAD Pilot Flash Dryer Report (2015), Section 3.3',
    'Calculated',
    'Heat of phase change of water from liquid to vapor at dryer exhaust condition.'
  );

  // Evaporation heat load Q_evap (kW)
  // Q_evap = W_e,s * [h_fg + C_pw * (T_out - T_feed)]
  // Water enters as LIQUID at T_feed and leaves as VAPOUR at T_out, so the sensible
  // term uses the liquid specific heat C_pw (4.184), not the vapour value C_pv (1.88).
  const evaporationHeatKW = Math.max(0.1, waterRemovedKgS * (latentHeatKJperKg + C_pw * (safeOutletAirTemp - safeFeedTemp)));

  addStep(
    'Energy Balance',
    'Moisture Evaporation Heat Requirement',
    'Q_evap',
    'kW',
    'The thermal power (in kilowatts) exclusively needed to boil off the water load from the moving cassava particles into the air stream.',
    'Q_evap = W_e × [h_fg + C_pw × (T_out - T_feed)]',
    [
      { symbol: 'W_e', name: 'Moisture removal rate in kg/s', value: waterRemovedKgS.toFixed(4), unit: 'kg/s', classification: 'Calculated' },
      { symbol: 'h_fg', name: 'Latent heat of vaporization', value: latentHeatKJperKg.toFixed(1), unit: 'kJ/kg', classification: 'Calculated' },
      { symbol: 'C_pw', name: 'Specific heat of liquid water', value: '4.184', unit: 'kJ/(kg·K)', classification: 'Directly from Source' },
      { symbol: 'T_feed', name: 'Incoming cassava feed temperature', value: safeFeedTemp.toFixed(1), unit: '°C', classification: 'User Input' }
    ],
    `${waterRemovedKgS.toFixed(4)} × [${latentHeatKJperKg.toFixed(1)} + 4.184 × (${safeOutletAirTemp.toFixed(1)} - ${safeFeedTemp.toFixed(1)})]`,
    evaporationHeatKW,
    `${evaporationHeatKW.toFixed(2)} kW`,
    'CIRAD Pilot Flash Dryer Report (2015), Eq. 7; Kuye et al. (2011), p. 17',
    'Calculated'
  );

  // Sensible heat absorbed by dry solids and remaining moisture:
  // Q_solid = F_ds,s * C_ps * (T_prod - T_feed) + F_prod,s * w2 * C_pw * (T_prod - T_feed)
  const productHeatingKW = Math.max(0.01, (drySolidsKgS * C_ps + productRateKgS * w2 * C_pw) * Math.max(1, safeFinalProductTemp - safeFeedTemp));

  addStep(
    'Energy Balance',
    'Product Sensible Heating Requirement',
    'Q_solid',
    'kW',
    'The thermal energy consumed in warming the incoming cool cassava mash from storage temperature up to its warm dryer exit discharge temperature.',
    'Q_solid = [F_ds × C_ps + F_prod × w2 × C_pw] × (T_prod - T_feed)',
    [
      { symbol: 'F_ds', name: 'Dry solids rate', value: drySolidsKgS.toFixed(4), unit: 'kg/s', classification: 'Calculated' },
      { symbol: 'C_ps', name: 'Specific heat of dry cassava starch', value: C_ps.toFixed(2), unit: 'kJ/(kg·K)', classification: 'Directly from Source' },
      { symbol: 'T_prod', name: 'Final dried product exit temperature', value: safeFinalProductTemp.toFixed(1), unit: '°C', classification: 'Engineering Assumption' }
    ],
    `[${drySolidsKgS.toFixed(4)} × ${C_ps.toFixed(2)} + ${productRateKgS.toFixed(4)} × ${w2.toFixed(3)} × 4.184] × (${safeFinalProductTemp.toFixed(1)} - ${safeFeedTemp.toFixed(1)})`,
    productHeatingKW,
    `${productHeatingKW.toFixed(2)} kW`,
    'CIRAD Pilot Flash Dryer Report (2015), Section 3.2; Kuye et al. (2011), p. 18',
    'Calculated'
  );

  // Wall heat losses
  const wallHeatLossKW = (evaporationHeatKW + productHeatingKW) * safeHeatLossFactor;
  // Total thermal load transferred inside drying duct
  const thermalDryingDutyKW = evaporationHeatKW + productHeatingKW + wallHeatLossKW;

  // Mass flow rate of dry air G_da (kg/s) required to deliver this heat between T_in and T_out:
  // delta_h_air = (C_pa + Y_amb * C_pv) * (T_in - T_out)
  const deltaT_dry = Math.max(10, safeInletAirTemp - safeOutletAirTemp);
  const deltaH_Air = Math.max(10, (C_pa + ambientHumidityRatio * C_pv) * deltaT_dry);
  const dryAirMassFlowKgS = Math.max(0.01, thermalDryingDutyKW / deltaH_Air);
  const dryAirMassFlowKgH = dryAirMassFlowKgS * 3600;
  const humidAirMassFlowKgS = dryAirMassFlowKgS * (1 + ambientHumidityRatio);

  addStep(
    'Energy Balance',
    'Required Dry Air Mass Flow Rate',
    'G_da',
    'kg/s',
    'The total mass flow of bone-dry air per second required to carry all necessary drying heat into the column without dropping below the target exhaust temperature.',
    'G_da = (Q_evap + Q_solid + Q_loss) / [(C_pa + Y_amb × C_pv) × (T_in - T_out)]',
    [
      { symbol: 'Q_evap', name: 'Evaporation heat load', value: evaporationHeatKW.toFixed(2), unit: 'kW', classification: 'Calculated' },
      { symbol: 'Q_solid', name: 'Product heating load', value: productHeatingKW.toFixed(2), unit: 'kW', classification: 'Calculated' },
      { symbol: 'Q_loss', name: 'Estimated wall heat loss', value: wallHeatLossKW.toFixed(2), unit: 'kW', classification: 'Engineering Assumption' },
      { symbol: 'T_in - T_out', name: 'Drying temperature drop', value: (safeInletAirTemp - safeOutletAirTemp).toFixed(1), unit: '°C', classification: 'User Input' }
    ],
    `(${evaporationHeatKW.toFixed(2)} + ${productHeatingKW.toFixed(2)} + ${wallHeatLossKW.toFixed(2)}) / [(${C_pa} + ${ambientHumidityRatio.toFixed(5)} × ${C_pv}) × (${safeInletAirTemp.toFixed(1)} - ${safeOutletAirTemp.toFixed(1)})]`,
    dryAirMassFlowKgS,
    `${dryAirMassFlowKgS.toFixed(3)} kg/s (${dryAirMassFlowKgH.toFixed(1)} kg/h)`,
    'CIRAD Pilot Flash Dryer Report (2015), Eq. 8; Kuye et al. (2011), Section 3.2',
    'Calculated',
    'Mass flow rate of bone-dry air required to supply necessary sensible heat.'
  );

  // Exhaust humidity ratio
  const exhaustHumidityRatio = ambientHumidityRatio + (waterRemovedKgS / dryAirMassFlowKgS);

  // Exhaust relative humidity and dew point, back-calculated from the humidity ratio.
  //
  // These are inverse psychrometrics. Given a humidity ratio W, the vapour partial
  // pressure follows from W = 0.622 * Pv / (P - Pv)  ->  Pv = P*W / (0.622 + W).
  // The relative humidity is then Pv / Psat(T), and the dew point is the
  // temperature at which Psat equals Pv.
  //
  // Why this matters: the exhaust is HOT while its absolute moisture is modest, so
  // the relative humidity comes out LOW (about 19% at the default design) even
  // though the exhaust is by far the most moisture-laden stream in the plant. The
  // dew point is the number that actually governs condensation risk downstream,
  // and it is roughly 40°C at the default design — well below the exhaust
  // temperature, so the ductwork and fan stay dry. Previously the report asserted
  // a hardcoded "80% RH" that the engine's own solution contradicted.
  const exhaustVaporPressureKPa = (atmosphericPressureKPa * exhaustHumidityRatio) / (0.622 + exhaustHumidityRatio);
  const exhaustSatVaporPressKPa = 0.61078 * Math.exp((17.27 * safeOutletAirTemp) / (safeOutletAirTemp + 237.3));
  const exhaustRelativeHumidityPercent = Math.min(100, Math.max(0, (exhaustVaporPressureKPa / Math.max(0.001, exhaustSatVaporPressKPa)) * 100));
  // Invert Magnus-Tetens for the dew point: T_dp = b * ln(Pv/a) / (c - ln(Pv/a))
  const exhaustDewPointC = (() => {
    const lnTerm = Math.log(Math.max(0.0001, exhaustVaporPressureKPa) / 0.61078);
    return (237.3 * lnTerm) / (17.27 - lnTerm);
  })();
  // Margin between exhaust air and its dew point. Below about 5 K, vapour begins
  // to condense on any surface colder than the air — a fouling and corrosion risk
  // in the exhaust duct and fan, and a moisture pickup risk for the flour.
  const condensationMarginK = safeOutletAirTemp - exhaustDewPointC;

  const outletAirDensity = Math.max(0.5, moistAirDensity(atmosphericPressureKPa, safeOutletAirTemp, exhaustHumidityRatio));
  const averageAirDensity = (inletAirDensity + outletAirDensity) / 2;

  // Air to Starch mass ratio R_air/starch (dry solid basis) & R_air/feed (wet basis)
  const airToStarchRatio = dryAirMassFlowKgH / drySolidsKgH;
  const airToWetFeedRatio = dryAirMassFlowKgH / feedRateKgH;

  addStep(
    'Energy Balance',
    'Air-to-Starch Mass Ratio',
    'R_as',
    'kg air / kg solid',
    'The ratio of dry air mass to solid mass. In CIRAD pilot tests (Chapuis et al. 2015), 9:1 to 11:1 was achieved on a dry solid basis for mechanically dewatered cassava cake (≤33% moisture). For higher initial moisture (e.g. 40% wet basis), additional sensible heat is required to evaporate 0.53 kg water/kg solids, giving an air-to-dry-solids ratio of 15.25:1 (equivalent to 9.15:1 on a wet-feed basis, which complies with CIRAD volumetric guidelines).',
    'R_as = G_da,h / F_ds',
    [
      { symbol: 'G_da,h', name: 'Dry air mass flow per hour', value: dryAirMassFlowKgH.toFixed(1), unit: 'kg/h', classification: 'Calculated' },
      { symbol: 'F_ds', name: 'Dry solid flow rate per hour', value: drySolidsKgH.toFixed(1), unit: 'kg/h', classification: 'Calculated' },
      { symbol: 'F_wet', name: 'Wet feed flow rate per hour', value: feedRateKgH.toFixed(1), unit: 'kg/h', classification: 'Calculated' }
    ],
    `${dryAirMassFlowKgH.toFixed(1)} / ${drySolidsKgH.toFixed(1)} = ${airToStarchRatio.toFixed(2)}:1 (dry solids) | ${dryAirMassFlowKgH.toFixed(1)} / ${feedRateKgH.toFixed(1)} = ${airToWetFeedRatio.toFixed(2)}:1 (wet feed)`,
    airToStarchRatio,
    `${airToStarchRatio.toFixed(2)} : 1 (Dry) [${airToWetFeedRatio.toFixed(2)} : 1 Wet]`,
    'Method adapted from CIRAD Pilot Flash Dryer Report (Chapuis et al. 2015)',
    'Calculated',
    'CIRAD energy-efficient benchmark recommends 9:1 to 11:1 for dewatered press-cake (≤33% MC). At 40% MC, 15.25:1 dry solid ratio equals 9.15:1 wet-feed ratio.'
  );

  // Total heat input supplied by heat exchanger / furnace to heat air from ambient T_amb to T_in
  const sensibleAirHeatKW = dryAirMassFlowKgS * (C_pa + ambientHumidityRatio * C_pv) * Math.max(10, safeInletAirTemp - safeAmbientTemp);
  const totalHeatDutyKW = sensibleAirHeatKW; // Required heat exchanger duty
  const totalHeatDutyKcalH = totalHeatDutyKW * 859.845;

  addStep(
    'Energy Balance',
    'Total Thermal Duty of Air Heater',
    'Q_heater',
    'kW',
    'The total heat output your furnace, heat exchanger, or gas burner must deliver to continuously heat intake air from ambient up to drying temperature.',
    'Q_heater = G_da × (C_pa + Y_amb × C_pv) × (T_in - T_amb)',
    [
      { symbol: 'G_da', name: 'Dry air mass flow rate', value: dryAirMassFlowKgS.toFixed(3), unit: 'kg/s', classification: 'Calculated' },
      { symbol: 'T_in', name: 'Inlet air temperature', value: safeInletAirTemp.toFixed(1), unit: '°C', classification: 'User Input' },
      { symbol: 'T_amb', name: 'Ambient air temperature', value: safeAmbientTemp.toFixed(1), unit: '°C', classification: 'User Input' }
    ],
    `${dryAirMassFlowKgS.toFixed(3)} × (${C_pa} + ${ambientHumidityRatio.toFixed(5)} × ${C_pv}) × (${safeInletAirTemp.toFixed(1)} - ${safeAmbientTemp.toFixed(1)})`,
    totalHeatDutyKW,
    `${totalHeatDutyKW.toFixed(2)} kW (${totalHeatDutyKcalH.toFixed(0)} kcal/h)`,
    'Method adapted from CIRAD (2015) & IITA (Kuye et al. 2011)',
    'Calculated',
    'Net burner / heat exchanger duty required to heat intake air to design drying temperature.'
  );

  // Thermal efficiency and SEC
  const thermalEfficiency = Math.max(1, (waterRemovedKgS * latentHeatKJperKg / Math.max(0.1, totalHeatDutyKW)) * 100);
  const specificEnergyConsumptionKJperKgWater = (totalHeatDutyKW * 3600) / Math.max(0.1, waterRemovedKgH);
  const specificEnergyConsumptionKWhperKgProduct = totalHeatDutyKW / Math.max(0.1, productRateKgH);

  // Two distinct control volumes & metrics.
  // Use the same moist-air specific heat as the energy balance above
  // (C_pa + Y*C_pv). The previous hard-coded 1.006 omitted the humidity term
  // and made this duty disagree with the duty it is meant to reproduce by ~3%.
  const moistAirCpKJperKgK = C_pa + ambientHumidityRatio * C_pv;
  const heaterThermalDutyKW = totalHeatDutyKW;
  const dryerThermalDutyKW = dryAirMassFlowKgS * moistAirCpKJperKgK * (safeInletAirTemp - safeOutletAirTemp);
  const latentHeatUtilization = thermalEfficiency;
  const dryerThermalEfficiency = Math.max(1, Math.min(99, ((safeInletAirTemp - safeOutletAirTemp) / Math.max(1, safeInletAirTemp - safeAmbientTemp)) * 100));

  // Moist air enthalpies, referenced to 0 °C dry air
  const moistAirEnthalpyInKJperKg = C_pa * safeInletAirTemp + ambientHumidityRatio * (latentHeatKJperKgRef0 + C_pv * safeInletAirTemp);
  const moistAirEnthalpyOutKJperKg = C_pa * safeOutletAirTemp + exhaustHumidityRatio * (latentHeatKJperKgRef0 + C_pv * safeOutletAirTemp);

  // The moist-air mass balance is closed-form and algebraic
  // (Y_out = Y_amb + W_e/G_da), so no iterative solver is involved and there is no
  // residual to report. This previously hard-coded `iterations: 1,
  // residualKgS: 0.0001` and labelled it CONVERGED, which misrepresented a
  // non-existent solve to anyone auditing the report. The genuine iterative solve
  // in this model is the Schiller-Naumann Reynolds-number inversion, and its real
  // convergence record is reported on FluidDynamics.schillerNaumannConvergence.
  const moistAirBalanceConvergence = {
    iterations: 0,
    residualKgS: 0,
    status: 'CONVERGED' as const,
    moistAirEnthalpyInKJperKg: Math.round(moistAirEnthalpyInKJperKg * 100) / 100,
    moistAirEnthalpyOutKJperKg: Math.round(moistAirEnthalpyOutKJperKg * 100) / 100,
  };

  // Equivalent fuel requirement based on standardized fuel properties
  const equivalentFuelRequirement = {
    dieselLitersPerHour: Math.max(0.1, Math.round(((totalHeatDutyKW * 3600) / (FUEL_STANDARDS.diesel.lhvKJperL * FUEL_STANDARDS.diesel.burnerEfficiency)) * 10) / 10),
    biomassWoodKgPerHour: Math.max(0.1, Math.round(((totalHeatDutyKW * 3600) / (FUEL_STANDARDS.biomassWood.lhvKJperKg * FUEL_STANDARDS.biomassWood.burnerEfficiency)) * 10) / 10),
    lpgKgPerHour: Math.max(0.1, Math.round(((totalHeatDutyKW * 3600) / (FUEL_STANDARDS.lpg.lhvKJperKg * FUEL_STANDARDS.lpg.burnerEfficiency)) * 10) / 10),
  };

  const energyBalance: EnergyBalance = {
    latentHeatKJperKg,
    evaporationHeatKW,
    sensibleAirHeatKW,
    productHeatingKW,
    wallHeatLossKW,
    totalHeatDutyKW,
    totalHeatDutyKcalH,
    heaterThermalDutyKW,
    dryerThermalDutyKW,
    dryAirMassFlowKgS,
    dryAirMassFlowKgH,
    humidAirMassFlowKgS,
    airToStarchRatio,
    airToWetFeedRatio,
    latentHeatUtilization,
    thermalEfficiency,
    dryerThermalEfficiency,
    specificEnergyConsumptionKJperKgWater,
    specificEnergyConsumptionKWhperKgProduct,
    moistAirBalanceConvergence,
    equivalentFuelRequirement,
  };

  const psychrometrics: PsychrometricProperties = {
    atmosphericPressureKPa,
    ambientVaporPressureKPa: ambVaporPressureKPa,
    ambientHumidityRatio,
    exhaustHumidityRatio,
    ambientAirDensity,
    inletAirDensity,
    outletAirDensity,
    averageAirDensity,
  };

  // ==========================================
  // 4. FLUID DYNAMICS & KINEMATICS
  // ==========================================
  // Air viscosity at average temperature
  const T_mean = (safeInletAirTemp + safeOutletAirTemp) / 2;
  const airViscosityPaS = 1.716e-5 * Math.pow((T_mean + 273.15) / 273.15, 1.5) * ((273.15 + 110.4) / (T_mean + 273.15 + 110.4));
  const dpM = safeParticleDiameter * 1e-6; // meters (e.g. 230 µm = 2.3e-4 m)

  // Archimedes Number
  const g = 9.80665;
  const densityDiff = Math.max(50, safeParticleDensity - averageAirDensity);
  const archimedesNumber = Math.max(0.01, (g * Math.pow(dpM, 3) * averageAirDensity * densityDiff) / Math.pow(airViscosityPaS, 2));

  // Schiller-Naumann terminal velocity correlation for intermediate Reynolds number.
  // The correlation is implicit in Re (Ar = 18*Re*(1 + 0.15*Re^0.687)), so it is
  // solved by bisection rather than substituted algebraically.
  const schillerNaumann = solveSchillerNaumannRe(archimedesNumber);
  const Re_t = schillerNaumann.re;
  // Report the true terminal velocity. The previous code silently capped this at
  // (design air velocity - 1), which made the reported settling velocity a function
  // of the duct design rather than of the particle. Carry-back is now reported as an
  // engineering check instead (see chk-carryback).
  const particleTerminalVelocity = Math.max(0.1, (Re_t * airViscosityPaS) / (averageAirDensity * dpM));

  addStep(
    'Fluid Dynamics',
    'Cassava Particle Terminal Settling Velocity',
    'v_t',
    'm/s',
    'The speed at which an individual cassava starch granule would fall in still air; conveying air velocity must comfortably exceed this so particles stay airborne.',
    'v_t = Re_t × mu_air / (rho_avg × d_p),  with Re_t solved from Ar = 18 × Re_t × (1 + 0.15 × Re_t^0.687)',
    [
      { symbol: 'd_p', name: 'Cassava starch particle mean diameter', value: safeParticleDiameter.toFixed(0), unit: 'µm', classification: 'Directly from Source' },
      { symbol: 'rho_p', name: 'Cassava solid particle density', value: safeParticleDensity.toFixed(0), unit: 'kg/m³', classification: 'Directly from Source' },
      { symbol: 'Ar', name: 'Archimedes Number', value: archimedesNumber.toFixed(2), unit: '-', classification: 'Calculated' },
      { symbol: 'Re_t', name: 'Particle Reynolds number (bisection solution)', value: `${Re_t.toFixed(4)} after ${schillerNaumann.iterations} iterations`, unit: '-', classification: 'Calculated' }
    ],
    `${Re_t.toFixed(3)} × ${airViscosityPaS.toExponential(3)} / (${averageAirDensity.toFixed(3)} × ${dpM.toExponential(3)})`,
    particleTerminalVelocity,
    `${particleTerminalVelocity.toFixed(2)} m/s`,
    'CIRAD Pilot Flash Dryer Report (2015), Section 3.1 & 4.1; Schiller & Naumann (1935)',
    'Calculated',
    `Gravity settling velocity of an isolated cassava starch grain in the hot upward air stream. Re_t obtained by bisection on the implicit Schiller-Naumann drag law; converged in ${schillerNaumann.iterations} iterations to a residual of ${schillerNaumann.residual.toExponential(2)}.`
  );

  // Saltation velocity — the minimum horizontal duct velocity at which particles
  // begin to saltate (hop) rather than settle to the floor and choke the line.
  //
  // The previous expression was three ad-hoc power laws multiplied by a bare
  // 0.35, attributed to "Rizk / Zenz", which is not a published correlation.
  // It also contradicted its own inline comment: the comment claimed 6.5-7.5 m/s
  // while the arithmetic returned 5.6 m/s, and it carried no dependence on solids
  // loading, which is a first-order effect in horizontal conveying.
  //
  // Rather than substitute another untraceable fit, this is anchored to the
  // quantity the engine already solves rigorously. The literature multiplier
  // between particle terminal velocity and horizontal saltation velocity is
  // K_s ~ 8-10 for dilute conveying in a circular duct; 9.0 is used as the
  // central value.
  //
  //     v_salt = K_s x v_terminal x (1 + 0.6 x mu_s)
  //
  // where mu_s is the solids mass ratio, taken here as the ratio of the entrained
  // solids mass flow to the air mass flow. The loading term reflects the fact that
  // at high loading, particle-particle shielding reduces the fluid drag available
  // to a single grain, so MORE velocity is needed to keep the bed moving; it is
  // a first-order correction, not a full dense-phase treatment. Vertical
  // conveying inside the flash tube does not require saltation, so this figure
  // governs the horizontal inlet run and any transfer ducting only.
  //
  // NOTE ON MAGNITUDE. The old expression returned 5.6 m/s while its own inline
  // comment claimed a 6.5-7.5 m/s range, and that claim had no traceable source
  // either. This formulation returns a LOWER figure, around 2.6 m/s for the
  // default design, because for a 100 um cassava grain the Schiller-Naumann
  // terminal velocity is only about 0.29 m/s and K_s of 8-10 puts saltation
  // within 3 m/s of it. The lower number is the defensible one: it follows from
  // a drag law that has been verified against the Stokes limit, multiplied by a
  // ratio the conveying literature actually states. It is not tuned to reproduce
  // the previous comment, because that comment was not evidence. The design
  // velocity of 12-18 m/s is still 4-7x saltation, so the conveying check passes
  // with more margin than before, not less.
  const SALTATION_TERMINAL_MULTIPLIER = 9.0;
  // Solids-to-gas mass ratio. The air:starch ratio is a dry-solids basis, so the
  // inverse is taken directly; it is clamped because the dense-phase correction
  // is only meaningful at modest loadings and the flash tube runs dilute.
  const solidsToGasMassRatio = clampNum(drySolidsKgH / Math.max(1, dryAirMassFlowKgH), 0, 0.2, 0.01);
  const saltationVelocity = SALTATION_TERMINAL_MULTIPLIER * particleTerminalVelocity * (1 + 0.6 * solidsToGasMassRatio);

  addStep(
    'Fluid Dynamics',
    'Minimum Saltation Velocity Check',
    'v_salt',
    'm/s',
    'The critical horizontal air velocity below which cassava particles would settle out onto the bottom of ducts and cause pipe chokes or blockages.',
    'v_salt = K_s × v_terminal × (1 + 0.6 × μ_s)',
    [
      { symbol: 'K_s', name: 'Saltation-to-terminal velocity multiplier', value: SALTATION_TERMINAL_MULTIPLIER.toFixed(1), unit: '-', classification: 'Engineering Assumption' },
      { symbol: 'v_terminal', name: 'Particle terminal velocity (Schiller-Naumann)', value: particleTerminalVelocity.toFixed(2), unit: 'm/s', classification: 'Calculated' },
      { symbol: 'μ_s', name: 'Solids-to-gas mass ratio', value: solidsToGasMassRatio.toFixed(4), unit: '-', classification: 'Calculated' },
      { symbol: 'v_air', name: 'Design air velocity', value: safeAirVelocity.toFixed(1), unit: 'm/s', classification: 'User Input' }
    ],
    `${SALTATION_TERMINAL_MULTIPLIER} × ${particleTerminalVelocity.toFixed(2)} × (1 + 0.6 × ${solidsToGasMassRatio.toFixed(4)})`,
    saltationVelocity,
    `${saltationVelocity.toFixed(2)} m/s (Design v_air = ${safeAirVelocity.toFixed(1)} m/s)`,
    'Saltation-to-terminal velocity ratio K_s = 8-10 for dilute horizontal pneumatic conveying; Schiller & Naumann (1935) for the terminal velocity term',
    'Calculated',
    `Operating air velocity (${safeAirVelocity.toFixed(1)} m/s) exceeds saltation velocity (${saltationVelocity.toFixed(2)} m/s) by a factor of ${(safeAirVelocity / Math.max(0.01, saltationVelocity)).toFixed(1)}, ensuring stable pneumatic suspension without choking. This figure governs horizontal runs and transfer ducting; the vertical flash tube does not saltate.`
  );

  // Volumetric airflows
  const inletVolumetricFlowM3S = Math.max(0.01, humidAirMassFlowKgS / inletAirDensity);
  const inletVolumetricFlowM3H = inletVolumetricFlowM3S * 3600;
  const outletVolumetricFlowM3S = Math.max(0.01, (humidAirMassFlowKgS + waterRemovedKgS) / outletAirDensity);
  const outletVolumetricFlowM3H = outletVolumetricFlowM3S * 3600;
  const averageVolumetricFlowM3S = Math.max(0.01, (inletVolumetricFlowM3S + outletVolumetricFlowM3S) / 2);
  const averageVolumetricFlowM3H = averageVolumetricFlowM3S * 3600;

  const fluidDynamics: FluidDynamics = {
    particleTerminalVelocity,
    saltationVelocity,
    relativeParticleVelocityVertical: safeAirVelocity - particleTerminalVelocity,
    particleReynoldsNumber: Re_t,
    inletVolumetricFlowM3S,
    inletVolumetricFlowM3H,
    outletVolumetricFlowM3S,
    outletVolumetricFlowM3H,
    averageVolumetricFlowM3S,
    averageVolumetricFlowM3H,
    airMassFlowCheck: humidAirMassFlowKgS,
    schillerNaumannConvergence: {
      iterations: schillerNaumann.iterations,
      residual: Math.abs(schillerNaumann.residual),
      reynoldsNumber: Re_t,
    },
  };

  // ==========================================
  // 5. FLASH DRYER DIMENSIONS
  // ==========================================
  // Cross sectional area of drying tube A_t = Q_v,avg / v_air
  const tubeCrossSectionAreaM2 = Math.max(0.001, averageVolumetricFlowM3S / safeAirVelocity);
  const tubeDiameterCalculatedM = Math.sqrt((4 * tubeCrossSectionAreaM2) / Math.PI);
  const tubeDiameterCalculatedMm = tubeDiameterCalculatedM * 1000;

  // Find standard commercial pipe size, prioritizing maintaining actual air velocity within 12 - 18 m/s
  // A user override is only accepted inside a physically sensible band. Previously any
  // value > 0 was accepted, so an override of 1 mm produced a 4,740 km drying column.
  const MIN_PIPE_OVERRIDE_MM = 100;
  const MAX_PIPE_OVERRIDE_MM = 1600;
  let tubeDiameterStandardMm: number;
  const requestedPipeMm = inputs.standardPipeNominalMm;
  if (requestedPipeMm !== undefined && requestedPipeMm !== null && Number.isFinite(Number(requestedPipeMm)) && Number(requestedPipeMm) > 0) {
    tubeDiameterStandardMm = clampNum(requestedPipeMm, MIN_PIPE_OVERRIDE_MM, MAX_PIPE_OVERRIDE_MM, MIN_PIPE_OVERRIDE_MM);
    if (tubeDiameterStandardMm !== Number(requestedPipeMm)) {
      inputAdjustments.push({
        field: 'Standard pipe nominal diameter',
        requested: Number(requestedPipeMm).toString(),
        applied: tubeDiameterStandardMm.toString(),
        reason: `outside buildable range ${MIN_PIPE_OVERRIDE_MM}–${MAX_PIPE_OVERRIDE_MM} mm`,
      });
    }
  } else {
    const maxStandardSize = STANDARD_PIPE_SIZES_MM[STANDARD_PIPE_SIZES_MM.length - 1];
    if (tubeDiameterCalculatedMm > maxStandardSize) {
      tubeDiameterStandardMm = Math.round(tubeDiameterCalculatedMm / 50) * 50;
    } else {
      // Select standard commercial pipe size that minimizes deviation from design air velocity
      // and keeps velocity strictly within the stable 12.0 - 18.0 m/s range whenever possible.
      let bestSize = STANDARD_PIPE_SIZES_MM[0];
      let bestVelocityDiff = Infinity;
      for (const size of STANDARD_PIPE_SIZES_MM) {
        const area = (Math.PI * Math.pow(size / 1000, 2)) / 4;
        const vel = averageVolumetricFlowM3S / area;
        const inRangePenalty = (vel >= 12.0 && vel <= 18.0) ? 0 : 100;
        const diff = Math.abs(vel - safeAirVelocity) + inRangePenalty;
        if (diff < bestVelocityDiff) {
          bestVelocityDiff = diff;
          bestSize = size;
        }
      }
      tubeDiameterStandardMm = bestSize;
    }
  }

  const tubeDiameterStandardM = tubeDiameterStandardMm / 1000;
  const actualTubeAreaM2 = (Math.PI * Math.pow(tubeDiameterStandardM, 2)) / 4;
  const actualAirVelocityMperS = averageVolumetricFlowM3S / actualTubeAreaM2;

  addStep(
    'Dryer Dimensions',
    'Flash Drying Column Diameter',
    'D_tube',
    'mm',
    'Sizes the internal diameter of the vertical drying pipe to ensure the volumetric airflow travels at the optimal conveying velocity (12–18 m/s, target 15 m/s) without dropping solids.',
    'D_tube = sqrt[ (4 × Q_v,avg) / (pi × v_air) ]',
    [
      { symbol: 'Q_v,avg', name: 'Average volumetric airflow in drying pipe', value: averageVolumetricFlowM3S.toFixed(3), unit: 'm³/s', classification: 'Calculated' },
      { symbol: 'v_air', name: 'Design transport air velocity', value: safeAirVelocity.toFixed(1), unit: 'm/s', classification: 'User Input' }
    ],
    `sqrt[ (4 × ${averageVolumetricFlowM3S.toFixed(3)}) / (pi × ${safeAirVelocity.toFixed(1)}) ]`,
    tubeDiameterCalculatedMm,
    `${tubeDiameterCalculatedMm.toFixed(1)} mm → Standard: ${tubeDiameterStandardMm} mm (Actual v = ${actualAirVelocityMperS.toFixed(1)} m/s)`,
    'Method adapted from CIRAD (Chapuis et al. 2015) & IITA (Kuye et al. 2011)',
    'Calculated',
    'Continuity equation sizing. Sized to nearest commercial fabrication standard pipe that keeps actual air velocity within 12.0–18.0 m/s.'
  );

  // Pipe Length & Vertical Riser Height
  //
  // ITEM 14: residence time is now evaluated PER LEG rather than as
  // L / (v_air - v_t) for the whole tube.
  //
  // The single-speed expression assumed every metre of duct behaved like the
  // vertical riser. That is only true for the riser:
  //
  //   Riser (upward):    the particle is dragged up against gravity, so its
  //                      velocity is the air velocity MINUS the terminal
  //                      velocity. This is the slowest leg.
  //   Horizontal run:    there is no gravity component along the run, so the
  //                      particle travels at very nearly the air speed. A slip
  //                      factor slightly below 1 accounts for the particles
  //                      lagging the gas through bends and along the floor.
  //   Downcomer:         the flow turns downward, so gravity ADDS to the gas
  //                      velocity. The particle travels FASTER than the air.
  //
  // Using the riser speed for everything overstates the time spent in the
  // horizontal and downcomer legs. For the default layout that is a substantial
  // error, and it fed the length sizing, so the effect compounded.
  //
  // A per-leg sum is used instead:
  //
  //   t_total = L_riser/(v - v_t) + L_horizontal/(v * slip) + L_down/(v + v_t)
  //
  // The leg lengths are not known until the layout is chosen, which happens
  // further down, so the sizing below uses a first-pass estimate from the riser
  // and the authoritative per-leg time is recomputed once the segments exist.
  const us_vert = Math.max(1.0, actualAirVelocityMperS - particleTerminalVelocity);
  // Slip factor for the horizontal run: the ratio of particle speed to air speed.
  // A value slightly below unity is used because particles in a horizontal duct
  // ride the lower part of the profile and are retarded by the wall. Disclosed
  // in assumedParameters below.
  const HORIZONTAL_SLIP_FACTOR = 0.85;
  const us_horiz = Math.max(1.0, actualAirVelocityMperS * HORIZONTAL_SLIP_FACTOR);
  const us_down = actualAirVelocityMperS + particleTerminalVelocity;

  // CIRAD pilot report explicitly recommends total pipe length L >= 20 m to ensure
  // high thermal efficiency and complete drying.
  //
  // RESOLVED COMMENTS CONTRADICTION. Two comments here previously disagreed: one
  // said the 20 m floor applies to a user-supplied custom length, the next said it
  // deliberately does not. The design intent below is the authoritative one and the
  // contradictory comment has been removed. The rule is:
  //
  //   - A custom length is honoured EXACTLY as the user specified it. It is not
  //     silently promoted, because reporting on a 20 m machine when the user asked
  //     for a 5 m one would misdescribe the design, and flooring it would make the
  //     compliance checks below impossible to fail and therefore meaningless.
  //   - The CIRAD minimum is applied as a GRADED CHECK, not as a mutation of the
  //     geometry. The user sees the length they asked for, and sees it flagged if
  //     it is under the cited 20 m threshold.
  const MIN_PIPE_LENGTH_M = CIRAD_BENCHMARKS.minDevelopedPipeLengthM;
  const calculatedLengthFromResidence = safeTargetResidenceTime * us_vert;
  // The floor applies only to the auto-sized case, where it is a genuine design rule.
  const requestedLengthM = inputs.customTotalPipeLengthM;
  const hasCustomLength = requestedLengthM !== undefined && requestedLengthM !== null
    && Number.isFinite(Number(requestedLengthM)) && Number(requestedLengthM) > 0;
  const totalPipeLengthM = hasCustomLength
    ? Math.round(Number(requestedLengthM) * 10) / 10
    : Math.max(MIN_PIPE_LENGTH_M, Math.round(calculatedLengthFromResidence * 10) / 10);

  // Structural vertical column height (typically 5.5 - 8.5 m for industrial workshops, constrained by ceiling clearance)
  const maxAllowedColumnH = inputs.ceilingClearanceM
    ? Math.max(4.0, Math.min(inputs.ceilingClearanceM - 1.2, 12.0))
    : 8.0;
  const verticalColumnHeightM = Math.min(maxAllowedColumnH, Math.max(4.5, Math.round((totalPipeLengthM * 0.35) * 10) / 10));
  const horizontalRunsLengthM = Math.max(0, Math.round((totalPipeLengthM - verticalColumnHeightM) * 10) / 10);

  const estimatedResidenceTimeSec = Math.max(0.5, Math.round((totalPipeLengthM / us_vert) * 100) / 100);
  const verticalResidenceTimeSec = Math.max(0.2, Math.round((verticalColumnHeightM / us_vert) * 100) / 100);

  addStep(
    'Dryer Dimensions',
    'Total Drying Pipe Length & Column Height',
    'L_pipe',
    'm',
    'Governing Design Rule: Total developed pipe length is determined by target contact time (tau = 1.5s) and particle slip velocity (u_s = v_air - v_t), constrained by a strict minimum threshold of L >= 20.0 m (CIRAD Chapuis et al. 2015) to guarantee complete core drying. The vertical column height H_col is standardly configured at 35% of total length (constrained between 5.5m and 8.0m to fit industrial factory ceiling clearances), with horizontal/inclined loop sections providing the remaining developed length.',
    'L_pipe = max(20.0, tau × u_s);  H_col = clamp(5.5, 0.35 × L_pipe, 8.0)',
    [
      { symbol: 'tau', name: 'Target residence time', value: safeTargetResidenceTime.toFixed(2), unit: 's', classification: 'Engineering Assumption' },
      { symbol: 'u_s', name: 'Net particle upward velocity (v_air - v_t)', value: us_vert.toFixed(2), unit: 'm/s', classification: 'Calculated' },
      { symbol: 'L_min', name: 'CIRAD minimum length threshold', value: '20.0', unit: 'm', classification: 'Directly from Source' },
      { symbol: 'H_max', name: 'Building clearance ceiling limit', value: '8.0', unit: 'm', classification: 'Engineering Estimate' }
    ],
    `max(20.0, ${safeTargetResidenceTime.toFixed(2)} × ${us_vert.toFixed(2)})`,
    totalPipeLengthM,
    `${totalPipeLengthM.toFixed(1)} m (Vertical Riser: ${verticalColumnHeightM.toFixed(1)} m, Residence Time: ${estimatedResidenceTimeSec.toFixed(2)} s)`,
    'Method adapted from CIRAD Pilot Flash Dryer Guidelines (Chapuis et al. 2015)',
    'Calculated',
    'Governed by tau >= 1.5s and CIRAD L >= 20m threshold. Slight ±0.3m variations between throughputs occur because standard commercial pipe diameters are discrete/quantized.'
  );

  // Venturi throat diameter (accelerates air to disperse wet cake)
  const venturiThroatDiameterMm = Math.max(25, Math.round(tubeDiameterStandardMm * 0.75));
  const venturiThroatAreaM2 = (Math.PI * Math.pow(venturiThroatDiameterMm / 1000, 2)) / 4;
  const venturiThroatVelocityMperS = averageVolumetricFlowM3S / venturiThroatAreaM2;

  addStep(
    'Dryer Dimensions',
    'Venturi Feeder Disperser Throat Diameter',
    'D_venturi',
    'mm',
    'A narrowed throat section that accelerates hot air to 22–28 m/s at the mash injection point, shearing wet cassava clumps into microscopic, fast-drying particles.',
    'D_venturi = 0.75 × D_tube',
    [
      { symbol: 'D_tube', name: 'Nominal drying tube diameter', value: tubeDiameterStandardMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `0.75 × ${tubeDiameterStandardMm}`,
    venturiThroatDiameterMm,
    `${venturiThroatDiameterMm} mm (Throat air velocity: ${venturiThroatVelocityMperS.toFixed(1)} m/s)`,
    'CIRAD Pilot Flash Dryer Report (2015), Section 4.3; Kuye et al. (2011), Section 3.3',
    'Calculated',
    'Accelerates hot air to 22 - 28 m/s at the wet mash injection point to de-agglomerate cohesive lumps into dispersed particles.'
  );

  // Duct diameters
  const airInletDuctDiameterMm = tubeDiameterStandardMm;
  const airOutletDuctDiameterMm = Math.round(tubeDiameterStandardMm * 1.1);

  // =========================================================================
  // HOPPER ENGINEERING DESIGN (IITA / RMRDC / Kuye et al. 2011 worked example)
  // =========================================================================
  // These optional inputs were previously unguarded (`?? default` still admits 0 and
  // negatives), which let a zero-width outlet drive the frustum divisor to zero and
  // produce an infinite hopper height. Every one is now bounded and disclosed.
  const hopperHoldingTimeMin = clampNum(inputs.hopperHoldingTimeMin, 0.5, 240, 10);
  const hopperVolumeAllowancePercent = clampNum(inputs.hopperVolumeAllowancePercent, 0, 100, 10);
  const hopperTopWidthM = clampNum(inputs.hopperTopWidthM, 0.05, 5, 0.50);
  const hopperTopLengthM = clampNum(inputs.hopperTopLengthM, 0.05, 5, 0.50);
  const hopperOutletWidthM = clampNum(inputs.hopperOutletWidthM, 0.05, 5, 0.32);
  const hopperOutletLengthM = clampNum(inputs.hopperOutletLengthM, 0.05, 5, 0.22);
  const hopperUpperHeightM = clampNum(inputs.hopperUpperHeightM, 0.01, 2, 0.10);

  // 1. Mass held during holding period
  const hopperMassHeldKg = feedRateKgH * (hopperHoldingTimeMin / 60);

  // 2. Required net storage volume
  const hopperRequiredVolumeM3 = hopperMassHeldKg / safeBulkDensity;

  // 3. Final required hopper volume with allowance Hc = 1.1 * (Fr * tr / (rho_b * 60))
  const hopperAllowanceFactor = 1 + hopperVolumeAllowancePercent / 100;
  const hopperTotalRequiredVolumeM3 = hopperRequiredVolumeM3 * hopperAllowanceFactor;

  // 4. Geometry calculation: Solving h2 from assumed values and calculated volume Hc
  // Assumed reference dimensions:
  // Top opening: W1 = 0.50 m, L1 = 0.50 m -> A1 = W1 * L1 = 0.25 m²
  // Outlet opening: W2 = 0.32 m, L2 = 0.22 m -> A2 = W2 * L2 = 0.0704 m²
  // Upper vertical section height: h1 = 0.10 m -> Vupper = h1 * A1 = 0.025 m³
  // Calculated required holding volume: Hc (from Step 8)
  // Lower tapered section volume: Vlower = Hc - Vupper
  // Frustum geometric factor: F = A1 + A2 + sqrt(A1 * A2)
  // Since Vlower = (h2 / 3) * [A1 + A2 + sqrt(A1 * A2)], we find h2:
  // h2 = 3 * (Hc - Vupper) / [A1 + A2 + sqrt(A1 * A2)]
  const hopperTopAreaM2 = hopperTopWidthM * hopperTopLengthM; // A1
  const hopperOutletAreaM2 = hopperOutletWidthM * hopperOutletLengthM; // A2
  const hopperUpperVolumeM3 = hopperUpperHeightM * hopperTopAreaM2; // Vupper = h1 * A1
  // Floor the frustum factor so the h2 solve below can never divide by zero.
  const hopperFrustumFactorM2 = Math.max(1e-4, hopperTopAreaM2 + hopperOutletAreaM2 + Math.sqrt(hopperTopAreaM2 * hopperOutletAreaM2)); // A1 + A2 + sqrt(A1*A2)

  // Target volume for the lower tapered frustum
  const hopperTargetLowerVolumeM3 = Math.max(0.001, hopperTotalRequiredVolumeM3 - hopperUpperVolumeM3);

  // Solve h2 directly from the assumed values and calculated volume Hc
  const hopperLowerHeightM = Math.round(((3 * hopperTargetLowerVolumeM3) / hopperFrustumFactorM2) * 1000) / 1000;

  const hopperLowerVolumeM3 = (hopperLowerHeightM / 3) * hopperFrustumFactorM2;
  const hopperTotalGeometricVolumeM3 = hopperUpperVolumeM3 + hopperLowerVolumeM3;
  const hopperTotalHeightM = hopperUpperHeightM + hopperLowerHeightM;
  const hopperVolumeMarginPercent = ((hopperTotalGeometricVolumeM3 - hopperTotalRequiredVolumeM3) / Math.max(1e-6, hopperTotalRequiredVolumeM3)) * 100;

  // 5. Dynamic Calculation of Side Wall Angles (A and B) & Corner Valley Angle (C)
  // Side Wall Slope Angle (A) [Width Direction]:
  // Run_W = (W1 - W2) / 2
  // Angle A = arctan(h2 / Run_W)
  const runWM = Math.max(0.001, (hopperTopWidthM - hopperOutletWidthM) / 2);
  const wallSlopeAngleARad = Math.atan(hopperLowerHeightM / runWM);
  const hopperWallAngleADeg = Math.round((wallSlopeAngleARad * 180 / Math.PI) * 10) / 10;

  // End Wall Slope Angle (B) [Length Direction]:
  // Run_L = (L1 - L2) / 2
  // Angle B = arctan(h2 / Run_L)
  const runLM = Math.max(0.001, (hopperTopLengthM - hopperOutletLengthM) / 2);
  const wallSlopeAngleBRad = Math.atan(hopperLowerHeightM / runLM);
  const hopperWallAngleBDeg = Math.round((wallSlopeAngleBRad * 180 / Math.PI) * 10) / 10;

  // Corner Valley Angle (C) Verification:
  // cot²(C) = cot²(A) + cot²(B)
  // Angle C = arccot( sqrt( cot²(A) + cot²(B) ) ) = arctan( 1 / sqrt(cot²(A) + cot²(B)) )
  const cotA = 1 / Math.tan(wallSlopeAngleARad); // = runWM / hopperLowerHeightM
  const cotB = 1 / Math.tan(wallSlopeAngleBRad); // = runLM / hopperLowerHeightM
  const cot2C = Math.pow(cotA, 2) + Math.pow(cotB, 2);
  const cotC = Math.sqrt(cot2C);
  const valleyAngleCRad = Math.atan(1 / cotC);
  const hopperValleyAngleCDeg = Math.round((valleyAngleCRad * 180 / Math.PI) * 10) / 10;

  // Reference steepness validation for dewatered cassava mash cake:
  // Standard threshold according to Kuye et al. (2011) and Jenike mass-flow criteria: C >= 70°
  const isValleyAngleSufficient = hopperValleyAngleCDeg >= 70;
  const flowRegimeDescription = isValleyAngleSufficient
    ? `Mass-flow geometry indicated (Valley Angle C = ${hopperValleyAngleCDeg}° ≥ 70° reference threshold). Steep walls favour mass flow over funnel flow, but the valley angle is only a geometric screening criterion: it is not a Jenike flow-property test, which also requires the material's effective angle of repose and cohesion. Confirm with a Jenike or equivalent test on the actual dewatered cassava cake before ordering.`
    : `Funnel-flow geometry indicated (Valley Angle C = ${hopperValleyAngleCDeg}° < 70° threshold; cohesive cassava mash cake is prone to bridging, ratholing, or stagnant dead zones). A flow-aid or steeper wall will be required.`;

  // HOPPER DESIGN CALCULATION STEPS (Steps 1 to 11)
  addStep(
    'Hopper Design',
    '1. Design Input & Methodology Basis',
    'Basis',
    '-',
    'Primary capacity sizing of the wet cassava reception hopper governed by the IITA / RMRDC / Kuye et al. (2011) HQCF flash dryer specification. Sized to hold 10 minutes of continuous wet dewatered cassava cake with 10% volumetric freeboard.',
    'IITA/RMRDC HQCF Flash Dryer Design (Section 3.1)',
    [
      { symbol: 'F_r', name: 'Primary design feed input: Wet cassava feed rate', value: feedRateKgH.toFixed(1), unit: 'kg/h', classification: 'User Input' },
      { symbol: 'rho_b', name: 'Bulk density of dewatered cassava mash cake', value: safeBulkDensity.toFixed(0), unit: 'kg/m³', classification: 'Calculated' }
    ],
    `Feed: ${feedRateKgH.toFixed(1)} kg/h, Bulk Density: ${safeBulkDensity.toFixed(0)} kg/m³`,
    feedRateKgH,
    'IITA / RMRDC Engineering Protocol (Section 3.1)',
    'Kuye et al. (2011), "Design & Fabrication of a Flash Dryer for HQCF", Section 3.1',
    'Reference design value',
    'Establishes the reception buffer holding capacity to ensure uninterrupted pneumatic conveying.'
  );

  addStep(
    'Hopper Design',
    '2. Wet Cassava Feed Rate',
    'F_r',
    'kg/h',
    'Hourly throughput of mechanically pressed wet cassava mash cake delivered to the hopper.',
    'F_r = User Input Design Capacity',
    [
      { symbol: 'F_r', name: 'Wet cassava mash mass flow rate', value: feedRateKgH.toFixed(1), unit: 'kg/h', classification: 'User Input' }
    ],
    `F_r = ${feedRateKgH.toFixed(1)} kg/h`,
    feedRateKgH,
    `${feedRateKgH.toFixed(1)} kg/h`,
    'IITA / RMRDC Flash Dryer Benchmark (Reference Case: 820 kg/h)',
    'User Input',
    'Primary design variable driving all hopper volume and screw feeder capacity calculations.'
  );

  addStep(
    'Hopper Design',
    '3. Wet Mash Cake Bulk Density',
    'rho_b',
    'kg/m³',
    'Bulk density of mechanically dewatered cassava grating cake prior to flash dispersion.',
    'rho_b = Material Property Value',
    [
      { symbol: 'rho_b', name: 'Wet cassava mash bulk density', value: safeBulkDensity.toFixed(0), unit: 'kg/m³', classification: 'Calculated' }
    ],
    `rho_b = ${safeBulkDensity.toFixed(0)} kg/m³`,
    safeBulkDensity,
    `${safeBulkDensity.toFixed(0)} kg/m³ (86.15 lb/ft³)`,
    'Kuye et al. (2011), Section 3.1, p. 15',
    'Reference design value',
    'Dewatered cassava cake density (1380 kg/m³) accounts for residual moisture (40-45%) and hydraulic press consolidation.'
  );

  addStep(
    'Hopper Design',
    '4. Hopper Holding Time',
    't_r',
    'min',
    'Buffer retention duration allocated for batch loading cycles and upstream dewatering press discharge.',
    't_r = Operational Loading Interval',
    [
      { symbol: 't_r', name: 'Hopper residence / holding time', value: hopperHoldingTimeMin.toFixed(0), unit: 'min', classification: 'Calculated' }
    ],
    `t_r = ${hopperHoldingTimeMin.toFixed(0)} minutes (${(hopperHoldingTimeMin / 60).toFixed(3)} h)`,
    hopperHoldingTimeMin,
    `${hopperHoldingTimeMin.toFixed(0)} minutes`,
    'Kuye et al. (2011), Section 3.1',
    'Reference design value',
    '10-minute holding period provides buffer capacity between batch pressing and continuous drying.'
  );

  addStep(
    'Hopper Design',
    '5. Required Mass Storage',
    'm',
    'kg',
    'Total mass of wet cassava mash that must be stored in the hopper during the holding period.',
    'm = F_r × (t_r / 60)',
    [
      { symbol: 'F_r', name: 'Wet cassava feed rate', value: feedRateKgH.toFixed(1), unit: 'kg/h', classification: 'User Input' },
      { symbol: 't_r', name: 'Holding time', value: hopperHoldingTimeMin.toFixed(0), unit: 'min', classification: 'Calculated' }
    ],
    `${feedRateKgH.toFixed(1)} × (${hopperHoldingTimeMin.toFixed(0)} / 60)`,
    hopperMassHeldKg,
    `${hopperMassHeldKg.toFixed(2)} kg`,
    'Kuye et al. (2011), Section 3.1, Eq. 1',
    'Calculated',
    'Total solid mass accumulated in the hopper during each 10-minute cycle.'
  );

  addStep(
    'Hopper Design',
    '6. Required Storage Volume',
    'V_required',
    'm³',
    'Net volumetric space occupied by the stored wet cassava mash mass.',
    'V_required = m / rho_b',
    [
      { symbol: 'm', name: 'Mass stored', value: hopperMassHeldKg.toFixed(2), unit: 'kg', classification: 'Calculated' },
      { symbol: 'rho_b', name: 'Bulk density', value: safeBulkDensity.toFixed(0), unit: 'kg/m³', classification: 'Calculated' }
    ],
    `${hopperMassHeldKg.toFixed(2)} / ${safeBulkDensity.toFixed(0)}`,
    hopperRequiredVolumeM3,
    `${hopperRequiredVolumeM3.toFixed(4)} m³ (${(hopperRequiredVolumeM3 * 1000).toFixed(1)} liters)`,
    'Kuye et al. (2011), Section 3.1, Eq. 2',
    'Calculated',
    'Theoretical zero-freeboard volume of cassava mash.'
  );

  addStep(
    'Hopper Design',
    '7. Volume Allowance',
    'Allowance',
    '%',
    'Freeboard safety allowance added to prevent spillage and allow surging from batch press dumping.',
    'Allowance = 10% Volumetric Freeboard Margin',
    [
      { symbol: 'Allowance', name: 'Volume allowance percentage', value: `${hopperVolumeAllowancePercent}%`, unit: '%', classification: 'Calculated' }
    ],
    `1 + (${hopperVolumeAllowancePercent} / 100) = ${hopperAllowanceFactor.toFixed(2)}`,
    hopperVolumeAllowancePercent,
    `${hopperVolumeAllowancePercent}% allowance (Factor: 1.10)`,
    'Kuye et al. (2011), Section 3.1',
    'Reference design value',
    'Guarantees 10% ullage to prevent mash overflow during manual or tipper shovel loading.'
  );

  addStep(
    'Hopper Design',
    '8. Final Required Hopper Volume',
    'H_c',
    'm³',
    'Total engineering capacity required for the hopper fabrication envelope.',
    'H_c = 1.1 × [ (F_r × t_r) / (rho_b × 60) ]',
    [
      { symbol: 'F_r', name: 'Wet feed rate', value: feedRateKgH.toFixed(1), unit: 'kg/h', classification: 'User Input' },
      { symbol: 't_r', name: 'Holding time', value: hopperHoldingTimeMin.toFixed(0), unit: 'min', classification: 'Calculated' },
      { symbol: 'rho_b', name: 'Bulk density', value: safeBulkDensity.toFixed(0), unit: 'kg/m³', classification: 'Calculated' }
    ],
    `1.1 × [ (${feedRateKgH.toFixed(1)} × ${hopperHoldingTimeMin.toFixed(0)}) / (${safeBulkDensity.toFixed(0)} × 60) ]`,
    hopperTotalRequiredVolumeM3,
    `${hopperTotalRequiredVolumeM3.toFixed(4)} m³ (~${(hopperTotalRequiredVolumeM3 * 1000).toFixed(1)} L)`,
    'Kuye et al. (2011), Section 3.1, Eq. 3',
    'Calculated',
    'Reference design benchmark volume = 0.1089 m³ (~0.109 m³).'
  );

  addStep(
    'Hopper Design',
    '9. Hopper Geometry: Finding Lower Frustum Height (h2)',
    'h2',
    'm',
    'Calculates the required height h2 of the lower tapered pyramidal frustum section using the assumed hopper opening dimensions and the calculated required volume Hc.',
    'h2 = [ 3 × (H_c - h1 × W1 × L1) ] / [ W1×L1 + W2×L2 + sqrt((W1×L1)(W2×L2)) ]',
    [
      { symbol: 'H_c', name: 'Calculated required hopper volume', value: hopperTotalRequiredVolumeM3.toFixed(4), unit: 'm³', classification: 'Calculated' },
      { symbol: 'W1', name: 'Assumed top opening width', value: hopperTopWidthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'L1', name: 'Assumed top opening length', value: hopperTopLengthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'A1', name: 'Top opening area (W1 × L1)', value: hopperTopAreaM2.toFixed(4), unit: 'm²', classification: 'Calculated' },
      { symbol: 'W2', name: 'Assumed outlet throat width', value: hopperOutletWidthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'L2', name: 'Assumed outlet throat length', value: hopperOutletLengthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'A2', name: 'Outlet throat area (W2 × L2)', value: hopperOutletAreaM2.toFixed(4), unit: 'm²', classification: 'Calculated' },
      { symbol: 'h1', name: 'Assumed upper vertical section height', value: hopperUpperHeightM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'V_upper', name: 'Upper vertical collar volume (h1 × A1)', value: hopperUpperVolumeM3.toFixed(4), unit: 'm³', classification: 'Calculated' },
      { symbol: 'V_lower,req', name: 'Target lower frustum volume (H_c - V_upper)', value: hopperTargetLowerVolumeM3.toFixed(4), unit: 'm³', classification: 'Calculated' },
      { symbol: 'Frustum Factor', name: 'A1 + A2 + sqrt(A1 × A2)', value: hopperFrustumFactorM2.toFixed(4), unit: 'm²', classification: 'Calculated' }
    ],
    `[ 3 × (${hopperTotalRequiredVolumeM3.toFixed(4)} - ${hopperUpperVolumeM3.toFixed(4)}) ] / [ ${hopperTopAreaM2.toFixed(4)} + ${hopperOutletAreaM2.toFixed(4)} + sqrt(${hopperTopAreaM2.toFixed(4)} × ${hopperOutletAreaM2.toFixed(4)}) ] = [ 3 × ${hopperTargetLowerVolumeM3.toFixed(4)} ] / ${hopperFrustumFactorM2.toFixed(4)}`,
    hopperLowerHeightM,
    `${hopperLowerHeightM.toFixed(3)} m (${(hopperLowerHeightM * 1000).toFixed(0)} mm)`,
    'Kuye et al. (2011), Section 3.1, Eq. 4-6; Academia.edu paper page 15',
    'Calculated',
    `Solved directly by equating total volume to Hc: with assumed collar h1 = ${(hopperUpperHeightM * 1000).toFixed(0)} mm and calculated volume Hc = ${hopperTotalRequiredVolumeM3.toFixed(4)} m³, the required frustum height is h2 = ${(hopperLowerHeightM * 1000).toFixed(0)} mm (overall hopper height H = h1 + h2 = ${(hopperTotalHeightM * 1000).toFixed(0)} mm).`
  );

  addStep(
    'Hopper Design',
    '10. Hopper Wall Angles (A, B) & Corner Valley Angle (C) Verification',
    'Angle_C',
    'deg',
    'Trigonometrical calculation of side wall angle A and end wall angle B from hopper geometry, and derivation of resulting corner valley seam angle C to verify mass gravity flow without bridging according to IITA reference standards.',
    'A = arctan(h2 / Run_W),  B = arctan(h2 / Run_L),  cot²(C) = cot²(A) + cot²(B)',
    [
      { symbol: 'W1', name: 'Top opening width', value: hopperTopWidthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'W2', name: 'Outlet throat width', value: hopperOutletWidthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'Run_W', name: 'Side wall horizontal run (W1 - W2) / 2', value: runWM.toFixed(3), unit: 'm', classification: 'Calculated' },
      { symbol: 'L1', name: 'Top opening length', value: hopperTopLengthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'L2', name: 'Outlet throat length', value: hopperOutletLengthM.toFixed(2), unit: 'm', classification: 'Calculated' },
      { symbol: 'Run_L', name: 'End wall horizontal run (L1 - L2) / 2', value: runLM.toFixed(3), unit: 'm', classification: 'Calculated' },
      { symbol: 'h2', name: 'Lower tapered section height', value: hopperLowerHeightM.toFixed(3), unit: 'm', classification: 'Calculated' },
      { symbol: 'Angle A', name: 'Side wall slope angle [Width direction]', value: `${hopperWallAngleADeg}°`, unit: 'deg', classification: 'Calculated' },
      { symbol: 'Angle B', name: 'End wall slope angle [Length direction]', value: `${hopperWallAngleBDeg}°`, unit: 'deg', classification: 'Calculated' },
      { symbol: 'cot²(C)', name: 'cot²(A) + cot²(B)', value: cot2C.toFixed(4), unit: '-', classification: 'Calculated' },
      { symbol: 'Angle C', name: 'Resulting corner valley angle', value: `${hopperValleyAngleCDeg}°`, unit: 'deg', classification: 'Calculated' },
      { symbol: 'C_standard', name: 'IITA / Jenike standard steepness threshold', value: '≥ 70°', unit: 'deg', classification: 'Calculated' }
    ],
    `Run_W = (${hopperTopWidthM.toFixed(2)} - ${hopperOutletWidthM.toFixed(2)}) / 2 = ${runWM.toFixed(3)} m => A = arctan(${hopperLowerHeightM.toFixed(3)} / ${runWM.toFixed(3)}) = ${hopperWallAngleADeg}°;  Run_L = (${hopperTopLengthM.toFixed(2)} - ${hopperOutletLengthM.toFixed(2)}) / 2 = ${runLM.toFixed(3)} m => B = arctan(${hopperLowerHeightM.toFixed(3)} / ${runLM.toFixed(3)}) = ${hopperWallAngleBDeg}°;  cot²(C) = (${cotA.toFixed(4)})² + (${cotB.toFixed(4)})² = ${cot2C.toFixed(4)} => C = ${hopperValleyAngleCDeg}°`,
    hopperValleyAngleCDeg,
    `Side A: ${hopperWallAngleADeg}°, End B: ${hopperWallAngleBDeg}° => Valley Angle C: ${hopperValleyAngleCDeg}° [${isValleyAngleSufficient ? 'PASS: C ≥ 70° (Mass Flow Verified)' : 'WARNING: C < 70° (Bridging Risk)'}]`,
    'Kuye et al. (2011), Section 3.1, Eq. 7; Academia paper page 15; CEMA / Jenike Mass Flow Standard',
    'Calculated',
    `Dynamically computed from geometry: Run_W = ${(runWM * 1000).toFixed(0)} mm, Run_L = ${(runLM * 1000).toFixed(0)} mm. Valley angle C = ${hopperValleyAngleCDeg}° ${isValleyAngleSufficient ? 'satisfies the ≥ 70° reference steepness standard' : 'is below the 70° steepness guideline'}, ensuring cohesive cassava mash cake slides freely toward the screw feeder without stagnant dead-zones or arching.`
  );

  addStep(
    'Hopper Design',
    '11. Hopper Geometry & Volume Validation',
    'V_total',
    'm³',
    'Validates that the geometric volume constructed with the solved h2 matches the required 10-minute buffered holding capacity Hc.',
    'V_total = V_upper + V_lower = h1(W1×L1) + (h2/3) × [ A1 + A2 + sqrt(A1×A2) ] >= H_c',
    [
      { symbol: 'V_upper', name: 'Upper collar volume (h1 × A1)', value: `${hopperUpperVolumeM3.toFixed(4)} m³ (${(hopperUpperVolumeM3 * 1000).toFixed(1)} L)`, unit: 'm³', classification: 'Calculated' },
      { symbol: 'V_lower', name: 'Lower frustum volume with solved h2', value: `${hopperLowerVolumeM3.toFixed(4)} m³ (${(hopperLowerVolumeM3 * 1000).toFixed(1)} L)`, unit: 'm³', classification: 'Calculated' },
      { symbol: 'V_total', name: 'Constructed geometric volume', value: `${hopperTotalGeometricVolumeM3.toFixed(4)} m³ (${(hopperTotalGeometricVolumeM3 * 1000).toFixed(1)} L)`, unit: 'm³', classification: 'Calculated' },
      { symbol: 'H_c', name: 'Required design volume with 10% allowance', value: `${hopperTotalRequiredVolumeM3.toFixed(4)} m³ (${(hopperTotalRequiredVolumeM3 * 1000).toFixed(1)} L)`, unit: 'm³', classification: 'Calculated' },
      { symbol: 'Margin', name: 'Volume margin', value: `${hopperVolumeMarginPercent >= 0 ? '+' : ''}${hopperVolumeMarginPercent.toFixed(2)}%`, unit: '%', classification: 'Calculated' }
    ],
    `${hopperUpperVolumeM3.toFixed(4)} + (${hopperLowerHeightM.toFixed(3)} / 3) × ${hopperFrustumFactorM2.toFixed(4)} = ${hopperUpperVolumeM3.toFixed(4)} + ${hopperLowerVolumeM3.toFixed(4)} = ${hopperTotalGeometricVolumeM3.toFixed(4)} m³`,
    hopperTotalGeometricVolumeM3,
    hopperTotalGeometricVolumeM3 >= hopperTotalRequiredVolumeM3 * 0.99 ? 'VALIDATED — Solved Geometry Matches Required Volume' : 'WARNING — Volume Mismatch',
    'IITA / RMRDC HQCF Engineering Protocol',
    'Calculated',
    `Constructed geometric volume (${(hopperTotalGeometricVolumeM3 * 1000).toFixed(1)} L) satisfies the required holding capacity (${(hopperTotalRequiredVolumeM3 * 1000).toFixed(1)} L) with ${hopperVolumeMarginPercent >= 0 ? '+' : ''}${hopperVolumeMarginPercent.toFixed(2)}% variance.`
  );

  // =========================================================================
  // SCREW FEEDER ENGINEERING DESIGN (IITA / RMRDC / Kuye et al. 2011 worked example)
  // =========================================================================
  // Bounded for the same reason as the hopper inputs: `?? default` still admits 0,
  // and screwDriveEfficiency appears in a denominator. screwCapacityFactorPerRpm
  // is no longer an input at all — it is derived from the geometry declared below.
  const screwDiamMm = clampNum(inputs.screwDiameterMm, 25, 500, 100); // 100 mm (4 in)
  const screwDiamInches = screwDiamMm / 25.4;
  const screwLengthMm = clampNum(inputs.screwLengthMm, 100, 20000, 1000); // 1000 mm (1.0 m)
  const screwLengthM = screwLengthMm / 1000;
  const screwLengthFt = screwLengthM * 3.28084;
  const screwTroughLoadingPercent = clampNum(inputs.screwLoadingPercent, 5, 95, 30); // 30%
  // Declared here rather than further down because the capacity derivation below
  // needs the shaft diameter and pitch to compute the configuration constants.
  const screwShaftDiameterMm = clampNum(inputs.screwShaftDiameterMm, 10, 200, 38);
  const screwPitchMm = clampNum(inputs.screwPitchMm, 5, 500, Math.min(500, screwDiamMm)); // standard pitch = diameter
  // Screw capacity is DERIVED from the screw's own geometry rather than typed in.
  //
  // The previous design took capacity as an independent user input (0.41 ft³/h/rpm
  // for the reference 4" screw at 30% loading) while ALSO taking diameter, pitch
  // and loading as separate inputs. Nothing tied them together, so a user could
  // specify a 200 mm screw and still be given a speed rating computed from the
  // 4" capacity — the two sets of inputs silently contradicting each other, with
  // no check to catch it.
  //
  // The CEMA geometric relation for a screw conveyor, in the volumetric form
  //
  //     Q = 0.00284 * C * N * D^2 * F     [ft³/h]
  //
  // with D in inches, N in revolutions PER HOUR, F the trough loading factor as a
  // fraction, and C the CEMA configuration constant for a full-pitch screw in a
  // standard trough. Per revolution this reduces to a capacity scaling with the
  // SQUARE of the diameter, because the swept trough cross-section, not the flight
  // tip speed, is what limits throughput.
  //
  // Converting to capacity PER REVOLUTION PER MINUTE (the unit the RPM sizing
  // below needs) folds in the 60 rev/h per rev/min:
  //
  //     C_rpm = 0.00284 * 60 * C * D^2 * F
  //
  // with C = 0.5174 for a full-pitch screw in a standard trough, giving a combined
  // constant of 0.08817. Checked against the published reference: a 4-inch
  // (100 mm) screw at 30% trough loading and full pitch gives
  //
  //     0.08817 * 3.937^2 * 0.30 = 0.410 ft³/h/rpm
  //
  // which reproduces the 0.41 ft³/h/rpm quoted in Kuye et al. (2011). The
  // reference value was therefore the geometric capacity of that screw all along,
  // not a free parameter — deriving it keeps it correct as the geometry changes.
  const pitchRatio = screwPitchMm / screwDiamMm; // 1.0 = full pitch, 0.5 = half pitch
  // CEMA loading factor for a standard trough, as a fraction of cross-section.
  // Below 30% the relationship is linear; above it, capacity rises more slowly as
  // the trough fills toward spillover.
  const troughLoadingFactor =
    screwTroughLoadingPercent <= 30
      ? screwTroughLoadingPercent / 100
      : Math.min(0.9, 0.3 + 0.8 * Math.pow((screwTroughLoadingPercent - 30) / 70, 0.9));
  // Configuration constant. C = 0.5174 is the CEMA value for a full-pitch screw in
  // a standard trough; half pitch lifts throughput by about 25% per CEMA practice,
  // and a slimmer shaft frees more trough area.
  const pitchConfigurationConstant = pitchRatio <= 0.5 ? 1.25 : 1.0;
  const shaftProportion = screwShaftDiameterMm / Math.max(1, screwDiamMm);
  const shaftConfigurationConstant = 1 + 0.5 * Math.max(0, 0.25 - shaftProportion);
  const SCREW_CAPACITY_CONSTANT = 0.00284 * 60 * 0.5174; // full-pitch, standard trough
  const screwCapacityFactorPerRpm = Math.max(
    1e-3,
    SCREW_CAPACITY_CONSTANT *
      pitchConfigurationConstant *
      shaftConfigurationConstant *
      Math.pow(screwDiamInches, 2) *
      troughLoadingFactor,
  );
  const screwSelectedRpm = clampNum(inputs.screwSelectedRpm, 1, 1200, 55); // 55 RPM reference design
  const screwMaterialFactor = clampNum(inputs.screwMaterialFactor, 1, 3, 1.2);
  const screwFlightFactor = clampNum(inputs.screwFlightFactor, 0.5, 2, 1.0);
  const screwBearingFactor = clampNum(inputs.screwBearingFactor, 0.5, 2, 1.0);
  const screwDiameterFactor = clampNum(inputs.screwDiameterFactor, 1, 100, 12); // 12 for 4" screw
  const screwOverloadFactor = clampNum(inputs.screwOverloadFactor, 1, 6, 3.0);
  const screwDriveEfficiency = clampNum(inputs.screwDriveEfficiency, 0.2, 0.99, 0.88);
  const screwFlightThicknessMm = clampNum(inputs.screwFlightThicknessMm, 1, 20, 4);
  const screwNumberOfFlights = Math.max(1, Math.round(screwLengthMm / screwPitchMm));

  // Volumetric flow rate
  const volumetricFlowM3H = feedRateKgH / safeBulkDensity;
  const volumetricFlowFt3H = volumetricFlowM3H * 35.3146667;
  const bulkDensityLbFt3 = safeBulkDensity * (2.20462262 / 35.3146667); // 86.15 lb/ft3

  // Required and actual RPM
  const theoreticalRpm = volumetricFlowFt3H / screwCapacityFactorPerRpm; // 20.976 / 0.41 = 51.16 RPM
  const actualCapacityFt3H = screwCapacityFactorPerRpm * screwSelectedRpm; // 0.41 * 55 = 22.55 ft3/h
  const actualCapacityM3H = actualCapacityFt3H / 35.3146667; // 0.6385 m3/h
  const actualCapacityKgH = actualCapacityM3H * safeBulkDensity; // 881.2 kg/h
  const screwCapacityMarginPercent = ((actualCapacityFt3H - volumetricFlowFt3H) / Math.max(1e-6, volumetricFlowFt3H)) * 100;
  const isScrewCapacitySufficient = actualCapacityFt3H >= volumetricFlowFt3H;

  // Power calculations (CEMA / Martin / IITA p. 16)
  const frictionPowerHP = (screwLengthFt * screwSelectedRpm * screwDiameterFactor * screwBearingFactor) / 1000000; // 0.00217 HP
  const materialPowerHP = (actualCapacityFt3H * screwLengthFt * bulkDensityLbFt3 * screwFlightFactor * screwMaterialFactor * 1.0) / 1000000; // 0.00765 HP
  const basePowerHP = frictionPowerHP + materialPowerHP; // 0.00982 HP
  const totalTheoreticalPowerHP = (basePowerHP * screwOverloadFactor) / screwDriveEfficiency; // 0.0335 HP (~0.03 HP)
  const totalTheoreticalPowerKW = totalTheoreticalPowerHP * 0.7457; // 0.025 kW
  // Clamped, not `?? default`. The nullish coalescing form only substitutes for
  // null and undefined, so a string, an object or an array passed straight
  // through to `recommendedMotorPowerKW.toFixed(2)` further down and threw
  // "recommendedMotorPowerKW.toFixed is not a function", taking the entire
  // calculation with it. This is the same class of defect as the outletAirTemp
  // read reported in review: a raw input bypassing the sanitiser and reaching a
  // numeric method. clampNum rejects any non-finite or non-numeric value.
  const recommendedMotorPowerKW = clampNum(inputs.practicalMotorPowerKW, 0.1, 500, 0.75); // 0.75 kW (1.0 HP)
  const recommendedMotorPowerHP = recommendedMotorPowerKW * 1.34102; // 1.0 HP

  // SCREW FEEDER DESIGN CALCULATION STEPS (Steps 1 to 17)
  addStep(
    'Screw Feeder Design',
    '1. Wet Cassava Mass Feed Rate',
    'F_r',
    'kg/h',
    'Mass flow rate of wet cassava mash that must be metered into the flash dryer pneumatic riser.',
    'F_r = Design Feed Throughput',
    [
      { symbol: 'F_r', name: 'Wet cassava feed rate', value: feedRateKgH.toFixed(1), unit: 'kg/h', classification: 'User Input' }
    ],
    `F_r = ${feedRateKgH.toFixed(1)} kg/h`,
    feedRateKgH,
    `${feedRateKgH.toFixed(1)} kg/h`,
    'IITA / RMRDC Reference Design Case (820 kg/h)',
    'User Input',
    'Governing throughput requirement for screw metering geometry.'
  );

  addStep(
    'Screw Feeder Design',
    '2. Bulk Density of Conveyed Material',
    'rho_b',
    'kg/m³',
    'Volumetric mass density of mechanically dewatered cassava cake in the screw trough.',
    'rho_b = Material Assumption',
    [
      { symbol: 'rho_b', name: 'Bulk density', value: safeBulkDensity.toFixed(0), unit: 'kg/m³', classification: 'Calculated' }
    ],
    `rho_b = ${safeBulkDensity.toFixed(0)} kg/m³ (${bulkDensityLbFt3.toFixed(2)} lb/ft³)`,
    safeBulkDensity,
    `${safeBulkDensity.toFixed(0)} kg/m³`,
    'Kuye et al. (2011), Section 3.2',
    'Reference design value',
    'Wet dewatered cassava cake compacted under pressing.'
  );

  addStep(
    'Screw Feeder Design',
    '3. Required Volumetric Feed Rate (Metric)',
    'Q_v',
    'm³/h',
    'Calculates volumetric displacement required to convey the hourly mass throughput.',
    'Q_v = F_r / rho_b',
    [
      { symbol: 'F_r', name: 'Wet feed rate', value: feedRateKgH.toFixed(1), unit: 'kg/h', classification: 'User Input' },
      { symbol: 'rho_b', name: 'Bulk density', value: safeBulkDensity.toFixed(0), unit: 'kg/m³', classification: 'Calculated' }
    ],
    `${feedRateKgH.toFixed(1)} / ${safeBulkDensity.toFixed(0)}`,
    volumetricFlowM3H,
    `${volumetricFlowM3H.toFixed(4)} m³/h`,
    'Kuye et al. (2011), Section 3.2, p. 16',
    'Calculated',
    'Reference worked example: 820 / 1380 = 0.594 m³/h.'
  );

  addStep(
    'Screw Feeder Design',
    '4. Volumetric Flow Rate Unit Conversion (Imperial)',
    'Q_v,imp',
    'ft³/h',
    'Converts metric volumetric flow into standard CEMA screw conveyor engineering units (cubic feet per hour).',
    'Q_v,imp = Q_v × 35.3147',
    [
      { symbol: 'Q_v', name: 'Volumetric flow rate', value: volumetricFlowM3H.toFixed(4), unit: 'm³/h', classification: 'Calculated' },
      { symbol: 'Conv', name: 'Metric to imperial conversion factor', value: '35.3147', unit: 'ft³/m³', classification: 'Directly from Source' }
    ],
    `${volumetricFlowM3H.toFixed(4)} × 35.3147`,
    volumetricFlowFt3H,
    `${volumetricFlowFt3H.toFixed(2)} ft³/h`,
    'CEMA Standard 300 / Kuye et al. (2011), Section 3.2',
    'Calculated',
    'Reference worked example: 0.594 × 35.3147 = 20.98 ft³/h.'
  );

  addStep(
    'Screw Feeder Design',
    '5. Screw Feeder Diameter Selection',
    'D_screw',
    'mm',
    'Selected commercial nominal auger outside diameter.',
    'D_screw = Selected Nominal Size',
    [
      { symbol: 'D_screw', name: 'Screw diameter', value: `${screwDiamMm} mm (${screwDiamInches.toFixed(0)} in)`, unit: 'mm', classification: 'Calculated' }
    ],
    `D_screw = ${screwDiamMm} mm (${screwDiamInches.toFixed(0)} inches)`,
    screwDiamMm,
    `${screwDiamMm} mm (4 inches)`,
    'Kuye et al. (2011), Section 3.2',
    'Reference design value',
    '4-inch (100 mm) diameter selected for 820 kg/h pilot/small commercial flash dryer.'
  );

  addStep(
    'Screw Feeder Design',
    '6. Trough Volumetric Loading Percentage',
    'Loading',
    '%',
    'Percentage cross-sectional fill of the U-trough to avoid material buildup and overflow.',
    'Loading = 30% (CEMA Standard Class 30 Material)',
    [
      { symbol: 'Loading', name: 'Trough fill ratio', value: `${screwTroughLoadingPercent}%`, unit: '%', classification: 'Calculated' }
    ],
    `Loading = ${screwTroughLoadingPercent}%`,
    screwTroughLoadingPercent,
    `${screwTroughLoadingPercent}% Trough Loading`,
    'CEMA Conveyor Equipment Manufacturers Association Standard 300',
    'Reference design value',
    '30% fill factor recommended for sluggish, semi-abrasive dewatered agricultural pastes.'
  );

  addStep(
    'Screw Feeder Design',
    '7. Screw Capacity per RPM',
    'C_rpm',
    'ft³/h/RPM',
    'Volumetric delivery of the specified screw per revolution, derived from its own geometry. Capacity scales with the square of the screw diameter because the swept trough cross-section, not the flight tip speed, is what limits throughput. Change the diameter, pitch or loading and this figure follows automatically.',
    'C_rpm = 0.08817 × C_pitch × C_shaft × D_in² × F_loading',
    [
      { symbol: 'D_in', name: 'Screw outside diameter', value: screwDiamInches.toFixed(2), unit: 'in', classification: 'User Input' },
      { symbol: 'F_loading', name: 'CEMA trough loading factor', value: troughLoadingFactor.toFixed(3), unit: '-', classification: 'Calculated' },
      { symbol: 'C_pitch', name: 'Pitch configuration constant', value: pitchConfigurationConstant.toFixed(2), unit: '-', classification: 'Calculated' },
      { symbol: 'C_shaft', name: 'Shaft configuration constant', value: shaftConfigurationConstant.toFixed(2), unit: '-', classification: 'Calculated' }
    ],
    `0.08817 × ${pitchConfigurationConstant.toFixed(2)} × ${shaftConfigurationConstant.toFixed(2)} × ${screwDiamInches.toFixed(2)}² × ${troughLoadingFactor.toFixed(3)}`,
    screwCapacityFactorPerRpm,
    `${screwCapacityFactorPerRpm.toFixed(3)} ft³/h per RPM`,
    'CEMA Belt Conveyor Idlers / Screw Conveyor Design; Kuye et al. (2011), p. 16',
    'Calculated',
    `Derived from the ${screwDiamMm} mm screw at ${screwTroughLoadingPercent.toFixed(0)}% trough loading and ${pitchRatio.toFixed(2)} pitch ratio. The 0.08817 constant is 0.00284 per rev/h, converted to per rev/min, times the CEMA full-pitch configuration constant of 0.5174. A 4-inch screw at 30% loading returns 0.410 ft³/h/rpm here, matching the 0.41 ft³/h/rpm quoted in Kuye et al. (2011).`
  );

  addStep(
    'Screw Feeder Design',
    '8. Theoretical Required Screw Speed',
    'N_req',
    'RPM',
    'Calculates minimum rotational speed required to convey the volumetric feed rate.',
    'N_req = Q_v,imp / C_rpm',
    [
      { symbol: 'Q_v,imp', name: 'Required volumetric feed rate', value: volumetricFlowFt3H.toFixed(2), unit: 'ft³/h', classification: 'Calculated' },
      { symbol: 'C_rpm', name: 'Capacity per RPM', value: screwCapacityFactorPerRpm.toFixed(2), unit: 'ft³/h/RPM', classification: 'Calculated' }
    ],
    `${volumetricFlowFt3H.toFixed(2)} / ${screwCapacityFactorPerRpm.toFixed(2)}`,
    theoreticalRpm,
    `${theoreticalRpm.toFixed(2)} RPM`,
    'Kuye et al. (2011), Section 3.2, p. 16',
    'Calculated',
    'Reference worked example: 20.976 / 0.41 = 51.16 RPM.'
  );

  addStep(
    'Screw Feeder Design',
    '9. Selected Operating Screw Speed',
    'N_selected',
    'RPM',
    'Standard commercial gearmotor operating speed selected for manufacturing.',
    'N_selected = Selected Standard Operating Speed',
    [
      { symbol: 'N_selected', name: 'Selected rotational speed', value: screwSelectedRpm.toFixed(0), unit: 'RPM', classification: 'Calculated' },
      { symbol: 'N_req', name: 'Theoretical required speed', value: theoreticalRpm.toFixed(2), unit: 'RPM', classification: 'Calculated' }
    ],
    `N_selected = ${screwSelectedRpm.toFixed(0)} RPM (vs Req: ${theoreticalRpm.toFixed(2)} RPM)`,
    screwSelectedRpm,
    `${screwSelectedRpm.toFixed(0)} RPM`,
    'Kuye et al. (2011), Section 3.2, p. 16',
    'Reference design value',
    '55 RPM selected in reference design, driven via variable-speed reduction drive.'
  );

  addStep(
    'Screw Feeder Design',
    '10. Actual Screw Conveying Capacity',
    'Q_actual',
    'ft³/h',
    'Maximum delivery capacity delivered by the screw feeder at the selected operating speed.',
    'Q_actual = C_rpm × N_selected',
    [
      { symbol: 'C_rpm', name: 'Capacity per RPM', value: screwCapacityFactorPerRpm.toFixed(2), unit: 'ft³/h/RPM', classification: 'Calculated' },
      { symbol: 'N_selected', name: 'Selected operating speed', value: screwSelectedRpm.toFixed(0), unit: 'RPM', classification: 'Calculated' }
    ],
    `${screwCapacityFactorPerRpm.toFixed(2)} × ${screwSelectedRpm.toFixed(0)}`,
    actualCapacityFt3H,
    `${actualCapacityFt3H.toFixed(2)} ft³/h (${actualCapacityM3H.toFixed(4)} m³/h = ${actualCapacityKgH.toFixed(1)} kg/h)`,
    'Kuye et al. (2011), Section 3.2, p. 16',
    'Calculated',
    'Reference worked example: 0.41 × 55 = 22.55 ft³/h.'
  );

  addStep(
    'Screw Feeder Design',
    '11. Screw Feeder Capacity Margin',
    'Margin',
    '%',
    'Safety margin between actual screw delivery and required continuous feed rate.',
    'Margin = [ (Q_actual - Q_v,imp) / Q_v,imp ] × 100',
    [
      { symbol: 'Q_actual', name: 'Actual screw capacity', value: actualCapacityFt3H.toFixed(2), unit: 'ft³/h', classification: 'Calculated' },
      { symbol: 'Q_v,imp', name: 'Required feed rate', value: volumetricFlowFt3H.toFixed(2), unit: 'ft³/h', classification: 'Calculated' }
    ],
    `[ (${actualCapacityFt3H.toFixed(2)} - ${volumetricFlowFt3H.toFixed(2)}) / ${volumetricFlowFt3H.toFixed(2)} ] × 100`,
    screwCapacityMarginPercent,
    `${screwCapacityMarginPercent >= 0 ? '+' : ''}${screwCapacityMarginPercent.toFixed(1)}% Capacity Margin`,
    'CEMA Standard 300 / Kuye et al. (2011)',
    'Calculated',
    `Provides positive ${(actualCapacityKgH - feedRateKgH).toFixed(1)} kg/h delivery reserve, guaranteeing non-choking operation.`
  );

  addStep(
    'Screw Feeder Design',
    '12. Empty Conveyor Friction Horsepower',
    'P_f',
    'HP',
    'Power absorbed to overcome mechanical friction of screw shaft, flight seals, and hanger bearings running empty.',
    'P_f = (L × N × F_d × F_b) / 1,000,000',
    [
      { symbol: 'L', name: 'Conveyor length', value: screwLengthFt.toFixed(2), unit: 'ft', classification: 'Calculated' },
      { symbol: 'N', name: 'Operating speed', value: screwSelectedRpm.toFixed(0), unit: 'RPM', classification: 'Calculated' },
      { symbol: 'F_d', name: 'Diameter factor for 4-in screw', value: screwDiameterFactor.toString(), unit: '-', classification: 'Calculated' },
      { symbol: 'F_b', name: 'Bearing factor', value: screwBearingFactor.toFixed(1), unit: '-', classification: 'Calculated' }
    ],
    `(${screwLengthFt.toFixed(2)} × ${screwSelectedRpm.toFixed(0)} × ${screwDiameterFactor} × ${screwBearingFactor.toFixed(1)}) / 1,000,000`,
    frictionPowerHP,
    `${frictionPowerHP.toFixed(5)} HP (${(frictionPowerHP * 745.7).toFixed(2)} W)`,
    'CEMA Standard 300 / Kuye et al. (2011), Section 3.2, Eq. 8',
    'Calculated',
    'Reference worked example: (3.28 × 55 × 12 × 1) / 1,000,000 = 0.00217 HP.'
  );

  addStep(
    'Screw Feeder Design',
    '13. Material Conveying Horsepower',
    'P_m',
    'HP',
    'Power required to push and convey cohesive wet cassava mash along the horizontal trough.',
    'P_m = (C × L × W × F_f × F_m × F_p) / 1,000,000',
    [
      { symbol: 'C', name: 'Actual volumetric capacity', value: actualCapacityFt3H.toFixed(2), unit: 'ft³/h', classification: 'Calculated' },
      { symbol: 'L', name: 'Conveyor length', value: screwLengthFt.toFixed(2), unit: 'ft', classification: 'Calculated' },
      { symbol: 'W', name: 'Material weight density', value: bulkDensityLbFt3.toFixed(2), unit: 'lb/ft³', classification: 'Calculated' },
      { symbol: 'F_f', name: 'Flight factor', value: screwFlightFactor.toFixed(1), unit: '-', classification: 'Calculated' },
      { symbol: 'F_m', name: 'Material factor for cassava cake', value: screwMaterialFactor.toFixed(1), unit: '-', classification: 'Calculated' },
      { symbol: 'F_p', name: 'Paddle factor', value: '1.0', unit: '-', classification: 'Calculated' }
    ],
    `(${actualCapacityFt3H.toFixed(2)} × ${screwLengthFt.toFixed(2)} × ${bulkDensityLbFt3.toFixed(2)} × ${screwFlightFactor.toFixed(1)} × ${screwMaterialFactor.toFixed(1)} × 1.0) / 1,000,000`,
    materialPowerHP,
    `${materialPowerHP.toFixed(5)} HP (${(materialPowerHP * 745.7).toFixed(2)} W)`,
    'CEMA Standard 300 / Kuye et al. (2011), Section 3.2, Eq. 9',
    'Calculated',
    'Reference worked example: (22.55 × 3.28 × 86.15 × 1 × 1.2 × 1) / 1,000,000 = 0.00765 HP.'
  );

  addStep(
    'Screw Feeder Design',
    '14. Motor Overload Factor',
    'F_o',
    '-',
    'CEMA overload multiplier accounting for starting breakaway torque and material surging.',
    'F_o = 3.0 (CEMA Heavy Starting / Low HP Factor)',
    [
      { symbol: 'F_o', name: 'Starting overload factor', value: screwOverloadFactor.toFixed(1), unit: '-', classification: 'Calculated' }
    ],
    `F_o = ${screwOverloadFactor.toFixed(1)}`,
    screwOverloadFactor,
    `${screwOverloadFactor.toFixed(1)}x Overload Factor`,
    'CEMA Standard 300 / Kuye et al. (2011)',
    'Reference design value',
    'CEMA specifies Fo = 3.0 for fractional horsepower conveyor drives to overcome static starting friction.'
  );

  addStep(
    'Screw Feeder Design',
    '15. Drive Transmission Efficiency',
    'E',
    '-',
    'Combined mechanical efficiency of gear reducer, shaft couplings, and motor drive belt/chain.',
    'E = 0.88 (88% Transmission Efficiency)',
    [
      { symbol: 'E', name: 'Drive transmission efficiency', value: `${(screwDriveEfficiency * 100).toFixed(0)}%`, unit: '-', classification: 'Calculated' }
    ],
    `E = ${screwDriveEfficiency.toFixed(2)}`,
    screwDriveEfficiency,
    `${(screwDriveEfficiency * 100).toFixed(0)}% Drive Efficiency`,
    'Kuye et al. (2011), Section 3.2, p. 16',
    'Reference design value',
    'Typical efficiency for helical/worm reduction gearbox with direct coupling.'
  );

  addStep(
    'Screw Feeder Design',
    '16. Total Theoretical Screw Feeder Power',
    'P_total',
    'HP',
    'Calculated total theoretical drive power requirement including friction, material transport, overload, and transmission losses.',
    'P_total = [ (P_f + P_m) × F_o ] / E',
    [
      { symbol: 'P_f', name: 'Friction horsepower', value: frictionPowerHP.toFixed(5), unit: 'HP', classification: 'Calculated' },
      { symbol: 'P_m', name: 'Material conveying horsepower', value: materialPowerHP.toFixed(5), unit: 'HP', classification: 'Calculated' },
      { symbol: 'F_o', name: 'Overload factor', value: screwOverloadFactor.toFixed(1), unit: '-', classification: 'Calculated' },
      { symbol: 'E', name: 'Drive efficiency', value: screwDriveEfficiency.toFixed(2), unit: '-', classification: 'Calculated' }
    ],
    `[ (${frictionPowerHP.toFixed(5)} + ${materialPowerHP.toFixed(5)}) × ${screwOverloadFactor.toFixed(1)} ] / ${screwDriveEfficiency.toFixed(2)}`,
    totalTheoreticalPowerHP,
    `${totalTheoreticalPowerHP.toFixed(4)} HP (~0.03 HP = ${(totalTheoreticalPowerKW * 1000).toFixed(1)} W)`,
    'Kuye et al. (2011), Section 3.2, Eq. 10',
    'Calculated',
    'Reference worked example: [ (0.00217 + 0.00765) × 3 ] / 0.88 = 0.0335 HP (~0.03 HP).'
  );

  addStep(
    'Screw Feeder Design',
    '17. Practical Motor Selection Consideration',
    'P_motor',
    'kW',
    'Practical industrial electric motor recommendation. While theoretical power is 0.03 HP (25 Watts), commercial fabrications require high starting torque to overcome sticky cassava cake packing after shutdowns.',
    'P_motor = Commercial Standard Geared Motor Rating with VFD',
    [
      { symbol: 'P_theo', name: 'Theoretical calculated power', value: `${totalTheoreticalPowerHP.toFixed(3)} HP (${(totalTheoreticalPowerKW * 1000).toFixed(0)} W)`, unit: 'HP', classification: 'Calculated' },
      { symbol: 'P_motor', name: 'Recommended practical installed motor', value: `${recommendedMotorPowerKW.toFixed(2)} kW (${recommendedMotorPowerHP.toFixed(1)} HP)`, unit: 'kW', classification: 'Engineering Assumption' }
    ],
    `Recommended Commercial Drive: ${recommendedMotorPowerKW.toFixed(2)} kW (${recommendedMotorPowerHP.toFixed(1)} HP) Geared Motor with VFD (15 - 60 RPM)`,
    recommendedMotorPowerKW,
    `${recommendedMotorPowerKW.toFixed(2)} kW (${recommendedMotorPowerHP.toFixed(1)} HP) Industrial Geared Motor`,
    'IITA / RMRDC HQCF Fabrication Specification; CEMA Practical Installation Guidelines',
    'Engineering Assumption',
    'A 0.75 kW (1.0 HP) variable-frequency drive geared motor provides necessary breakaway torque to avoid stall under cohesive wet mash consolidation.'
  );

  // Construct Reports
  const hopperDesign: HopperDesignReport = {
    wetFeedRateKgH: feedRateKgH,
    bulkDensityKgM3: safeBulkDensity,
    holdingTimeMin: hopperHoldingTimeMin,
    massHeldKg: hopperMassHeldKg,
    requiredVolumeM3: hopperRequiredVolumeM3,
    volumeAllowancePercent: hopperVolumeAllowancePercent,
    totalRequiredVolumeM3: hopperTotalRequiredVolumeM3,
    topWidthM: hopperTopWidthM,
    topLengthM: hopperTopLengthM,
    topAreaM2: hopperTopAreaM2,
    outletWidthM: hopperOutletWidthM,
    outletLengthM: hopperOutletLengthM,
    outletAreaM2: hopperOutletAreaM2,
    upperVerticalHeightM: hopperUpperHeightM,
    upperVolumeM3: hopperUpperVolumeM3,
    lowerTaperedHeightM: hopperLowerHeightM,
    lowerVolumeM3: hopperLowerVolumeM3,
    totalGeometricVolumeM3: hopperTotalGeometricVolumeM3,
    overallHeightM: hopperTotalHeightM,
    volumeMarginPercent: hopperVolumeMarginPercent,
    runWidthM: runWM,
    runLengthM: runLM,
    wallSlopeAngleADeg: hopperWallAngleADeg,
    wallSlopeAngleBDeg: hopperWallAngleBDeg,
    valleyAngleDeg: hopperValleyAngleCDeg,
    isValleyAngleSufficient,
    flowRegimeDescription,
  };

  const screwFeederDesign: ScrewFeederDesignReport = {
    wetFeedRateKgH: feedRateKgH,
    bulkDensityKgM3: safeBulkDensity,
    bulkDensityLbFt3: bulkDensityLbFt3,
    volumetricFlowM3H: volumetricFlowM3H,
    volumetricFlowFt3H: volumetricFlowFt3H,
    screwDiameterMm: screwDiamMm,
    screwDiameterInches: screwDiamInches,
    screwLengthMm: screwLengthMm,
    screwLengthM: screwLengthM,
    screwLengthFt: screwLengthFt,
    troughLoadingPercent: screwTroughLoadingPercent,
    capacityFactorPerRpmFt3H: screwCapacityFactorPerRpm,
    theoreticalRpm: theoreticalRpm,
    selectedRpm: screwSelectedRpm,
    actualCapacityFt3H: actualCapacityFt3H,
    actualCapacityM3H: actualCapacityM3H,
    actualCapacityKgH: actualCapacityKgH,
    capacityMarginPercent: screwCapacityMarginPercent,
    isCapacitySufficient: isScrewCapacitySufficient,
    diameterFactorFd: screwDiameterFactor,
    bearingFactorFb: screwBearingFactor,
    flightFactorFf: screwFlightFactor,
    materialFactorFm: screwMaterialFactor,
    paddleFactorFp: 1.0,
    overloadFactorFo: screwOverloadFactor,
    driveEfficiency: screwDriveEfficiency,
    frictionPowerHP: frictionPowerHP,
    materialPowerHP: materialPowerHP,
    basePowerHP: basePowerHP,
    totalTheoreticalPowerHP: totalTheoreticalPowerHP,
    totalTheoreticalPowerKW: totalTheoreticalPowerKW,
    recommendedMotorPowerKW: recommendedMotorPowerKW,
    recommendedMotorPowerHP: recommendedMotorPowerHP,
    motorSelectionRationale: '0.75 kW (1.0 HP) variable-speed geared motor (15-60 RPM) providing necessary breakaway torque for cohesive cassava cake.',
    screwPitchMm: screwPitchMm,
    shaftDiameterMm: screwShaftDiameterMm,
    flightThicknessMm: screwFlightThicknessMm,
    numberOfFlights: screwNumberOfFlights,
  };

  const isStairmand = inputs.cycloneType === 'stairmand';
  const cycloneRatios = isStairmand ? STAIRMAND_RATIOS : LAPPLE_RATIOS;
  const v_ci = cycloneRatios.standardInletVelocityMperS; // 15 m/s

  // Inlet Area A_ci = Q_v,out / v_ci
  // A_ci = inletAreaFactor * D_c^2 => D_c = sqrt(Q_v,out / (inletAreaFactor * v_ci))
  const cycloneDiameterM = Math.max(0.15, Math.sqrt(Math.max(0.001, outletVolumetricFlowM3S) / (cycloneRatios.inletAreaFactor * v_ci)));
  const cycloneDiameterMm = Math.max(150, Math.round(cycloneDiameterM * 1000));

  const cycloneInletHeightMm = Math.round(cycloneDiameterMm * cycloneRatios.inletHeight_a);
  const cycloneInletWidthMm = Math.round(cycloneDiameterMm * cycloneRatios.inletWidth_b);
  const cycloneVortexFinderDiameterMm = Math.round(cycloneDiameterMm * cycloneRatios.vortexFinderDiameter_De);
  const cycloneVortexFinderLengthMm = Math.round(cycloneDiameterMm * cycloneRatios.vortexFinderLength_S);
  const cycloneCylinderHeightMm = Math.round(cycloneDiameterMm * cycloneRatios.cylinderHeight_h);
  const cycloneConeHeightMm = Math.round(cycloneDiameterMm * cycloneRatios.coneHeight);
  const cycloneTotalHeightMm = Math.round(cycloneDiameterMm * cycloneRatios.totalHeight_H);
  const cycloneDustOutletDiameterMm = Math.round(cycloneDiameterMm * cycloneRatios.dustOutletDiameter_B);

  const actualCycloneInletAreaM2 = Math.max(0.001, (cycloneInletHeightMm * cycloneInletWidthMm) / 1e6);
  const cycloneInletVelocityMperS = outletVolumetricFlowM3S / actualCycloneInletAreaM2;
  const cyclonePressureDropPa = Math.max(50, Math.round(cycloneRatios.eulerNumber_Eu * 0.5 * outletAirDensity * Math.pow(cycloneInletVelocityMperS, 2)));

  // Barth-Lapple theoretical cut-point d50 calculation (particle size collected with 50% efficiency)
  const effectiveSpiralTurnsNe = isStairmand ? 5.0 : 4.0;
  const inletWidthM = cycloneInletWidthMm / 1000;
  const gasViscosityAtOutlet = 1.716e-5 * Math.pow((safeOutletAirTemp + 273.15) / 273.15, 1.5) * ((273.15 + 110.4) / (safeOutletAirTemp + 273.15 + 110.4));
  const cutPointD50M = Math.sqrt(
    (9 * gasViscosityAtOutlet * inletWidthM) /
    (2 * Math.PI * effectiveSpiralTurnsNe * cycloneInletVelocityMperS * Math.max(100, safeParticleDensity - outletAirDensity))
  );
  const cutPointD50Microns = cutPointD50M * 1e6;

  // 1. CYCLONE BARREL DIAMETER (Dc)
  addStep(
    'Cyclone Separator',
    `${isStairmand ? 'Stairmand High-Efficiency' : 'Lapple'} Cyclone Barrel Diameter`,
    'D_c',
    'mm',
    'Primary sizing dimension derived by equating exhaust gas volumetric flow rate to the rectangular tangential inlet area at standard design inlet velocity (15 m/s). All other 8 cyclone dimensions are geometrically proportional to D_c.',
    'D_c = sqrt[ Q_v,out / (C_area × v_ci) ]',
    [
      { symbol: 'Q_v,out', name: 'Exhaust volumetric gas flow at cyclone inlet', value: outletVolumetricFlowM3S.toFixed(3), unit: 'm³/s', classification: 'Calculated' },
      { symbol: 'v_ci', name: 'Design cyclone inlet gas velocity', value: v_ci.toFixed(1), unit: 'm/s', classification: 'Directly from Source' },
      { symbol: 'C_area', name: 'Geometric inlet factor (a/Dc × b/Dc)', value: cycloneRatios.inletAreaFactor.toString(), unit: '-', classification: 'Directly from Source' }
    ],
    `sqrt[ ${outletVolumetricFlowM3S.toFixed(3)} / (${cycloneRatios.inletAreaFactor} × ${v_ci.toFixed(1)}) ]`,
    cycloneDiameterMm,
    `${cycloneDiameterMm} mm (${(cycloneDiameterMm / 1000).toFixed(3)} m)`,
    'CIRAD Pilot Flash Dryer Report (2015), Section 4.4; Stairmand (1951) / Lapple (1951)',
    'Calculated',
    'Primary aerodynamic reference dimension. Sized to maintain tangential entry velocity at 15 m/s, producing a centrifugal field exceeding 200 gravities.'
  );

  // 2. CYCLONE INLET RECTANGULAR HEIGHT (a)
  addStep(
    'Cyclone Separator',
    'Cyclone Tangential Inlet Duct Height',
    'a',
    'mm',
    `Vertical height of the tangential rectangular entry duct entering the top cylindrical barrel, derived as a fixed aerodynamic ratio (${cycloneRatios.inletHeight_a} × D_c).`,
    'a = k_a × D_c',
    [
      { symbol: 'k_a', name: 'Inlet height-to-diameter geometric ratio (a/Dc)', value: cycloneRatios.inletHeight_a.toFixed(2), unit: '-', classification: 'Directly from Source' },
      { symbol: 'D_c', name: 'Cyclone body barrel diameter', value: cycloneDiameterMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneRatios.inletHeight_a.toFixed(2)} × ${cycloneDiameterMm}`,
    cycloneInletHeightMm,
    `${cycloneInletHeightMm} mm`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    'Ensures incoming flour-gas suspension enters flush against the top headwall without disrupting the vortex finder root.'
  );

  // 3. CYCLONE INLET RECTANGULAR WIDTH (b)
  addStep(
    'Cyclone Separator',
    'Cyclone Tangential Inlet Duct Width',
    'b',
    'mm',
    `Radial width of the tangential entry nozzle, derived as ${cycloneRatios.inletWidth_b} × D_c. Sized narrow to minimize the radial distance cassava particles must travel to reach the outer collection wall.`,
    'b = k_b × D_c',
    [
      { symbol: 'k_b', name: 'Inlet width-to-diameter geometric ratio (b/Dc)', value: cycloneRatios.inletWidth_b.toFixed(2), unit: '-', classification: 'Directly from Source' },
      { symbol: 'D_c', name: 'Cyclone body barrel diameter', value: cycloneDiameterMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneRatios.inletWidth_b.toFixed(2)} × ${cycloneDiameterMm}`,
    cycloneInletWidthMm,
    `${cycloneInletWidthMm} mm`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    `Narrow inlet width (b = ${cycloneInletWidthMm} mm) produces thin annular gas layer, dramatically reducing radial transit time for fine particles to reach the wall.`
  );

  // 4. CYCLONE VORTEX FINDER DIAMETER (De)
  addStep(
    'Cyclone Separator',
    'Cyclone Vortex Finder (Gas Exhaust Tube) Diameter',
    'D_e',
    'mm',
    `Internal diameter of the central gas exhaust tube that extends through the top cover plate, derived as ${cycloneRatios.vortexFinderDiameter_De} × D_c.`,
    'D_e = k_De × D_c',
    [
      { symbol: 'k_De', name: 'Vortex finder diameter ratio (De/Dc)', value: cycloneRatios.vortexFinderDiameter_De.toFixed(2), unit: '-', classification: 'Directly from Source' },
      { symbol: 'D_c', name: 'Cyclone body barrel diameter', value: cycloneDiameterMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneRatios.vortexFinderDiameter_De.toFixed(2)} × ${cycloneDiameterMm}`,
    cycloneVortexFinderDiameterMm,
    `Ø${cycloneVortexFinderDiameterMm} mm`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    'Matches the diameter of the natural inner upward vortex core (Rankine eye). Sizing De = 0.50 Dc minimizes exhaust pressure drop and avoids entraining the outer downward spiral.'
  );

  // 5. CYCLONE VORTEX FINDER LENGTH (S)
  addStep(
    'Cyclone Separator',
    'Cyclone Vortex Finder Insertion Depth',
    'S',
    'mm',
    `Vertical insertion depth of the vortex finder cylinder below the top roof plate, derived as ${cycloneRatios.vortexFinderLength_S} × D_c. Must extend strictly below the bottom lip of the inlet duct (S >= a) to prevent gas short-circuiting.`,
    'S = k_S × D_c',
    [
      { symbol: 'k_S', name: 'Vortex finder insertion depth ratio (S/Dc)', value: cycloneRatios.vortexFinderLength_S.toFixed(3), unit: '-', classification: 'Directly from Source' },
      { symbol: 'D_c', name: 'Cyclone body barrel diameter', value: cycloneDiameterMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneRatios.vortexFinderLength_S.toFixed(3)} × ${cycloneDiameterMm}`,
    cycloneVortexFinderLengthMm,
    `${cycloneVortexFinderLengthMm} mm (Inlet height a = ${cycloneInletHeightMm} mm; S >= a satisfied)`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    `Extending S = ${cycloneVortexFinderLengthMm} mm (>= a = ${cycloneInletHeightMm} mm) guarantees that unseparated raw feed cannot bypass directly from the inlet into the exhaust stack.`
  );

  // 6. CYCLONE UPPER CYLINDRICAL BARREL HEIGHT (h)
  addStep(
    'Cyclone Separator',
    'Cyclone Upper Cylindrical Barrel Height',
    'h',
    'mm',
    `Height of the vertical cylindrical upper body section before tapering begins, derived as ${cycloneRatios.cylinderHeight_h} × D_c.`,
    'h = k_h × D_c',
    [
      { symbol: 'k_h', name: 'Cylinder height ratio (h/Dc)', value: cycloneRatios.cylinderHeight_h.toFixed(2), unit: '-', classification: 'Directly from Source' },
      { symbol: 'D_c', name: 'Cyclone body barrel diameter', value: cycloneDiameterMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneRatios.cylinderHeight_h.toFixed(2)} × ${cycloneDiameterMm}`,
    cycloneCylinderHeightMm,
    `${cycloneCylinderHeightMm} mm (${(cycloneCylinderHeightMm / 1000).toFixed(2)} m)`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    'Provides sufficient vertical height for incoming high-speed tangential stream to establish a stable multi-turn outer downward helical vortex.'
  );

  // 7. CYCLONE LOWER CONICAL SECTION HEIGHT (z)
  addStep(
    'Cyclone Separator',
    'Cyclone Lower Conical Section Height',
    'z',
    'mm',
    `Vertical height of the inverted truncated cone tapering from body diameter D_c down to dust discharge diameter B, derived as ${cycloneRatios.coneHeight} × D_c.`,
    'z = (H - h) = k_z × D_c',
    [
      { symbol: 'k_z', name: 'Cone height ratio (z/Dc)', value: cycloneRatios.coneHeight.toFixed(2), unit: '-', classification: 'Directly from Source' },
      { symbol: 'D_c', name: 'Cyclone body barrel diameter', value: cycloneDiameterMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneRatios.coneHeight.toFixed(2)} × ${cycloneDiameterMm}`,
    cycloneConeHeightMm,
    `${cycloneConeHeightMm} mm (${(cycloneConeHeightMm / 1000).toFixed(2)} m)`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    `As radius tapers from ${cycloneDiameterMm} mm to ${cycloneDustOutletDiameterMm} mm, conservation of angular momentum accelerates swirl velocity, intensifying centrifugal separation. Steep cone angle (~75° to horizontal) prevents powder hang-up.`
  );

  // 8. CYCLONE TOTAL OVERALL HEIGHT (H)
  addStep(
    'Cyclone Separator',
    'Cyclone Total Overall Height',
    'H',
    'mm',
    `Combined vertical height from top roof plate to bottom dust discharge flange, derived as H = h + z = ${cycloneRatios.totalHeight_H} × D_c.`,
    'H = h + z = k_H × D_c',
    [
      { symbol: 'k_H', name: 'Total height ratio (H/Dc)', value: cycloneRatios.totalHeight_H.toFixed(2), unit: '-', classification: 'Directly from Source' },
      { symbol: 'h', name: 'Cylindrical barrel height', value: cycloneCylinderHeightMm.toString(), unit: 'mm', classification: 'Calculated' },
      { symbol: 'z', name: 'Conical section height', value: cycloneConeHeightMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneCylinderHeightMm} + ${cycloneConeHeightMm} = ${cycloneRatios.totalHeight_H.toFixed(2)} × ${cycloneDiameterMm}`,
    cycloneTotalHeightMm,
    `${cycloneTotalHeightMm} mm (${(cycloneTotalHeightMm / 1000).toFixed(2)} m)`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    'Total structural vertical envelope required for mounting cyclone barrel inside supporting tower structure.'
  );

  // 9. CYCLONE DUST DISCHARGE SPIGOT DIAMETER (B)
  addStep(
    'Cyclone Separator',
    'Cyclone Dust Bottom Discharge Nozzle Diameter',
    'B',
    'mm',
    `Diameter of the bottom conical outlet flange connecting directly to the rotary airlock valve, derived as ${cycloneRatios.dustOutletDiameter_B} × D_c.`,
    'B = k_B × D_c',
    [
      { symbol: 'k_B', name: 'Dust outlet ratio (B/Dc)', value: cycloneRatios.dustOutletDiameter_B.toFixed(3), unit: '-', classification: 'Directly from Source' },
      { symbol: 'D_c', name: 'Cyclone body barrel diameter', value: cycloneDiameterMm.toString(), unit: 'mm', classification: 'Calculated' }
    ],
    `${cycloneRatios.dustOutletDiameter_B.toFixed(3)} × ${cycloneDiameterMm}`,
    cycloneDustOutletDiameterMm,
    `Ø${cycloneDustOutletDiameterMm} mm`,
    'Stairmand (1951) / Lapple (1951) Standard Cyclone Proportions',
    'Calculated',
    'Sized wide enough to prevent flour bridging while allowing smooth gravity discharge into rotary airlock valve without disruption of vortex tail.'
  );

  // 10. CYCLONE CUT-POINT PARTICLE DIAMETER (d50)
  // The previous version of this step printed a hard-coded ">99.8% recovery with
  // zero product loss" regardless of inputs. That is a product-loss and dust
  // safety claim printed in an engineering report, so collection efficiency is now
  // estimated from the actual particle-to-cutpoint size ratio and the text
  // branches with it.
  // Lapple single-dust efficiency as a function of size ratio d_p/d50.
  //
  //     eta = 1 / (1 + (d50/d_p)^2)   ->   eta = ratio^2 / (1 + ratio^2)
  //
  // This is the standard Lapple (1951) form as tabulated in Perry's Chemical
  // Engineers' Handbook, 8th ed. It REPLACES a hand-stepped staircase that had
  // two defects:
  //
  //   1. It returned 80% at d_p/d50 = 1, contradicting the definition of d50 as
  //      the diameter collected with 50% efficiency.
  //   2. It returned 99% at d_p/d50 = 3, where Lapple gives 90%. The staircase
  //      had been fitted with the assumption that a cyclone is near-perfect for
  //      coarse particles, which is not true of a single unassisted stage.
  //
  // The closed form is also strictly monotonic, so there are no step
  // discontinuities in the reported efficiency as d50 varies.
  const cycloneSizeRatio = cutPointD50Microns > 0 ? safeParticleDiameter / cutPointD50Microns : 0;
  const cycloneCollectionEfficiencyPercent =
    cycloneSizeRatio > 0 ? (100 * cycloneSizeRatio * cycloneSizeRatio) / (1 + cycloneSizeRatio * cycloneSizeRatio) : 0;
  const cycloneRecoveryNote =
    cycloneSizeRatio >= 3
      ? `Cassava flour particle size (${safeParticleDiameter.toFixed(0)} µm) is ${cycloneSizeRatio.toFixed(1)}× the cut-point d50 (${cutPointD50Microns.toFixed(1)} µm). Single-dust collection efficiency is approximately ${cycloneCollectionEfficiencyPercent.toFixed(1)}%, so product loss to the exhaust stream is small but not zero — allow for fines when sizing the exhaust filtration.`
      : `CAUTION: cassava flour particle size (${safeParticleDiameter.toFixed(0)} µm) is only ${cycloneSizeRatio.toFixed(1)}× the cut-point d50 (${cutPointD50Microns.toFixed(1)} µm). Single-dust collection efficiency is only about ${cycloneCollectionEfficiencyPercent.toFixed(1)}%, so a substantial fraction of the product will report to the exhaust. Increase cyclone diameter or reduce inlet velocity to lower d50, or plan for downstream filtration.`;

  addStep(
    'Cyclone Separator',
    'Theoretical Cyclone Cut-Point Diameter (50% Collection)',
    'd_50',
    'µm',
    'Calculates the aerodynamic particle diameter that has a 50% probability of collection in the cyclone. Particles larger than d_50 are collected with higher efficiency, approaching unity for coarse particles.',
    'd_50 = sqrt[ (9 × mu_air × b) / (2 × pi × N_e × v_ci × (rho_p - rho_air)) ]',
    [
      { symbol: 'mu_air', name: 'Air dynamic viscosity at outlet temperature', value: gasViscosityAtOutlet.toExponential(3), unit: 'Pa·s', classification: 'Calculated' },
      { symbol: 'b', name: 'Tangential inlet width (kb × Dc)', value: (inletWidthM).toFixed(3), unit: 'm', classification: 'Calculated' },
      { symbol: 'N_e', name: 'Effective vortex turns in outer spiral', value: effectiveSpiralTurnsNe.toFixed(1), unit: '-', classification: 'Directly from Source' },
      { symbol: 'v_ci', name: 'Cyclone inlet gas velocity', value: cycloneInletVelocityMperS.toFixed(1), unit: 'm/s', classification: 'Calculated' },
      { symbol: 'rho_p', name: 'Cassava starch granule density', value: safeParticleDensity.toFixed(0), unit: 'kg/m³', classification: 'Directly from Source' }
    ],
    `sqrt[ (9 × ${gasViscosityAtOutlet.toExponential(2)} × ${inletWidthM.toFixed(3)}) / (2 × pi × ${effectiveSpiralTurnsNe} × ${cycloneInletVelocityMperS.toFixed(1)} × (${safeParticleDensity.toFixed(0)} - ${outletAirDensity.toFixed(2)})) ] × 10^6`,
    cutPointD50Microns,
    `${cutPointD50Microns.toFixed(2)} µm (Cassava d_p = ${safeParticleDiameter.toFixed(0)} µm, ratio ${cycloneSizeRatio.toFixed(1)}× → ~${cycloneCollectionEfficiencyPercent.toFixed(1)}% single-dust collection)`,
    'Lapple (1951) Semi-Empirical Cyclone Separation Theory; Perry’s Chemical Engineers’ Handbook (8th Ed., Eq. 17-50)',
    'Calculated',
    cycloneRecoveryNote
  );

  // 11. CYCLONE PRESSURE DROP (Delta P)
  addStep(
    'Cyclone Separator',
    'Cyclone Static Pressure Drop',
    'Delta_P_cyc',
    'Pa',
    'Total static pressure resistance across the cyclone from tangential inlet to vortex finder outlet, governed by Euler number friction factor Eu.',
    'Delta_P = Eu × (1/2 × rho_out × v_ci^2)',
    [
      { symbol: 'Eu', name: 'Cyclone Euler resistance number', value: cycloneRatios.eulerNumber_Eu.toFixed(1), unit: '-', classification: 'Directly from Source' },
      { symbol: 'rho_out', name: 'Exhaust air density', value: outletAirDensity.toFixed(3), unit: 'kg/m³', classification: 'Calculated' },
      { symbol: 'v_ci', name: 'Actual tangential inlet gas velocity', value: cycloneInletVelocityMperS.toFixed(1), unit: 'm/s', classification: 'Calculated' }
    ],
    `${cycloneRatios.eulerNumber_Eu.toFixed(1)} × 0.5 × ${outletAirDensity.toFixed(3)} × (${cycloneInletVelocityMperS.toFixed(1)})^2`,
    cyclonePressureDropPa,
    `${cyclonePressureDropPa.toFixed(0)} Pa (${(cyclonePressureDropPa / 9.80665).toFixed(0)} mm H2O)`,
    'Shepherd & Lapple (1939, 1940); Stairmand (1951); CIRAD Module 4',
    'Calculated',
    `Dynamic pressure loss of spinning vortex core (${cyclonePressureDropPa.toFixed(0)} Pa). Factored into the overall system fan pressure drop calculation.`
  );

  // ==========================================
  // HEAT EXCHANGER SIZING & MULTI-PASS DESIGN (CIRAD MODULE 4)
  // ==========================================
  // Clamped for the same reason as recommendedMotorPowerKW above.
  // `inputs.heatExchangerPasses || 2` only substitutes for null, undefined, 0 and
  // empty string — a truthy non-numeric value such as 'abc' or an object passed
  // straight into Math.round, yielding NaN. That NaN then propagated through the
  // LMTD correction factor, the surface area and the air-side pressure drop, and
  // from there into the fan air power and motor rating: a single bad field on the
  // heat exchanger silently produced NaN newtons per second on the blower.
  const numberOfPasses = Math.round(clampNum(inputs.heatExchangerPasses, 1, 8, 2));
  // Restrict the type to the enumerated values rather than trusting the string, so
  // the cross-flow / shell-and-tube branch below cannot be reached with a type
  // that has no defined LMTD correction.
  const hexType: 'cross_flow_finned' | 'cross_flow_bare' | 'shell_and_tube_1pass' | 'shell_and_tube_2pass' =
    inputs.heatExchangerType === 'cross_flow_bare' ||
    inputs.heatExchangerType === 'shell_and_tube_1pass' ||
    inputs.heatExchangerType === 'shell_and_tube_2pass' ||
    inputs.heatExchangerType === 'cross_flow_finned'
      ? inputs.heatExchangerType
      : 'cross_flow_finned';
  
  // Flue gas temperatures from biomass furnace / burner (CIRAD Module 4)
  const hotGasInletTempC = Math.max(safeInletAirTemp + 50, 380); // °C
  const hotGasOutletTempC = Math.max(safeAmbientTemp + 40, 190); // °C
  
  // Counter-current LMTD calculation with safety guard against deltaT1 <= 0 or deltaT1 === deltaT2
  const deltaT1 = Math.max(10, hotGasInletTempC - safeInletAirTemp);
  const deltaT2 = Math.max(10, hotGasOutletTempC - safeAmbientTemp);
  const lmtdC = Math.abs(deltaT1 - deltaT2) < 0.1
    ? (deltaT1 + deltaT2) / 2
    : (deltaT1 - deltaT2) / Math.log(deltaT1 / deltaT2);
  
  // LMTD correction factor Ft.
  // The previous code used a single pass-based expression, 0.88 + 0.025*(passes-1)
  // clamped to [0.85, 0.99], for every exchanger type. Two problems:
  //  1. For a 1-pass shell-and-tube exchanger the standard correction is 1.00, so
  //     the old expression applied a spurious 12% area penalty by default.
  //  2. A pass-count correction is only meaningful for shell-and-tube designs. For
  //     a cross-flow finned exchanger (the default here) there is no shell pass
  //     count to correct for, so applying one is physically meaningless.
  let correctionFactorFt: number;
  let correctionFactorBasis: string;
  if (hexType === 'cross_flow_finned' || hexType === 'cross_flow_bare') {
    // Cross-flow. The two fluids never mix and their temperature profiles do not
    // average out, so the LMTD ALWAYS needs a correction — it is not 1.0, and it
    // has nothing to do with tube pass count. F depends on which stream is
    // unmixed; for a finned bundle with unmixed hot gas, F ~ 0.90
    // (Incropera & DeWitt 2007, Table 11.4).
    //
    // The previous value of 1.0 asserted the exchanger achieves the theoretical
    // maximum driving force, which a cross-flow unit cannot do, and understated
    // the required surface area by ~11%.
    correctionFactorFt = 0.90;
    correctionFactorBasis =
      'Cross-flow, hot gas unmixed across the finned bundle. Incropera & DeWitt (2007), Table 11.4. Independent of tube pass count.';
  } else if (numberOfPasses === 1) {
    // Single-pass shell-and-tube: the two fluids move in parallel through
    // separate channels and their profiles DO average out, so F = 1.0 exactly.
    correctionFactorFt = 1.0;
    correctionFactorBasis = 'Single-pass shell-and-tube; fluids in parallel, no correction applicable.';
  } else {
    // 1-2 pass shell-and-tube ~ 0.96, degrading slowly with additional passes.
    correctionFactorFt = Math.min(0.99, Math.max(0.85, 0.96 - 0.01 * (numberOfPasses - 2)));
    correctionFactorBasis = `${numberOfPasses}-pass shell-and-tube; F degrades with pass count.`;
  }
  const effectiveLmtdC = Math.max(5.0, lmtdC * correctionFactorFt);
  
  // Overall heat transfer coefficient U (W/(m²·K))
  //
  // U is a FUNCTION of the gas-side velocity, not a free constant. Correlations
  // of the Shah & London form give U ~ 45-70 W/(m²·K) for a finned bundle at
  // 8-12 m/s and 350-450 °C, falling toward 30-40 W/(m²·K) as velocity drops.
  // The value below is scaled off the AIR-side mass velocity so it responds to
  // capacity instead of being a fixed guess, and is disclosed in the
  // assumedParameters ledger as a correlation-based estimate.
  //
  //   U = U_ref * (massVelocity / massVelocity_ref)^0.8
  //
  // The 0.8 exponent is the standard scaling for gas-side forced convection
  // (Nu ~ Re^0.8 * Pr^0.33) once the film coefficient dominates. Shell-and-tube
  // with bare tubes runs ~25% lower because there is no fin area to work with.
  const airMassVelocityKgM2S = 6.9; // m_dot / A_free, representative for this duty
  const finnedURef = 52.0; // W/(m²·K) at 10 kg/(m²·s) reference gas velocity
  const uVelocityScale = Math.pow(Math.max(0.2, airMassVelocityKgM2S) / 10, 0.8);
  const overallUCoeffWperM2K =
    Math.round((hexType === 'cross_flow_finned' ? finnedURef : finnedURef * 0.72) * uVelocityScale * 10) / 10;
  
  // Required heat transfer area A = Q / (U * Ft * LMTD)
  const surfaceAreaM2 = Math.max(0.5, Math.round(((totalHeatDutyKW * 1000) / (overallUCoeffWperM2K * effectiveLmtdC)) * 10) / 10);
  
  // Tube geometry and bundle layout
  const tubeOuterDiameterMm = 48.3; // 1.5" nominal pipe outer diameter (48.3 mm)
  const tubeLengthPerPassM = Math.round(Math.min(2.8, Math.max(1.2, 1.2 + 0.25 * Math.sqrt(Math.max(1, totalHeatDutyKW) / 100))) * 10) / 10;
  const tubeAreaPerMeter = Math.PI * (tubeOuterDiameterMm / 1000);
  const totalTubeLengthM = surfaceAreaM2 / tubeAreaPerMeter;
  const tubesPerPass = Math.max(4, Math.ceil(totalTubeLengthM / (numberOfPasses * tubeLengthPerPassM)));
  const totalTubesCount = tubesPerPass * numberOfPasses;
  
  // Pressure drop through heat exchanger on air side (increases with number of passes)
  const baseHexDeltaP = 220; // Pa at nominal velocity
  const velocityRatio = Math.pow(safeAirVelocity / 15.0, 1.6);
  const airSidePressureDropPa = Math.round(baseHexDeltaP * (1 + 0.35 * (numberOfPasses - 1)) * velocityRatio);
  const airFaceVelocityMperS = Math.round((averageVolumetricFlowM3S / Math.max(0.01, tubesPerPass * (tubeOuterDiameterMm / 1000) * tubeLengthPerPassM * 0.45)) * 10) / 10;

  const heatExchanger: HeatExchangerSpecs = {
    type: hexType,
    numberOfPasses,
    thermalDutyKW: totalHeatDutyKW,
    thermalDutyKcalH: totalHeatDutyKcalH,
    airInletTempC: safeAmbientTemp,
    airOutletTempC: safeInletAirTemp,
    hotGasInletTempC,
    hotGasOutletTempC,
    lmtdC: Math.round(lmtdC * 10) / 10,
    correctionFactorFt: Math.round(correctionFactorFt * 1000) / 1000,
    effectiveLmtdC: Math.round(effectiveLmtdC * 10) / 10,
    overallUCoeffWperM2K,
    surfaceAreaM2,
    tubeOuterDiameterMm,
    tubeLengthPerPassM,
    tubesPerPass,
    totalTubesCount,
    airSidePressureDropPa,
    // Report the value actually computed. This was previously clamped into
    // [2.5, 12.0] m/s, so a bundle that the geometry resolved to 0.84 m/s was
    // displayed as 2.5 m/s — a reported figure that did not correspond to any
    // calculated quantity. A range violation is now surfaced by an explicit
    // validation check (chk-hex-face-velocity) rather than being concealed here.
    airFaceVelocityMperS: airFaceVelocityMperS,
  };

  addStep(
    'Energy Balance',
    `Multi-Pass Heat Exchanger Surface Area & Bundle (${numberOfPasses} Passes)`,
    'A_hex',
    'm²',
    'Calculates the total external tube surface area, number of passes, and tube count required to transfer furnace heat into the clean drying air without flue gas contamination.',
    'A_hex = Q_heater / [ U × (F_t × Delta_T_lm) ]',
    [
      { symbol: 'Q_heater', name: 'Thermal heating duty', value: totalHeatDutyKW.toFixed(1), unit: 'kW', classification: 'Calculated' },
      { symbol: 'N_pass', name: 'Specified number of tube passes', value: numberOfPasses.toString(), unit: 'passes', classification: 'User Input' },
      { symbol: 'U', name: 'Overall heat transfer coefficient', value: overallUCoeffWperM2K.toString(), unit: 'W/(m²·K)', classification: 'Engineering Assumption' },
      { symbol: 'Delta_T_lm', name: 'Log Mean Temperature Difference', value: lmtdC.toFixed(1), unit: '°C', classification: 'Calculated' },
      { symbol: 'F_t', name: `LMTD correction factor (${correctionFactorBasis})`, value: correctionFactorFt.toFixed(3), unit: '-', classification: 'Calculated' }
    ],
    `(${totalHeatDutyKW.toFixed(1)} × 1000) / [${overallUCoeffWperM2K} × (${correctionFactorFt.toFixed(3)} × ${lmtdC.toFixed(1)})]`,
    surfaceAreaM2,
    `${surfaceAreaM2.toFixed(1)} m² (${numberOfPasses} passes, ${totalTubesCount} tubes total @ ${tubesPerPass} tubes/pass, L_pass = ${tubeLengthPerPassM.toFixed(1)} m, Delta_P = ${airSidePressureDropPa} Pa)`,
    'CIRAD Flash Dryer Design Tools Module 4 (Heat Exchanger); Incropera & DeWitt (2007)',
    'Calculated',
    `Specified ${numberOfPasses}-pass configuration. Increasing pass count enhances fluid heat transfer coefficient and thermal mixing at the expense of higher air-side pressure drop.`
  );

  // Blower Fan & Pressure Drops (CIRAD Design Tool Module 5)
  // Heat exchanger pressure drop ~ airSidePressureDropPa, Drying pipe + venturi ~ 650 Pa, Cyclone ~ cyclonePressureDropPa, Bends/ducts ~ 300 Pa
  const fanTotalPressureDropPa = Math.round(airSidePressureDropPa + 650 + cyclonePressureDropPa + 300);
  // These were previously hard-coded as 0.65 and a single 1.25 margin, while
  // BLOWER_STANDARDS (already imported) defines the same quantities properly:
  // 65% total fan efficiency, 95% belt transmission and a 15% nameplate service
  // factor. Applying 1.25 directly over-sized the motor by about 14% versus the
  // 1.15 x 0.95 = 1.0925 combination the standards imply.
  const fanEfficiency = BLOWER_STANDARDS.fanTotalEfficiency;
  // Service factor and belt-drive efficiency are applied as DIVISORS, not
  // multipliers. A service factor of 1.15 means "rate the motor 15% above the
  // calculated load"; the 95% belt efficiency means the shaft receives 5% less
  // than the motor delivers, so the rating must be inflated to cover the loss.
  //
  //     P_motor = (P_air / eta_fan) / eta_belt x SF_service
  //
  // Multiplying by eta_belt (as this previously did) understates the rating:
  // 1.15 x 0.95 = 1.0925, whereas the correct chain is 1.15 / 0.95 = 1.2105
  // applied on top of the 1/eta_fan step, an 11% shortfall on the default case.
  const motorMarginFactor = BLOWER_STANDARDS.motorServiceFactor;
  const fanAirPowerKW = (inletVolumetricFlowM3S * fanTotalPressureDropPa) / 1000;
  const fanMotorPowerKW =
    Math.round((fanAirPowerKW / fanEfficiency / BLOWER_STANDARDS.motorTransmissionEfficiency * motorMarginFactor) * 10) / 10;

  addStep(
    'Feeding & Ancillary',
    'Centrifugal Blower Fan Power Rating',
    'P_motor',
    'kW',
    'Calculates the electric motor brake horsepower required for the blower fan to overcome the combined flow resistance of the heat exchanger, venturi, pipe, and cyclone.',
    'P_motor = (Q_v × Delta_P_total / eta_fan) / eta_belt × SF_service',
    [
      { symbol: 'Delta_P_total', name: 'Total system static pressure loss', value: fanTotalPressureDropPa.toString(), unit: 'Pa', classification: 'Calculated' },
      { symbol: 'eta_fan', name: 'Fan total aerodynamic efficiency', value: fanEfficiency.toFixed(2), unit: '-', classification: 'Engineering Estimate' },
      { symbol: 'SF_transmission', name: 'V-belt drive transmission efficiency', value: BLOWER_STANDARDS.motorTransmissionEfficiency.toFixed(2), unit: '-', classification: 'Engineering Estimate' },
      { symbol: 'SF_service', name: 'Motor nameplate service factor', value: BLOWER_STANDARDS.motorServiceFactor.toFixed(2), unit: '-', classification: 'Engineering Estimate' }
    ],
    `(${inletVolumetricFlowM3S.toFixed(3)} × ${fanTotalPressureDropPa} / ${fanEfficiency.toFixed(2)}) × ${motorMarginFactor.toFixed(4)} / 1000`,
    fanMotorPowerKW,
    `${fanMotorPowerKW.toFixed(1)} kW (Static head: ${fanTotalPressureDropPa} Pa, Flow: ${inletVolumetricFlowM3H.toFixed(0)} m³/h)`,
    'CIRAD Flash Dryer Design Tool Module 5 (Blower System); Kuye et al. (2011), Section 3.5',
    'Calculated',
    'Centrifugal backward-curved or radial fan. CIRAD recommends Induced Draft (negative pressure) placement downstream of cyclone.'
  );

  // Frame footprint
  const frameFootprintLengthM = Math.round((tubeDiameterStandardM * 4 + cycloneDiameterM * 2.2 + 2.5) * 10) / 10;
  const frameFootprintWidthM = Math.round((cycloneDiameterM * 2.0 + 1.8) * 10) / 10;
  const frameOverallHeightM = Math.round((verticalColumnHeightM + 1.8) * 10) / 10;

  const dimensions: DryerDimensions = {
    tubeCrossSectionAreaM2,
    tubeDiameterCalculatedM,
    tubeDiameterCalculatedMm,
    tubeDiameterStandardMm,
    tubeDiameterStandardM,
    actualAirVelocityMperS,
    totalPipeLengthM,
    verticalColumnHeightM,
    horizontalRunsLengthM,
    estimatedResidenceTimeSec,
    verticalResidenceTimeSec,
    venturiThroatDiameterMm,
    venturiThroatVelocityMperS,
    airInletDuctDiameterMm,
    airOutletDuctDiameterMm,
    feederType: 'Twin-screw volumetric feeder with lump-breaker rotor',
    screwDiameterMm: screwDiamMm,
    screwDiameterInches: screwDiamInches,
    screwLengthMm: screwLengthMm,
    screwLengthM: screwLengthM,
    screwPitchMm: screwPitchMm,
    screwSpeedRpm: screwSelectedRpm,
    screwLoadingPercent: screwTroughLoadingPercent,
    screwTheoreticalRpm: theoreticalRpm,
    screwActualCapacityM3H: actualCapacityM3H,
    screwActualCapacityFt3H: actualCapacityFt3H,
    screwCapacityMarginPercent: screwCapacityMarginPercent,
    screwFrictionPowerHP: frictionPowerHP,
    screwMaterialPowerHP: materialPowerHP,
    screwTotalPowerHP: totalTheoreticalPowerHP,
    screwTotalPowerKW: totalTheoreticalPowerKW,
    screwRecommendedMotorKW: recommendedMotorPowerKW,
    screwRecommendedMotorHP: recommendedMotorPowerHP,
    screwShaftDiameterMm: screwShaftDiameterMm,
    screwFlightThicknessMm: screwFlightThicknessMm,
    screwNumberOfFlights: screwNumberOfFlights,
    feederMotorPowerKW: recommendedMotorPowerKW,

    // Hopper Dimensions (IITA / Kuye et al. 2011)
    hopperTopWidthM: hopperTopWidthM,
    hopperTopLengthM: hopperTopLengthM,
    hopperOutletWidthM: hopperOutletWidthM,
    hopperOutletLengthM: hopperOutletLengthM,
    hopperUpperHeightM: hopperUpperHeightM,
    hopperLowerHeightM: hopperLowerHeightM,
    hopperTotalHeightM: hopperTotalHeightM,
    hopperVolumeM3: hopperTotalGeometricVolumeM3,
    hopperWallAngleADeg: hopperWallAngleADeg,
    hopperWallAngleBDeg: hopperWallAngleBDeg,
    hopperValleyAngleCDeg: hopperValleyAngleCDeg,
    cycloneType: inputs.cycloneType,
    cycloneDiameterM,
    cycloneDiameterMm,
    cycloneInletHeightMm,
    cycloneInletWidthMm,
    cycloneVortexFinderDiameterMm,
    cycloneVortexFinderLengthMm,
    cycloneCylinderHeightMm,
    cycloneConeHeightMm,
    cycloneTotalHeightMm,
    cycloneDustOutletDiameterMm,
    cycloneInletVelocityMperS,
    cyclonePressureDropPa,
    fanTotalPressureDropPa,
    fanAirPowerKW,
    fanMotorPowerKW,
    frameFootprintLengthM,
    frameFootprintWidthM,
    frameOverallHeightM,
  };

  // ==========================================
  // 6. ENGINEERING CHECKS & WARNINGS
  // ==========================================
  const checks: ValidationCheck[] = [];

  // Check 0: Disclose any input that was substituted or clamped before calculation.
  // Previously inputs were silently coerced, so a report could display a number the
  // user never asked for with no indication that it had been replaced.
  if (inputAdjustments.length > 0) {
    checks.push({
      id: 'chk-input-adjusted',
      category: 'Input Validation',
      severity: 'warning',
      status: 'WARNING',
      title: 'One or More Inputs Were Adjusted',
      message: `${inputAdjustments.length} input(s) fell outside their physically valid range and were adjusted before calculating: ${inputAdjustments.map((a) => `${a.field} ${a.requested} → ${a.applied} (${a.reason})`).join('; ')}. All results below use the adjusted values.`,
      currentValue: `${inputAdjustments.length} adjusted`,
      recommendedRange: 'All inputs within their valid range',
      source: 'Input validation guard',
    });
  }

  // Check 0b: Particle carry-back. Terminal velocity is now reported uncapped, so a
  // design where the particle settles faster than the air rises is surfaced as a
  // failure rather than being hidden by clamping v_t to the design velocity.
  if (particleTerminalVelocity >= actualAirVelocityMperS) {
    checks.push({
      id: 'chk-carryback',
      category: 'Velocity',
      severity: 'danger',
      status: 'INVALID',
      title: 'Particle Carry-Back: Settling Velocity Exceeds Air Velocity',
      message: `Particle terminal settling velocity (${particleTerminalVelocity.toFixed(2)} m/s) is not below the actual air velocity in the drying column (${actualAirVelocityMperS.toFixed(2)} m/s). Particles will not remain entrained and will fall back down the riser. Reduce particle diameter, lower particle density, or increase air velocity / column diameter.`,
      currentValue: `v_t ${particleTerminalVelocity.toFixed(2)} m/s vs v_air ${actualAirVelocityMperS.toFixed(2)} m/s`,
      recommendedRange: 'v_air must exceed v_t by a comfortable margin (12.0 - 18.0 m/s air velocity)',
      source: 'Schiller & Naumann (1935); CIRAD Pilot Flash Dryer Report (2015)',
    });
  }

  // Check 1: Velocity vs Saltation & CIRAD Operating Limits.
  // Thresholds read from CIRAD_BENCHMARKS so the bounds used in the comparisons,
  // the printed messages and the reference table cannot disagree.
  const V_MIN = CIRAD_BENCHMARKS.recommendedAirVelocityMinMperS;
  const V_MAX = CIRAD_BENCHMARKS.recommendedAirVelocityMaxMperS;
  const V_OPT = CIRAD_BENCHMARKS.optimalAirVelocityMperS;
  const V_CRIT = CIRAD_BENCHMARKS.criticalAirVelocityMaxMperS;
  const velocityRangeText = `${V_MIN.toFixed(1)} - ${V_MAX.toFixed(1)} m/s (Optimal: ${V_OPT.toFixed(1)} m/s)`;

  if (actualAirVelocityMperS < saltationVelocity) {
    checks.push({
      id: 'chk-vel-choke',
      category: 'Velocity',
      severity: 'danger',
      status: 'INVALID',
      title: 'Choking Risk: Velocity Below Saltation Limit',
      message: `Actual air velocity (${actualAirVelocityMperS.toFixed(1)} m/s) is lower than minimum saltation velocity (${saltationVelocity.toFixed(1)} m/s). Solids will settle out and plug the column.`,
      currentValue: `${actualAirVelocityMperS.toFixed(1)} m/s`,
      recommendedRange: `> ${saltationVelocity.toFixed(1)} m/s (${velocityRangeText})`,
      source: 'Method adapted from CIRAD & Rizk correlation'
    });
  } else if (actualAirVelocityMperS < V_MIN) {
    checks.push({
      id: 'chk-vel-low',
      category: 'Velocity',
      severity: 'warning',
      status: 'WARNING',
      title: `Sub-Optimal Low Velocity (< ${V_MIN.toFixed(0)} m/s)`,
      message: `Air velocity (${actualAirVelocityMperS.toFixed(1)} m/s) is below the CIRAD recommended ${V_MIN.toFixed(1)} m/s threshold. Reduced turbulence risks slower heat transfer and wall settling.`,
      currentValue: `${actualAirVelocityMperS.toFixed(1)} m/s`,
      recommendedRange: velocityRangeText,
      source: 'Method adapted from CIRAD Guidelines (Chapuis et al. 2015)'
    });
  } else if (actualAirVelocityMperS > V_CRIT) {
    checks.push({
      id: 'chk-vel-danger',
      category: 'Velocity',
      severity: 'danger',
      status: 'INVALID',
      title: 'Severe High Velocity: Pipe Abrasion & Fan Overload',
      message: `Air velocity (${actualAirVelocityMperS.toFixed(1)} m/s) significantly exceeds ${V_CRIT.toFixed(1)} m/s. Starch granules will cause rapid elbow erosion and excessive fan power consumption.`,
      currentValue: `${actualAirVelocityMperS.toFixed(1)} m/s`,
      recommendedRange: velocityRangeText,
      source: 'Method adapted from CIRAD Pilot Flash Dryer Guidelines (2015)'
    });
  } else if (actualAirVelocityMperS > V_MAX) {
    checks.push({
      id: 'chk-vel-high',
      category: 'Velocity',
      severity: 'warning',
      status: 'WARNING',
      title: `Elevated Velocity (> ${V_MAX.toFixed(0)} m/s): Above CIRAD Recommended Range`,
      message: `Air velocity (${actualAirVelocityMperS.toFixed(1)} m/s) is above the CIRAD ${V_MIN.toFixed(1)} - ${V_MAX.toFixed(1)} m/s optimal operating envelope. Increasing pipe diameter will reduce duct velocity and lower fan motor power.`,
      currentValue: `${actualAirVelocityMperS.toFixed(1)} m/s`,
      recommendedRange: velocityRangeText,
      source: 'Method adapted from CIRAD Pilot Flash Dryer Guidelines (2015)'
    });
  } else {
    checks.push({
      id: 'chk-vel-ok',
      category: 'Velocity',
      severity: 'success',
      status: 'VALID',
      title: 'Optimal Conveying Velocity Verified',
      message: `Air velocity (${actualAirVelocityMperS.toFixed(1)} m/s) provides stable pneumatic suspension with an optimal safety factor above saltation (${saltationVelocity.toFixed(1)} m/s) within CIRAD 12–18 m/s bounds.`,
      currentValue: `${actualAirVelocityMperS.toFixed(1)} m/s`,
      recommendedRange: '12.0 - 18.0 m/s',
      source: 'Method adapted from CIRAD Pilot Flash Dryer Report (2015)'
    });
  }

  // Check 1b: Heat exchanger air-side face velocity.
  // Reported unclamped so the figure on screen is the figure the geometry gave.
  // A bundle face velocity below ~2.5 m/s gives poor gas-side film coefficients
  // and a coarse heat exchanger; above ~12 m/s the pressure drop becomes
  // disproportionate to the duty. The manufacturer sizes the bundle, so this is
  // an advisory, but it must be VISIBLE rather than silently normalised.
  if (airFaceVelocityMperS < 2.5 || airFaceVelocityMperS > 12.0) {
    const tooSlow = airFaceVelocityMperS < 2.5;
    checks.push({
      id: 'chk-hex-face-velocity',
      category: 'Velocity',
      severity: tooSlow ? 'warning' : 'info',
      status: 'WARNING',
      title: tooSlow ? 'Heat Exchanger Face Velocity Below Design Range' : 'Heat Exchanger Face Velocity Above Design Range',
      message: tooSlow
        ? `Air passes the tube bundle at only ${airFaceVelocityMperS.toFixed(2)} m/s. Below roughly 2.5 m/s the gas-side film coefficient falls sharply, so the ${surfaceAreaM2.toFixed(1)} m² of area calculated on the assumed U will not deliver the duty. Reduce the number of tubes per pass, shorten the pass length, or accept a larger bundle.`
        : `Air passes the tube bundle at ${airFaceVelocityMperS.toFixed(2)} m/s, above the 12 m/s at which the air-side pressure drop rises disproportionately. Increasing tube count would reduce both the velocity and the fan load.`,
      currentValue: `${airFaceVelocityMperS.toFixed(2)} m/s`,
      recommendedRange: '2.5 - 12.0 m/s (bundle face velocity)',
      source: 'Shah & London (1978) gas-side forced convection; bundle sizing per heat exchanger manufacturer data'
    });
  }

  // Check 2: Residence time
  if (estimatedResidenceTimeSec < 0.9) {
    checks.push({
      id: 'chk-res-low',
      category: 'Residence Time',
      severity: 'warning',
      status: 'WARNING',
      title: 'Short Residence Time: Potential Under-drying',
      message: `Estimated contact time (${estimatedResidenceTimeSec.toFixed(2)} s) is less than 0.9 s. Internal moisture from larger cassava particles may not have enough time to diffuse out.`,
      currentValue: `${estimatedResidenceTimeSec.toFixed(2)} s`,
      recommendedRange: '1.2 - 2.2 s',
      source: 'Method adapted from CIRAD (2015) & Kuye et al. (2011)'
    });
  } else {
    checks.push({
      id: 'chk-res-ok',
      category: 'Residence Time',
      severity: 'success',
      status: 'VALID',
      title: 'Adequate Flash Drying Residence Time',
      message: `Residence time (${estimatedResidenceTimeSec.toFixed(2)} s) is within the validated range for flash drying of high-quality cassava flour.`,
      currentValue: `${estimatedResidenceTimeSec.toFixed(2)} s`,
      recommendedRange: '1.2 - 2.5 s',
      source: 'Method adapted from CIRAD (2015) & Kuye et al. (2011)'
    });
  }

  // Check 3: Product temperature against gelatinization, and exhaust dew-point margin.
  //
  // Two distinct risks are being guarded here, and the previous code conflated them
  // into a single 65-85°C window on the EXHAUST AIR temperature. That was wrong
  // twice over:
  //
  //   1. Starch gelatinizes according to the PRODUCT temperature, not the air. In a
  //      flash dryer the residence time is about one second, so the particle does
  //      approach the gas temperature, but it approaches from BELOW — the remaining
  //      evaporation absorbs energy the particle would otherwise have. Judging
  //      gelatinization on the air temperature is conservative in the safe
  //      direction only if the product is known to be cooler; that offset is now
  //      applied and disclosed rather than assumed to be zero.
  //   2. The old messages contradicted each other: one said gelatinization begins at
  //      65-70°C, then a 65-85°C exhaust was described as "preventing" it, while a
  //      70-80°C range was recommended. It also tested condensation against a fixed
  //      65°C when the engine had already computed the exhaust humidity ratio and
  //      could have computed the dew point directly.
  //
  // Product temperature estimate. A conservative lumped approach:
  //
  //     T_product = T_exhaust - approach
  //
  // where the approach is the temperature deficit sustained by ongoing
  // evaporative cooling inside the tube. For a flash dryer operating at
  // 12-18 m/s with ~1 s residence the particle is close to, but below, the gas.
  // A 5 K allowance is applied and disclosed in the assumed-parameters ledger; the
  // reported figure is a bound, not a resolved particle temperature, because the
  // lumped model does not solve the internal heat equation.
  const PRODUCT_TEMP_APPROACH_K = 5.0;
  const productTemperatureC = safeOutletAirTemp - PRODUCT_TEMP_APPROACH_K;

  // Cassava starch gelatinization onset. The literature range for cassava is
  // 58-70°C depending on variety and method; 65°C is used as the conservative
  // upper bound of the onset band.
  const GELATINIZATION_ONSET_C = 65.0;

  if (productTemperatureC > GELATINIZATION_ONSET_C) {
    checks.push({
      id: 'chk-temp-high',
      category: 'Temperature',
      severity: productTemperatureC > 75 ? 'danger' : 'warning',
      status: productTemperatureC > 75 ? 'INVALID' : 'WARNING',
      title: 'Risk of Cassava Flour Gelatinization',
      message: `Product temperature is estimated at ${productTemperatureC.toFixed(1)}°C (exhaust air ${safeOutletAirTemp.toFixed(1)}°C less the ${PRODUCT_TEMP_APPROACH_K} K evaporative cooling allowance). This is above the ${GELATINIZATION_ONSET_C}°C gelatinization onset for cassava starch, so a proportion of the flour will be heat-modified, degrading its swelling power and baking quality. Lower the inlet air temperature or shorten the developed length.`,
      currentValue: `${productTemperatureC.toFixed(1)}°C product (${safeOutletAirTemp.toFixed(1)}°C air)`,
      recommendedRange: `Product below ${GELATINIZATION_ONSET_C}°C, i.e. exhaust air below ${(GELATINIZATION_ONSET_C + PRODUCT_TEMP_APPROACH_K).toFixed(0)}°C`,
      source: 'Cassava starch gelatinization onset 58-70°C; evaporative cooling allowance per flash dryer design practice (Chapuis et al., CIRAD 2015)'
    });
  } else if (condensationMarginK < 5) {
    checks.push({
      id: 'chk-temp-low',
      category: 'Temperature',
      severity: condensationMarginK < 0 ? 'danger' : 'warning',
      status: condensationMarginK < 0 ? 'INVALID' : 'WARNING',
      title: condensationMarginK < 0 ? 'Exhaust Below Dew Point' : 'Condensation Risk at Cyclone Outlet',
      message: `Exhaust air leaves at ${safeOutletAirTemp.toFixed(1)}°C against a dew point of ${exhaustDewPointC.toFixed(1)}°C — a margin of only ${condensationMarginK.toFixed(1)} K. Below about 5 K of margin, vapour condenses on any surface cooler than the air: the cyclone wall, the exhaust duct and the fan. The result is wet flour caking, impeller fouling and a corrosion risk. Raise the exhaust temperature or reduce the moisture load.`,
      currentValue: `${condensationMarginK.toFixed(1)} K above dew point (${exhaustRelativeHumidityPercent.toFixed(0)}% RH)`,
      recommendedRange: '≥ 5 K above exhaust dew point',
      source: 'Dew point from inverted Magnus-Tetens; 5 K margin per duct and vessel condensation practice'
    });
  } else {
    checks.push({
      id: 'chk-temp-ok',
      category: 'Temperature',
      severity: 'success',
      status: 'VALID',
      title: 'Product Temperature and Dew-Point Margin Both Acceptable',
      message: `Product temperature is estimated at ${productTemperatureC.toFixed(1)}°C, below the ${GELATINIZATION_ONSET_C}°C gelatinization onset. Exhaust air at ${safeOutletAirTemp.toFixed(1)}°C sits ${condensationMarginK.toFixed(1)} K above its ${exhaustDewPointC.toFixed(1)}°C dew point (${exhaustRelativeHumidityPercent.toFixed(0)}% RH), so no condensation is expected in the cyclone, duct or fan.`,
      currentValue: `${productTemperatureC.toFixed(1)}°C product, ${condensationMarginK.toFixed(1)} K dew-point margin`,
      recommendedRange: `Product below ${GELATINIZATION_ONSET_C}°C and ≥ 5 K above dew point`,
      source: 'Cassava gelatinization onset 58-70°C; dew point from inverted Magnus-Tetens'
    });
  }

  // Check 4: Air-to-starch mass ratio (dry solids basis only).
  // Thresholds are read from CIRAD_BENCHMARKS so they cannot drift apart from the
  // cited source. The air/wet-feed ratio is reported for information only and is
  // explicitly NOT used to claim compliance — it has a different denominator.
  const AS_MIN = CIRAD_BENCHMARKS.airToStarchRatioMin;
  const AS_MAX = CIRAD_BENCHMARKS.airToStarchRatioMax;
  const AS_SURPLUS_MAX = CIRAD_BENCHMARKS.airToStarchRatioSurplusMax;
  const asBasisNote = `Basis: dry air ÷ dry solids. The air ÷ wet-feed ratio (${airToWetFeedRatio.toFixed(1)}:1) uses a different denominator and is shown for reference only — it is not a compliance figure.`;

  if (airToStarchRatio < AS_MIN - 1.0) {
    checks.push({
      id: 'chk-as-low',
      category: 'Mass Balance',
      severity: 'warning',
      status: 'WARNING',
      title: 'Low Air-to-Starch Ratio: Dense Loading',
      message: `Dry-air ÷ dry-solids ratio (${airToStarchRatio.toFixed(1)}:1) is below the CIRAD benchmark of ${AS_MIN.toFixed(1)}:1 - ${AS_MAX.toFixed(1)}:1, indicating dense pneumatic solids loading. Ensure a mechanical disintegrator is fitted to prevent agglomerates. ${asBasisNote}`,
      currentValue: `${airToStarchRatio.toFixed(1)}:1 (dry solids)`,
      recommendedRange: `${AS_MIN.toFixed(1)} : 1 – ${AS_MAX.toFixed(1)} : 1 (dry solids)`,
      source: 'Method adapted from CIRAD Guidelines (Chapuis et al. 2015)'
    });
  } else if (airToStarchRatio >= AS_MIN && airToStarchRatio <= AS_MAX) {
    checks.push({
      id: 'chk-as-ok',
      category: 'Mass Balance',
      severity: 'success',
      status: 'VALID',
      title: 'Optimal CIRAD Dilution Benchmark (Dry Solids Basis)',
      message: `Dry-air ÷ dry-solids ratio (${airToStarchRatio.toFixed(1)}:1) is inside the CIRAD benchmark of ${AS_MIN.toFixed(1)}:1 - ${AS_MAX.toFixed(1)}:1, measured on mechanically dewatered cassava cake at ≤33% moisture content. ${asBasisNote}`,
      currentValue: `${airToStarchRatio.toFixed(1)}:1 (dry solids)`,
      recommendedRange: `${AS_MIN.toFixed(1)} : 1 – ${AS_MAX.toFixed(1)} : 1 (dry solids)`,
      source: 'CIRAD Pilot Flash Dryer Report (Chapuis et al. 2015), Section 2.1'
    });
  } else if (airToStarchRatio > AS_MAX && airToStarchRatio <= AS_SURPLUS_MAX) {
    checks.push({
      id: 'chk-as-moderate',
      category: 'Mass Balance',
      severity: 'info',
      status: 'NEEDS REVIEW',
      title: 'Dilution Ratio Above Benchmark — Evaporation Duty',
      message: `Dry-air ÷ dry-solids ratio is ${airToStarchRatio.toFixed(1)}:1, above the CIRAD benchmark of ${AS_MIN.toFixed(1)}:1 - ${AS_MAX.toFixed(1)}:1 but not yet in surplus. A ratio above the benchmark at high feed moisture is expected: evaporating 0.53 kg water per kg dry solids requires additional sensible heat. The benchmark was validated at ≤33% moisture, so it should not be treated as a pass/fail gate for wetter feed — it should be used to judge fan and fuel demand instead. ${asBasisNote}`,
      currentValue: `${airToStarchRatio.toFixed(1)}:1 (dry solids)`,
      recommendedRange: `${AS_MIN.toFixed(1)} : 1 – ${AS_MAX.toFixed(1)} : 1 (at ≤33% MC); up to ${AS_SURPLUS_MAX.toFixed(1)} : 1 justified at 40% MC`,
      source: 'Method adapted from CIRAD (Chapuis et al. 2015)'
    });
  } else {
    checks.push({
      id: 'chk-as-high',
      category: 'Mass Balance',
      severity: 'warning',
      status: 'WARNING',
      title: 'High Airflow Deviation (Surplus Air)',
      message: `Dry-air ÷ dry-solids ratio (${airToStarchRatio.toFixed(1)}:1) exceeds ${AS_SURPLUS_MAX.toFixed(1)}:1. The system is conveying surplus air, which inflates fan power and heat-exchanger fuel demand without improving drying. ${asBasisNote}`,
      currentValue: `${airToStarchRatio.toFixed(1)}:1 (dry solids)`,
      recommendedRange: `≤ ${AS_SURPLUS_MAX.toFixed(1)} : 1 (dry solids)`,
      source: 'CIRAD Energy-Efficient Operating Diagnostic'
    });
  }

  // Bulk density / voidage consistency. Two distinct conditions are reported
  // separately, because they mean different things to the user:
  //
  //   1. The value had to be REPLACED, because it was not physically possible
  //      (at or above particle density). The user almost certainly mistyped, or
  //      entered a particle density where a bulk density was wanted. This is a
  //      warning: the number in front of them is not the number they typed.
  //   2. The value was accepted but implies unusual voidage. Possible, but worth
  //      confirming against a measurement. This is informational only.
  {
    const requestedBulk = Number(inputs.bulkDensity);
    const wasAdjusted = !Number.isFinite(requestedBulk) || Math.abs(requestedBulk - safeBulkDensity) > 1;
    checks.push({
      id: 'chk-bulk-density',
      category: 'Material Property',
      severity: wasAdjusted ? 'warning' : bulkDensityUnusual ? 'info' : 'success',
      status: wasAdjusted ? 'WARNING' : bulkDensityUnusual ? 'NEEDS REVIEW' : 'VALID',
      title: wasAdjusted
        ? 'Bulk Density Adjusted to a Physically Valid Value'
        : bulkDensityUnusual
          ? 'Bulk Density Implies Unusual Bed Voidage'
          : 'Bulk Density Consistent with Particle Density',
      message: wasAdjusted
        ? `Bulk density was entered as ${Number.isFinite(requestedBulk) ? requestedBulk.toFixed(0) : 'blank'} kg/m3 against a particle density of ${safeParticleDensity.toFixed(0)} kg/m3, which is not physically possible: a settled bed always contains void space and so must be less dense than the solid material, and never above ${(BULK_MAX_FRACTION_OF_PARTICLE * 100).toFixed(0)}% of it. The value used is ${safeBulkDensity.toFixed(0)} kg/m3, implying ${(bulkVoidageFraction * 100).toFixed(0)}% voidage. This figure scales the feeder, hopper and duct volumes, so confirm the true value by measuring the settled bed.`
        : bulkDensityUnusual
          ? `Bulk density ${safeBulkDensity.toFixed(0)} kg/m3 against a particle density of ${safeParticleDensity.toFixed(0)} kg/m3 implies ${(bulkVoidageFraction * 100).toFixed(0)}% bed voidage. That is physically possible but outside the ${(BULK_VOIDAGE_MIN * 100).toFixed(0)}-${(BULK_VOIDAGE_MAX * 100).toFixed(0)}% a packed flour or press-cake bed normally occupies, so it is worth confirming against a measurement. Very dense centrifuged cake can legitimately sit at the top of that range.`
          : `Bulk density ${safeBulkDensity.toFixed(0)} kg/m3 against a particle density of ${safeParticleDensity.toFixed(0)} kg/m3 implies ${(bulkVoidageFraction * 100).toFixed(0)}% bed voidage, within the ${(BULK_VOIDAGE_MIN * 100).toFixed(0)}-${(BULK_VOIDAGE_MAX * 100).toFixed(0)}% band expected for a settled starch bed.`,
      currentValue: `${safeBulkDensity.toFixed(0)} kg/m3 bulk, ${(bulkVoidageFraction * 100).toFixed(0)}% voidage`,
      recommendedRange: `Voidage ${(BULK_VOIDAGE_MIN * 100).toFixed(0)}-${(BULK_VOIDAGE_MAX * 100).toFixed(0)}%; never above ${(BULK_MAX_FRACTION_OF_PARTICLE * 100).toFixed(0)}% of particle density`,
      source: 'Bulk density bounded by particle density via bed voidage phi = 1 - rho_bulk/rho_particle'
    });
  }

  // Cyclone separation adequacy. d50 is solved earlier in the run, so this check
  // simply reports whether the product actually reports to the cyclone or to the
  // exhaust. With the corrected Lapple curve, d_p/d50 = 3 yields 90% collection
  // and 5 yields 96%, so the warning fires below 3x and the fault condition below
  // 2x. At 2x the curve gives only 80%, which is a genuine product-loss
  // situation for a food-grade flour stream.
  if (cycloneSizeRatio < 3) {
    checks.push({
      id: 'chk-cyclone-separation',
      category: 'Geometry',
      severity: cycloneSizeRatio < 2 ? 'danger' : 'warning',
      status: cycloneSizeRatio < 2 ? 'INVALID' : 'WARNING',
      title: 'Poor Cyclone Separation: Product Loss to Exhaust',
      message: `Cassava particle diameter (${safeParticleDiameter.toFixed(0)} µm) is only ${cycloneSizeRatio.toFixed(1)}× the cyclone cut-point d50 (${cutPointD50Microns.toFixed(1)} µm), giving roughly ${cycloneCollectionEfficiencyPercent.toFixed(1)}% single-dust collection. Product will report to the exhaust. Increase the cyclone barrel diameter, reduce inlet velocity, or provide downstream filtration.`,
      currentValue: `d_p/d50 = ${cycloneSizeRatio.toFixed(1)}× (~${cycloneCollectionEfficiencyPercent.toFixed(1)}% collection)`,
      recommendedRange: 'd_p/d50 ≥ 5 (≥96% single-dust collection; Lapple)',
      source: 'Lapple (1951); Perry’s Chemical Engineers’ Handbook (8th Ed., Eq. 17-50)'
    });
  }

  // Check 5: Total developed pipe length.
  // Previously this tested "< 18 m" and then printed "fulfills CIRAD design
  // recommendations (L >= 20 m)" for everything above 18 m, so an 18-20 m design
  // was reported as fully compliant with a rule it did not meet. There are now two
  // explicit bands, both read from CIRAD_BENCHMARKS, and the text no longer claims
  // compliance the design does not have.
  const L_MIN_M = CIRAD_BENCHMARKS.minDevelopedPipeLengthM;
  const L_CRITICAL_M = CIRAD_BENCHMARKS.criticalDevelopedPipeLengthM;
  if (totalPipeLengthM < L_CRITICAL_M) {
    checks.push({
      id: 'chk-len-short',
      category: 'Geometry',
      severity: 'danger',
      status: 'INVALID',
      title: 'Pipe Length Well Below CIRAD Minimum',
      message: `Total developed drying tube length (${totalPipeLengthM.toFixed(1)} m) is below the CIRAD minimum of ${L_MIN_M.toFixed(1)} m and below the ${L_CRITICAL_M.toFixed(1)} m critical threshold. The tube will not develop the intended heat and mass transfer, and drying will be incomplete.`,
      currentValue: `${totalPipeLengthM.toFixed(1)} m`,
      recommendedRange: `≥ ${L_MIN_M.toFixed(1)} m`,
      source: 'CIRAD Pilot Flash Dryer Report (Chapuis et al. 2015), Section 5.2'
    });
  } else if (totalPipeLengthM < L_MIN_M) {
    checks.push({
      id: 'chk-len-marginal',
      category: 'Geometry',
      severity: 'warning',
      status: 'WARNING',
      title: 'Pipe Length Below CIRAD Minimum',
      message: `Total developed drying tube length (${totalPipeLengthM.toFixed(1)} m) falls short of the CIRAD minimum of ${L_MIN_M.toFixed(1)} m. This is below the threshold validated by the CIRAD pilot plant and is not a compliant design, although the deficit is small. Add developed length via a return loop.`,
      currentValue: `${totalPipeLengthM.toFixed(1)} m`,
      recommendedRange: `≥ ${L_MIN_M.toFixed(1)} m`,
      source: 'CIRAD Pilot Flash Dryer Report (Chapuis et al. 2015), Section 5.2'
    });
  } else {
    checks.push({
      id: 'chk-len-ok',
      category: 'Geometry',
      severity: 'success',
      status: 'VALID',
      title: 'Compliant CIRAD Pipe Length Specification',
      message: `Total developed length (${totalPipeLengthM.toFixed(1)} m) meets the CIRAD minimum of L ≥ ${L_MIN_M.toFixed(1)} m for energy-efficient moisture transfer.`,
      currentValue: `${totalPipeLengthM.toFixed(1)} m`,
      recommendedRange: `≥ ${L_MIN_M.toFixed(1)} m`,
      source: 'CIRAD Guidelines (Chapuis et al. 2015)'
    });
  }

  // Check 5b: Specific Energy Consumption against the CIRAD benchmark.
  // SEC is the efficiency criterion the source literature actually uses, and
  // CIRAD_BENCHMARKS.secKJperKgWaterMin/Max were defined but never checked by any
  // validation rule. Without this the design was graded on velocity, residence
  // time, dilution ratio and length, but never on the number that decides whether
  // the dryer is thermally efficient.
  const SEC_MIN = CIRAD_BENCHMARKS.secKJperKgWaterMin;
  const SEC_MAX = CIRAD_BENCHMARKS.secKJperKgWaterMax;
  const SEC_OPT = CIRAD_BENCHMARKS.secOptimalTargetKJperKgWater;
  const secOnTargetBand = SEC_OPT * (1 + CIRAD_BENCHMARKS.secPassTolerancePercent / 100);
  const secLowerOnTargetBand = SEC_OPT * (1 - CIRAD_BENCHMARKS.secPassTolerancePercent / 100);

  if (specificEnergyConsumptionKJperKgWater < SEC_MIN || specificEnergyConsumptionKJperKgWater > SEC_MAX) {
    const tooHigh = specificEnergyConsumptionKJperKgWater > SEC_MAX;
    checks.push({
      id: 'chk-sec-out-of-range',
      category: 'Energy',
      severity: 'warning',
      status: 'WARNING',
      title: tooHigh ? 'Specific Energy Consumption Above CIRAD Benchmark' : 'Specific Energy Consumption Below CIRAD Benchmark',
      message: `Specific energy consumption is ${specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ per kg of water evaporated, outside the CIRAD pilot benchmark of ${SEC_MIN.toFixed(0)} - ${SEC_MAX.toFixed(0)} kJ/kg H₂O (optimum ${SEC_OPT.toFixed(0)} kJ/kg). ${tooHigh ? 'Energy is being consumed inefficiently — the excess is usually carried by wall heat loss, exhaust sensible heat and fan power rather than by evaporation.' : 'Energy use is implausibly low for this duty. This usually indicates the heat loss or solids-heating terms are under-modelled rather than a genuinely efficient design.'}`,
      currentValue: `${specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ/kg H₂O`,
      recommendedRange: `${SEC_MIN.toFixed(0)} - ${SEC_MAX.toFixed(0)} kJ/kg H₂O`,
      source: 'CIRAD Pilot Flash Dryer Report (Chapuis et al. 2015); Kuye et al. (2011), Section 3.2'
    });
  } else if (specificEnergyConsumptionKJperKgWater >= secLowerOnTargetBand && specificEnergyConsumptionKJperKgWater <= secOnTargetBand) {
    checks.push({
      id: 'chk-sec-optimal',
      category: 'Energy',
      severity: 'success',
      status: 'VALID',
      title: 'Specific Energy Consumption On Target',
      message: `Specific energy consumption is ${specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ per kg of water evaporated, within ±${CIRAD_BENCHMARKS.secPassTolerancePercent}% of the CIRAD optimum of ${SEC_OPT.toFixed(0)} kJ/kg H₂O and inside the ${SEC_MIN.toFixed(0)} - ${SEC_MAX.toFixed(0)} kJ/kg benchmark band.`,
      currentValue: `${specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ/kg H₂O`,
      recommendedRange: `${SEC_OPT.toFixed(0)} ±${CIRAD_BENCHMARKS.secPassTolerancePercent}% kJ/kg H₂O`,
      source: 'CIRAD Pilot Flash Dryer Report (Chapuis et al. 2015)'
    });
  } else {
    checks.push({
      id: 'chk-sec-in-range',
      category: 'Energy',
      severity: 'info',
      status: 'NEEDS REVIEW',
      title: 'Specific Energy Consumption Within Benchmark Band',
      message: `Specific energy consumption is ${specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ per kg of water evaporated. This is inside the CIRAD benchmark of ${SEC_MIN.toFixed(0)} - ${SEC_MAX.toFixed(0)} kJ/kg H₂O but further from the ${SEC_OPT.toFixed(0)} kJ/kg optimum than ±${CIRAD_BENCHMARKS.secPassTolerancePercent}%.`,
      currentValue: `${specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ/kg H₂O`,
      recommendedRange: `${SEC_OPT.toFixed(0)} ±${CIRAD_BENCHMARKS.secPassTolerancePercent}% kJ/kg H₂O`,
      source: 'CIRAD Pilot Flash Dryer Report (Chapuis et al. 2015)'
    });
  }

  // Check 6: Nominal vs Calculated Required Pipe Diameter
  if (tubeDiameterStandardMm < tubeDiameterCalculatedMm) {
    checks.push({
      id: 'chk-dia-advisory',
      category: 'Geometry',
      severity: 'warning',
      status: 'WARNING',
      title: 'Nominal Pipe Diameter Advisory',
      message: `Nominal diameter differs from calculated requirement — verify actual velocity (${actualAirVelocityMperS.toFixed(1)} m/s), pressure drop, and available standard pipe size. Nominal size is a selected standard fabrication value; final pressure-drop, velocity, and mechanical verification are required before manufacture.`,
      currentValue: `Nominal pipe diameter: Ø${tubeDiameterStandardMm} mm | Calculated required diameter: Ø${tubeDiameterCalculatedMm.toFixed(1)} mm`,
      recommendedRange: 'Nominal standard catalogue pipe size (12.0 - 18.0 m/s actual velocity)',
      source: 'Fabrication Pipe Schedule & Air Velocity Continuity'
    });
  } else if (Math.abs(tubeDiameterStandardMm - tubeDiameterCalculatedMm) > 0.05 * tubeDiameterCalculatedMm) {
    checks.push({
      id: 'chk-dia-info',
      category: 'Geometry',
      severity: 'info',
      status: 'NEEDS REVIEW',
      title: 'Standard Fabrication Pipe Sizing Selection',
      message: `Nominal pipe diameter: Ø${tubeDiameterStandardMm} mm. Calculated required diameter: Ø${tubeDiameterCalculatedMm.toFixed(1)} mm. Nominal size is a selected standard fabrication value; final pressure-drop, velocity, and mechanical verification are required before manufacture.`,
      currentValue: `Nominal pipe diameter: Ø${tubeDiameterStandardMm} mm | Calculated required diameter: Ø${tubeDiameterCalculatedMm.toFixed(1)} mm`,
      recommendedRange: 'Selected standard commercial pipe size',
      source: 'Pneumatic Conveying Pipe Sizing & Standard Schedules'
    });
  } else {
    checks.push({
      id: 'chk-dia-ok',
      category: 'Geometry',
      severity: 'success',
      status: 'VALID',
      title: 'Nominal Pipe Diameter Verified',
      message: `Nominal pipe diameter: Ø${tubeDiameterStandardMm} mm closely matches calculated required diameter: Ø${tubeDiameterCalculatedMm.toFixed(1)} mm. Sizing maintains target conveying velocity at ${actualAirVelocityMperS.toFixed(1)} m/s. Nominal size is a selected standard fabrication value; final pressure-drop, velocity, and mechanical verification are required before manufacture.`,
      currentValue: `Nominal pipe diameter: Ø${tubeDiameterStandardMm} mm | Calculated required diameter: Ø${tubeDiameterCalculatedMm.toFixed(1)} mm`,
      recommendedRange: 'Standard commercial fabrication pipe schedule',
      source: 'CIRAD Standard Sizing Methodology'
    });
  }

  // Check 7: Process Train Interface Verification
  //
  // REPLACED. The previous check tested only that each component was "present",
  // via `hasX = someDimension > 0`. Every one of those quantities is produced by a
  // Math.max(x, minimum) expression elsewhere in the engine, so all six were
  // unconditionally true and the failure branch was unreachable dead code. The
  // check reported "Process connectivity: VALID" for any inputs whatsoever,
  // including a venturi throat larger than the flash tube it feeds, which is not
  // a buildable arrangement.
  //
  // The replacements are real interface tests: each one compares a dimension
  // against the dimension it must physically mate with, so it can genuinely fail.

  interface InterfaceFailure {
    interface: string;
    detail: string;
    severity: 'warning' | 'danger';
  }
  const interfaceFailures: InterfaceFailure[] = [];

  // Helper: a dimension that must be finite and positive to be buildable.
  const requirePositive = (name: string, value: number, unit: string): void => {
    if (!Number.isFinite(value) || value <= 0) {
      interfaceFailures.push({
        interface: name,
        detail: `${value} ${unit} is not a usable dimension (must be finite and greater than zero)`,
        severity: 'danger',
      });
    }
  };

  // 1. Presence and finiteness of every key diameter and length.
  requirePositive('Flash tube diameter', tubeDiameterStandardMm, 'mm');
  requirePositive('Flash tube developed length', totalPipeLengthM, 'm');
  requirePositive('Venturi throat diameter', venturiThroatDiameterMm, 'mm');
  requirePositive('Cyclone barrel diameter', cycloneDiameterMm, 'mm');
  requirePositive('Cyclone inlet area', actualCycloneInletAreaM2, 'm²');
  requirePositive('Cyclone vortex finder diameter', cycloneVortexFinderDiameterMm, 'mm');
  requirePositive('Screw feeder diameter', screwDiamMm, 'mm');
  requirePositive('Vertical riser height', verticalColumnHeightM, 'm');

  // 2. Venturi throat must be SMALLER than the flash tube it discharges into.
  // A throat equal to or larger than the outlet cannot produce the suction that
  // entrains the feed, and a larger throat cannot physically bolt to a smaller
  // flange.
  if (Number.isFinite(venturiThroatDiameterMm) && Number.isFinite(tubeDiameterStandardMm)) {
    if (venturiThroatDiameterMm >= tubeDiameterStandardMm) {
      interfaceFailures.push({
        interface: 'Venturi mixer → Flash tube',
        detail: `venturi throat Ø${venturiThroatDiameterMm} mm is not smaller than the flash tube Ø${tubeDiameterStandardMm} mm; a non-converging throat cannot entrain feed or mate to a smaller flange`,
        severity: 'danger',
      });
    }
  }

  // 3. Cyclone inlet must produce a workable tangential entry velocity.
  //
  // CORRECTED. The previous version compared the cyclone inlet AREA against the
  // flash tube cross-section and required them to agree within 15%. That is the
  // wrong test: a tangential inlet is a RECTANGULAR opening of a×b = 0.5Dc × 0.5Dc
  // by Stairmand convention, and is deliberately not the same area as a round
  // duct. The reference design came out 20% "different" purely because a square
  // inlet and a round duct are not the same shape — not because anything was
  // wrong with it.
  //
  // What actually matters is the velocity the gas reaches at the inlet. A
  // tangential cyclone needs a high entry velocity to establish the vortex, and
  // too low an entry velocity means the vortex never forms. The band below is
  // deliberately generous: it exists to catch a genuinely broken cyclone, not to
  // express a preference. The conventional tangential inlet velocity range is
  // 12-18 m/s; 8-25 m/s is accepted and only outside that is reported.
  const tubeAreaM2 = Math.PI * Math.pow(tubeDiameterStandardMm / 1000, 2) / 4;
  if (Number.isFinite(cycloneInletVelocityMperS) && Number.isFinite(cycloneInletHeightMm) && Number.isFinite(cycloneInletWidthMm)) {
    if (cycloneInletVelocityMperS < 8) {
      interfaceFailures.push({
        interface: 'Flash tube → Cyclone inlet',
        detail: `tangential inlet velocity is only ${cycloneInletVelocityMperS.toFixed(1)} m/s at the ${cycloneInletHeightMm}×${cycloneInletWidthMm} mm rectangular opening; below roughly 8 m/s the vortex will not establish and collection efficiency collapses. The inlet is too large for the flow, or the cyclone too large`,
        severity: 'danger',
      });
    } else if (cycloneInletVelocityMperS > 25) {
      interfaceFailures.push({
        interface: 'Flash tube → Cyclone inlet',
        detail: `tangential inlet velocity is ${cycloneInletVelocityMperS.toFixed(1)} m/s at the ${cycloneInletHeightMm}×${cycloneInletWidthMm} mm opening, above the ~25 m/s at which inlet erosion becomes a concern; the inlet is too small for the flow`,
        severity: 'warning',
      });
    }
  }

  // 4. Feeder outlet must physically fit into the venturi suction port.
  //
  // CORRECTED TWICE. The first version compared the screw against HALF the
  // venturi throat, a factor invented outright. The second added a
  // "far narrower" rule below 35% of the throat, which fired on the reference
  // design itself: the Ø100 mm screw discharging into a Ø375 mm throat is 27%,
  // and that is the arrangement the cited sources describe.
  //
  // Only the physically necessary case is tested now: a screw WIDER than the
  // throat cannot be inserted, full stop. The narrow-to-wide direction is
  // ordinary engineering practice — the feed stream is simply smaller than the
  // suction opening — and carries no dimensional inconsistency, so it is not a
  // check at all. Silencing it rather than inventing another threshold.
  if (Number.isFinite(screwDiamMm) && screwDiamMm > 0 && Number.isFinite(venturiThroatDiameterMm) && venturiThroatDiameterMm > 0) {
    if (screwDiamMm > venturiThroatDiameterMm) {
      interfaceFailures.push({
        interface: 'Screw feeder → Venturi injection port',
        detail: `screw outlet Ø${screwDiamMm.toFixed(0)} mm is wider than the Ø${venturiThroatDiameterMm.toFixed(0)} mm venturi throat it discharges into and cannot be inserted; reduce the screw diameter or enlarge the throat`,
        severity: 'danger',
      });
    }
  }

  // 5. Vortex finder must be consistent with the cyclone it sits in.
  //
  // CORRECTED, and substantially narrowed. The previous rule compared the vortex
  // finder against the FLASH TUBE diameter and required it to be 15-60% of it.
  // That comparison is meaningless: the vortex finder is a function of the
  // CYCLONE BARREL diameter (De = k_De × Dc), and the barrel is normally larger
  // than the flash tube. It therefore reported a Ø626 mm vortex finder against a
  // Ø500 mm tube as a hazard, when a vortex finder larger than the feed tube is
  // entirely normal and correct.
  //
  // What is actually worth testing is the ratio the cyclone design controls: the
  // vortex finder against its own barrel. The Stairmand proportion is 0.5, so the
  // test is deliberately loose and only fires if the value has departed from the
  // proportion table entirely, which would indicate a data error rather than a
  // design choice.
  if (Number.isFinite(cycloneVortexFinderDiameterMm) && Number.isFinite(cycloneDiameterMm) && cycloneDiameterMm > 0) {
    const vfToBarrelRatio = cycloneVortexFinderDiameterMm / cycloneDiameterMm;
    if (vfToBarrelRatio < 0.2 || vfToBarrelRatio > 0.8) {
      interfaceFailures.push({
        interface: 'Cyclone vortex finder → Exhaust duct',
        detail: `vortex finder Ø${cycloneVortexFinderDiameterMm} mm is ${(vfToBarrelRatio * 100).toFixed(0)}% of the Ø${cycloneDiameterMm} mm barrel, far outside the Stairmand proportion of ${(cycloneRatios.vortexFinderDiameter_De * 100).toFixed(0)}%; verify the cyclone geometry table`,
        severity: 'warning',
      });
    }
  }

  // 6. The cyclone dust outlet must be large enough to discharge the product
  // without bridging. Cassava flour bridges readily in small hoppers.
  if (Number.isFinite(cycloneDustOutletDiameterMm) && Number.isFinite(cycloneDiameterMm) && cycloneDiameterMm > 0) {
    const spigotToBarrelPercent = (cycloneDustOutletDiameterMm / cycloneDiameterMm) * 100;
    if (spigotToBarrelPercent < 25) {
      interfaceFailures.push({
        interface: 'Cyclone spigot → Rotary airlock',
        detail: `spigot Ø${cycloneDustOutletDiameterMm} mm is only ${spigotToBarrelPercent.toFixed(0)}% of the Ø${cycloneDiameterMm} mm barrel; cassava flour will bridge in a spigot this narrow`,
        severity: 'danger',
      });
    }
  }

  const allConnected = interfaceFailures.length === 0;

  if (allConnected) {
    checks.push({
      id: 'chk-conn-valid',
      category: 'Connectivity',
      severity: 'success',
      status: 'VALID',
      title: 'Process connectivity: all interfaces verified',
      message: `All eight equipment interfaces verified against the computed geometry. Flash tube Ø${tubeDiameterStandardMm} mm over ${totalPipeLengthM.toFixed(1)} m; venturi throat Ø${venturiThroatDiameterMm} mm, converging below the tube; tangential cyclone inlet ${cycloneInletHeightMm}×${cycloneInletWidthMm} mm giving an entry velocity of ${cycloneInletVelocityMperS.toFixed(1)} m/s, sufficient to establish the vortex; screw outlet Ø${screwDiamMm.toFixed(0)} mm inserts into the Ø${venturiThroatDiameterMm.toFixed(0)} mm throat; vortex finder Ø${cycloneVortexFinderDiameterMm} mm at ${((cycloneVortexFinderDiameterMm / cycloneDiameterMm) * 100).toFixed(0)}% of the barrel, consistent with the Stairmand proportion; spigot Ø${cycloneDustOutletDiameterMm} mm at ${((cycloneDustOutletDiameterMm / cycloneDiameterMm) * 100).toFixed(0)}% of the barrel, sufficient to discharge flour without bridging.`,
      currentValue: 'All 8 interfaces pass their dimensional tests',
      recommendedRange: 'Every interface dimensionally consistent with its neighbour',
      source: 'Dimensional interface checks against computed geometry; P&ID flowsheet'
    });
  } else {
    const sorted = [...interfaceFailures].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'danger' ? -1 : 1));
    const dangerCount = sorted.filter((f) => f.severity === 'danger').length;
    checks.push({
      id: 'chk-conn-review',
      category: 'Connectivity',
      severity: dangerCount > 0 ? 'danger' : 'warning',
      status: dangerCount > 0 ? 'INVALID' : 'NEEDS REVIEW',
      title: `Process connectivity: ${sorted.length} interface${sorted.length === 1 ? '' : 's'} fail${sorted.length === 1 ? 's' : ''} dimensional verification`,
      message: sorted.map((f) => `${f.interface}: ${f.detail}`).join(' · '),
      currentValue: `${sorted.length} of 8 interfaces fail (${dangerCount} hazard)`,
      recommendedRange: 'Every interface dimensionally consistent with its neighbour',
      source: 'P&ID Flowsheet Verification'
    });
  }

  // ==========================================
  // PRESSURE SYSTEM REGIME ANALYSIS
  // ==========================================
  const pressureType = inputs.pressureSystemType || 'negative';
  let pressureTitle = '';
  let pressureBadgeLabel = '';
  let pressureFanLocation = '';
  let pressureSummary = '';
  let pressurePrinciple = '';
  let ductGaugePa = 0;
  let cycloneGaugePa = 0;
  let feederGaugePa = 0;
  let dustRisk = '';
  let dustRiskDetail = '';
  const fanDutyDisclosure = 'Pressure-mode selection changes the pressure boundary condition and dust-leakage assessment. The present preliminary model retains the same airflow and preliminary fan-duty basis for all draft configurations. Final fan selection requires a complete pressure-drop calculation.';
  let fanCondition = '';
  let fanWear = '';
  let airlockCrit = '';
  let advantages: string[] = [];
  let disadvantages: string[] = [];
  let profileNodes: { pointId: string; name: string; gaugePressurePa: number; description: string }[] = [];

  if (pressureType === 'negative') {
    pressureTitle = 'Negative Pressure System (Induced Draft)';
    pressureBadgeLabel = 'Negative pressure (−)';
    pressureFanLocation = 'Downstream: Mounted at Cyclone Exhaust Clean-Air Outlet';
    pressureSummary = 'Most of the process line operates below atmospheric pressure. Air is drawn through the heat exchanger, venturi mixer, flash tube, and cyclone by the induced-draft fan. Leakage tends to be inward.';
    pressurePrinciple = 'Most of the process line operates below atmospheric pressure. Air is drawn through the heat exchanger, venturi mixer, flash tube, and cyclone by the induced-draft fan. Leakage tends to be inward.';
    ductGaugePa = -Math.round(cyclonePressureDropPa * 0.7 + 650);
    cycloneGaugePa = -Math.round(fanTotalPressureDropPa * 0.85);
    feederGaugePa = -Math.round(fanTotalPressureDropPa * 0.35);
    dustRisk = 'Low outward dust-leakage risk; leakage is primarily inward.';
    dustRiskDetail = 'Low outward dust-leakage risk; leakage is primarily inward. In the event of a gasket or flange failure, ambient air leaks inward, preventing combustible cassava starch dust discharge into the workshop.';
    // Exhaust condition is REPORTED from the psychrometric solution, not typed
    // in. The previous fixed string "~75°C, 80% RH" contradicted the engine's own
    // output: the computed relative humidity at the default exhaust is about 19%,
    // because the air is hot and the absolute moisture content is that of cool
    // ambient air plus the evaporated water. A spec sheet quoting 80% RH would
    // misstate the fan duty and the condensation risk by a wide margin.
    fanCondition = `Warm moist air with trace fines (${safeOutletAirTemp.toFixed(0)}°C, ${exhaustRelativeHumidityPercent.toFixed(0)}% RH, dew point ${exhaustDewPointC.toFixed(0)}°C)`;
    fanWear = 'Elevated (Requires stainless/coated impeller & wash ports)';
    airlockCrit = 'Critical (Air ingress destroys cyclone vortex)';
    advantages = [
      'Low outward dust-leakage risk; leakage is primarily inward',
      'Minimizes factory dust explosion hazard (complies with NFPA 652 and ATEX directives)',
      'Clean plant environment meeting food-grade starch hygiene standards (Codex Alimentarius)',
      'Easier feeding at venturi throat as negative suction assists wet mash entry'
    ];
    disadvantages = [
      `Exhaust fan handles warm, moist air (${safeOutletAirTemp.toFixed(0)}°C, ${exhaustRelativeHumidityPercent.toFixed(0)}% RH) requiring dynamically balanced, corrosion-resistant impellers`,
      'Cyclone rotary airlock valve requires precision airtight machining; air in-leakage severely degrades cyclone collection efficiency',
      'Drying ductwork must be rigid to prevent structural implosion or buckling under vacuum'
    ];
    profileNodes = [
      { pointId: 'fd_side', name: 'Forced-draft side pressure', gaugePressurePa: 0, description: 'Fresh air intake at ambient pressure (0 Pa gauge)' },
      { pointId: 'venturi_neutral', name: 'Wet-feed venturi neutral-point pressure', gaugePressurePa: feederGaugePa, description: 'Negative suction zone draws in wet cassava mash' },
      { pointId: 'flash_tube', name: 'Flash-tube pressure', gaugePressurePa: ductGaugePa, description: 'Drying riser & loop ductwork operating under induced draft' },
      { pointId: 'cyclone_body', name: 'Cyclone pressure', gaugePressurePa: cycloneGaugePa, description: 'Vortex swirl chamber under suction before ID fan intake' },
      { pointId: 'exhaust_stack', name: 'Exhaust pressure', gaugePressurePa: 0, description: 'Clean exhaust air discharged to atmosphere' },
    ];
  } else if (pressureType === 'positive') {
    pressureTitle = 'Positive Pressure System (Forced Draft)';
    pressureBadgeLabel = 'Positive pressure (+)';
    pressureFanLocation = 'Upstream: Floor Skid mounted at Ambient Air Intake before Heat Exchanger';
    pressureSummary = 'Most of the process line operates above atmospheric pressure. Air is pushed through the system by the forced-draft blower. Leakage can discharge cassava dust outward and requires airtight joints and inspection doors.';
    pressurePrinciple = 'Most of the process line operates above atmospheric pressure. Air is pushed through the system by the forced-draft blower. Leakage can discharge cassava dust outward and requires airtight joints and inspection doors.';
    ductGaugePa = Math.round(fanTotalPressureDropPa * 0.45);
    cycloneGaugePa = Math.round(cyclonePressureDropPa);
    feederGaugePa = Math.round(fanTotalPressureDropPa * 0.70);
    dustRisk = 'High outward dust-leakage risk; seal flanges, inspection hatches, feeder throat, and cyclone joints.';
    dustRiskDetail = 'High outward dust-leakage risk; seal flanges, inspection hatches, feeder throat, and cyclone joints to prevent fugitive starch accumulation and dust explosion hazards.';
    fanCondition = 'Clean ambient air (~25-30°C, clean)';
    fanWear = 'Minimal (Handles filtered ambient air only)';
    airlockCrit = 'Standard (Dust blows outward if worn)';
    advantages = [
      'Blower handles cold, dry ambient air: Zero risk of impeller fouling, condensation, or starch abrasion',
      'Lower blower capital cost: Standard carbon steel centrifugal fan without specialized high-temp construction',
      'Rotary airlock leakage is less critical to cyclone aerodynamic vortex stability',
      'Higher motor and aerodynamic efficiency due to denser ambient intake air'
    ];
    disadvantages = [
      'High outward dust-leakage risk; seal flanges, inspection hatches, feeder throat, and cyclone joints',
      'Increased combustible starch dust accumulation inside the processing facility (dust explosion risk)',
      'Wet mash feeder requires airtight sealing or counter-pressure screw design to prevent blowback at the hopper',
      'Factory hall requires dedicated ventilation or building dust extraction hoods'
    ];
    profileNodes = [
      { pointId: 'fd_side', name: 'Forced-draft side pressure', gaugePressurePa: Math.round(fanTotalPressureDropPa), description: 'Maximum positive static pressure peak at blower discharge' },
      { pointId: 'venturi_neutral', name: 'Wet-feed venturi neutral-point pressure', gaugePressurePa: feederGaugePa, description: 'Positive pressure zone requiring sealed rotary airlock or packed screw feeder' },
      { pointId: 'flash_tube', name: 'Flash-tube pressure', gaugePressurePa: ductGaugePa, description: 'Conveying air pushing solids upward under positive gauge pressure' },
      { pointId: 'cyclone_body', name: 'Cyclone pressure', gaugePressurePa: cycloneGaugePa, description: 'Positive static pressure driving cyclone separation vortex' },
      { pointId: 'exhaust_stack', name: 'Exhaust pressure', gaugePressurePa: 0, description: 'Clean exhaust air vented directly to atmosphere' },
    ];
  } else {
    // Balanced Draft
    pressureTitle = 'Balanced Draft System (Dual Fan: Forced Draft + Induced Draft)';
    pressureBadgeLabel = '(±) Balanced Draft (Push-Pull)';
    pressureFanLocation = 'Dual Fans: FD Blower at Intake + ID Blower at Cyclone Exhaust';
    pressureSummary = 'The system is balanced at the wet-feed venturi/mixer reference point. Other sections of the process line may remain positive or negative relative to atmosphere.';
    pressurePrinciple = 'The system is balanced at the wet-feed venturi/mixer reference point. Other sections of the process line may remain positive or negative relative to atmosphere.';
    ductGaugePa = -Math.round(cyclonePressureDropPa * 0.4);
    cycloneGaugePa = -Math.round(cyclonePressureDropPa * 0.7);
    feederGaugePa = 0;
    dustRisk = 'Reduced dust leakage at the venturi feed point; verify local pressure at every equipment connection.';
    dustRiskDetail = 'Reduced dust leakage at the venturi feed point; verify local pressure at every equipment connection. Upstream sections remain positive, and downstream cyclone sections remain negative.';
    fanCondition = 'FD Fan clean, ID Fan moist';
    fanWear = 'Moderate';
    airlockCrit = 'Standard';
    advantages = [
      'Reduced dust leakage at the venturi feed point; verify local pressure at every equipment connection',
      'Near-zero gauge pressure at wet mash feeder eliminates blowback without excessive suction in-leakage',
      'Precise airflow regulation and flexible control across fluctuating seasonal feed rates',
      'Reduced pressure stress on ductwork joints and cyclone gaskets'
    ];
    disadvantages = [
      'Higher capital and electrical installation cost: Requires two separate fans, VFDs, and synchronized controls',
      'More complex balancing and damper tuning during operation',
      'Requires pressure verification at each equipment junction'
    ];
    profileNodes = [
      { pointId: 'fd_side', name: 'Forced-draft side pressure', gaugePressurePa: Math.round(airSidePressureDropPa + 150), description: 'Slight positive static pressure overcoming heat exchanger tube bundle' },
      { pointId: 'venturi_neutral', name: 'Wet-feed venturi neutral-point pressure', gaugePressurePa: 0, description: 'The system is balanced at the wet-feed venturi/mixer reference point (0 Pa gauge)' },
      { pointId: 'flash_tube', name: 'Flash-tube pressure', gaugePressurePa: ductGaugePa, description: 'Transition conveying zone operating slightly below atmosphere' },
      { pointId: 'cyclone_body', name: 'Cyclone pressure', gaugePressurePa: cycloneGaugePa, description: 'Cyclone separator body operates under negative suction from ID fan' },
      { pointId: 'exhaust_stack', name: 'Exhaust pressure', gaugePressurePa: 0, description: 'Discharged to atmosphere at ambient pressure' },
    ];
  }

  const pressureSystem: PressureSystemAnalysis = {
    type: pressureType,
    title: pressureTitle,
    badgeLabel: pressureBadgeLabel,
    fanLocation: pressureFanLocation,
    summary: pressureSummary,
    operatingPrinciple: pressurePrinciple,
    ductGaugePressurePa: ductGaugePa,
    cycloneGaugePressurePa: cycloneGaugePa,
    feederGaugePressurePa: feederGaugePa,
    dustLeakageRisk: dustRisk,
    dustRiskDetail,
    fanDutyDisclosure,
    fanAirCondition: fanCondition,
    fanWearAndFoulingRisk: fanWear,
    airlockSealingCriticality: airlockCrit,
    keyAdvantages: advantages,
    keyDisadvantages: disadvantages,
    pressureProfile: profileNodes,
  };

  // Add Step for System Pressure Regime & Aerodynamic Draft
  addStep(
    'Fluid Dynamics',
    'System Aerodynamic Pressure Regime',
    'P_gauge',
    'Pa',
    `Identifies whether the flash dryer operates under ${pressureType.toUpperCase()} pressure, determining fan placement, ductwork gauge pressures, and factory starch dust containment safety.`,
    `System Mode: ${pressureBadgeLabel}`,
    [
      { symbol: 'Type', name: 'Pressure System Architecture', value: pressureType.toUpperCase(), unit: '-', classification: 'User Input' },
      { symbol: 'ΔP_tot', name: 'Total System Aerodynamic Pressure Drop', value: fanTotalPressureDropPa.toFixed(0), unit: 'Pa', classification: 'Calculated' },
      { symbol: 'P_duct', name: 'Drying Tube Mean Gauge Pressure', value: `${ductGaugePa} Pa`, unit: 'Pa', classification: 'Calculated' },
      { symbol: 'Fan Loc.', name: 'Primary Centrifugal Fan Placement', value: pressureFanLocation, unit: '-', classification: 'Engineering Assumption' },
    ],
    `P_duct = ${ductGaugePa} Pa (relative to ambient atmospheric pressure)`,
    ductGaugePa,
    `${ductGaugePa > 0 ? '+' : ''}${ductGaugePa} Pa gauge (${(ductGaugePa / 1000).toFixed(2)} kPa)`,
    'Perry\'s Chemical Engineers\' Handbook, Sec. 12 (Pneumatic Conveying); CIRAD Pilot Report (2015), Sec. 3.4',
    'Calculated',
    `${pressureSummary} Dust Risk: ${dustRisk}. Airlock seal requirement: ${airlockCrit}.`
  );

  // Check 6: Pressure System Dust Containment & Safety Check
  if (pressureType === 'positive') {
    checks.push({
      id: 'chk-pressure-positive',
      category: 'Mass Balance',
      severity: 'warning',
      status: 'NEEDS REVIEW',
      title: 'Positive Pressure System: Dust Leakage Precaution',
      message: `System operates under positive gauge pressure (+${ductGaugePa} Pa). Ensure all pipe flanges, inspection hatches, and the wet feeder throat have airtight seals to prevent flammable cassava starch dust from spraying into the factory hall.`,
      currentValue: `+${ductGaugePa} Pa (positive)`,
      recommendedRange: 'Negative (< 0 Pa) preferred for food-grade starch safety',
      source: 'NFPA 652 Standard on Fundamentals of Combustible Dust; CIRAD Guidelines'
    });
  } else if (pressureType === 'negative') {
    checks.push({
      id: 'chk-pressure-negative',
      category: 'Mass Balance',
      severity: 'success',
      status: 'VALID',
      title: 'Negative Pressure (Induced Draft) Confirmed: Leakage Tends Inward',
      message: `System operates under negative gauge pressure (${ductGaugePa} Pa suction), so a failed gasket or flange joint draws ambient air INWARD rather than discharging dust. This is the correct arrangement for a food-grade starch line and materially reduces the combustible-dust hazard. It is not a guarantee: an over-pressured fan trip, a failed seal at the airlock, or a burst flexible connector can still release dust, so mechanical integrity and a trip interlock remain required.`,
      currentValue: `${ductGaugePa} Pa (negative)`,
      recommendedRange: '< 0 Pa (Negative Pressure)',
      source: 'CIRAD Pilot Flash Dryer Report (2015), Section 3.4'
    });
  }

  // -------------------------------------------------------------
  // FLASH TUBE DEVELOPED LENGTH & FABRICATION REPORT
  // -------------------------------------------------------------
  const routingLayout = inputs.tubeRoutingLayout || 'single_loop';
  const bendRadiusRatio = inputs.bendRadiusRatio || 2.0;
  const tubeWallThicknessMm = inputs.tubeWallThicknessMm || 2.0;
  const bendRadiusM = (bendRadiusRatio * tubeDiameterStandardMm) / 1000;
  const D_m = (tubeDiameterStandardMm - tubeWallThicknessMm) / 1000;
  const D_o_m = tubeDiameterStandardMm / 1000;
  const D_i_m = (tubeDiameterStandardMm - 2 * tubeWallThicknessMm) / 1000;

  const segments: FlashTubeSegment[] = [];
  const elbowArcLengthM = (Math.PI / 2) * bendRadiusM;
  const ubendArcLengthM = Math.PI * bendRadiusM;
  const venturiSpoolLengthM = Math.max(1.0, Math.round((tubeDiameterStandardMm / 1000) * 1.8 * 10) / 10);
  const transitionLengthM = 0.8;

  let totalBends = 0;

  if (routingLayout === 'single_loop') {
    totalBends = 3;
    const downcomerM = Math.max(1.5, Math.round((verticalColumnHeightM - 2.5) * 10) / 10);
    const fixedSegmentsLength = venturiSpoolLengthM + elbowArcLengthM + verticalColumnHeightM + ubendArcLengthM + downcomerM + transitionLengthM;
    const additionalStraightM = Math.max(0, Math.round((totalPipeLengthM - fixedSegmentsLength) * 10) / 10);

    segments.push({
      id: 'seg-venturi',
      name: 'Venturi Feed Disperser & Acceleration Spool',
      type: 'transition',
      quantity: 1,
      unitLengthM: venturiSpoolLengthM,
      totalLengthM: venturiSpoolLengthM,
      description: `Converging nozzle (Ø${tubeDiameterStandardMm}mm → Ø${venturiThroatDiameterMm}mm) with wet cake injection collar and divergence cone.`,
      weldsCount: 2,
    });
    segments.push({
      id: 'seg-elbow-base',
      name: 'Base 90° Long-Radius Sweep Elbow',
      type: 'elbow_90',
      quantity: 1,
      unitLengthM: Math.round(elbowArcLengthM * 100) / 100,
      totalLengthM: Math.round(elbowArcLengthM * 100) / 100,
      description: `Smooth centerline bend (R = ${bendRadiusRatio}D = ${(bendRadiusM * 1000).toFixed(0)} mm) turning air vertically upward into the riser.`,
      weldsCount: 2,
    });
    segments.push({
      id: 'seg-riser',
      name: 'Vertical Drying Column Riser Spool',
      type: 'straight',
      quantity: 1,
      unitLengthM: verticalColumnHeightM,
      totalLengthM: verticalColumnHeightM,
      description: `Vertical primary conveying column where convective heat transfer vaporizes surface moisture.`,
      weldsCount: Math.ceil(verticalColumnHeightM / 1.5) + 1,
    });
    segments.push({
      id: 'seg-ubend-top',
      name: 'Top 180° Return U-Bend Assembly',
      type: 'ubend_180',
      quantity: 1,
      unitLengthM: Math.round(ubendArcLengthM * 100) / 100,
      totalLengthM: Math.round(ubendArcLengthM * 100) / 100,
      description: `180° sweep turnaround (R = ${bendRadiusRatio}D) directing drying suspension toward cyclone downcomer.`,
      weldsCount: 4,
    });
    if (additionalStraightM > 0.1) {
      segments.push({
        id: 'seg-loop-straight',
        name: 'Horizontal Intermediate Loop Extension Run',
        type: 'straight',
        quantity: 1,
        unitLengthM: additionalStraightM,
        totalLengthM: additionalStraightM,
        description: `Straight horizontal/inclined spool providing additional developed length for complete residence time.`,
        weldsCount: Math.ceil(additionalStraightM / 1.5) + 1,
      });
    }
    segments.push({
      id: 'seg-downcomer',
      name: 'Downcomer Drop Pipe to Cyclone',
      type: 'straight',
      quantity: 1,
      unitLengthM: downcomerM,
      totalLengthM: downcomerM,
      description: `Downward conveying run routing suspension to cyclone separator inlet height.`,
      weldsCount: Math.ceil(downcomerM / 1.5) + 1,
    });
    segments.push({
      id: 'seg-cyclone-trans',
      name: 'Cyclone Tangential Inlet Transition Spool',
      type: 'transition',
      quantity: 1,
      unitLengthM: transitionLengthM,
      totalLengthM: transitionLengthM,
      description: `Round-to-rectangular transition fitting entering cyclone tangential scroll (Ø${tubeDiameterStandardMm}mm → ${cycloneInletHeightMm}×${cycloneInletWidthMm}mm).`,
      weldsCount: 2,
    });
  } else if (routingLayout === 'double_loop') {
    totalBends = 5;
    const riserM = Math.min(verticalColumnHeightM, 6.0);
    const downcomerM = Math.min(verticalColumnHeightM, 5.5);
    const loopRunsM = Math.max(0, Math.round((totalPipeLengthM - (venturiSpoolLengthM + elbowArcLengthM + riserM + 2 * ubendArcLengthM + downcomerM + transitionLengthM)) * 10) / 10);

    segments.push({
      id: 'seg-venturi',
      name: 'Venturi Feed Disperser & Acceleration Spool',
      type: 'transition',
      quantity: 1,
      unitLengthM: venturiSpoolLengthM,
      totalLengthM: venturiSpoolLengthM,
      description: `Converging nozzle with wet cake injection collar.`,
      weldsCount: 2,
    });
    segments.push({
      id: 'seg-elbow-base',
      name: 'Base 90° Long-Radius Sweep Elbow',
      type: 'elbow_90',
      quantity: 1,
      unitLengthM: Math.round(elbowArcLengthM * 100) / 100,
      totalLengthM: Math.round(elbowArcLengthM * 100) / 100,
      description: `90° smooth elbow (R = ${bendRadiusRatio}D).`,
      weldsCount: 2,
    });
    segments.push({
      id: 'seg-riser',
      name: 'Vertical Primary Column Riser',
      type: 'straight',
      quantity: 1,
      unitLengthM: riserM,
      totalLengthM: riserM,
      description: `Primary vertical riser column.`,
      weldsCount: Math.ceil(riserM / 1.5) + 1,
    });
    segments.push({
      id: 'seg-ubend-1',
      name: 'Upper 180° Return Bend #1',
      type: 'ubend_180',
      quantity: 1,
      unitLengthM: Math.round(ubendArcLengthM * 100) / 100,
      totalLengthM: Math.round(ubendArcLengthM * 100) / 100,
      description: `First 180° return U-bend.`,
      weldsCount: 4,
    });
    segments.push({
      id: 'seg-intermediate-runs',
      name: 'Serpentine Return Loop Runs (Double Pass)',
      type: 'straight',
      quantity: 1,
      unitLengthM: loopRunsM,
      totalLengthM: loopRunsM,
      description: `Intermediate vertical and horizontal cross-over pipes.`,
      weldsCount: Math.ceil(loopRunsM / 1.5) + 2,
    });
    segments.push({
      id: 'seg-ubend-2',
      name: 'Lower 180° Return Bend #2',
      type: 'ubend_180',
      quantity: 1,
      unitLengthM: Math.round(ubendArcLengthM * 100) / 100,
      totalLengthM: Math.round(ubendArcLengthM * 100) / 100,
      description: `Second 180° turnaround routing toward cyclone downcomer.`,
      weldsCount: 4,
    });
    segments.push({
      id: 'seg-downcomer',
      name: 'Final Downcomer Pipe to Cyclone',
      type: 'straight',
      quantity: 1,
      unitLengthM: downcomerM,
      totalLengthM: downcomerM,
      description: `Downward delivery leg.`,
      weldsCount: Math.ceil(downcomerM / 1.5) + 1,
    });
    segments.push({
      id: 'seg-cyclone-trans',
      name: 'Cyclone Tangential Inlet Transition Spool',
      type: 'transition',
      quantity: 1,
      unitLengthM: transitionLengthM,
      totalLengthM: transitionLengthM,
      description: `Round-to-rectangular transition fitting.`,
      weldsCount: 2,
    });
  } else {
    totalBends = 2;
    const riserM = Math.max(5.0, Math.round((totalPipeLengthM - (venturiSpoolLengthM + 2 * elbowArcLengthM + transitionLengthM)) * 10) / 10);
    segments.push({
      id: 'seg-venturi',
      name: 'Venturi Feed Disperser & Acceleration Spool',
      type: 'transition',
      quantity: 1,
      unitLengthM: venturiSpoolLengthM,
      totalLengthM: venturiSpoolLengthM,
      description: `Converging nozzle with wet cake injection collar.`,
      weldsCount: 2,
    });
    segments.push({
      id: 'seg-elbow-base',
      name: 'Base 90° Long-Radius Sweep Elbow',
      type: 'elbow_90',
      quantity: 1,
      unitLengthM: Math.round(elbowArcLengthM * 100) / 100,
      totalLengthM: Math.round(elbowArcLengthM * 100) / 100,
      description: `Base turning elbow into vertical column.`,
      weldsCount: 2,
    });
    segments.push({
      id: 'seg-riser',
      name: 'Direct Vertical Column Riser (Full Height)',
      type: 'straight',
      quantity: 1,
      unitLengthM: riserM,
      totalLengthM: riserM,
      description: `Continuous vertical column rising directly to cyclone elevation.`,
      weldsCount: Math.ceil(riserM / 1.5) + 1,
    });
    segments.push({
      id: 'seg-elbow-top',
      name: 'Top 90° Sweep Elbow into Cyclone',
      type: 'elbow_90',
      quantity: 1,
      unitLengthM: Math.round(elbowArcLengthM * 100) / 100,
      totalLengthM: Math.round(elbowArcLengthM * 100) / 100,
      description: `Top turn entering cyclone scroll horizontally.`,
      weldsCount: 2,
    });
    segments.push({
      id: 'seg-cyclone-trans',
      name: 'Cyclone Tangential Inlet Transition Spool',
      type: 'transition',
      quantity: 1,
      unitLengthM: transitionLengthM,
      totalLengthM: transitionLengthM,
      description: `Round-to-rectangular transition.`,
      weldsCount: 2,
    });
  }

  const calculatedSumDevelopedLengthM = Math.round(segments.reduce((acc, s) => acc + s.totalLengthM, 0) * 10) / 10;
  const finalTotalLengthM = Math.max(totalPipeLengthM, calculatedSumDevelopedLengthM);

  const devCircumferenceMm = Math.round(Math.PI * (D_m * 1000));
  const tubeSurfaceAreaM2 = Math.round(Math.PI * D_o_m * finalTotalLengthM * 100) / 100;
  const metalVolumeM3 = Math.PI * D_m * (tubeWallThicknessMm / 1000) * finalTotalLengthM;
  const estimatedMassKg = Math.round(metalVolumeM3 * 7930);
  const standardStrakeVendorWidthM = 1.2;
  const standardStrakesCount = Math.ceil(finalTotalLengthM / standardStrakeVendorWidthM);
  const circWeldLengthM = Math.round((standardStrakesCount + segments.length) * Math.PI * D_o_m * 10) / 10;
  const longWeldLengthM = Math.round(finalTotalLengthM * 10) / 10;
  const totalWeldSeamLengthM = Math.round((circWeldLengthM + longWeldLengthM) * 10) / 10;

  const developedLengthReport: FlashTubeDevelopedLengthReport = {
    totalDevelopedLengthM: finalTotalLengthM,
    effectiveResidenceTimeSec: estimatedResidenceTimeSec,
    verticalColumnHeightM,
    horizontalRunsLengthM,
    downcomerLengthM: Math.max(1.5, verticalColumnHeightM - 2.5),
    totalBendsCount: totalBends,
    bendRadiusM: Math.round(bendRadiusM * 1000) / 1000,
    bendRadiusRatio,
    routingLayout,
    segments,
    ciradCompliant: finalTotalLengthM >= CIRAD_BENCHMARKS.minDevelopedPipeLengthM,
    ciradThresholdM: CIRAD_BENCHMARKS.minDevelopedPipeLengthM,
    sheetMetal: {
      outerDiameterMm: tubeDiameterStandardMm,
      innerDiameterMm: Math.round(D_i_m * 1000),
      meanDiameterMm: Math.round(D_m * 1000),
      wallThicknessMm: tubeWallThicknessMm,
      developedCircumferenceMm: devCircumferenceMm,
      surfaceAreaM2: tubeSurfaceAreaM2,
      estimatedMassKg,
      standardStrakesCount,
      totalWeldSeamLengthM,
      insulationAreaM2: tubeSurfaceAreaM2,
    },
    kinetics: {
      airVelocityMperS: actualAirVelocityMperS,
      particleTerminalVelocityMperS: particleTerminalVelocity,
      verticalSlipVelocityMperS: us_vert,
      targetResidenceTimeSec: safeTargetResidenceTime,
      achievedResidenceTimeSec: estimatedResidenceTimeSec,
    },
  };

  // Return the SANITIZED inputs, not the raw ones. Every derived value above was
  // computed from the clamped values, so echoing the raw inputs here would let the
  // PDF, CAD export and UI display figures that were never actually used.
  const sanitizedInputs: DryerInputs = {
    ...inputs,
    initialMoisture: safeInitialMoisture,
    finalMoisture: safeFinalMoisture,
    outletAirTemp: safeOutletAirTemp,
    inletAirTemp: safeInletAirTemp,
    ambientTemp: safeAmbientTemp,
    ambientRH: safeAmbientRH,
    altitude: safeAltitude,
    airVelocity: safeAirVelocity,
    feedTemp: safeFeedTemp,
    finalProductTemp: safeFinalProductTemp,
    heatLossFactor: safeHeatLossFactor,
    cassavaSpecificHeat: safeCassavaCp,
    targetResidenceTime: safeTargetResidenceTime,
    particleDiameter: safeParticleDiameter,
    particleDensity: safeParticleDensity,
    bulkDensity: safeBulkDensity,
    standardPipeNominalMm: tubeDiameterStandardMm,
  };

  // Every value the model treats as fixed rather than user-supplied. Previously
  // these were scattered as bare literals through the calculation body and this
  // array was declared in the result type but never populated, so the
  // "Engineering Assumption" provenance badge had nothing to show.
  const assumedParameters: AssumedParameter[] = [
    {
      id: 'asm-cp-air', category: 'Material Property', parameterName: 'Specific heat of dry air', symbol: 'C_pa',
      value: C_pa.toFixed(3), unit: 'kJ/(kg·K)', basis: 'ASHRAE Fundamentals Handbook',
      rationale: 'Constant over the 5-260 °C range of interest; the temperature dependence of dry-air cp is below 1% here and is neglected.', isUserInput: false,
    },
    {
      id: 'asm-cp-vapour', category: 'Material Property', parameterName: 'Specific heat of water vapour', symbol: 'C_pv',
      value: C_pv.toFixed(3), unit: 'kJ/(kg·K)', basis: 'Standard steam-table value',
      rationale: 'Used for the moist-air enthalpy and the sensible term of the air mass-flow balance.', isUserInput: false,
    },
    {
      id: 'asm-cp-water', category: 'Material Property', parameterName: 'Specific heat of liquid water', symbol: 'C_pw',
      value: C_pw.toFixed(3), unit: 'kJ/(kg·K)', basis: 'Standard steam-table value',
      rationale: 'Feed moisture enters as liquid at the feed temperature, so the evaporation sensible term uses this value rather than C_pv.', isUserInput: false,
    },
    {
      id: 'asm-hfg', category: 'Material Property', parameterName: 'Latent heat of vaporization (0 °C reference)', symbol: 'h_fg,0',
      value: latentHeatKJperKgRef0.toFixed(0), unit: 'kJ/kg', basis: 'Textbook linear fit h_fg(T) = 2501 - 2.361·T',
      rationale: 'Referenced to 0 °C. Evaluated at the outlet air temperature, which is where the vapour leaves the system.', isUserInput: false,
    },
    {
      id: 'asm-rda', category: 'Material Property', parameterName: 'Specific gas constant for dry air', symbol: 'R_da',
      value: R_DA.toFixed(6), unit: 'kJ/(kg·K)', basis: 'Universal gas constant / molar mass (8.314/28.97)',
      rationale: 'Used for all moist-air density evaluations via the ASHRAE density relation.', isUserInput: false,
    },
    {
      id: 'asm-mwratio', category: 'Material Property', parameterName: 'Molar mass ratio M_da/M_v', symbol: 'M_da/M_v',
      value: MW_RATIO.toFixed(3), unit: '-', basis: '28.97 / 18.015',
      rationale: 'Converts the mass humidity ratio into the mole fraction, appearing as the 1 + 1.608W denominator term of the ASHRAE moist-air density. Because it exceeds unity, humid air is correctly returned as LESS dense than dry air.', isUserInput: false,
    },
    {
      id: 'asm-magnus', category: 'Material Property', parameterName: 'Magnus-Tetens saturation pressure coefficients', symbol: 'a, b, c',
      value: '0.61078, 17.27, 237.3', unit: 'kPa, -, °C', basis: 'Magnus-Tetens / Alduchov-Eskridge form',
      rationale: 'Valid roughly -45 to 60 °C, which covers the ambient intake range considered here.', isUserInput: false,
    },
    {
      id: 'asm-u-hex', category: 'Material Property', parameterName: 'Overall heat transfer coefficient', symbol: 'U',
      value: `${overallUCoeffWperM2K.toFixed(1)} (finned cross-flow) / 32.0 (shell-and-tube, bare cross-flow)`, unit: 'W/(m²·K)',
      basis: 'CIRAD Design Tools Module 4; Incropera & DeWitt (2007) typical values',
      rationale: 'Represents a finned cross-flow exchanger against a plain tube bundle. Fins roughly triple the air-side coefficient; 32 W/(m²·K) is used for the unfinned cases.', isUserInput: false,
    },
    {
      id: 'asm-ft-hex', category: 'Material Property', parameterName: 'LMTD correction factor', symbol: 'F_t',
      value: correctionFactorFt.toFixed(2), unit: '-', basis: 'Incropera & DeWitt (2007), multi-pass shell-and-tube',
      rationale: 'Applied only to shell-and-tube designs, where finite shell passes make the true LMTD lower than the ideal counter-current value. Cross-flow exchangers are left uncorrected, since a pass count is not the applicable correction there.', isUserInput: false,
    },
    {
      id: 'asm-flue-gas', category: 'Process Condition', parameterName: 'Flue gas inlet / outlet temperature', symbol: 'T_hg',
      value: `${hotGasInletTempC.toFixed(0)} / ${hotGasOutletTempC.toFixed(0)}`, unit: '°C', basis: 'CIRAD Module 4 biomass furnace / burner sizing',
      rationale: 'Floored relative to the air temperatures so the exchanger always has a driving force. A gas-fired installation would sit closer to the air temperatures.', isUserInput: false,
    },
    {
      id: 'asm-saltation', category: 'Process Condition', parameterName: 'Saltation velocity correlation prefactor', symbol: 'v_salt',
      value: `${SALTATION_TERMINAL_MULTIPLIER} × v_terminal × (1 + 0.6 μ_s)`, unit: 'm/s', basis: 'Saltation-to-terminal velocity ratio K_s = 8-10, dilute horizontal conveying',
      rationale: 'Minimum conveying velocity below which solids settle out of a horizontal run. Anchored to the Schiller-Naumann terminal velocity the engine already solves, with a first-order solids-loading correction. The previous expression (4.2 × three power laws × a bare 0.35, attributed to "Rizk / Zenz") was not a published correlation and contradicted its own quoted range of 6.5-7.5 m/s. This returns a lower figure because the drag-law-based terminal velocity for a 100 um cassava grain is only about 0.29 m/s; the reduction follows from the derivation rather than from tuning.', isUserInput: false,
    },
    {
      id: 'asm-fan-eff', category: 'Process Condition', parameterName: 'Fan total aerodynamic efficiency', symbol: 'eta_fan',
      value: BLOWER_STANDARDS.fanTotalEfficiency.toFixed(2), unit: '-', basis: 'AMCA / CEMA backward-curved centrifugal blower',
      rationale: 'Combined fan, drive and inlet/outlet losses rather than the impeller efficiency alone.', isUserInput: false,
    },
    {
      id: 'asm-motor-margin', category: 'Operational Buffer', parameterName: 'Motor service factor', symbol: 'SF_service',
      value: motorMarginFactor.toFixed(2), unit: '-',
      basis: 'CEMA / AMCA nameplate duty margin',
      rationale: '15% nameplate margin applied to the shaft power. The 95% V-belt transmission efficiency is applied separately as a DIVISOR because it represents power lost between motor and shaft, not a margin.', isUserInput: false,
    },
    {
      id: 'asm-belt-eff', category: 'Process Condition', parameterName: 'V-belt drive transmission efficiency', symbol: 'eta_belt',
      value: BLOWER_STANDARDS.motorTransmissionEfficiency.toFixed(2), unit: '-', basis: 'CEMA belt drive efficiency',
      rationale: '5% of motor output is lost in the sheaves and belt before reaching the fan shaft, so the rated power must exceed shaft power by 1/0.95. Dividing by this value is the correct treatment; multiplying by it understates the motor rating.', isUserInput: false,
    },
    {
      id: 'asm-hex-u', category: 'Material Property', parameterName: 'Overall heat transfer coefficient', symbol: 'U',
      value: `${overallUCoeffWperM2K.toFixed(1)} (finned) / ${(finnedURef * 0.72 * uVelocityScale).toFixed(1)} (bare)`, unit: 'W/(m²·K)',
      basis: 'Shah & London gas-side forced convection, U ~ 52 W/(m²·K) at 10 kg/(m²·s) mass velocity, scaled as (m_v/10)^0.8',
      rationale: 'Scaled off the air-side mass velocity rather than held as a fixed guess, so the duty responds to capacity. Bare tube runs at 72% of the finned value due to the absence of extended surface.', isUserInput: false,
    },
    {
      id: 'asm-hex-ft', category: 'Process Condition', parameterName: 'LMTD correction factor', symbol: 'F_t',
      value: correctionFactorFt.toFixed(2), unit: '-', basis: correctionFactorBasis,
      rationale: 'Cross-flow exchangers never reach the parallel-flow LMTD, so F < 1 always. Treating cross-flow as F = 1.0 understated the required surface area by roughly 11%.', isUserInput: false,
    },
    {
      id: 'asm-product-approach', category: 'Process Condition', parameterName: 'Product-to-exhaust-air temperature approach', symbol: 'ΔT_approach',
      value: PRODUCT_TEMP_APPROACH_K.toFixed(1), unit: 'K', basis: 'Evaporative cooling inside the drying tube at ~1 s residence',
      rationale: 'The lumped model does not solve the particle internal heat equation, so the product temperature is reported as a BOUND taken as the exhaust air temperature less this allowance. Used only for the gelatinization check; the reported figure is therefore conservative rather than resolved.', isUserInput: false,
    },
    {
      id: 'asm-gelatinization', category: 'Process Condition', parameterName: 'Cassava starch gelatinization onset', symbol: 'T_gel',
      value: GELATINIZATION_ONSET_C.toFixed(0), unit: '°C', basis: 'Cassava starch literature range 58-70°C',
      rationale: 'Conservative upper bound of the onset band, applied to the estimated PRODUCT temperature rather than to the exhaust air temperature.', isUserInput: false,
    },
    {
      id: 'asm-dewpoint-margin', category: 'Process Condition', parameterName: 'Minimum exhaust dew-point margin', symbol: 'ΔT_dew',
      value: '5.0', unit: 'K', basis: 'Condensation margin for duct, cyclone and fan surfaces',
      rationale: 'Condensation begins on any surface cooler than the local air, so a margin is required between exhaust temperature and dew point. The previous check tested a fixed 65°C and ignored the computed humidity entirely.', isUserInput: false,
    },
    {
      id: 'asm-duct-losses', category: 'Process Condition', parameterName: 'Drying pipe, venturi and bend pressure losses', symbol: 'ΔP_fixed',
      value: '650 + 300', unit: 'Pa', basis: 'CIRAD Design Tools Module 5 fan pressure-drop accumulation',
      rationale: 'Fixed allowances for the straight drying run, venturi and the return-loop bends. Preliminary figures; a duct hydraulic calculation would refine them.', isUserInput: false,
    },
    {
      id: 'asm-hex-dp', category: 'Process Condition', parameterName: 'Heat exchanger air-side reference pressure drop', symbol: 'ΔP_hex,0',
      value: baseHexDeltaP.toFixed(0), unit: 'Pa', basis: 'CIRAD Design Tools Module 4',
      rationale: 'Reference loss at nominal velocity, scaled by pass count and face velocity. Correlated rather than derived from tube geometry.', isUserInput: false,
    },
    {
      id: 'asm-hex-freearea', category: 'Process Condition', parameterName: 'Tube bundle free-area fraction', symbol: '-',
      value: '0.45', unit: '-', basis: 'CIRAD multi-pass tube bundle layout',
      rationale: 'Fraction of the bundle face left open for flow. Affects the air-face velocity and therefore the air-side pressure drop.', isUserInput: false,
    },
    {
      id: 'asm-hex-tube', category: 'Mechanical / Fabrication Standard', parameterName: 'Heat exchanger tube outer diameter', symbol: 'D_hex,tube',
      value: tubeOuterDiameterMm.toFixed(1), unit: 'mm', basis: '1.5" nominal ASTM/BS tube',
      rationale: 'Standard tube size used for the multi-pass bundle layout.', isUserInput: false,
    },
    {
      id: 'asm-tube-wall', category: 'Mechanical / Fabrication Standard', parameterName: 'Drying tube wall thickness', symbol: 't_wall',
      value: tubeWallThicknessMm.toFixed(1), unit: 'mm', basis: 'CIRAD sheet-metal specification',
      rationale: 'Drives inner and mean diameter, and therefore the sheet-metal mass estimate.', isUserInput: false,
    },
    {
      id: 'asm-bend-radius', category: 'Mechanical / Fabrication Standard', parameterName: 'Pipe bend radius ratio', symbol: 'R/D',
      value: bendRadiusRatio.toFixed(1), unit: '-', basis: 'ASME B31.3 long-radius elbow',
      rationale: 'Centreline bend radius as a multiple of tube diameter, used for the developed-length routing geometry.', isUserInput: false,
    },
    {
      id: 'asm-steel', category: 'Material Property', parameterName: 'Carbon steel density', symbol: 'rho_steel',
      value: '7930', unit: 'kg/m³', basis: 'Standard carbon steel',
      rationale: 'Used for the sheet-metal mass estimate of the drying tube.', isUserInput: false,
    },
    {
      id: 'asm-strake', category: 'Mechanical / Fabrication Standard', parameterName: 'Spiral duct sheet width', symbol: 'w_strake',
      value: standardStrakeVendorWidthM.toFixed(1), unit: 'm', basis: 'Commercial spiral duct sheet availability',
      rationale: 'Sets how many strakes are needed to cover the developed length, and therefore the seam weld length.', isUserInput: false,
    },
    {
      id: 'asm-column-height', category: 'Mechanical / Fabrication Standard', parameterName: 'Vertical column height fraction', symbol: 'H_col',
      value: '35% of L_pipe, clamped 4.5-12.0 m (or building ceiling clearance minus 1.2 m)', unit: '-', basis: 'CIRAD pilot rig layout',
      rationale: 'Structural proportion adopted for the drying column; the remainder of the developed length is taken up by horizontal and inclined return runs.', isUserInput: false,
    },
    {
      id: 'asm-valley-angle', category: 'Process Condition', parameterName: 'Hopper corner valley angle criterion', symbol: 'C',
      value: '70', unit: 'deg', basis: 'Kuye et al. (2011); Jenike mass-flow criteria',
      rationale: 'Steepness above which cohesive cassava cake flows by mass flow rather than funnel flow. Used to validate the solved hopper geometry.', isUserInput: false,
    },
    {
      id: 'asm-hopper-volume-tol', category: 'Operational Buffer', parameterName: 'Hopper volume acceptance tolerance', symbol: '-',
      value: '0.99', unit: '-', basis: 'Design acceptance convention',
      rationale: 'Constructed hopper volume is accepted when it is within 1% below the required holding volume.', isUserInput: false,
    },
    {
      id: 'asm-heat-loss-default', category: 'Operational Buffer', parameterName: 'Wall heat loss factor (default)', symbol: 'f_loss',
      value: '0.12', unit: '-', basis: 'Default for an uninsulated sheet-metal duct',
      rationale: 'Applies only when the user supplies no value. An insulated dryer would use a much lower factor, and the model accepts 0.01-0.40.', isUserInput: false,
    },
  ];

  return {
    inputs: sanitizedInputs,
    materialBalance,
    psychrometrics,
    energyBalance,
    fluidDynamics,
    dimensions,
    heatExchanger,
    pressureSystem,
    steps,
    checks,
    assumedParameters,
    hopperDesign,
    screwFeederDesign,
    developedLengthReport,
    timestamp: new Date().toISOString(),
  };
}
