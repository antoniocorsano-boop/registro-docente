import React from 'react';
import type { ActiveTab } from '../types';
import { getPreparationOptions } from '../preparation/preparationRouter';

interface PreparationRouterPanelProps {
  className: string;
  onNavigateTab: (tab: ActiveTab) => void;
  onOpenCopilot: () => void;
  onDismiss: () => void;
}

export const PreparationRouterPanel: React.FC<PreparationRouterPanelProps> = ({
  className,
  onNavigateTab,
  onOpenCopilot,
  onDismiss
}) => {
  return (
    <section className="neon-card p-4" aria-label={`Prepara per ${className}`}>
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Oggi · Prepara</p>
            <h3 className="text-sm font-bold text-white">Che cosa vuoi preparare?</h3>
            <p className="text-xs text-slate-400 mt-1">
              Stai preparando per <span className="font-semibold text-slate-200">{className}</span>.
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="min-h-[44px] px-3 py-2 rounded-lg border border-[var(--border)] text-xs font-semibold text-slate-300 hover:text-white hover:border-[var(--primary)] shrink-0"
            aria-label="Chiudi Prepara"
          >
            Chiudi
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {getPreparationOptions().map(option => (
            <button
              key={option.id}
              type="button"
              onClick={() => {
                if (option.destination.kind === 'tab') {
                  onNavigateTab(option.destination.tab);
                  return;
                }
                onOpenCopilot();
              }}
              className="min-h-[44px] p-3 rounded-lg border border-[var(--primary)]/40 bg-[var(--surface-variant)] text-left hover:border-[var(--primary)] hover:bg-slate-800 transition-colors"
            >
              <span className="block text-xs font-semibold text-[var(--primary)]">{option.label}</span>
              <span className="block text-[11px] text-slate-400 mt-1">{option.description}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};
