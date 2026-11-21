import React,{useCallback,useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MatrixSurfaceSelector,type MatrixSurface} from '../../../src/components/MatrixSurfaceSelector';
import {DailyMatrixWorkspace} from '../../../src/components/DailyMatrixWorkspace';
import {MatrixView} from '../../../src/components/MatrixView';
import {CouncilView} from '../../../src/components/CouncilView';
import {appendCouncilSession} from '../../../src/council/councilModel';
import type {ConfirmedFormativeBalance} from '../../../src/council/councilDisciplinaryContribution';
import {SyntheticCouncilContribution} from './val01-s8-contribution';
import type {AppData,AppSettings} from '../../../src/types';
import {StudentReportView} from '../../../src/components/StudentReportView';
import type {EvaluationDraftGuard} from '../../../src/components/MatrixEvaluationEntry';
import type {EvidenceCommitRequest} from '../../../src/assessment/assessmentEvidenceMutation';
import {previewIndividualObservation} from '../../../src/assessment/individualObservation';
import {previewEvidenceRevision} from '../../../src/assessment/individualEvidenceRevision';
import {SyntheticFormativeBalance} from './val01-s7b-balance';
import {projectIndividualAssessmentEvidence} from '../../../src/assessment/assessmentEvidenceProjection';
import {boardScope} from './val01-s6c-data';
import {SyntheticEvidenceBoard} from './val01-s6c-board';
import {openOperationalArchive,recoverOperationalArchive,commitOperationalEvidence,commitOperationalAssessmentSetup,operationalState,operationalDiagnostics} from './val01-s6d-db2.fixture';
import '../../../src/index.css';
type Snapshot=Awaited<ReturnType<typeof openOperationalArchive>>;
const states={observed:'Osservato',not_observed:'Non osservato',not_applicable:'Non pertinente'};
const noWrite=async():Promise<never>=>{throw Error('Laboratorio: nessuna scrittura da questa vista');};
// Synthetic-only fixtures: live encrypted DB2 writes are limited to explicitly reviewed events.
function councilDemo(data:AppData){
 let d=appendCouncilSession(data,boardScope.classId,boardScope.schoolYear,'intermedia','2027-02-05','s8-first','2027-02-01T10:00:00.000Z');
 d=appendCouncilSession(d,boardScope.classId,boardScope.schoolYear,'monitoraggio','2026-11-25','s8-early','2026-11-21T10:00:00.000Z');
 return appendCouncilSession(d,boardScope.classId,boardScope.schoolYear,'monitoraggio','2027-02-08','s8-second','2027-02-06T10:00:00.000Z');
}
const councilSettings={year:'2026/2027',useWeightedAverage:false} as AppSettings;
function currentCouncil(){const s=operationalState();return {...s,classData:councilDemo(s.appData).classes.find(c=>c.id===boardScope.classId)!};}

