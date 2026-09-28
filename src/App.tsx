import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  Eye,
  Ruler,
  Layers,
  Calculator,
  ShieldCheck,
  GitCompare,
  FileText,
  CheckCircle2,
  Download,
  Sparkles,
  Info
} from 'lucide-react';

import { Header } from './components/Header';
import { InputPanel } from './components/InputPanel';
import { SummaryDashboard } from './components/SummaryDashboard';
import { DryerVisualizer } from './components/DryerVisualizer';
import { DimensionCalculator } from './components/DimensionCalculator';
import { CalculationSteps } from './components/CalculationSteps';
import { EngineeringChecks } from './components/EngineeringChecks';
import { SourceTraceability } from './components/SourceTraceability';
import { ReferenceModal } from './components/ReferenceModal';
import { CadExportModal } from './components/CadExportModal';
import { PrintableReportModal } from './components/PrintableReportModal';
import { DesignComparison } from './components/DesignComparison';
import { UnitConverterModal } from './components/UnitConverterModal';
import { DevelopedLengthCalculator } from './components/DevelopedLengthCalculator';
import { HopperScrewFeederCalculator } from './components/HopperScrewFeederCalculator';

import { DryerInputs, CapacityPreset, UnitSystem, CalculationResults } from './types/dryer';
import { DEFAULT_DRYER_INPUTS, CIRAD_PILOT_BENCHMARK, IITA_REFERENCE_BENCHMARK, PresetOption } from './utils/constants';
import { calculateFlashDryer } from './utils/dryerCalculations';
import { generateEngineeringPdf } from './utils/pdfGenerator';

