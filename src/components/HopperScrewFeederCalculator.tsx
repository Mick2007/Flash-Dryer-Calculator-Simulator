import React, { useState, useMemo } from 'react';
import {
  Layers,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  RotateCcw,
  Sparkles,
  Info,
  Copy,
  Check,
  Download,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  Maximize2,
  Rotate3d,
  Ruler
} from 'lucide-react';
import { CalculationResults, DryerInputs } from '../types/dryer';
import { MATERIAL_PROPERTY_PRESETS, MaterialPropertyPreset } from '../utils/constants';
// Second three.js consumer. Lazy-loaded for the same reason as Cad3dViewer: the
// WebGL library is only needed once the user reaches the hopper/feeder tab.
const HopperScrew3DViewer = React.lazy(() =>
  import('./HopperScrew3DViewer').then((m) => ({ default: m.HopperScrew3DViewer })),
);
import { ScrewFeederDrawing } from './ScrewFeederDrawing';

interface HopperScrewFeederCalculatorProps {
  results: CalculationResults;
  inputs: DryerInputs;
  onUpdateInputs: (updated: Partial<DryerInputs>) => void;
  onResetToIitaReference: () => void;
}

export const HopperScrewFeederCalculator: React.FC<HopperScrewFeederCalculatorProps> = ({
  results,
  inputs,
  onUpdateInputs,
  onResetToIitaReference,
}) => {
  const [copiedSchedule, setCopiedSchedule] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'hopper' | 'screw' | 'derivations' | 'schedule'>('hopper');
  const [diagramView, setDiagramView] = useState<'3d' | 'elevation' | 'plan' | 'screw_drawing'>('3d');

  const { hopperDesign, screwFeederDesign, materialBalance } = results;

  // Selected material preset
  const selectedMaterialPreset = useMemo(() => {
    return (
      MATERIAL_PROPERTY_PRESETS.find((p) => p.id === inputs.materialPropertyType) ||
      MATERIAL_PROPERTY_PRESETS[0]
    );
  }, [inputs.materialPropertyType]);

  const handleSelectMaterial = (preset: MaterialPropertyPreset) => {
    onUpdateInputs({
      materialPropertyType: preset.id as any,
      bulkDensity: preset.bulkDensityKgM3,
      screwMaterialFactor: preset.materialFactorFm,
      screwLoadingPercent: preset.standardTroughLoadingPercent,
    });
  };

  // Auto-solve hopper lower height h2 to match required volume Hc
  const handleAutoSolveHopperHeight = () => {
    const topArea = (inputs.hopperTopWidthM ?? 0.5) * (inputs.hopperTopLengthM ?? 0.5);
    const outletArea = (inputs.hopperOutletWidthM ?? 0.32) * (inputs.hopperOutletLengthM ?? 0.22);
    const frustumFactor = topArea + outletArea + Math.sqrt(topArea * outletArea);
    const h1 = inputs.hopperUpperHeightM ?? 0.1;
    const vUpper = h1 * topArea;
    const targetVLower = Math.max(0.005, hopperDesign.totalRequiredVolumeM3 - vUpper);
    const solvedH2 = Math.round(((3 * targetVLower) / frustumFactor) * 1000) / 1000;
    onUpdateInputs({ hopperLowerHeightM: solvedH2 });
  };

  const copyScheduleText = () => {
    const text = `
IITA / RMRDC FLASH DRYER — HOPPER & SCREW FEEDER DIMENSION SCHEDULE
Reference: Kuye et al. (2011) / IITA HQCF Flash Dryer Design

1. OPERATIONAL & MATERIAL CONDITIONS
Primary Wet Cassava Feed Rate (Fr): ${hopperDesign.wetFeedRateKgH.toFixed(1)} kg/h
Cassava Cake Bulk Density (ρb): ${hopperDesign.bulkDensityKgM3.toFixed(0)} kg/m³ (${screwFeederDesign.bulkDensityLbFt3.toFixed(2)} lb/ft³)
Calculated Dry Product Output: ${materialBalance.productRateKgH.toFixed(1)} kg/h
Buffer Holding Time (tr): ${hopperDesign.holdingTimeMin} minutes
Freeboard Volume Allowance: ${hopperDesign.volumeAllowancePercent}%

2. HOPPER GEOMETRIC FABRICATION SCHEDULE
Top Opening Dimensions (W1 × L1): ${(hopperDesign.topWidthM * 1000).toFixed(0)} mm × ${(hopperDesign.topLengthM * 1000).toFixed(0)} mm
Discharge Throat Dimensions (W2 × L2): ${(hopperDesign.outletWidthM * 1000).toFixed(0)} mm × ${(hopperDesign.outletLengthM * 1000).toFixed(0)} mm
Upper Collar Vertical Height (h1): ${(hopperDesign.upperVerticalHeightM * 1000).toFixed(0)} mm
Lower Pyramidal Frustum Height (h2): ${(hopperDesign.lowerTaperedHeightM * 1000).toFixed(0)} mm
Total Hopper Height (H = h1 + h2): ${(hopperDesign.overallHeightM * 1000).toFixed(0)} mm
Side Slope Angle (A): ${hopperDesign.wallSlopeAngleADeg}°
End Slope Angle (B): ${hopperDesign.wallSlopeAngleBDeg}°
Corner Valley Angle (C): ${hopperDesign.valleyAngleDeg}° (cot²(C) = cot²(A) + cot²(B))
Upper Collar Volume (V1): ${(hopperDesign.upperVolumeM3 * 1000).toFixed(1)} L (${hopperDesign.upperVolumeM3.toFixed(4)} m³)
Lower Tapered Volume (V2): ${(hopperDesign.lowerVolumeM3 * 1000).toFixed(1)} L (${hopperDesign.lowerVolumeM3.toFixed(4)} m³)
Total Constructed Volume (V_total): ${(hopperDesign.totalGeometricVolumeM3 * 1000).toFixed(1)} L (${hopperDesign.totalGeometricVolumeM3.toFixed(4)} m³)
Required Volume with Allowance (Hc): ${(hopperDesign.totalRequiredVolumeM3 * 1000).toFixed(1)} L (${hopperDesign.totalRequiredVolumeM3.toFixed(4)} m³)
Volume Margin: ${hopperDesign.volumeMarginPercent >= 0 ? '+' : ''}${hopperDesign.volumeMarginPercent.toFixed(1)}%

3. SCREW FEEDER FABRICATION & POWER SCHEDULE
Nominal Screw Diameter (D): ${screwFeederDesign.screwDiameterMm} mm (${screwFeederDesign.screwDiameterInches.toFixed(0)} inches)
Screw Conveyor Length (L): ${screwFeederDesign.screwLengthMm} mm (${screwFeederDesign.screwLengthM.toFixed(2)} m / ${screwFeederDesign.screwLengthFt.toFixed(2)} ft)
Screw Pitch (p): ${screwFeederDesign.screwPitchMm} mm (Standard full pitch = D)
Center Shaft Diameter: ${screwFeederDesign.shaftDiameterMm} mm (~1.5" sch 40 pipe)
Flight Thickness: ${screwFeederDesign.flightThicknessMm} mm (SS 304 continuous rolled flights)
Number of Flights: ${screwFeederDesign.numberOfFlights} turns
Trough Loading: ${screwFeederDesign.troughLoadingPercent}% (CEMA Class 30)
Capacity Factor per RPM: ${screwFeederDesign.capacityFactorPerRpmFt3H.toFixed(2)} ft³/h per RPM
Required Volumetric Feed Rate (Qv): ${screwFeederDesign.volumetricFlowM3H.toFixed(4)} m³/h (${screwFeederDesign.volumetricFlowFt3H.toFixed(2)} ft³/h)
Theoretical Required Speed (N_req): ${screwFeederDesign.theoreticalRpm.toFixed(2)} RPM
Selected Operating Speed (N_selected): ${screwFeederDesign.selectedRpm} RPM
Actual Screw Delivery (Q_actual): ${screwFeederDesign.actualCapacityFt3H.toFixed(2)} ft³/h (${screwFeederDesign.actualCapacityM3H.toFixed(4)} m³/h = ${screwFeederDesign.actualCapacityKgH.toFixed(1)} kg/h)
Delivery Capacity Margin: ${screwFeederDesign.capacityMarginPercent >= 0 ? '+' : ''}${screwFeederDesign.capacityMarginPercent.toFixed(1)}%
Friction Horsepower (Pf): ${screwFeederDesign.frictionPowerHP.toFixed(5)} HP (${(screwFeederDesign.frictionPowerHP * 745.7).toFixed(2)} W)
Material Horsepower (Pm): ${screwFeederDesign.materialPowerHP.toFixed(5)} HP (${(screwFeederDesign.materialPowerHP * 745.7).toFixed(2)} W)
Overload Factor (Fo): ${screwFeederDesign.overloadFactorFo.toFixed(1)}x (CEMA Heavy Starting Factor)
Drive Transmission Efficiency (E): ${(screwFeederDesign.driveEfficiency * 100).toFixed(0)}%
Total Theoretical Power: ${screwFeederDesign.totalTheoreticalPowerHP.toFixed(4)} HP (${(screwFeederDesign.totalTheoreticalPowerKW * 1000).toFixed(1)} W ~0.03 HP)
RECOMMENDED INSTALLED MOTOR: ${screwFeederDesign.recommendedMotorPowerKW.toFixed(2)} kW (${screwFeederDesign.recommendedMotorPowerHP.toFixed(1)} HP) Industrial Geared Motor with VFD (15-60 RPM)
    `.trim();

    navigator.clipboard.writeText(text);
    setCopiedSchedule(true);
    setTimeout(() => setCopiedSchedule(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Primary Feed Input & Reference Mode */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                IITA / RMRDC Engineering Standard
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Kuye et al. (2011) • Section 3.1 &amp; 3.2
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">
              Hopper &amp; Screw Feeder Engineering Suite
            </h2>
            <p className="text-xs text-slate-600 mt-0.5 max-w-3xl">
              Engineered calculations for reception buffer storage volume, mass flow gravity discharge slope angles, and variable-speed screw feeder delivery.
            </p>
          </div>

          {/* Quick Benchmark Reset */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onResetToIitaReference}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 text-xs font-bold transition-colors shadow-2xs"
              title="Reset parameters to the 820 kg/h IITA Reference Worked Example"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
              <span>Load 820 kg/h Reference Case</span>
            </button>
            <button
              type="button"
              onClick={copyScheduleText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors shadow-2xs"
            >
              {copiedSchedule ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSchedule ? 'Copied Specs!' : 'Copy Schedule'}</span>
            </button>
          </div>
        </div>

        {/* PRIMARY FEED INPUT WORKBENCH (Section 1 requirement) */}
        <div className="pt-4 grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
          <div className="md:col-span-2 bg-emerald-50/50 rounded-xl p-4 border border-emerald-200/80">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <span>1. Primary Design Input: Wet Cassava Feed Rate (F_r)</span>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-200 text-emerald-900">
                  Governing Input
                </span>
              </label>
              <span className="text-xs font-extrabold text-emerald-800 font-mono">
                {inputs.feedRate.toFixed(1)} kg/h
              </span>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="range"
                min={50}
                max={5000}
                step={10}
                value={inputs.feedRate}
                onChange={(e) => onUpdateInputs({ feedRate: parseFloat(e.target.value) || 100, capacityMode: 'feed' })}
                className="w-full accent-emerald-600 cursor-pointer h-2 bg-emerald-200 rounded-lg"
              />
              <div className="relative w-36 shrink-0">
                <input
                  type="number"
                  min={10}
                  max={20000}
                  step={10}
                  value={inputs.feedRate}
                  onChange={(e) => onUpdateInputs({ feedRate: Math.max(10, parseFloat(e.target.value) || 100), capacityMode: 'feed' })}
                  className="w-full px-2.5 py-1.5 text-xs font-bold border border-emerald-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono bg-white text-right pr-11"
                />
                <span className="absolute right-2.5 top-1.5 text-xs font-bold text-slate-500 pointer-events-none">
                  kg/h
                </span>
              </div>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-600">
              <span>
                Derived Dry Flour Output (at {inputs.initialMoisture}% initial &rarr; {inputs.finalMoisture}% final):
              </span>
              <span className="font-bold text-slate-900 font-mono">
                {materialBalance.productRateKgH.toFixed(1)} kg/h Dry Flour ({(materialBalance.productRateKgH / 1000).toFixed(3)} t/h)
              </span>
            </div>
          </div>

          {/* Quick capacity preset buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-700 block">
              Quick Reference Presets:
            </span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => onUpdateInputs({ feedRate: 820, capacityMode: 'feed' })}
                className={`px-2 py-1.5 text-xs rounded-lg font-bold border text-left transition-all ${
                  Math.abs(inputs.feedRate - 820) < 5
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-[10px] text-emerald-100 font-normal">Reference Case</div>
                820 kg/h Wet
              </button>
              <button
                type="button"
                onClick={() => onUpdateInputs({ feedRate: 500, capacityMode: 'feed' })}
                className={`px-2 py-1.5 text-xs rounded-lg font-bold border text-left transition-all ${
                  Math.abs(inputs.feedRate - 500) < 5
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-[10px] text-slate-400 font-normal">Standard Unit</div>
                500 kg/h Wet
              </button>
              <button
                type="button"
                onClick={() => onUpdateInputs({ feedRate: 1000, capacityMode: 'feed' })}
                className={`px-2 py-1.5 text-xs rounded-lg font-bold border text-left transition-all ${
                  Math.abs(inputs.feedRate - 1000) < 5
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-[10px] text-slate-400 font-normal">1.0 t/h Commercial</div>
                1,000 kg/h Wet
              </button>
              <button
                type="button"
                onClick={() => onUpdateInputs({ feedRate: 1500, capacityMode: 'feed' })}
                className={`px-2 py-1.5 text-xs rounded-lg font-bold border text-left transition-all ${
                  Math.abs(inputs.feedRate - 1500) < 5
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                }`}
              >
                <div className="text-[10px] text-slate-400 font-normal">Medium Plant</div>
                1,500 kg/h Wet
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 12: MATERIAL ASSUMPTION TRANSPARENCY NOTICE & SELECTOR */}
      <div className="bg-amber-500/10 border-2 border-amber-500/40 rounded-xl p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs sm:text-sm font-bold text-amber-950 uppercase tracking-tight flex items-center gap-2">
              <span>Section 12: Material-Property Assumption (CEMA &amp; Martin Engineering Basis)</span>
            </h4>
            <p className="text-xs text-amber-900 leading-relaxed font-medium">
              <strong>Engineering Note:</strong> Standard Martin Conveyor / CEMA engineering handbooks do not have a dedicated pre-cataloged entry for mechanically pressed cassava filter cake. Therefore, the IITA / RMRDC reference design (Kuye et al. 2011, p. 15–16) adopts a comparable material assumption: Class 30 semi-abrasive, cohesive dewatered cake with bulk density <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono font-bold">1380 kg/m³ (86.15 lb/ft³)</code>, material factor <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono font-bold">F_m = 1.2</code>, and 30% trough fill.
            </p>
          </div>
        </div>

        {/* Material Presets Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 pt-2 border-t border-amber-200/60">
          {MATERIAL_PROPERTY_PRESETS.map((preset) => {
            const isSelected = inputs.materialPropertyType === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectMaterial(preset)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isSelected
                    ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                    : 'bg-white hover:bg-amber-100/40 border-amber-200 text-slate-800'
                }`}
              >
                <div className="text-xs font-bold leading-tight">{preset.name}</div>
                <div className={`text-[10px] mt-1 font-mono ${isSelected ? 'text-amber-100' : 'text-slate-500'}`}>
                  &rho;b: {preset.bulkDensityKgM3} kg/m³ • Fm: {preset.materialFactorFm} • Load: {preset.standardTroughLoadingPercent}%
                </div>
              </button>
            );
          })}
        </div>

        {/* Editable Material Property Factors */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 bg-white/70 p-3 rounded-lg border border-amber-200/60 text-xs">
          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Bulk Density (&rho;b)
            </label>
            <div className="relative">
              <input
                type="number"
                min={200}
                max={2500}
                step={10}
                value={inputs.bulkDensity}
                onChange={(e) => onUpdateInputs({ bulkDensity: parseFloat(e.target.value) || 1380 })}
                className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs pr-12"
              />
              <span className="absolute right-2 top-1 text-[10px] text-slate-400 font-bold">kg/m³</span>
            </div>
            <span className="text-[10px] text-slate-500 font-mono">
              = {(inputs.bulkDensity * (2.20462 / 35.3147)).toFixed(2)} lb/ft³
            </span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Material Factor (Fm)
            </label>
            <input
              type="number"
              min={0.4}
              max={3.0}
              step={0.1}
              value={inputs.screwMaterialFactor ?? 1.2}
              onChange={(e) => onUpdateInputs({ screwMaterialFactor: parseFloat(e.target.value) || 1.2 })}
              className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs"
            />
            <span className="text-[10px] text-slate-500">1.2 for cassava cake</span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Trough Loading (%)
            </label>
            <input
              type="number"
              min={15}
              max={45}
              step={5}
              value={inputs.screwLoadingPercent ?? 30}
              onChange={(e) => onUpdateInputs({ screwLoadingPercent: parseFloat(e.target.value) || 30 })}
              className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs"
            />
            <span className="text-[10px] text-slate-500">30% (CEMA Standard)</span>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 block mb-1">
              Drive Efficiency (E)
            </label>
            <input
              type="number"
              min={0.5}
              max={0.98}
              step={0.01}
              value={inputs.screwDriveEfficiency ?? 0.88}
              onChange={(e) => onUpdateInputs({ screwDriveEfficiency: parseFloat(e.target.value) || 0.88 })}
              className="w-full px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs"
            />
            <span className="text-[10px] text-slate-500">88% gear reduction</span>
          </div>
        </div>
      </div>

      {/* SUB-NAVIGATION TABS */}
      <div className="flex border-b border-slate-200 bg-white rounded-t-xl px-2 pt-2 gap-1 overflow-x-auto text-xs font-semibold">
        <button
          type="button"
          onClick={() => setActiveSubTab('hopper')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'hopper'
              ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5 text-emerald-600" />
          <span>1. Hopper Design &amp; Flow Geometry</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-emerald-100 text-emerald-800 font-bold">
            {(hopperDesign.totalGeometricVolumeM3 * 1000).toFixed(0)} L
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('screw')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'screw'
              ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Zap className="w-3.5 h-3.5 text-emerald-600" />
          <span>2. Screw Feeder &amp; Power Sizing</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-sky-100 text-sky-800 font-bold">
            Ø{screwFeederDesign.screwDiameterMm} mm @ {screwFeederDesign.selectedRpm} RPM
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('derivations')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'derivations'
              ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
          <span>3. Complete Derivation Sequences</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
            28 Steps
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('schedule')}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all whitespace-nowrap ${
            activeSubTab === 'schedule'
              ? 'border-emerald-600 text-emerald-700 font-bold bg-emerald-50/40 rounded-t-lg'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Copy className="w-3.5 h-3.5 text-emerald-600" />
          <span>4. Workshop Dimension Schedule</span>
        </button>
      </div>

      {/* TAB 1: HOPPER DESIGN & FLOW GEOMETRY */}
      {activeSubTab === 'hopper' && (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">10-Min Mass Stored</span>
              <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
                {hopperDesign.massHeldKg.toFixed(1)} kg
              </span>
              <span className="text-[11px] text-slate-500">at {hopperDesign.holdingTimeMin} min loading time</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Required Vol (Hc)</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">
                {(hopperDesign.totalRequiredVolumeM3 * 1000).toFixed(1)} L
              </span>
              <span className="text-[11px] text-slate-500">{hopperDesign.totalRequiredVolumeM3.toFixed(4)} m³ (+{hopperDesign.volumeAllowancePercent}%)</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Fabricated Volume</span>
              <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
                {(hopperDesign.totalGeometricVolumeM3 * 1000).toFixed(1)} L
              </span>
              <span className={`text-[11px] font-bold ${hopperDesign.volumeMarginPercent >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {hopperDesign.volumeMarginPercent >= 0 ? '+' : ''}{hopperDesign.volumeMarginPercent.toFixed(1)}% margin
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Valley Angle (C)</span>
              <span className="text-xl font-black text-amber-700 font-mono mt-0.5 block">
                {hopperDesign.valleyAngleDeg}°
              </span>
              <span className="text-[11px] text-emerald-700 font-bold">
                {hopperDesign.valleyAngleDeg >= 70 ? 'Mass Flow (Anti-Bridge)' : 'Funnel Flow Risk'}
              </span>
            </div>
          </div>

          {/* Interactive 3D & 2D Hopper Engineering Visualizer */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Rotate3d className="w-4 h-4 text-emerald-600" />
                  <span>Hopper CAD Visualizer &amp; Dynamic Geometry</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Upper vertical collar (h1) + lower tapered pyramidal frustum (h2) + metering screw feeder
                </p>
              </div>

              {/* View Mode Switcher */}
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs font-semibold flex-wrap">
                <button
                  type="button"
                  onClick={() => setDiagramView('3d')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
                    diagramView === '3d'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Rotate3d className="w-3.5 h-3.5" />
                  <span>3D Interactive CAD</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiagramView('elevation')}
                  className={`px-3 py-1.5 rounded transition-all ${
                    diagramView === 'elevation'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Elevation (Front)
                </button>
                <button
                  type="button"
                  onClick={() => setDiagramView('plan')}
                  className={`px-3 py-1.5 rounded transition-all ${
                    diagramView === 'plan'
                      ? 'bg-emerald-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Plan View (Top)
                </button>
                <button
                  type="button"
                  onClick={() => setDiagramView('screw_drawing')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all ${
                    diagramView === 'screw_drawing'
                      ? 'bg-sky-600 text-white shadow-xs font-bold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Screw Assembly CAD</span>
                </button>
              </div>
            </div>

            {/* Main Visualizer Content Area */}
            {diagramView === '3d' && (
              <div className="space-y-4">
                <React.Suspense
                  fallback={
                    <div className="flex items-center justify-center h-64 bg-slate-950 text-slate-400 text-xs font-mono tracking-wider uppercase">
                      Loading 3D assembly…
                    </div>
                  }
                >
                  <HopperScrew3DViewer
                    hopperDesign={hopperDesign}
                    screwFeederDesign={screwFeederDesign}
                  />
                </React.Suspense>
              </div>
            )}

            {diagramView === 'screw_drawing' && (
              <div className="space-y-4">
                <ScrewFeederDrawing
                  hopperDesign={hopperDesign}
                  screwFeederDesign={screwFeederDesign}
                />
              </div>
            )}

            {(diagramView === 'elevation' || diagramView === 'plan') && (
              <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-center min-h-[320px]">
                {diagramView === 'elevation' ? (
                  <svg viewBox="0 0 400 320" className="w-full max-w-[420px] h-auto text-slate-300">
                    <defs>
                      <linearGradient id="mashFill" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#d97706" stopOpacity="0.4" />
                        <stop offset="100%" stopColor="#b45309" stopOpacity="0.85" />
                      </linearGradient>
                      <linearGradient id="wallSteel" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#64748b" />
                        <stop offset="50%" stopColor="#94a3b8" />
                        <stop offset="100%" stopColor="#64748b" />
                      </linearGradient>
                      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.5" />
                      </pattern>
                    </defs>

                    <rect width="400" height="320" fill="url(#grid)" />

                    {/* Upper Collar polygon */}
                    <polygon
                      points="80,50 320,50 320,85 80,85"
                      fill="#334155"
                      stroke="#94a3b8"
                      strokeWidth="2"
                    />

                    {/* Lower Frustum polygon */}
                    <polygon
                      points="80,85 320,85 245,245 155,245"
                      fill="#1e293b"
                      stroke="#38bdf8"
                      strokeWidth="2"
                    />

                    {/* Wet Mash Cake Fill Representation */}
                    <polygon
                      points="95,95 305,95 242,240 158,240"
                      fill="url(#mashFill)"
                      stroke="#f59e0b"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />

                    {/* Screw Feeder Trough at bottom */}
                    <rect x="135" y="245" width="130" height="35" rx="4" fill="#0f172a" stroke="#10b981" strokeWidth="2" />
                    <circle cx="200" cy="262" r="14" fill="#022c22" stroke="#10b981" strokeWidth="1.5" />
                    <circle cx="200" cy="262" r="4" fill="#34d399" />
                    <line x1="140" y1="262" x2="260" y2="262" stroke="#34d399" strokeWidth="1" strokeDasharray="4 2" />

                    {/* Dimension Lines & Labels */}
                    <line x1="80" y1="35" x2="320" y2="35" stroke="#38bdf8" strokeWidth="1.5" />
                    <line x1="80" y1="30" x2="80" y2="40" stroke="#38bdf8" strokeWidth="1.5" />
                    <line x1="320" y1="30" x2="320" y2="40" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="200" y="28" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
                      W1 = {(hopperDesign.topWidthM * 1000).toFixed(0)} mm
                    </text>

                    <line x1="335" y1="50" x2="335" y2="85" stroke="#94a3b8" strokeWidth="1.5" />
                    <line x1="330" y1="50" x2="340" y2="50" stroke="#94a3b8" strokeWidth="1.5" />
                    <line x1="330" y1="85" x2="340" y2="85" stroke="#94a3b8" strokeWidth="1.5" />
                    <text x="345" y="72" fill="#94a3b8" fontSize="10" fontWeight="bold">
                      h1: {(hopperDesign.upperVerticalHeightM * 1000).toFixed(0)} mm
                    </text>

                    <line x1="335" y1="85" x2="335" y2="245" stroke="#38bdf8" strokeWidth="1.5" />
                    <line x1="330" y1="245" x2="340" y2="245" stroke="#38bdf8" strokeWidth="1.5" />
                    <text x="345" y="170" fill="#38bdf8" fontSize="10" fontWeight="bold">
                      h2: {(hopperDesign.lowerTaperedHeightM * 1000).toFixed(0)} mm
                    </text>

                    <line x1="155" y1="225" x2="245" y2="225" stroke="#a7f3d0" strokeWidth="1" />
                    <text x="200" y="220" fill="#a7f3d0" fontSize="9" fontWeight="bold" textAnchor="middle">
                      W2 = {(hopperDesign.outletWidthM * 1000).toFixed(0)} mm
                    </text>

                    <text x="110" y="130" fill="#fcd34d" fontSize="10" fontWeight="bold">
                      A: {hopperDesign.wallSlopeAngleADeg}°
                    </text>
                    <text x="200" y="150" fill="#fef08a" fontSize="10" fontWeight="bold" textAnchor="middle">
                      Valley C: {hopperDesign.valleyAngleDeg}°
                    </text>

                    <text x="200" y="302" fill="#10b981" fontSize="11" fontWeight="bold" textAnchor="middle">
                      &Oslash;{screwFeederDesign.screwDiameterMm} mm Metering Screw Feeder
                    </text>
                  </svg>
                ) : (
                  <svg viewBox="0 0 400 320" className="w-full max-w-[420px] h-auto text-slate-300">
                    <rect width="400" height="320" fill="#0f172a" />
                    <rect x="70" y="40" width="260" height="240" rx="4" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                    <rect x="115" y="105" width="170" height="110" rx="2" fill="#022c22" stroke="#10b981" strokeWidth="2" />

                    <line x1="70" y1="40" x2="115" y2="105" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1="330" y1="40" x2="285" y2="105" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1="70" y1="280" x2="115" y2="215" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="3 2" />
                    <line x1="330" y1="280" x2="285" y2="215" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="3 2" />

                    <text x="200" y="30" fill="#38bdf8" fontSize="11" fontWeight="bold" textAnchor="middle">
                      Top Length L1 = {(hopperDesign.topLengthM * 1000).toFixed(0)} mm
                    </text>
                    <text x="345" y="165" fill="#38bdf8" fontSize="11" fontWeight="bold">
                      W1: {(hopperDesign.topWidthM * 1000).toFixed(0)} mm
                    </text>
                    <text x="200" y="165" fill="#34d399" fontSize="10" fontWeight="bold" textAnchor="middle">
                      Outlet: {(hopperDesign.outletLengthM * 1000).toFixed(0)} &times; {(hopperDesign.outletWidthM * 1000).toFixed(0)} mm
                    </text>
                    <text x="200" y="305" fill="#fcd34d" fontSize="10" fontWeight="bold" textAnchor="middle">
                      Valley Seam Angle C = {hopperDesign.valleyAngleDeg}&deg; (Gravity Mass Flow)
                    </text>
                  </svg>
                )}
              </div>
            )}

            {/* Live Geometric Parameter Tuning */}
            <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <span className="font-bold text-slate-800 text-xs sm:text-sm block">Hopper Dimensions &amp; Geometric Parameters</span>
                  <span className="text-[11px] text-slate-500">
                    Assumed opening dimensions solve lower frustum height h2 from calculated volume Hc ({(hopperDesign.totalRequiredVolumeM3 * 1000).toFixed(1)} L)
                  </span>
                </div>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-full border border-emerald-300">
                  h2 Solved: {(hopperDesign.lowerTaperedHeightM * 1000).toFixed(0)} mm
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Top Width W1 (m)
                  </label>
                  <input
                    type="number"
                    min={0.2}
                    max={2.0}
                    step={0.05}
                    value={inputs.hopperTopWidthM ?? 0.5}
                    onChange={(e) => onUpdateInputs({ hopperTopWidthM: parseFloat(e.target.value) || 0.5 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 0.50 m (500 mm)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Top Length L1 (m)
                  </label>
                  <input
                    type="number"
                    min={0.2}
                    max={2.0}
                    step={0.05}
                    value={inputs.hopperTopLengthM ?? 0.5}
                    onChange={(e) => onUpdateInputs({ hopperTopLengthM: parseFloat(e.target.value) || 0.5 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 0.50 m (500 mm)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Outlet Width W2 (m)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    max={1.0}
                    step={0.02}
                    value={inputs.hopperOutletWidthM ?? 0.32}
                    onChange={(e) => onUpdateInputs({ hopperOutletWidthM: parseFloat(e.target.value) || 0.32 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 0.32 m (320 mm)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Outlet Length L2 (m)
                  </label>
                  <input
                    type="number"
                    min={0.1}
                    max={1.0}
                    step={0.02}
                    value={inputs.hopperOutletLengthM ?? 0.22}
                    onChange={(e) => onUpdateInputs({ hopperOutletLengthM: parseFloat(e.target.value) || 0.22 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 0.22 m (220 mm)</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                    Collar Height h1 (m)
                  </label>
                  <input
                    type="number"
                    min={0.05}
                    max={0.5}
                    step={0.01}
                    value={inputs.hopperUpperHeightM ?? 0.1}
                    onChange={(e) => onUpdateInputs({ hopperUpperHeightM: parseFloat(e.target.value) || 0.1 })}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg font-mono font-bold bg-white"
                  />
                  <span className="text-[10px] text-slate-400">Ref: 0.10 m (100 mm)</span>
                </div>

                <div className="bg-emerald-50/90 border border-emerald-300 rounded-lg p-2.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-emerald-950 block">
                        Frustum h2 (m)
                      </label>
                      <span className="text-[9px] font-extrabold uppercase px-1 py-0.2 rounded bg-emerald-200 text-emerald-900">
                        Solved
                      </span>
                    </div>
                    <div className="text-sm font-extrabold text-emerald-800 font-mono mt-0.5">
                      {hopperDesign.lowerTaperedHeightM.toFixed(3)} m
                    </div>
                  </div>
                  <span className="text-[10px] text-emerald-700 font-medium block mt-0.5">
                    ({Math.round(hopperDesign.lowerTaperedHeightM * 1000)} mm)
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 font-mono text-xs">
                <div className="text-slate-600 flex items-center gap-3">
                  <span>Run_W: <strong className="text-slate-900 font-bold">{(hopperDesign.runWidthM * 1000).toFixed(0)} mm</strong></span>
                  <span>•</span>
                  <span>Run_L: <strong className="text-slate-900 font-bold">{(hopperDesign.runLengthM * 1000).toFixed(0)} mm</strong></span>
                </div>
                <div>
                  <span className="text-slate-600">Total Overall Height H (h1 + h2): </span>
                  <span className="font-extrabold text-slate-900 text-sm">
                    {(hopperDesign.overallHeightM * 1000).toFixed(0)} mm ({hopperDesign.overallHeightM.toFixed(3)} m)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Dynamic Wall Slope & Anti-Bridging Valley Angle Verification */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  4. Dynamic Calculation of Side Wall Angles (A, B) &amp; Corner Valley Angle (C) Verification
                </h3>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
                Trigonometrical Derivation
              </span>
            </div>

            {/* Dynamic Angle Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Side Wall Slope Angle A */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    Side Wall Slope Angle (A)
                  </span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                    Width Direction
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {hopperDesign.wallSlopeAngleADeg}&deg;
                  </span>
                  <span className="text-xs text-slate-500 font-medium">slope</span>
                </div>

                <div className="text-[11px] font-mono bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Run_W = (W1 - W2) / 2</span>
                    <strong className="text-slate-800">{(hopperDesign.runWidthM * 1000).toFixed(0)} mm</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1">
                    <span>Angle A = arctan(h2 / Run_W)</span>
                    <strong className="text-sky-700 font-bold">{hopperDesign.wallSlopeAngleADeg}&deg;</strong>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  Computed from h2 = {hopperDesign.lowerTaperedHeightM.toFixed(3)} m and Run_W = {hopperDesign.runWidthM.toFixed(3)} m (IITA ref: 76&deg;)
                </p>
              </div>

              {/* End Wall Slope Angle B */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">
                    End Wall Slope Angle (B)
                  </span>
                  <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-sky-100 text-sky-800">
                    Length Direction
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-slate-900 font-mono">
                    {hopperDesign.wallSlopeAngleBDeg}&deg;
                  </span>
                  <span className="text-xs text-slate-500 font-medium">slope</span>
                </div>

                <div className="text-[11px] font-mono bg-white p-2.5 rounded-lg border border-slate-200 space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>Run_L = (L1 - L2) / 2</span>
                    <strong className="text-slate-800">{(hopperDesign.runLengthM * 1000).toFixed(0)} mm</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1">
                    <span>Angle B = arctan(h2 / Run_L)</span>
                    <strong className="text-sky-700 font-bold">{hopperDesign.wallSlopeAngleBDeg}&deg;</strong>
                  </div>
                </div>

                <p className="text-[10px] text-slate-500">
                  Computed from h2 = {hopperDesign.lowerTaperedHeightM.toFixed(3)} m and Run_L = {hopperDesign.runLengthM.toFixed(3)} m (IITA ref: 81&deg;)
                </p>
              </div>

              {/* Corner Valley Angle C */}
              <div className={`p-4 rounded-xl border space-y-2 ${hopperDesign.isValleyAngleSufficient ? 'bg-emerald-50/80 border-emerald-300' : 'bg-amber-50/80 border-amber-300'}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-wide ${hopperDesign.isValleyAngleSufficient ? 'text-emerald-950' : 'text-amber-950'}`}>
                    Corner Valley Angle (C)
                  </span>
                  <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${hopperDesign.isValleyAngleSufficient ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'}`}>
                    {hopperDesign.isValleyAngleSufficient ? '✓ Mass Flow' : '⚠ Funnel Flow'}
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className={`text-2xl font-black font-mono ${hopperDesign.isValleyAngleSufficient ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {hopperDesign.valleyAngleDeg}&deg;
                  </span>
                  <span className="text-xs text-slate-600 font-medium">corner seam</span>
                </div>

                <div className="text-[11px] font-mono bg-white/90 p-2.5 rounded-lg border border-slate-200 space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span>cot&sup2;(C) = cot&sup2;(A) + cot&sup2;(B)</span>
                    <strong className="text-slate-800">{hopperDesign.valleyAngleDeg}&deg;</strong>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1">
                    <span>Standard Steepness Threshold</span>
                    <strong className="text-emerald-700 font-bold">&ge; 70&deg;</strong>
                  </div>
                </div>

                <p className={`text-[10px] ${hopperDesign.isValleyAngleSufficient ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {hopperDesign.isValleyAngleSufficient
                    ? 'Verified: Angle C meets standard steepness angle for cassava mash'
                    : 'Warning: Valley angle C < 70° threshold; cohesive bridging likely'}
                </p>
              </div>
            </div>

            {/* Standard Steepness Confirmation Banner */}
            <div className={`rounded-xl p-4 border flex items-start gap-3 text-xs ${
              hopperDesign.isValleyAngleSufficient
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                : 'bg-amber-50 border-amber-300 text-amber-900'
            }`}>
              {hopperDesign.isValleyAngleSufficient ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <span className="font-bold block text-sm">
                  {hopperDesign.isValleyAngleSufficient
                    ? `Mass Gravity Flow Confirmed — Valley Angle C = ${hopperDesign.valleyAngleDeg}° ≥ 70° Standard`
                    : `Funnel Flow Warning — Valley Angle C = ${hopperDesign.valleyAngleDeg}° < 70° Threshold`}
                </span>
                <p className="leading-relaxed">
                  {hopperDesign.flowRegimeDescription} According to Kuye et al. (2011) and Jenike mass-flow criteria, a valley angle of at least 70&deg; is required for cohesive dewatered cassava mash cake (40–45% moisture) to slide freely along the 4 corner seams without bridging, arching, or dead-zone stagnation.
                </p>
              </div>
            </div>

            {/* Engineering Rationale for Steep Pyramidal Taper */}
            <div className="bg-slate-50 rounded-lg p-4 text-xs text-slate-700 space-y-2 border border-slate-200">
              <span className="font-bold text-slate-900 block">
                Engineering Rationale for Steep Pyramidal Taper in Cassava Flash Dryers:
              </span>
              <ul className="list-disc pl-5 space-y-1 text-slate-600">
                <li>
                  <strong>Encourage gravity flow toward screw:</strong> Dewatered cassava mash (40–45% moisture) has high cohesive internal friction and high wall adhesion. Steep slopes ensure gravity forces exceed wall yield stress.
                </li>
                <li>
                  <strong>Eliminate stagnant zones:</strong> Flat or shallow corners allow moist mash to settle, ferment, and sour, spoiling the flour colour and pH.
                </li>
                <li>
                  <strong>Prevent bridging &amp; ratholing:</strong> Valley angles C &ge; 70&deg; prevent stable cohesive arches from forming over the outlet throat.
                </li>
                <li>
                  <strong>Smooth funneling:</strong> Guides cohesive mash directly into the screw flighting without requiring external vibrators.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SCREW FEEDER & POWER SIZING */}
      {activeSubTab === 'screw' && (
        <div className="space-y-6">
          {/* Key Metric Highlights */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Required Volumetric Flow</span>
              <span className="text-xl font-black text-slate-900 font-mono mt-0.5 block">
                {screwFeederDesign.volumetricFlowFt3H.toFixed(2)} ft³/h
              </span>
              <span className="text-[11px] text-slate-500">{screwFeederDesign.volumetricFlowM3H.toFixed(4)} m³/h</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Theoretical Speed</span>
              <span className="text-xl font-black text-sky-700 font-mono mt-0.5 block">
                {screwFeederDesign.theoreticalRpm.toFixed(2)} RPM
              </span>
              <span className="text-[11px] text-slate-500">at 0.41 ft³/h/RPM factor</span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Operating Speed</span>
              <span className="text-xl font-black text-emerald-700 font-mono mt-0.5 block">
                {screwFeederDesign.selectedRpm} RPM
              </span>
              <span className="text-[11px] font-bold text-emerald-600">
                +{screwFeederDesign.capacityMarginPercent.toFixed(1)}% Capacity Margin
              </span>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <span className="text-[11px] font-semibold text-slate-500 uppercase block">Recommended Motor</span>
              <span className="text-xl font-black text-amber-700 font-mono mt-0.5 block">
                {screwFeederDesign.recommendedMotorPowerKW.toFixed(2)} kW
              </span>
              <span className="text-[11px] text-slate-500">({screwFeederDesign.recommendedMotorPowerHP.toFixed(1)} HP with VFD)</span>
            </div>
          </div>

          {/* Interactive Operating RPM & Diameter Control */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Screw Feeder Speed &amp; Delivery Workbench
                </h3>
                <p className="text-xs text-slate-500">
                  Select practical operating RPM and verify capacity reserve
                </p>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-bold ${screwFeederDesign.isCapacitySufficient ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                {screwFeederDesign.isCapacitySufficient ? 'Capacity Sufficient' : 'Speed Too Low'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-center">
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800">
                    Selected Operating RPM (N_selected):
                  </label>
                  <span className="text-sm font-mono font-extrabold text-emerald-700">
                    {screwFeederDesign.selectedRpm} RPM
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={15}
                    max={120}
                    step={1}
                    value={screwFeederDesign.selectedRpm}
                    onChange={(e) => onUpdateInputs({ screwSelectedRpm: parseInt(e.target.value, 10) || 55 })}
                    className="w-full accent-emerald-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
                  />
                  <input
                    type="number"
                    min={10}
                    max={150}
                    step={1}
                    value={screwFeederDesign.selectedRpm}
                    onChange={(e) => onUpdateInputs({ screwSelectedRpm: Math.max(10, parseInt(e.target.value, 10) || 55) })}
                    className="w-20 px-2 py-1 border border-slate-300 rounded font-mono font-bold text-xs text-right"
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>Theoretical required: {screwFeederDesign.theoreticalRpm.toFixed(2)} RPM</span>
                  <span className="font-semibold text-emerald-700">
                    Ref Design: 55 RPM
                  </span>
                </div>
              </div>

              {/* Delivery Comparison Card */}
              <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Required Feed Delivery:</span>
                  <span className="font-bold text-slate-900 font-mono">
                    {screwFeederDesign.volumetricFlowFt3H.toFixed(2)} ft³/h ({screwFeederDesign.wetFeedRateKgH.toFixed(1)} kg/h)
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Actual Screw Delivery:</span>
                  <span className="font-bold text-emerald-800 font-mono">
                    {screwFeederDesign.actualCapacityFt3H.toFixed(2)} ft³/h ({screwFeederDesign.actualCapacityKgH.toFixed(1)} kg/h)
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-emerald-200">
                  <span className="font-bold text-slate-700">Delivery Reserve Margin:</span>
                  <span className="font-extrabold text-emerald-700 font-mono">
                    {screwFeederDesign.capacityMarginPercent >= 0 ? '+' : ''}{screwFeederDesign.capacityMarginPercent.toFixed(1)}% ({(screwFeederDesign.actualCapacityKgH - screwFeederDesign.wetFeedRateKgH).toFixed(1)} kg/h surplus)
                  </span>
                </div>
              </div>
            </div>

            {/* Screw Feeder Dimensions & Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Screw Diameter (D)</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                  {screwFeederDesign.screwDiameterMm} mm ({screwFeederDesign.screwDiameterInches.toFixed(0)}")
                </span>
                <span className="text-[10px] text-slate-400">Standard CEMA 4-inch</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Conveyor Length (L)</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                  {screwFeederDesign.screwLengthMm} mm ({screwFeederDesign.screwLengthFt.toFixed(2)} ft)
                </span>
                <span className="text-[10px] text-slate-400">Trough length 1.0 m</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Screw Pitch (p)</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                  {screwFeederDesign.screwPitchMm} mm
                </span>
                <span className="text-[10px] text-slate-400">Full standard pitch (= D)</span>
              </div>

              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase font-bold block">Flights &amp; Shaft</span>
                <span className="text-sm font-bold text-slate-900 font-mono mt-0.5 block">
                  {screwFeederDesign.numberOfFlights} turns &bull; &Oslash;{screwFeederDesign.shaftDiameterMm} mm
                </span>
                <span className="text-[10px] text-slate-400">4 mm SS 304 flight plate</span>
              </div>
            </div>
          </div>

          {/* Technical CAD Drawing of the Screw Feeder Assembly */}
          <ScrewFeederDrawing
            hopperDesign={hopperDesign}
            screwFeederDesign={screwFeederDesign}
          />

          {/* Section 9, 10, 11: Power Calculation & Motor Selection */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Zap className="w-4 h-4 text-amber-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Sections 9–11: Screw Conveyor Power Breakdown &amp; Motor Sizing
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-600 uppercase block">Friction Horsepower (Pf)</span>
                <span className="text-lg font-black text-slate-900 font-mono block">
                  {screwFeederDesign.frictionPowerHP.toFixed(5)} HP
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  = {(screwFeederDesign.frictionPowerHP * 745.7).toFixed(2)} Watts
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  Pf = (L &times; N &times; Fd &times; Fb) / 1,000,000
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-1">
                <span className="text-[11px] font-bold text-slate-600 uppercase block">Material Horsepower (Pm)</span>
                <span className="text-lg font-black text-slate-900 font-mono block">
                  {screwFeederDesign.materialPowerHP.toFixed(5)} HP
                </span>
                <span className="text-[11px] text-slate-500 font-mono">
                  = {(screwFeederDesign.materialPowerHP * 745.7).toFixed(2)} Watts
                </span>
                <p className="text-[10px] text-slate-400 mt-1">
                  Pm = (C &times; L &times; W &times; Ff &times; Fm &times; Fp) / 1,000,000
                </p>
              </div>

              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 space-y-1">
                <span className="text-[11px] font-bold text-amber-950 uppercase block">Total Theoretical Power</span>
                <span className="text-lg font-black text-amber-800 font-mono block">
                  {screwFeederDesign.totalTheoreticalPowerHP.toFixed(4)} HP (~0.03 HP)
                </span>
                <span className="text-[11px] text-amber-900 font-mono">
                  = {(screwFeederDesign.totalTheoreticalPowerKW * 1000).toFixed(1)} Watts
                </span>
                <p className="text-[10px] text-amber-700 mt-1">
                  Ptotal = [(Pf + Pm) &times; Fo] / E &bull; Fo = 3.0, E = 0.88
                </p>
              </div>
            </div>

            {/* CRITICAL MOTOR SELECTION NOTICE (Section 11 requirement) */}
            <div className="rounded-xl bg-amber-500/10 border-2 border-amber-500/40 p-4 sm:p-5 flex items-start gap-3.5">
              <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-1.5 text-xs text-amber-900">
                <h4 className="text-sm font-bold text-amber-950 uppercase tracking-tight">
                  Critical Engineering Notice: Theoretical Power vs. Practical Motor Selection
                </h4>
                <p className="leading-relaxed">
                  While the calculated theoretical power for conveying cassava cake along the 1-meter trough is only <strong>{screwFeederDesign.totalTheoreticalPowerHP.toFixed(3)} HP (~25 Watts)</strong>, <strong>DO NOT install a 25-Watt motor!</strong>
                </p>
                <p className="leading-relaxed font-medium">
                  In commercial flash dryer operation, dewatered cassava cake easily consolidates, cakes, and packs against the trough wall during plant shutdowns. A tiny motor will immediately stall due to high breakaway static friction.
                </p>
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-amber-200/80">
                  <div>
                    <span className="font-bold text-amber-950 block">Recommended Commercial Geared Motor:</span>
                    <span className="text-xs text-amber-800">
                      Standard industrial TEFC geared motor fitted with Variable Frequency Drive (VFD, 15–60 RPM)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0.25}
                      max={7.5}
                      step={0.1}
                      value={inputs.practicalMotorPowerKW ?? 0.75}
                      onChange={(e) => onUpdateInputs({ practicalMotorPowerKW: parseFloat(e.target.value) || 0.75 })}
                      className="w-24 px-2 py-1 border border-amber-300 bg-white rounded font-mono font-bold text-xs"
                    />
                    <span className="font-bold text-amber-950 font-mono text-sm">kW</span>
                    <span className="text-xs text-amber-800 font-bold">
                      ({((inputs.practicalMotorPowerKW ?? 0.75) * 1.341).toFixed(1)} HP)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: COMPLETE DERIVATION SEQUENCES (Section 13 requirement) */}
      {activeSubTab === 'derivations' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900">
              Audit-Trail Calculation Sequence: Hopper &amp; Screw Feeder
            </h3>
            <p className="text-xs text-slate-500">
              Every step shows Formula &bull; Substitution &bull; Result &bull; Unit &bull; Academic Reference Citation
            </p>
          </div>

          {/* Hopper Design Steps 1-11 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                Hopper Engineering Calculations (Steps 1–11)
              </h4>
            </div>

            <div className="space-y-2.5">
              {results.steps
                .filter((s) => s.category === 'Hopper Design')
                .map((step, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-900 text-sm">
                        {step.parameterName} ({step.symbol})
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono font-bold">
                        {step.formattedResult}
                      </span>
                    </div>

                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {step.simpleExplanation}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">Formula:</span>
                        <span className="font-bold text-slate-800">{step.equation}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">Substitution:</span>
                        <span className="text-emerald-800 font-semibold">{step.substitution}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Source: {step.sourceCitation}</span>
                      <span className="italic">{step.notes}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Screw Feeder Steps 1-17 */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <div className="flex items-center gap-2 px-1">
              <Zap className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                Screw Feeder Engineering Calculations (Steps 1–17)
              </h4>
            </div>

            <div className="space-y-2.5">
              {results.steps
                .filter((s) => s.category === 'Screw Feeder Design')
                .map((step, idx) => (
                  <div
                    key={idx}
                    className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-2 text-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1.5 border-b border-slate-100">
                      <span className="font-bold text-slate-900 text-sm">
                        {step.parameterName} ({step.symbol})
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded bg-sky-50 text-sky-800 font-mono font-bold">
                        {step.formattedResult}
                      </span>
                    </div>

                    <p className="text-slate-600 text-[11px] leading-relaxed">
                      {step.simpleExplanation}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-mono text-[11px]">
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">Formula:</span>
                        <span className="font-bold text-slate-800">{step.equation}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[10px] uppercase font-sans">Substitution:</span>
                        <span className="text-emerald-800 font-semibold">{step.substitution}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                      <span>Source: {step.sourceCitation}</span>
                      <span className="italic">{step.notes}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: WORKSHOP DIMENSION SCHEDULE (Section 14 requirement) */}
      {activeSubTab === 'schedule' && (
        <div className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Fabrication Cut-List &amp; Mechanical Dimension Schedule
              </h3>
              <p className="text-xs text-slate-500">
                Detailed schedule for manufacturing the hopper sheet metal and screw auger assembly
              </p>
            </div>
            <button
              type="button"
              onClick={copyScheduleText}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors self-start sm:self-center"
            >
              {copiedSchedule ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSchedule ? 'Copied Full Cut-List!' : 'Copy Schedule to Clipboard'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Hopper Schedule Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-slate-800">
                  Hopper Fabrication Schedule
                </span>
                <span className="text-[11px] font-semibold text-slate-500">SS 304 2.0 mm Plate</span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Top Rim Opening (W1 &times; L1)</span>
                  <span className="font-bold font-mono text-slate-900">
                    {(hopperDesign.topWidthM * 1000).toFixed(0)} &times; {(hopperDesign.topLengthM * 1000).toFixed(0)} mm
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Discharge Throat Opening (W2 &times; L2)</span>
                  <span className="font-bold font-mono text-slate-900">
                    {(hopperDesign.outletWidthM * 1000).toFixed(0)} &times; {(hopperDesign.outletLengthM * 1000).toFixed(0)} mm
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Upper Collar Vertical Height (h1)</span>
                  <span className="font-bold font-mono text-slate-900">
                    {(hopperDesign.upperVerticalHeightM * 1000).toFixed(0)} mm
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Lower Pyramidal Frustum Height (h2)</span>
                  <span className="font-bold font-mono text-slate-900">
                    {(hopperDesign.lowerTaperedHeightM * 1000).toFixed(0)} mm
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between bg-slate-50">
                  <span className="font-semibold text-slate-700">Total Overall Hopper Height (H)</span>
                  <span className="font-extrabold font-mono text-emerald-800">
                    {(hopperDesign.overallHeightM * 1000).toFixed(0)} mm
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Side Wall Angle (A) / End Wall (B)</span>
                  <span className="font-mono text-slate-900">
                    {hopperDesign.wallSlopeAngleADeg}&deg; / {hopperDesign.wallSlopeAngleBDeg}&deg;
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between bg-emerald-50/50">
                  <span className="font-semibold text-emerald-950">Corner Valley Angle (C)</span>
                  <span className="font-extrabold font-mono text-emerald-800">
                    {hopperDesign.valleyAngleDeg}&deg; (Gravity Mass Flow)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Constructed Volume (Gross)</span>
                  <span className="font-mono text-slate-900">
                    {(hopperDesign.totalGeometricVolumeM3 * 1000).toFixed(1)} L ({hopperDesign.totalGeometricVolumeM3.toFixed(4)} m³)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Design Required Volume (Hc)</span>
                  <span className="font-mono text-slate-900">
                    {(hopperDesign.totalRequiredVolumeM3 * 1000).toFixed(1)} L ({hopperDesign.totalRequiredVolumeM3.toFixed(4)} m³)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Holding Mass at 10 min</span>
                  <span className="font-bold font-mono text-slate-900">
                    {hopperDesign.massHeldKg.toFixed(1)} kg cassava cake
                  </span>
                </div>
              </div>
            </div>

            {/* Screw Feeder Schedule Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="font-bold text-xs uppercase text-slate-800">
                  Screw Feeder Fabrication Schedule
                </span>
                <span className="text-[11px] font-semibold text-slate-500">SS 304 Auger &bull; CEMA Class 30</span>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Nominal Screw Diameter (D)</span>
                  <span className="font-bold font-mono text-slate-900">
                    {screwFeederDesign.screwDiameterMm} mm ({screwFeederDesign.screwDiameterInches.toFixed(0)} inches)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Conveyor Trough Length (L)</span>
                  <span className="font-bold font-mono text-slate-900">
                    {screwFeederDesign.screwLengthMm} mm ({screwFeederDesign.screwLengthFt.toFixed(2)} ft)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Screw Flight Pitch (p)</span>
                  <span className="font-mono text-slate-900">
                    {screwFeederDesign.screwPitchMm} mm (Standard Full Pitch)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Center Drive Shaft Diameter</span>
                  <span className="font-mono text-slate-900">
                    &Oslash;{screwFeederDesign.shaftDiameterMm} mm (~1.5" sch 40 pipe)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Flight Thickness / Number of Turns</span>
                  <span className="font-mono text-slate-900">
                    {screwFeederDesign.flightThicknessMm} mm plate / {screwFeederDesign.numberOfFlights} turns
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Operating Rotational Speed</span>
                  <span className="font-bold font-mono text-emerald-700">
                    {screwFeederDesign.selectedRpm} RPM (Req: {screwFeederDesign.theoreticalRpm.toFixed(1)} RPM)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Actual Delivery Capacity</span>
                  <span className="font-mono text-slate-900">
                    {screwFeederDesign.actualCapacityKgH.toFixed(1)} kg/h ({screwFeederDesign.actualCapacityFt3H.toFixed(2)} ft³/h)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between bg-slate-50">
                  <span className="text-slate-600">Theoretical Drive Power</span>
                  <span className="font-mono text-slate-700">
                    {screwFeederDesign.totalTheoreticalPowerHP.toFixed(4)} HP ({(screwFeederDesign.totalTheoreticalPowerKW * 1000).toFixed(0)} W)
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between bg-amber-50/70">
                  <span className="font-bold text-amber-950">Recommended Geared Motor</span>
                  <span className="font-extrabold font-mono text-amber-800">
                    {screwFeederDesign.recommendedMotorPowerKW.toFixed(2)} kW ({screwFeederDesign.recommendedMotorPowerHP.toFixed(1)} HP) + VFD
                  </span>
                </div>
                <div className="px-4 py-2 flex justify-between">
                  <span className="text-slate-600">Gearbox Speed Reduction</span>
                  <span className="font-mono text-slate-900">
                    1400 RPM &rarr; 55 RPM (~25:1 Ratio Helical/Worm)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
