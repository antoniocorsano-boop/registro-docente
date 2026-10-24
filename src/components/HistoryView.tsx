import React from 'react';
import { ClassData, EvaluationType } from '../types';
import { calcAvg, formatGrade, TYPES_LABEL } from '../utils';
import { History, Calendar, Trash2, Edit3, ClipboardCheck } from 'lucide-react';
import { MOBILE_TOUCH_TARGET_CLASS } from './mobileTouch';

interface HistoryViewProps {
  currentClass: ClassData;
  onEditBatch: (batchId: string) => void;
  onDeleteBatch: (batchId: string) => void;
  onNewEvaluation: () => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  currentClass,
  onEditBatch,
  onDeleteBatch,
  onNewEvaluation
}) => {
  const grades = currentClass.grades || [];

  const groupsMap: Record<string, { batchId: string; date: string; type: EvaluationType; title: string; period: string; votes: typeof grades }> = {};
  grades.forEach(g => {
    const key = g.batchId || `${g.date}_${g.type}_${g.title}`;
    if (!groupsMap[key]) {
      groupsMap[key] = {
        batchId: key,
        date: g.date,
        type: g.type,
        title: g.title,
        period: g.period,
        votes: []
      };
    }
    groupsMap[key].votes.push(g);
  });

  const batches = Object.values(groupsMap).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="neon-card p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[var(--primary)]" /> Storico Prove Registrate: {currentClass.name}
          </h3>
          <p className="text-xs text-slate-400">
            Archivio cronologico di tutte le verifiche, compiti e prove orali effettuate.
          </p>
        </div>

        <button
          onClick={onNewEvaluation}
          className={`${MOBILE_TOUCH_TARGET_CLASS} self-start sm:self-auto px-3.5 py-2 rounded-lg neon-btn-primary text-xs font-semibold flex items-center gap-1.5`}
        >
          <ClipboardCheck className="w-4 h-4" /> + Nuova Valutazione
        </button>
      </div>

      {batches.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-700 rounded-lg p-6">
          <Calendar className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-400 mb-3">Nessuna prova presente in archivio per questa classe.</p>
          <button
            onClick={onNewEvaluation}
            className={`${MOBILE_TOUCH_TARGET_CLASS} px-4 py-2 rounded-lg neon-btn-primary text-xs font-semibold`}
          >
            Crea la Prima Valutazione
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map(batch => {
            const batchAvg = calcAvg(batch.votes);

            return (
              <div
                key={batch.batchId}
                className="p-4 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] hover:border-[var(--primary)]/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center text-center shrink-0">
                    <span className="text-[10px] text-slate-400 font-bold uppercase">{batch.period}</span>
                    <span className="text-[9px] text-[var(--primary)] font-mono">
                      {batch.date.split('-')[1]}/{batch.date.split('-')[2]}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-slate-100 text-sm">
                      {batch.title || 'Prova Senza Titolo'}
                    </h4>
                    <div className="text-xs text-slate-400 flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-semibold text-cyan-400">
                        {TYPES_LABEL[batch.type] || batch.type}
                      </span>
                      <span>·</span>
                      <span>Data: {batch.date.split('-').reverse().join('/')}</span>
                      <span>·</span>
                      <span>{batch.votes.length} alunni valutati</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block font-semibold">
                      Media Prova
                    </span>
                    <span className={`text-base font-bold ${batchAvg && batchAvg >= 6 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {formatGrade(batchAvg)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 pl-2 border-l border-slate-700">
                    <button
                      onClick={() => onEditBatch(batch.batchId)}
                      className={`${MOBILE_TOUCH_TARGET_CLASS} p-2 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-[var(--primary)] transition-colors`}
                      title="Modifica valutazione"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Eliminare definitivamente la prova "${batch.title || batch.date}" con tutti i relativi voti?`)) {
                          onDeleteBatch(batch.batchId);
                        }
                      }}
                      className={`${MOBILE_TOUCH_TARGET_CLASS} p-2 rounded-md bg-slate-800 hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors`}
                      title="Elimina prova"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
