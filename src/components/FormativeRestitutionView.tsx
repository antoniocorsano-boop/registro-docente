import React, { useState } from 'react';
import type { AppSettings, ClassData, UdaRecord } from '../types';
import { formatGrade } from '../utils';
import {
  buildFormativeRestitution, checkedRestitutionDraft, emptyRestitutionDraft,
  RESTITUTION_FIELDS, type FormativeRestitution, type RestitutionDraft, type RestitutionPeriod
} from '../report/formativeRestitution';

interface Props {
  currentClass: ClassData;
  studentId: string;
  settings?: AppSettings;
  udas: readonly UdaRecord[];
}

const periodLabel = (period: RestitutionPeriod) =>
  period === 'Q1' ? '1° periodo' : period === 'Q2' ? '2° periodo' : 'Intero anno scolastico';
const dateLabel = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split('-').reverse().join('/') : 'Data non disponibile';
const buttonClass = 'min-h-[48px] px-3 py-2 rounded-lg border border-[var(--border)] text-sm font-semibold text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300';
const primaryClass = buttonClass + ' bg-cyan-950 border-cyan-500 text-cyan-100 disabled:opacity-50';

function Evidence({ model }: {model: FormativeRestitution}) {
  return (
    <section aria-label="Rendiconto delle valutazioni" className="min-w-0 space-y-3">
      <h3 className="text-base font-semibold text-slate-100">Rendiconto delle valutazioni</h3>
      <div className="student-report-metrics grid grid-cols-2 gap-3 border-y border-[var(--border)] py-3">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">Media {model.weighted ? 'ponderata' : 'aritmetica'}</p>
          <p data-testid="restitution-mean" className="text-2xl font-semibold">{formatGrade(model.summary.mean)}</p>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-slate-400">Registrazioni</p>
          <p data-testid="restitution-count" className="text-2xl font-semibold">{model.summary.count}</p>
        </div>
      </div>
      <p className="text-sm text-slate-300">
        {model.summary.numericCount} valutazioni numeriche; {model.summary.count-model.summary.numericCount} registrazioni senza voto numerico.
        {' '}{model.summary.includedCount} voti concorrono alla media.
        {' '}La media è un indicatore di andamento, non un voto di scrutinio.
      </p>
      {model.summary.mean === null && <p className="text-sm text-slate-300">Media non disponibile: non equivale a un giudizio negativo.</p>}
      {model.byType.length > 0 && (
        <div className="divide-y divide-[var(--border)]" aria-label="Riepilogo per tipologia">
          <h4 className="py-2 font-semibold text-sm">Riepilogo per tipologia</h4>
          {model.byType.map(item => (
            <div key={item.type} className="flex flex-wrap justify-between gap-2 py-2 text-sm">
              <div className="min-w-0 break-words">
                <p>{item.label}</p>
                <p className="text-xs text-slate-400">{item.count} registrazioni · {item.includedCount} nella media{item.weight !== null ? ' · Peso ' + item.weight + '%' : ''}</p>
              </div>
              <b>{formatGrade(item.mean)}</b>
            </div>
          ))}
        </div>
      )}
      <h4 className="pt-2 text-sm font-semibold">Attività registrate nel periodo</h4>
      {model.rows.length === 0 ? <p className="text-sm text-slate-400">Nessuna registrazione disponibile per il periodo selezionato.</p> :
        <div data-testid="restitution-rows" className="divide-y divide-[var(--border)]">
          {model.rows.map((row,index) => (
            <article data-testid="restitution-row" key={index} className="min-w-0 py-3 flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 basis-40 break-words">
                <p className="font-semibold text-sm">{row.title}</p>
                <p className="text-xs text-slate-400">{dateLabel(row.date)} · {periodLabel(row.period)} · {row.type}</p>
                {row.uda && <p className="text-xs text-slate-400">{row.uda}</p>}
                {row.delayed && <p className="text-xs text-slate-400">Ritardo / recupero registrato</p>}
              </div>
              <div className="min-w-0 break-words">
                <p className="font-semibold">{row.value}</p>
                {!row.included && <p className="text-xs text-slate-400">Fuori media</p>}
              </div>
            </article>
          ))}
        </div>
      }
      <p className="text-xs text-slate-400">L’elenco comprende tutte le registrazioni disponibili per il destinatario e il periodo. Attività non registrate non sono desunte dall’assenza di un voto.</p>
    </section>
  );
}

