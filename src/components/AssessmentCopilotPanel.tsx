import React, {useEffect, useRef, useState} from 'react';
import type {AiBudgetProfile} from '../copilot/aiBudgetGovernor';
import {
  prepareAssessmentGenerationSession,
  type AssessmentGenerationSessionV1
} from '../library/assessmentGeneration';
import type {AssessmentDraftV1} from '../library/assessmentDraft';
import type {LibrarySource} from '../library/types';
import {
  AssessmentGenerationError,
  requestAssessmentDraftFromCopilot
} from '../services/assessmentGenerationService';

interface AssessmentCopilotPanelProps {
  source: LibrarySource;
  classId: string;
  className: string;
  classIsUnambiguous: boolean;
  aiBudgetProfile?: AiBudgetProfile;
  getLiveContext: () => {
    source: LibrarySource | null;
    confirmedSourceId: string;
    activeClassName: string;
    activeClassId: string | null;
  };
  onAccept: (session: AssessmentGenerationSessionV1, draft: AssessmentDraftV1) => Promise<void>;
  onClose: () => void;
}

interface GeneratedPreview {
  session: AssessmentGenerationSessionV1;
  draft: AssessmentDraftV1;
}

const remoteErrorCopy: Record<string,string> = {
  CONTEXT_CHANGED: 'La classe o il materiale è cambiato. Controlla la selezione prima di riprovare.',
  REMOTE_POLICY_DENIED: 'Questo materiale non può essere inviato al servizio esterno. Scegline un altro.',
  REQUEST_INVALID: 'Controlla la classe, il materiale e ciò che vuoi verificare.',
  AI_BUDGET_ESCALATION_REQUIRED: 'Il materiale è troppo lungo. Scegli un testo più breve e autorizza nuovamente l’invio.',
  REQUEST_CONFLICT: 'La preparazione delle domande è già in corso.',
  PROVIDER_NOT_CONFIGURED: 'La preparazione assistita non è ancora disponibile.',
  PROVIDER_RATE_LIMITED: 'Non è possibile preparare altre domande in questo momento. Potrai riprovare autorizzando un nuovo invio.',
  PROVIDER_TIMEOUT: 'La preparazione delle domande non è riuscita in tempo. Puoi riprovare.',
  PROVIDER_BLOCKED: 'Non è possibile preparare le domande da questo materiale. Prova con un altro testo.',
  PROVIDER_UNAVAILABLE: 'La preparazione assistita non è disponibile in questo momento. Riprova più tardi.',
  PROVIDER_OUTPUT_INVALID: 'Non è stato possibile ottenere domande utilizzabili. Modifica l’obiettivo e riprova.',
  PROVIDER_ERROR: 'Non è stato possibile preparare le domande. Riprova oppure modifica l’obiettivo.'
};

// The server provider deadline cannot protect a stalled browser-to-server
// connection. A client-side deadline must release the UI without retrying.
const CLIENT_GENERATION_TIMEOUT_MS = 45_000;

