import React, { useState, useMemo } from 'react';
import {
  GitCompare,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Equal,
  Sparkles,
  Zap,
  Flame,
  Wind,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Check,
  RotateCcw,
  Sliders,
  Download,
  Info
} from 'lucide-react';
import { CalculationResults, DryerInputs, UnitSystem } from '../types/dryer';
import { calculateFlashDryer } from '../utils/dryerCalculations';
import { CIRAD_PILOT_BENCHMARK } from '../utils/constants';
import {
  formatCapacityDisplay,
  formatTemperatureDisplay,
  formatLengthDisplay,
  formatDiameterDisplay,
  formatAirFlowDisplay,
  formatPowerDisplay,
  formatHeatDutyDisplay,
  formatSpecificEnergyDisplay,
  formatPressureDisplay,
  kgHToTonneH,
  kgHToTonneDay,
  kgHToLbH,
  kgHToShortTonDay,
  kwToBtuH,
  kwToHp,
  m3hToCfm,
  mmToInches,
  metersToFeet,
  paToInWg
} from '../utils/unitConversion';

interface DesignComparisonProps {
  currentResults: CalculationResults;
  onApplyScenarioToActive: (inputs: DryerInputs) => void;
  unitSystem: UnitSystem;
  onUnitSystemChange: (system: UnitSystem) => void;
}

