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
    <section className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[var(--border)]">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-200">
            Valutazione Rapida Comportamenti
          </h3>
          <p className="text-sm text-slate-400">{currentClass.name}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-400">
          Data
          <input
            type="date"
            value={selectedDate}
            onChange={e => handleDateChange(e.target.value)}
            disabled={isSaving}
            className={`${MOBILE_TOUCH_TARGET_CLASS} max-w-full p-1.5 neon-input text-xs text-white`}
          />
        </label>
      </div>

      <fieldset disabled={isSaving || !isObservationDate(selectedDate)} className="border-0 p-0 m-0 min-w-0">
        <div className="flex items-center gap-1 flex-wrap py-2 border-b border-[var(--border)]">
          <span className="text-xs font-medium text-slate-400 w-full sm:w-auto sm:mr-2">
            Assegna a tutti:
          </span>
          <button
            type="button"
            onClick={() => setAll('Ottimale 🌟')}
            className={`${MOBILE_TOUCH_TARGET_CLASS} px-2 rounded text-xs badge-ok font-medium`}
          >
            🌟 Tutti Ottimale
          </button>
          <button
            type="button"
            onClick={() => setAll('Costruttivo 👍')}
            className={`${MOBILE_TOUCH_TARGET_CLASS} px-2 rounded text-xs badge-info font-medium`}
          >
            👍 Tutti Costruttivo
          </button>
          <button
            type="button"
            onClick={() => setAll('Distratto ⚠️')}
            className={`${MOBILE_TOUCH_TARGET_CLASS} px-2 rounded text-xs badge-warn font-medium`}
          >
            ⚠️ Tutti Distratto
          </button>
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 py-2 text-xs text-slate-400 lg:flex lg:flex-wrap lg:gap-3" aria-label="Legenda delle osservazioni">
          {BEHAVIOR_OPTIONS.map(opt => <span key={opt.label}>{opt.label}</span>)}
        </div>

        <div data-testid="behavior-student-list" className="min-w-0 divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {currentClass.students.length === 0 ? (
            <p className="py-4 text-xs text-slate-400 text-center">
              Nessun alunno presente in questa classe.
            </p>
          ) : (
            currentClass.students.map(student => {
              const currentStatus = draft.get(student.id) ?? existing.get(student.id)?.status;
              const isChanged = draft.has(student.id) && draft.get(student.id) !== existing.get(student.id)?.status;
              const studentName = formatStudentNameWithPrivacy(student.name, isPrivacyShieldActive);

              return (
                <div
                  key={student.id}
                  data-testid="behavior-student-row"
                  className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 py-1.5"
                >
                  <div className="min-w-[72px] flex-1">
                    <span data-testid="behavior-student-name" className="block break-words font-medium text-slate-200 text-sm">
                      {studentName}
                    </span>
                    <span className="block text-[11px] text-slate-400" data-testid="behavior-observation-state">{isChanged ? 'Da salvare' : currentStatus ? 'Registrato' : 'Non registrato'}</span>
                  </div>

                  <div className="flex shrink-0 items-center gap-1" role="group" aria-label={`Osservazione: ${studentName}`}>
                    {BEHAVIOR_OPTIONS.map(opt => {
                      const isSelected = currentStatus === opt.label;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          aria-label={opt.label}
                          title={opt.label}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectStatus(student.id, opt.label)}
                          className={`h-11 w-11 shrink-0 lg:w-auto lg:px-2 rounded-md text-sm font-medium border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                            isSelected
                              ? `${opt.colorClass} border-[var(--primary)] ring-2 ring-inset ring-[var(--primary)]`
                              : 'bg-transparent text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                        >
                          <span aria-hidden="true" className="lg:hidden">{opt.label.slice(opt.text.length).trim()}</span>
                          <span aria-hidden="true" className="hidden lg:inline">{opt.label}</span>
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

      <div className="pt-3 pb-2">
      <p role="status" className="mb-2 text-xs text-slate-400">{changeCount} osservazioni da salvare</p>
      <button
        onClick={handleSave}
        disabled={isSaving || changeCount === 0 || !isObservationDate(selectedDate)}
        className="w-full py-3 min-h-11 rounded-lg neon-btn-primary text-sm font-semibold flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" />
        <span>Salva Registro Comportamenti</span>
      </button>
      </div>
    </section>
  );
};
