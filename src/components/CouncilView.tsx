import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, ClassData, CouncilSessionKind } from '../types';
import type { PlanningDraftGuard } from './planning/PlanningProfileEditor';
import { buildCouncilEvidenceOverview } from '../council/councilEvidenceOverview';
import { councilRows, isCouncilSessionDateValid, normalizeSchoolYear, parseCouncilValue, readCouncilSessions, readCouncilValues, summarizeCouncilValues } from '../council/councilModel';
import { formatGrade, formatStudentNameWithPrivacy, today, uid } from '../utils';
import { ClipboardList, Save, Users } from 'lucide-react';

const SESSION_LABELS: Record<CouncilSessionKind, string> = {
  ingresso: 'Ingresso',
  intermedia: 'Primo periodo',
  monitoraggio: 'Monitoraggio',
  finale: 'Finale',
  altro: 'Altra seduta'
};

interface CouncilViewProps {
  classes: ClassData[];
  settings: AppSettings;
  isPrivacyShieldActive: boolean;
  onSave: (classId: string, schoolYear: string, values: Record<string, string>) => Promise<void>;
  onCreateSession: (
    classId: string, schoolYear: string, kind: CouncilSessionKind, date: string, sessionId: string
  ) => Promise<void>;
  onRegisterDraftGuard?: (guard: PlanningDraftGuard | null) => void;
}

