import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {AssessmentPreparationPanel} from '../../../src/components/AssessmentPreparationPanel';
import type {AssessmentEvidenceV1,AssessmentScopeV1,AssessmentDefinitionRevision,LearningReferenceRevision,CriterionRevision,RubricRevision} from '../../../src/assessment/assessmentEvidence';
import '../../../src/index.css';

const scope:AssessmentScopeV1={classId:'classe-sintetica',schoolYear:'2026/2027',subjectCode:'TECH',studentIds:['s1','s2']};
const confirmation={confirmedByTeacher:true as const,confirmedAt:'2026-11-18T09:00:00.000Z'};
const source={kind:'local' as const,sourceVersion:'v1'};
const references:LearningReferenceRevision[]=[
  {...confirmation,referenceId:'o1',revisionId:'o1r1',kind:'specific-objective',text:'Rappresentare le relazioni tra risorse e prodotti',source},
  {...confirmation,referenceId:'o2',revisionId:'o2r1',kind:'specific-objective',text:'Motivare una scelta tecnica',source}
];
const criteria:CriterionRevision[]=[
  {...confirmation,criterionId:'c1',revisionId:'c1r1',description:'Coerenza dei collegamenti',targetReferenceRevisionIds:['o1r1'],contextualReferenceRevisionIds:[]},
  {...confirmation,criterionId:'c2',revisionId:'c2r1',description:'Chiarezza argomentativa',targetReferenceRevisionIds:['o2r1'],contextualReferenceRevisionIds:[]}
];
const rubrics:RubricRevision[]=[
  {...confirmation,rubricId:'r1',revisionId:'r1r1',source,criteria:[{criterionRevisionId:'c1r1',levels:[{levelId:'l1',label:'Da integrare',description:'Collegamenti parziali'},{levelId:'l2',label:'Coerente',description:'Collegamenti motivati'}]}]},
  {...confirmation,rubricId:'r2',revisionId:'r2r1',source,criteria:[{criterionRevisionId:'c2r1',levels:[{levelId:'l1',label:'Argomentato',description:'Motiva la scelta'}]}]}
];
const base:AssessmentEvidenceV1={version:1,classId:scope.classId,schoolYear:scope.schoolYear,subjectCode:scope.subjectCode,references,criteria,rubrics,assessments:[],evidence:[]};
const activities={normal:{label:'Attività didattica sintetica',id:'activity1'},exam:{label:'Simulazione d’esame',id:'activity2'},existing:{label:'Attività già configurata',id:'existing'}} as const;
const existing={...confirmation,assessmentId:'existing-a',revisionId:'existing-r',date:'2026-11-19',period:'Q1' as const,title:'Prova già configurata',purpose:'formative' as const,status:'planned' as const,source:{kind:'explicit-activity' as const,activityId:'existing'},criteria:[{criterionRevisionId:'c1r1',expected:{kind:'product' as const,description:'Schema',method:'elaborato'}}]};
function Fixture(){
  const [activity,setActivity]=useState<keyof typeof activities>('normal');
  const [open,setOpen]=useState(false);
  const [stale,setStale]=useState(false);
  const [planned,setPlanned]=useState<AssessmentDefinitionRevision[]>([]);
  const d:AssessmentEvidenceV1={...base,assessments:[existing,...planned],references:stale?[...references,{...references[0],revisionId:'o1r2',supersedesRevisionId:'o1r1'}]:references};
  const a=activities[activity];
  return <main className="mx-auto max-w-xl min-w-0 p-2 space-y-3">
    <div className="space-y-2 border border-[var(--border)] rounded-lg p-2">
      <p className="text-sm">Ambiente esclusivamente sintetico</p>
      <button type="button" className="min-h-[48px] w-full rounded border" onClick={()=>setActivity('normal')}>Attività ordinaria</button>
      <button type="button" className="min-h-[48px] w-full rounded border" onClick={()=>setActivity('exam')}>Simulazione d’esame</button>
      <button type="button" className="min-h-[48px] w-full rounded border" onClick={()=>setActivity('existing')}>Attività esistente</button>
      {!open?<button type="button" className="min-h-[48px] w-full rounded border" onClick={()=>setOpen(true)}>Apri configurazione</button>:<button type="button" className="min-h-[48px] w-full rounded border" onClick={()=>setStale(true)}>Aggiorna riferimento sintetico</button>}
    </div>
    {open&&<AssessmentPreparationPanel document={d} scope={scope} classLabel="Classe dimostrativa" activityLabel={a.label} activityId={a.id} assessmentId={a.id+'-a'} revisionId={a.id+'-r'} onExit={()=>{setOpen(false);setStale(false);}} confirmationTime={()=> '2026-11-18T10:00:00.000Z'} onConfirmed={definition=>setPlanned(old=>[...old,definition])}/>}
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
