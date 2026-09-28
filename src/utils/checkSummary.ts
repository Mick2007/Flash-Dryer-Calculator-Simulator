import type { ValidationCheck } from '../types/dryer';

/**
 * Single source of truth for how the engineering checks are counted and described.
 *
 * ITEM 26. The verdict banner and the header each counted the checks
 * independently and disagreed, so the page could say "All engineering checks
 * pass" directly above "1 for review". Both were defensible from their own code:
 *
 *   SummaryDashboard counted `danger` OR `warning` as "critical" and, on finding
 *   none, printed an unconditional all-clear. A check of severity `info` —
 *   which is exactly how the air-to-starch ratio reports "above benchmark, needs
 *   review" — was invisible to it, so it claimed all-clear while the header,
 *   which did count `info`, showed an outstanding item.
 *
 *   The fix is not to adjust either count, because both were locally reasonable
 *   and the same mistake would recur. It is to have ONE function decide, so the
 *   two components cannot disagree.
 *
 * The three bands, and what each one means:
 *
 *   danger    a hazard. Something is wrong with the design as specified.
 *   warning   a limit exceeded. The design is not compliant, or is marginal.
 *   info      needs review. Nothing has failed, but a human should look. A
 *             benchmark was validated under conditions this design does not meet,
 *             or a value sits outside a normal band without being impossible.
 *
 * "All engineering checks pass" is therefore shown only when all three are zero.
 * A design with outstanding review items says so, because telling an engineer
 * everything passes when something needs their attention is the failure mode that
 * matters most here.
 */
export interface CheckCounts {
  danger: number;
  warning: number;
  info: number;
  total: number;
  /** True only when danger, warning AND info are all zero. */
  allPass: boolean;
  /** The most serious outstanding check, if any. Drives what the banner quotes. */
  firstOutstanding: ValidationCheck | undefined;
  /** Check ids that are outstanding, in severity order. Useful for tests. */
  outstandingIds: string[];
}

const SEVERITY_RANK: Record<string, number> = { danger: 0, warning: 1, info: 2, success: 3 };

/** Count the checks by severity. The only place this is done. */
export function summariseChecks(checks: ValidationCheck[]): CheckCounts {
  const danger = checks.filter((c) => c.severity === 'danger').length;
  const warning = checks.filter((c) => c.severity === 'warning').length;
  const info = checks.filter((c) => c.severity === 'info').length;

  // Most serious first, so the banner quotes the item that actually matters.
  // Ties are broken by original order, which is the engine's reporting order.
  const outstanding = checks
    .filter((c) => c.severity === 'danger' || c.severity === 'warning' || c.severity === 'info')
    .sort((a, b) => (SEVERITY_RANK[a.severity] ?? 9) - (SEVERITY_RANK[b.severity] ?? 9));

  return {
    danger,
    warning,
    info,
    total: checks.length,
    allPass: danger === 0 && warning === 0 && info === 0,
    firstOutstanding: outstanding[0],
    outstandingIds: outstanding.map((c) => c.id),
  };
}

/** Singular/plural helper, so the components cannot disagree on grammar either. */
export function plural(n: number, singular: string, plural_?: string): string {
  return n === 1 ? singular : (plural_ ?? `${singular}s`);
}

/**
 * The banner headline, derived from the counts so the wording follows the same
 * rule the counts obey.
 */
export function verdictHeadline(counts: CheckCounts): string {
  if (counts.allPass) return 'All engineering checks pass.';
  if (counts.danger > 0) {
    return `${counts.danger} hazard${plural(counts.danger, '')} need${counts.danger === 1 ? 's' : ''} attention.`;
  }
  if (counts.warning > 0) {
    return `${counts.warning} limit${plural(counts.warning, '')} exceeded.`;
  }
  return `No failures; ${counts.info} item${plural(counts.info, '')} need${counts.info === 1 ? 's' : ''} review.`;
}
