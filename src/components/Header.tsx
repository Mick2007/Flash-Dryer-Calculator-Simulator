import React from 'react';
import {
  FileText,
  Printer,
  RotateCcw,
  BookOpen,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  FileCode2,
  Download,
  Scale,
  ArrowRightLeft,
  Info
} from 'lucide-react';
import { PRESET_CAPACITIES, PresetOption } from '../utils/constants';
import { CalculationResults, CapacityPreset, UnitSystem } from '../types/dryer';
import { summariseChecks } from '../utils/checkSummary';

interface HeaderProps {
  currentPreset: CapacityPreset;
  onSelectPreset: (preset: PresetOption) => void;
  onResetBenchmark: () => void;
  onGeneratePdf: () => void;
  onOpenPrintableReport: () => void;
  onOpenCadExport: () => void;
  onOpenReferences: () => void;
  onOpenUnitConverter?: () => void;
  unitSystem?: UnitSystem;
  onUnitSystemChange?: (system: UnitSystem) => void;
  results: CalculationResults;
}

export const Header: React.FC<HeaderProps> = ({
  currentPreset,
  onSelectPreset,
  onResetBenchmark,
  onGeneratePdf,
  onOpenPrintableReport,
  onOpenCadExport,
  onOpenReferences,
  onOpenUnitConverter,
  unitSystem = 'metric',
  onUnitSystemChange,
  results,
}) => {
  // ITEM 26: counts come from the shared selector, so this masthead and the
  // verdict banner on the dashboard cannot state different things about the same
  // design. The three counts were previously derived here independently.
  const { danger: dangerCount, warning: warningCount, info: infoCount } = summariseChecks(results.checks);

  return (
    <header className="bg-graphite text-paper border-b-2 border-brass">
      {/* Masthead: identity on the left, the user's actual question answered on the right. */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="font-mono text-[11px] text-brass-bright tracking-widest shrink-0">FD</span>
            <h1 className="text-[15px] sm:text-base font-semibold tracking-tight text-paper leading-tight">
              Cassava Flash Dryer <span className="text-graphite-faint font-normal">·</span> Dimension Worksheet
            </h1>
          </div>
          <p className="text-[11px] text-graphite-faint mt-1 leading-snug">
            HQCF design engine. Method after Chapuis (CIRAD, 2015) and Kuye et al. (IITA, 2011).
          </p>
        </div>

        {/* The governing figure — a running readout, not a hero stat block. */}
        <div className="flex items-end gap-5 shrink-0">
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Dry solids</div>
            <div className="qty text-lg text-brass-bright leading-none mt-0.5">
              {results.materialBalance.drySolidsKgH.toFixed(0)}
              <span className="text-[11px] text-graphite-faint ml-1">kg/h</span>
            </div>
          </div>
          <div className="text-right rule-l pl-5">
            <div className="text-[10px] uppercase tracking-widest text-graphite-faint">Flour</div>
            <div className="qty text-lg text-paper leading-none mt-0.5">
              {results.materialBalance.productRateKgH.toFixed(0)}
              <span className="text-[11px] text-graphite-faint ml-1">kg/h</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action bar: quieter surface than the masthead, separated by a rule not a shadow. */}
      <div className="border-t border-graphite-soft/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center flex-wrap gap-2">
          {/* Unit System Global Switcher */}
          {onUnitSystemChange && (
            <div
              role="group"
              aria-label="Unit system"
              className="inline-flex border border-graphite-soft/50 text-[11px] font-medium"
            >
              {(['metric', 'tonne', 'imperial'] as const).map((unit) => (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={unitSystem === unit}
                  onClick={() => onUnitSystemChange(unit)}
                  className={`px-2 py-1 transition-colors ${
                    unitSystem === unit
                      ? 'bg-brass text-graphite font-semibold'
                      : 'text-graphite-faint hover:text-paper'
                  }`}
                  title={
                    unit === 'metric'
                      ? 'Standard metric units (kg/h, mm, m, kW, Pa, °C)'
                      : unit === 'tonne'
                        ? 'Industrial tonne units (t/h, t/day, mm, m, kW, kPa)'
                        : 'Imperial units (lb/h, US ton/day, inches, feet, CFM, hp, in.wg, °F)'
                  }
                >
                  {unit === 'metric' ? 'Metric' : unit === 'tonne' ? 'Tonne' : 'Imperial'}
                </button>
              ))}
            </div>
          )}

          {onOpenUnitConverter && (
            <button
              type="button"
              onClick={onOpenUnitConverter}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-graphite-faint hover:text-brass-bright transition-colors"
              title="Open the engineering unit converter"
            >
              <ArrowRightLeft className="w-3 h-3" aria-hidden="true" />
              <span>Convert units</span>
            </button>
          )}

          {/* Design verdict. Colour carries state only. */}
          <div className="ml-auto flex items-center gap-2 text-[11px] font-medium">
            {dangerCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-oxide">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="qty font-semibold">{dangerCount}</span> hazard{dangerCount > 1 ? 's' : ''} — do not fabricate
              </span>
            ) : warningCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-oxide">
                <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="qty font-semibold">{warningCount}</span> limit{warningCount > 1 ? 's' : ''} exceeded
              </span>
            ) : infoCount > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-advisory">
                <Info className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="qty font-semibold">{infoCount}</span> for review
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-verdigris">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                Within CIRAD limits
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onOpenReferences}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-graphite-faint hover:text-brass-bright transition-colors"
            title="View citations and primary research references"
          >
            <BookOpen className="w-3 h-3" aria-hidden="true" />
            <span>Sources</span>
          </button>

          <button
            type="button"
            onClick={onResetBenchmark}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-graphite-faint hover:text-brass-bright transition-colors"
            title="Reset to the validated CIRAD 80 kg/h pilot plant benchmark"
          >
            <RotateCcw className="w-3 h-3" aria-hidden="true" />
            <span>CIRAD benchmark</span>
          </button>

          <button
            type="button"
            onClick={onOpenCadExport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-graphite-faint hover:text-brass-bright transition-colors"
            title="Export 1:1 metric mechanical drawings as AutoCAD DXF or vector SVG"
          >
            <FileCode2 className="w-3 h-3" aria-hidden="true" />
            <span>CAD</span>
          </button>

          {/* The one primary action. Brass, not emerald. */}
          <button
            type="button"
            onClick={onOpenPrintableReport}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold bg-brass text-graphite hover:bg-brass-bright transition-colors"
            title="Open the engineering sizing dossier — print to PDF or download"
          >
            <FileText className="w-3 h-3" aria-hidden="true" />
            <span>Report</span>
          </button>
        </div>
      </div>

      {/* Preset capacities — a scale, not a row of buttons. */}
      <div className="bg-graphite-soft/25 border-t border-graphite-soft/30 px-4 sm:px-6 lg:px-8 py-1.5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-3 text-[11px]">
          <span className="text-graphite-faint shrink-0 sm:w-32">Throughput preset</span>
          <div role="group" aria-label="Throughput preset" className="flex items-center flex-wrap gap-px">
            {PRESET_CAPACITIES.map((preset) => {
              const isSelected = currentPreset === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelectPreset(preset)}
                  className={`qty px-2 py-0.5 transition-colors ${
                    isSelected
                      ? 'bg-brass text-graphite font-semibold'
                      : 'text-graphite-faint hover:text-paper border border-graphite-soft/40'
                  }`}
                  title={`${preset.category} — ${preset.description}`}
                >
                  {preset.label.replace(' Wet Feed', '').replace(' kg/h', '')}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={currentPreset === 'custom'}
              onClick={() => onSelectPreset({ value: results.materialBalance.productRateKgH, label: 'Custom', description: 'User defined capacity', category: 'Small-scale Commercial' })}
              className={`px-2 py-0.5 transition-colors ${
                currentPreset === 'custom'
                  ? 'bg-brass text-graphite font-semibold'
                  : 'text-graphite-faint hover:text-paper border border-graphite-soft/40'
              }`}
            >
              custom
            </button>
          </div>
          <span className="text-graphite-faint hidden lg:inline">kg/h wet feed</span>
        </div>
      </div>
    </header>
  );
};
