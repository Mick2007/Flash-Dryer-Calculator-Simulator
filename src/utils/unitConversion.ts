import { UnitSystem } from '../types/dryer';

// ============================================================================
// FLASH DRYER ENGINEERING UNIT CONVERSION CONSTANTS & FUNCTIONS
// ============================================================================

export const KG_TO_LB = 2.2046226218;
export const LB_TO_KG = 1 / KG_TO_LB;
export const M_TO_FT = 3.280839895;
export const FT_TO_M = 1 / M_TO_FT;
export const MM_TO_INCH = 1 / 25.4;
export const INCH_TO_MM = 25.4;
export const M3H_TO_CFM = 0.588577778; // 1 m³/h = ~0.5886 ft³/min
export const CFM_TO_M3H = 1 / M3H_TO_CFM;
export const KW_TO_HP = 1.34102209;
export const HP_TO_KW = 1 / KW_TO_HP;
export const KW_TO_BTU_H = 3412.142;
export const BTU_H_TO_KW = 1 / KW_TO_BTU_H;
export const PA_TO_IN_WG = 0.00401865; // 1 Pa = ~0.00402 in. w.g. (at 4°C / 68°F)
export const IN_WG_TO_PA = 248.84;
export const PA_TO_PSI = 0.0001450377;
export const KJ_KG_TO_BTU_LB = 1 / 2.326; // 1 kJ/kg = 0.429923 BTU/lb

// ----------------------------------------------------------------------------
// Capacity & Mass Conversions
// ----------------------------------------------------------------------------

export function kgHToTonneH(kgH: number): number {
  return kgH / 1000;
}

export function tonneHToKgH(tonneH: number): number {
  return tonneH * 1000;
}

export function kgHToTonneDay(kgH: number, hoursPerDay = 24): number {
  return (kgH * hoursPerDay) / 1000;
}

export function tonneDayToKgH(tonneDay: number, hoursPerDay = 24): number {
  return (tonneDay * 1000) / hoursPerDay;
}

export function kgHToLbH(kgH: number): number {
  return kgH * KG_TO_LB;
}

export function lbHToKgH(lbH: number): number {
  return lbH * LB_TO_KG;
}

export function kgHToShortTonDay(kgH: number, hoursPerDay = 24): number {
  // 1 US short ton = 2000 lb
  return (kgH * KG_TO_LB * hoursPerDay) / 2000;
}

export function shortTonDayToKgH(shortTonDay: number, hoursPerDay = 24): number {
  return (shortTonDay * 2000 * LB_TO_KG) / hoursPerDay;
}

// ----------------------------------------------------------------------------
// Temperature Conversions
// ----------------------------------------------------------------------------

export function celsiusToFahrenheit(c: number): number {
  return c * 1.8 + 32;
}

export function fahrenheitToCelsius(f: number): number {
  return (f - 32) / 1.8;
}

// ----------------------------------------------------------------------------
// Length & Geometry
// ----------------------------------------------------------------------------

export function mmToInches(mm: number): number {
  return mm * MM_TO_INCH;
}

export function inchesToMm(inch: number): number {
  return inch * INCH_TO_MM;
}

export function metersToFeet(m: number): number {
  return m * M_TO_FT;
}

export function feetToMeters(ft: number): number {
  return ft * FT_TO_M;
}

// ----------------------------------------------------------------------------
// Flow Rate & Velocity
// ----------------------------------------------------------------------------

export function m3hToCfm(m3h: number): number {
  return m3h * M3H_TO_CFM;
}

export function cfmToM3h(cfm: number): number {
  return cfm * CFM_TO_M3H;
}

export function mPerSecToFtPerSec(mps: number): number {
  return mps * M_TO_FT;
}

export function mPerSecToFpm(mps: number): number {
  return mps * 196.85; // feet per minute
}

// ----------------------------------------------------------------------------
// Pressure Conversions
// ----------------------------------------------------------------------------

export function paToInWg(pa: number): number {
  return pa * PA_TO_IN_WG;
}

export function inWgToPa(inWg: number): number {
  return inWg * IN_WG_TO_PA;
}

export function paToPsi(pa: number): number {
  return pa * PA_TO_PSI;
}

// ----------------------------------------------------------------------------
// Power & Heat Duty Conversions
// ----------------------------------------------------------------------------

