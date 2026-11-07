import React from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Mobile professional list row. The entire summary is a single accessible
 * disclosure trigger; the student-report action is deliberately separate.
 * Callers supply an already privacy-filtered label, never raw student data.
 */
export interface CompactStudentDisclosureRowProps {
  rowId: string;
  displayName: string;
  primaryLabel: string;
  primaryValue: string;
  expanded: boolean;
  onToggle: () => void;
  onOpenStudentReport: () => void;
  children: React.ReactNode;
}

export const CompactStudentDisclosureRow: React.FC<CompactStudentDisclosureRowProps> = ({
  rowId,
  displayName,
  primaryLabel,
  primaryValue,
  expanded,
  onToggle,
  onOpenStudentReport,
  children,
}) => {
  const panelId = `matrix-compact-details-${rowId}`;
  return (
    <article data-testid="matrix-compact-row" className="min-w-0">
      <button
        type="button"
        data-testid="matrix-compact-toggle"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={`${displayName}. ${primaryLabel}: ${primaryValue}. ${expanded ? 'Nascondi' : 'Mostra'} dettagli`}
        onClick={onToggle}
        className="flex min-h-[60px] w-full min-w-0 items-center gap-2.5 px-3 py-2 text-left hover:bg-slate-800/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cyan-300"
      >
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-slate-100">{displayName}</span>
        <span className="shrink-0 text-right">
          <span className="block text-xs font-medium text-slate-400">{primaryLabel}</span>
          <span data-testid="matrix-compact-average" className="block text-base font-bold tabular-nums text-slate-100">{primaryValue}</span>
        </span>
        <ChevronDown
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>
      <div id={panelId} data-testid="matrix-compact-detail" hidden={!expanded}>
        {expanded && (
          <div className="space-y-3 border-t border-[var(--border)] bg-slate-900/40 px-3 pb-4 pt-3">
            {children}
            <button
              type="button"
              onClick={onOpenStudentReport}
              className="min-h-[48px] w-full rounded-lg border border-cyan-800/60 bg-slate-800/50 px-3 text-sm font-semibold text-cyan-300 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            >
              Apri scheda alunno
            </button>
          </div>
        )}
      </div>
    </article>
  );
};