export default function App() {
  const [inputs, setInputs] = useState<DryerInputs>(DEFAULT_DRYER_INPUTS);
  const [currentPreset, setCurrentPreset] = useState<CapacityPreset>(820);
  const [unitSystem, setUnitSystem] = useState<UnitSystem>('metric');
  const [activeTab, setActiveTab] = useState<'visualizer' | 'hopper-feeder' | 'tube-length' | 'dimensions' | 'derivations' | 'checks' | 'comparison' | 'traceability'>('visualizer');
  const [isReferenceModalOpen, setIsReferenceModalOpen] = useState(false);
  const [isCadModalOpen, setIsCadModalOpen] = useState(false);
  const [isPrintableReportOpen, setIsPrintableReportOpen] = useState(false);
  const [isUnitConverterOpen, setIsUnitConverterOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Mirrors capacityMode so the preset handler can name the basis it applied
  // without taking capacityMode as a dependency (which would rebuild the callback
  // on every keystroke). Declared before the callbacks that read it.
  const capacityModeRef = useRef(inputs.capacityMode);
  useEffect(() => {
    capacityModeRef.current = inputs.capacityMode;
  }, [inputs.capacityMode]);

  // Trigger calculation whenever inputs change
  const results = useMemo(() => {
    return calculateFlashDryer(inputs);
  }, [inputs]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Preset Selector
  const handleSelectPreset = useCallback((preset: PresetOption | { value: any; label: string }) => {
    if (preset.value === 'custom') {
      setCurrentPreset('custom');
      return;
    }

    const val = typeof preset.value === 'number' ? preset.value : 80;
    setCurrentPreset(val as CapacityPreset);

    setInputs((prev) => {
      if (prev.capacityMode === 'product') {
        // The preset value is a WET FEED throughput, but this mode sizes from dry
        // product output. Previously the raw preset number was written straight into
        // desiredProductRate, so "820 kg/h Wet Feed" silently became 820 kg/h of dry
        // flour — roughly 1.47x the intended plant capacity. Convert properly.
        const drySolidsFraction = (100 - prev.finalMoisture) / 100;
        const productRate = drySolidsFraction > 0.05 ? Math.round(val * drySolidsFraction) : val;
        return {
          ...prev,
          desiredProductRate: productRate,
        };
      } else {
        // Feed mode: the preset value IS the wet feed rate, so it maps directly.
        return {
          ...prev,
          feedRate: val,
        };
      }
    });

    showToast(
      capacityModeRef.current === 'product'
        ? `Loaded ${val} kg/h wet feed, converted to dry product target`
        : `Loaded ${val} kg/h wet feed preset`
    );
  }, []);

  // Reset to CIRAD Benchmark (80 kg/h Pilot Plant)
  const handleResetBenchmark = useCallback(() => {
    setInputs({
      ...DEFAULT_DRYER_INPUTS,
      desiredProductRate: CIRAD_PILOT_BENCHMARK.desiredProductRate,
      initialMoisture: CIRAD_PILOT_BENCHMARK.initialMoisture,
      finalMoisture: CIRAD_PILOT_BENCHMARK.finalMoisture,
      inletAirTemp: CIRAD_PILOT_BENCHMARK.inletAirTemp,
      outletAirTemp: CIRAD_PILOT_BENCHMARK.outletAirTemp,
      airVelocity: CIRAD_PILOT_BENCHMARK.airVelocity,
      cycloneType: 'stairmand',
      methodology: 'cirad',
    });
    setCurrentPreset(80);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.2 },
    });

    showToast('Reset to CIRAD 80 kg/h Experimental Pilot Benchmark');
  }, []);

  // Reset to IITA / RMRDC Benchmark (820 kg/h Wet Feed Worked Example)
  const handleResetIitaReference = useCallback(() => {
    setInputs(IITA_REFERENCE_BENCHMARK);
    setCurrentPreset(820);

    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.2 },
    });

    showToast('Reset to IITA / RMRDC 820 kg/h Reference Design Benchmark');
  }, []);

  // PDF Export
  const handleExportPdf = useCallback(() => {
    try {
      const doc = generateEngineeringPdf(results);
      const filename = `Cassava_Flash_Dryer_Design_${results.materialBalance.productRateKgH.toFixed(0)}kg_h.pdf`;
      doc.save(filename);
      showToast(`Engineering calculation dossier exported: ${filename}`);
    } catch (err) {
      console.error('PDF Generation error:', err);
      showToast('Error generating PDF report. Please try again.');
    }
  }, [results]);

  // Workspace definitions. One array drives the tablist, so a tab label can never
  // drift from the panel it controls, and the union type comes from the data.
  const WORKSPACES = [
    { id: 'visualizer' as const, icon: '◲', label: () => 'Simulator & 3D model', flag: () => false, flagTone: 'ok' as const },
    {
      id: 'hopper-feeder' as const, icon: '⊼',
      label: (r: CalculationResults) => `Hopper & screw feeder (${(r.hopperDesign.totalGeometricVolumeM3 * 1000).toFixed(0)} L)`,
      flag: () => false, flagTone: 'ok' as const,
    },
    {
      id: 'tube-length' as const, icon: '⊟',
      label: (r: CalculationResults) => `Tube developed length (${r.dimensions.totalPipeLengthM.toFixed(1)} m)`,
      flag: (r: CalculationResults) => r.dimensions.totalPipeLengthM < 20.0,
      flagTone: 'fault' as const,
    },
    { id: 'dimensions' as const, icon: '⊞', label: () => 'Dimensions & fabrication', flag: () => false, flagTone: 'ok' as const },
    {
      id: 'derivations' as const, icon: '≡',
      label: (r: CalculationResults) => `Derivations (${r.steps.length})`,
      flag: () => false, flagTone: 'ok' as const,
    },
    { id: 'comparison' as const, icon: '⇄', label: () => 'Scenario comparison', flag: () => false, flagTone: 'ok' as const },
    {
      id: 'checks' as const, icon: '✓',
      label: (r: CalculationResults) =>
        r.checks.some((c) => c.severity === 'danger') || r.checks.some((c) => c.severity === 'warning')
          ? `Validation checks (${r.checks.filter((c) => c.severity === 'danger' || c.severity === 'warning').length})`
          : 'Validation checks',
      flag: (r: CalculationResults) => r.checks.some((c) => c.severity === 'danger' || c.severity === 'warning'),
      flagTone: 'fault' as const,
    },
    { id: 'traceability' as const, icon: '§', label: () => 'Source traceability', flag: () => false, flagTone: 'ok' as const },
  ];

  return (
    <div className="min-h-screen bg-paper text-graphite font-sans flex flex-col">
      {/* Toast — announced, since it confirms an action the user took. */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 bg-graphite text-paper px-3.5 py-2 text-xs font-medium flex items-center gap-2 border-l-2 border-brass"
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-brass-bright" aria-hidden="true" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main App Header */}
      <Header
        currentPreset={currentPreset}
        onSelectPreset={handleSelectPreset}
        onResetBenchmark={handleResetBenchmark}
        onGeneratePdf={handleExportPdf}
        onOpenPrintableReport={() => setIsPrintableReportOpen(true)}
        onOpenCadExport={() => setIsCadModalOpen(true)}
        onOpenReferences={() => setIsReferenceModalOpen(true)}
        onOpenUnitConverter={() => setIsUnitConverterOpen(true)}
        unitSystem={unitSystem}
        onUnitSystemChange={setUnitSystem}
        results={results}
      />

      {/* Primary Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Top Summary & Real-time KPI Dashboard */}
        <SummaryDashboard
          results={results}
          onOpenChecks={() => setActiveTab('checks')}
          unitSystem={unitSystem}
          onSelectPressureType={(type) => {
            setInputs((prev) => ({ ...prev, pressureSystemType: type }));
            showToast(`Draft regime updated to ${type.toUpperCase()} pressure`);
          }}
        />

        {/* User Input & Operating Parameters Panel */}
        <InputPanel
          inputs={inputs}
          onChange={(newInputs) => {
            setInputs(newInputs);
            setCurrentPreset('custom');
          }}
          onOpenUnitConverter={() => setIsUnitConverterOpen(true)}
        />

        {/* Tabbed Engineering Workspaces */}
        <div className="space-y-4">
          {/* Workspace tabs. A real ARIA tablist: keyboard reachable, arrow-navigable,
              and driven from one data array so the label and the panel cannot drift. */}
          <div
            role="tablist"
            aria-label="Engineering workspaces"
            className="flex rule-b overflow-x-auto"
            onKeyDown={(e) => {
              const idx = WORKSPACES.findIndex((w) => w.id === activeTab);
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                e.preventDefault();
                const next = (idx + (e.key === 'ArrowRight' ? 1 : -1) + WORKSPACES.length) % WORKSPACES.length;
                setActiveTab(WORKSPACES[next].id);
                document.getElementById(`ws-tab-${WORKSPACES[next].id}`)?.focus();
              }
            }}
          >
            {WORKSPACES.map((w) => {
              const selected = activeTab === w.id;
              return (
                <button
                  key={w.id}
                  id={`ws-tab-${w.id}`}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  aria-controls={`ws-panel-${w.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveTab(w.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 text-[12px] whitespace-nowrap transition-colors border-b-2 -mb-px ${
                    selected
                      ? 'border-brass text-graphite font-semibold'
                      : 'border-transparent text-graphite-soft hover:text-graphite hover:border-rule-strong'
                  }`}
                >
                  <span className="text-graphite-faint" aria-hidden="true">{w.icon}</span>
                  <span>{w.label(results)}</span>
                  {w.flag(results) && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        w.flagTone === 'fault' ? 'bg-oxide' : w.flagTone === 'ok' ? 'bg-verdigris' : 'bg-advisory'
                      }`}
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Active Workspace View */}
          <div role="tabpanel" id={`ws-panel-${activeTab}`} aria-labelledby={`ws-tab-${activeTab}`}>
            {activeTab === 'visualizer' && (
              <DryerVisualizer
                results={results}
                onSelectPressureType={(type) => {
                  setInputs((prev) => ({ ...prev, pressureSystemType: type }));
                  showToast(`Draft regime updated to ${type.toUpperCase()} pressure`);
                }}
              />
            )}

            {activeTab === 'hopper-feeder' && (
              <HopperScrewFeederCalculator
                results={results}
                inputs={inputs}
                onUpdateInputs={(updated) => {
                  setInputs((prev) => ({ ...prev, ...updated }));
                  setCurrentPreset('custom');
                  showToast('Hopper & Screw Feeder parameters updated');
                }}
                onResetToIitaReference={handleResetIitaReference}
              />
            )}

            {activeTab === 'tube-length' && (
              <DevelopedLengthCalculator
                results={results}
                onUpdateInputs={(updated) => {
                  setInputs((prev) => ({ ...prev, ...updated }));
                  setCurrentPreset('custom');
                  showToast('Flash tube developed length & routing updated');
                }}
                onNavigateTo3D={() => setActiveTab('visualizer')}
              />
            )}

            {activeTab === 'dimensions' && (
              <DimensionCalculator
                results={results}
                onExportPdf={handleExportPdf}
                onOpenDevelopedLength={() => setActiveTab('tube-length')}
                onOpenHopperScrew={() => setActiveTab('hopper-feeder')}
              />
            )}

            {activeTab === 'derivations' && (
              <CalculationSteps results={results} />
            )}

            {activeTab === 'comparison' && (
              <DesignComparison
                currentResults={results}
                onApplyScenarioToActive={(scenarioInputs) => {
                  setInputs(scenarioInputs);
                  setCurrentPreset('custom');
                  showToast('Loaded comparison scenario into active simulator');
                }}
                unitSystem={unitSystem}
                onUnitSystemChange={setUnitSystem}
              />
            )}

            {activeTab === 'checks' && (
              <EngineeringChecks
                results={results}
                onAdjustInput={() => window.scrollTo({ top: 180, behavior: 'smooth' })}
              />
            )}

            {activeTab === 'traceability' && (
              <SourceTraceability />
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-graphite text-graphite-faint text-[11px] mt-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col md:flex-row md:items-baseline justify-between gap-2">
          <div className="space-y-0.5">
            <p className="text-paper font-semibold text-xs">
              Cassava Flash Dryer <span className="text-graphite-faint font-normal">·</span> Dimension Worksheet
            </p>
            <p className="opacity-70">
              Preliminary mechanical engineering design. Method after Chapuis (CIRAD, 2015) and Kuye et al. (IITA, 2011).
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsReferenceModalOpen(true)}
              className="hover:text-brass-bright transition-colors"
            >
              Sources
            </button>
            <button
              type="button"
              onClick={handleExportPdf}
              className="hover:text-brass-bright transition-colors"
            >
              PDF dossier
            </button>
          </div>
        </div>
      </footer>

      {/* Reference Modal */}
      <ReferenceModal
        isOpen={isReferenceModalOpen}
        onClose={() => setIsReferenceModalOpen(false)}
      />

      {/* CAD Export Modal */}
      <CadExportModal
        results={results}
        isOpen={isCadModalOpen}
        onClose={() => setIsCadModalOpen(false)}
      />

      {/* Printable Engineering Report Modal */}
      <PrintableReportModal
        results={results}
        isOpen={isPrintableReportOpen}
        onClose={() => setIsPrintableReportOpen(false)}
      />

      {/* Unit Converter Modal */}
      <UnitConverterModal
        isOpen={isUnitConverterOpen}
        onClose={() => setIsUnitConverterOpen(false)}
      />
    </div>
  );
};