export function kwToHp(kw: number): number {
  return kw * KW_TO_HP;
}

export function hpToKw(hp: number): number {
  return hp * HP_TO_KW;
}

export function kwToBtuH(kw: number): number {
  return kw * KW_TO_BTU_H;
}

export function btuHToKw(btuH: number): number {
  return btuH * BTU_H_TO_KW;
}

export function kjPerKgToBtuPerLb(kjKg: number): number {
  return kjKg * KJ_KG_TO_BTU_LB;
}

// ============================================================================
// SMART DUAL-UNIT FORMATTERS
// ============================================================================

export function formatCapacityDisplay(
  kgH: number,
  unitSystem: UnitSystem,
  options: { includeSecondary?: boolean } = { includeSecondary: true }
): string {
  if (unitSystem === 'tonne') {
    const tH = kgHToTonneH(kgH);
    const tDay = kgHToTonneDay(kgH, 24);
    const primary = `${tH >= 1 ? tH.toFixed(2) : tH.toFixed(3)} t/h (${tDay.toFixed(1)} t/day)`;
    return options.includeSecondary ? `${primary} • ${Math.round(kgH)} kg/h` : primary;
  }

  if (unitSystem === 'imperial') {
    const lbH = kgHToLbH(kgH);
    const tonDay = kgHToShortTonDay(kgH, 24);
    const primary = `${Math.round(lbH).toLocaleString()} lb/h (${tonDay.toFixed(1)} ton/day)`;
    return options.includeSecondary ? `${primary} • ${Math.round(kgH)} kg/h` : primary;
  }

  // Default metric
  const primary = `${Math.round(kgH).toLocaleString()} kg/h`;
  const secondary = `(${kgHToTonneH(kgH).toFixed(2)} t/h • ${kgHToTonneDay(kgH).toFixed(1)} t/day)`;
  return options.includeSecondary ? `${primary} ${secondary}` : primary;
}

export function formatTemperatureDisplay(degC: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const f = Math.round(celsiusToFahrenheit(degC));
    return `${f} °F (${Math.round(degC)} °C)`;
  }
  return `${Math.round(degC)} °C`;
}

export function formatLengthDisplay(meters: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const ft = metersToFeet(meters);
    return `${ft.toFixed(1)} ft (${meters.toFixed(2)} m)`;
  }
  return `${meters.toFixed(2)} m`;
}

export function formatDiameterDisplay(mm: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const inch = mmToInches(mm);
    return `${inch.toFixed(1)}" (${Math.round(mm)} mm)`;
  }
  return `${Math.round(mm)} mm`;
}

export function formatAirFlowDisplay(m3h: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const cfm = Math.round(m3hToCfm(m3h));
    return `${cfm.toLocaleString()} CFM (${Math.round(m3h).toLocaleString()} m³/h)`;
  }
  return `${Math.round(m3h).toLocaleString()} m³/h`;
}

export function formatPressureDisplay(pa: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const inWg = paToInWg(pa);
    return `${inWg.toFixed(2)} in. w.g. (${Math.round(pa)} Pa)`;
  }
  const kPa = pa / 1000;
  return `${Math.round(pa)} Pa (${kPa.toFixed(2)} kPa)`;
}

export function formatPowerDisplay(kw: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const hp = kwToHp(kw);
    return `${hp.toFixed(1)} hp (${kw.toFixed(1)} kW)`;
  }
  return `${kw.toFixed(1)} kW`;
}

export function formatHeatDutyDisplay(kw: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const btu = Math.round(kwToBtuH(kw));
    return `${btu.toLocaleString()} BTU/hr (${kw.toFixed(1)} kW)`;
  }
  return `${kw.toFixed(1)} kW (${Math.round(kw * 860).toLocaleString()} kcal/h)`;
}

export function formatSpecificEnergyDisplay(kjPerKg: number, unitSystem: UnitSystem): string {
  if (unitSystem === 'imperial') {
    const btuLb = Math.round(kjPerKgToBtuPerLb(kjPerKg));
    return `${btuLb.toLocaleString()} BTU/lb H₂O (${Math.round(kjPerKg)} kJ/kg)`;
  }
  return `${Math.round(kjPerKg).toLocaleString()} kJ/kg H₂O`;
}
