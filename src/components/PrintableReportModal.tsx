import React, { useRef } from 'react';
import {
  Printer,
  Download,
  X,
  FileText,
  Flame,
  CheckCircle2,
  ExternalLink,
  ShieldAlert,
  Info
} from 'lucide-react';
import { CalculationResults } from '../types/dryer';
import { generateEngineeringPdf } from '../utils/pdfGenerator';

interface PrintableReportModalProps {
  results: CalculationResults;
  isOpen: boolean;
  onClose: () => void;
}

export const PrintableReportModal: React.FC<PrintableReportModalProps> = ({
  results,
  isOpen,
  onClose,
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const handleBrowserPrint = () => {
    window.print();
  };

  // Async because generateEngineeringPdf imports jsPDF on demand.
  const handleDownloadPdf = async () => {
    const doc = await generateEngineeringPdf(results);
    doc.save(`Cassava_Flash_Dryer_Report_${results.dimensions.tubeDiameterStandardMm}mm_${results.materialBalance.productRateKgH.toFixed(0)}kgh.pdf`);
  };

  const {
    dimensions,
    materialBalance,
    energyBalance,
    fluidDynamics,
    psychrometrics,
    heatExchanger,
    inputs,
    steps,
    checks,
  } = results;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto print-dialog-overlay print:static print:bg-white print:p-0 print:m-0 print:overflow-visible">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full my-auto overflow-hidden flex flex-col max-h-[95vh] print-dialog-card print:static print:max-h-none print:overflow-visible print:border-none print:shadow-none print:rounded-none print:w-full print:m-0">
        {/* Top Action Toolbar (Hidden during print) */}
        <div className="px-6 py-3.5 bg-slate-900 text-white flex items-center justify-between print:hidden shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white">
                Engineering Calculation &amp; Sizing Report
              </h2>
              <p className="text-[11px] text-slate-400">
                Native Computer Print Engine (Save as PDF) or Direct Vector PDF Download
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Native Browser Print Button (Uses computer's print-to-PDF engine) */}
            <button
              type="button"
              onClick={handleBrowserPrint}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
              title="Opens your computer's native print engine. Choose 'Save as PDF' for crisp high-resolution output."
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save as PDF (Computer)</span>
            </button>

            {/* Direct PDF Download Button */}
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
              title="Download compiled standalone .pdf file"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download .PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-2 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div
          ref={printAreaRef}
          className="p-6 sm:p-10 overflow-y-auto print:p-0 print:overflow-visible space-y-6 text-slate-800 text-xs sm:text-sm font-sans"
        >
          {/* Cover / Header Banner */}
          <div className="border-b-2 border-slate-900 pb-4 print-page-break-avoid">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-block mb-1">
                  Preliminary Mechanical Engineering Specification
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  CASSAVA FLASH DRYER SIZING REPORT (HQCF)
                </h1>
                <p className="text-xs text-slate-600 mt-1">
                  Pneumatic Conveying Drying Sizing &amp; Design Calculations for High-Quality Cassava Flour
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Reference: CIRAD Flash Dryer Design Tools Suite &amp; IITA Pilot Benchmarks •{' '}
                  <a
                    href="https://flashdryer.cirad.fr/design-tools"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-700 underline"
                  >
                    https://flashdryer.cirad.fr/design-tools
                  </a>
                </p>
              </div>
              <div className="text-right text-[11px] text-slate-500 font-mono">
                <p><strong>REPORT DATE:</strong> {new Date().toISOString().split('T')[0]}</p>
                <p><strong>DOC ID:</strong> CIRAD-FD-2026-HQCF</p>
                <p><strong>METHODOLOGY:</strong> {inputs.methodology.toUpperCase()}</p>
              </div>
            </div>

            {/* Disclaimer Box */}
            <div className="mt-4 p-2.5 bg-amber-50 border border-amber-300 rounded-lg text-[11px] text-amber-900 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>ENGINEERING DESIGN NOTICE:</strong> All dimensional calculations represent preliminary mechanical design specifications. Final equipment construction is subject to workshop manufacturing tolerances, pipe schedule availability, and pilot test verification.
              </div>
            </div>
          </div>

          {/* SECTION 1: Key Performance Indicators Table */}
          <div className="print-page-break-avoid">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5 pb-1 border-b border-slate-200">
              <span>1. Design Summary &amp; Key Performance Indicators</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50">
                    <td className="p-2 font-bold text-slate-700">Dry Flour Production Target</td>
                    <td className="p-2 text-right font-black text-slate-900">{materialBalance.productRateKgH.toFixed(1)} kg/h</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium text-slate-600">Wet Cassava Feed Rate</td>
                    <td className="p-2 text-right font-bold text-slate-800">{materialBalance.feedRateKgH.toFixed(1)} kg/h</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-medium text-slate-600">Moisture Evaporation Rate</td>
                    <td className="p-2 text-right font-bold text-slate-800">{materialBalance.waterRemovedKgH.toFixed(1)} kg/h</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium text-slate-600">Drying Air Mass Flow</td>
                    <td className="p-2 text-right font-bold text-slate-800">
                      {energyBalance.dryAirMassFlowKgS.toFixed(3)} kg/s ({energyBalance.dryAirMassFlowKgH.toFixed(0)} kg/h)
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-medium text-slate-600">
                      <div>Dry-air / dry-solids dilution ratio</div>
                      <div className="text-[10px] text-slate-400 font-normal">Air / wet-feed ratio: {energyBalance.airToWetFeedRatio.toFixed(1)}:1</div>
                    </td>
                    <td className="p-2 text-right font-bold text-emerald-800">
                      {energyBalance.airToStarchRatio.toFixed(1)} : 1 (dry basis)
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                <tbody className="divide-y divide-slate-200">
                  <tr className="bg-slate-50">
                    <td className="p-2 font-bold text-slate-700">
                      <div>Nominal pipe diameter: Ø{dimensions.tubeDiameterStandardMm} mm</div>
                      <div className="text-[10px] text-slate-500 font-normal">Calculated required diameter: Ø{dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm</div>
                    </td>
                    <td className="p-2 text-right font-black text-slate-900">
                      Ø{dimensions.tubeDiameterStandardMm} mm
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium text-slate-600">Total Developed Pipe Length</td>
                    <td className="p-2 text-right font-bold text-slate-800">{dimensions.totalPipeLengthM.toFixed(1)} m (Riser: {dimensions.verticalColumnHeightM.toFixed(1)} m)</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-medium text-slate-600">Particle Residence Contact Time</td>
                    <td className="p-2 text-right font-bold text-slate-800">{dimensions.estimatedResidenceTimeSec.toFixed(2)} seconds</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-medium text-slate-600">Air Heater Thermal Duty</td>
                    <td className="p-2 text-right font-bold text-amber-700">
                      {energyBalance.totalHeatDutyKW.toFixed(1)} kW ({energyBalance.totalHeatDutyKcalH.toFixed(0)} kcal/h)
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-medium text-slate-600">Heat Exchanger Passes &amp; Area</td>
                    <td className="p-2 text-right font-bold text-amber-800">
                      {heatExchanger.numberOfPasses} Passes ({heatExchanger.surfaceAreaM2.toFixed(1)} m², {heatExchanger.totalTubesCount} tubes)
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 2: Heat Exchanger Multi-Pass Specification */}
          <div className="p-4 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2 print-page-break-avoid">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-600" />
                <span>2. Multi-Pass Air Heat Exchanger Specification (CIRAD Module 4)</span>
              </h2>
              <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                {heatExchanger.numberOfPasses} Specified Passes
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-white p-2.5 rounded border border-amber-200">
                <span className="text-[10px] text-slate-500 block">Thermal Heating Duty</span>
                <span className="font-bold text-slate-900">{heatExchanger.thermalDutyKW.toFixed(1)} kW</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-amber-200">
                <span className="text-[10px] text-slate-500 block">Required Surface Area</span>
                <span className="font-bold text-slate-900">{heatExchanger.surfaceAreaM2.toFixed(1)} m²</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-amber-200">
                <span className="text-[10px] text-slate-500 block">Tube Layout &amp; Pass Count</span>
                <span className="font-bold text-slate-900">
                  {heatExchanger.totalTubesCount} tubes ({heatExchanger.tubesPerPass} tubes/pass)
                </span>
              </div>
              <div className="bg-white p-2.5 rounded border border-amber-200">
                <span className="text-[10px] text-slate-500 block">Air-Side Pressure Drop (ΔP)</span>
                <span className="font-bold text-slate-900">{heatExchanger.airSidePressureDropPa} Pa</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed pt-1">
              <strong>Design Basis:</strong> Cross-flow arrangement with overall heat transfer coefficient U = {heatExchanger.overallUCoeffWperM2K} W/(m²·K). Log Mean Temperature Difference LMTD = {heatExchanger.lmtdC.toFixed(1)}°C with multi-pass correction factor F_t = {heatExchanger.correctionFactorFt.toFixed(3)}, yielding effective ΔT_lm = {heatExchanger.effectiveLmtdC.toFixed(1)}°C.
            </p>
          </div>

          {/* SECTION 3: Input Parameters */}
          <div className="print-page-break-avoid">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200">
              3. Operating Conditions &amp; Design Input Parameters
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 text-left">Parameter</th>
                    <th className="p-2 text-left">Value</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2 text-left">Source Classification</th>
                    <th className="p-2 text-left">Engineering Reference &amp; Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-semibold">Initial Cassava Mash Moisture (w1)</td>
                    <td className="p-2 font-bold">{inputs.initialMoisture.toFixed(1)}</td>
                    <td className="p-2">% w.b.</td>
                    <td className="p-2">User Input</td>
                    <td className="p-2 text-slate-600">Cassava cake after hydraulic/screw dewatering press</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold">Final Target HQCF Moisture (w2)</td>
                    <td className="p-2 font-bold">{inputs.finalMoisture.toFixed(1)}</td>
                    <td className="p-2">% w.b.</td>
                    <td className="p-2">User Input</td>
                    <td className="p-2 text-slate-600">Standard for High-Quality Cassava Flour microbiological safety (&lt; 13%)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold">Drying Air Inlet Temperature (T_in)</td>
                    <td className="p-2 font-bold">{inputs.inletAirTemp.toFixed(1)}</td>
                    <td className="p-2">°C</td>
                    <td className="p-2">User Input</td>
                    <td className="p-2 text-slate-600">CIRAD energy-efficient benchmark: 170 - 180°C</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold">Exhaust Air Outlet Temperature (T_out)</td>
                    <td className="p-2 font-bold">{inputs.outletAirTemp.toFixed(1)}</td>
                    <td className="p-2">°C</td>
                    <td className="p-2">User Input</td>
                    <td className="p-2 text-slate-600">Design 70 - 80°C. Temperature above 85°C risks cassava gelatinization</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold">Ambient Temperature &amp; Relative Humidity</td>
                    <td className="p-2 font-bold">{inputs.ambientTemp.toFixed(1)} / {inputs.ambientRH.toFixed(0)}</td>
                    <td className="p-2">°C / %</td>
                    <td className="p-2">User Input</td>
                    <td className="p-2 text-slate-600">Standard tropical intake conditions at blower suction</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold">Design Conveying Air Velocity (v_air)</td>
                    <td className="p-2 font-bold">{inputs.airVelocity.toFixed(1)}</td>
                    <td className="p-2">m/s</td>
                    <td className="p-2">User Input</td>
                    <td className="p-2 text-slate-600">Exceeds saltation velocity ({fluidDynamics.saltationVelocity.toFixed(1)} m/s) to ensure suspension</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-semibold">Cassava Particle Mean Diameter (d_p)</td>
                    <td className="p-2 font-bold">{inputs.particleDiameter.toFixed(0)}</td>
                    <td className="p-2">µm</td>
                    <td className="p-2">Source Data</td>
                    <td className="p-2 text-slate-600">CIRAD Pilot Experimental Measurement (Chapuis 2015, Section 3.1)</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-semibold">Cassava Starch Granular Density</td>
                    <td className="p-2 font-bold">{inputs.particleDensity.toFixed(0)}</td>
                    <td className="p-2">kg/m³</td>
                    <td className="p-2">Source Data</td>
                    <td className="p-2 text-slate-600">Standard helium pycnometry solid density of dry cassava starch</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 4: Mechanical Dimensions Schedule */}
          <div className="print-page-break-avoid">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200">
              4. Preliminary Mechanical Equipment Dimensions Schedule
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-2 text-left">Equipment Component</th>
                    <th className="p-2 text-left">Nominal Sizing</th>
                    <th className="p-2 text-left">Fabrication Spec</th>
                    <th className="p-2 text-left">Material</th>
                    <th className="p-2 text-left">Design Rationale &amp; Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="p-2 font-bold">Flash Drying Pipe &amp; Vertical Riser</td>
                    <td className="p-2 font-semibold">
                      <div>Nominal pipe diameter: Ø{dimensions.tubeDiameterStandardMm} mm</div>
                      <div className="text-[10px] text-slate-500 font-normal">Calculated required diameter: Ø{dimensions.tubeDiameterCalculatedMm.toFixed(1)} mm</div>
                      <div className="text-[10px] text-slate-600">Riser Height: {dimensions.verticalColumnHeightM.toFixed(1)} m</div>
                    </td>
                    <td className="p-2">Schedule 10 / 2.0 mm wall</td>
                    <td className="p-2">SS 304 (Sanitary)</td>
                    <td className="p-2 text-slate-600">
                      Nominal size is a selected standard fabrication value; final pressure-drop, velocity, and mechanical verification are required before manufacture. Actual air velocity = {dimensions.actualAirVelocityMperS.toFixed(1)} m/s.
                    </td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-bold">Total Developed Pipe Run</td>
                    <td className="p-2 font-semibold">{dimensions.totalPipeLengthM.toFixed(1)} meters</td>
                    <td className="p-2">Flanged spool runs</td>
                    <td className="p-2">SS 304 + 50mm Lagging</td>
                    <td className="p-2 text-slate-600">Includes loop bends to fulfill CIRAD length rule (L ≥ 20m)</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold">Venturi Lump Disperser</td>
                    <td className="p-2 font-semibold">Ø{dimensions.venturiThroatDiameterMm} mm</td>
                    <td className="p-2">Conical reducer / expander</td>
                    <td className="p-2">SS 304</td>
                    <td className="p-2 text-slate-600">Accelerates gas to {dimensions.venturiThroatVelocityMperS.toFixed(1)} m/s to shear dewatered cassava clumps</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-bold">Multi-Pass Air Heat Exchanger</td>
                    <td className="p-2 font-semibold">{heatExchanger.surfaceAreaM2.toFixed(1)} m² ({heatExchanger.numberOfPasses} Passes)</td>
                    <td className="p-2">{heatExchanger.totalTubesCount} Tubes ({heatExchanger.tubesPerPass}/pass)</td>
                    <td className="p-2">Carbon Steel / SS Tubes</td>
                    <td className="p-2 text-slate-600">Indirect heat exchange; air ΔP = {heatExchanger.airSidePressureDropPa} Pa</td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold">Cyclone Powder Separator</td>
                    <td className="p-2 font-semibold">Ø{dimensions.cycloneDiameterMm} mm × {dimensions.cycloneTotalHeightMm} mm</td>
                    <td className="p-2">{dimensions.cycloneType === 'stairmand' ? 'Stairmand H.E.' : 'Lapple Standard'}</td>
                    <td className="p-2">SS 304 Sheet</td>
                    <td className="p-2 text-slate-600">Inlet: {dimensions.cycloneInletHeightMm}×{dimensions.cycloneInletWidthMm} mm, &gt;98% collection efficiency</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 font-bold">Centrifugal Blower / Fan System</td>
                    <td className="p-2 font-semibold">{dimensions.fanMotorPowerKW.toFixed(1)} kW @ {dimensions.fanTotalPressureDropPa} Pa</td>
                    <td className="p-2">Radial / Backward curved</td>
                    <td className="p-2">Mild Steel / SS</td>
                    <td className="p-2 text-slate-600">
                      <strong>Fan Duty Disclosure:</strong> Pressure-mode selection changes the pressure boundary condition and dust-leakage assessment. The present preliminary model retains the same airflow and preliminary fan-duty basis for all draft configurations. Final fan selection requires a complete pressure-drop calculation.
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2 font-bold">Supporting Steel Structure</td>
                    <td className="p-2 font-semibold">{dimensions.frameFootprintLengthM.toFixed(1)}m × {dimensions.frameFootprintWidthM.toFixed(1)}m × {dimensions.frameOverallHeightM.toFixed(1)}m</td>
                    <td className="p-2">H-Beam &amp; RHS Tubing</td>
                    <td className="p-2">Structural Carbon Steel</td>
                    <td className="p-2 text-slate-600">Includes access platforms, cyclone tower, and ladder rungs</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* SECTION 5: Step-by-Step Calculation Derivations */}
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 pb-1 border-b border-slate-200">
              5. Step-by-Step Mathematical Derivations &amp; Equation Checks
            </h2>
            <div className="space-y-2.5">
              {steps.map((step, idx) => (
                <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-1 print-page-break-avoid">
                  <div className="flex items-center justify-between font-bold text-slate-900 border-b border-slate-200 pb-1">
                    <span>{step.parameterName} ({step.symbol})</span>
                    <span className="text-[10px] text-slate-500 font-mono">[{step.category}] • {step.sourceClassification}</span>
                  </div>
                  {step.simpleExplanation && (
                    <div className="text-[11px] text-emerald-900 bg-emerald-50/80 p-1.5 rounded border border-emerald-200/60 leading-snug">
                      <strong>Simple Explanation:</strong> {step.simpleExplanation}
                    </div>
                  )}
                  <div className="font-mono text-[11px] text-sky-900 bg-sky-50/70 p-1.5 rounded border border-sky-200/60">
                    <strong>Equation:</strong> {step.equation}
                  </div>
                  <div className="text-[11px] text-slate-600">
                    <strong>Source Citation:</strong> <em>{step.sourceCitation}</em>
                  </div>
                  <div className="font-mono text-[11px] text-slate-700">
                    <strong>Substitution:</strong> {step.substitution}
                  </div>
                  <div className="text-xs font-bold text-emerald-700">
                    <strong>Result:</strong> {step.formattedResult}
                  </div>
                  {step.notes && (
                    <div className="text-[10px] text-slate-500 pt-0.5">
                      <strong>Note:</strong> {step.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* SECTION 6: References */}
          <div className="border-t border-slate-200 pt-3 text-slate-500 text-[11px] space-y-1 print-page-break-avoid">
            <p className="font-bold text-slate-700">References &amp; Standards:</p>
            <p>1. CIRAD Flash Dryer Design Tools: <a href="https://flashdryer.cirad.fr/design-tools" target="_blank" rel="noreferrer" className="text-emerald-700 underline">https://flashdryer.cirad.fr/design-tools</a></p>
            <p>2. Arnaud Chapuis (2015): Pilot Flash Dryer Report - Guidelines for the design and construction of an experimental pneumatic dryer for cassava products RTB Post-harvest, CIRAD/CIAT/Univalle, Cali, Colombia.</p>
            <p>3. A. Kuye, D.B. Ayo, L.O. Sanni et al. (2011/2017): Design and Fabrication of a Flash Dryer for the Production of High-Quality Cassava Flour, International Institute of Tropical Agriculture (IITA).</p>
          </div>
        </div>
      </div>
    </div>
  );
};
