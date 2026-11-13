import React, { useLayoutEffect, useRef, useState } from 'react';
import { BehaviorRecord, ClassData } from '../types';
import { BEHAVIOR_OPTIONS, today, formatStudentNameWithPrivacy } from '../utils';
import { Save, ChevronDown } from 'lucide-react';
import { buildObservationChanges, isObservationDate, recordedObservations, type ObservationStatus } from '../behavior/observationChanges';
import { MOBILE_TOUCH_TARGET_CLASS } from './mobileTouch';

export interface BehaviorDraftGuard {
  hasUnsavedChanges: () => boolean;
  discardChanges: () => void;
  markCommitted: () => void;
}

interface BehaviorsViewProps {
  currentClass: ClassData;
  onSaveBehaviors: (records: BehaviorRecord[]) => Promise<void>;
  isPrivacyShieldActive?: boolean;
  onRegisterDraftGuard?: (guard: BehaviorDraftGuard | null) => void;
}

// A class change cannot reuse state even when student ids coincide.
export const BehaviorsView: React.FC<BehaviorsViewProps> = props => (
  <BehaviorEditor key={props.currentClass.id} {...props} />
);

const BehaviorEditor: React.FC<BehaviorsViewProps> = ({
  currentClass, onSaveBehaviors, isPrivacyShieldActive = true, onRegisterDraftGuard
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [isSaving, setIsSaving] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const bulkToggleRef = useRef<HTMLButtonElement>(null);
  const closeSelectors = () => setBulkOpen(false);
  const savingRef = useRef(false);
  const [draft, setDraft] = useState<Map<string, ObservationStatus>>(() => new Map());
  const draftRef = useRef(draft);
  const contextRef = useRef({ currentClass, selectedDate });
  contextRef.current = { currentClass, selectedDate };
  const existing = recordedObservations(currentClass, selectedDate);
  const changeCount = currentClass.students.filter(s =>
    draft.has(s.id) && draft.get(s.id) !== existing.get(s.id)?.status
  ).length;
  const replaceDraft = (next: Map<string, ObservationStatus>) => {
    draftRef.current = next;
    setDraft(next);
  };
  const clearDraft = () => { replaceDraft(new Map()); closeSelectors(); };
  const hasChanges = () => {
    const { currentClass: current, selectedDate: date } = contextRef.current;
    const records = recordedObservations(current, date);
    return current.students.some(s => draftRef.current.has(s.id)
      && draftRef.current.get(s.id) !== records.get(s.id)?.status);
  };
  useLayoutEffect(() => {
    onRegisterDraftGuard?.({ hasUnsavedChanges: hasChanges, discardChanges: clearDraft, markCommitted: clearDraft });
    return () => onRegisterDraftGuard?.(null);
  }, [onRegisterDraftGuard]);

  const handleDateChange = (date: string) => {
    if (savingRef.current || date === selectedDate) return;
    if (hasChanges() && !window.confirm('Cambiare giornata senza salvare le osservazioni modificate?')) return;
    clearDraft();
    setSelectedDate(date);
  };
  const handleSelectStatus = (studentId: string, status: ObservationStatus) => {
    if (savingRef.current || !isObservationDate(selectedDate)) return;
    const next = new Map(draftRef.current);
    if (existing.get(studentId)?.status === status) next.delete(studentId);
    else next.set(studentId, status);
    replaceDraft(next);
  };
  const setAll = (status: ObservationStatus) => {
    if (savingRef.current || !isObservationDate(selectedDate)) return;
    const next = new Map<string, ObservationStatus>();
    currentClass.students.forEach(s => {
      if (existing.get(s.id)?.status !== status) next.set(s.id, status);
    });
    replaceDraft(next);
    // Keep keyboard focus on the visible mobile disclosure when its options close.
    if (window.matchMedia('(max-width: 767px)').matches) bulkToggleRef.current?.focus();
    closeSelectors();
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (savingRef.current) return;
    const newRecords = buildObservationChanges(currentClass, selectedDate, draftRef.current);
    if (!newRecords.length) return;
    savingRef.current = true;
    setIsSaving(true);
    try {
      await onSaveBehaviors(newRecords);
      clearDraft();
    } catch {
      return;
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div data-testid="behavior-workspace" className="behavior-workspace neon-card neon-card-highlight min-w-0 md:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2 md:mb-4 pb-2 md:pb-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-base md:text-lg font-bold text-[var(--primary)] md:drop-shadow-[0_0_8px_var(--primary)]">
            Valutazione Rapida Comportamenti
          </h3>
          <p className="hidden md:block text-xs text-slate-400">
            Registra le note disciplinari e l'attitudine partecipativa per la classe <b>{currentClass.name}</b>.
          </p>
        </div>

        <div className="flex min-w-0 items-center gap-2">
          <label htmlFor="behavior-date" className="text-xs text-slate-400 font-semibold uppercase">Data:</label>
          <input
            type="date"
            id="behavior-date"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            disabled={isSaving}
            className={`${MOBILE_TOUCH_TARGET_CLASS} min-h-[48px] md:min-h-0 min-w-0 max-w-full p-1.5 px-2.5 neon-input text-sm md:text-xs text-white`}
          />
        </div>
      </div>

      <fieldset disabled={isSaving || !isObservationDate(selectedDate)} className="border-0 p-0 m-0 min-w-0">
      {/* Bulk action buttons */}
      <button ref={bulkToggleRef} type="button" data-testid="behavior-bulk-toggle"
        aria-expanded={bulkOpen} aria-controls="behavior-bulk-actions"
        onClick={() => setBulkOpen(open => !open)}
        className="md:hidden min-h-[48px] w-full flex items-center justify-between gap-2 border-b border-[var(--border)] text-sm font-semibold text-cyan-300 focus-visible:outline focus-visible:outline-cyan-300">
        Assegna a tutti <ChevronDown aria-hidden="true" className={`w-4 h-4 shrink-0 ${bulkOpen ? 'rotate-180' : ''}`}/>
      </button>
      <div id="behavior-bulk-actions" className={`${bulkOpen ? 'flex' : 'hidden'} md:flex items-center gap-2 flex-wrap mb-2 md:mb-4 py-2 md:py-0`}>
        <p className="md:hidden w-full text-xs text-slate-400">La scelta sostituisce gli stati in bozza per questa giornata. Salva per registrarla.</p>
        <span className="hidden md:inline text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Assegna a tutti:
        </span>
        <button
          type="button"
          onClick={() => setAll('Ottimale 🌟')}
          className={`${MOBILE_TOUCH_TARGET_CLASS} min-h-[48px] md:min-h-0 px-2.5 py-1 rounded text-xs badge-ok hover:brightness-110 transition-all font-semibold`}
        >
          🌟 Tutti Ottimale
        </button>
        <button
          type="button"
          onClick={() => setAll('Costruttivo 👍')}
          className={`${MOBILE_TOUCH_TARGET_CLASS} min-h-[48px] md:min-h-0 px-2.5 py-1 rounded text-xs badge-info hover:brightness-110 transition-all font-semibold`}
        >
          👍 Tutti Costruttivo
        </button>
        <button
          type="button"
          onClick={() => setAll('Distratto ⚠️')}
          className={`${MOBILE_TOUCH_TARGET_CLASS} min-h-[48px] md:min-h-0 px-2.5 py-1 rounded text-xs badge-warn hover:brightness-110 transition-all font-semibold`}
        >
          ⚠️ Tutti Distratto
        </button>
      </div>

      {/* Student rows */}
      <div data-testid="behavior-list" className="min-w-0 divide-y divide-[var(--border)] md:border md:border-[var(--border)] md:rounded-lg md:overflow-hidden md:bg-slate-900/60 md:max-h-[55vh] md:overflow-y-auto mb-3 md:mb-4">
        <div className="md:hidden behavior-legend flex flex-wrap gap-x-3 gap-y-1 py-2 text-xs text-slate-400" aria-label="Legenda delle osservazioni">
          {BEHAVIOR_OPTIONS.map(opt => <span key={opt.label}>{opt.label}</span>)}
        </div>
        {currentClass.students.length === 0 ? (
          <p className="p-4 text-xs text-slate-400 text-center">
            Nessun alunno presente in questa classe.
          </p>
        ) : (
          currentClass.students.map((student, idx) => {
            const currentStatus = draft.get(student.id) ?? existing.get(student.id)?.status;
            const isChanged = draft.has(student.id) && draft.get(student.id) !== existing.get(student.id)?.status;
            const displayName = formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive);
            const stateLabel = isChanged ? 'Da salvare' : currentStatus ? 'Registrato' : 'Non registrato';

            return (
              <div
                key={student.id}
                data-testid="behavior-row"
                className="behavior-direct-row min-w-0 md:p-3 md:flex md:flex-row md:items-center md:justify-between md:gap-2.5 md:hover:bg-slate-800/40"
              >
                <div className="behavior-name-cell md:hidden min-w-0 py-1">
                  <span className="block min-w-0 text-sm font-semibold text-slate-100" data-testid="behavior-name">{displayName}</span>
                  <span data-testid="behavior-mobile-state" className={`block text-xs ${isChanged ? 'text-amber-300' : 'text-slate-400'}`}>{stateLabel}</span>
                </div>
                <div className="hidden md:flex items-center gap-2">
                  <span className="text-slate-500 font-mono text-xs w-5 text-right">{idx + 1}.</span>
                  <span className="font-semibold text-slate-200 text-xs sm:text-sm">
                    {displayName}
                  </span>
                  <span className="text-xs text-slate-400" data-testid="behavior-observation-state">{stateLabel}</span>
                </div>

                <div id={`behavior-options-${idx}`} data-testid="behavior-options" role="group"
                  aria-label={`${displayName} — ${stateLabel}`}
                  className="behavior-direct-options grid md:flex items-center md:gap-1.5 md:flex-wrap md:justify-end">
                  {BEHAVIOR_OPTIONS.map(opt => {
                    const isSelected = currentStatus === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectStatus(student.id, opt.label)}
                        className={`behavior-direct-choice ${MOBILE_TOUCH_TARGET_CLASS} min-h-[48px] md:min-h-0 min-w-0 md:px-2.5 md:py-1 rounded text-sm md:text-xs font-semibold transition-all md:border ${
                          isSelected
                            ? `${opt.colorClass} border-[var(--primary)] ring-2 ring-[var(--primary)]/30 md:shadow-[0_0_8px_var(--primary)] md:scale-105`
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <span aria-hidden="true" className="md:hidden text-xl leading-none">{opt.label.split(' ').at(-1)}</span>
                        <span className="sr-only md:not-sr-only">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      </fieldset>

      <div data-testid="behavior-save-bar" className="behavior-save-bar sticky md:static z-30 md:z-auto bg-[#030712] md:bg-transparent border-t md:border-0 border-[var(--border)] py-2 md:py-0">
      <p role="status" className="mb-2 text-xs text-slate-300">{changeCount} osservazioni da salvare</p>
      <button
        onClick={handleSave}
        disabled={isSaving || changeCount === 0 || !isObservationDate(selectedDate)}
        className="w-full min-h-[48px] py-3 rounded-lg neon-btn-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Save aria-hidden="true" className="w-4 h-4 shrink-0" />
        <span>Salva Registro Comportamenti</span>
      </button>
      </div>
    </div>
  );
};
