import React, { useState } from 'react';
import { ScrewFeederDesignReport, HopperDesignReport } from '../types/dryer';
import { Layers, Zap, Info, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ScrewFeederDrawingProps {
  hopperDesign: HopperDesignReport;
  screwFeederDesign: ScrewFeederDesignReport;
}

export const ScrewFeederDrawing: React.FC<ScrewFeederDrawingProps> = ({
  hopperDesign,
  screwFeederDesign,
}) => {
  const [activeView, setActiveView] = useState<'longitudinal' | 'cross_section'>('longitudinal');

  const D = screwFeederDesign.screwDiameterMm; // e.g. 100 mm
  const L = screwFeederDesign.screwLengthMm; // e.g. 1000 mm
  const pitch = screwFeederDesign.screwPitchMm; // e.g. 100 mm
  const dShaft = screwFeederDesign.shaftDiameterMm; // e.g. 38 mm
  const flights = screwFeederDesign.numberOfFlights; // e.g. 10 turns
  const loading = screwFeederDesign.troughLoadingPercent; // 30%

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-4 sm:p-5 text-slate-200 space-y-4 shadow-xl">
      {/* Header & View Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 uppercase tracking-wide">
              Engineering CAD Drawing
            </span>
            <span className="text-xs text-slate-400 font-mono">
              IITA HQCF Feeder Specification • Ø{D} mm × {L} mm
            </span>
          </div>
          <h4 className="text-sm sm:text-base font-bold text-white mt-1">
            Wet Cassava Screw Feeder Mechanical Assembly
          </h4>
        </div>

        <div className="inline-flex rounded-lg border border-slate-700 p-0.5 bg-slate-800 text-xs font-semibold self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveView('longitudinal')}
            className={`px-3 py-1 rounded transition-colors ${
              activeView === 'longitudinal'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Longitudinal Assembly View
          </button>
          <button
            type="button"
            onClick={() => setActiveView('cross_section')}
            className={`px-3 py-1 rounded transition-colors ${
              activeView === 'cross_section'
                ? 'bg-sky-600 text-white shadow-xs font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Trough Cross-Section &amp; Fill
          </button>
        </div>
      </div>

      {/* SVG Drawing Canvas */}
      <div className="bg-slate-950 rounded-xl p-4 border border-slate-800 flex items-center justify-center min-h-[340px] overflow-x-auto">
        {activeView === 'longitudinal' ? (
          <svg viewBox="0 0 850 360" className="w-full max-w-[850px] h-auto font-mono text-slate-300">
            <defs>
              <linearGradient id="shaftGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="50%" stopColor="#e2e8f0" />
                <stop offset="100%" stopColor="#64748b" />
              </linearGradient>
              <linearGradient id="flightGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95" />
              </linearGradient>
              <linearGradient id="motorGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#1e3a8a" />
                <stop offset="100%" stopColor="#3b82f6" />
              </linearGradient>
              <linearGradient id="mashFillBed" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#d97706" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.75" />
              </linearGradient>
              <pattern id="gridBlueprint" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1e293b" strokeWidth="0.6" />
              </pattern>
            </defs>

            <rect width="850" height="360" fill="url(#gridBlueprint)" rx="8" />

            {/* Hopper Outline Above Intake Throat */}
            <path
              d="M 220 30 L 480 30 L 440 90 L 260 90 Z"
              fill="none"
              stroke="#64748b"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />
            <text x="350" y="24" fill="#94a3b8" fontSize="11" textAnchor="middle" fontWeight="bold">
              Hopper Throat Intake (W2: {(hopperDesign.outletWidthM * 1000).toFixed(0)} mm × L2: {(hopperDesign.outletLengthM * 1000).toFixed(0)} mm)
            </text>

            {/* Screw Feeder Trough (U-Trough Outline) */}
            {/* Trough spans X: 190 to 710 (width 520 px = 1000 mm) */}
            <rect x="190" y="90" width="520" height="150" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" rx="4" />
            
            {/* 30% Trough Loading Bed Area (Lower 30% of height) */}
            <path
              d="M 192 195 L 708 195 L 708 238 L 192 238 Z"
              fill="url(#mashFillBed)"
              stroke="#f59e0b"
              strokeWidth="1"
              strokeDasharray="3 3"
            />
            <text x="450" y="215" fill="#fcd34d" fontSize="10" textAnchor="middle" fontWeight="bold">
              30% Trough Volumetric Fill (CEMA Standard Class 30 Cake Bed)
            </text>

            {/* Center Shaft (Ø38 mm) */}
            <rect x="140" y="152" width="600" height="26" fill="url(#shaftGrad)" stroke="#cbd5e1" strokeWidth="1" rx="2" />
            <line x1="140" y1="165" x2="740" y2="165" stroke="#475569" strokeWidth="1" strokeDasharray="6 3" />

            {/* Helical Flights (10 turns spanning 520 px, ~52 px pitch) */}
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
              const startX = 200 + i * 50;
              return (
                <g key={i}>
                  {/* Front blade surface */}
                  <path
                    d={`M ${startX} 92 Q ${startX + 18} 165 ${startX + 35} 238 L ${startX + 45} 238 Q ${startX + 28} 165 ${startX + 10} 92 Z`}
                    fill="url(#flightGrad)"
                    stroke="#7dd3fc"
                    strokeWidth="1.2"
                  />
                  {/* Flight Pitch dimension tick on first pitch */}
                  {i === 1 && (
                    <g>
                      <line x1={startX} y1="70" x2={startX + 50} y2="70" stroke="#38bdf8" strokeWidth="1.5" />
                      <line x1={startX} y1="65" x2={startX} y2="75" stroke="#38bdf8" strokeWidth="1.5" />
                      <line x1={startX + 50} y1="65" x2={startX + 50} y2="75" stroke="#38bdf8" strokeWidth="1.5" />
                      <text x={startX + 25} y="62" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">
                        Pitch p = {pitch} mm (= D)
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Drive End Bearing Housing */}
            <rect x="165" y="135" width="25" height="60" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" rx="2" />
            <text x="177" y="128" fill="#94a3b8" fontSize="9" textAnchor="middle">Bearing</text>

            {/* Tail End Bearing Housing & Discharge Drop */}
            <rect x="710" y="135" width="25" height="60" fill="#334155" stroke="#94a3b8" strokeWidth="1.5" rx="2" />
            {/* Discharge Nozzle */}
            <path d="M 640 240 L 640 295 L 705 295 L 705 240 Z" fill="#1e293b" stroke="#10b981" strokeWidth="2" />
            <path d="M 630 295 L 715 295" stroke="#34d399" strokeWidth="3" />
            <text x="672" y="318" fill="#34d399" fontSize="10" textAnchor="middle" fontWeight="bold">
              Discharge to Flash Dryer Riser
            </text>

            {/* Electric Geared Motor on Drive End */}
            {/* Reduction Gearbox */}
            <rect x="95" y="130" width="70" height="70" fill="#1e293b" stroke="#3b82f6" strokeWidth="2" rx="4" />
            <text x="130" y="170" fill="#93c5fd" fontSize="9" textAnchor="middle" fontWeight="bold">Gearbox</text>
            <text x="130" y="182" fill="#60a5fa" fontSize="8" textAnchor="middle">i = 26:1</text>

            {/* Motor Casing with Cooling Fins */}
            <rect x="25" y="125" width="70" height="80" fill="url(#motorGrad)" stroke="#60a5fa" strokeWidth="2" rx="5" />
            {[0, 1, 2, 3, 4].map((j) => (
              <line key={j} x1={32 + j * 12} y1="125" x2={32 + j * 12} y2="205" stroke="#1d4ed8" strokeWidth="1.5" />
            ))}
            <rect x="40" y="112" width="35" height="13" fill="#1e40af" stroke="#93c5fd" strokeWidth="1" rx="2" />
            <text x="60" y="170" fill="#ffffff" fontSize="10" textAnchor="middle" fontWeight="bold">
              {screwFeederDesign.recommendedMotorPowerKW} kW
            </text>
            <text x="60" y="222" fill="#93c5fd" fontSize="9" textAnchor="middle">
              VFD (55 RPM)
            </text>

            {/* Overall Dimensions & Leader Lines */}
            {/* Conveyor Total Length L = 1000 mm */}
            <line x1="190" y1="265" x2="710" y2="265" stroke="#fcd34d" strokeWidth="1.5" />
            <line x1="190" y1="258" x2="190" y2="272" stroke="#fcd34d" strokeWidth="1.5" />
            <line x1="710" y1="258" x2="710" y2="272" stroke="#fcd34d" strokeWidth="1.5" />
            <text x="450" y="280" fill="#fcd34d" fontSize="11" textAnchor="middle" fontWeight="bold">
              Active Trough Conveying Length L = {L} mm ({screwFeederDesign.screwLengthM.toFixed(2)} m)
            </text>

            {/* Screw Diameter D = 100 mm (Vertical) */}
            <line x1="765" y1="90" x2="765" y2="240" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="758" y1="90" x2="772" y2="90" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="758" y1="240" x2="772" y2="240" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="780" y="170" fill="#38bdf8" fontSize="11" fontWeight="bold">
              Ø{D} mm (4")
            </text>
            <text x="780" y="185" fill="#94a3b8" fontSize="9">
              Shaft Ø{dShaft} mm
            </text>
          </svg>
        ) : (
          /* Transverse Cross-Section View showing 30% Trough Loading */
          <svg viewBox="0 0 500 360" className="w-full max-w-[500px] h-auto font-mono text-slate-300">
            <defs>
              <linearGradient id="troughWallGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#475569" />
                <stop offset="50%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <linearGradient id="mashFillBed2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#b45309" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            <rect width="500" height="360" fill="#020617" rx="8" />

            {/* Title */}
            <text x="250" y="32" fill="#38bdf8" fontSize="12" textAnchor="middle" fontWeight="bold">
              Transverse Cross-Section &amp; 30% Trough Loading (CEMA Class 30)
            </text>

            {/* Center X=250, Center Y=190 */}
            {/* Outer Trough Radius = 115 px, Inner Radius = 105 px */}
            {/* U-Trough Shape: Straight upper sides from Y=85 to Y=190, semicircular bottom from Y=190 to Y=295 */}
            <path
              d="M 135 85 L 135 190 A 115 115 0 0 0 365 190 L 365 85 L 380 85 L 380 190 A 130 130 0 0 1 120 190 L 120 85 Z"
              fill="url(#troughWallGrad)"
              stroke="#64748b"
              strokeWidth="1.5"
            />
            {/* Top Mounting Flange Lip */}
            <rect x="110" y="80" width="35" height="10" fill="#64748b" rx="1" />
            <rect x="355" y="80" width="35" height="10" fill="#64748b" rx="1" />

            {/* 30% Material Fill Line (height = 30% of total trough depth) */}
            {/* Semicircular bottom arc filled with cassava mash */}
            <path
              d="M 152 230 A 115 115 0 0 0 348 230 Z"
              fill="url(#mashFillBed2)"
              stroke="#f59e0b"
              strokeWidth="2"
            />
            <line x1="140" y1="230" x2="360" y2="230" stroke="#fcd34d" strokeWidth="1.5" strokeDasharray="4 3" />
            <text x="250" y="258" fill="#fef08a" fontSize="10" textAnchor="middle" fontWeight="bold">
              Dewatered Cassava Mash Bed (30% Load)
            </text>

            {/* Screw Outer Flight Circle (ØD = 100 mm = 210 px diameter, R = 105 px) */}
            <circle cx="250" cy="190" r="105" fill="none" stroke="#38bdf8" strokeWidth="2" strokeDasharray="5 3" />
            <text x="365" y="150" fill="#38bdf8" fontSize="10" fontWeight="bold">
              Flight Tip Ø{D} mm
            </text>

            {/* Radial Clearance between Flight Tip and Trough (5 mm) */}
            <line x1="250" y1="295" x2="250" y2="305" stroke="#f43f5e" strokeWidth="1.5" />
            <text x="250" y="322" fill="#fb7185" fontSize="9" textAnchor="middle">
              5 mm Radial Clearance
            </text>

            {/* Center Drive Shaft (Ø38 mm = 40 px diameter, R = 20 px) */}
            <circle cx="250" cy="190" r="24" fill="url(#shaftGrad)" stroke="#f8fafc" strokeWidth="2" />
            <circle cx="250" cy="190" r="3" fill="#0f172a" />
            <text x="250" y="194" fill="#0f172a" fontSize="8" textAnchor="middle" fontWeight="bold">Ø38</text>

            {/* Dimensions Callouts */}
            <line x1="135" y1="65" x2="365" y2="65" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="135" y1="60" x2="135" y2="70" stroke="#38bdf8" strokeWidth="1.5" />
            <line x1="365" y1="60" x2="365" y2="70" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="250" y="58" fill="#38bdf8" fontSize="11" textAnchor="middle" fontWeight="bold">
              Trough Width = {D + 10} mm (Ø{D} mm Auger)
            </text>

            {/* Material Properties Note */}
            <text x="250" y="348" fill="#94a3b8" fontSize="9" textAnchor="middle">
              Cassava Cake: &rho;b = {hopperDesign.bulkDensityKgM3} kg/m³ • Fm = {screwFeederDesign.materialFactorFm} • Trough Fill = {loading}%
            </text>
          </svg>
        )}
      </div>

      {/* Engineering Specs Matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Screw Geometry</span>
          <span className="text-sm font-bold text-sky-400 font-mono mt-0.5 block">
            Ø{D} mm × {L} mm
          </span>
          <span className="text-[10px] text-slate-400">Pitch p = {pitch} mm (Full)</span>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Trough Fill &amp; Volume</span>
          <span className="text-sm font-bold text-amber-400 font-mono mt-0.5 block">
            {loading}% Trough Loading
          </span>
          <span className="text-[10px] text-slate-400">CEMA Standard Class 30</span>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Operating Speed</span>
          <span className="text-sm font-bold text-emerald-400 font-mono mt-0.5 block">
            {screwFeederDesign.selectedRpm} RPM
          </span>
          <span className="text-[10px] text-slate-400">Req: {screwFeederDesign.theoreticalRpm.toFixed(1)} RPM (+{screwFeederDesign.capacityMarginPercent.toFixed(1)}%)</span>
        </div>

        <div className="bg-slate-800/80 p-3 rounded-lg border border-slate-700">
          <span className="text-[10px] text-slate-400 uppercase font-bold block">Drive Motor</span>
          <span className="text-sm font-bold text-white font-mono mt-0.5 block">
            {screwFeederDesign.recommendedMotorPowerKW} kW ({screwFeederDesign.recommendedMotorPowerHP.toFixed(1)} HP)
          </span>
          <span className="text-[10px] text-slate-400">VFD Geared Reducer (15-60 RPM)</span>
        </div>
      </div>
    </div>
  );
};
