import React from 'react';
import {
  Flame,
  Wind,
  Gauge,
  Layers,
  Clock,
  ArrowDownCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  TrendingUp,
  Activity,
  ShieldCheck,
  ShieldAlert,
  ArrowRightLeft,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { CalculationResults, PressureSystemType, UnitSystem } from '../types/dryer';
import {
  formatCapacityDisplay,
  formatHeatDutyDisplay,
  formatDiameterDisplay,
  formatLengthDisplay,
  formatAirFlowDisplay,
  formatPowerDisplay,
  formatPressureDisplay,
  kgHToTonneDay,
  kgHToShortTonDay,
  celsiusToFahrenheit,
  m3hToCfm,
  kwToHp,
  mmToInches,
  metersToFeet,
  paToInWg
} from '../utils/unitConversion';

interface SummaryDashboardProps {
  results: CalculationResults;
  onOpenChecks: () => void;
  unitSystem?: UnitSystem;
  onSelectPressureType?: (type: PressureSystemType) => void;
}

export const SummaryDashboard: React.FC<SummaryDashboardProps> = ({
  results,
  onOpenChecks,
  unitSystem = 'metric',
  onSelectPressureType,
}) => {
  const { materialBalance, energyBalance, dimensions, fluidDynamics, checks, inputs, pressureSystem } = results;

  const criticalChecks = checks.filter((c) => c.severity === 'danger' || c.severity === 'warning');

  // CIRAD ratio rating & thermodynamic equilibrium
  const airToWetRatio = energyBalance.airToWetFeedRatio ?? (energyBalance.airToStarchRatio * (1 - inputs.initialMoisture / 100));
  const isDewateredOptimal = energyBalance.airToStarchRatio >= 9.0 && energyBalance.airToStarchRatio <= 11.5;
  const isThermodynamicallyBalanced = !isDewateredOptimal && energyBalance.airToStarchRatio <= 16.5;

  return (
    <div className="space-y-5">
      {/* Verdict. One line, near the top. This is the answer to the user's question. */}
      {criticalChecks.length > 0 ? (
        <div className="rule-b rule-t border-oxide/25 bg-oxide-wash px-1 py-2.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div className="flex items-start gap-2.5 min-w-0">
            <AlertTriangle className="w-4 h-4 text-oxide shrink-0 mt-0.5" aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-oxide leading-tight">
                {criticalChecks.length} engineering check{criticalChecks.length > 1 ? 's' : ''} require attention
              </p>
              <p className="text-[12px] text-graphite-soft mt-0.5 leading-snug">
                <span className="font-medium text-graphite">{criticalChecks[0].title}.</span>{' '}
                {criticalChecks[0].message}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenChecks}
            className="shrink-0 self-start px-2.5 py-1 text-[11px] font-semibold bg-oxide text-paper hover:opacity-90 transition-opacity"
          >
            Review check
          </button>
        </div>
      ) : (
        <div className="rule-b rule-t border-verdigris/25 bg-verdigris-wash px-1 py-2.5 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-verdigris shrink-0" aria-hidden="true" />
          <p className="text-[13px] text-graphite-soft leading-tight">
            <span className="font-semibold text-verdigris">All engineering checks pass.</span>{' '}
            The design sits within CIRAD limits for velocity, residence time, dilution, length and energy.
          </p>
        </div>
      )}

      {/* Governing figures. Ruled columns separated by hairlines — not boxes. */}
      <div>
        <h2 className="text-[10px] uppercase tracking-widest text-graphite-faint mb-2">Governing dimensions</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 rule-t rule-b">
          <div className="py-2.5 lg:pr-4 lg:rule-r">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Drying tube</div>
            <div className="qty text-[22px] leading-none mt-1 text-graphite">
              {unitSystem === 'imperial'
                ? `${mmToInches(dimensions.tubeDiameterStandardMm).toFixed(1)}`
                : `${dimensions.tubeDiameterStandardMm}`}
              <span className="text-[11px] text-graphite-faint ml-1">{unitSystem === 'imperial' ? 'in' : 'mm'}</span>
            </div>
            <div className="qty text-[10px] text-graphite-faint mt-1">
              {unitSystem === 'imperial'
                ? `req ${mmToInches(dimensions.tubeDiameterCalculatedMm).toFixed(1)} in`
                : `req Ø${dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm`}
            </div>
          </div>

          <div className="py-2.5 lg:px-4 lg:rule-r">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Developed length</div>
            <div className="qty text-[22px] leading-none mt-1 text-graphite">
              {unitSystem === 'imperial'
                ? `${metersToFeet(dimensions.totalPipeLengthM).toFixed(1)}`
                : `${dimensions.totalPipeLengthM.toFixed(1)}`}
              <span className="text-[11px] text-graphite-faint ml-1">{unitSystem === 'imperial' ? 'ft' : 'm'}</span>
            </div>
            <div className="qty text-[10px] text-graphite-faint mt-1">
              riser {unitSystem === 'imperial'
                ? `${metersToFeet(dimensions.verticalColumnHeightM).toFixed(1)} ft`
                : `${dimensions.verticalColumnHeightM.toFixed(1)} m`}
            </div>
          </div>

          <div className="py-2.5 lg:pl-4 lg:pr-4 lg:rule-r">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Air velocity</div>
            <div className={`qty text-[22px] leading-none mt-1 ${
              dimensions.actualAirVelocityMperS < 12 || dimensions.actualAirVelocityMperS > 18
                ? 'text-oxide' : 'text-graphite'
            }`}>
              {dimensions.actualAirVelocityMperS.toFixed(1)}
              <span className="text-[11px] text-graphite-faint ml-1">m/s</span>
            </div>
            <div className="qty text-[10px] text-graphite-faint mt-1">target 12–18 m/s</div>
          </div>

          <div className="py-2.5 lg:pl-4 lg:pr-4 lg:rule-r">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Burner duty</div>
            <div className="qty text-[22px] leading-none mt-1 text-graphite">
              {energyBalance.totalHeatDutyKW.toFixed(1)}
              <span className="text-[11px] text-graphite-faint ml-1">kW</span>
            </div>
            <div className="qty text-[10px] text-graphite-faint mt-1">
              {unitSystem === 'imperial'
                ? `${(energyBalance.totalHeatDutyKW * 3412.14).toFixed(0)} Btu/h`
                : `${energyBalance.totalHeatDutyKcalH.toFixed(0)} kcal/h`}
            </div>
          </div>

          <div className="py-2.5 lg:pl-4 lg:pr-4 lg:rule-r">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Blower motor</div>
            <div className="qty text-[22px] leading-none mt-1 text-graphite">
              {dimensions.fanMotorPowerKW.toFixed(1)}
              <span className="text-[11px] text-graphite-faint ml-1">kW</span>
            </div>
            <div className="qty text-[10px] text-graphite-faint mt-1">
              {unitSystem === 'imperial'
                ? `${paToInWg(dimensions.fanTotalPressureDropPa).toFixed(1)} in.wg`
                : `${dimensions.fanTotalPressureDropPa} Pa`}
            </div>
          </div>

          <div className="py-2.5 lg:pl-4">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Residence time</div>
            <div className="qty text-[22px] leading-none mt-1 text-graphite">
              {dimensions.estimatedResidenceTimeSec.toFixed(2)}
              <span className="text-[11px] text-graphite-faint ml-1">s</span>
            </div>
            <div className="qty text-[10px] text-graphite-faint mt-1">target 1.5 s</div>
          </div>
        </div>
      </div>

      {/* Secondary mass balance. Quieter — these are inputs to the above, not the answer. */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2 rule-b pb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Wet feed</div>
          <div className="qty text-[13px] mt-0.5">
            {unitSystem === 'imperial'
              ? `${(materialBalance.feedRateKgH * 2.20462).toFixed(0)} lb/h`
              : `${materialBalance.feedRateKgH.toFixed(0)} kg/h`}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Water removed</div>
          <div className="qty text-[13px] mt-0.5">
            {unitSystem === 'imperial'
              ? `${(materialBalance.waterRemovedKgH * 2.20462).toFixed(0)} lb/h`
              : `${materialBalance.waterRemovedKgH.toFixed(0)} kg/h`}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Moisture, in → out</div>
          <div className="qty text-[13px] mt-0.5">
            {inputs.initialMoisture}% → {inputs.finalMoisture}%
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Airflow</div>
          <div className="qty text-[13px] mt-0.5">
            {unitSystem === 'imperial'
              ? `${Math.round(m3hToCfm(fluidDynamics.inletVolumetricFlowM3H))} CFM`
              : `${fluidDynamics.inletVolumetricFlowM3H.toFixed(0)} m³/h`}
          </div>
        </div>
      </div>

      {/* AERODYNAMIC PRESSURE REGIME STATUS BAR (POSITIVE vs NEGATIVE PRESSURE) */}
      <div className={`rounded-xl border p-4 shadow-xs transition-all ${
        pressureSystem.type === 'negative'
          ? 'bg-verdigris-wash text-graphite border-verdigris/30'
          : pressureSystem.type === 'positive'
          ? 'bg-oxide-wash text-graphite border-oxide/30'
          : 'bg-paper-sunk text-graphite border-rule-strong'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-1.5">
              <span className="text-[10px] uppercase tracking-widest text-graphite-faint">Pressure regime</span>
              <span className="qty text-[13px]">
                mean duct <strong className="font-semibold">{formatPressureDisplay(pressureSystem.ductGaugePressurePa, unitSystem)}</strong>
                <span className="text-graphite-faint"> · cyclone in </span>
                <strong className="font-semibold">{formatPressureDisplay(pressureSystem.cycloneGaugePressurePa, unitSystem)}</strong>
              </span>
              <span className="text-[11px] text-graphite-soft font-medium">
                {pressureSystem.dustLeakageRisk}
              </span>
            </div>

            <h3 className="text-[15px] font-semibold leading-snug">
              {pressureSystem.type === 'negative' ? (
                <>Induced draft. Recommended for cassava starch.</>
              ) : pressureSystem.type === 'positive' ? (
                <>Forced draft. Clean cold blower, but leaks release dust.</>
              ) : (
                <>Balanced draft, push-pull on two blowers.</>
              )}
            </h3>

            <p className="argument !text-[13px] !leading-relaxed mt-1.5">
              {pressureSystem.summary}
            </p>
            {pressureSystem.fanDutyDisclosure && (
              <p className="text-[11px] text-graphite-soft border-l-2 border-brass/50 pl-2.5 mt-2 leading-relaxed max-w-[62ch]">
                <span className="font-semibold text-graphite">Fan duty is preliminary.</span>{' '}
                {pressureSystem.fanDutyDisclosure}
              </p>
            )}
          </div>

          {/* Regime switch */}
          {onSelectPressureType && (
            <div className="shrink-0">
              <div role="group" aria-label="Pressure regime" className="inline-flex border border-rule-strong text-[11px] font-medium">
                {(['negative', 'positive', 'balanced'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    aria-pressed={pressureSystem.type === mode}
                    onClick={() => onSelectPressureType(mode)}
                    className={`px-2.5 py-1 transition-colors ${
                      pressureSystem.type === mode
                        ? 'bg-graphite text-paper font-semibold'
                        : 'text-graphite-soft hover:text-graphite'
                    }`}
                    title={
                      mode === 'negative'
                        ? 'Induced draft — air drawn inward, no dust leakage'
                        : mode === 'positive'
                          ? 'Forced draft — blower upstream, leaks release dust'
                          : 'Balanced push-pull on two blowers'
                    }
                  >
                    {mode === 'negative' ? 'Negative' : mode === 'positive' ? 'Positive' : 'Balanced'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Benchmark alignment against the source literature. */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rule-t pt-3 text-[11px]">
        <div className="flex items-baseline gap-2">
          <span className="text-graphite-faint uppercase tracking-widest text-[10px]">Air to starch</span>
          <span className="qty text-[15px] text-graphite font-semibold">
            {energyBalance.airToStarchRatio.toFixed(2)}:1
          </span>
          <span className="text-graphite-faint">
            dry solids · {airToWetRatio.toFixed(2)}:1 on wet feed
          </span>
        </div>

        <div className="flex items-center gap-2 text-graphite-faint">
          <span>CIRAD target</span>
          <span className="qty text-graphite-soft">9.0–11.0:1 at ≤33% MC</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-graphite-faint">Energy</span>
          <span className="qty text-graphite font-semibold">
            {energyBalance.specificEnergyConsumptionKJperKgWater.toFixed(0)} kJ/kg H₂O
          </span>
        </div>

        <div>
          {isDewateredOptimal ? (
            <span className="text-verdigris font-medium">Within CIRAD benchmark</span>
          ) : isThermodynamicallyBalanced ? (
            <span className="text-advisory font-medium" title="Sensible heat required to evaporate moisture from wetter feed">
              Evaporation duty at {inputs.initialMoisture}% MC
            </span>
          ) : (
            <span className="text-oxide font-medium">Above 16.5:1, surplus air</span>
          )}
        </div>
      </div>
    </div>
  );
};
