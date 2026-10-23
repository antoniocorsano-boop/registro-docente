import React, { useState } from 'react';
import { BehaviorRecord, ClassData } from '../types';
import { BEHAVIOR_OPTIONS, today, uid, formatStudentNameWithPrivacy } from '../utils';
import { Sparkles, Save, CheckCheck } from 'lucide-react';

interface BehaviorsViewProps {
  currentClass: ClassData;
  onSaveBehaviors: (records: BehaviorRecord[]) => Promise<void>;
  isPrivacyShieldActive?: boolean;
}

export const BehaviorsView: React.FC<BehaviorsViewProps> = ({
  currentClass,
  onSaveBehaviors,
  isPrivacyShieldActive = true
}) => {

  const [selectedDate, setSelectedDate] = useState<string>(today());
  const [isSaving, setIsSaving] = useState(false);
  const existingRecords = currentClass.behaviors || [];

  // Map of studentId -> status
  const [statusMap, setStatusMap] = useState<Record<string, 'Ottimale 🌟' | 'Costruttivo 👍' | 'Distratto ⚠️' | 'Disattento ❌'>>(() => {
    const init: Record<string, any> = {};
    currentClass.students.forEach(s => {
      // Find today's record or most recent record
      const match = [...existingRecords]
        .reverse()
        .find(b => b.studentId === s.id && b.date === selectedDate);
      init[s.id] = match ? match.status : 'Ottimale 🌟';
    });
    return init;
  });

  const handleSelectStatus = (studentId: string, status: 'Ottimale 🌟' | 'Costruttivo 👍' | 'Distratto ⚠️' | 'Disattento ❌') => {
    setStatusMap(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  const setAll = (status: 'Ottimale 🌟' | 'Costruttivo 👍' | 'Distratto ⚠️' | 'Disattento ❌') => {
    const next: Record<string, typeof status> = {};
    currentClass.students.forEach(s => {
      next[s.id] = status;
    });
    setStatusMap(next);
  };

  const handleSave = async () => {
    if (isSaving) return;
    const newRecords: BehaviorRecord[] = currentClass.students.map(s => ({
      id: uid(),
      studentId: s.id,
      date: selectedDate,
      status: statusMap[s.id] || 'Ottimale 🌟'
    }));

    setIsSaving(true);
    try {
      await onSaveBehaviors(newRecords);
    } catch {
      return;
    } finally {
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
            onChange={e => setSelectedDate(e.target.value)}
            disabled={isSaving}
            className="p-1.5 px-2.5 neon-input text-xs text-white"
          />
        </div>
      </div>

      <fieldset disabled={isSaving} className="border-0 p-0 m-0 min-w-0">
      {/* Bulk action buttons */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          Assegna a tutti:
        </span>
        <button
          type="button"
          onClick={() => setAll('Ottimale 🌟')}
          className="px-2.5 py-1 rounded text-xs badge-ok hover:brightness-110 transition-all font-semibold"
        >
          🌟 Tutti Ottimale
        </button>
        <button
          type="button"
          onClick={() => setAll('Costruttivo 👍')}
          className="px-2.5 py-1 rounded text-xs badge-info hover:brightness-110 transition-all font-semibold"
        >
          👍 Tutti Costruttivo
        </button>
        <button
          type="button"
          onClick={() => setAll('Distratto ⚠️')}
          className="px-2.5 py-1 rounded text-xs badge-warn hover:brightness-110 transition-all font-semibold"
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
            const currentStatus = statusMap[student.id] || 'Ottimale 🌟';

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

                </div>

                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {BEHAVIOR_OPTIONS.map(opt => {
                    const isSelected = currentStatus === opt.label;
                    return (
                      <button
                        key={opt.label}
                        type="button"
                        onClick={() => handleSelectStatus(student.id, opt.label as any)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold transition-all border ${
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

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="w-full py-3 rounded-lg neon-btn-primary text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
      >
        <Save className="w-4 h-4" />
        <span>Salva Registro Comportamenti</span>
      </button>
    </div>
  );
};
