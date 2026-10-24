import React, { useMemo, useState } from 'react';
import type { AppSettings, ClassData, OnlineTest, UdaRecord } from '../types';
import { uid } from '../utils';
import { UdaGanttView as LegacyUdaGanttView } from './UdaGanttView.tsx';

type WorkspaceView = 'uda' | 'progress' | 'planning' | 'analysis';

interface UdaWorkspaceViewProps {
  classes: ClassData[];
  udas: UdaRecord[];
  settings?: AppSettings;
  tests?: Record<string, OnlineTest>;
  onSaveUdas: (udas: UdaRecord[]) => Promise<void>;
  onNavigateTab?: (tab: any) => void;
}

const MONTHS = ['Settembre', 'Ottobre', 'Novembre', 'Dicembre', 'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno'];

const selectorClass = (active: boolean) =>
  `min-h-[44px] rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
    active
      ? 'border-cyan-400 bg-cyan-400 text-slate-950 shadow-[0_0_18px_rgba(34,211,238,0.18)]'
      : 'border-slate-700 bg-slate-900/80 text-slate-300 hover:border-cyan-700 hover:text-white'
  }`;

export const UdaWorkspaceView: React.FC<UdaWorkspaceViewProps> = ({
  classes,
  udas,
  settings,
  tests,
  onSaveUdas,
  onNavigateTab
}) => {
  const [activeView, setActiveView] = useState<WorkspaceView>('uda');
  const [classFilter, setClassFilter] = useState('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newClass, setNewClass] = useState(classes[0]?.name ?? '');
  const [newHours, setNewHours] = useState(10);
  const [newPeriod, setNewPeriod] = useState<'Q1' | 'Q2'>('Q1');
  const [newStartMonth, setNewStartMonth] = useState(0);
  const [newDuration, setNewDuration] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const filteredUdas = useMemo(
    () => classFilter === 'all' ? udas : udas.filter(uda => uda.className === classFilter),
    [classFilter, udas]
  );

  const progress = useMemo(() => {
    const lessons = filteredUdas.flatMap(uda => uda.lessons ?? []);
    return {
      udaCount: filteredUdas.length,
      plannedHours: filteredUdas.reduce((sum, uda) => sum + (Number(uda.hours) || 0), 0),
      lessonCount: lessons.length,
      loggedHours: lessons.reduce((sum, lesson) => sum + (Number(lesson.hours) || 0), 0)
    };
  }, [filteredUdas]);

  const openCreate = () => {
    setNewClass(classes[0]?.name ?? '');
    setSaveError(null);
    setIsCreateOpen(true);
  };

  const createUda = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newTitle.trim() || !newClass || isSaving) return;

    const record: UdaRecord = {
      id: uid(),
      title: newTitle.trim(),
      className: newClass,
      hours: Number(newHours) || 10,
      period: newPeriod,
      startMonth: Math.max(0, Math.min(9, Number(newStartMonth))),
      durationMonths: Math.max(1, Math.min(10 - Number(newStartMonth), Number(newDuration))),
      description: 'Progettazione per competenze disciplinari e trasversali.',
      competencies: 'Competenze scientifiche e tecnologiche applicate, cittadinanza attiva.',
      authenticTask: 'Realizzazione di un elaborato/prodotto finale e presentazione orale.',
      rubricLevels: {
        av: "Piena autonomia nell'applicazione di concetti e procedure complesse con spirito critico.",
        in: 'Applicazione corretta e consapevole dei concetti in situazioni note.',
        ba: 'Applicazione delle nozioni essenziali con la guida del docente.',
        pa: 'Conoscenze frammentarie, necessita di supporto continuativo.'
      },
      lessons: [],
      dependencies: []
    };

    setIsSaving(true);
    setSaveError(null);
    try {
      await onSaveUdas([...udas, record]);
      setNewTitle('');
      setIsCreateOpen(false);
      setStatusMessage(`Nuova UDA "${record.title}" creata con successo`);
      window.setTimeout(() => setStatusMessage(null), 3500);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Salvataggio UDA non riuscito.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:p-5 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">Programmazione</p>
          <h2 className="mt-1 text-2xl font-bold text-white">Unità didattiche</h2>
          <p className="mt-1 text-sm text-slate-400">Scegli cosa vuoi fare. Pianificazione e analisi restano disponibili senza occupare la vista di lavoro principale.</p>
        </div>

        <div role="group" aria-label="Viste UDA" className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <button type="button" aria-pressed={activeView === 'uda'} onClick={() => setActiveView('uda')} className={selectorClass(activeView === 'uda')}>UDA</button>
          <button type="button" aria-pressed={activeView === 'progress'} onClick={() => setActiveView('progress')} className={selectorClass(activeView === 'progress')}>Avanzamento</button>
          <button type="button" aria-pressed={activeView === 'planning'} onClick={() => setActiveView('planning')} className={selectorClass(activeView === 'planning')}>Pianificazione</button>
          <button type="button" aria-pressed={activeView === 'analysis'} onClick={() => setActiveView('analysis')} className={selectorClass(activeView === 'analysis')}>Analisi</button>
        </div>
      </section>

      {statusMessage && (
        <div role="status" className="rounded-xl border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm font-semibold text-emerald-200">
          {statusMessage}
        </div>
      )}

      {activeView === 'uda' && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:p-5 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <label className="text-sm text-slate-300 sm:min-w-64">
              Classe di lavoro
              <select value={classFilter} onChange={event => setClassFilter(event.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-950 px-3">
                <option value="all">Tutte le classi</option>
                {classes.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
              </select>
            </label>
            <button type="button" onClick={openCreate} className="min-h-[44px] rounded-xl bg-cyan-400 px-5 py-2 font-semibold text-slate-950">+ Nuova UDA</button>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-slate-800 pt-4">
            <h3 className="text-lg font-semibold text-white">UDA curricolari</h3>
            <span className="text-sm text-slate-500">{filteredUdas.length} UDA</span>
          </div>

          {filteredUdas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-400">Nessuna UDA in questa vista. Crea la prima unità o cambia classe.</div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredUdas.map(uda => (
                <article key={uda.id} className="rounded-xl border border-slate-800 bg-slate-900/65 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="font-semibold text-white">{uda.title}</h4>
                      <p className="mt-1 text-sm text-slate-400">{uda.className} · {uda.period} · {uda.hours} h</p>
                      <p className="mt-1 text-xs text-slate-500">{MONTHS[uda.startMonth] ?? 'Periodo'} · {uda.durationMonths} {uda.durationMonths === 1 ? 'mese' : 'mesi'}</p>
                    </div>
                    <span className="rounded-full border border-slate-700 px-2 py-1 text-xs text-slate-400">{(uda.lessons ?? []).length} lezioni</span>
                  </div>
                  <button type="button" onClick={() => setActiveView('planning')} className="mt-4 min-h-[44px] w-full rounded-lg border border-cyan-900 px-3 py-2 text-sm font-semibold text-cyan-300">Gestisci in Pianificazione</button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeView === 'progress' && (
        <section className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4 md:p-5">
          <div className="mb-4">
            <h3 className="text-xl font-bold text-white">Avanzamento</h3>
            <p className="mt-1 text-sm text-slate-400">Una sintesi operativa delle UDA e delle lezioni registrate.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-800 p-4"><div className="text-2xl font-bold text-cyan-300">{progress.udaCount}</div><div className="mt-1 text-xs uppercase text-slate-500">UDA</div></div>
            <div className="rounded-xl border border-slate-800 p-4"><div className="text-2xl font-bold text-white">{progress.plannedHours}h</div><div className="mt-1 text-xs uppercase text-slate-500">Ore previste</div></div>
            <div className="rounded-xl border border-slate-800 p-4"><div className="text-2xl font-bold text-white">{progress.lessonCount}</div><div className="mt-1 text-xs uppercase text-slate-500">Lezioni</div></div>
            <div className="rounded-xl border border-slate-800 p-4"><div className="text-2xl font-bold text-emerald-300">{progress.loggedHours}h</div><div className="mt-1 text-xs uppercase text-slate-500">Ore registrate</div></div>
          </div>
        </section>
      )}

      {activeView === 'planning' && (
        <section aria-label="Pianificazione UDA" className="space-y-3">
          <div className="rounded-xl border border-cyan-900/60 bg-cyan-950/20 p-4">
            <h3 className="font-semibold text-cyan-200">Pianificazione</h3>
            <p className="mt-1 text-sm text-slate-400">Cronoprogramma, propedeuticità e gestione dettagliata delle UDA.</p>
          </div>
          <LegacyUdaGanttView classes={classes} udas={udas} settings={settings} tests={tests} onSaveUdas={onSaveUdas} onNavigateTab={onNavigateTab} />
        </section>
      )}

      {activeView === 'analysis' && (
        <section aria-label="Analisi UDA" className="space-y-3">
          <div className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4">
            <h3 className="font-semibold text-violet-200">Analisi</h3>
            <p className="mt-1 text-sm text-slate-400">Gap, indicatori e strumenti diagnostici avanzati, visibili solo quando servono.</p>
          </div>
          <LegacyUdaGanttView classes={classes} udas={udas} settings={settings} tests={tests} onSaveUdas={onSaveUdas} onNavigateTab={onNavigateTab} />
        </section>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-labelledby="new-uda-title">
          <form onSubmit={createUda} className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-cyan-900 bg-slate-950 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 id="new-uda-title" className="text-xl font-bold text-white">Nuova Unità Didattica (UDA)</h3>
                <p className="mt-1 text-sm text-slate-400">Inserisci i dati essenziali. I dettagli avanzati restano modificabili in Pianificazione.</p>
              </div>
              <button type="button" onClick={() => setIsCreateOpen(false)} disabled={isSaving} className="min-h-[44px] min-w-[44px] rounded-lg border border-slate-700 text-slate-300" aria-label="Chiudi">×</button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">Titolo
                <input autoFocus value={newTitle} onChange={event => setNewTitle(event.target.value)} placeholder="es. UDA 4: Energie Rinnovabili e Sostenibilità" className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3" />
              </label>
              <label className="block text-sm text-slate-300">Classe
                <select value={newClass} onChange={event => setNewClass(event.target.value)} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3">
                  {classes.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-slate-300">Periodo
                  <select value={newPeriod} onChange={event => setNewPeriod(event.target.value as 'Q1' | 'Q2')} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3"><option value="Q1">Q1</option><option value="Q2">Q2</option></select>
                </label>
                <label className="block text-sm text-slate-300">Ore previste
                  <input type="number" min="1" value={newHours} onChange={event => setNewHours(Number(event.target.value))} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-slate-300">Mese Inizio
                  <select value={newStartMonth} onChange={event => setNewStartMonth(Number(event.target.value))} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3">
                    {MONTHS.map((month, index) => <option key={month} value={index}>{month}</option>)}
                  </select>
                </label>
                <label className="block text-sm text-slate-300">Durata Mesi
                  <input type="number" min="1" max={10 - newStartMonth} value={newDuration} onChange={event => setNewDuration(Number(event.target.value))} className="mt-1 min-h-[44px] w-full rounded-lg border border-slate-700 bg-slate-900 px-3" />
                </label>
              </div>
            </div>

            {saveError && <div role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/40 p-3 text-sm text-red-200">{saveError}</div>}

            <div className="mt-5 flex gap-2">
              <button type="button" onClick={() => setIsCreateOpen(false)} disabled={isSaving} className="min-h-[44px] flex-1 rounded-xl border border-slate-700 px-4 font-semibold text-slate-300">Annulla</button>
              <button type="submit" disabled={isSaving || !newTitle.trim() || !newClass} className="min-h-[44px] flex-1 rounded-xl bg-cyan-400 px-4 font-semibold text-slate-950 disabled:opacity-50">{isSaving ? 'Salvataggio…' : 'Crea UDA'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
