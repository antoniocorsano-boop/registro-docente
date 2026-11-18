import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MatrixSurfaceSelector,type MatrixSurface} from '../../../src/components/MatrixSurfaceSelector';
import {DailyMatrixWorkspace} from '../../../src/components/DailyMatrixWorkspace';
import {MatrixView} from '../../../src/components/MatrixView';
import {StudentReportView} from '../../../src/components/StudentReportView';
import type {EvaluationDraftGuard} from '../../../src/components/MatrixEvaluationEntry';
import type {EvidenceCommitRequest} from '../../../src/assessment/assessmentEvidenceMutation';
import {projectIndividualAssessmentEvidence} from '../../../src/assessment/assessmentEvidenceProjection';
import {boardScope} from './val01-s6c-data';
import {SyntheticEvidenceBoard} from './val01-s6c-board';
import {openOperationalArchive,recoverOperationalArchive,commitOperationalEvidence,operationalState,operationalDiagnostics} from './val01-s6d-db2.fixture';
import '../../../src/index.css';
type Snapshot=Awaited<ReturnType<typeof openOperationalArchive>>;
const states={observed:'Osservato',not_observed:'Non osservato',not_applicable:'Non pertinente'};
const noWrite=async():Promise<never>=>{throw Error('Laboratorio: voti ordinari non modificabili');};