export const AssessmentCopilotPanel: React.FC<AssessmentCopilotPanelProps> = ({
  source, classId, className, classIsUnambiguous, aiBudgetProfile, getLiveContext, onAccept, onClose
}) => {
  const [objective,setObjective]=useState('');
  const [remoteConsent,setRemoteConsent]=useState(false);
  const [generating,setGenerating]=useState(false);
  const [adopting,setAdopting]=useState(false);
  const [preview,setPreview]=useState<GeneratedPreview|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [providerLabel,setProviderLabel]=useState('servizio remoto configurato');
  const [providerAvailable,setProviderAvailable]=useState<boolean|null>(null);
  const objectiveRef=useRef<HTMLTextAreaElement|null>(null);
  const previewHeadingRef=useRef<HTMLHeadingElement|null>(null);
  const focusObjectiveAfterPreviewRef=useRef(false);
  const abortRef=useRef<AbortController|null>(null);
  const deadlineRef=useRef<number|null>(null);
  const liveRef=useRef(getLiveContext);
  liveRef.current=getLiveContext;

  useEffect(()=>{
    if(preview)previewHeadingRef.current?.focus();
  },[preview]);

  useEffect(()=>{
    if(!preview && focusObjectiveAfterPreviewRef.current){
      focusObjectiveAfterPreviewRef.current=false;
      objectiveRef.current?.focus();
    }
  },[preview]);

  useEffect(()=>{
    const controller=new AbortController();
    void fetch('/api/copilot/assessment-draft/provider',{signal:controller.signal})
      .then(async response=>{
        if(!response.ok)return;
        const data:unknown=await response.json();
        if(!data || typeof data!=='object')return;
        const info=data as Record<string,unknown>;
        if(typeof info.available==='boolean')setProviderAvailable(info.available);
        if(typeof info.provider==='string' && info.provider.trim()) {
          setProviderLabel(info.provider.trim());
        }
      }).catch(()=>{/* Availability is verified by the explicit POST. */});
    return ()=>{
      controller.abort();
      const pending=abortRef.current;
      abortRef.current=null;
      pending?.abort();
      if(deadlineRef.current!==null){
        window.clearTimeout(deadlineRef.current);
        deadlineRef.current=null;
      }
    };
  },[source.id,classId]);

  const invalidatePreview=()=>{
    setPreview(null);
    setError(null);
  };

  const handleCancelGeneration=()=>{
    const pending=abortRef.current;
    if(!pending)return;
    abortRef.current=null;
    pending.abort();
    if(deadlineRef.current!==null){
      window.clearTimeout(deadlineRef.current);
      deadlineRef.current=null;
    }
    setGenerating(false);
    setRemoteConsent(false);
    setPreview(null);
    setError('Preparazione annullata. Per riprovare, autorizza nuovamente l’invio.');
  };

  const handleGenerate=async()=>{
    if(abortRef.current||generating||adopting||!remoteConsent||!objective.trim()
      || !classIsUnambiguous)return;
    setError(null);
    setPreview(null);
    const controller=new AbortController();
    abortRef.current=controller;
    setGenerating(true);
    const deadline=window.setTimeout(()=>{
      if(abortRef.current!==controller)return;
      abortRef.current=null;
      deadlineRef.current=null;
      controller.abort();
      setGenerating(false);
      setRemoteConsent(false);
      setPreview(null);
      setError('La preparazione richiede troppo tempo. Puoi riprovare autorizzando un nuovo invio.');
    },CLIENT_GENERATION_TIMEOUT_MS);
    deadlineRef.current=deadline;
    try{
      const session=prepareAssessmentGenerationSession({
        source,
        confirmedSourceId:source.id,
        authorizedClassId:classId,
        activeClassName:className,
        confirmedClassName:className,
        objective:objective.trim(),
        explicitTeacherOptIn: true,
        aiBudgetProfile
      });
      const {draft}=await requestAssessmentDraftFromCopilot({
        session,getLiveContext:()=>liveRef.current(),signal:controller.signal
      });
      if(!controller.signal.aborted)setPreview({session,draft});
    }catch(reason){
      if(!controller.signal.aborted){
        setError(reason instanceof AssessmentGenerationError
          ? remoteErrorCopy[reason.code]??remoteErrorCopy.PROVIDER_ERROR
          : 'Non è stato possibile preparare le domande. Riprova oppure modifica l’obiettivo.');
      }
    }finally{
      window.clearTimeout(deadline);
      if(deadlineRef.current===deadline)deadlineRef.current=null;
      if(abortRef.current===controller){
        abortRef.current=null;
        setGenerating(false);
        // The opt-in authorizes exactly one outbound attempt, regardless
        // of success or HTTP failure. A new attempt requires new consent.
        setRemoteConsent(false);
      }
    }
  };

  const handleAdopt=async()=>{
    if(!preview||adopting||generating)return;
    setError(null);
    setAdopting(true);
    try{
      // The explicit teacher click is the sole authorization to open a draft.
      // It does NOT authorize a save, a grade or permanent provenance.
      await onAccept(preview.session,preview.draft);
      onClose();
    }catch(reason){
      setError('Non è stato possibile aprire la proposta nelle Verifiche. Controlla la classe e il materiale.');
    }finally{
      setAdopting(false);
    }
  };

  const sourceAllowed=source.status==='ready'
    && source.privacy==='teacher-professional'
    && ['text','note','concept','web','internal'].includes(source.kind)
    && Boolean(source.extractedText?.trim()||source.payload.text?.trim());

  return (
    <section data-testid="int02-s3c02-assessment-panel"
      aria-label="Proposta di verifica dal Copilota"
      className="space-y-3">
      {!sourceAllowed && (
        <p role="alert" className="text-sm text-amber-200">
          Scegli un materiale testuale della Biblioteca, senza dati personali degli alunni.
        </p>
      )}
      {!classIsUnambiguous && (
        <p role="alert" data-testid="int02-assessment-class-ambiguous"
          className="text-sm text-amber-200">
          Questa classe compare più volte nel Registro. Torna a Classi e scegli quella corretta.
        </p>
      )}
      {!preview&&(
        <>
      <label className="block text-sm font-semibold text-slate-200" htmlFor="s3c02-objective">
        Che cosa vuoi verificare?
      </label>
      <textarea id="s3c02-objective" ref={objectiveRef} data-testid="int02-assessment-objective"
        value={objective} maxLength={400} rows={3}
        onChange={event=>{setObjective(event.target.value);invalidatePreview();}}
        disabled={generating||adopting}
        placeholder="Per esempio: riconoscere le trasformazioni energetiche"
        className="min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-slate-100"
      />
      <details data-testid="int02-assessment-provider-details"
        className="rounded-lg border border-slate-800 text-sm text-slate-300">
        <summary className="min-h-[44px] cursor-pointer px-3 py-3 text-sm">Informazioni sull'invio</summary>
        <p className="border-t border-slate-800 px-3 py-3 leading-relaxed">
          Il materiale e l'obiettivo saranno inviati a un servizio esterno solo con la tua autorizzazione.
          Servizio utilizzato: {providerLabel}{providerAvailable===false?' · non disponibile':''}.
          La proposta non viene salvata o pubblicata automaticamente.
        </p>
      </details>
      <label className="flex items-start gap-3 text-sm leading-relaxed text-slate-200">
        <input type="checkbox" checked={remoteConsent}
          onChange={event=>{setRemoteConsent(event.target.checked);invalidatePreview();}}
          disabled={generating||adopting}
          data-testid="int02-assessment-remote-consent"
          className="mt-1 h-4 w-4"/>
        <span>Autorizzo l'invio del materiale e dell'obiettivo a un servizio esterno. Confermo che non contengono dati personali.</span>
      </label>
      <button type="button" onClick={()=>void handleGenerate()}
        data-testid="int02-assessment-generate"
        disabled={!sourceAllowed||!classIsUnambiguous||!classId||!objective.trim()||!remoteConsent||generating||adopting||providerAvailable===false}
        className="min-h-[44px] w-full rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white disabled:opacity-50">
        {generating?'Preparazione delle domande…':'Prepara le domande'}
      </button>
      {providerAvailable===false&&(
        <p role="status" className="text-sm text-amber-200">La preparazione assistita non è disponibile in questo momento.</p>
      )}
      {generating&&(
        <button type="button" onClick={handleCancelGeneration}
          data-testid="int02-assessment-cancel"
          className="min-h-[44px] w-full rounded-lg border border-amber-700 px-4 text-sm font-semibold text-amber-100">
          Annulla richiesta
        </button>
      )}
      {error&&<p role="alert" data-testid="int02-assessment-error" className="text-sm text-amber-200">{error}</p>}
        </>
      )}
      {preview&&(
        <div data-testid="int02-assessment-preview" className="space-y-3 border-t border-cyan-800 pt-3">
          <div>
            <h4 ref={previewHeadingRef} tabIndex={-1} className="font-semibold text-slate-100">Proposta di verifica</h4>
            <p className="mt-1 text-sm text-slate-200">{preview.draft.title}</p>
            <p className="mt-1 text-sm text-slate-400">
              {preview.draft.questions.length} {preview.draft.questions.length===1?'domanda':'domande'} · Da rivedere · Non salvata
            </p>
          </div>
          <p className="text-sm font-semibold text-amber-200">
            Rivedi domande e risposte prima di salvare la verifica.
          </p>
          {error&&<p role="alert" data-testid="int02-assessment-error"
            className="text-sm text-amber-200">{error}</p>}
          <details data-testid="int02-assessment-questions-details"
            className="rounded-lg border border-slate-700 bg-slate-950/40">
            <summary className="min-h-[44px] cursor-pointer px-3 py-3 text-sm font-semibold text-slate-200">
              Vedi le domande ({preview.draft.questions.length})
            </summary>
            <ol className="space-y-3 border-t border-slate-700 p-3">
              {preview.draft.questions.map((question,index)=>(
                <li key={index} className="rounded-lg border border-slate-700 bg-slate-950/70 p-3 text-sm text-slate-200">
                  <div className="font-semibold">{index+1}. {question.q}</div>
                  <ul className="mt-2 space-y-1">
                    {question.options.map((answer,answerIndex)=>(
                      <li key={answerIndex}>
                        {answerIndex===question.correct?'✓ ':''}{answer}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-slate-300">Spiegazione: {question.explanation}</p>
                </li>
              ))}
            </ol>
          </details>
          <button type="button" onClick={()=>void handleAdopt()}
            disabled={generating||adopting}
            data-testid="int02-assessment-open-editor"
            className="min-h-[48px] w-full rounded-lg bg-cyan-600 px-4 text-sm font-bold text-white disabled:opacity-50">
            {adopting?'Apertura in corso…':'Apri e modifica'}
          </button>
          <button type="button" onClick={()=>{
            focusObjectiveAfterPreviewRef.current=true;
            setPreview(null);
          }}
            disabled={adopting}
            className="min-h-[44px] w-full text-sm text-slate-300 underline underline-offset-4 disabled:opacity-50">
            Modifica l’obiettivo
          </button>
        </div>
      )}
    </section>
  );
};
