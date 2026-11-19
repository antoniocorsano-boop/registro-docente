import React,{useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {UnifiedDocumentPreview} from '../../../src/components/documents/UnifiedDocumentPreview';
import {previewArenaPlanningContext,bindAcceptedArenaPlanningContext} from '../../../src/planning/arenaPlanningContext';
import {computeDocenteOsTeachingProjectionFingerprint,type DocenteOsTeachingProjectionV1} from '../../../src/planning/docenteOsTeachingProjection';
import type {TeachingProfile} from '../../../src/planning/types';
import '../../../src/index.css';
// Synthetic fixture derived from the qualified D1d4a contract scenarios.
const scope={institutionRef:'demo-school',cohortRef:'demo-cohort',classId:'demo-class',schoolYear:'2026/2027',subjectCode:'tecnologia',gradeLevel:2,regimeRef:'demo-regime',periodStart:'2026-09-01',periodEnd:'2026-11-19'};
const classes=[{id:'demo-class',name:'2C'},{id:'demo-other',name:'2A'}];
const profile:TeachingProfile={id:'demo-profile',schoolYear:'2026/27',schoolOrder:'lower_secondary',gradeLevel:2,cohortRef:'demo-cohort',subjectCode:'tecnologia',normativeRegime:'demo-regime',normativeReference:{id:'demo-norm',sourceRef:'demo',version:'1',nationalHoursDefined:false},reservePercent:0,assessmentPeriods:[],calendar:{startDate:'2026-09-01',endDate:'2027-06-30',closureDates:[],weeklySlots:[]}};
const arenaPayload={contract:'ARENA_REGISTRO_PLANNING_CONTEXT_V1',contractVersion:1,sourceProduct:'ARENA',targetProduct:'REGISTRO_DOCENTE',importMode:'PREVIEW_ONLY',acceptanceRequired:true,automaticWriteAllowed:false,instituteName:'demo-school',schoolYear:profile.schoolYear,sourceSchoolYear:'2026-2027',schoolOrder:'secondaria',subjectCode:'tecnologia',gradeLevel:2,cohortRef:'demo-cohort',cohortRefKind:'DERIVED_APPLICABILITY_KEY',applicabilityStatus:'APPLICABLE',normativeRegime:'demo-regime',authorityState:'APPROVED',vigencyStatus:'VIGENTE',authorityReceiptRef:'demo-receipt',masterId:'demo-master',masterVersion:'1',structuralFingerprint:{scope:'MASTER',algorithm:'fnv1a',version:1,hash:'0123abcd'},provenance:{repository:'antoniocorsano-boop/CurManLight_arena',sourceCommit:'a'.repeat(40),sourceDocumentId:'demo-document',sourceRevisionId:'demo-revision'},curricoloItems:[{id:'demo-item',kind:'ANNUALITA_DISCIPLINARE',schoolStage:'Secondaria di primo grado',gradeLabel:'Classe II',sourceSection:'7.3',text:'Contenuto dimostrativo non estratto'}],privacyClass:'PROFESSIONAL_NON_PERSONAL'};
const preview=previewArenaPlanningContext(arenaPayload,profile);if(!preview.ok)throw Error('invalid Arena fixture');
const arena=bindAcceptedArenaPlanningContext([],preview.context,{accepted:true,acceptedAt:'2026-11-19T00:00:00.000Z'})[0];
const arenaSelection={confirmedByTeacher:true,contextId:arena.id,acceptedAt:arena.acceptedAt,masterVersion:arena.masterVersion,sourceCommit:arena.provenance.sourceCommit,sourceRevisionId:arena.provenance.sourceRevisionId,sourceSchoolYear:arena.sourceSchoolYear,fingerprint:arena.structuralFingerprint.hash,itemIds:['demo-item']};
const raw:Omit<DocenteOsTeachingProjectionV1,'projectionFingerprint'>={contract:'DOCENTE_OS_REGISTRO_TEACHING_PROJECTION_V1',contractVersion:1,sourceProduct:'DOCENTE_OS',targetProduct:'REGISTRO_DOCENTE',importMode:'READ_ONLY_PROJECTION',acceptanceRequired:true,automaticWriteAllowed:false,schoolYear:'2026/2027',disciplineName:'Tecnologia',generatedAt:'2026-11-19T00:00:00.000Z',provenance:{repository:'antoniocorsano-boop/docente-os-2026-27',sourceCommit:'b'.repeat(40),sourceBranch:'demo'},privacyClass:'PROFESSIONAL_NON_PERSONAL',classes:[{sourceSectionId:'demo-section',grade:2,sectionCode:'C',compactLabel:'2C',displayLabel:'2ª C',sectionStatus:'CONFERMATA',canonicalPlan:{code:'demo-plan',assetId:'demo-asset',generationId:'demo-gen'},udas:[{sourceUdaRef:'demo-uda',projectedUdaId:'docente-os:demo-section:demo-gen:demo-uda',title:'Titolo dimostrativo',focus:'Contenuto non riportato',plannedHours:4,period:'Q1',packRefs:['demo-pack'],canonicalGenerationId:'demo-gen'}]}]};
const accepted={projection:{...raw,projectionFingerprint:{algorithm:'SHA-256' as const,hash:computeDocenteOsTeachingProjectionFingerprint(raw)}},acceptedAt:'2026-11-19T01:00:00.000Z',classReconciliation:[{sourceSectionId:'demo-section',status:'resolved' as const,registroClassId:'demo-class'}]};
const planSelection={confirmedByTeacher:true,institutionRef:scope.institutionRef,cohortRef:scope.cohortRef,projectionHash:accepted.projection.projectionFingerprint.hash,acceptedAt:accepted.acceptedAt,sourceSectionId:'demo-section',udaIds:[raw.classes[0].udas[0].projectedUdaId]};
const {regimeRef:_,...lessonScope}=scope;
const records=[{id:'demo-local',className:'2C',lessons:[{id:'demo-lesson',date:'2026-10-12',hours:1.5},{id:'demo-second',date:'2026-11-18',hours:2}]}];
const lessonSelection={confirmedByTeacher:true,scope:lessonScope,lessons:[{udaId:'demo-local',lessonId:'demo-lesson',date:'2026-10-12',hours:1.5}]};
const input={scope,classes,arena:{profiles:[profile],accepted:[arena],selection:arenaSelection},planning:{accepted:[accepted],selection:planSelection},recorded:{records,selection:lessonSelection}};

function Fixture(){
 const [mode,setMode]=useState<'all'|'missing'|'invalid'|'none'>('all');
 const [revision,setRevision]=useState(0);
 const selected=useMemo(()=>{
  if(mode==='none')return {...input,arena:null,planning:null,recorded:null};
  return {...input,
   arena:{...input.arena,accepted:[{...arena,curricoloItems:[{...arena.curricoloItems[0],text:'Contenuto dimostrativo '+revision}]}]},
   planning:mode==='missing'?null:mode==='invalid'?{...input.planning,selection:{...planSelection,confirmedByTeacher:false}}:input.planning};
 },[mode,revision]);
 const previewOnly=new URLSearchParams(window.location.search).get('view')==='preview';
 return <main className="min-h-screen w-full min-w-0">
  {!previewOnly&&<div aria-label="Comandi della dimostrazione" className="mx-auto w-full min-w-0 max-w-[576px] flex flex-wrap gap-[6px] p-[8px] border-b border-slate-700 text-sm [&>button]:min-w-0 [&>button]:max-w-full [&>button]:whitespace-normal [&>button]:[overflow-wrap:anywhere]">
   <button className="min-h-11 rounded-lg border border-slate-600 px-2 py-1" onClick={()=>setMode('all')}>Tre fonti</button>
   <button className="min-h-11 rounded-lg border border-slate-600 px-2 py-1" onClick={()=>setMode('missing')}>Fonte non selezionata</button>
   <button className="min-h-11 rounded-lg border border-slate-600 px-2 py-1" onClick={()=>setMode('invalid')}>Fonte da verificare</button>
   <button className="min-h-11 rounded-lg border border-slate-600 px-2 py-1" onClick={()=>setMode('none')}>Nessuna fonte</button>
   <button className="min-h-11 rounded-lg border border-slate-600 px-2 py-1" onClick={()=>setRevision(r=>r+1)}>Modifica curricolo</button>
  </div>}
  <UnifiedDocumentPreview input={selected}/>
 </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture/>);
