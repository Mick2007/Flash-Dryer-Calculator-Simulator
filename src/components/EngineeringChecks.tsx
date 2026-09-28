import React from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Info,
  HelpCircle,
  Network
} from 'lucide-react';
import { CalculationResults, EngineeringCheck, ValidationStatus } from '../types/dryer';

interface EngineeringChecksProps {
  results: CalculationResults;
  onAdjustInput?: () => void;
}

export const EngineeringChecks: React.FC<EngineeringChecksProps> = ({ results }) => {
  const { checks } = results;

  // Determine effective status for each check
  const getStatus = (chk: EngineeringCheck): ValidationStatus => {
    if (chk.status) return chk.status;
    if (chk.severity === 'danger') return 'INVALID';
    if (chk.severity === 'warning') return 'WARNING';
    if (chk.severity === 'info') return 'NEEDS REVIEW';
    return 'VALID';
  };

  const invalidCount = checks.filter((c) => getStatus(c) === 'INVALID').length;
  const warningCount = checks.filter((c) => getStatus(c) === 'WARNING').length;
  const needsReviewCount = checks.filter((c) => getStatus(c) === 'NEEDS REVIEW').length;
  const validCount = checks.filter((c) => getStatus(c) === 'VALID').length;
  const attentionCount = invalidCount + warningCount;

  const getCardStyle = (status: ValidationStatus) => {
    switch (status) {
      case 'INVALID':
        return {
          card: 'bg-oxide-wash border-oxide/40',
          badge: 'bg-oxide text-paper border-oxide',
          icon: <ShieldAlert className="w-4 h-4 text-oxide shrink-0" aria-hidden="true" />,
          label: 'Invalid',
        };
      case 'WARNING':
        return {
          card: 'bg-oxide-wash/50 border-oxide/30',
          badge: 'bg-oxide/15 text-oxide border-oxide/40',
          icon: <AlertTriangle className="w-4 h-4 text-oxide shrink-0" aria-hidden="true" />,
          label: 'Warning',
        };
      case 'NEEDS REVIEW':
        return {
          card: 'bg-paper-raised border-rule-strong',
          badge: 'bg-advisory/15 text-advisory border-advisory/40',
          icon: <Info className="w-4 h-4 text-advisory shrink-0" aria-hidden="true" />,
          label: 'Review',
        };
      case 'VALID':
      default:
        return {
          card: 'bg-paper-raised border-rule',
          badge: 'bg-verdigris-wash text-verdigris border-verdigris/40',
          icon: <CheckCircle2 className="w-4 h-4 text-verdigris shrink-0" aria-hidden="true" />,
          label: 'Pass',
        };
    }
  };

  // Faults first. The user needs to know what is wrong before what is right.
  const STATUS_ORDER: Record<string, number> = { INVALID: 0, WARNING: 1, 'NEEDS REVIEW': 2, VALID: 3 };
  const orderedChecks = [...checks].sort(
    (a, b) => (STATUS_ORDER[getStatus(a)] ?? 9) - (STATUS_ORDER[getStatus(b)] ?? 9)
  );

  return (
    <div className="space-y-5">
      {/* Ledger header. Counted, not badged. */}
      <div className="rule-b pb-3">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <h2 className="text-[15px] font-semibold text-graphite">
            Validation against design thresholds
          </h2>
          <div className="flex items-center gap-4 text-[12px]">
            {invalidCount > 0 && (
              <span className="text-oxide"><span className="qty font-semibold">{invalidCount}</span> invalid</span>
            )}
            {warningCount > 0 && (
              <span className="text-oxide"><span className="qty font-semibold">{warningCount}</span> warning</span>
            )}
            {needsReviewCount > 0 && (
              <span className="text-advisory"><span className="qty font-semibold">{needsReviewCount}</span> review</span>
            )}
            <span className="text-verdigris"><span className="qty font-semibold">{validCount}</span> pass</span>
          </div>
        </div>
        <p className="text-[12px] leading-relaxed text-graphite-soft mt-1 max-w-[70ch]">
          Every threshold traces to Chapuis (CIRAD, 2015), Kuye et al. (IITA, 2011) or an AMCA/CEMA
          standard. Worst first — anything marked invalid should be resolved before steel is cut.
        </p>
      </div>

      {/* Cards. Sans-serif throughout: these are scanned, not read. */}
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {orderedChecks.map((chk, idx) => {
          const status = getStatus(chk);
          const s = getCardStyle(status);

          return (
            <li
              key={chk.id || idx}
              className={`border ${s.card} p-3.5 flex flex-col font-sans`}
            >
              <div className="flex items-start justify-between gap-2.5 mb-1.5">
                <div className="flex items-start gap-2 min-w-0">
                  {s.icon}
                  <div className="min-w-0">
                    <h3 className="text-[13px] font-semibold text-graphite leading-snug">{chk.title}</h3>
                    <span className="text-[10px] uppercase tracking-wider text-graphite-faint">
                      {chk.category} rule
                    </span>
                  </div>
                </div>

                <span className={`text-[9px] font-semibold px-1.5 py-0.5 uppercase tracking-wider border shrink-0 ${s.badge}`}>
                  {s.label}
                </span>
              </div>

              <p className="text-[12.5px] leading-relaxed text-graphite-soft flex-1">{chk.message}</p>

              <div className="mt-2.5 pt-2 rule-t grid grid-cols-2 gap-2 text-[11px]">
                <div>
                  <div className="text-graphite-faint">Measured</div>
                  <div className="qty text-graphite">{chk.currentValue}</div>
                </div>
                <div>
                  <div className="text-graphite-faint">Target</div>
                  <div className="qty text-brass">{chk.recommendedRange}</div>
                </div>
              </div>

              {chk.source && (
                <p className="text-[10.5px] text-graphite-faint opacity-75 mt-2 leading-snug">
                  {chk.source}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};
