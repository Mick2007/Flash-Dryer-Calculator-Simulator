import React, { useState } from 'react';
import {
  X,
  RefreshCw,
  Scale,
  Thermometer,
  Ruler,
  Wind,
  Zap,
  Gauge,
  ArrowRightLeft,
  ArrowRight,
  Sparkles,
  Check
} from 'lucide-react';
import {
  kgHToTonneH,
  tonneHToKgH,
  kgHToTonneDay,
  tonneDayToKgH,
  kgHToLbH,
  lbHToKgH,
  kgHToShortTonDay,
  shortTonDayToKgH,
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  mmToInches,
  inchesToMm,
  metersToFeet,
  feetToMeters,
  m3hToCfm,
  cfmToM3h,
  mPerSecToFpm,
  kwToHp,
  hpToKw,
  kwToBtuH,
  btuHToKw,
  paToInWg,
  inWgToPa,
  paToPsi
} from '../utils/unitConversion';

interface UnitConverterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyCapacity?: (capacityKgH: number) => void;
}

export const UnitConverterModal: React.FC<UnitConverterModalProps> = ({
  isOpen,
  onClose,
  onApplyCapacity,
}) => {
  const [activeCategory, setActiveCategory] = useState<'capacity' | 'temperature' | 'dimensions' | 'flow' | 'power' | 'pressure'>('capacity');

  // Capacity State (base: kg/h)
  const [baseCapacityKgH, setBaseCapacityKgH] = useState<number>(500);

  // Temperature State (base: °C)
  const [baseTempC, setBaseTempC] = useState<number>(170);

  // Dimensions State (base: mm)
  const [baseDimensionMm, setBaseDimensionMm] = useState<number>(350);

  // Flow State (base: m³/h)
  const [baseFlowM3h, setBaseFlowM3h] = useState<number>(2500);

  // Power State (base: kW)
  const [basePowerKW, setBasePowerKW] = useState<number>(15);

  // Pressure State (base: Pa)
  const [basePressurePa, setBasePressurePa] = useState<number>(1500);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ArrowRightLeft className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">
                Flash Dryer Engineering Unit Converter
              </h3>
              <p className="text-[11px] text-slate-400">
                Bidirectional conversions for Metric, Metric Tonne, and Imperial (US Customary) standards
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Category Navigation */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 px-4 pt-2 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveCategory('capacity')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeCategory === 'capacity'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Capacity &amp; Tonne</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('temperature')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeCategory === 'temperature'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>Temperature (°C / °F)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('dimensions')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeCategory === 'dimensions'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Ruler className="w-3.5 h-3.5" />
            <span>Dimensions (mm / in / ft)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('flow')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeCategory === 'flow'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wind className="w-3.5 h-3.5" />
            <span>Air Flow (m³/h / CFM)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('power')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeCategory === 'power'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Power &amp; Heat (kW / BTU)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveCategory('pressure')}
            className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeCategory === 'pressure'
                ? 'border-emerald-600 text-emerald-700 bg-white font-bold'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Gauge className="w-3.5 h-3.5" />
            <span>Pressure (Pa / in.w.g.)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* CATEGORY 1: CAPACITY & TONNES */}
          {activeCategory === 'capacity' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 flex items-start gap-2 text-xs text-emerald-900">
                <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Convert cassava throughput between <strong>Metric kg/h</strong>, <strong>Metric Tonne (t/h, t/day)</strong>, and <strong>Imperial (lb/h, US Short Ton/day)</strong>. Type in any field to auto-convert all others.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Metric Kilograms */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase tracking-tight">
                    Metric Capacity (kg/h)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={10}
                      value={baseCapacityKgH}
                      onChange={(e) => setBaseCapacityKgH(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">kg/h</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Standard CIRAD &amp; IITA engineering base</span>
                </div>

                {/* Metric Tonnes per Hour */}
                <div className="border border-emerald-200 bg-emerald-50/30 rounded-xl p-3">
                  <label className="text-[11px] font-bold text-emerald-900 block mb-1 uppercase tracking-tight">
                    Metric Tonne / Hour (t/h)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={0.05}
                      value={parseFloat(kgHToTonneH(baseCapacityKgH).toFixed(4))}
                      onChange={(e) => setBaseCapacityKgH(tonneHToKgH(parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-base font-bold font-mono border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 bg-white"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-emerald-600">t/h (MT)</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 mt-1 block">1 Metric Tonne = 1,000 kg</span>
                </div>

                {/* Metric Tonnes per 24h Day */}
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1 uppercase tracking-tight">
                    Metric Tonne / Day (t/day, 24h)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={1}
                      value={parseFloat(kgHToTonneDay(baseCapacityKgH, 24).toFixed(2))}
                      onChange={(e) => setBaseCapacityKgH(tonneDayToKgH(parseFloat(e.target.value) || 0, 24))}
                      className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">t/day</span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1 block">Based on continuous 24-hr processing shift</span>
                </div>

                {/* Imperial Pounds per Hour */}
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3">
                  <label className="text-[11px] font-bold text-indigo-900 block mb-1 uppercase tracking-tight">
                    Imperial Capacity (lb/h)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={25}
                      value={Math.round(kgHToLbH(baseCapacityKgH))}
                      onChange={(e) => setBaseCapacityKgH(lbHToKgH(parseFloat(e.target.value) || 0))}
                      className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-indigo-600">lb/h</span>
                  </div>
                  <span className="text-[10px] text-indigo-700 mt-1 block">1 kg = 2.20462 lb</span>
                </div>

                {/* US Short Ton / Day */}
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3 sm:col-span-2">
                  <label className="text-[11px] font-bold text-indigo-900 block mb-1 uppercase tracking-tight">
                    US Short Ton / Day (ton/day, 2000 lb/ton, 24h)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step={0.5}
                      value={parseFloat(kgHToShortTonDay(baseCapacityKgH, 24).toFixed(2))}
                      onChange={(e) => setBaseCapacityKgH(shortTonDayToKgH(parseFloat(e.target.value) || 0, 24))}
                      className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-indigo-600">US ton/day</span>
                  </div>
                </div>
              </div>

              {/* Quick Preset Buttons */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-600 block mb-1.5">Common Flash Dryer Capacities:</span>
                <div className="flex flex-wrap gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setBaseCapacityKgH(80)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                  >
                    80 kg/h (0.08 t/h • CIRAD Pilot)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseCapacityKgH(250)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                  >
                    250 kg/h (0.25 t/h • Small Commercial)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseCapacityKgH(500)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                  >
                    500 kg/h (0.50 t/h • 12 t/day)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseCapacityKgH(1000)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                  >
                    1,000 kg/h (1.00 t/h • 24 t/day)
                  </button>
                  <button
                    type="button"
                    onClick={() => setBaseCapacityKgH(2000)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded font-medium text-slate-700"
                  >
                    2,000 kg/h (2.00 t/h • 48 t/day)
                  </button>
                </div>
              </div>

              {/* Apply to Simulator Button */}
              {onApplyCapacity && (
                <div className="pt-3 border-t border-slate-200 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      onApplyCapacity(baseCapacityKgH);
                      onClose();
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply {baseCapacityKgH} kg/h ({kgHToTonneH(baseCapacityKgH).toFixed(2)} t/h) to Active Simulator</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CATEGORY 2: TEMPERATURE */}
          {activeCategory === 'temperature' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Celsius (°C)</label>
                  <input
                    type="number"
                    value={baseTempC}
                    onChange={(e) => setBaseTempC(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3">
                  <label className="text-xs font-bold text-indigo-900 block mb-1">Fahrenheit (°F)</label>
                  <input
                    type="number"
                    value={Math.round(celsiusToFahrenheit(baseTempC))}
                    onChange={(e) => setBaseTempC(fahrenheitToCelsius(parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setBaseTempC(170)}
                  className="px-2.5 py-1 bg-slate-100 rounded text-slate-700 hover:bg-slate-200"
                >
                  170°C (338°F • CIRAD Inlet Benchmark)
                </button>
                <button
                  type="button"
                  onClick={() => setBaseTempC(180)}
                  className="px-2.5 py-1 bg-slate-100 rounded text-slate-700 hover:bg-slate-200"
                >
                  180°C (356°F • Upper Drying Limit)
                </button>
                <button
                  type="button"
                  onClick={() => setBaseTempC(75)}
                  className="px-2.5 py-1 bg-slate-100 rounded text-slate-700 hover:bg-slate-200"
                >
                  75°C (167°F • Cyclone Exhaust Air)
                </button>
              </div>
            </div>
          )}

          {/* CATEGORY 3: DIMENSIONS */}
          {activeCategory === 'dimensions' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Millimeters (mm)</label>
                  <input
                    type="number"
                    value={baseDimensionMm}
                    onChange={(e) => setBaseDimensionMm(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3">
                  <label className="text-xs font-bold text-indigo-900 block mb-1">Inches (in)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={parseFloat(mmToInches(baseDimensionMm).toFixed(2))}
                    onChange={(e) => setBaseDimensionMm(inchesToMm(parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Meters (m)</label>
                  <input
                    type="number"
                    step={0.01}
                    value={parseFloat((baseDimensionMm / 1000).toFixed(3))}
                    onChange={(e) => setBaseDimensionMm((parseFloat(e.target.value) || 0) * 1000)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3">
                  <label className="text-xs font-bold text-indigo-900 block mb-1">Feet (ft)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={parseFloat(metersToFeet(baseDimensionMm / 1000).toFixed(2))}
                    onChange={(e) => setBaseDimensionMm(feetToMeters(parseFloat(e.target.value) || 0) * 1000)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY 4: AIR FLOW */}
          {activeCategory === 'flow' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Volumetric Flow (m³/h)</label>
                  <input
                    type="number"
                    value={baseFlowM3h}
                    onChange={(e) => setBaseFlowM3h(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3">
                  <label className="text-xs font-bold text-indigo-900 block mb-1">Imperial CFM (ft³/min)</label>
                  <input
                    type="number"
                    value={Math.round(m3hToCfm(baseFlowM3h))}
                    onChange={(e) => setBaseFlowM3h(cfmToM3h(parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY 5: POWER & HEAT */}
          {activeCategory === 'power' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kilowatts (kW)</label>
                  <input
                    type="number"
                    value={basePowerKW}
                    onChange={(e) => setBasePowerKW(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3">
                  <label className="text-xs font-bold text-indigo-900 block mb-1">Horsepower (hp)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={parseFloat(kwToHp(basePowerKW).toFixed(2))}
                    onChange={(e) => setBasePowerKW(hpToKw(parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div className="border border-amber-200 bg-amber-50/20 rounded-xl p-3">
                  <label className="text-xs font-bold text-amber-900 block mb-1">Thermal BTU/hr</label>
                  <input
                    type="number"
                    value={Math.round(kwToBtuH(basePowerKW))}
                    onChange={(e) => setBasePowerKW(btuHToKw(parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-amber-300 rounded-lg focus:ring-2 focus:ring-amber-500 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* CATEGORY 6: PRESSURE */}
          {activeCategory === 'pressure' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Pascal (Pa)</label>
                  <input
                    type="number"
                    value={basePressurePa}
                    onChange={(e) => setBasePressurePa(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-3">
                  <label className="text-xs font-bold text-indigo-900 block mb-1">Inches Water Gauge (in.w.g.)</label>
                  <input
                    type="number"
                    step={0.1}
                    value={parseFloat(paToInWg(basePressurePa).toFixed(3))}
                    onChange={(e) => setBasePressurePa(inWgToPa(parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-indigo-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                  />
                </div>
                <div className="border border-slate-200 rounded-xl p-3 bg-white">
                  <label className="text-xs font-bold text-slate-700 block mb-1">Kilopascal (kPa)</label>
                  <input
                    type="number"
                    step={0.01}
                    value={parseFloat((basePressurePa / 1000).toFixed(3))}
                    onChange={(e) => setBasePressurePa((parseFloat(e.target.value) || 0) * 1000)}
                    className="w-full px-3 py-2 text-base font-bold font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-between items-center text-xs">
          <span className="text-slate-500">Press Esc or close when finished</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-semibold transition-colors"
          >
            Close Converter
          </button>
        </div>
      </div>
    </div>
  );
};
