import React, { useEffect, useMemo, useState } from 'react';
import { calculateEffectiveCapacity } from '../../planning/capacity';
import { getFirstCycleNormativeReference } from '../../planning/normative/italianFirstCycle';
import type {
  AssessmentPeriodDefinition,
  SchoolOrder,
  TeachingProfile,
  WeeklyTeachingSlot
} from '../../planning/types';
import { validateTeachingProfile } from '../../planning/validation';

interface PlanningProfileEditorProps {
  profile?: TeachingProfile;
  onSave: (profile: TeachingProfile) => Promise<void>;
}

const createDraftProfile = (): TeachingProfile => {
  const schoolYear = '2026/27';
  const schoolOrder: SchoolOrder = 'lower_secondary';
  const subjectCode = 'tecnologia';
  return {
    id: `planning-profile-${Date.now()}`,
    schoolYear,
    schoolOrder,
    gradeLevel: 1,
    cohortRef: '2026-grade-1',
    subjectCode,
    normativeReference: getFirstCycleNormativeReference({ schoolOrder, subjectCode, schoolYear }),
    reservePercent: 15,
    assessmentPeriods: [],
    calendar: {
      startDate: '',
      endDate: '',
      closureDates: [],
      weeklySlots: []
    }
  };
};

const splitDates = (value: string): string[] => value
  .split(/[\n,;]+/)
  .map(item => item.trim())
  .filter(Boolean);

