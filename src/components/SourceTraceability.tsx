import React from 'react';
import {
  BookOpen,
  ExternalLink,
  CheckCircle2,
  GitCompare,
  Layers,
  Award,
  FileCheck
} from 'lucide-react';
import { REFERENCES, ReferenceItem } from '../utils/constants';

export const SourceTraceability: React.FC = () => {
  return (
    <div className="space-y-6">
      {/* Overview Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
        <div className="flex items-center gap-2.5">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <h3 className="text-base font-bold text-slate-900">
            Source Traceability &amp; Design Methodology Comparative Analysis
          </h3>
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          This calculator integrates three foundational scientific benchmarks in high-quality cassava flour (HQCF) flash drying technology.
          Below is a detailed matrix of design equations, empirical relationships, and design parameter correlations across the three reference sources.
        </p>
      </div>

      {/* The 3 Primary References Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REFERENCES.map((ref: ReferenceItem) => (
          <div key={ref.id} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col justify-between space-y-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                  {ref.year} Benchmark
                </span>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  Source Link <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <h4 className="text-xs font-bold text-slate-900 leading-snug">
                {ref.title}
              </h4>
              <p className="text-[11px] text-slate-500 font-medium">
                {ref.authors} • {ref.institution}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                {ref.description}
              </p>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-1 text-[11px]">
              <span className="font-semibold text-slate-700 block">Key Parameters Provided:</span>
              <ul className="list-disc list-inside text-slate-500 space-y-0.5">
                {ref.keyParameters.map((param: string, pIdx: number) => (
                  <li key={pIdx}>{param}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {/* Comparative Methodology Matrix Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-emerald-600" />
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-tight">
              Cross-Reference Methodology Comparison Matrix
            </h4>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">Methodology Reconciliation</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-100/70 text-slate-700 font-bold border-b border-slate-200 text-[11px]">
                <th className="p-3">Design Parameter / Step</th>
                <th className="p-3">1. CIRAD Pilot Report (Chapuis 2015)</th>
                <th className="p-3">2. Kuye et al. (IITA 2011/2017)</th>
                <th className="p-3">3. CIRAD Online Design Tool</th>
                <th className="p-3 text-emerald-800">Calculator Implementation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600">
              <tr>
                <td className="p-3 font-bold text-slate-800">Material Balance</td>
                <td className="p-3">Dry-basis and wet-basis balance with starch recovery factor ~98.5%</td>
                <td className="p-3">Standard conservation of mass for cassava press-cake (w1=40% → w2=12%)</td>
                <td className="p-3">Continuous mass balance module (dryer module 1)</td>
                <td className="p-3 text-emerald-800 font-semibold bg-emerald-50/20">
                  Rigorous dual-basis balance (F_wet·(1 - w1) = F_prod·(1 - w2)) with exact water evaporated M_w.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-800">Air-to-Solid Mass Ratio</td>
                <td className="p-3 font-semibold text-emerald-700">9.0 : 1 to 11.0 : 1 (Energy optimum)</td>
                <td className="p-3">Empirical high airflow ratio (~14.0 : 1 in field units)</td>
                <td className="p-3">User-specified target ratio with energy optimization curves</td>
                <td className="p-3 text-emerald-800 font-semibold bg-emerald-50/20">
                  Follows CIRAD 9.0–11.0:1 benchmark with automated diagnostic warnings when deviating.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-800">Pipe Length Threshold</td>
                <td className="p-3 font-semibold text-emerald-700">Minimum total developed length $L \ge 20$ m</td>
                <td className="p-3">Single vertical riser (10.5 m riser in 500 kg/h unit)</td>
                <td className="p-3">Minimum residence time 1.5s translated to length</td>
                <td className="p-3 text-emerald-800 font-semibold bg-emerald-50/20">
                  Enforces CIRAD $L \ge 20$m rule with U-bend loops when single riser would exceed structural height limits.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-800">Air Velocity in Riser</td>
                <td className="p-3">12 – 18 m/s (15 m/s measured benchmark)</td>
                <td className="p-3">14 – 16 m/s based on pneumatic conveying</td>
                <td className="p-3">Checked against terminal velocity v_t ≈ 1.2 m/s</td>
                <td className="p-3 text-emerald-800 font-semibold bg-emerald-50/20">
                  Design velocity selectable (default 15 m/s); checks v_air ≥ 2.5·v_saltation and terminal velocity.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-800">Cyclone Separator Sizing</td>
                <td className="p-3">Stairmand High-Efficiency model with $D_c \approx 400$ mm for 80 kg/h</td>
                <td className="p-3">Lapple standard cyclone proportions ($D_c = 750$ mm for 500 kg/h)</td>
                <td className="p-3">Dedicated cyclone module with cut-point $d_{50}$ prediction</td>
                <td className="p-3 text-emerald-800 font-semibold bg-emerald-50/20">
                  Selectable between Stairmand High-Efficiency and Lapple standard with complete 8-dimension schedule.
                </td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-800">Venturi Disintegration</td>
                <td className="p-3">Venturi throat (75% of main pipe dia) to disperse agglomerates</td>
                <td className="p-3">Hammer-mill / pin disintegrator upstream of feed chute</td>
                <td className="p-3">Disperser pressure drop included in system curve</td>
                <td className="p-3 text-emerald-800 font-semibold bg-emerald-50/20">
                  Models both high-speed pin disintegrator at screw exit and aerodynamic venturi acceleration (to ~25 m/s).
                </td>
              </tr>
              <tr>
                <td className="p-3 font-bold text-slate-800">Specific Energy Consumption</td>
                <td className="p-3">3,200 – 4,800 kJ/kg $H_2O$ removed</td>
                <td className="p-3">5,500 – 7,200 kJ/kg $H_2O$ (uninsulated field prototype)</td>
                <td className="p-3">Theoretical thermal duty + wall heat losses</td>
                <td className="p-3 text-emerald-800 font-semibold bg-emerald-50/20">
                  Accurate thermodynamic enthalpy balance including sensible heat of starch, evaporation latent heat, and lagging loss.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
