import React, { useState, useMemo } from 'react';
import {
  Ruler,
  CheckCircle2,
  AlertTriangle,
  Sliders,
  Layers,
  ArrowRight,
  Maximize2,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  Info,
  Wrench,
  ShieldCheck,
  TrendingUp,
  Download
} from 'lucide-react';
import { CalculationResults, DryerInputs } from '../types/dryer';
import { CIRAD_BENCHMARKS } from '../utils/constants';

interface DevelopedLengthCalculatorProps {
  results: CalculationResults;
  onUpdateInputs: (updatedInputs: Partial<DryerInputs>) => void;
  onNavigateTo3D?: () => void;
}

export const DevelopedLengthCalculator: React.FC<DevelopedLengthCalculatorProps> = ({
  results,
  onUpdateInputs,
  onNavigateTo3D
}) => {
  const { dimensions, fluidDynamics, inputs, developedLengthReport } = results;

  // Single source for the CIRAD length threshold used by every comparison in this
  // panel, so the status pill, the progress meter and the length solver cannot disagree.
  const CIRAD_MIN_LENGTH_M = CIRAD_BENCHMARKS.minDevelopedPipeLengthM;

  // Active determination method tab
  const [activeTab, setActiveTab] = useState<'kinetics' | 'geometry' | 'segments' | 'fabrication'>('kinetics');
  const [copied, setCopied] = useState(false);

  // Local state for interactive exploration
  const [targetTau, setTargetTau] = useState<number>(inputs.targetResidenceTime || 1.5);
  const [airVelocity, setAirVelocity] = useState<number>(inputs.airVelocity || 14.0);
  const [ceilingClearance, setCeilingClearance] = useState<number>(inputs.ceilingClearanceM || 8.0);
  const [routingLayout, setRoutingLayout] = useState<'single_loop' | 'double_loop' | 'straight_riser'>(
    inputs.tubeRoutingLayout || 'single_loop'
  );
  const [bendRadiusRatio, setBendRadiusRatio] = useState<number>(inputs.bendRadiusRatio || 2.0);
  const [tubeWallThicknessMm, setTubeWallThicknessMm] = useState<number>(inputs.tubeWallThicknessMm || 2.0);
  const [customLengthInput, setCustomLengthInput] = useState<number>(
    inputs.customTotalPipeLengthM || dimensions.totalPipeLengthM
  );

  // Particle slip velocity.
  // This previously used a hard-coded 2.0 m/s terminal velocity, roughly double the
  // value the calculation engine derives for cassava flour (about 1.09 m/s at the
  // default 230 µm / 1480 kg/m³), which made the "kinetics length" shown in this tab
  // disagree with the length reported everywhere else. Take it from the engine so
  // the panel and the report stay in step. The local airVelocity slider is still
  // honoured, so the effect of changing velocity remains explorable.
  const particleTerminalVelocity = fluidDynamics.particleTerminalVelocity;
  const verticalSlipVelocity = Math.max(1.0, airVelocity - particleTerminalVelocity);

  // Theoretical kinetics length
  const kineticsDevelopedLength = Math.max(
    CIRAD_BENCHMARKS.minDevelopedPipeLengthM,
    Math.round(targetTau * verticalSlipVelocity * 10) / 10
  );

  // Geometric layout derived length
  const D_m = dimensions.tubeDiameterStandardM;
  const R_bend = bendRadiusRatio * D_m;
  const elbowArcM = (Math.PI / 2) * R_bend;
  const ubendArcM = Math.PI * R_bend;
  const maxRiserByCeiling = Math.max(4.0, Math.min(ceilingClearance - 1.2, 12.0));
  const venturiM = Math.max(1.0, Math.round(D_m * 1.8 * 10) / 10);
  const transitionM = 0.8;

  const geometryDevelopedLength = useMemo(() => {
    if (routingLayout === 'single_loop') {
      const riser = maxRiserByCeiling;
      const downcomer = Math.max(1.5, riser - 2.5);
      const baseElbow = elbowArcM;
      const topUbend = ubendArcM;
      const fixed = venturiM + baseElbow + riser + topUbend + downcomer + transitionM;
      // Pad the fixed run out to the CIRAD minimum with an intermediate loop.
      const addLoop = Math.max(0, CIRAD_BENCHMARKS.minDevelopedPipeLengthM - fixed);
      return Math.round((fixed + addLoop) * 10) / 10;
    } else if (routingLayout === 'double_loop') {
      const riser = Math.min(maxRiserByCeiling, 6.0);
      const downcomer = Math.min(maxRiserByCeiling, 5.5);
      const fixed = venturiM + elbowArcM + riser + 2 * ubendArcM + downcomer + transitionM;
      // Same CIRAD minimum as the single loop. This previously targeted 22.0 m with
      // no stated basis, so the two layouts disagreed about the requirement.
      const addLoops = Math.max(0, CIRAD_BENCHMARKS.minDevelopedPipeLengthM - fixed);
      return Math.round((fixed + addLoops) * 10) / 10;
    } else {
      const riser = Math.max(5.0, maxRiserByCeiling);
      return Math.round((venturiM + 2 * elbowArcM + riser + transitionM) * 10) / 10;
    }
  }, [routingLayout, maxRiserByCeiling, elbowArcM, ubendArcM, venturiM, transitionM]);

  // Current active determined length depending on active tab or custom override
  const currentLength = inputs.customTotalPipeLengthM || dimensions.totalPipeLengthM;
  const currentReport = developedLengthReport;

  // Impact estimation helper
  const calcImpact = (testLengthM: number) => {
    const tau = Math.round((testLengthM / verticalSlipVelocity) * 100) / 100;
    // Friction factor f ~ 0.018 for smooth commercial SS tube
    const airDensity = results.psychrometrics.averageAirDensity || 0.88;
    const v = dimensions.actualAirVelocityMperS || airVelocity;
    const dynamicPressure = 0.5 * airDensity * v * v;
    const pipeFrictionDrop = 0.018 * (testLengthM / D_m) * dynamicPressure;
    // Bends loss
    const bendsK = routingLayout === 'double_loop' ? 2.5 : routingLayout === 'single_loop' ? 1.5 : 0.8;
    const bendsDrop = bendsK * dynamicPressure;
    const totalTubeDrop = Math.round(pipeFrictionDrop + bendsDrop);
    const addedFanKw = Math.round(((totalTubeDrop * fluidDynamics.averageVolumetricFlowM3S) / (1000 * 0.65)) * 10) / 10;
    return { tau, totalTubeDrop, addedFanKw };
  };

  const impact = calcImpact(currentLength);

  // Apply to System Handler
  const handleApplyLength = (lengthM: number, layout?: 'single_loop' | 'double_loop' | 'straight_riser') => {
    onUpdateInputs({
      customTotalPipeLengthM: lengthM,
      tubeRoutingLayout: layout || routingLayout,
      ceilingClearanceM: ceilingClearance,
      bendRadiusRatio,
      tubeWallThicknessMm,
      targetResidenceTime: targetTau,
      airVelocity,
    });
    setCustomLengthInput(lengthM);
  };

  const handleResetToCirad = () => {
    onUpdateInputs({
      customTotalPipeLengthM: undefined,
      tubeRoutingLayout: 'single_loop',
      ceilingClearanceM: 8.0,
      bendRadiusRatio: 2.0,
      tubeWallThicknessMm: 2.0,
      targetResidenceTime: 1.5,
      airVelocity: 14.0,
    });
    setTargetTau(1.5);
    setAirVelocity(14.0);
    setCeilingClearance(8.0);
    setRoutingLayout('single_loop');
    setBendRadiusRatio(2.0);
    setTubeWallThicknessMm(2.0);
  };

  // Copy fabrication cut list
  const copyCutList = () => {
    if (!currentReport) return;
    const lines = [
      `FLASH DRYER TUBE FABRICATION CUT SHEET & DEVELOPED LENGTH TAKEOFF`,
      `Nominal Diameter: Ø${dimensions.tubeDiameterStandardMm} mm (${dimensions.standardPipeNominal || 'Standard Pipe'})`,
      `Wall Thickness: ${currentReport.sheetMetal.wallThicknessMm} mm (SS304 Food Grade)`,
      `Developed Unfolded Blank Circumference: ${currentReport.sheetMetal.developedCircumferenceMm} mm`,
      `Total Centerline Developed Length: ${currentReport.totalDevelopedLengthM.toFixed(1)} m`,
      `Total Rolled Cylindrical Strakes (1.2m Cans): ${currentReport.sheetMetal.standardStrakesCount} cans`,
      `Total Seam Welds Length: ${currentReport.sheetMetal.totalWeldSeamLengthM.toFixed(1)} m`,
      `Total SS304 Sheet Metal Weight: ~${currentReport.sheetMetal.estimatedMassKg} kg`,
      `External Insulation / Lagging Area: ${currentReport.sheetMetal.insulationAreaM2.toFixed(1)} m²`,
      ``,
      `DETAILED SEGMENTS SCHEDULE:`,
      ...currentReport.segments.map(
        (s, idx) =>
          `${idx + 1}. [${s.type.toUpperCase()}] ${s.name}: ${s.totalLengthM.toFixed(2)} m (Qty: ${s.quantity}, Welds: ${s.weldsCount}) - ${s.description}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Feature Intro */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white rounded-2xl p-5 sm:p-6 shadow-md border border-slate-700/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <Ruler className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Flash Tube Developed Length &amp; Fabrication Determinator</span>
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    CIRAD L ≥ 20m Core Spec
                  </span>
                </h3>
                <p className="text-xs sm:text-sm text-slate-300">
                  Accurately size the unfolded centerline path (L_developed) from process drying kinetics (&tau; &times; u_s), workshop ceiling clearances, routing bends, and flat sheet-metal roll development.
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Badges */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 bg-slate-800/80 p-3 rounded-xl border border-slate-700/90 text-xs">
            <div className="px-3 border-r border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Current Length</span>
              <span className="text-base font-extrabold text-emerald-400">{currentLength.toFixed(1)} m</span>
            </div>
            <div className="px-3 border-r border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Contact Time (τ)</span>
              <span className="text-base font-bold text-white">{impact.tau.toFixed(2)} s</span>
            </div>
            <div className="px-3 border-r border-slate-700">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Standard Pipe</span>
              <span className="text-base font-bold text-sky-400">Ø{dimensions.tubeDiameterStandardMm} mm</span>
            </div>
            <div className="px-3">
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">CIRAD Status</span>
              <span
                className={`inline-flex items-center gap-1 font-bold text-xs ${
                  currentLength >= CIRAD_MIN_LENGTH_M ? 'text-emerald-400' : 'text-amber-400'
                }`}
              >
                {currentLength >= CIRAD_MIN_LENGTH_M ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Compliant (≥{CIRAD_MIN_LENGTH_M.toFixed(0)}m)
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5" /> Short (&lt;{CIRAD_MIN_LENGTH_M.toFixed(0)}m)
                  </>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* CIRAD Benchmark Compliance Progress Meter */}
        <div className="mt-5 pt-4 border-t border-slate-700/60">
          <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
            <span className="text-slate-300 flex items-center gap-1.5">
              <span>Developed Length Progress vs. CIRAD 20.0 m Threshold:</span>
              <strong className="text-white">{currentLength.toFixed(1)} m</strong>
            </span>
            <span className={currentLength >= CIRAD_MIN_LENGTH_M ? 'text-emerald-300 font-bold' : 'text-amber-300 font-bold'}>
              {currentLength >= CIRAD_MIN_LENGTH_M
                ? `+${(currentLength - CIRAD_MIN_LENGTH_M).toFixed(1)} m safety margin above minimum`
                : `${(CIRAD_MIN_LENGTH_M - currentLength).toFixed(1)} m below recommended minimum`}
            </span>
          </div>
          <div className="w-full h-3 bg-slate-700/80 rounded-full overflow-hidden relative">
            {/* CIRAD minimum marker line */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
              style={{ left: '66.6%' }}
              title={`CIRAD Minimum Standard: ${CIRAD_MIN_LENGTH_M.toFixed(1)} m`}
            />
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                currentLength >= CIRAD_MIN_LENGTH_M ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-amber-500'
              }`}
              style={{ width: `${Math.min(100, (currentLength / 30.0) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-slate-400 mt-1">
            <span>0 m</span>
            <span className="text-amber-400 font-bold">20.0 m (CIRAD Standard)</span>
            <span>30.0 m (Heavy Duty Starch Loop)</span>
          </div>
        </div>
      </div>

      {/* Determination Method Workspaces Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 bg-slate-50/70 p-2 gap-1 overflow-x-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('kinetics')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'kinetics'
                ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <span>Method 1: Process Kinetics &amp; Contact Time (τ × u_s)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('geometry')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'geometry'
                ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Maximize2 className="w-4 h-4 text-sky-600" />
            <span>Method 2: Workshop Clearance &amp; Routing Geometry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('segments')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'segments'
                ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Method 3: Segment-by-Segment Takeoff Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fabrication')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
              activeTab === 'fabrication'
                ? 'bg-white text-emerald-700 shadow-xs font-bold border border-slate-200/80'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Wrench className="w-4 h-4 text-amber-600" />
            <span>Fabrication &amp; Sheet Metal Development</span>
          </button>
        </div>

        {/* TAB 1: KINETICS METHOD */}
        {activeTab === 'kinetics' && (
          <div className="p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Controls */}
              <div className="lg:col-span-7 space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span>Drying Kinetics &amp; Slip Velocity Formulation</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Governed by the residence time required to vaporize internal bound and unbound moisture from wet cassava flour particles (d_p &asymp; 230 &mu;m) without thermal gelatinization (T_cassava &lt; 65&deg;C).
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                  {/* Target Residence Time */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-semibold text-slate-800">
                        Target Particle Contact Time (&tau;):
                      </label>
                      <span className="font-mono font-bold text-emerald-700 text-sm bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {targetTau.toFixed(2)} seconds
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="3.0"
                      step="0.05"
                      value={targetTau}
                      onChange={(e) => setTargetTau(parseFloat(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>1.0 s (Rapid/Surface)</span>
                      <span className="text-emerald-700 font-semibold">1.50 s (CIRAD Pilot Standard)</span>
                      <span>3.0 s (Heavy Core/Starch)</span>
                    </div>
                  </div>

                  {/* Air Transport Velocity */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-semibold text-slate-800">
                        Conveying Air Velocity (v_air):
                      </label>
                      <span className="font-mono font-bold text-slate-900 text-sm bg-white px-2 py-0.5 rounded border border-slate-200">
                        {airVelocity.toFixed(1)} m/s
                      </span>
                    </div>
                    <input
                      type="range"
                      min="11.0"
                      max="20.0"
                      step="0.5"
                      value={airVelocity}
                      onChange={(e) => setAirVelocity(parseFloat(e.target.value))}
                      className="w-full accent-emerald-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>11.0 m/s (Min saltation)</span>
                      <span>14.0 m/s (Recommended)</span>
                      <span>20.0 m/s (High dynamic head)</span>
                    </div>
                  </div>

                  {/* Particle Slip Velocity Breakdown */}
                  <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3 text-[11px]">
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-500 block">Particle Terminal Velocity (v_t):</span>
                      <span className="font-bold text-slate-900 text-xs">{particleTerminalVelocity.toFixed(1)} m/s</span>
                      <span className="text-[10px] text-slate-400 block">Cassava flour d_p = 230 &mu;m</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                      <span className="text-slate-500 block">Net Upward Slip Velocity (u_s):</span>
                      <span className="font-bold text-emerald-700 text-xs">
                        {verticalSlipVelocity.toFixed(2)} m/s (v_air - v_t)
                      </span>
                      <span className="text-[10px] text-slate-400 block">Vertical pneumatic drift speed</span>
                    </div>
                  </div>
                </div>

                {/* Calculation Formula Box */}
                <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-950">Governing Kinetics Formula:</span>
                    <span className="font-mono font-extrabold text-emerald-800 text-sm">
                      L = max(20.0, τ × u_s)
                    </span>
                  </div>
                  <p className="text-slate-700 text-[11px] leading-relaxed">
                    Theoretical contact length = <strong>{targetTau.toFixed(2)} s</strong> × <strong>{verticalSlipVelocity.toFixed(2)} m/s</strong> = <strong>{(targetTau * verticalSlipVelocity).toFixed(1)} m</strong>.
                    Because CIRAD pilot benchmarking demonstrates that lengths under 20 m suffer from thermal quench and unevaporated cassava clumps, the minimum threshold is enforced at <strong>20.0 m</strong>.
                  </p>
                  <div className="pt-2 flex items-center justify-between">
                    <span className="font-bold text-slate-800">Resulting Kinetics Developed Length:</span>
                    <span className="text-base font-extrabold text-emerald-800 font-mono">
                      {kineticsDevelopedLength.toFixed(1)} m
                    </span>
                  </div>
                </div>

                {/* Action button */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleApplyLength(kineticsDevelopedLength)}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Apply Kinetics Developed Length ({kineticsDevelopedLength.toFixed(1)} m) to Model</span>
                  </button>
                </div>
              </div>

              {/* Live Preview Card */}
              <div className="lg:col-span-5 bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-4">
                <h5 className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Real-Time Hydraulic &amp; Thermal Impact</span>
                </h5>

                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-700 block">Effective Particle Residence Time</span>
                      <span className="text-[10px] text-slate-400">Total transit from injection to cyclone</span>
                    </div>
                    <span className="font-mono font-bold text-emerald-700 text-sm">
                      {(kineticsDevelopedLength / verticalSlipVelocity).toFixed(2)} s
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-700 block">Flash Tube Air Friction Drop (ΔP_tube)</span>
                      <span className="text-[10px] text-slate-400">Straight pipe + elbow losses</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {calcImpact(kineticsDevelopedLength).totalTubeDrop} Pa
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200 flex justify-between items-center">
                    <div>
                      <span className="font-semibold text-slate-700 block">Blower Shaft Fan Power for Tube</span>
                      <span className="text-[10px] text-slate-400">65% fan efficiency basis</span>
                    </div>
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {calcImpact(kineticsDevelopedLength).addedFanKw} kW
                    </span>
                  </div>

                  <div className="p-3 bg-white rounded-lg border border-slate-200">
                    <span className="font-semibold text-slate-700 block text-[11px]">CIRAD Experimental Guideline</span>
                    <p className="text-[11px] text-slate-600 mt-1 leading-normal">
                      &quot;In flash dryers for cassava starch and flour, total developed drying tube length must equal or exceed 20 meters with return hairpin loops to achieve over 85% thermal contact efficiency without burning starch granules.&quot; (Chapuis et al. 2015)
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: GEOMETRY & CLEARANCE METHOD */}
        {activeTab === 'geometry' && (
          <div className="p-5 sm:p-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Controls */}
              <div className="lg:col-span-7 space-y-5">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Maximize2 className="w-4 h-4 text-sky-600" />
                    <span>Workshop Ceiling Clearance &amp; Piping Routing</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure the structural routing architecture (single loop, double serpentine, or straight tower) to satisfy industrial factory clearances while delivering the target developed length.
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4 text-xs">
                  {/* Ceiling Clearance Limit */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-semibold text-slate-800">
                        Factory Ceiling / Crane Hook Clearance (H_clearance):
                      </label>
                      <span className="font-mono font-bold text-sky-700 text-sm bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {ceilingClearance.toFixed(1)} meters
                      </span>
                    </div>
                    <input
                      type="range"
                      min="5.0"
                      max="14.0"
                      step="0.5"
                      value={ceilingClearance}
                      onChange={(e) => setCeilingClearance(parseFloat(e.target.value))}
                      className="w-full accent-sky-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>5.0 m (Low Shed)</span>
                      <span>8.0 m (Standard Industrial Hall)</span>
                      <span>14.0 m (High Tower)</span>
                    </div>
                  </div>

                  {/* Routing Layout Option */}
                  <div className="space-y-1.5">
                    <label className="font-semibold text-slate-800 block">
                      Flash Tube Routing Architecture:
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setRoutingLayout('single_loop')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          routingLayout === 'single_loop'
                            ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200 text-sky-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-xs font-bold">Single U-Bend Loop</span>
                        <span className="text-[10px] text-slate-500">Standard 1 riser + 1 top U-bend + downcomer</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRoutingLayout('double_loop')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          routingLayout === 'double_loop'
                            ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200 text-sky-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-xs font-bold">Double S-Serpentine</span>
                        <span className="text-[10px] text-slate-500">Low ceiling (&lt;7m) high residence passes</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setRoutingLayout('straight_riser')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          routingLayout === 'straight_riser'
                            ? 'bg-sky-50 border-sky-500 ring-2 ring-sky-200 text-sky-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span className="block text-xs font-bold">Straight Riser Tower</span>
                        <span className="text-[10px] text-slate-500">Direct vertical run to elevated cyclone</span>
                      </button>
                    </div>
                  </div>

                  {/* Bend Radius Ratio */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="font-semibold text-slate-800">
                        Elbow Bend Radius Ratio (R_bend / D_tube):
                      </label>
                      <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {bendRadiusRatio.toFixed(1)} &times; D = {(bendRadiusRatio * dimensions.tubeDiameterStandardMm).toFixed(0)} mm
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {[1.5, 2.0, 2.5, 3.0].map((ratio) => (
                        <button
                          key={ratio}
                          type="button"
                          onClick={() => setBendRadiusRatio(ratio)}
                          className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                            bendRadiusRatio === ratio
                              ? 'bg-sky-600 text-white border-sky-600'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {ratio.toFixed(1)} D {ratio === 2.0 && '(Standard)'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Geometry Summary Box */}
                <div className="p-4 rounded-xl bg-sky-50 border border-sky-200 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sky-950">Calculated Layout Developed Length:</span>
                    <span className="text-base font-extrabold text-sky-800 font-mono">
                      {geometryDevelopedLength.toFixed(1)} m
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700 pt-1">
                    <div>
                      Vertical Column Height: <strong>{maxRiserByCeiling.toFixed(1)} m</strong>
                    </div>
                    <div>
                      Headroom Margin: <strong>{(ceilingClearance - maxRiserByCeiling).toFixed(1)} m</strong>
                    </div>
                    <div>
                      90° Elbow Arc: <strong>{elbowArcM.toFixed(2)} m</strong>
                    </div>
                    <div>
                      180° U-Bend Arc: <strong>{ubendArcM.toFixed(2)} m</strong>
                    </div>
                  </div>
                </div>

                {/* Apply button */}
                <button
                  type="button"
                  onClick={() => handleApplyLength(geometryDevelopedLength, routingLayout)}
                  className="w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Apply Geometry Developed Length ({geometryDevelopedLength.toFixed(1)} m) to Model</span>
                </button>
              </div>

              {/* Schematic Diagram */}
              <div className="lg:col-span-5 bg-slate-900 text-white rounded-xl p-4 border border-slate-800 space-y-3 flex flex-col justify-between">
                <div>
                  <h5 className="text-xs font-bold text-slate-200 uppercase tracking-tight flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-sky-400" />
                    <span>Centerline Path Schematic</span>
                  </h5>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Schematic representation of {routingLayout.replace('_', ' ').toUpperCase()} layout inside {ceilingClearance}m building envelope.
                  </p>
                </div>

                {/* SVG Schematic */}
                <div className="bg-slate-950/70 rounded-lg p-3 border border-slate-800/80 flex items-center justify-center">
                  <svg viewBox="0 0 280 200" className="w-full h-44">
                    {/* Ceiling boundary line */}
                    <line x1="10" y1="25" x2="270" y2="25" stroke="#ef4444" strokeDasharray="4 4" strokeWidth="1.5" />
                    <text x="15" y="20" fill="#f87171" fontSize="9" fontWeight="bold">
                      Ceiling: {ceilingClearance.toFixed(1)}m Limit
                    </text>

                    {/* Ground line */}
                    <line x1="10" y1="185" x2="270" y2="185" stroke="#64748b" strokeWidth="2" />
                    <text x="15" y="196" fill="#94a3b8" fontSize="8">
                      Ground Elevation (0.00 m)
                    </text>

                    {routingLayout === 'single_loop' && (
                      <g>
                        {/* Venturi base */}
                        <path d="M 50 185 L 50 160" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
                        {/* Base elbow */}
                        <path d="M 50 160 Q 50 145 65 145" fill="none" stroke="#10b981" strokeWidth="6" />
                        {/* Vertical Riser */}
                        <path d="M 65 145 L 65 45" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
                        {/* Top U-bend */}
                        <path d="M 65 45 A 25 25 0 0 1 115 45" fill="none" stroke="#10b981" strokeWidth="6" />
                        {/* Downcomer */}
                        <path d="M 115 45 L 115 110" stroke="#10b981" strokeWidth="6" strokeLinecap="round" />
                        {/* Transition into cyclone */}
                        <path d="M 115 110 L 140 110" stroke="#10b981" strokeWidth="5" />
                        {/* Cyclone outline */}
                        <rect x="140" y="85" width="40" height="50" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
                        <polygon points="140,135 180,135 160,175" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" />
                        
                        {/* Labels */}
                        <text x="72" y="95" fill="#34d399" fontSize="9" fontWeight="bold">
                          Riser: {maxRiserByCeiling.toFixed(1)}m
                        </text>
                        <text x="122" y="80" fill="#38bdf8" fontSize="8">
                          Downcomer
                        </text>
                      </g>
                    )}

                    {routingLayout === 'double_loop' && (
                      <g>
                        <path d="M 40 185 L 40 160 Q 40 145 55 145 L 55 45" stroke="#10b981" strokeWidth="5" fill="none" />
                        <path d="M 55 45 A 18 18 0 0 1 91 45 L 91 140" stroke="#10b981" strokeWidth="5" fill="none" />
                        <path d="M 91 140 A 18 18 0 0 0 127 140 L 127 45" stroke="#10b981" strokeWidth="5" fill="none" />
                        <path d="M 127 45 A 18 18 0 0 1 163 45 L 163 110 L 180 110" stroke="#10b981" strokeWidth="5" fill="none" />
                        {/* Cyclone outline */}
                        <rect x="180" y="85" width="35" height="45" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
                        <polygon points="180,130 215,130 197,165" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" />
                        <text x="60" y="95" fill="#34d399" fontSize="8" fontWeight="bold">Double S-Serpentine</text>
                      </g>
                    )}

                    {routingLayout === 'straight_riser' && (
                      <g>
                        <path d="M 60 185 L 60 150 Q 60 135 75 135 L 75 45 Q 75 35 85 35 L 130 35" stroke="#10b981" strokeWidth="6" fill="none" />
                        <rect x="130" y="25" width="45" height="55" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" rx="3" />
                        <polygon points="130,80 175,80 152,125" fill="#38bdf8" fillOpacity="0.2" stroke="#38bdf8" strokeWidth="1.5" />
                        <text x="82" y="90" fill="#34d399" fontSize="9" fontWeight="bold">Direct Straight Riser</text>
                      </g>
                    )}
                  </svg>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between border-t border-slate-800 pt-2">
                  <span>Standard Pipe: Ø{dimensions.tubeDiameterStandardMm} mm</span>
                  <span className="text-emerald-400 font-semibold">Total: {geometryDevelopedLength.toFixed(1)} m</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DETAILED SEGMENT-BY-SEGMENT TAKEOFF */}
        {activeTab === 'segments' && (
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <span>Physical Component Segment Breakdown</span>
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Detailed centerline development for every straight spool, sweep elbow, U-bend, and transitional reducer in the drying tube assembly.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={copyCutList}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied Cut List!' : 'Copy Cutting Schedule'}</span>
                </button>
              </div>
            </div>

            {/* Segments Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-2.5 px-3">#</th>
                    <th className="py-2.5 px-3">Component / Segment</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Unit Length</th>
                    <th className="py-2.5 px-3 text-right">Qty</th>
                    <th className="py-2.5 px-3 text-right">Total Developed</th>
                    <th className="py-2.5 px-3 text-right">Weld Joints</th>
                    <th className="py-2.5 px-3">Engineering Function</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentReport?.segments.map((seg, index) => (
                    <tr key={seg.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-400">{index + 1}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{seg.name}</td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            seg.type === 'straight'
                              ? 'bg-slate-100 text-slate-700'
                              : seg.type.includes('elbow')
                              ? 'bg-sky-100 text-sky-800'
                              : seg.type.includes('ubend')
                              ? 'bg-indigo-100 text-indigo-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {seg.type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                        {seg.unitLengthM.toFixed(2)} m
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{seg.quantity}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                        {seg.totalLengthM.toFixed(2)} m
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">{seg.weldsCount}</td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-600 max-w-xs">{seg.description}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-900">
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-xs">
                      Total Calculated Developed Length:
                    </td>
                    <td className="py-3 px-3 text-right text-sm font-extrabold text-emerald-700 font-mono">
                      {currentReport?.totalDevelopedLengthM.toFixed(2)} m
                    </td>
                    <td className="py-3 px-3 text-right font-mono text-xs">
                      {currentReport?.segments.reduce((acc, s) => acc + s.weldsCount, 0)} welds
                    </td>
                    <td className="py-3 px-3 text-xs text-slate-500 font-normal">
                      {currentReport?.ciradCompliant ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Fulfills CIRAD L ≥ 20.0 m guideline
                        </span>
                      ) : (
                        <span className="text-amber-700 font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Below CIRAD 20.0 m recommendation
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Manual Override Custom Input */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-800 block">Custom Developed Length Override (m)</span>
                <span className="text-slate-500 text-[11px]">
                  Directly input a specific workshop fabrication spool length to evaluate and apply across all downstream models.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="10.0"
                  max="40.0"
                  step="0.5"
                  value={customLengthInput}
                  onChange={(e) => setCustomLengthInput(parseFloat(e.target.value) || CIRAD_MIN_LENGTH_M)}
                  className="w-28 px-3 py-1.5 rounded-lg border border-slate-300 font-mono font-bold text-slate-900 text-sm focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={() => handleApplyLength(customLengthInput)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors cursor-pointer"
                >
                  Set Custom Length
                </button>
                <button
                  type="button"
                  onClick={handleResetToCirad}
                  className="px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                  title="Reset to CIRAD default"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SHEET METAL FABRICATION */}
        {activeTab === 'fabrication' && currentReport && (
          <div className="p-5 sm:p-6 space-y-6">
            <div>
              <h4 className="text-sm font-bold text-slate-900 uppercase tracking-tight flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-600" />
                <span>Sheet Metal Fabrication &amp; Roll Development Takeoff</span>
              </h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Fabrication schedule for rolling flat sheet-metal blanks into cylindrical strakes (cans), longitudinal weld seams, girth joints, and insulation envelope.
              </p>
            </div>

            {/* Fabrication KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200">
                <span className="text-amber-800 block text-[11px] font-semibold">Unfolded Blank Circumference</span>
                <span className="text-lg font-extrabold text-amber-950 font-mono">
                  {currentReport.sheetMetal.developedCircumferenceMm} mm
                </span>
                <span className="text-[10px] text-amber-700 block mt-0.5">
                  Width of flat plate (π × D_mean)
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px] font-semibold">Rolled Strakes Count (Cans)</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {currentReport.sheetMetal.standardStrakesCount} cans
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Based on 1200 mm standard sheets
                </span>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px] font-semibold">Total Weld Seams Length</span>
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {currentReport.sheetMetal.totalWeldSeamLengthM.toFixed(1)} m
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Longitudinal + circumferential seams
                </span>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
                <span className="text-emerald-800 block text-[11px] font-semibold">SS304 Sheet Metal Weight</span>
                <span className="text-lg font-extrabold text-emerald-950 font-mono">
                  ~{currentReport.sheetMetal.estimatedMassKg} kg
                </span>
                <span className="text-[10px] text-emerald-700 block mt-0.5">
                  2.0 mm wall (7930 kg/m³)
                </span>
              </div>
            </div>

            {/* Detailed Parameters List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <h5 className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">
                  Cylindrical Can &amp; Pipe Specifications
                </h5>
                <div className="divide-y divide-slate-200/80 text-[11px]">
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Nominal / Outer Diameter (D_o):</span>
                    <span className="font-bold text-slate-900">Ø{currentReport.sheetMetal.outerDiameterMm} mm</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Wall Thickness (t):</span>
                    <span className="font-bold text-slate-900">{currentReport.sheetMetal.wallThicknessMm} mm (SS304 Food Contact)</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Mean Bending Diameter (D_mean):</span>
                    <span className="font-bold text-slate-900">Ø{currentReport.sheetMetal.meanDiameterMm} mm</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Inner Flow Diameter (D_i):</span>
                    <span className="font-bold text-slate-900">Ø{currentReport.sheetMetal.innerDiameterMm} mm</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Total Developed Length (L_dev):</span>
                    <span className="font-extrabold text-emerald-700">{currentReport.totalDevelopedLengthM.toFixed(1)} m</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                <h5 className="font-bold text-slate-800 uppercase tracking-tight text-[11px]">
                  Thermal Insulation &amp; Flange Allowances
                </h5>
                <div className="divide-y divide-slate-200/80 text-[11px]">
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">External Surface Area (Lagging Area):</span>
                    <span className="font-bold text-slate-900">{currentReport.sheetMetal.insulationAreaM2.toFixed(1)} m²</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Recommended Insulation Thickness:</span>
                    <span className="font-bold text-slate-900">50 mm Rockwool / Mineral Wool</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Protective Cladding Material:</span>
                    <span className="font-bold text-slate-900">0.6 mm Aluminum Stucco Sheet</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Flange Joint Connections:</span>
                    <span className="font-bold text-slate-900">Sanitary SS304 Angle-Ring Flanges</span>
                  </div>
                  <div className="py-1.5 flex justify-between">
                    <span className="text-slate-600">Inspection &amp; Cleanout Hatches:</span>
                    <span className="font-bold text-slate-900">3x Quick-Release Gasketed Hatches</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-slate-500">
                All sheet metal cutting tolerances are ±1.5 mm according to ISO 2768-m.
              </span>
              <button
                type="button"
                onClick={copyCutList}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Copied Cut List!' : 'Copy Fabrication Cut List'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3D Visualizer Quick Link */}
      {onNavigateTo3D && (
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Maximize2 className="w-5 h-5 text-emerald-700" />
            <div>
              <span className="font-bold text-emerald-950 block">Inspect Developed Length in Interactive 3D</span>
              <span className="text-emerald-800 text-[11px]">
                View the routed drying tube, animated particle streamlines, connection ports, and dimensional callouts.
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onNavigateTo3D}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <span>Open 3D Model Simulator</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
