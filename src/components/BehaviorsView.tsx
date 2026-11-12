import React, { useLayoutEffect, useRef, useState } from 'react';
import { BehaviorRecord, ClassData } from '../types';
import { BEHAVIOR_OPTIONS, today, formatStudentNameWithPrivacy } from '../utils';
import { Save } from 'lucide-react';
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
  const clearDraft = () => replaceDraft(new Map());
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
    <div className="neon-card neon-card-highlight p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-[var(--border)]">
        <div>
          <h3 className="text-lg font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]">
            Valutazione Rapida Comportamenti
          </h3>
          <p className="text-xs text-slate-400">
            Registra le note disciplinari e l'attitudine partecipativa per la classe <b>{currentClass.name}</b>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-semibold uppercase">Data:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            disabled={isSaving}
            className={`${MOBILE_TOUCH_TARGET_CLASS} p-1.5 px-2.5 neon-input text-xs text-white`}
          />
        </div>
      </div>

      <fieldset disabled={isSaving || !isObservationDate(selectedDate)} className="border-0 p-0 m-0 min-w-0">
      {/* Bulk action buttons */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Assegna a tutti:
        </span>
        <button
          type="button"
          onClick={() => setAll('Ottimale 🌟')}
          className={`${MOBILE_TOUCH_TARGET_CLASS} px-2.5 py-1 rounded text-xs badge-ok hover:brightness-110 transition-all font-semibold`}
        >
          🌟 Tutti Ottimale
        </button>
        <button
          type="button"
          onClick={() => setAll('Costruttivo 👍')}
          className={`${MOBILE_TOUCH_TARGET_CLASS} px-2.5 py-1 rounded text-xs badge-info hover:brightness-110 transition-all font-semibold`}
        >
          👍 Tutti Costruttivo
        </button>
        <button
          type="button"
          onClick={() => setAll('Distratto ⚠️')}
          className={`${MOBILE_TOUCH_TARGET_CLASS} px-2.5 py-1 rounded text-xs badge-warn hover:brightness-110 transition-all font-semibold`}
        >
          ⚠️ Tutti Distratto
        </button>
      </div>

      {/* Student rows */}
      <div className="border border-[var(--border)] rounded-lg overflow-hidden bg-slate-900/60 divide-y divide-[var(--border)] max-h-[55vh] overflow-y-auto mb-4">
        {currentClass.students.length === 0 ? (
          <p className="p-4 text-xs text-slate-400 text-center">
            Nessun alunno presente in questa classe.
          </p>
        ) : (
          currentClass.students.map((student, idx) => {
            const currentStatus = draft.get(student.id) ?? existing.get(student.id)?.status;
            const isChanged = draft.has(student.id) && draft.get(student.id) !== existing.get(student.id)?.status;

            return (
              <div
                key={student.id}
                className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 hover:bg-slate-800/40 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-mono text-xs w-5 text-right">{idx + 1}.</span>
                  <span className="font-semibold text-slate-200 text-xs sm:text-sm">
                    {formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive)}
                  </span>
                  <span className="text-xs text-slate-400" data-testid="behavior-observation-state">{isChanged ? 'Da salvare' : currentStatus ? 'Registrato' : 'Non registrato'}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {BEHAVIOR_OPTIONS.map(opt => {
                    const isSelected = currentStatus === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleSelectStatus(student.id, opt.label)}
                        className={`${MOBILE_TOUCH_TARGET_CLASS} px-2.5 py-1 rounded text-xs font-semibold transition-all border ${
                          isSelected
                            ? `${opt.colorClass} border-[var(--primary)] ring-2 ring-[var(--primary)]/30 shadow-[0_0_8px_var(--primary)] scale-105`
                            : 'bg-slate-800/60 text-slate-400 border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
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

      <p role="status" className="mb-2 text-xs text-slate-400">{changeCount} osservazioni da salvare</p>
      <button
        onClick={handleSave}
        disabled={isSaving || changeCount === 0 || !isObservationDate(selectedDate)}
        className="w-full py-3 rounded-lg neon-btn-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
      >
        <Save className="w-4 h-4" />
        <span>Salva Registro Comportamenti</span>
      </button>
    </div>
  );
};
