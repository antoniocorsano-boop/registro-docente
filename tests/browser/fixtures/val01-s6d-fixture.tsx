import React,{useCallback,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MatrixSurfaceSelector,type MatrixSurface} from '../../../src/components/MatrixSurfaceSelector';
import {DailyMatrixWorkspace} from '../../../src/components/DailyMatrixWorkspace';
import {MatrixView} from '../../../src/components/MatrixView';
import {StudentReportView} from '../../../src/components/StudentReportView';
import type {EvaluationDraftGuard} from '../../../src/components/MatrixEvaluationEntry';
import type {AppData,AppSettings,ClassData} from '../../../src/types';
import {projectIndividualAssessmentEvidence} from '../../../src/assessment/assessmentEvidenceProjection';
import {boardDocument,boardScope} from './val01-s6c-data';
import {SyntheticEvidenceBoard} from './val01-s6c-board';
import '../../../src/index.css';

const names=['Ada Fittizia','Bruno Fittizio','Carla Fittizia','Diego Fittizio','Elena Fittizia'];
const demoClass:ClassData={id:boardScope.classId,name:'Classe dimostrativa',students:boardScope.studentIds.map((id,i)=>({id,name:names[i]})),
 grades:[{id:'grade-demo',batchId:'batch-demo',studentId:'s1',date:'2026-11-20',type:'disegno',period:'Q1',title:'Prova ordinaria sintetica',value:'8'}],behaviors:[]};
const data:AppData={classes:[demoClass],currentClassId:demoClass.id};
const states={observed:'Osservato',not_observed:'Non osservato',not_applicable:'Non pertinente'};
const noWrite=async():Promise<never>=>{throw Error('Dimostrazione: scrittura disabilitata');};

function Laboratory(){
 const [surface,setSurface]=useState<MatrixSurface>('daily');
 const [report,setReport]=useState<string|null>(null);
 const [evidence,setEvidence]=useState(boardDocument);
 const [blocked,setBlocked]=useState(false);
 const evidenceDirty=useRef(false);
 const dailyGuard=useRef<EvaluationDraftGuard|null>(null);
 const registerDailyGuard=useCallback((guard:EvaluationDraftGuard|null)=>{dailyGuard.current=guard;},[]);
 const dirty=()=>evidenceDirty.current||!!dailyGuard.current?.hasUnsavedChanges();
 const request=(action:()=>void)=>{if(dirty()){setBlocked(true);return;}setBlocked(false);action();};
 const openReport=(id:string)=>request(()=>{if(boardScope.studentIds.includes(id))setReport(id);});
 const projection=report?projectIndividualAssessmentEvidence(evidence,boardScope,report):null;
 return <main className="mx-auto max-w-5xl min-w-0 p-[8px] space-y-3 [overflow-wrap:anywhere]">
  <p className="text-sm">Laboratorio S6d · Classe fittizia · Archivio ordinario non modificabile</p>
  {!report&&<MatrixSurfaceSelector laboratory mode={surface} onChange={next=>{if(next!==surface)request(()=>setSurface(next));}}/>}
  {blocked&&<p role="alert">Completa o abbandona la bozza prima di cambiare vista.</p>}
  {!report&&surface==='daily'&&<DailyMatrixWorkspace data={data} currentClass={demoClass} udas={[]} isPrivacyShieldActive={true}
    onRegisterDraftGuard={registerDailyGuard} requestChange={request} onSaveGrade={noWrite} onSaveObservation={noWrite}
    settings={{year:boardScope.schoolYear,subject:boardScope.subjectCode} as AppSettings} onSaveCriterionEvidence={noWrite} onSaveAssessmentSetup={noWrite}/>}
  {!report&&surface==='historical'&&<MatrixView currentClass={demoClass} isPrivacyShieldActive={true} onOpenStudentReport={openReport}/>}
  <div hidden={!!report||surface!=='evidence'} className={report||surface!=='evidence'?'hidden':''}>
   <SyntheticEvidenceBoard onDraftChange={dirty=>{evidenceDirty.current=dirty;if(!dirty)setBlocked(false);}} onDocumentChange={setEvidence} onOpenStudentReport={openReport}/>
  </div>
  {report&&<section aria-label="Scheda alunno dimostrativa" className="space-y-3">
   <button type="button" className="min-h-[48px] rounded border px-3" onClick={()=>{setReport(null);setBlocked(false);}}>Torna al Tabellone</button>
   <StudentReportView currentClass={demoClass} selectedStudentId={report} onSelectStudent={id=>{if(boardScope.studentIds.includes(id))setReport(id);}} isPrivacyShieldActive={true} udas={[]}/>
   <section aria-label="Evidenze individuali" className="rounded border p-2 space-y-2">
    <h2 className="font-semibold">Evidenze individuali — consultazione</h2>
    <p>Studente {boardScope.studentIds.indexOf(report)+1}</p>
    <p>Non costituiscono un voto, una sintesi di competenza o una certificazione.</p>
    {projection?.valid?projection.entries.length?projection.entries.map(e=><div key={e.evidenceRevisionId} className="border-t py-2">
      <p>{evidence.assessments.find(a=>a.revisionId===e.assessmentRevisionId)?.title}</p>
      <p>{evidence.criteria.find(c=>c.revisionId===e.criterionRevisionId)?.description}</p>
      <p>{states[e.state]}</p>
    </div>):<p>Nessuna evidenza attiva registrata.</p>:<p role="alert">Evidenze non disponibili.</p>}
   </section>
  </section>}
 </main>;
}
createRoot(document.getElementById('root')!).render(<Laboratory/>);
