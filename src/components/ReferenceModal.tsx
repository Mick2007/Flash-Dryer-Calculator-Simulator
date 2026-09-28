import React from 'react';
import { X, BookOpen, ExternalLink, FileText, CheckCircle2 } from 'lucide-react';
import { REFERENCES, ReferenceItem } from '../utils/constants';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReferenceModal: React.FC<ReferenceModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-3xl w-full overflow-hidden my-8">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold">Research &amp; Engineering Design References</h3>
              <p className="text-xs text-slate-400">Primary literature used for calculations, equations, and benchmarks</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {REFERENCES.map((ref: ReferenceItem) => (
            <div key={ref.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/60 space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 uppercase">
                  {ref.institution} ({ref.year})
                </span>
                <a
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
                >
                  Open Original Document <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              <h4 className="text-sm font-bold text-slate-900">
                {ref.title}
              </h4>
              <p className="text-xs text-slate-500 font-medium">
                Authors: {ref.authors}
              </p>
              <p className="text-xs text-slate-700 leading-relaxed">
                {ref.description}
              </p>

              <div className="pt-2 border-t border-slate-200 text-xs">
                <span className="font-semibold text-slate-800 block mb-1">Empirical Parameters &amp; Contributions:</span>
                <ul className="list-disc list-inside text-slate-600 space-y-0.5 text-[11px]">
                  {ref.keyParameters.map((p: string, idx: number) => (
                    <li key={idx}>{p}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
