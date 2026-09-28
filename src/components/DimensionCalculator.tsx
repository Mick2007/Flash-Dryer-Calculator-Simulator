import React, { useState } from 'react';
import {
  Ruler,
  AlertCircle,
  CheckCircle2,
  Layers,
  Wind,
  Flame,
  Wrench,
  Download,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Calculator,
  Info
} from 'lucide-react';
import { CalculationResults } from '../types/dryer';
import { STAIRMAND_RATIOS, LAPPLE_RATIOS } from '../utils/constants';

interface DimensionCalculatorProps {
  results: CalculationResults;
  onExportPdf: () => void;
  onOpenDevelopedLength?: () => void;
  onOpenHopperScrew?: () => void;
}

export const DimensionCalculator: React.FC<DimensionCalculatorProps> = ({ results, onExportPdf, onOpenDevelopedLength, onOpenHopperScrew }) => {
  const [copied, setCopied] = useState(false);
  const [showCycloneDerivations, setShowCycloneDerivations] = useState(true);
  const { dimensions, materialBalance, energyBalance, fluidDynamics, inputs } = results;

  const copyToClipboard = () => {
    const text = `
FLASH DRYER PRELIMINARY MECHANICAL DIMENSIONS
Capacity: ${materialBalance.productRateKgH.toFixed(1)} kg/h Dry Flour (Feed: ${materialBalance.feedRateKgH.toFixed(1)} kg/h)
Drying Tube: Ø${dimensions.tubeDiameterStandardMm} mm (Calc: ${dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm)
Vertical Column Height: ${dimensions.verticalColumnHeightM.toFixed(1)} m
Total Developed Length: ${dimensions.totalPipeLengthM.toFixed(1)} m
Air Velocity: ${dimensions.actualAirVelocityMperS.toFixed(1)} m/s
Venturi Throat: Ø${dimensions.venturiThroatDiameterMm} mm @ ${dimensions.venturiThroatVelocityMperS.toFixed(1)} m/s
Cyclone Type: ${dimensions.cycloneType.toUpperCase()}
Cyclone Diameter (Dc): ${dimensions.cycloneDiameterMm} mm
Cyclone Total Height: ${dimensions.cycloneTotalHeightMm} mm
Vortex Finder: Ø${dimensions.cycloneVortexFinderDiameterMm} mm
Cyclone Inlet: ${dimensions.cycloneInletHeightMm} x ${dimensions.cycloneInletWidthMm} mm
Screw Feeder: Ø${dimensions.screwDiameterMm} mm, Pitch: ${dimensions.screwPitchMm} mm, Speed: ${dimensions.screwSpeedRpm} RPM
Air Heater Thermal Duty: ${energyBalance.totalHeatDutyKW.toFixed(1)} kW (${energyBalance.totalHeatDutyKcalH.toFixed(0)} kcal/h)
Blower Fan: ${dimensions.fanMotorPowerKW.toFixed(1)} kW @ ${dimensions.fanTotalPressureDropPa} Pa (${fluidDynamics.inletVolumetricFlowM3H.toFixed(0)} m³/h)
Overall Frame: ${dimensions.frameFootprintLengthM.toFixed(1)}m L x ${dimensions.frameFootprintWidthM.toFixed(1)}m W x ${dimensions.frameOverallHeightM.toFixed(1)}m H
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Prominent Preliminary Engineering Design Disclaimer Notice */}
      <div className="rounded-xl bg-amber-500/10 border-2 border-amber-500/40 p-4 sm:p-5 flex items-start gap-3.5">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-amber-950 uppercase tracking-tight">
            Preliminary Engineering Design Notice
          </h4>
          <p className="text-xs sm:text-sm text-amber-900 leading-relaxed font-medium">
            All dimensions and equipment ratings calculated below represent preliminary mechanical design specifications derived from peer-reviewed empirical correlations (CIRAD &amp; IITA).
            They are subject to detailed workshop design, fabrication constraints, local materials availability, structural load calculations, and experimental testing validation before actual manufacturing.
          </p>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-2">
          <Ruler className="w-5 h-5 text-emerald-600" />
          <span className="text-sm font-bold text-slate-800">
            Comprehensive Equipment Sizing Schedule
          </span>
          <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
            {materialBalance.productRateKgH.toFixed(0)} kg/h Dry Product
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={copyToClipboard}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied Specs!' : 'Copy Summary'}</span>
          </button>
          <button
            type="button"
            onClick={onExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-xs font-semibold text-white shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Engineering Dossier</span>
          </button>
        </div>
      </div>

      {/* Component Specification Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* SECTION 1: FLASH DRYING TUBE & PNEUMATIC CONVEYING */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                1. Flash Drying Pipe &amp; Disperser Sizing
              </h4>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">SS 304 Food Contact</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="px-4 py-2.5 flex items-center justify-between bg-emerald-50/40">
              <div>
                <span className="font-bold text-emerald-950 block">Nominal pipe diameter: Ø{dimensions.tubeDiameterStandardMm} mm</span>
                <span className="text-[11px] text-emerald-700">Selected standard fabrication catalogue size</span>
              </div>
              <span className="font-extrabold text-emerald-700 text-sm">
                Ø{dimensions.tubeDiameterStandardMm} mm ({dimensions.standardPipeNominal || `${Math.round(dimensions.tubeDiameterStandardMm / 25.4)}" ANSI`})
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-700 block">Calculated required diameter: Ø{dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm</span>
                <span className="text-[11px] text-slate-500">Theoretical diameter from airflow and target velocity</span>
              </div>
              <span className="font-bold text-slate-900">Ø{dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm</span>
            </div>
            <div className="px-4 py-2.5 bg-slate-50 text-[11px] text-slate-600 leading-normal border-t border-b border-slate-200">
              <p>
                <strong>Fabrication Note:</strong> Nominal size is a selected standard fabrication value; final pressure-drop, velocity, and mechanical verification are required before manufacture.
              </p>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Recommended Pipe Wall Thickness</span>
              <span className="font-semibold text-slate-800">2.0 mm (Schedule 10 / Sanitary Tubing)</span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Vertical Column Riser Height (H_col)</span>
              <span className="font-bold text-slate-900">{dimensions.verticalColumnHeightM.toFixed(1)} m</span>
            </div>
            <div className="px-4 py-3 bg-emerald-50/50 border-t border-b border-emerald-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="font-bold text-emerald-950 block">
                  Total Developed Pipe Length: {dimensions.totalPipeLengthM.toFixed(1)} m
                </span>
                <span className="text-[11px] text-emerald-700">
                  {dimensions.totalPipeLengthM >= 20.0
                    ? 'Fulfills CIRAD L ≥ 20.0 m standard for high thermal efficiency'
                    : 'Below recommended CIRAD 20.0 m minimum guideline'}
                </span>
              </div>
              {onOpenDevelopedLength && (
                <button
                  type="button"
                  onClick={onOpenDevelopedLength}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                >
                  <Ruler className="w-3.5 h-3.5" />
                  <span>Determine &amp; Customize Developed Length</span>
                </button>
              )}
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Venturi Throat Diameter (D_v)</span>
              <span className="font-bold text-slate-900">{dimensions.venturiThroatDiameterMm} mm</span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Venturi Throat Acceleration Velocity</span>
              <span className="font-bold text-emerald-700">
                {dimensions.venturiThroatVelocityMperS.toFixed(1)} m/s
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Operating Air Transport Velocity</span>
              <span className="font-bold text-slate-900">
                {dimensions.actualAirVelocityMperS.toFixed(1)} m/s (Design: {inputs.airVelocity.toFixed(1)} m/s)
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Calculated Particle Contact Time</span>
              <span className="font-bold text-slate-900">{dimensions.estimatedResidenceTimeSec.toFixed(2)} seconds</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: CYCLONE SEPARATOR SCHEDULE */}
        {(() => {
          const isStairmand = dimensions.cycloneType === 'stairmand';
          const ratios = isStairmand ? STAIRMAND_RATIOS : LAPPLE_RATIOS;
          const Dc = dimensions.cycloneDiameterMm;

          return (
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Wind className="w-4 h-4 text-sky-600" />
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                    2. Cyclone Separator Geometry ({dimensions.cycloneType.toUpperCase()})
                  </h4>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCycloneDerivations(!showCycloneDerivations)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-sky-100 hover:bg-sky-200 text-sky-800 text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <Calculator className="w-3 h-3" />
                    <span>{showCycloneDerivations ? 'Hide Derivations' : 'Show Derivations from Dc'}</span>
                    {showCycloneDerivations ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <span className="text-[11px] font-semibold text-slate-500">SS 304 Sheet Metal</span>
                </div>
              </div>

              {/* Governing Proportionality Formula Banner */}
              <div className="px-4 py-2.5 bg-sky-50/70 border-b border-sky-100 text-xs text-sky-950 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-semibold text-sky-900">
                    <strong>Standard Proportionality Design Basis:</strong> All 8 mechanical cyclone dimensions are geometrically derived as direct linear ratios of the cyclone barrel diameter (D_c), which itself is sized from continuity at 15 m/s inlet velocity.
                  </p>
                  <p className="text-[11px] text-sky-700 font-mono">
                    D_c = sqrt[ Q_v,out / (C_area × v_ci) ] = sqrt[ {fluidDynamics.outletVolumetricFlowM3S.toFixed(3)} m³/s / ({ratios.inletAreaFactor} × 15.0 m/s) ] = {Dc} mm
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                {/* 1. Barrel Diameter */}
                <div className="px-4 py-2.5 bg-sky-50/30">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-sky-900 block">Cyclone Body Diameter (Dc)</span>
                      <span className="text-[11px] text-slate-500">Primary reference dimension for all cyclone ratios</span>
                    </div>
                    <span className="font-extrabold text-sky-700 text-sm">Ø{Dc} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-sky-50 border border-sky-200/70 text-[11px] space-y-1 font-mono text-sky-950">
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-sans">Formula:</span>
                        <span className="font-bold">D_c = sqrt[ Q_v,out / (C_area × v_ci) ]</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 font-sans">Substitution:</span>
                        <span>sqrt[ {fluidDynamics.outletVolumetricFlowM3S.toFixed(3)} / ({ratios.inletAreaFactor} × 15.0) ] = {(Dc / 1000).toFixed(3)} m → {Dc} mm</span>
                      </div>
                      <div className="text-[10px] text-sky-800 font-sans leading-tight pt-0.5 border-t border-sky-200/50">
                        • Sized by continuity to guarantee tangential entrance gas velocity v_ci = 15.0 m/s.
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Inlet Height a */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Inlet Rectangular Height (a)</span>
                      <span className="text-[11px] text-slate-500">Vertical height of tangential entry nozzle</span>
                    </div>
                    <span className="font-bold text-slate-900">{dimensions.cycloneInletHeightMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">a = {ratios.inletHeight_a.toFixed(2)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{ratios.inletHeight_a.toFixed(2)} × {Dc} mm = {dimensions.cycloneInletHeightMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Confines tangential gas entry to upper barrel headwall without vortex disruption.
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. Inlet Width b */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Inlet Rectangular Width (b)</span>
                      <span className="text-[11px] text-slate-500">Radial width of tangential entry nozzle</span>
                    </div>
                    <span className="font-bold text-slate-900">{dimensions.cycloneInletWidthMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">b = {ratios.inletWidth_b.toFixed(2)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{ratios.inletWidth_b.toFixed(2)} × {Dc} mm = {dimensions.cycloneInletWidthMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Sized narrow to minimize radial particle migration distance to the wall, shrinking cut-point d50.
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. Vortex Finder Diameter De */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Vortex Finder Diameter (De)</span>
                      <span className="text-[11px] text-slate-500">Central clean air exhaust duct diameter</span>
                    </div>
                    <span className="font-bold text-slate-900">Ø{dimensions.cycloneVortexFinderDiameterMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">D_e = {ratios.vortexFinderDiameter_De.toFixed(2)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{ratios.vortexFinderDiameter_De.toFixed(2)} × {Dc} mm = {dimensions.cycloneVortexFinderDiameterMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Matches natural core diameter of inner upward Rankine vortex, minimizing static pressure loss.
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. Vortex Finder Depth S */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Vortex Finder Insertion Depth (S)</span>
                      <span className="text-[11px] text-slate-500">Extension length below cyclone top roof</span>
                    </div>
                    <span className="font-semibold text-slate-800">{dimensions.cycloneVortexFinderLengthMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">S = {ratios.vortexFinderLength_S.toFixed(3)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{ratios.vortexFinderLength_S.toFixed(3)} × {Dc} mm = {dimensions.cycloneVortexFinderLengthMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Extends strictly below inlet bottom lip (S = {dimensions.cycloneVortexFinderLengthMm} mm ≥ a = {dimensions.cycloneInletHeightMm} mm) to prevent raw feed short-circuiting.
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Cylinder Height h */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Cylindrical Barrel Height (h)</span>
                      <span className="text-[11px] text-slate-500">Upper constant-diameter body section</span>
                    </div>
                    <span className="font-semibold text-slate-800">{dimensions.cycloneCylinderHeightMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">h = {ratios.cylinderHeight_h.toFixed(2)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{ratios.cylinderHeight_h.toFixed(2)} × {Dc} mm = {dimensions.cycloneCylinderHeightMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Provides sufficient vertical length to establish 4–5 stable outer downward helical spiral revolutions.
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. Conical Height z */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Conical Section Height (z = H - h)</span>
                      <span className="text-[11px] text-slate-500">Inverted cone tapering down to dust nozzle</span>
                    </div>
                    <span className="font-semibold text-slate-800">{dimensions.cycloneConeHeightMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">z = {ratios.coneHeight.toFixed(2)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{ratios.coneHeight.toFixed(2)} × {Dc} mm = {dimensions.cycloneConeHeightMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Tapers radius to accelerate swirl velocity (angular momentum conservation), concentrating centrifugal force. Steep wall (~75°) prevents cassava cake hangup.
                      </div>
                    </div>
                  )}
                </div>

                {/* 8. Total Height H */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Cyclone Total Overall Height (H)</span>
                      <span className="text-[11px] text-slate-500">Combined height from top cover to dust flange</span>
                    </div>
                    <span className="font-bold text-slate-900">{dimensions.cycloneTotalHeightMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">H = h + z = {ratios.totalHeight_H.toFixed(2)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{dimensions.cycloneCylinderHeightMm} + {dimensions.cycloneConeHeightMm} = {ratios.totalHeight_H.toFixed(2)} × {Dc} mm = {dimensions.cycloneTotalHeightMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Structural envelope required for vertical tower mounting.
                      </div>
                    </div>
                  )}
                </div>

                {/* 9. Dust Outlet B */}
                <div className="px-4 py-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-800 block">Dust Bottom Outlet Nozzle (B)</span>
                      <span className="text-[11px] text-slate-500">Mating flange to rotary airlock valve</span>
                    </div>
                    <span className="font-semibold text-slate-800">Ø{dimensions.cycloneDustOutletDiameterMm} mm</span>
                  </div>
                  {showCycloneDerivations && (
                    <div className="mt-1.5 p-2 rounded bg-slate-50 border border-slate-200 text-[11px] space-y-0.5 font-mono text-slate-800">
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Derivation:</span>
                        <span className="font-bold">B = {ratios.dustOutletDiameter_B.toFixed(3)} × D_c</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 font-sans">Substitution:</span>
                        <span>{ratios.dustOutletDiameter_B.toFixed(3)} × {Dc} mm = {dimensions.cycloneDustOutletDiameterMm} mm</span>
                      </div>
                      <div className="text-[10px] text-slate-600 font-sans pt-0.5">
                        • Prevents bridge formation and interfaces flush to rotary airlock valve top intake.
                      </div>
                    </div>
                  )}
                </div>

                {/* Performance checks */}
                <div className="px-4 py-2.5 flex items-center justify-between bg-slate-50/50">
                  <span className="text-slate-600">Inlet Gas Velocity &amp; Static Pressure Drop</span>
                  <span className="font-bold text-slate-900">
                    {dimensions.cycloneInletVelocityMperS.toFixed(1)} m/s (ΔP: {dimensions.cyclonePressureDropPa.toFixed(0)} Pa)
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* SECTION 3: RECEPTION HOPPER & SCREW FEEDER (IITA/RMRDC STANDARD) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                3. Reception Hopper &amp; Screw Feeder Sizing (IITA Standard)
              </h4>
            </div>
            {onOpenHopperScrew && (
              <button
                type="button"
                onClick={onOpenHopperScrew}
                className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100 transition-colors"
              >
                Engineering Suite &rarr;
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            {/* Hopper Sizing */}
            <div className="px-4 py-2.5 bg-slate-50/60 font-bold text-slate-800 flex items-center justify-between">
              <span>A. Reception Buffer Hopper (10-min buffer)</span>
              <span className="text-[11px] text-emerald-700 font-mono">
                {(results.hopperDesign.totalGeometricVolumeM3 * 1000).toFixed(1)} L ({results.hopperDesign.totalGeometricVolumeM3.toFixed(4)} m³)
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Top Rim Opening (W1 &times; L1)</span>
              <span className="font-bold text-slate-900 font-mono">
                {(results.hopperDesign.topWidthM * 1000).toFixed(0)} &times; {(results.hopperDesign.topLengthM * 1000).toFixed(0)} mm
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Discharge Throat Opening (W2 &times; L2)</span>
              <span className="font-bold text-slate-900 font-mono">
                {(results.hopperDesign.outletWidthM * 1000).toFixed(0)} &times; {(results.hopperDesign.outletLengthM * 1000).toFixed(0)} mm
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Upper Collar (h1) / Tapered Frustum (h2)</span>
              <span className="font-bold text-slate-900 font-mono">
                {(results.hopperDesign.upperVerticalHeightM * 1000).toFixed(0)} mm / {(results.hopperDesign.lowerTaperedHeightM * 1000).toFixed(0)} mm (H: {(results.hopperDesign.overallHeightM * 1000).toFixed(0)} mm)
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Side Wall Angle (A) / Corner Valley (C)</span>
              <span className="font-bold text-emerald-800 font-mono">
                {results.hopperDesign.wallSlopeAngleADeg}&deg; / {results.hopperDesign.valleyAngleDeg}&deg; (Gravity Mass Flow)
              </span>
            </div>

            {/* Screw Feeder Sizing */}
            <div className="px-4 py-2.5 bg-slate-50/60 font-bold text-slate-800 flex items-center justify-between border-t border-slate-200">
              <span>B. Metering Screw Feeder &amp; Drive</span>
              <span className="text-[11px] text-sky-700 font-mono">
                &Oslash;{results.screwFeederDesign.screwDiameterMm} mm ({results.screwFeederDesign.screwDiameterInches.toFixed(0)}")
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Screw Conveyor Length &amp; Pitch</span>
              <span className="font-bold text-slate-900 font-mono">
                {results.screwFeederDesign.screwLengthMm} mm length &bull; {results.screwFeederDesign.screwPitchMm} mm pitch (Full)
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Operating Speed (N_selected vs N_req)</span>
              <span className="font-bold text-emerald-700 font-mono">
                {results.screwFeederDesign.selectedRpm} RPM (Req: {results.screwFeederDesign.theoreticalRpm.toFixed(1)} RPM, Margin: +{results.screwFeederDesign.capacityMarginPercent.toFixed(1)}%)
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Actual Conveying Capacity</span>
              <span className="font-bold text-slate-900 font-mono">
                {results.screwFeederDesign.actualCapacityKgH.toFixed(1)} kg/h ({results.screwFeederDesign.actualCapacityFt3H.toFixed(2)} ft³/h)
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Theoretical Power vs Installed Motor</span>
              <span className="font-bold text-amber-800 font-mono">
                Theo: {results.screwFeederDesign.totalTheoreticalPowerHP.toFixed(3)} HP &rarr; Motor: {results.screwFeederDesign.recommendedMotorPowerKW.toFixed(2)} kW ({results.screwFeederDesign.recommendedMotorPowerHP.toFixed(1)} HP) + VFD
              </span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Lump Disintegrator Pin Rotor</span>
              <span className="font-semibold text-slate-800">Fitted at screw discharge (1400 RPM)</span>
            </div>
            <div className="px-4 py-2 flex items-center justify-between">
              <span className="text-slate-600">Dry Flour Rotary Airlock Valve</span>
              <span className="font-bold text-slate-900">150 mm (6-inch) Sanitary 8-Vane (0.37 kW @ 20 RPM)</span>
            </div>
          </div>
        </div>

        {/* SECTION 4: THERMAL, BLOWER & STRUCTURAL UTILITIES */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-600" />
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
                4. Air Heater, Fan &amp; Frame Layout
              </h4>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">Utilities Schedule</span>
          </div>

          <div className="divide-y divide-slate-100 text-xs">
            <div className="px-4 py-2.5 flex items-center justify-between bg-rose-50/40">
              <span className="font-semibold text-rose-900">Air Heater Thermal Duty</span>
              <span className="font-extrabold text-rose-700">
                {energyBalance.totalHeatDutyKW.toFixed(1)} kW ({energyBalance.totalHeatDutyKcalH.toFixed(0)} kcal/h)
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Estimated Diesel Fuel Consumption</span>
              <span className="font-bold text-slate-900">
                {(energyBalance.totalHeatDutyKW / 9.8).toFixed(1)} L/h (at 85% combustion eff.)
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Estimated Biomass Wood Chip Fuel</span>
              <span className="font-bold text-slate-900">
                {(energyBalance.totalHeatDutyKW * 3600 / (15000 * 0.70)).toFixed(1)} kg/h
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Centrifugal Blower Fan Motor</span>
              <span className="font-bold text-emerald-700">{dimensions.fanMotorPowerKW.toFixed(1)} kW</span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Fan Volumetric Flow &amp; Pressure</span>
              <span className="font-semibold text-slate-800">
                {fluidDynamics.inletVolumetricFlowM3H.toFixed(0)} m³/h @ {dimensions.fanTotalPressureDropPa} Pa
              </span>
            </div>
            <div className="px-4 py-2.5 bg-amber-50/70 border-t border-b border-amber-200/80 text-[11px] text-amber-900 leading-normal">
              <strong>Fan/Blower Duty Disclosure:</strong> Pressure-mode selection changes the pressure boundary condition and dust-leakage assessment. The present preliminary model retains the same airflow and preliminary fan-duty basis for all draft configurations. Final fan selection requires a complete pressure-drop calculation.
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Structural Frame Floor Footprint</span>
              <span className="font-bold text-slate-900">
                {dimensions.frameFootprintLengthM.toFixed(1)} m (L) × {dimensions.frameFootprintWidthM.toFixed(1)} m (W)
              </span>
            </div>
            <div className="px-4 py-2.5 flex items-center justify-between">
              <span className="text-slate-600">Overall Plant Height Clearance</span>
              <span className="font-bold text-slate-900">{dimensions.frameOverallHeightM.toFixed(1)} m</span>
            </div>
          </div>
        </div>

        {/* SECTION 5: MULTI-PASS AIR HEAT EXCHANGER (CIRAD MODULE 4) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden lg:col-span-2">
          <div className="px-4 py-3 bg-amber-500/10 border-b border-amber-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-amber-600" />
              <h4 className="text-xs font-bold text-amber-950 uppercase tracking-tight">
                5. Multi-Pass Air Heat Exchanger Sizing (CIRAD Design Suite Module 4)
              </h4>
            </div>
            <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300/60 self-start sm:self-auto">
              {results.heatExchanger.numberOfPasses} Specified Passes • {results.heatExchanger.type === 'cross_flow_finned' ? 'Finned Bundle' : 'Bare Tubes'}
            </span>
          </div>

          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[11px] block">Required Heat Transfer Area</span>
              <span className="text-base font-black text-slate-900">{results.heatExchanger.surfaceAreaM2.toFixed(1)} m²</span>
              <p className="text-[10px] text-slate-500">Based on U = {results.heatExchanger.overallUCoeffWperM2K} W/(m²·K)</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[11px] block">Tube Bundle Architecture</span>
              <span className="text-base font-black text-slate-900">{results.heatExchanger.totalTubesCount} Tubes</span>
              <p className="text-[10px] text-slate-500">{results.heatExchanger.tubesPerPass} tubes/pass × {results.heatExchanger.numberOfPasses} passes</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[11px] block">Effective LMTD (ΔT_lm)</span>
              <span className="text-base font-black text-amber-700">{results.heatExchanger.effectiveLmtdC.toFixed(1)} °C</span>
              <p className="text-[10px] text-slate-500">Pure LMTD: {results.heatExchanger.lmtdC.toFixed(1)}°C • Ft: {results.heatExchanger.correctionFactorFt}</p>
            </div>

            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1">
              <span className="text-slate-500 text-[11px] block">Air-Side Pressure Drop (ΔP_hex)</span>
              <span className="text-base font-black text-emerald-700">{results.heatExchanger.airSidePressureDropPa} Pa</span>
              <p className="text-[10px] text-slate-500">Included in fan static head ({dimensions.fanTotalPressureDropPa} Pa)</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
