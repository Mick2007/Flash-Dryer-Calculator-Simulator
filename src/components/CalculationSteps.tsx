import React, { useState } from 'react';
import {
  Calculator,
  Search,
  Filter,
  CheckCircle2,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Tag,
  Code,
  Lightbulb,
} from 'lucide-react';
import { CalculationResults, CalculationStep } from '../types/dryer';

interface CalculationStepsProps {
  results: CalculationResults;
}

export const CalculationSteps: React.FC<CalculationStepsProps> = ({ results }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0); // First step expanded by default

  const categories = [
    { id: 'all', label: 'All Equations' },
    { id: 'Hopper Design', label: 'Hopper Design (IITA 1–11)' },
    { id: 'Screw Feeder Design', label: 'Screw Feeder Design (1–17)' },
    { id: 'Material Balance', label: 'Material Balance' },
    { id: 'Psychrometric & Air', label: 'Psychrometrics & Air' },
    { id: 'Energy Balance', label: 'Energy Balance' },
    { id: 'Fluid Dynamics', label: 'Fluid Dynamics' },
    { id: 'Dryer Dimensions', label: 'Dryer Dimensions' },
    { id: 'Cyclone Separator', label: 'Cyclone Separator' },
    { id: 'Feeding & Ancillary', label: 'Feeding & Ancillary' },
  ];

  const filteredSteps = results.steps.filter((step) => {
    const matchesCat = selectedCategory === 'all' || step.category === selectedCategory;
    const matchesSearch =
      step.parameterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.equation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      step.sourceCitation.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (step.simpleExplanation && step.simpleExplanation.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  const getBadgeColor = (classification: CalculationStep['sourceClassification']) => {
    switch (classification) {
      case 'Directly from Source':
        return 'bg-verdigris-wash text-verdigris border-verdigris/30';
      case 'Calculated':
        return 'bg-paper-sunk text-graphite-soft border-rule-strong';
      case 'Engineering Assumption':
        return 'bg-brass-wash text-brass border-brass/30';
      case 'Engineering Estimate':
        return 'bg-oxide-wash text-oxide border-oxide/30';
      case 'User Input':
        return 'bg-graphite/8 text-graphite border-graphite/20';
      default:
        return 'bg-paper-sunk text-graphite-soft border-rule';
    }
  };

  return (
    <div className="space-y-4">
      {/* Search & Filter Header */}
      <div className="rule-b pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-graphite">
            Step-by-step derivations
          </h2>
          <p className="argument !text-[12px] !leading-relaxed mt-0.5 opacity-70">
            {results.steps.length} calculations, each with its equation, substituted values, result and source.
          </p>
        </div>

        {/* Search bar */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-graphite-faint absolute left-2.5 top-2.5" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search derivations"
            placeholder="Search equations, symbols, sources"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-paper-raised border border-rule text-graphite placeholder:text-graphite-faint"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-medium">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCategory(c.id)}
            className={`px-2.5 py-1 text-[11px] whitespace-nowrap transition-colors ${
              selectedCategory === c.id
                ? 'bg-graphite text-paper font-semibold'
                : 'text-graphite-soft hover:text-graphite border border-rule'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Steps List */}
      <div className="space-y-3">
        {filteredSteps.map((step, idx) => {
          const isExpanded = expandedIndex === idx;

          return (
            <div
              key={idx}
              className="rule-b last:border-b-0"
            >
              {/* Step Header — a real button, keyboard reachable and announced. */}
              <button
                type="button"
                onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                aria-expanded={isExpanded}
                aria-controls={`step-detail-${idx}`}
                className="w-full text-left py-3 flex items-start sm:items-center justify-between gap-4 cursor-pointer select-none group"
              >
                <div className="flex items-start sm:items-baseline gap-3 min-w-0 flex-1">
                  {/* Steps ARE a sequence, so numbering is information, not decoration. */}
                  <span className="qty text-[11px] text-graphite-faint w-7 shrink-0 text-right group-hover:text-brass transition-colors">
                    {String(idx + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[14px] font-semibold text-graphite leading-tight">
                        {step.parameterName}
                      </span>
                      <span className="qty text-[12px] text-brass">{step.symbol}</span>
                      <span className="text-[11px] text-graphite-faint">
                        {step.unit} · {step.category}
                      </span>
                    </div>
                    {step.simpleExplanation && (
                      <p className="argument !text-[13px] !leading-snug mt-0.5 line-clamp-1 opacity-70 group-hover:opacity-100 transition-opacity">
                        {step.simpleExplanation}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-baseline gap-3 shrink-0">
                  {/* Provenance badge. The `xs:` breakpoint did not exist in Tailwind v4,
                      so this was hidden at every viewport — now always visible. */}
                  <span
                    className={`text-[9px] font-semibold px-1.5 py-0.5 uppercase tracking-wider border hidden sm:inline-block ${getBadgeColor(
                      step.sourceClassification
                    )}`}
                  >
                    {step.sourceClassification}
                  </span>
                  <span className="qty text-[14px] text-graphite font-semibold">
                    {step.formattedResult}
                  </span>
                  <span className="text-graphite-faint group-hover:text-brass transition-colors" aria-hidden="true">
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </div>
              </button>

              {/* Step Details — only rendered when expanded. Without this guard every
                  step's equations stay on the page and the disclosure appears inert. */}
              {isExpanded && (
              <div id={`step-detail-${idx}`} className="pb-4 pl-10 pr-1 space-y-3 text-xs">
                {/* Plain-English explanation, set as prose. */}
                {step.simpleExplanation && (
                  <p className="argument">
                    {step.simpleExplanation}
                  </p>
                )}

                {/* 1. Equation */}
                <div className="bg-graphite text-paper px-3 py-2.5 overflow-x-auto">
                  <div className="flex items-baseline gap-2.5 min-w-max">
                    <span className="text-[9px] uppercase tracking-widest text-brass-bright font-semibold shrink-0">
                      Equation
                    </span>
                    <span className="eq text-[12px] font-medium">{step.equation}</span>
                  </div>
                </div>

                {/* 2. Source Citation */}
                <p className="flex items-start gap-2 text-[11px] text-graphite-soft">
                  <BookOpen className="w-3.5 h-3.5 text-brass shrink-0 mt-0.5" aria-hidden="true" />
                  <span>
                    <span className="text-graphite-faint">Source </span>
                    {step.sourceCitation}
                  </span>
                </p>

                {/* 3. Variables & Units Table */}
                {step.variableDefinitions && step.variableDefinitions.length > 0 && (
                  <div className="rule-t rule-b">
                    <div className="py-1 text-[10px] uppercase tracking-widest text-graphite-faint">
                      Variables and units
                    </div>
                    <div>
                      {step.variableDefinitions.map((v, vIdx) => (
                        <div key={vIdx} className="py-1 flex items-baseline justify-between gap-4 text-[11px] rule-b last:border-b-0">
                          <div className="flex items-baseline gap-2 min-w-0">
                            <span className="qty text-brass font-semibold shrink-0">{v.symbol}</span>
                            <span className="text-graphite-soft">{v.name}</span>
                          </div>
                          <span className="qty text-graphite shrink-0">
                            {v.value} <span className="text-graphite-faint">{v.unit}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. Numerical Substitution */}
                <div className="bg-paper-sunk/60 px-3 py-2.5 rule-l-2 border-l-brass/40">
                  <span className="text-[10px] uppercase tracking-widest text-graphite-faint block mb-1">
                    Substitution
                  </span>
                  <p className="eq text-[12px] leading-relaxed break-words">
                    {step.substitution}
                  </p>
                </div>

                {/* 5. Result & notes */}
                <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 rule-t pt-2.5">
                  <div className="flex items-baseline gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-verdigris" aria-hidden="true" />
                    <span className="text-[11px] text-graphite-faint">Result</span>
                    <span className="qty text-[15px] text-graphite font-semibold">{step.formattedResult}</span>
                  </div>

                  {step.notes && (
                    <p className="argument !text-[12px] !leading-relaxed italic max-w-[52ch]">
                      {step.notes}
                    </p>
                  )}
                </div>
              </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