function DraftEditor({ model, names }: {model: FormativeRestitution; names: readonly string[]}) {
  const [draft,setDraft] = useState<RestitutionDraft>(emptyRestitutionDraft);
  const [preview,setPreview] = useState<RestitutionDraft | null>(null);
  const [confirmed,setConfirmed] = useState(false);
  const [validated,setValidated] = useState(false);
  const [error,setError] = useState('');
  const preparePreview = () => {
    const checked = checkedRestitutionDraft(draft,names);
    if (!checked) { setError('Rimuovi i nominativi e controlla la lunghezza dei testi.'); return; }
    setError('');
    setConfirmed(false);
    setValidated(false);
    setPreview(checked);
  };
  const edit = () => { setPreview(null); setConfirmed(false); setValidated(false); };
  return (
    <div className="min-w-0 space-y-4" data-testid="restitution-draft">
      {!preview ? (
        <>
          <Evidence model={model}/>
          <div className="space-y-3 border-t border-[var(--border)] pt-4">
            <h3 className="text-base font-semibold">Restituzione del docente</h3>
            <p className="text-sm text-slate-300">Compila solo i campi pertinenti, sulla base delle evidenze disponibili. Evita nominativi, informazioni di altri alunni e annotazioni riservate. I campi vuoti non compariranno nel documento.</p>
            {RESTITUTION_FIELDS.map(([field,label]) => (
              <label key={field} className="block space-y-1">
                <span className="text-sm font-medium">{label}</span>
                <textarea className="neon-input w-full min-h-[76px] p-2 text-sm resize-y"
                  maxLength={1200} rows={2} value={draft[field]}
                  onChange={e => {setDraft(old=>({...old,[field]:e.target.value}));setError('');}}/>
              </label>
            ))}
            {error && <p role="alert" className="text-sm text-amber-200">{error}</p>}
            <button type="button" className={primaryClass+' w-full'} onClick={preparePreview}>Controlla anteprima</button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-2">
            <p className="text-sm font-semibold">{validated ? 'Anteprima validata' : 'Anteprima da verificare'}</p>
            <p className="text-xs text-slate-400">È la restituzione da comunicare, non il dossier interno. Nessun documento è stato ancora salvato o inviato.</p>
          </div>
          <article data-testid="restitution-preview" className="min-w-0 space-y-4 border-y border-[var(--border)] py-4">
            <header className="space-y-1 break-words">
              <h3 className="text-lg font-semibold">Bilancio formativo individuale</h3>
              <p className="text-sm">{model.subject} · {model.schoolYear}</p>
              <p className="text-sm">{model.classLabel} · {periodLabel(model.period)}</p>
              <p className="text-sm text-slate-400">Destinatario protetto</p>
            </header>
            {RESTITUTION_FIELDS.map(([field,label]) => preview[field] ? (
              <section key={field} className="space-y-1">
                <h4 className="text-sm font-semibold">{label}</h4>
                <p className="text-sm whitespace-pre-wrap break-words">{preview[field]}</p>
              </section>
            ) : null)}
            <Evidence model={model}/>
          </article>
          {!validated && (
            <label className="flex items-start gap-3 py-2 text-sm">
              <input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} className="mt-1 shrink-0 h-5 w-5"/>
              <span>Ho verificato il destinatario, i dati e i testi. Non contengono nominativi, dati di altri alunni o informazioni riservate.</span>
            </label>
          )}
          {validated && <p role="status" className="text-sm text-emerald-300">Validazione locale completata. L’anteprima resta disponibile in questa sessione; non è un documento ufficiale o un invio alla famiglia.</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass+' flex-1'} onClick={edit}>Modifica</button>
            {!validated && <button type="button" className={primaryClass+' flex-1'} disabled={!confirmed} onClick={()=>setValidated(true)}>Valida anteprima</button>}
          </div>
        </>
      )}
    </div>
  );
}

export const FormativeRestitutionView: React.FC<Props> = ({currentClass, studentId, settings, udas}) => {
  const [period,setPeriod] = useState<RestitutionPeriod>('all');
  const model = buildFormativeRestitution(currentClass,studentId,period,settings,udas);
  if (!model) return <p role="alert" className="text-sm">Destinatario non verificabile. Seleziona nuovamente l’alunno.</p>;
  return (
    <section data-testid="student-report-restitution" aria-label="Restituzione" className="min-w-0 space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Bilancio formativo individuale</h2>
        <p className="text-sm text-slate-400">Per l’alunno e la famiglia. Bozza di lavoro non salvata: il cambio di periodo, destinatario, protezione o vista azzera la preparazione.</p>
      </div>
      <label className="block space-y-1">
        <span className="text-sm font-semibold">Periodo</span>
        <select aria-label="Periodo" value={period} onChange={e=>setPeriod(e.target.value as RestitutionPeriod)} className="neon-input w-full min-h-[48px] p-2 text-sm">
          <option value="all">Intero anno scolastico</option>
          <option value="Q1">1° periodo</option>
          <option value="Q2">2° periodo</option>
        </select>
      </label>
      <DraftEditor key={JSON.stringify([model,currentClass.students.map(s=>s.name)])} model={model} names={currentClass.students.map(s=>s.name)}/>
    </section>
  );
};
