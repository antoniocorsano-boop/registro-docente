import React, { useState } from 'react';
import { renderFormativePdf } from '../report/formativePdfRendering';
import { saveWorkPdfOnAndroid } from '../security/androidPdfExport';
import { isAndroidBackupRuntime } from '../security/androidBackupExport';
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
        {model.summary.count} attività registrate: {model.summary.numericCount} con voto numerico e {model.summary.count-model.summary.numericCount} senza voto numerico.
        {' '}{model.summary.includedCount} voti utilizzati per calcolare la media.
        {' '}{model.weighted ? 'La media ponderata tiene conto del peso assegnato ai diversi tipi di prova.' : 'La media aritmetica è la media dei voti numerici: ogni voto incluso ha lo stesso peso.'}
        {' '}La media aiuta a capire l’andamento degli apprendimenti. Non è il voto finale di scrutinio.
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
      <p className="text-xs text-slate-400">L’elenco comprende tutte le attività registrate per questo alunno nel periodo scelto. Un’attività senza voto numerico non è automaticamente un’insufficienza. Le voci fuori media non entrano nel calcolo.</p>
    </section>
  );
}

function DraftEditor({ model, names }: {model: FormativeRestitution; names: readonly string[]}) {
  const [draft,setDraft] = useState<RestitutionDraft>(emptyRestitutionDraft);
  const [preview,setPreview] = useState<RestitutionDraft | null>(null);
  const [confirmed,setConfirmed] = useState(false);
  const [validated,setValidated] = useState(false);
  const [error,setError] = useState('');
  const [exporting,setExporting] = useState(false);
  const [exportMessage,setExportMessage] = useState('');
  const mounted=React.useRef(false);
  const pending=React.useRef(false);
  React.useLayoutEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const savePdf=async()=>{
    if(!preview||!validated||pending.current||!mounted.current)return;
    if(!window.confirm('Verifica il destinatario e la cartella. Il PDF contiene informazioni riservate e non è cifrato. Salvalo localmente; nessun invio automatico. Continuare?'))return;
    pending.current=true;setExporting(true);setExportMessage('');
    const isActive=()=>mounted.current;
    try{
      const bytes=await renderFormativePdf(model,preview);
      if(!isActive())return;
      const filename='Bilancio_Formativo_'+new Date().toISOString().slice(0,10)+'.pdf';
      if(isAndroidBackupRuntime()){
        const receipt=await saveWorkPdfOnAndroid(bytes,filename,isActive);
        if(isActive())setExportMessage(receipt==='verified'?'PDF salvato e verificato nella cartella scelta.':'Salvataggio annullato.');
      }else{
        const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));
        try{const link=document.createElement('a');link.href=url;link.download=filename;link.click();}
        finally{setTimeout(()=>URL.revokeObjectURL(url),30000);}
        if(isActive())setExportMessage('Scaricamento avviato. Verifica il file nella cartella del dispositivo.');
      }
    }catch{if(isActive())setExportMessage('PDF non salvato o non verificato. Controlla la cartella e riprova.');}
    finally{pending.current=false;if(isActive())setExporting(false);}
  };
  const preparePreview = () => {
    const checked = checkedRestitutionDraft(draft,names);
    if (!checked) { setError('Rimuovi i nominativi e controlla la lunghezza dei testi.'); return; }
    setError('');
    setConfirmed(false);
    setValidated(false);
    setPreview(checked);
  };
  const edit = () => { if(pending.current)return; setPreview(null); setConfirmed(false); setValidated(false); setExportMessage(''); };
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
                <textarea aria-label={label} className="neon-input w-full min-h-[76px] p-2 text-sm resize-y"
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
            <p className="text-xs text-slate-400">È la restituzione da comunicare, non il dossier interno. Nessun invio automatico alla famiglia.</p>
          </div>
          <article data-testid="restitution-preview" className="min-w-0 space-y-4 border-y border-[var(--border)] py-4">
            <header className="space-y-1 break-words">
              <h3 className="text-lg font-semibold">Bilancio formativo individuale</h3>
              <p className="text-sm">{model.subject} · {model.schoolYear}</p>
              <p className="text-sm">{model.classLabel} · {periodLabel(model.period)}</p>
              <p className="text-sm text-slate-400">{model.recipientLabel}</p>
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
            <button type="button" className={buttonClass+' flex-1 disabled:opacity-50'} disabled={exporting} onClick={edit}>Modifica</button>
            {!validated && <button type="button" className={primaryClass+' flex-1'} disabled={!confirmed} onClick={()=>setValidated(true)}>Valida anteprima</button>}
            {validated && <button type="button" className={primaryClass+' flex-1'} disabled={exporting} onClick={savePdf}>{exporting?'Salvataggio in corso…':'Salva PDF'}</button>}
          </div>
          {exportMessage && <p data-testid="restitution-export-status" aria-live="polite" className="text-sm text-slate-200">{exportMessage}</p>}

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
