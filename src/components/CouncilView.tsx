import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, ClassData } from '../types';
import type { PlanningDraftGuard } from './planning/PlanningProfileEditor';
import { councilRows, normalizeSchoolYear, parseCouncilValue, readCouncilValues, summarizeCouncilValues } from '../council/councilModel';
import { formatGrade, formatStudentNameWithPrivacy, today } from '../utils';
import { ClipboardList, Save, Users } from 'lucide-react';

interface CouncilViewProps {
  classes: ClassData[];
  settings: AppSettings;
  isPrivacyShieldActive: boolean;
  onSave: (classId: string, schoolYear: string, values: Record<string, string>) => Promise<void>;
  onRegisterDraftGuard?: (guard: PlanningDraftGuard | null) => void;
}

export const CouncilView: React.FC<CouncilViewProps> = ({
  classes, settings, isPrivacyShieldActive, onSave, onRegisterDraftGuard
}) => {
  // Class choice is explicit. Do not infer one from the current navigation context.
  const [selectedClassId, setSelectedClassId] = useState('');
  const [cutoff, setCutoff] = useState(today);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const schoolYear = settings.year;
  const academicYearValid = normalizeSchoolYear(schoolYear) !== null;
  const current = classes.find(item => item.id === selectedClassId);

  useEffect(() => {
    const next = current ? readCouncilValues(current, schoolYear) : {};
    setDraft(next);
    setSaved(next);
    setStatus('');
    // Only an explicit class/year switch resets the draft, never an unrelated re-render.
  }, [selectedClassId, schoolYear]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const rows = useMemo(
    () => current ? councilRows(current, schoolYear, cutoff, settings) : [],
    [current, schoolYear, cutoff, settings]
  );
  const summary = current ? summarizeCouncilValues(current.students, draft) : null;
  const invalid = Object.values(draft).some(value => value.trim() !== '' && parseCouncilValue(value) === null);

  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving);
  dirtyRef.current = dirty;
  savingRef.current = saving;

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    if (!dirtyRef.current) return true;
    if (!selectedClassId) return false;
    if (!academicYearValid) {
      setStatus('Anno scolastico non valido: correggere il formato nelle Impostazioni.');
      return false;
    }
    if (Object.values(draft).some(value => value.trim() !== '' && parseCouncilValue(value) === null)) {
      setStatus('Correggere i voti non validi prima del salvataggio.');
      return false;
    }
    savingRef.current = true;
    setSaving(true);
    setStatus('Salvataggio nell’archivio cifrato in corso…');
    try {
      await onSave(selectedClassId, schoolYear, { ...draft });
      setSaved({ ...draft });
      dirtyRef.current = false;
      setStatus('Valutazioni di ingresso salvate nell’archivio locale cifrato.');
      return true;
    } catch {
      setStatus('Salvataggio non riuscito: i dati in modifica sono rimasti disponibili. Riprova.');
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [academicYearValid, draft, onSave, schoolYear, selectedClassId]);

  useEffect(() => {
    if (!onRegisterDraftGuard) return;
    const guard: PlanningDraftGuard = {
      hasUnsavedChanges: () => dirtyRef.current || savingRef.current,
      saveChanges: handleSave,
      discardChanges: () => {
        setDraft({ ...saved });
        dirtyRef.current = false;
      }
    };
    onRegisterDraftGuard(guard);
    return () => onRegisterDraftGuard(null);
  }, [handleSave, onRegisterDraftGuard, saved]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current && !savingRef.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const setValue = (studentId: string, value: string) => {
    setDraft(previous => ({ ...previous, [studentId]: value }));
    setStatus('');
  };

  const changeClass = (id: string) => {
    if (savingRef.current) return;
    if (dirty && !window.confirm('Ci sono valutazioni di ingresso non salvate. Cambiare classe e scartarle?')) return;
    setSelectedClassId(id);
  };

  const fillableRows = rows.filter(row => !draft[row.student.id]?.trim() && row.average !== null);
  const fillEmptyFromAverages = () => {
    if (saving || fillableRows.length === 0) return;
    if (!window.confirm(
      `Proporre la media delle prove come voto di ingresso per ${fillableRows.length} alunni? I valori saranno soltanto inseriti nella bozza: per salvarli servirà una conferma separata.`
    )) return;
    const next = { ...draft };
    for (const row of fillableRows) {
      next[row.student.id] = String(Number(row.average!.toFixed(2)));
    }
    setDraft(next);
    setStatus('');
  };

  return (
    <section className="neon-card p-4 sm:p-5 space-y-5" aria-label="Consigli di classe">
      <header className="border-b border-[var(--border)] pb-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[var(--primary)]" /> Consigli di classe
        </h1>
        <p className="text-sm text-slate-300 mt-1">Valutazioni di ingresso · anno scolastico {schoolYear}.</p>
        <p className="text-xs text-slate-400 mt-1">
          La media è un riferimento matematico; il voto di ingresso è attribuito e confermato dal docente.
        </p>
        {!academicYearValid && (
          <p role="alert" className="text-sm text-amber-300 mt-2">
            Anno scolastico non riconosciuto. Imposta un valore come 2026/27 o 2026/2027
            nelle Impostazioni prima di attribuire i voti.
          </p>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-sm text-slate-300 font-semibold">
          Classe
          <select aria-label="Seleziona classe per il Consiglio" value={selectedClassId}
            onChange={event => changeClass(event.target.value)} disabled={saving}
            className="mt-1 w-full p-2.5 rounded-lg border border-[var(--border)] bg-slate-900 text-white">
            <option value="">Seleziona una classe</option>
            {classes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300 font-semibold">
          Prove considerate fino al
          <input aria-label="Data limite delle prove" type="date" value={cutoff}
            onChange={event => setCutoff(event.target.value)} max={today()}
            className="mt-1 w-full p-2.5 rounded-lg border border-[var(--border)] bg-slate-900 text-white" />
        </label>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <span className="rounded bg-[var(--surface-variant)] px-3 py-1.5 font-bold text-[var(--primary)]">Ingresso</span>
        <span className="px-3 py-1.5 text-slate-500">Intermedia · successivamente</span>
        <span className="px-3 py-1.5 text-slate-500">Finale · successivamente</span>
      </div>

      {!current ? (
        <p className="p-5 text-slate-300 bg-slate-900/50 rounded-lg">
          Seleziona una classe per consultare le prove importate e attribuire i voti di ingresso.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-300 flex items-center gap-2">
              <Users className="w-4 h-4" /> {current.students.length} alunni ·
              media {settings.useWeightedAverage ? 'ponderata' : 'aritmetica'} delle prove numeriche fino al {cutoff || '—'}
            </p>
            <button type="button" onClick={fillEmptyFromAverages} disabled={saving || !academicYearValid || !cutoff || fillableRows.length === 0}
              className="px-3 py-2 min-h-[44px] rounded-lg border border-[var(--border)] text-sm font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50">
              Proponi le medie nei campi vuoti
            </button>
          </div>

          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm min-w-[650px] text-left">
              <thead className="bg-slate-900 text-slate-200">
                <tr>
                  <th scope="col" className="p-3">Alunno</th>
                  <th scope="col" className="p-3 text-center">Prove</th>
                  <th scope="col" className="p-3 text-center">Media prove</th>
                  <th scope="col" className="p-3 text-center">Voto di ingresso</th>
                  <th scope="col" className="p-3 text-center">Fascia</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const entered = draft[row.student.id] ?? '';
                  const level = getLevel(entered);
                  const bad = entered.trim() !== '' && parseCouncilValue(entered) === null;
                  return (
                    <tr key={row.student.id} className="border-t border-[var(--border)] hover:bg-slate-800/30">
                      <th scope="row" className="p-3 text-white font-medium">
                        {formatStudentNameWithPrivacy(row.student.name, isPrivacyShieldActive)}
                      </th>
                      <td className="p-3 text-center text-slate-300">{row.count}</td>
                      <td className="p-3 text-center font-semibold text-slate-200">
                        {formatGrade(row.average)}
                        {row.average !== null && (
                          <button type="button" onClick={() => setValue(row.student.id, String(Number(row.average!.toFixed(2))))}
                            disabled={saving || !academicYearValid} title="Usa la media come voto di ingresso"
                            aria-label={`Usa media per alunno ${formatStudentNameWithPrivacy(row.student.name, isPrivacyShieldActive)}`}
                            className="block mx-auto text-xs text-[var(--primary)] underline min-h-[28px] disabled:opacity-50">
                            Usa media
                          </button>
                        )}
                      </td>
                      <td className="p-2 text-center">
                        <input inputMode="decimal" type="text" value={entered}
                          aria-label={`Voto di ingresso per ${formatStudentNameWithPrivacy(row.student.name, isPrivacyShieldActive)}`}
                          aria-invalid={bad} disabled={saving || !academicYearValid}
                          onChange={event => setValue(row.student.id, event.target.value)}
                          placeholder="—"
                          className={`w-24 p-2 rounded-md border text-center bg-slate-950 text-white ${bad ? 'border-rose-500' : 'border-[var(--border)]'}`} />
                      </td>
                      <td className="p-3 text-center text-slate-300">{level}</td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <tr><td colSpan={5} className="p-5 text-slate-300">Nessun alunno presente nella classe.</td></tr>}
              </tbody>
            </table>
          </div>

          <section className="rounded-lg bg-slate-900/60 p-4 space-y-3" aria-label="Riepilogo delle fasce di ingresso">
            <h2 className="text-lg font-bold text-white">Riepilogo per fasce di livello</h2>
            <p className="text-xs text-slate-400">
              Conteggio sul voto di ingresso attribuito, non sulla media delle prove.
              {dirty ? ' Anteprima non ancora salvata.' : ' Valori correntemente salvati.'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {([
                ['AV', 'Alta · 8,5–10'],
                ['IN', 'Medio-alta · 7–8,49'],
                ['BA', 'Base · 6–6,99'],
                ['PA', 'Sotto soglia · meno di 6']
              ] as const).map(([key, label]) => (
                <div key={key} className="p-3 border border-[var(--border)] rounded-lg">
                  <div className="text-xs text-slate-300">{label}</div>
                  <div className="text-2xl font-bold text-white">{summary?.counts[key] ?? 0}</div>
                  <div className="text-xs text-slate-400">
                    {summary?.total ? ((summary.counts[key] / summary.total) * 100).toFixed(1).replace('.', ',') : '0,0'}% della classe
                  </div>
                </div>
              ))}
            </div>
            <p className="text-sm text-slate-300">
              Totale <strong>{summary?.total}</strong> · Con voto <strong>{summary?.assigned}</strong> ·
              Senza voto <strong>{summary?.missing}</strong>
            </p>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <p role="status" aria-live="polite" className={`text-sm ${invalid ? 'text-rose-300' : dirty ? 'text-amber-300' : 'text-slate-300'}`}>
              {status || (invalid ? 'Almeno un voto non è valido.' : dirty ? 'Modifiche non ancora salvate.' : 'Nessuna modifica da salvare.')}
            </p>
            <button type="button" disabled={!dirty || invalid || saving || !academicYearValid} onClick={() => { void handleSave(); }}
              className="min-h-[44px] flex items-center gap-2 rounded-lg bg-[var(--primary)] text-black font-bold px-4 py-2 disabled:opacity-50">
              <Save className="w-4 h-4" /> {saving ? 'Salvataggio…' : 'Salva valutazioni di ingresso'}
            </button>
          </div>
        </>
      )}
    </section>
  );
};

function getLevel(raw: string): string {
  const score = parseCouncilValue(raw);
  if (score === null) return '—';
  if (score >= 8.5) return 'Alta';
  if (score >= 7) return 'Medio-alta';
  if (score >= 6) return 'Base';
  return 'Sotto soglia';
}