function Laboratory(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [opening,setOpening]=useState(false),[openError,setOpenError]=useState(false);
 const [surface,setSurface]=useState<MatrixSurface>('daily');
 const [report,setReport]=useState<string|null>(null);
 const [blocked,setBlocked]=useState(false);
 const [recoveryRequired,setRecoveryRequired]=useState(false);
 const evidenceDirty=useRef(false);
 const dailyGuard=useRef<EvaluationDraftGuard|null>(null);
 const openingRef=useRef(false);
 const registerDailyGuard=useCallback((guard:EvaluationDraftGuard|null)=>{dailyGuard.current=guard;},[]);
 useEffect(()=>{
  const beforeUnload=(event:BeforeUnloadEvent)=>{if(evidenceDirty.current||dailyGuard.current?.hasUnsavedChanges()){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);
  return ()=>window.removeEventListener('beforeunload',beforeUnload);
 },[]);
 async function unlock(){
  if(openingRef.current)return;
  openingRef.current=true;setOpening(true);setOpenError(false);
  try{setSnapshot(await openOperationalArchive());}
  catch{setOpenError(true);}
  finally{openingRef.current=false;setOpening(false);}
 }
 if(!snapshot)return <main className="max-w-xl mx-auto p-3 space-y-3">
  <h1 className="font-semibold">Registro dimostrativo protetto</h1>
  <p>Archivio esclusivamente sintetico. Nessun accesso al Registro effettivo.</p>
  <button type="button" className="min-h-[48px] rounded border px-3" disabled={opening} onClick={unlock}>Apri archivio dimostrativo</button>
  {opening&&<p role="status">Apertura archivio…</p>}
  {openError&&<p role="alert">Archivio non disponibile.</p>}
 </main>;
 const data=snapshot.appData,evidence=snapshot.document,currentClass=data.classes.find(c=>c.id===boardScope.classId)!;
 const dirty=()=>evidenceDirty.current||!!dailyGuard.current?.hasUnsavedChanges()||recoveryRequired;
 const request=(action:()=>void)=>{if(dirty()){setBlocked(true);return;}setBlocked(false);action();};
 const openReport=(id:string)=>request(()=>{if(boardScope.studentIds.includes(id))setReport(id);});
 const projection=report?projectIndividualAssessmentEvidence(evidence,boardScope,report):null;
 async function commit(reviewed:EvidenceCommitRequest,confirmation:unknown){
  try{
   const receipt=await commitOperationalEvidence(reviewed,confirmation);
   setSnapshot(operationalState());return receipt;
  }catch(error){setRecoveryRequired(true);throw error;}
 }
 async function recover(){const next=await recoverOperationalArchive();setSnapshot(next);setRecoveryRequired(false);setBlocked(false);}
 return <main className="mx-auto max-w-5xl min-w-0 p-[8px] space-y-3 [overflow-wrap:anywhere]">
  <p className="text-sm">Laboratorio operativo · Classe sintetica · Protezione identità attiva</p>
  {!report&&<MatrixSurfaceSelector laboratory mode={surface} onChange={next=>{if(next!==surface)request(()=>setSurface(next));}}/>}
  {blocked&&<p role="alert">Completa o abbandona la bozza prima di cambiare vista.</p>}
  {!report&&surface==='daily'&&<DailyMatrixWorkspace data={data} currentClass={currentClass} udas={[]} isPrivacyShieldActive={true}
    onRegisterDraftGuard={registerDailyGuard} requestChange={request} onSaveGrade={noWrite} onSaveObservation={noWrite}/>}
  {!report&&surface==='historical'&&<MatrixView currentClass={currentClass} isPrivacyShieldActive={true} onOpenStudentReport={openReport}/>}
  <div hidden={!!report||surface!=='evidence'} className={report||surface!=='evidence'?'hidden':''}>
   <SyntheticEvidenceBoard committedDocument={evidence} onCommit={commit} recoveryRequired={recoveryRequired} onRecover={recover}
    onDraftChange={value=>{evidenceDirty.current=value;if(!value)setBlocked(false);}} onOpenStudentReport={openReport}/>
  </div>
  {report&&<section aria-label="Scheda alunno dimostrativa" className="space-y-3">
   <button type="button" className="min-h-[48px] rounded border px-3" onClick={()=>{setReport(null);setBlocked(false);}}>Torna al Tabellone</button>
   <StudentReportView currentClass={currentClass} selectedStudentId={report} onSelectStudent={id=>{if(boardScope.studentIds.includes(id))setReport(id);}} isPrivacyShieldActive={true} udas={[]}/>
   <section aria-label="Evidenze individuali" className="rounded border p-2 space-y-2">
    <h2 className="font-semibold">Evidenze individuali — consultazione</h2>
    <p>Studente {boardScope.studentIds.indexOf(report)+1}</p>
    <p>Non costituiscono un voto, una sintesi di competenza o una certificazione.</p>
    {projection?.valid?projection.entries.length?projection.entries.map(e=>{
      const row=evidence.evidence.find(x=>x.revisionId===e.evidenceRevisionId);
      const assessment=evidence.assessments.find(a=>a.revisionId===e.assessmentRevisionId);
      const criterion=evidence.criteria.find(c=>c.revisionId===e.criterionRevisionId);
      const rubric=evidence.rubrics.find(r=>r.revisionId===assessment?.criteria.find(c=>c.criterionRevisionId===e.criterionRevisionId)?.rubricRevisionId);
      const level=row?.state==='observed'&&row.interpretation.kind==='level'?rubric?.criteria.find(c=>c.criterionRevisionId===e.criterionRevisionId)?.levels.find(l=>l.levelId===(row.interpretation.kind==='level'?row.interpretation.levelId:'')):null;
      return <div key={e.evidenceRevisionId} className="border-t py-2 space-y-1">
       <p className="font-medium">{assessment?.title}</p><p>{criterion?.description}</p><p>{states[e.state]}</p>
       {e.targetReferenceRevisionIds.map(id=><p key={id}>Obiettivo: {evidence.references.find(r=>r.revisionId===id)?.text}</p>)}
       {row?.state==='observed'&&<><p>Fatto: {row.fact.description}</p><p>Metodo: {row.fact.method}</p><p>Interpretazione: {row.interpretation.kind==='pending'?'Da definire':row.interpretation.kind==='description'?row.interpretation.description:level?.label??'Livello confermato'}</p>{level&&<p>{level.description}</p>}</>}
      </div>;
    }):<p>Nessuna evidenza attiva registrata.</p>:<p role="alert">Evidenze non disponibili.</p>}
   </section>
  </section>}
 </main>;
}
Object.assign(globalThis,{__val01OperationalDiagnostics:operationalDiagnostics});
createRoot(document.getElementById('root')!).render(<Laboratory/>);
