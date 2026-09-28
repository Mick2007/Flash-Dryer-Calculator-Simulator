import React, { useState } from 'react';
import {
  Sliders,
  Flame,
  Wind,
  Settings,
  HelpCircle,
  RotateCcw,
  Check,
  Scale,
  ArrowRightLeft,
  ShieldCheck,
  ShieldAlert,
  Gauge,
  Layers,
  Wrench
} from 'lucide-react';
import { DryerInputs, CycloneType, DesignMethodology, PressureSystemType } from '../types/dryer';
import { CIRAD_PILOT_BENCHMARK, MATERIAL_PROPERTY_PRESETS } from '../utils/constants';

interface InputPanelProps {
  inputs: DryerInputs;
  onChange: (updated: DryerInputs) => void;
  onOpenUnitConverter?: () => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({ inputs, onChange, onOpenUnitConverter }) => {
  const [activeTab, setActiveTab] = useState<'capacity' | 'thermal' | 'aerodynamics' | 'equipment' | 'hopper_feeder'>('capacity');
  const [capacityInputUnit, setCapacityInputUnit] = useState<'kg_h' | 'tonne_h' | 'tonne_day' | 'lb_h' | 'ton_day'>('kg_h');

  const update = <K extends keyof DryerInputs>(field: K, value: DryerInputs[K]) => {
    onChange({
      ...inputs,
      [field]: value,
    });
  };

  // Raw text for numeric fields, so an empty box stays empty.
  //
  // The fields were previously wired as `updateNumeric('x', 75, e)`.
  // parseFloat('') is NaN, and NaN is falsy, so the `|| 75` fallback fired the
  // instant the user selected the contents and pressed delete — the box snapped
  // back to 75 and could never be cleared. The user could not type a new value
  // without first fighting the field.
  //
  // The calculation engine already sanitises every input internally (clampNum
  // substitutes a fallback for any non-finite value and records the substitution
  // in the disclosed-validation list), so an empty field is SAFE to propagate: the
  // engine substitutes the default, and the user is told it did so. Holding the
  // raw string in component state is therefore both correct and more honest than
  // coercing at the input.
  const [rawNumericFields, setRawNumericFields] = useState<Record<string, string>>({});

  const updateNumeric = <K extends keyof DryerInputs>(
    field: K,
    fallback: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const text = e.target.value;
    setRawNumericFields((prev) => ({ ...prev, [field as string]: text }));

    if (text.trim() === '') {
      // Field cleared. Propagate NaN deliberately — the engine clamps it and
      // discloses the substitution. Keeping the placeholder visible is better UX
      // than silently reinstating a number the user just deleted.
      onChange({
        ...inputs,
        [field]: Number.NaN as DryerInputs[K],
      });
      return;
    }

    const parsed = parseFloat(text);
    if (Number.isFinite(parsed)) {
      onChange({
        ...inputs,
        [field]: parsed as DryerInputs[K],
      });
    }
  };

  // Value to display: the raw text while the user is editing, otherwise the
  // engine's stored number, otherwise the placeholder default.
  const numericValue = <K extends keyof DryerInputs>(field: K, fallback: number): string => {
    const raw = rawNumericFields[field as string];
    if (raw !== undefined) return raw;
    const stored = inputs[field];
    return typeof stored === 'number' && Number.isFinite(stored) ? String(stored) : String(fallback);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50/70 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveTab('capacity')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'capacity'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>1. Capacity &amp; Moisture</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">Required</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('thermal')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'thermal'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>2. Temperatures &amp; Air</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('aerodynamics')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'aerodynamics'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Wind className="w-3.5 h-3.5" />
          <span>3. Transport &amp; Cassava Properties</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('equipment')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'equipment'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>4. Equipment &amp; Cyclone</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hopper_feeder')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all whitespace-nowrap ${
            activeTab === 'hopper_feeder'
              ? 'border-emerald-600 text-emerald-700 bg-white'
              : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>5. Hopper &amp; Screw Feeder</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-amber-100 text-amber-900 font-bold">IITA</span>
        </button>
      </div>

      {/* Tab Contents */}
      <div className="p-4 sm:p-5">
        {/* TAB 1: Capacity & Moisture */}
        {activeTab === 'capacity' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Process Production Target &amp; Cassava Moisture</h3>
                <p className="text-xs text-slate-500">
                  Define either the desired dry flour output rate or the incoming wet mash dewatered feed rate.
                </p>
              </div>

              {/* Mode Toggle & Unit Converter Button */}
              <div className="flex items-center gap-2 self-start sm:self-center">
                <div className="inline-flex rounded-lg border border-slate-300 p-0.5 bg-slate-100 text-xs">
                  <button
                    type="button"
                    onClick={() => update('capacityMode', 'product')}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      inputs.capacityMode === 'product'
                        ? 'bg-white text-emerald-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Dry Product Target
                  </button>
                  <button
                    type="button"
                    onClick={() => update('capacityMode', 'feed')}
                    className={`px-3 py-1 rounded-md font-medium transition-all ${
                      inputs.capacityMode === 'feed'
                        ? 'bg-white text-emerald-700 shadow-xs font-bold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Wet Feed Input
                  </button>
                </div>

                {onOpenUnitConverter && (
                  <button
                    type="button"
                    onClick={onOpenUnitConverter}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50/70 text-xs font-bold text-emerald-900 hover:bg-emerald-100 transition-colors shadow-2xs"
                    title="Open Unit Converter (Tonnes, Metric, Imperial)"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Unit Converter</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Capacity Input with Dynamic Unit Handling */}
              {inputs.capacityMode === 'product' ? (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Target Dry Flour Output (F_prod)
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={capacityInputUnit}
                        onChange={(e) => setCapacityInputUnit(e.target.value as any)}
                        className="text-[10px] font-bold py-0.5 px-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:ring-1 focus:ring-emerald-500"
                        title="Select input unit"
                      >
                        <option value="kg_h">kg/h</option>
                        <option value="tonne_h">tonne/h (t/h)</option>
                        <option value="tonne_day">t/day (24h)</option>
                        <option value="lb_h">lb/h (Imperial)</option>
                        <option value="ton_day">US ton/day</option>
                      </select>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                        Required
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0.01}
                      step={capacityInputUnit === 'tonne_h' ? 0.05 : capacityInputUnit === 'tonne_day' ? 0.5 : 1}
                      value={
                        capacityInputUnit === 'tonne_h'
                          ? parseFloat((inputs.desiredProductRate / 1000).toFixed(3))
                          : capacityInputUnit === 'tonne_day'
                          ? parseFloat(((inputs.desiredProductRate * 24) / 1000).toFixed(2))
                          : capacityInputUnit === 'lb_h'
                          ? Math.round(inputs.desiredProductRate * 2.20462)
                          : capacityInputUnit === 'ton_day'
                          ? parseFloat(((inputs.desiredProductRate * 24 * 2.20462) / 2000).toFixed(2))
                          : inputs.desiredProductRate
                      }
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value) || 0;
                        let targetKgH = raw;
                        if (capacityInputUnit === 'tonne_h') targetKgH = raw * 1000;
                        else if (capacityInputUnit === 'tonne_day') targetKgH = (raw * 1000) / 24;
                        else if (capacityInputUnit === 'lb_h') targetKgH = raw / 2.20462;
                        else if (capacityInputUnit === 'ton_day') targetKgH = (raw * 2000) / (24 * 2.20462);
                        update('desiredProductRate', Math.max(1, Math.round(targetKgH * 10) / 10));
                      }}
                      className="w-full px-3 py-2 pr-20 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">
                      {capacityInputUnit === 'tonne_h'
                        ? 't/h'
                        : capacityInputUnit === 'tonne_day'
                        ? 't/day'
                        : capacityInputUnit === 'lb_h'
                        ? 'lb/h'
                        : capacityInputUnit === 'ton_day'
                        ? 'ton/d'
                        : 'kg/h'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>
                      = {inputs.desiredProductRate.toFixed(1)} kg/h • {(inputs.desiredProductRate / 1000).toFixed(3)} t/h
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {((inputs.desiredProductRate * 24) / 1000).toFixed(1)} t/day
                    </span>
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Wet Cassava Feed Rate (F_wet)
                    </label>
                    <div className="flex items-center gap-1">
                      <select
                        value={capacityInputUnit}
                        onChange={(e) => setCapacityInputUnit(e.target.value as any)}
                        className="text-[10px] font-bold py-0.5 px-1.5 border border-slate-300 rounded bg-slate-50 text-slate-700 focus:ring-1 focus:ring-emerald-500"
                        title="Select input unit"
                      >
                        <option value="kg_h">kg/h</option>
                        <option value="tonne_h">tonne/h (t/h)</option>
                        <option value="tonne_day">t/day (24h)</option>
                        <option value="lb_h">lb/h (Imperial)</option>
                        <option value="ton_day">US ton/day</option>
                      </select>
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                        Required
                      </span>
                    </div>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min={0.01}
                      step={capacityInputUnit === 'tonne_h' ? 0.05 : capacityInputUnit === 'tonne_day' ? 0.5 : 1}
                      value={
                        capacityInputUnit === 'tonne_h'
                          ? parseFloat((inputs.feedRate / 1000).toFixed(3))
                          : capacityInputUnit === 'tonne_day'
                          ? parseFloat(((inputs.feedRate * 24) / 1000).toFixed(2))
                          : capacityInputUnit === 'lb_h'
                          ? Math.round(inputs.feedRate * 2.20462)
                          : capacityInputUnit === 'ton_day'
                          ? parseFloat(((inputs.feedRate * 24 * 2.20462) / 2000).toFixed(2))
                          : inputs.feedRate
                      }
                      onChange={(e) => {
                        const raw = parseFloat(e.target.value) || 0;
                        let targetKgH = raw;
                        if (capacityInputUnit === 'tonne_h') targetKgH = raw * 1000;
                        else if (capacityInputUnit === 'tonne_day') targetKgH = (raw * 1000) / 24;
                        else if (capacityInputUnit === 'lb_h') targetKgH = raw / 2.20462;
                        else if (capacityInputUnit === 'ton_day') targetKgH = (raw * 2000) / (24 * 2.20462);
                        update('feedRate', Math.max(1, Math.round(targetKgH * 10) / 10));
                      }}
                      className="w-full px-3 py-2 pr-20 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                    />
                    <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">
                      {capacityInputUnit === 'tonne_h'
                        ? 't/h'
                        : capacityInputUnit === 'tonne_day'
                        ? 't/day'
                        : capacityInputUnit === 'lb_h'
                        ? 'lb/h'
                        : capacityInputUnit === 'ton_day'
                        ? 'ton/d'
                        : 'kg/h'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>
                      = {inputs.feedRate.toFixed(1)} kg/h • {(inputs.feedRate / 1000).toFixed(3)} t/h
                    </span>
                    <span className="text-emerald-700 font-bold">
                      {((inputs.feedRate * 24) / 1000).toFixed(1)} t/day
                    </span>
                  </p>
                </div>
              )}

              {/* Initial Moisture */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Initial Moisture Content (w1)
                  </label>
                  <span className="text-[10px] font-medium text-slate-500">Wet Basis %</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={25}
                    max={65}
                    step={0.5}
                    value={numericValue('initialMoisture', 0)}
                    onChange={(e) => updateNumeric('initialMoisture', 40, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cassava mash after hydraulic dewatering press (typically 35 - 45%)
                </p>
              </div>

              {/* Final Moisture */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Final Target Moisture (w2)
                  </label>
                  <span className="text-[10px] font-medium text-slate-500">Wet Basis %</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={5}
                    max={15}
                    step={0.1}
                    value={numericValue('finalMoisture', 0)}
                    onChange={(e) => updateNumeric('finalMoisture', 12, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  HQCF standard is ≤ 12.0 - 13.0% for safe microbiological storage
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: Temperatures & Psychrometrics */}
        {activeTab === 'thermal' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Thermal Drying Conditions &amp; Site Ambient Environment</h3>
              <p className="text-xs text-slate-500">
                Inlet drying air temperature, exhaust temperature, and installation site barometric altitude.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              {/* Inlet Air Temp */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Drying Air Inlet Temp (T_in)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={120}
                    max={220}
                    step={1}
                    value={numericValue('inletAirTemp', 0)}
                    onChange={(e) => updateNumeric('inletAirTemp', 170, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">°C</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  CIRAD benchmark: 170 - 180°C (Max recommended: 190°C)
                </p>
              </div>

              {/* Outlet Air Temp */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Exhaust Air Outlet Temp (T_out)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={60}
                    max={100}
                    step={1}
                    value={numericValue('outletAirTemp', 0)}
                    onChange={(e) => updateNumeric('outletAirTemp', 75, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">°C</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Target: 70 - 80°C. Above 85°C risks gelatinizing starch!
                </p>
              </div>

              {/* Ambient Temp */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Ambient Air Temp (T_amb)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={45}
                    step={1}
                    value={numericValue('ambientTemp', 0)}
                    onChange={(e) => updateNumeric('ambientTemp', 27, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">°C</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Intake air temperature at blower inlet
                </p>
              </div>

              {/* Ambient RH */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Ambient Relative Humidity (RH)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={20}
                    max={95}
                    step={1}
                    value={numericValue('ambientRH', 0)}
                    onChange={(e) => updateNumeric('ambientRH', 70, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">%</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Tropical climate humidity (typically 65 - 80%)
                </p>
              </div>

              {/* Feed Temp */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cassava Feed Temp (T_feed)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={15}
                    max={40}
                    step={1}
                    value={numericValue('feedTemp', 0)}
                    onChange={(e) => updateNumeric('feedTemp', 25, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">°C</span>
                </div>
              </div>

              {/* Final Product Temp */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Product Exit Temp (T_prod)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={35}
                    max={65}
                    step={1}
                    value={numericValue('finalProductTemp', 0)}
                    onChange={(e) => updateNumeric('finalProductTemp', 50, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">°C</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Cassava granules temperature leaving cyclone
                </p>
              </div>

              {/* Altitude */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Site Elevation / Altitude
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0}
                    max={3000}
                    step={50}
                    value={numericValue('altitude', 0)}
                    onChange={(e) => updateNumeric('altitude', 0, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">m</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Calculates exact barometric air density
                </p>
              </div>

              {/* Heat Loss Factor */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Pipe Wall Heat Loss Margin
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0.05}
                    max={0.30}
                    step={0.01}
                    value={numericValue('heatLossFactor', 0)}
                    onChange={(e) => updateNumeric('heatLossFactor', 0.12, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">frac</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  12% (0.12) standard for 50mm mineral wool lagging
                </p>
              </div>

              {/* Heat Exchanger Quick Passes Setting */}
              <div className="sm:col-span-2 md:col-span-4 bg-amber-50/60 border border-amber-200/80 rounded-lg p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Flame className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-bold text-slate-900">Air Heat Exchanger Specified Passes (CIRAD Module 4)</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5">
                    Specifies the number of tube passes for flue gas / thermal oil to air heat exchange.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 self-end sm:self-center">
                  {[1, 2, 3, 4].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => update('heatExchangerPasses', p)}
                      className={`text-xs px-2.5 py-1 rounded font-bold transition-all ${
                        (inputs.heatExchangerPasses || 2) === p
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {p} {p === 1 ? 'Pass' : 'Passes'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Aerodynamics & Cassava Properties */}
        {activeTab === 'aerodynamics' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Pneumatic Transport Velocity &amp; Granule Physical Properties</h3>
              <p className="text-xs text-slate-500">
                Conveying air velocity and specific physical properties measured in CIRAD and IITA cassava flour trials.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {/* Air Velocity */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Design Air Velocity (v_air)
                  </label>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    Optimal: 15 m/s
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={25}
                    step={0.5}
                    value={numericValue('airVelocity', 0)}
                    onChange={(e) => updateNumeric('airVelocity', 15, e)}
                    className="w-full px-3 py-2 pr-12 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">m/s</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  CIRAD validated range: 12 - 18 m/s (15 m/s tested benchmark)
                </p>
              </div>

              {/* Particle Diameter */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Mean Particle Diameter (d_p)
                  </label>
                  <span className="text-[10px] font-semibold text-slate-500">CIRAD 230 µm</span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={100}
                    max={500}
                    step={5}
                    value={numericValue('particleDiameter', 0)}
                    onChange={(e) => updateNumeric('particleDiameter', 230, e)}
                    className="w-full px-3 py-2 pr-12 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">µm</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  CIRAD experimental particle size range: 215 - 245 µm
                </p>
              </div>

              {/* Particle Density */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Particle Solid Density (rho_p)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1200}
                    max={1600}
                    step={10}
                    value={numericValue('particleDensity', 0)}
                    onChange={(e) => updateNumeric('particleDensity', 1480, e)}
                    className="w-full px-3 py-2 pr-14 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">kg/m³</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Granular density of cassava starch = 1480 kg/m³
                </p>
              </div>

              {/* Bulk Density */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Cassava Flour Bulk Density (rho_b)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={400}
                    max={800}
                    step={10}
                    value={numericValue('bulkDensity', 0)}
                    onChange={(e) => updateNumeric('bulkDensity', 600, e)}
                    className="w-full px-3 py-2 pr-14 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">kg/m³</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Used for screw feeder throughput sizing (550 - 650 kg/m³)
                </p>
              </div>

              {/* Specific Heat */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Specific Heat Capacity (C_ps)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={1.2}
                    max={2.2}
                    step={0.01}
                    value={numericValue('cassavaSpecificHeat', 0)}
                    onChange={(e) => updateNumeric('cassavaSpecificHeat', 1.67, e)}
                    className="w-full px-3 py-2 pr-20 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">kJ/(kg·K)</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Kuye et al. &amp; CIRAD standard: 1.67 kJ/(kg·K)
                </p>
              </div>

              {/* Target Residence Time */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Target Particle Contact Time (tau)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={0.8}
                    max={3.0}
                    step={0.1}
                    value={numericValue('targetResidenceTime', 0)}
                    onChange={(e) => updateNumeric('targetResidenceTime', 1.5, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">sec</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Flash drying contact duration (typically 1.2 - 2.0 s)
                </p>
              </div>

              {/* Flash Tube Developed Length Override */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    Flash Tube Developed Length (L_pipe)
                  </label>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
                    CIRAD ≥ 20m
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min={10}
                    max={40}
                    step={0.5}
                    value={inputs.customTotalPipeLengthM || 20.0}
                    onChange={(e) => updateNumeric('customTotalPipeLengthM', 20.0, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">m</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Total unfolded centerline length (default auto-sized ≥ 20 m)
                </p>
              </div>

              {/* Flash Tube Routing Configuration */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Piping Routing Configuration
                </label>
                <select
                  value={inputs.tubeRoutingLayout || 'single_loop'}
                  onChange={(e) => update('tubeRoutingLayout', e.target.value as any)}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="single_loop">Single U-Bend Hairpin Loop (Standard)</option>
                  <option value="double_loop">Double S-Serpentine Loop (Low Ceiling)</option>
                  <option value="straight_riser">Straight Vertical Riser Tower</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Adapts piping path to factory building geometry
                </p>
              </div>

              {/* Workshop Ceiling Clearance */}
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Factory Ceiling Clearance (H_max)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min={5.0}
                    max={15.0}
                    step={0.5}
                    value={inputs.ceilingClearanceM || 8.0}
                    onChange={(e) => updateNumeric('ceilingClearanceM', 8.0, e)}
                    className="w-full px-3 py-2 pr-10 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">m</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Constrains vertical column height to fit building roof
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: Equipment & Cyclone */}
        {activeTab === 'equipment' && (
          <div className="space-y-4">
            <div className="pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Equipment Architecture &amp; Cyclone Separator Design</h3>
              <p className="text-xs text-slate-500">
                Select between Stairmand High-Efficiency or Lapple Cyclone and choose calculation model preferences.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Cyclone Selection Card */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Cyclone Separator Standard</span>
                  <span className="text-[11px] font-semibold text-emerald-700">CIRAD Tool Module 3</span>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => update('cycloneType', 'stairmand')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      inputs.cycloneType === 'stairmand'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Stairmand H.E.</span>
                      {inputs.cycloneType === 'stairmand' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      High Efficiency (a/D=0.5, b/D=0.2). Superior fine powder capture (&gt;98.5% recovery).
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => update('cycloneType', 'lapple')}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      inputs.cycloneType === 'lapple'
                        ? 'border-emerald-600 bg-emerald-50/60 ring-2 ring-emerald-500'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-900">Lapple Standard</span>
                      {inputs.cycloneType === 'lapple' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500">
                      Standard design (a/D=0.5, b/D=0.25). Slightly lower pressure drop.
                    </p>
                  </button>
                </div>
              </div>

              {/* Methodology Model Card */}
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">Design Methodology Basis</span>
                  <span className="text-[11px] font-semibold text-slate-500">Peer-Reviewed Models</span>
                </div>

                <div className="space-y-2">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
                    <input
                      type="radio"
                      name="methodology"
                      checked={inputs.methodology === 'cirad'}
                      onChange={() => update('methodology', 'cirad')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        CIRAD Energy-Efficient Model (Arnaud Chapuis 2015)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Optimized air-to-solid ratio (9:1 to 11:1), minimum pipe length L ≥ 20m, 1D momentum transfer model.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-white cursor-pointer hover:border-slate-300">
                    <input
                      type="radio"
                      name="methodology"
                      checked={inputs.methodology === 'kuye'}
                      onChange={() => update('methodology', 'kuye')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="text-xs font-bold text-slate-900 block">
                        IITA / Kuye et al. Empirical Model (2011/2017)
                      </span>
                      <span className="text-[11px] text-slate-500 block">
                        Semi-empirical sizing based on Nigerian cassava flash dryer field trials (e.g. 387 mm column for 500 kg/h).
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Aerodynamic Draft Regime Selection Card (Positive vs Negative Pressure) */}
              <div className="col-span-1 md:col-span-2 border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                      Aerodynamic Draft &amp; Pressure Regime (Fan Placement)
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Determines Duct Internal Pressure &amp; Flour Dust Containment
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Negative Pressure (Induced Draft) */}
                  <button
                    type="button"
                    onClick={() => update('pressureSystemType', 'negative')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      (inputs.pressureSystemType || 'negative') === 'negative'
                        ? 'border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-xs font-bold text-slate-900">Negative pressure (ID fan)</span>
                      </div>
                      {(inputs.pressureSystemType || 'negative') === 'negative' && (
                        <Check className="w-4 h-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        CIRAD standard · −1.2 kPa
                      </span>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Exhaust fan situated after cyclone draws air through system. Internal vacuum prevents starch leakage into processing workshop.
                      </p>
                      <div className="flex items-center gap-1 pt-1 text-[10px] font-semibold text-emerald-700">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Zero Flour Dust Risk</span>
                      </div>
                    </div>
                  </button>

                  {/* Positive Pressure (Forced Draft) */}
                  <button
                    type="button"
                    onClick={() => update('pressureSystemType', 'positive')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      inputs.pressureSystemType === 'positive'
                        ? 'border-amber-600 bg-amber-50/90 ring-2 ring-amber-500 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-xs font-bold text-slate-900">Positive pressure (FD fan)</span>
                      </div>
                      {inputs.pressureSystemType === 'positive' && (
                        <Check className="w-4 h-4 text-amber-600" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        Cold Blower (+1.4 kPa)
                      </span>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Blower pushes ambient air into furnace and column. Fan impeller never contacts hot or dusty air, extending lifespan.
                      </p>
                      <div className="flex items-center gap-1 pt-1 text-[10px] font-semibold text-amber-800">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Requires Airtight Gaskets</span>
                      </div>
                    </div>
                  </button>

                  {/* Balanced Draft (Dual Fan) */}
                  <button
                    type="button"
                    onClick={() => update('pressureSystemType', 'balanced')}
                    className={`p-3 rounded-xl border text-left transition-all relative ${
                      inputs.pressureSystemType === 'balanced'
                        ? 'border-sky-600 bg-sky-50/90 ring-2 ring-sky-500 shadow-xs'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
                        <span className="text-xs font-bold text-slate-900">Balanced Draft (Dual Fans)</span>
                      </div>
                      {inputs.pressureSystemType === 'balanced' && (
                        <Check className="w-4 h-4 text-sky-600" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-100 text-sky-800">
                        Push-Pull (Neutral ±0 Pa)
                      </span>
                      <p className="text-[11px] text-slate-600 leading-tight">
                        Inlet FD fan + exhaust ID fan operate in series. Produces near-zero gauge pressure at the feeder throat for seamless solids feeding.
                      </p>
                      <div className="flex items-center gap-1 pt-1 text-[10px] font-semibold text-sky-800">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Optimal Feed Venturi Control</span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Multi-Pass Heat Exchanger Configuration Card */}
              <div className="col-span-1 md:col-span-2 border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/80 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Flame className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                        Air Heat Exchanger Multi-Pass Configuration
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      CIRAD Flash Dryer Design Suite (Module 4) — Sizing of flue-gas-to-air heat exchanger bundle.
                    </p>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 self-start sm:self-auto">
                    CIRAD Tool Module 4
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {/* Number of Passes */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700">
                        Specified Number of Passes (N_pass)
                      </label>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded">
                        {inputs.heatExchangerPasses || 2} Passes
                      </span>
                    </div>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={8}
                        step={1}
                        value={inputs.heatExchangerPasses || 2}
                        onChange={(e) => update('heatExchangerPasses', Math.max(1, Math.min(8, parseInt(e.target.value) || 2)))}
                        className="w-full px-3 py-2 pr-16 text-sm font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                      <span className="absolute right-3 top-2 text-xs font-semibold text-slate-400">passes</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {[1, 2, 3, 4, 6].map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => update('heatExchangerPasses', p)}
                          className={`text-xs px-2.5 py-1 rounded font-semibold transition-all ${
                            (inputs.heatExchangerPasses || 2) === p
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {p} {p === 1 ? 'Pass' : 'Passes'}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Multi-pass configurations enhance cross-flow LMTD efficiency (F_t) and thermal mixing.
                    </p>
                  </div>

                  {/* Heat Exchanger Construction Type */}
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">
                      Heat Exchanger Construction Type
                    </label>
                    <select
                      value={inputs.heatExchangerType || 'cross_flow_finned'}
                      onChange={(e) => update('heatExchangerType', e.target.value as any)}
                      className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="cross_flow_finned">Cross-Flow Finned Tube Bundle (CIRAD Benchmark)</option>
                      <option value="cross_flow_bare">Staggered Bare Tube Bank (Lower ΔP, Larger Area)</option>
                    </select>
                    <p className="text-[11px] text-slate-500 mt-2">
                      {inputs.heatExchangerType === 'cross_flow_bare'
                        ? 'Bare tubes: U ≈ 32 W/(m²·K). Requires larger surface area but easier soot cleaning with biomass furnaces.'
                        : 'Finned tubes: U ≈ 42 W/(m²·K). Compact footprint, high heat transfer efficiency.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: Hopper & Screw Feeder (IITA / Kuye et al. 2011) */}
        {activeTab === 'hopper_feeder' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Hopper &amp; Screw Feeder Sizing Parameters (IITA Reference)
                </h3>
                <p className="text-xs text-slate-500">
                  Configure wet cassava holding time, hopper geometry, wall angles, and metering screw conveyor speed.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                Reference: 820 kg/h Wet Cake
              </span>
            </div>

            {/* Material & Bulk Density Assumption */}
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-950">Material Property Assumption (CEMA/Martin)</span>
                <span className="text-[11px] text-amber-800 font-mono">
                  &rho;b = {inputs.bulkDensity} kg/m³ ({(inputs.bulkDensity * (2.20462 / 35.3147)).toFixed(1)} lb/ft³)
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MATERIAL_PROPERTY_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      update('materialPropertyType', preset.id as any);
                      update('bulkDensity', preset.bulkDensityKgM3);
                      update('screwMaterialFactor', preset.materialFactorFm);
                      update('screwLoadingPercent', preset.standardTroughLoadingPercent);
                    }}
                    className={`p-2 rounded-lg border text-left text-xs transition-all ${
                      inputs.materialPropertyType === preset.id
                        ? 'bg-amber-600 text-white border-amber-700 font-bold'
                        : 'bg-white hover:bg-amber-100 border-amber-200 text-slate-700'
                    }`}
                  >
                    <div className="truncate font-semibold">{preset.name}</div>
                    <div className="text-[10px] opacity-80">{preset.bulkDensityKgM3} kg/m³ &bull; Fm {preset.materialFactorFm}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Hopper Sizing Group */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                <span>Hopper Sizing &amp; Geometry</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Holding Time (t_r, min)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={60}
                    step={1}
                    value={numericValue('hopperHoldingTimeMin', 10)}
                    onChange={(e) => updateNumeric('hopperHoldingTimeMin', 10, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 10 min buffer</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Volume Allowance (%)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={numericValue('hopperVolumeAllowancePercent', 10)}
                    onChange={(e) => updateNumeric('hopperVolumeAllowancePercent', 10, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 10% freeboard</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Top Opening W1 &times; L1 (m)
                  </label>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      min={0.2}
                      max={2.0}
                      step={0.05}
                      value={numericValue('hopperTopWidthM', 0.5)}
                      onChange={(e) => updateNumeric('hopperTopWidthM', 0.5, e)}
                      className="w-1/2 px-2 py-1.5 border border-slate-300 rounded font-bold text-center"
                    />
                    <span>&times;</span>
                    <input
                      type="number"
                      min={0.2}
                      max={2.0}
                      step={0.05}
                      value={numericValue('hopperTopLengthM', 0.5)}
                      onChange={(e) => updateNumeric('hopperTopLengthM', 0.5, e)}
                      className="w-1/2 px-2 py-1.5 border border-slate-300 rounded font-bold text-center"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Ref: 0.50 &times; 0.50 m</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Outlet W2 &times; L2 (m)
                  </label>
                  <div className="flex items-center gap-1 font-mono">
                    <input
                      type="number"
                      min={0.1}
                      max={1.0}
                      step={0.02}
                      value={numericValue('hopperOutletWidthM', 0.32)}
                      onChange={(e) => updateNumeric('hopperOutletWidthM', 0.32, e)}
                      className="w-1/2 px-2 py-1.5 border border-slate-300 rounded font-bold text-center"
                    />
                    <span>&times;</span>
                    <input
                      type="number"
                      min={0.1}
                      max={1.0}
                      step={0.02}
                      value={numericValue('hopperOutletLengthM', 0.22)}
                      onChange={(e) => updateNumeric('hopperOutletLengthM', 0.22, e)}
                      className="w-1/2 px-2 py-1.5 border border-slate-300 rounded font-bold text-center"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400">Ref: 0.32 &times; 0.22 m</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Upper Collar h1 (m)
                  </label>
                  <input
                    type="number"
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    value={numericValue('hopperUpperHeightM', 0.1)}
                    onChange={(e) => updateNumeric('hopperUpperHeightM', 0.1, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 0.10 m (100 mm)</span>
                </div>

                <div className="bg-emerald-50/80 border border-emerald-300 rounded p-2 text-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-950 block">
                        Lower Frustum h2 (m)
                      </label>
                      <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-emerald-200 text-emerald-900">
                        Solved
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-emerald-800 font-mono mt-0.5">
                      {(() => {
                        const fr = inputs.capacityMode === 'product'
                          ? (inputs.desiredProductRate * (100 - inputs.finalMoisture)) / Math.max(1, 100 - inputs.initialMoisture)
                          : inputs.feedRate;
                        const rho = inputs.bulkDensity || 1380;
                        const tr = inputs.hopperHoldingTimeMin ?? 10;
                        const allow = 1 + (inputs.hopperVolumeAllowancePercent ?? 10) / 100;
                        const Hc = allow * ((fr * tr) / (rho * 60));
                        const W1 = inputs.hopperTopWidthM ?? 0.5;
                        const L1 = inputs.hopperTopLengthM ?? 0.5;
                        const W2 = inputs.hopperOutletWidthM ?? 0.32;
                        const L2 = inputs.hopperOutletLengthM ?? 0.22;
                        const h1 = inputs.hopperUpperHeightM ?? 0.1;
                        const A1 = W1 * L1;
                        const A2 = W2 * L2;
                        const Vup = h1 * A1;
                        const F = A1 + A2 + Math.sqrt(A1 * A2);
                        const Vlow = Math.max(0.001, Hc - Vup);
                        const h2 = (3 * Vlow) / F;
                        return `${h2.toFixed(3)} m (${Math.round(h2 * 1000)} mm)`;
                      })()}
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                    Solved from Hc &amp; assumed dimensions
                  </span>
                </div>

                {/* Dynamically computed Angle A, Angle B, and Valley Angle C */}
                {(() => {
                  const fr = inputs.capacityMode === 'product'
                    ? (inputs.desiredProductRate * (100 - inputs.finalMoisture)) / Math.max(1, 100 - inputs.initialMoisture)
                    : inputs.feedRate;
                  const rho = inputs.bulkDensity || 1380;
                  const tr = inputs.hopperHoldingTimeMin ?? 10;
                  const allow = 1 + (inputs.hopperVolumeAllowancePercent ?? 10) / 100;
                  const Hc = allow * ((fr * tr) / (rho * 60));
                  const W1 = inputs.hopperTopWidthM ?? 0.5;
                  const L1 = inputs.hopperTopLengthM ?? 0.5;
                  const W2 = inputs.hopperOutletWidthM ?? 0.32;
                  const L2 = inputs.hopperOutletLengthM ?? 0.22;
                  const h1 = inputs.hopperUpperHeightM ?? 0.1;
                  const A1 = W1 * L1;
                  const A2 = W2 * L2;
                  const Vup = h1 * A1;
                  const F = A1 + A2 + Math.sqrt(A1 * A2);
                  const Vlow = Math.max(0.001, Hc - Vup);
                  const h2 = (3 * Vlow) / F;

                  const runW = Math.max(0.001, (W1 - W2) / 2);
                  const runL = Math.max(0.001, (L1 - L2) / 2);
                  const angleA = Math.round((Math.atan(h2 / runW) * 180 / Math.PI) * 10) / 10;
                  const angleB = Math.round((Math.atan(h2 / runL) * 180 / Math.PI) * 10) / 10;
                  const cotA = runW / h2;
                  const cotB = runL / h2;
                  const cotC = Math.sqrt(Math.pow(cotA, 2) + Math.pow(cotB, 2));
                  const angleC = Math.round((Math.atan(1 / cotC) * 180 / Math.PI) * 10) / 10;
                  const isSteep = angleC >= 70;

                  return (
                    <>
                      <div className="bg-slate-100/80 border border-slate-200 rounded p-2 text-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">Side Angle A (Width)</span>
                          <span className="text-[9px] font-bold bg-slate-200 text-slate-800 px-1 rounded">arctan(h2/Run_W)</span>
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">
                          {angleA}&deg;
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Run_W = {(runW * 1000).toFixed(0)} mm
                        </span>
                      </div>

                      <div className="bg-slate-100/80 border border-slate-200 rounded p-2 text-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700">End Angle B (Length)</span>
                          <span className="text-[9px] font-bold bg-slate-200 text-slate-800 px-1 rounded">arctan(h2/Run_L)</span>
                        </div>
                        <div className="text-sm font-extrabold text-slate-900 font-mono mt-0.5">
                          {angleB}&deg;
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Run_L = {(runL * 1000).toFixed(0)} mm
                        </span>
                      </div>

                      <div className={`col-span-2 sm:col-span-4 rounded-lg p-2.5 border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                        isSteep
                          ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                          : 'bg-amber-50 border-amber-300 text-amber-950'
                      }`}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs uppercase tracking-tight">
                              Resulting Corner Valley Angle C = <span className="font-mono text-sm">{angleC}&deg;</span>
                            </span>
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                              isSteep ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                            }`}>
                              {isSteep ? '✓ Meets IITA ≥ 70° Standard' : '⚠ Below 70° Steepness Threshold'}
                            </span>
                          </div>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            {isSteep
                              ? 'cot²(C) = cot²(A) + cot²(B). Valley steepness exceeds critical friction threshold, ensuring gravity mass-flow of dewatered cassava cake without bridging.'
                              : 'Warning: Cassava cake has cohesive bridging tendencies when valley angle C < 70°. Increase h2 or narrow the outlet run to steepen walls.'}
                          </p>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Screw Feeder Sizing Group */}
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-sky-600" />
                <span>Metering Screw Feeder Parameters</span>
              </h4>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Screw Diameter (mm)
                  </label>
                  <input
                    type="number"
                    min={50}
                    max={400}
                    step={10}
                    value={numericValue('screwDiameterMm', 100)}
                    onChange={(e) => updateNumeric('screwDiameterMm', 100, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 100 mm (4 in)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Screw Length (mm)
                  </label>
                  <input
                    type="number"
                    min={300}
                    max={4000}
                    step={50}
                    value={numericValue('screwLengthMm', 1000)}
                    onChange={(e) => updateNumeric('screwLengthMm', 1000, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 1000 mm (3.28 ft)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Selected Operating RPM
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={120}
                    step={1}
                    value={numericValue('screwSelectedRpm', 55)}
                    onChange={(e) => update('screwSelectedRpm', parseInt(e.target.value, 10) || 55)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-emerald-700"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 55 RPM (Req: ~51 RPM)</span>
                </div>

                {/* Capacity per RPM is no longer an input. It is derived from screw
                    diameter, pitch, shaft and trough loading by the CEMA geometric
                    relation, so the geometry inputs above are now the single source
                    of truth. Leaving a free capacity field would let the user set a
                    value that contradicts the screw they just specified. */}

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Overload Factor (Fo)
                  </label>
                  <input
                    type="number"
                    min={1.0}
                    max={5.0}
                    step={0.1}
                    value={numericValue('screwOverloadFactor', 3.0)}
                    onChange={(e) => updateNumeric('screwOverloadFactor', 3.0, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">3.0 (CEMA Heavy Starting)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Drive Efficiency (E)
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={0.99}
                    step={0.01}
                    value={numericValue('screwDriveEfficiency', 0.88)}
                    onChange={(e) => updateNumeric('screwDriveEfficiency', 0.88, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">0.88 (88% gear drive)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Recommended Motor (kW)
                  </label>
                  <input
                    type="number"
                    min={0.25}
                    max={7.5}
                    step={0.1}
                    value={numericValue('practicalMotorPowerKW', 0.75)}
                    onChange={(e) => updateNumeric('practicalMotorPowerKW', 0.75, e)}
                    className="w-full px-2.5 py-1.5 border border-amber-300 rounded font-mono font-bold text-amber-900 bg-white"
                  />
                  <span className="text-[10px] text-slate-400">0.75 kW (1.0 HP with VFD)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Shaft Diameter (mm)
                  </label>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    step={1}
                    value={numericValue('screwShaftDiameterMm', 38)}
                    onChange={(e) => updateNumeric('screwShaftDiameterMm', 38, e)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 38 mm (~1.5 in)</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