export const PlanningProfileEditor: React.FC<PlanningProfileEditorProps> = ({ profile, onSave }) => {
  const [draft, setDraft] = useState<TeachingProfile>(() => profile ?? createDraftProfile());
  const [attempted, setAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (profile) setDraft(profile);
  }, [profile]);

  const errors = useMemo(() => validateTeachingProfile(draft), [draft]);
  const capacity = useMemo(() => errors.length === 0 ? calculateEffectiveCapacity(draft) : null, [draft, errors]);

  const updateIdentity = (patch: Partial<Pick<TeachingProfile, 'schoolYear' | 'schoolOrder' | 'subjectCode'>>) => {
    setDraft(current => {
      const next = { ...current, ...patch };
      return {
        ...next,
        normativeReference: getFirstCycleNormativeReference({
          schoolOrder: next.schoolOrder,
          subjectCode: next.subjectCode,
          schoolYear: next.schoolYear
        })
      };
    });
  };

  const updatePeriod = (id: string, patch: Partial<AssessmentPeriodDefinition>) => {
    setDraft(current => ({
      ...current,
      assessmentPeriods: current.assessmentPeriods.map(period => period.id === id ? { ...period, ...patch } : period)
    }));
  };

  const addPeriod = () => {
    const ordinal = draft.assessmentPeriods.length + 1;
    setDraft(current => ({
      ...current,
      assessmentPeriods: [...current.assessmentPeriods, {
        id: `period-${Date.now()}`,
        label: `${ordinal}° periodo`,
        startDate: '',
        endDate: '',
        ordinal
      }]
    }));
  };

  const updateSlot = (id: string, patch: Partial<WeeklyTeachingSlot>) => {
    setDraft(current => ({
      ...current,
      calendar: {
        ...current.calendar,
        weeklySlots: current.calendar.weeklySlots.map(slot => slot.id === id ? { ...slot, ...patch } : slot)
      }
    }));
  };

  const addSlot = () => setDraft(current => ({
    ...current,
    calendar: {
      ...current.calendar,
      weeklySlots: [...current.calendar.weeklySlots, { id: `slot-${Date.now()}`, weekday: 1, hours: 1 }]
    }
  }));

  const national = draft.normativeReference;
  const primaryLocal = !national.nationalHoursDefined;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    setSaveError('');
    if (errors.length > 0 || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Salvataggio non riuscito.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-white">Programmazione didattica</h2>
        <p className="text-sm text-slate-400 mt-1">Configura il profilo reale prima di collegare il curricolo Arena.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-sm text-slate-300">Anno scolastico
          <input value={draft.schoolYear} onChange={e => updateIdentity({ schoolYear: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <label className="text-sm text-slate-300">Ordine scolastico
          <select value={draft.schoolOrder} onChange={e => updateIdentity({ schoolOrder: e.target.value as SchoolOrder })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2">
            <option value="lower_secondary">Secondaria di primo grado</option>
            <option value="primary">Primaria</option>
          </select>
        </label>
        <label className="text-sm text-slate-300">Classe/livello
          <input type="number" min="1" max="5" value={draft.gradeLevel} onChange={e => setDraft(current => ({ ...current, gradeLevel: Number(e.target.value) }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <label className="text-sm text-slate-300">Disciplina
          <input value={draft.subjectCode} onChange={e => updateIdentity({ subjectCode: e.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <label className="text-sm text-slate-300">Coorte
          <input value={draft.cohortRef} onChange={e => setDraft(current => ({ ...current, cohortRef: e.target.value }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <label className="text-sm text-slate-300">Margine di programmazione (%)
          <input name="reservePercent" type="number" min="0" max="50" value={draft.reservePercent} onChange={e => setDraft(current => ({ ...current, reservePercent: Number(e.target.value) }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
      </div>

      <div className="rounded-lg border border-cyan-900/60 bg-cyan-950/20 p-4">
        <h3 className="font-semibold text-cyan-200">Riferimento ordinamentale</h3>
        {primaryLocal ? (
          <p className="mt-2 text-sm text-amber-200">Monte ore disciplinare definito dall'istituzione scolastica</p>
        ) : (
          <p className="mt-2 text-sm text-slate-200">
            {national.nationalWeeklyHours} h/settimana · {national.nationalAnnualHours} h/anno
          </p>
        )}
        <p className="text-xs text-slate-500 mt-1">Fonte: {national.sourceRef} · {national.version}</p>
        <label className="block mt-3 text-sm text-slate-300">Monte ore locale annuale {primaryLocal ? '(obbligatorio)' : '(facoltativo)'}
          <input type="number" min="0" value={draft.localAllocation?.annualHours ?? ''} onChange={e => {
            const annualHours = Number(e.target.value);
            setDraft(current => ({ ...current, localAllocation: e.target.value === '' ? undefined : { annualHours, source: 'school', note: current.localAllocation?.note } }));
          }} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-sm text-slate-300">Inizio lezioni
          <input type="date" value={draft.calendar.startDate} onChange={e => setDraft(current => ({ ...current, calendar: { ...current.calendar, startDate: e.target.value } }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
        <label className="text-sm text-slate-300">Fine lezioni
          <input type="date" value={draft.calendar.endDate} onChange={e => setDraft(current => ({ ...current, calendar: { ...current.calendar, endDate: e.target.value } }))} className="mt-1 w-full rounded border border-slate-700 bg-slate-950 p-2" />
        </label>
      </div>

      <label className="block text-sm text-slate-300">Chiusure/eccezioni locali (date separate da virgola o a capo)
        <textarea name="closureDates" value={draft.calendar.closureDates.join('\n')} onChange={e => setDraft(current => ({ ...current, calendar: { ...current.calendar, closureDates: splitDates(e.target.value) } }))} className="mt-1 min-h-20 w-full rounded border border-slate-700 bg-slate-950 p-2" />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Ore settimanali reali</h3><button type="button" onClick={addSlot} className="text-sm text-cyan-300">+ Aggiungi ora</button></div>
        <div data-field="weeklySlots" className="space-y-2">
          {draft.calendar.weeklySlots.map(slot => (
            <div key={slot.id} className="grid grid-cols-2 gap-2">
              <select value={slot.weekday} onChange={e => updateSlot(slot.id, { weekday: Number(e.target.value) as WeeklyTeachingSlot['weekday'] })} className="rounded border border-slate-700 bg-slate-950 p-2">
                <option value="1">Lunedì</option><option value="2">Martedì</option><option value="3">Mercoledì</option><option value="4">Giovedì</option><option value="5">Venerdì</option><option value="6">Sabato</option><option value="7">Domenica</option>
              </select>
              <input type="number" min="0.25" step="0.25" value={slot.hours} onChange={e => updateSlot(slot.id, { hours: Number(e.target.value) })} className="rounded border border-slate-700 bg-slate-950 p-2" />
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between"><h3 className="font-semibold">Periodi di valutazione</h3><button type="button" onClick={addPeriod} className="text-sm text-cyan-300">+ Aggiungi periodo</button></div>
        <div data-field="assessmentPeriods" className="space-y-2">
          {draft.assessmentPeriods.map(period => (
            <div key={period.id} className="grid md:grid-cols-3 gap-2">
              <input value={period.label} onChange={e => updatePeriod(period.id, { label: e.target.value })} className="rounded border border-slate-700 bg-slate-950 p-2" />
              <input type="date" value={period.startDate} onChange={e => updatePeriod(period.id, { startDate: e.target.value })} className="rounded border border-slate-700 bg-slate-950 p-2" />
              <input type="date" value={period.endDate} onChange={e => updatePeriod(period.id, { endDate: e.target.value })} className="rounded border border-slate-700 bg-slate-950 p-2" />
            </div>
          ))}
        </div>
      </div>

      {capacity && <div className="rounded border border-emerald-900/60 bg-emerald-950/20 p-3 text-sm text-emerald-100">Capacità effettiva: {capacity.effectiveHours} h · riserva {capacity.reserveHours} h · programmabili {capacity.programmableHours} h</div>}
      {attempted && errors.length > 0 && <div role="alert" className="rounded border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">Completa o correggi il profilo: {errors.join(', ')}</div>}
      {saveError && <div role="alert" className="text-sm text-red-300">{saveError}</div>}
      <button type="submit" disabled={saving} className="rounded bg-cyan-400 px-4 py-2 font-semibold text-slate-950 disabled:opacity-50">{saving ? 'Salvataggio…' : 'Salva profilo'}</button>
    </form>
  );
};