export const DesignComparison: React.FC<DesignComparisonProps> = ({
  currentResults,
  onApplyScenarioToActive,
  unitSystem,
  onUnitSystemChange,
}) => {
  // Scenario A defaults to current results inputs
  const [scenarioAInputs, setScenarioAInputs] = useState<DryerInputs>(currentResults.inputs);

  // Scenario B defaults to an alternative benchmark (e.g. 500 kg/h commercial scale, or modified)
  const [scenarioBInputs, setScenarioBInputs] = useState<DryerInputs>(() => {
    return {
      ...currentResults.inputs,
      capacityMode: 'product',
      desiredProductRate: Math.max(250, currentResults.inputs.desiredProductRate * 2),
      feedRate: Math.max(400, currentResults.inputs.feedRate * 2),
    };
  });

  const [activeScenarioEdit, setActiveScenarioEdit] = useState<'A' | 'B'>('B');

  // Compute results for both scenarios
  const resultsA = useMemo(() => calculateFlashDryer(scenarioAInputs), [scenarioAInputs]);
  const resultsB = useMemo(() => calculateFlashDryer(scenarioBInputs), [scenarioBInputs]);

  // Delta Helper
  const calcDelta = (valA: number, valB: number) => {
    if (valA === 0) return { diff: valB, pct: 0 };
    const diff = valB - valA;
    const pct = ((valB - valA) / valA) * 100;
    return { diff, pct };
  };

  // Preset loading for Scenario B
  const loadPresetIntoScenario = (presetName: string, target: 'A' | 'B') => {
    let preset: DryerInputs;
    switch (presetName) {
      case 'cirad_pilot':
        preset = { ...CIRAD_PILOT_BENCHMARK, pressureSystemType: 'negative' };
        break;
      case 'commercial_500':
        preset = {
          ...CIRAD_PILOT_BENCHMARK,
          capacityMode: 'product',
          desiredProductRate: 500,
          feedRate: 833,
          airVelocity: 15,
          inletAirTemp: 170,
          outletAirTemp: 75,
          pressureSystemType: 'negative',
        };
        break;
      case 'industrial_1500':
        preset = {
          ...CIRAD_PILOT_BENCHMARK,
          capacityMode: 'product',
          desiredProductRate: 1500,
          feedRate: 2500,
          airVelocity: 16,
          inletAirTemp: 180,
          outletAirTemp: 75,
          pressureSystemType: 'negative',
        };
        break;
      case 'positive_pressure':
        preset = {
          ...currentResults.inputs,
          pressureSystemType: 'positive',
        };
        break;
      case 'negative_pressure':
        preset = {
          ...currentResults.inputs,
          pressureSystemType: 'negative',
        };
        break;
      case 'high_efficiency_150':
        preset = {
          ...currentResults.inputs,
          inletAirTemp: 150,
          outletAirTemp: 70,
          heatLossFactor: 0.08,
        };
        break;
      default:
        preset = { ...currentResults.inputs };
    }

    if (target === 'A') setScenarioAInputs(preset);
    else setScenarioBInputs(preset);
  };

  const copyCurrentToScenario = (target: 'A' | 'B') => {
    if (target === 'A') setScenarioAInputs({ ...currentResults.inputs });
    else setScenarioBInputs({ ...currentResults.inputs });
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Unit Selector Toolbar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <GitCompare className="w-5 h-5" />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              Dual Design &amp; Operating Scenario Comparison
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Compare capacity scales, thermal efficiencies, tube diameters, fan power, and positive vs. negative pressure regimes side-by-side.
          </p>
        </div>

        {/* Unit System Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-semibold text-slate-500">Unit Display:</span>
          <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-50 text-xs font-medium">
            <button
              type="button"
              onClick={() => onUnitSystemChange('metric')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                unitSystem === 'metric'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Metric (kg/h, m)
            </button>
            <button
              type="button"
              onClick={() => onUnitSystemChange('tonne')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                unitSystem === 'tonne'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tonnes (t/h, t/day)
            </button>
            <button
              type="button"
              onClick={() => onUnitSystemChange('imperial')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                unitSystem === 'imperial'
                  ? 'bg-emerald-600 text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Imperial (lb/h, °F, in, CFM)
            </button>
          </div>
        </div>
      </div>

      {/* Preset Quick Loader Buttons */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex items-center flex-wrap gap-2 text-xs">
        <span className="font-bold text-slate-700 mr-1 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          Load Benchmark into Scenario B:
        </span>
        <button
          type="button"
          onClick={() => loadPresetIntoScenario('cirad_pilot', 'B')}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md font-medium text-slate-700 transition-colors shadow-2xs"
        >
          CIRAD Pilot (80 kg/h)
        </button>
        <button
          type="button"
          onClick={() => loadPresetIntoScenario('commercial_500', 'B')}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md font-medium text-slate-700 transition-colors shadow-2xs"
        >
          Commercial (0.50 t/h • 500 kg/h)
        </button>
        <button
          type="button"
          onClick={() => loadPresetIntoScenario('industrial_1500', 'B')}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md font-medium text-slate-700 transition-colors shadow-2xs"
        >
          Industrial Factory (1.5 t/h • 36 t/day)
        </button>
        <button
          type="button"
          onClick={() => loadPresetIntoScenario('positive_pressure', 'B')}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-amber-300 text-amber-900 rounded-md font-medium transition-colors shadow-2xs"
        >
          Test Positive (+)
        </button>
        <button
          type="button"
          onClick={() => loadPresetIntoScenario('negative_pressure', 'B')}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-emerald-300 text-emerald-900 rounded-md font-medium transition-colors shadow-2xs"
        >
          Test Negative (−)
        </button>
        <button
          type="button"
          onClick={() => loadPresetIntoScenario('high_efficiency_150', 'B')}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 rounded-md font-medium text-slate-700 transition-colors shadow-2xs"
        >
          Eco-Model (150°C Low-Heat)
        </button>
      </div>

      {/* Two-Column Comparison Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SCENARIO A */}
        <div className="bg-white rounded-xl border-2 border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-slate-800 text-white text-xs font-bold flex items-center justify-center">
                  A
                </span>
                <h3 className="font-bold text-sm text-slate-900">Scenario A (Baseline / Reference)</h3>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {resultsA.materialBalance.productRateKgH.toFixed(0)} kg/h HQCF Output • {resultsA.inputs.inletAirTemp}°C Inlet
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyCurrentToScenario('A')}
                className="px-2 py-1 rounded bg-white border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                title="Sync with current simulator inputs"
              >
                Sync with Simulator
              </button>
              <button
                type="button"
                onClick={() => onApplyScenarioToActive(scenarioAInputs)}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-900 text-white text-[11px] font-bold shadow-xs"
                title="Apply Scenario A parameters to active 3D model & simulator"
              >
                Apply to Simulator
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* Pressure Badge */}
            <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
              resultsA.pressureSystem.type === 'negative'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : resultsA.pressureSystem.type === 'positive'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}>
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4" />
                <span className="font-bold">{resultsA.pressureSystem.badgeLabel}</span>
              </div>
              <span className="font-mono text-[11px] font-bold">
                {formatPressureDisplay(Math.abs(resultsA.pressureSystem.ductGaugePressurePa), unitSystem)}
              </span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Dry Flour Yield</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {formatCapacityDisplay(resultsA.materialBalance.productRateKgH, unitSystem, { includeSecondary: false })}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Feed: {formatCapacityDisplay(resultsA.materialBalance.feedRateKgH, unitSystem, { includeSecondary: false })}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Thermal Heat Duty</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {formatHeatDutyDisplay(resultsA.energyBalance.totalHeatDutyKW, unitSystem)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Eff: {resultsA.energyBalance.thermalEfficiency.toFixed(1)}%
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Drying Tube &amp; Height</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  Ø{formatDiameterDisplay(resultsA.dimensions.tubeDiameterStandardMm, unitSystem)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Riser: {formatLengthDisplay(resultsA.dimensions.verticalColumnHeightM, unitSystem)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Blower Fan Power</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {formatPowerDisplay(resultsA.dimensions.fanMotorPowerKW, unitSystem)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Flow: {formatAirFlowDisplay(resultsA.fluidDynamics.averageVolumetricFlowM3H, unitSystem)}
                </span>
              </div>
            </div>

            {/* In-place quick controls for Scenario A */}
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold text-slate-700 block mb-2">Adjust Scenario A Target:</span>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Product Rate (kg/h):</label>
                  <input
                    type="number"
                    min={10}
                    max={10000}
                    value={scenarioAInputs.desiredProductRate}
                    onChange={(e) => {
                      const val = Math.max(10, parseFloat(e.target.value) || 80);
                      const feedRatio = (100 - scenarioAInputs.finalMoisture) / (100 - scenarioAInputs.initialMoisture);
                      setScenarioAInputs({
                        ...scenarioAInputs,
                        capacityMode: 'product',
                        desiredProductRate: val,
                        feedRate: Math.round(val * feedRatio),
                      });
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Inlet Temp (°C):</label>
                  <input
                    type="number"
                    min={120}
                    max={250}
                    value={scenarioAInputs.inletAirTemp}
                    onChange={(e) => {
                      setScenarioAInputs({
                        ...scenarioAInputs,
                        inletAirTemp: Math.max(120, Math.min(250, parseFloat(e.target.value) || 170)),
                      });
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SCENARIO B */}
        <div className="bg-white rounded-xl border-2 border-emerald-400 shadow-md overflow-hidden flex flex-col">
          <div className="p-4 bg-emerald-50/70 border-b border-emerald-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  B
                </span>
                <h3 className="font-bold text-sm text-slate-900">Scenario B (Proposed / Alternative)</h3>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {resultsB.materialBalance.productRateKgH.toFixed(0)} kg/h HQCF Output • {resultsB.inputs.inletAirTemp}°C Inlet
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => copyCurrentToScenario('B')}
                className="px-2 py-1 rounded bg-white border border-slate-300 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                title="Sync with current simulator inputs"
              >
                Sync with Simulator
              </button>
              <button
                type="button"
                onClick={() => onApplyScenarioToActive(scenarioBInputs)}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold shadow-xs"
                title="Apply Scenario B parameters to active 3D model & simulator"
              >
                Apply to Simulator
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 flex-1">
            {/* Pressure Badge */}
            <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
              resultsB.pressureSystem.type === 'negative'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : resultsB.pressureSystem.type === 'positive'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-sky-50 border-sky-200 text-sky-900'
            }`}>
              <div className="flex items-center gap-2">
                <Wind className="w-4 h-4" />
                <span className="font-bold">{resultsB.pressureSystem.badgeLabel}</span>
              </div>
              <span className="font-mono text-[11px] font-bold">
                {formatPressureDisplay(Math.abs(resultsB.pressureSystem.ductGaugePressurePa), unitSystem)}
              </span>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Dry Flour Yield</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {formatCapacityDisplay(resultsB.materialBalance.productRateKgH, unitSystem, { includeSecondary: false })}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Feed: {formatCapacityDisplay(resultsB.materialBalance.feedRateKgH, unitSystem, { includeSecondary: false })}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Thermal Heat Duty</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {formatHeatDutyDisplay(resultsB.energyBalance.totalHeatDutyKW, unitSystem)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Eff: {resultsB.energyBalance.thermalEfficiency.toFixed(1)}%
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Drying Tube &amp; Height</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  Ø{formatDiameterDisplay(resultsB.dimensions.tubeDiameterStandardMm, unitSystem)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Riser: {formatLengthDisplay(resultsB.dimensions.verticalColumnHeightM, unitSystem)}
                </span>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 block text-[10px] uppercase font-semibold">Blower Fan Power</span>
                <span className="text-sm font-bold text-slate-900 font-mono">
                  {formatPowerDisplay(resultsB.dimensions.fanMotorPowerKW, unitSystem)}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  Flow: {formatAirFlowDisplay(resultsB.fluidDynamics.averageVolumetricFlowM3H, unitSystem)}
                </span>
              </div>
            </div>

            {/* In-place quick controls for Scenario B */}
            <div className="border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold text-slate-700 block mb-2">Adjust Scenario B Target:</span>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Product Rate (kg/h):</label>
                  <input
                    type="number"
                    min={10}
                    max={10000}
                    value={scenarioBInputs.desiredProductRate}
                    onChange={(e) => {
                      const val = Math.max(10, parseFloat(e.target.value) || 250);
                      const feedRatio = (100 - scenarioBInputs.finalMoisture) / (100 - scenarioBInputs.initialMoisture);
                      setScenarioBInputs({
                        ...scenarioBInputs,
                        capacityMode: 'product',
                        desiredProductRate: val,
                        feedRate: Math.round(val * feedRatio),
                      });
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Inlet Temp (°C):</label>
                  <input
                    type="number"
                    min={120}
                    max={250}
                    value={scenarioBInputs.inletAirTemp}
                    onChange={(e) => {
                      setScenarioBInputs({
                        ...scenarioBInputs,
                        inletAirTemp: Math.max(120, Math.min(250, parseFloat(e.target.value) || 170)),
                      });
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-bold"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 block mb-0.5">Pressure Draft:</label>
                  <select
                    value={scenarioBInputs.pressureSystemType || 'negative'}
                    onChange={(e) => {
                      setScenarioBInputs({
                        ...scenarioBInputs,
                        pressureSystemType: e.target.value as any,
                      });
                    }}
                    className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 font-bold"
                  >
                    <option value="negative">Negative (-)</option>
                    <option value="positive">Positive (+)</option>
                    <option value="balanced">Balanced (±)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DETAILED ENGINEERING DELTA MATRIX */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200">
          <h3 className="font-bold text-sm text-slate-900">
            Comprehensive Engineering Comparison Matrix &amp; Percentage Deltas
          </h3>
          <p className="text-xs text-slate-500">
            Values are compared with respect to Scenario A baseline. Green indicates favorable energy or cost performance; amber indicates elevated demands.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 text-slate-700 font-bold text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-4">Engineering Parameter</th>
                <th className="py-2.5 px-4 text-center">Unit</th>
                <th className="py-2.5 px-4 text-right">Scenario A</th>
                <th className="py-2.5 px-4 text-right">Scenario B</th>
                <th className="py-2.5 px-4 text-center">Difference (Δ)</th>
                <th className="py-2.5 px-4 text-center">Percentage Shift</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {/* CAPACITY SECTION */}
              <tr className="bg-slate-50 font-bold text-slate-800 font-sans text-xs">
                <td colSpan={6} className="py-2 px-4">1. Production &amp; Material Balances</td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Dry HQCF Flour Output</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">
                  {unitSystem === 'tonne' ? 't/h (t/d)' : unitSystem === 'imperial' ? 'lb/h (ton/d)' : 'kg/h'}
                </td>
                <td className="py-2 px-4 text-right font-bold text-slate-900">
                  {formatCapacityDisplay(resultsA.materialBalance.productRateKgH, unitSystem, { includeSecondary: false })}
                </td>
                <td className="py-2 px-4 text-right font-bold text-emerald-700">
                  {formatCapacityDisplay(resultsB.materialBalance.productRateKgH, unitSystem, { includeSecondary: false })}
                </td>
                <td className="py-2 px-4 text-center">
                  {resultsB.materialBalance.productRateKgH - resultsA.materialBalance.productRateKgH > 0 ? '+' : ''}
                  {(resultsB.materialBalance.productRateKgH - resultsA.materialBalance.productRateKgH).toFixed(1)} kg/h
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(resultsA.materialBalance.productRateKgH, resultsB.materialBalance.productRateKgH);
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        delta.pct > 0 ? 'bg-emerald-100 text-emerald-800' : delta.pct < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
                      </span>
                    );
                  })()}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Wet Cassava Mash Feed Rate</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">
                  {unitSystem === 'tonne' ? 't/h' : unitSystem === 'imperial' ? 'lb/h' : 'kg/h'}
                </td>
                <td className="py-2 px-4 text-right">
                  {formatCapacityDisplay(resultsA.materialBalance.feedRateKgH, unitSystem, { includeSecondary: false })}
                </td>
                <td className="py-2 px-4 text-right font-bold text-slate-900">
                  {formatCapacityDisplay(resultsB.materialBalance.feedRateKgH, unitSystem, { includeSecondary: false })}
                </td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.materialBalance.feedRateKgH - resultsA.materialBalance.feedRateKgH).toFixed(1)} kg/h
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(resultsA.materialBalance.feedRateKgH, resultsB.materialBalance.feedRateKgH);
                    return `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`;
                  })()}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Water Evaporation Rate</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">kg/h H₂O</td>
                <td className="py-2 px-4 text-right">{resultsA.materialBalance.waterRemovedKgH.toFixed(1)}</td>
                <td className="py-2 px-4 text-right font-bold text-slate-900">{resultsB.materialBalance.waterRemovedKgH.toFixed(1)}</td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.materialBalance.waterRemovedKgH - resultsA.materialBalance.waterRemovedKgH).toFixed(1)}
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(resultsA.materialBalance.waterRemovedKgH, resultsB.materialBalance.waterRemovedKgH);
                    return `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`;
                  })()}
                </td>
              </tr>

              {/* ENERGY SECTION */}
              <tr className="bg-slate-50 font-bold text-slate-800 font-sans text-xs">
                <td colSpan={6} className="py-2 px-4">2. Thermal Energy &amp; Fuel Consumption</td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Total Heat Exchanger Duty</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">
                  {unitSystem === 'imperial' ? 'BTU/hr' : 'kW'}
                </td>
                <td className="py-2 px-4 text-right font-bold">
                  {unitSystem === 'imperial'
                    ? Math.round(kwToBtuH(resultsA.energyBalance.totalHeatDutyKW)).toLocaleString()
                    : resultsA.energyBalance.totalHeatDutyKW.toFixed(1)}
                </td>
                <td className="py-2 px-4 text-right font-bold text-amber-700">
                  {unitSystem === 'imperial'
                    ? Math.round(kwToBtuH(resultsB.energyBalance.totalHeatDutyKW)).toLocaleString()
                    : resultsB.energyBalance.totalHeatDutyKW.toFixed(1)}
                </td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.energyBalance.totalHeatDutyKW - resultsA.energyBalance.totalHeatDutyKW).toFixed(1)} kW
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(resultsA.energyBalance.totalHeatDutyKW, resultsB.energyBalance.totalHeatDutyKW);
                    return `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`;
                  })()}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Specific Energy Consumption (SEC)</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">kJ/kg H₂O</td>
                <td className="py-2 px-4 text-right">
                  {resultsA.energyBalance.specificEnergyConsumptionKJperKgWater.toFixed(0)}
                </td>
                <td className="py-2 px-4 text-right font-bold">
                  {resultsB.energyBalance.specificEnergyConsumptionKJperKgWater.toFixed(0)}
                </td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.energyBalance.specificEnergyConsumptionKJperKgWater - resultsA.energyBalance.specificEnergyConsumptionKJperKgWater).toFixed(0)}
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(
                      resultsA.energyBalance.specificEnergyConsumptionKJperKgWater,
                      resultsB.energyBalance.specificEnergyConsumptionKJperKgWater
                    );
                    // Lower SEC is better
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        delta.pct < 0 ? 'bg-emerald-100 text-emerald-800' : delta.pct > 0 ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {delta.pct > 0 ? '+' : ''}{delta.pct.toFixed(1)}%
                      </span>
                    );
                  })()}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Thermal Drying Efficiency</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">%</td>
                <td className="py-2 px-4 text-right">{resultsA.energyBalance.thermalEfficiency.toFixed(1)}%</td>
                <td className="py-2 px-4 text-right font-bold text-emerald-700">{resultsB.energyBalance.thermalEfficiency.toFixed(1)}%</td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.energyBalance.thermalEfficiency - resultsA.energyBalance.thermalEfficiency).toFixed(1)}%
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const diff = resultsB.energyBalance.thermalEfficiency - resultsA.energyBalance.thermalEfficiency;
                    return (
                      <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                        diff > 0 ? 'bg-emerald-100 text-emerald-800' : diff < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {diff > 0 ? '+' : ''}{diff.toFixed(1)} pp
                      </span>
                    );
                  })()}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Equivalent Diesel Consumption</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">L/h</td>
                <td className="py-2 px-4 text-right">{resultsA.energyBalance.equivalentFuelRequirement.dieselLitersPerHour.toFixed(1)}</td>
                <td className="py-2 px-4 text-right font-bold">{resultsB.energyBalance.equivalentFuelRequirement.dieselLitersPerHour.toFixed(1)}</td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.energyBalance.equivalentFuelRequirement.dieselLitersPerHour - resultsA.energyBalance.equivalentFuelRequirement.dieselLitersPerHour).toFixed(1)}
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(
                      resultsA.energyBalance.equivalentFuelRequirement.dieselLitersPerHour,
                      resultsB.energyBalance.equivalentFuelRequirement.dieselLitersPerHour
                    );
                    return `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`;
                  })()}
                </td>
              </tr>

              {/* MECHANICAL & GEOMETRY SECTION */}
              <tr className="bg-slate-50 font-bold text-slate-800 font-sans text-xs">
                <td colSpan={6} className="py-2 px-4">3. Aerodynamics, Duct Sizes &amp; Fan Specifications</td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Drying Tube Diameter (Standard)</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">
                  {unitSystem === 'imperial' ? 'inches' : 'mm'}
                </td>
                <td className="py-2 px-4 text-right">
                  {unitSystem === 'imperial'
                    ? `${mmToInches(resultsA.dimensions.tubeDiameterStandardMm).toFixed(1)}"`
                    : `Ø${resultsA.dimensions.tubeDiameterStandardMm}`}
                </td>
                <td className="py-2 px-4 text-right font-bold text-slate-900">
                  {unitSystem === 'imperial'
                    ? `${mmToInches(resultsB.dimensions.tubeDiameterStandardMm).toFixed(1)}"`
                    : `Ø${resultsB.dimensions.tubeDiameterStandardMm}`}
                </td>
                <td className="py-2 px-4 text-center">
                  {resultsB.dimensions.tubeDiameterStandardMm - resultsA.dimensions.tubeDiameterStandardMm} mm
                </td>
                <td className="py-2 px-4 text-center">
                  {resultsA.dimensions.tubeDiameterStandardMm === resultsB.dimensions.tubeDiameterStandardMm ? (
                    <span className="text-slate-400">Identical Pipe</span>
                  ) : (
                    `${resultsB.dimensions.tubeDiameterStandardMm > resultsA.dimensions.tubeDiameterStandardMm ? 'Larger Pipe (+)' : 'Smaller Pipe (-)'}`
                  )}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Vertical Riser Column Height</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">
                  {unitSystem === 'imperial' ? 'ft' : 'm'}
                </td>
                <td className="py-2 px-4 text-right">
                  {unitSystem === 'imperial'
                    ? `${metersToFeet(resultsA.dimensions.verticalColumnHeightM).toFixed(1)} ft`
                    : `${resultsA.dimensions.verticalColumnHeightM.toFixed(2)} m`}
                </td>
                <td className="py-2 px-4 text-right font-bold">
                  {unitSystem === 'imperial'
                    ? `${metersToFeet(resultsB.dimensions.verticalColumnHeightM).toFixed(1)} ft`
                    : `${resultsB.dimensions.verticalColumnHeightM.toFixed(2)} m`}
                </td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.dimensions.verticalColumnHeightM - resultsA.dimensions.verticalColumnHeightM).toFixed(2)} m
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(resultsA.dimensions.verticalColumnHeightM, resultsB.dimensions.verticalColumnHeightM);
                    return `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`;
                  })()}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Cyclone Barrel Diameter</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">
                  {unitSystem === 'imperial' ? 'inches' : 'mm'}
                </td>
                <td className="py-2 px-4 text-right">
                  {unitSystem === 'imperial'
                    ? `${mmToInches(resultsA.dimensions.cycloneDiameterMm).toFixed(1)}"`
                    : `Ø${resultsA.dimensions.cycloneDiameterMm}`}
                </td>
                <td className="py-2 px-4 text-right font-bold">
                  {unitSystem === 'imperial'
                    ? `${mmToInches(resultsB.dimensions.cycloneDiameterMm).toFixed(1)}"`
                    : `Ø${resultsB.dimensions.cycloneDiameterMm}`}
                </td>
                <td className="py-2 px-4 text-center">
                  {resultsB.dimensions.cycloneDiameterMm - resultsA.dimensions.cycloneDiameterMm} mm
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(resultsA.dimensions.cycloneDiameterMm, resultsB.dimensions.cycloneDiameterMm);
                    return `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`;
                  })()}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Blower Motor Electrical Power</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">
                  {unitSystem === 'imperial' ? 'hp' : 'kW'}
                </td>
                <td className="py-2 px-4 text-right">
                  {unitSystem === 'imperial'
                    ? `${kwToHp(resultsA.dimensions.fanMotorPowerKW).toFixed(1)} hp`
                    : `${resultsA.dimensions.fanMotorPowerKW.toFixed(2)} kW`}
                </td>
                <td className="py-2 px-4 text-right font-bold text-amber-700">
                  {unitSystem === 'imperial'
                    ? `${kwToHp(resultsB.dimensions.fanMotorPowerKW).toFixed(1)} hp`
                    : `${resultsB.dimensions.fanMotorPowerKW.toFixed(2)} kW`}
                </td>
                <td className="py-2 px-4 text-center">
                  {(resultsB.dimensions.fanMotorPowerKW - resultsA.dimensions.fanMotorPowerKW).toFixed(1)} kW
                </td>
                <td className="py-2 px-4 text-center">
                  {(() => {
                    const delta = calcDelta(resultsA.dimensions.fanMotorPowerKW, resultsB.dimensions.fanMotorPowerKW);
                    return `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(1)}%`;
                  })()}
                </td>
              </tr>

              {/* PRESSURE SYSTEM COMPARISON */}
              <tr className="bg-slate-50 font-bold text-slate-800 font-sans text-xs">
                <td colSpan={6} className="py-2 px-4">4. Aerodynamic Pressure Regime &amp; Dust Containment</td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">System Pressure Mode</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">Type</td>
                <td className="py-2 px-4 text-right font-sans font-bold">
                  {resultsA.pressureSystem.badgeLabel}
                </td>
                <td className="py-2 px-4 text-right font-sans font-bold">
                  {resultsB.pressureSystem.badgeLabel}
                </td>
                <td colSpan={2} className="py-2 px-4 text-center font-sans">
                  {resultsA.pressureSystem.type === resultsB.pressureSystem.type ? (
                    <span className="text-slate-500">Same Pressure Regime</span>
                  ) : (
                    <span className="font-bold text-indigo-700">Alternative Architecture</span>
                  )}
                </td>
              </tr>

              <tr>
                <td className="py-2 px-4 font-sans font-medium text-slate-800">Dust Leakage Risk into Factory</td>
                <td className="py-2 px-4 text-center text-slate-500 font-sans">Safety</td>
                <td className="py-2 px-4 text-right font-sans">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    resultsA.pressureSystem.dustLeakageRisk.startsWith('Zero')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {resultsA.pressureSystem.dustLeakageRisk}
                  </span>
                </td>
                <td className="py-2 px-4 text-right font-sans">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    resultsB.pressureSystem.dustLeakageRisk.startsWith('Zero')
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {resultsB.pressureSystem.dustLeakageRisk}
                  </span>
                </td>
                <td colSpan={2} className="py-2 px-4 text-center font-sans text-[11px] text-slate-600">
                  {resultsB.pressureSystem.dustLeakageRisk.startsWith('Zero')
                    ? 'Safe for Food-Grade Flour Milling'
                    : 'Requires ATEX Flange Gasket Tightness'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Engineering Trade-off Summary Verdict */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-md flex items-start gap-4">
        <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0">
          <Zap className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h4 className="font-bold text-sm text-emerald-300">
            Engineering Trade-off Synthesis: Scenario A vs Scenario B
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            {resultsB.materialBalance.productRateKgH > resultsA.materialBalance.productRateKgH ? (
              <>
                Scaling from <strong>{resultsA.materialBalance.productRateKgH.toFixed(0)} kg/h</strong> to{' '}
                <strong>{resultsB.materialBalance.productRateKgH.toFixed(0)} kg/h</strong> increases flour throughput by{' '}
                <strong>
                  +{(((resultsB.materialBalance.productRateKgH - resultsA.materialBalance.productRateKgH) / resultsA.materialBalance.productRateKgH) * 100).toFixed(0)}%
                </strong>. This requires expanding the drying pipe from <strong>Ø{resultsA.dimensions.tubeDiameterStandardMm} mm</strong> to{' '}
                <strong>Ø{resultsB.dimensions.tubeDiameterStandardMm} mm</strong> to preserve optimal 15 m/s pneumatic conveying velocity without saltation settling.
                Heat duty scales from <strong>{resultsA.energyBalance.totalHeatDutyKW.toFixed(0)} kW</strong> to{' '}
                <strong>{resultsB.energyBalance.totalHeatDutyKW.toFixed(0)} kW</strong>.
              </>
            ) : resultsB.materialBalance.productRateKgH < resultsA.materialBalance.productRateKgH ? (
              <>
                Scenario B operates at a smaller capacity ({resultsB.materialBalance.productRateKgH.toFixed(0)} kg/h vs{' '}
                {resultsA.materialBalance.productRateKgH.toFixed(0)} kg/h), reducing required tube diameter to{' '}
                Ø{resultsB.dimensions.tubeDiameterStandardMm} mm and fan electrical load to {resultsB.dimensions.fanMotorPowerKW.toFixed(1)} kW.
              </>
            ) : (
              <>
                Both scenarios operate at identical {resultsA.materialBalance.productRateKgH.toFixed(0)} kg/h capacity. Differences in temperature and pressure regime dictate heat exchanger surface area and factory dust hygiene.
              </>
            )}
          </p>
          <div className="pt-2 flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => onApplyScenarioToActive(scenarioBInputs)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition-colors shadow-xs"
            >
              <span>Load Scenario B into 3D Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onApplyScenarioToActive(scenarioAInputs)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              <span>Restore Scenario A Baseline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