function Laboratory(){
 const [snapshot,setSnapshot]=useState<Snapshot|null>(null);
 const [opening,setOpening]=useState(false),[openError,setOpenError]=useState(false);
 const [surface,setSurface]=useState<MatrixSurface>('daily');
 const [report,setReport]=useState<string|null>(null);
 const [reportView,setReportView]=useState<'essential'|'dossier'|'restitution'>('essential');
 const balanceDirty=useRef(false);
 const contributionDirty=useRef(false);
 const [councilBalance,setCouncilBalance]=useState<ConfirmedFormativeBalance|null>(null);
 const [blocked,setBlocked]=useState(false);
 const [recoveryRequired,setRecoveryRequired]=useState(false);
 const evidenceDirty=useRef(false);
 const dailyGuard=useRef<EvaluationDraftGuard|null>(null);
 const openingRef=useRef(false);
 const registerDailyGuard=useCallback((guard:EvaluationDraftGuard|null)=>{dailyGuard.current=guard;},[]);
 useEffect(()=>{
  const beforeUnload=(event:BeforeUnloadEvent)=>{if(evidenceDirty.current||balanceDirty.current||contributionDirty.current||dailyGuard.current?.hasUnsavedChanges()){event.preventDefault();event.returnValue='';}};
  window.addEventListener('beforeunload',beforeUnload);
  return ()=>window.removeEventListener('beforeunload',beforeUnload);
 },[]);
 // Explicit synthetic-only diagnostics exercise real commits while the panel is open.
 useEffect(()=>{
  const diagnostics={
   async append(studentId:string){
    const d=operationalState().document;
    if(!['s1','s5'].includes(studentId))throw Error('Synthetic recipient only');
    const id='s7b-'+studentId;
    const r=previewIndividualObservation(d,boardScope,{evidenceId:id,revisionId:id+'-r',observationEventId:id+'-event',assessmentRevisionId:'a2',criterionRevisionId:'c1',studentId,observedOn:'2026-12-01',recordedAt:'2026-12-01T10:00:00.000Z',state:'observed',fact:{kind:'product',description:'Dettaglio interno sintetico',method:'Elaborato',productRef:'private-synthetic-product'},interpretation:{kind:'level',levelId:'l2'}});
    if(!r.valid)throw Error(r.issue);
    await commitOperationalEvidence({kind:'new',preview:r.preview},{confirmedByTeacher:true,confirmedAt:'2026-12-01T10:01:00.000Z'});setSnapshot(operationalState());
   },
   async correct(){
    const d=operationalState().document,r=previewEvidenceRevision(d,boardScope,{action:'correct',evidenceRevisionId:'r-1',revisionId:'s7b-corrected-r',recordedAt:'2026-12-10T10:00:00.000Z',state:'not_observed'});
    if(!r.valid)throw Error(r.issue);
    await commitOperationalEvidence({kind:'revision',preview:r.preview},{confirmedByTeacher:true,confirmedAt:'2026-12-10T10:01:00.000Z'});setSnapshot(operationalState());
   }
  };
  Object.assign(globalThis,{__val01BalanceDiagnostics:diagnostics});
  return ()=>{delete (globalThis as Record<string,unknown>).__val01BalanceDiagnostics;};
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
 const dirty=()=>evidenceDirty.current||balanceDirty.current||contributionDirty.current||!!dailyGuard.current?.hasUnsavedChanges()||recoveryRequired;
 const request=(action:()=>void)=>{if(dirty()){setBlocked(true);return;}setBlocked(false);action();};
 const openReport=(id:string)=>request(()=>{if(boardScope.studentIds.includes(id)){setReport(id);setReportView('essential');}});
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
  {!report&&!councilBalance&&<MatrixSurfaceSelector laboratory mode={surface} onChange={next=>{if(next!==surface)request(()=>setSurface(next));}}/>}
  {blocked&&<p role="alert">Completa o abbandona la bozza prima di cambiare vista.</p>}
  {!report&&!councilBalance&&surface==='daily'&&<DailyMatrixWorkspace data={data} currentClass={currentClass} udas={[]} isPrivacyShieldActive={true}
    onRegisterDraftGuard={registerDailyGuard} requestChange={request} onSaveGrade={noWrite} onSaveObservation={noWrite}
    settings={{...councilSettings,subject:boardScope.subjectCode}} onSaveCriterionEvidence={async(scope,reviewed,confirmation)=>{
      if(scope.classId!==boardScope.classId||scope.schoolYear!==boardScope.schoolYear||
         scope.subjectCode!==boardScope.subjectCode||
         scope.studentIds.length!==boardScope.studentIds.length||
         !scope.studentIds.every((id,i)=>id===boardScope.studentIds[i]))throw Error('Synthetic scope mismatch');
      const receipt=await commit(reviewed,confirmation);return {revisionId:receipt.revisionId};
    }} onSaveAssessmentSetup={async(reviewed,confirmation)=>{
      const receipt=await commitOperationalAssessmentSetup(reviewed,confirmation);
      setSnapshot(operationalState());return receipt;
    }} onCompletePlannedAssessment={noWrite}/>}
  {!report&&!councilBalance&&surface==='historical'&&<MatrixView currentClass={currentClass} isPrivacyShieldActive={true} onOpenStudentReport={openReport}/>}
  <div hidden={!!report||!!councilBalance||surface!=='evidence'} className={report||councilBalance||surface!=='evidence'?'hidden':''}>
   <SyntheticEvidenceBoard committedDocument={evidence} onCommit={commit} recoveryRequired={recoveryRequired} onRecover={recover}
    onDraftChange={value=>{evidenceDirty.current=value;if(!value)setBlocked(false);}} onOpenStudentReport={openReport}/>
  </div>
  {councilBalance&&<section aria-label="Consiglio dimostrativo" className="min-w-0 space-y-3">
   <button type="button" className="min-h-[48px] rounded border px-3" onClick={()=>request(()=>{setReport(councilBalance.context.studentId);setReportView('essential');setCouncilBalance(null);})}>Torna alla scheda individuale</button>
   <p>Le sedute sono dimostrative e non appartengono all’archivio effettivo.</p>
   <CouncilView classes={councilDemo(data).classes} settings={councilSettings} isPrivacyShieldActive={true} onSave={noWrite} onCreateSession={noWrite} onPrepareSnapshot={noWrite} onConfirmSnapshot={noWrite}
    laboratoryContribution={{requestChange:request,render:(cls,year,session)=><SyntheticCouncilContribution key={cls.id+':'+year+':'+session.id} scope={boardScope} balance={councilBalance} classData={cls} schoolYear={year} session={session} version={snapshot.changes} getCurrent={currentCouncil} onDraftChange={value=>{contributionDirty.current=value;if(!value)setBlocked(false);}}/>}}/>
  </section>}
  {report&&<section aria-label="Scheda alunno dimostrativa" className="space-y-3">
   <button type="button" className="min-h-[48px] rounded border px-3" onClick={()=>request(()=>{setReport(null);setReportView('essential');})}>Torna al Tabellone</button>
   <StudentReportView currentClass={currentClass} selectedStudentId={report} onSelectStudent={id=>{if(boardScope.studentIds.includes(id))setReport(id);}} isPrivacyShieldActive={true} udas={[]} laboratoryRestitution={{requestChange:request,onViewChange:setReportView,content:<SyntheticFormativeBalance key={report} scope={boardScope} studentId={report} document={evidence} version={snapshot.changes} getCurrent={operationalState} onTransfer={balance=>{balanceDirty.current=false;setBlocked(false);setCouncilBalance(balance);setReport(null);setReportView('essential');}} onDraftChange={value=>{balanceDirty.current=value;if(!value)setBlocked(false);}}/>}}/>
   {reportView!=='restitution'&&<section aria-label="Evidenze individuali" className="rounded border p-2 space-y-2">
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
   </section>}
  </section>}
 </main>;
}
Object.assign(globalThis,{__val01OperationalDiagnostics:operationalDiagnostics});
createRoot(document.getElementById('root')!).render(<Laboratory/>);