export const CouncilView: React.FC<CouncilViewProps> = ({
  classes, settings, isPrivacyShieldActive, onSave, onCreateSession, onRegisterDraftGuard
}) => {
  // Class choice is explicit. Do not infer one from the current navigation context.
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedYear, setSelectedYear] = useState(() => normalizeSchoolYear(settings.year) ?? settings.year);
  const [sessionKind, setSessionKind] = useState<CouncilSessionKind>('monitoraggio');
  const [sessionDate, setSessionDate] = useState(today);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionStatus, setSessionStatus] = useState('');
  const [openedSessionId, setOpenedSessionId] = useState('');
  const [cutoff, setCutoff] = useState(today);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const schoolYear = selectedYear;
  const academicYearValid = normalizeSchoolYear(schoolYear) !== null;
  const current = classes.find(item => item.id === selectedClassId);
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = normalizeSchoolYear(settings.year);
    if (currentYear) years.add(currentYear);
    for (const c of classes) {
      for (const entry of c.councilAssessments ?? []) {
        const year = normalizeSchoolYear(entry.schoolYear);
        if (year) years.add(year);
      }
      for (const session of c.councilSessions ?? []) {
        const year = normalizeSchoolYear(session.schoolYear);
        if (year) years.add(year);
      }
    }
    if (normalizeSchoolYear(selectedYear)) years.add(normalizeSchoolYear(selectedYear)!);
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [classes, selectedYear, settings.year]);
  const sessions = useMemo(
    () => current ? readCouncilSessions(current, schoolYear) : [], [current, schoolYear]
  );
  const openedSession = sessions.find(item => item.id === openedSessionId);
  const sessionDateValid = isCouncilSessionDateValid(sessionDate, schoolYear);

  useEffect(() => {
    const next = current ? readCouncilValues(current, schoolYear) : {};
    setDraft(next);
    setSaved(next);
    setStatus('');
    setSessionStatus('');
    setOpenedSessionId('');
    // Only an explicit class/year switch resets the draft, never an unrelated re-render.
  }, [selectedClassId, schoolYear]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const rows = useMemo(
    () => current ? councilRows(current, schoolYear, cutoff, settings) : [],
    [current, schoolYear, cutoff, settings]
  );
  // CDC-02/S2a: live, read-only counts; not a stored snapshot of the selected session.
  const evidenceOverview = useMemo(
    () => current ? buildCouncilEvidenceOverview(current, schoolYear, cutoff, settings) : null,
    [current, schoolYear, cutoff, settings]
  );
  const summary = current ? summarizeCouncilValues(current.students, draft) : null;
  const invalid = Object.values(draft).some(value => value.trim() !== '' && parseCouncilValue(value) === null);

  const dirtyRef = useRef(dirty);
  const savingRef = useRef(saving);
  const sessionSavingRef = useRef(sessionSaving);
  dirtyRef.current = dirty;
  savingRef.current = saving;
  sessionSavingRef.current = sessionSaving;

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (savingRef.current || sessionSavingRef.current) return false;
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
      hasUnsavedChanges: () => dirtyRef.current || savingRef.current || sessionSavingRef.current,
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
      if (!dirtyRef.current && !savingRef.current && !sessionSavingRef.current) return;
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
    if (savingRef.current || sessionSavingRef.current) return;
    if (dirty && !window.confirm('Ci sono valutazioni di ingresso non salvate. Cambiare classe e scartarle?')) return;
    setSelectedClassId(id);
  };

  const changeYear = (year: string) => {
    if (savingRef.current || sessionSavingRef.current) return;
    if (dirty && !window.confirm('Ci sono valutazioni non salvate. Cambiare anno e scartarle?')) return;
    setSelectedYear(year);
  };

  const createSession = async () => {
    if (!current || savingRef.current || sessionSavingRef.current || dirty || !sessionDateValid) return;
    const id = uid();
    sessionSavingRef.current = true;
    setSessionSaving(true);
    setSessionStatus('Registrazione della seduta nell’archivio cifrato…');
    try {
      await onCreateSession(current.id, schoolYear, sessionKind, sessionDate, id);
      setOpenedSessionId(id);
      setSessionStatus('Seduta salvata. Puoi ritrovarla nell’elenco cronologico.');
    } catch {
      setSessionStatus('Salvataggio della seduta non riuscito. I dati precedenti sono invariati.');
    } finally {
      sessionSavingRef.current = false;
      setSessionSaving(false);
    }
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
    <section className="neon-card min-w-0 max-w-full p-4 sm:p-5 space-y-5" aria-label="Consigli di classe">
      <header className="border-b border-[var(--border)] pb-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[var(--primary)]" /> Consigli di classe
        </h1>
        <p className="text-sm text-slate-300 mt-1">Archivio dei Consigli · anno scolastico {schoolYear}.</p>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="text-sm text-slate-300 font-semibold">
          Anno scolastico
          <select aria-label="Seleziona anno scolastico del Consiglio" value={schoolYear}
            onChange={event => changeYear(event.target.value)} disabled={saving || sessionSaving}
            className="mt-1 w-full p-2.5 rounded-lg border border-[var(--border)] bg-slate-900 text-white">
            {availableYears.length === 0 && <option value={schoolYear}>{schoolYear}</option>}
            {availableYears.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
        </label>
        <label className="text-sm text-slate-300 font-semibold">
          Classe
          <select aria-label="Seleziona classe per il Consiglio" value={selectedClassId}
            onChange={event => changeClass(event.target.value)} disabled={saving || sessionSaving}
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

      <div className="flex flex-wrap items-center gap-2 text-sm">
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
          <section className="rounded-lg border border-[var(--border)] p-4 space-y-4" aria-label="Archivio sedute del Consiglio">
            <div>
              <h2 className="font-bold text-white text-lg">Sedute e storico · {current.name}</h2>
              <p className="text-xs text-slate-400 mt-1">
                Registrazioni personali del docente, non verbali né deliberazioni ufficiali.
                Le sedute restano distinte dalle valutazioni di ingresso.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <label className="text-sm text-slate-300 font-semibold">
                Tipo di seduta
                <select aria-label="Tipo di nuova seduta" value={sessionKind}
                  onChange={event => setSessionKind(event.target.value as CouncilSessionKind)}
                  disabled={sessionSaving || saving}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-slate-900 p-2 text-white">
                  {(Object.keys(SESSION_LABELS) as CouncilSessionKind[]).map(kind =>
                    <option key={kind} value={kind}>{SESSION_LABELS[kind]}</option>
                  )}
                </select>
              </label>
              <label className="text-sm text-slate-300 font-semibold">
                Data della seduta
                <input type="date" aria-label="Data di nuova seduta" value={sessionDate}
                  onChange={event => setSessionDate(event.target.value)}
                  disabled={sessionSaving || saving}
                  className="mt-1 w-full min-h-[44px] rounded-lg border border-[var(--border)] bg-slate-900 p-2 text-white" />
              </label>
              <button type="button" onClick={() => { void createSession(); }}
                disabled={!sessionDateValid || !academicYearValid || sessionSaving || saving || dirty}
                className="min-h-[44px] rounded-lg border border-[var(--border)] px-3 py-2 font-semibold text-slate-100 hover:bg-slate-800 disabled:opacity-50">
                {sessionSaving ? 'Salvataggio…' : 'Registra seduta'}
              </button>
            </div>
            {!sessionDateValid && <p role="alert" className="text-sm text-amber-300">
              La data deve appartenere all’anno scolastico selezionato (1 settembre – 31 agosto).
            </p>}
            {dirty && <p className="text-xs text-amber-300">Salva o annulla le modifiche ai voti prima di registrare una seduta.</p>}
            <p role="status" aria-live="polite" className="text-sm text-slate-300">{sessionStatus}</p>
            <h3 className="font-semibold text-slate-100">Sedute archiviate ({sessions.length})</h3>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-400">Nessuna seduta registrata per questa classe e questo anno.</p>
            ) : (
              <ul className="space-y-2" aria-label="Elenco cronologico delle sedute">
                {sessions.map(session => (
                  <li key={session.id}>
                    <button type="button" onClick={() => setOpenedSessionId(session.id)}
                      aria-pressed={openedSessionId === session.id}
                      className={`w-full text-left min-h-[44px] rounded-lg border p-3 text-sm ${openedSessionId === session.id ? 'border-[var(--primary)] text-white bg-slate-800' : 'border-[var(--border)] text-slate-200'}`}>
                      {session.date} · {SESSION_LABELS[session.kind]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {openedSession && (
              <div role="region" aria-label="Seduta recuperata" className="rounded-lg bg-slate-900/60 p-3">
                <p className="text-sm font-semibold text-white">
                  Seduta recuperata: {SESSION_LABELS[openedSession.kind]} del {openedSession.date}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Registrazione conservata nel dispositivo. Ordine del giorno, note e seguito saranno aggiunti nella fase CDC-02/S3.
                </p>
              </div>
            )}
          </section>
          <section className="rounded-lg border border-[var(--border)] p-4 space-y-3"
            aria-label="Quadro sintetico delle evidenze della classe">
            <h2 className="text-lg font-bold text-white">Quadro della classe</h2>
            {evidenceOverview ? (
              <>
                <p className="text-xs text-slate-300">
                  Dati correnti fino al <strong>{evidenceOverview.effectiveCutoff}</strong> per l’anno
                  {evidenceOverview.schoolYear}. Non sono una fotografia storica della seduta e
                  non costituiscono una valutazione collegiale.
                  {evidenceOverview.cutoffClampedToSchoolYear
                    ? ' La data richiesta supera la fine dell’anno: il calcolo si ferma al 31 agosto.'
                    : ''}
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {([
                    ['Alunni', evidenceOverview.totalStudents],
                    ['Con prove numeriche', evidenceOverview.withNumericEvidence],
                    ['Senza prove numeriche', evidenceOverview.withoutNumericEvidence],
                    ['Prove numeriche totali', evidenceOverview.numericEvidenceCount],
                    ['Con voto di ingresso salvato', evidenceOverview.withSavedTeacherProposal],
                    ['Senza voto di ingresso salvato', evidenceOverview.withoutSavedTeacherProposal]
                  ] as const).map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[var(--border)] p-3">
                      <p className="text-xs text-slate-300">{label}</p>
                      <p className="text-xl font-bold text-white tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  «Senza prove» e «senza voto di ingresso» sono condizioni diverse.
                  Il quadro conta soltanto i voti di ingresso già salvati, non le modifiche ancora in bozza.
                  Le prove non numeriche non contribuiscono al conteggio delle prove numeriche.
                </p>
              </>
            ) : (
              <p role="alert" className="text-sm text-amber-300">
                Quadro non disponibile: controllare anno, data limite e identità della classe.
              </p>
            )}
          </section>

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

          <p id="council-table-scroll-hint" className="text-xs text-slate-400 sm:hidden">
            Scorri la tabella orizzontalmente per vedere tutti i valori: la colonna Alunno rimane visibile.
          </p>
          <div
            role="region"
            aria-label="Tabellone delle valutazioni di ingresso"
            aria-describedby="council-table-scroll-hint"
            tabIndex={0}
            className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain scroll-pl-[148px] rounded-lg border border-[var(--border)]"
          >
            <table className="w-full min-w-[680px] table-fixed text-sm text-left">
              <colgroup>
                <col className="w-36" />
                <col className="w-[72px]" />
                <col className="w-36" />
                <col className="w-40" />
                <col className="w-40" />
              </colgroup>
              <thead className="bg-slate-900 text-slate-200">
                <tr>
                  <th scope="col" className="sticky left-0 z-20 w-36 min-w-36 max-w-36 border-r border-[var(--border)] bg-slate-900 p-3">Alunno</th>
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
                      <th scope="row" className="sticky left-0 z-10 w-36 min-w-36 max-w-36 border-r border-[var(--border)] bg-[var(--surface)] p-3 text-left font-medium leading-snug text-white whitespace-normal break-words">
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
