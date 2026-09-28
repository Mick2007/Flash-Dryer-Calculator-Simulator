import React, { useState } from 'react';
import {
  FileCode2,
  Download,
  X,
  CheckCircle2,
  Layers,
  Ruler,
  FileText,
  ExternalLink,
  Flame,
  Info
} from 'lucide-react';
import { CalculationResults } from '../types/dryer';
import { generateCadDxf, generateCadSvg, downloadCadFile } from '../utils/cadExport';

interface CadExportModalProps {
  results: CalculationResults;
  isOpen: boolean;
  onClose: () => void;
}

export const CadExportModal: React.FC<CadExportModalProps> = ({ results, isOpen, onClose }) => {
  const [selectedFormat, setSelectedFormat] = useState<'dxf' | 'svg'>('dxf');
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDownloadDxf = () => {
    const dxf = generateCadDxf(results);
    const filename = `Cassava_Flash_Dryer_${results.dimensions.tubeDiameterStandardMm}mm_${results.materialBalance.productRateKgH.toFixed(0)}kgh_REV1.dxf`;
    downloadCadFile(dxf, filename, 'application/dxf');
    setDownloadSuccess('AutoCAD DXF (.dxf) file exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  const handleDownloadSvg = () => {
    const svg = generateCadSvg(results);
    const filename = `Cassava_Flash_Dryer_CAD_Blueprint_${results.dimensions.tubeDiameterStandardMm}mm.svg`;
    downloadCadFile(svg, filename, 'image/svg+xml');
    setDownloadSuccess('Vector CAD Blueprint (.svg) file exported successfully!');
    setTimeout(() => setDownloadSuccess(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <FileCode2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Export Mechanical CAD Drawing</h2>
              <p className="text-xs text-slate-400">
                Generate 1:1 metric millimeter CAD drawings compliant with CIRAD &amp; IITA flash dryer engineering specifications
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Success Banner */}
          {downloadSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-900 font-semibold animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{downloadSuccess}</span>
            </div>
          )}

          {/* Format Selection Cards */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-2 uppercase tracking-wider">
              Select CAD Export Format
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* AutoCAD DXF */}
              <button
                type="button"
                onClick={() => setSelectedFormat('dxf')}
                className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                  selectedFormat === 'dxf'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-black bg-slate-900 text-white">DXF</span>
                    <span className="text-sm font-bold text-slate-900">AutoCAD Drawing Exchange</span>
                  </div>
                  {selectedFormat === 'dxf' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ASCII Release 12 / 2000 compliant format. Native support in <strong>AutoCAD, SolidWorks, Autodesk Fusion 360, LibreCAD, FreeCAD, and Rhino</strong>.
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-emerald-700">
                  <Ruler className="w-3.5 h-3.5" />
                  <span>1:1 Metric (1 unit = 1 millimeter)</span>
                </div>
              </button>

              {/* Vector SVG Blueprint */}
              <button
                type="button"
                onClick={() => setSelectedFormat('svg')}
                className={`p-4 rounded-xl border-2 text-left transition-all relative ${
                  selectedFormat === 'svg'
                    ? 'border-emerald-600 bg-emerald-50/40 ring-1 ring-emerald-500'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-black bg-sky-700 text-white">SVG</span>
                    <span className="text-sm font-bold text-slate-900">Technical CAD Blueprint</span>
                  </div>
                  {selectedFormat === 'svg' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Full vector engineering drawing sheet complete with ISO 7200 title block, dimensional callouts, component tags, and grid coordinates.
                </p>
                <div className="mt-2.5 flex items-center gap-2 text-[11px] font-semibold text-sky-700">
                  <FileText className="w-3.5 h-3.5" />
                  <span>Open in Inkscape, Illustrator, or browser</span>
                </div>
              </button>
            </div>
          </div>

          {/* Drawing Specifications Box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-tight flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-slate-600" />
                <span>Generated CAD Layers &amp; Specifications</span>
              </span>
              <span className="text-[11px] font-semibold text-slate-500">ISO Standard Metric</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">FLASH PIPE RISER</span>
                <span className="font-bold text-slate-800">
                  Ø{results.dimensions.tubeDiameterStandardMm} mm × {results.dimensions.verticalColumnHeightM.toFixed(1)} m
                </span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">CYCLONE SEPARATOR</span>
                <span className="font-bold text-slate-800">
                  Ø{results.dimensions.cycloneDiameterMm} mm (H = {results.dimensions.cycloneTotalHeightMm} mm)
                </span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">VENTURI THROAT</span>
                <span className="font-bold text-slate-800">Ø{results.dimensions.venturiThroatDiameterMm} mm</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">HEAT EXCHANGER</span>
                <span className="font-bold text-amber-700 flex items-center gap-1">
                  <Flame className="w-3 h-3 text-amber-600" />
                  {results.heatExchanger.numberOfPasses} Passes ({results.heatExchanger.surfaceAreaM2.toFixed(1)} m²)
                </span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">TOTAL DEVELOPED LENGTH</span>
                <span className="font-bold text-slate-800">{results.dimensions.totalPipeLengthM.toFixed(1)} meters</span>
              </div>
              <div className="p-2 bg-white rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-semibold">BLOWER FAN</span>
                <span className="font-bold text-slate-800">
                  {results.dimensions.fanMotorPowerKW.toFixed(1)} kW @ {results.dimensions.fanTotalPressureDropPa} Pa
                </span>
              </div>
            </div>

            {/* CAD Layer Table */}
            <div className="pt-2">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                CAD Layer Organization (1:1 Modeling Coordinates):
              </span>
              <div className="flex flex-wrap gap-1.5">
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-cyan-100 text-cyan-800 border border-cyan-200">
                  EQUIPMENT (Cyan, 0.50mm)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  DUCTWORK (Green, 0.35mm)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-800 border border-rose-200">
                  HEAT_EXCHANGER (Red, 0.35mm)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-fuchsia-100 text-fuchsia-800 border border-fuchsia-200">
                  CYCLONE (Magenta, 0.50mm)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  DIMENSIONS (Yellow, 0.25mm)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-800 border border-slate-300">
                  STRUCTURAL_FRAME (Gray, 0.35mm)
                </span>
              </div>
            </div>
          </div>

          {/* Reference Notice */}
          <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-amber-50/70 border border-amber-200 p-3 rounded-xl">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-900 font-semibold mb-0.5">Fabrication &amp; Drafting Notice</p>
              <p className="text-amber-800 text-[11px] leading-relaxed">
                Drawings are preliminary engineering General Arrangements (GA). For full workshop fabrication, integrate with local flange standards, nozzle schedules, thermal lagging thicknesses, and site foundation requirements. Reference: CIRAD Flash Dryer Design Tools (
                <a
                  href="https://flashdryer.cirad.fr/design-tools"
                  target="_blank"
                  rel="noreferrer"
                  className="underline hover:text-amber-950 font-bold"
                >
                  https://flashdryer.cirad.fr/design-tools
                </a>
                ).
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            Close
          </button>

          <div className="flex items-center gap-2">
            {selectedFormat === 'dxf' ? (
              <button
                type="button"
                onClick={handleDownloadDxf}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
              >
                <Download className="w-4 h-4" />
                <span>Download AutoCAD Drawing (.DXF)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDownloadSvg}
                className="flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm hover:shadow"
              >
                <Download className="w-4 h-4" />
                <span>Download Vector Blueprint (.SVG)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
