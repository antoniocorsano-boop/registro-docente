// AUDIT-PRE-01 / AP-03 — synthetic authority and lifecycle regression.
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
import type {AppData,AppSettings,ClassData} from '../types';
import type {PlanningState} from '../planning/types';
import {boardDocument,boardScope} from '../../tests/browser/fixtures/val01-s6c-data';
import {resolveAssessmentSubjectCode} from '../assessment/assessmentSubjectScope';
import {resolveApprovedAssessmentScopes} from '../assessment/approvedAssessmentScopes';
import {canonicalAssessmentSchoolYear} from '../assessment/assessmentSchoolYear';
import {checkStudentRemovalContinuity,checkSettingsAssessmentContinuity,checkPlanningAssessmentContinuity,AssessmentContinuityError} from '../assessment/assessmentContinuity';
import {DEFAULT_SETTINGS} from '../utils';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {validateAssessmentArchiveV1} from '../assessment/assessmentArchive';
import {previewDailyAssessmentSetup,deriveConfirmedDailyAssessmentSetup,type AssessmentSetupRequest}
 from '../assessment/dailyAssessmentSetup';
import {listDailyPlannedProofs} from '../assessment/dailyPlannedAssessmentCompletion';
import {resolveDailyCriterionRecordingContext} from '../assessment/dailyCriterionRecordingContext';
import {readStudentCriterionEvidence} from '../assessment/studentCriterionReadModel';

const older={classId:boardScope.classId,schoolYear:boardScope.schoolYear,subjectCode:boardScope.subjectCode};
const current={classId:boardScope.classId,schoolYear:'2027/2028',subjectCode:'TECH'};
const settings={year:current.schoolYear,subject:current.subjectCode};
const confirmation={confirmedByTeacher:true as const,confirmedAt:'2027-11-21T10:03:00.000Z'};
const oldDoc=()=>structuredClone(boardDocument);
const classroom=():ClassData=>({
 id:boardScope.classId,name:'Classe sintetica multiennale',
 students:boardScope.studentIds.map(id=>({id,name:'Studente sintetico '+id})),grades:[],behaviors:[],
 assessmentEvidenceV1:{version:1,documents:[{document:oldDoc(),bindings:[]}]}
});
const app=():AppData=>({classes:[classroom()],currentClassId:boardScope.classId});
function planning(status:'approved'|'draft'='approved',instanceClass=boardScope.classId,
 adopted='version-h',subject=boardScope.subjectCode):PlanningState{
 return {profiles:[{id:'profile-h',schoolYear:older.schoolYear,subjectCode:subject}],
  masterPrograms:[{id:'master-h',profileId:'profile-h',status,currentVersionId:'version-h'}],
  classInstances:[{id:'instance-h',classId:instanceClass,masterProgramId:'master-h',adoptedVersionId:adopted}]} as unknown as PlanningState;
}
const request=():AssessmentSetupRequest=>({
 activityId:'ap03-act-new',assessmentId:'ap03-assess-new',
 plannedRevisionId:'ap03-planned-new',completedRevisionId:'ap03-done-new',
 objectiveId:'ap03-obj-new',objectiveRevisionId:'ap03-objrev-new',
 title:'Prova dell’anno corrente',date:'2027-11-21',period:'Q1',purpose:'formative',
 objectiveText:'Rappresentare un sistema',preparedAt:'2027-11-21T10:00:00.000Z',
 criteria:[{criterionId:'ap03-crit-new',revisionId:'ap03-critrev-new',
  description:'Rappresenta relazioni',expected:{kind:'product',description:'Schema originale',method:'Elaborato'}}]
});
describe('AUDIT-PRE-01 / AP-03 — independently approved historical contexts',()=>{

 test('Q5-APP-01 retains an immutable Tecnologia document after the approved year change',()=>{
  const data=app();
  const section=data.classes[0].assessmentEvidenceV1!.documents[0];
  Object.assign(section.document,{subjectCode:'Tecnologia'});
  const before=structuredClone(data);
  expect(resolveAssessmentSubjectCode('Tecnologia')).toBe('tecnologia');
  expect(resolveAssessmentSubjectCode('TECH')).toBe('TECH');
  const currentSettings={...DEFAULT_SETTINGS,year:older.schoolYear,subject:'Tecnologia'};
  const next={...currentSettings,year:'2027/2028'};
  expect(validateAssessmentArchiveV1(data,resolveApprovedAssessmentScopes(data,planning(),currentSettings)).valid).toBe(true);
  expect(checkSettingsAssessmentContinuity(data,planning('approved',older.classId,'version-h','tecnologia'),currentSettings,next))
   .toEqual({allowed:true});
  for(const unauthorized of [
   planning('draft',older.classId,'version-h','tecnologia'),
   planning('approved',older.classId,'wrong-version','tecnologia'),
   planning('approved',older.classId,'version-h','MATH'),
  ]) {
   expect(checkSettingsAssessmentContinuity(data,unauthorized,currentSettings,next))
    .toEqual({allowed:false,reason:'SCOPE_NOT_APPROVED'});
  }
  expect(data).toEqual(before);
 });

 test('F3-CONT-02 planning profile/adoption changes cannot orphan archived evidence',()=>{
  const data=app(),source=planning(),sourceSettings:AppSettings={...DEFAULT_SETTINGS,
   year:'2027/2028',subject:'TECH'},before=JSON.stringify(data),
   beforePlanning=JSON.stringify(source),beforeSettings=JSON.stringify(sourceSettings);
  expect(checkPlanningAssessmentContinuity(data,source,sourceSettings)).toEqual({allowed:true});
  const invalid:PlanningState[]=[
   {...source,profiles:source.profiles.map(p=>({...p,schoolYear:'2025/2026'}))},
   {...source,profiles:source.profiles.map(p=>({...p,subjectCode:'MATH'}))},
   {...source,profiles:[]},
   {...source,masterPrograms:source.masterPrograms.map(m=>({...m,status:'draft' as const}))},
   {...source,masterPrograms:source.masterPrograms.map(m=>({...m,currentVersionId:'other-version'}))},
   {...source,classInstances:[]}
  ];
  for(const candidate of invalid){
   expect(checkPlanningAssessmentContinuity(data,candidate,sourceSettings))
    .toEqual({allowed:false,reason:'SCOPE_NOT_APPROVED'});
   expect(validateAssessmentArchiveV1(data,resolveApprovedAssessmentScopes(data,candidate,sourceSettings)))
    .toEqual({valid:false,issue:'INVALID_SCOPE'});
  }
  // Both documented spellings are equivalent: no rewrite of persisted sources.
  for(const year of ['2026/27','2026-2027','2026/2027']){
   const candidate={...source,profiles:source.profiles.map(p=>({...p,schoolYear:year}))};
   expect(checkPlanningAssessmentContinuity(data,candidate,sourceSettings)).toEqual({allowed:true});
  }
  const ordinaryChange={...source,resources:[{id:'resource-synthetic',kind:'other' as const,
   title:'Risorsa sintetica'}]};
  expect(checkPlanningAssessmentContinuity(data,ordinaryChange,sourceSettings)).toEqual({allowed:true});
  expect(JSON.stringify(data)).toBe(before);
  expect(JSON.stringify(source)).toBe(beforePlanning);
  expect(JSON.stringify(sourceSettings)).toBe(beforeSettings);
 });
 test('F3-CONT-02 independent approval is checked across every physical class',()=>{
  const data=app(),source=planning(),additional=classroom();
  additional.id='class-second';
  additional.assessmentEvidenceV1={version:1,documents:[{document:{...oldDoc(),classId:'class-second'},bindings:[]}]};
  data.classes.push(additional);
  const dual:PlanningState={...source,classInstances:[
   ...source.classInstances,
   {id:'instance-other',classId:'class-second',masterProgramId:'master-h',adoptedVersionId:'version-h'}
  ]};
  const cfg:AppSettings={...DEFAULT_SETTINGS,year:'2027/2028',subject:'TECH'};
  const saved=JSON.stringify(data),savedPlanning=JSON.stringify(dual);
  expect(checkPlanningAssessmentContinuity(data,dual,cfg)).toEqual({allowed:true});
  const removed:PlanningState={...dual,classInstances:dual.classInstances.filter(i=>i.classId!=='class-second')};
  expect(checkPlanningAssessmentContinuity(data,removed,cfg))
   .toEqual({allowed:false,reason:'SCOPE_NOT_APPROVED'});
  expect(validateAssessmentArchiveV1(data,resolveApprovedAssessmentScopes(data,removed,cfg)))
   .toEqual({valid:false,issue:'INVALID_SCOPE'});
  expect(JSON.stringify(data)).toBe(saved);
  expect(JSON.stringify(dual)).toBe(savedPlanning);
 });
 test('F3-CONT-02 planning refusal cannot persist or publish and a valid retry succeeds',async()=>{
  const data=app(),cfg:AppSettings={...DEFAULT_SETTINGS,year:'2027/2028',subject:'TECH'};
  let committed=planning(),writes=0,published=0;
  const before=JSON.stringify(committed),archiveBefore=JSON.stringify(data);
  const coordinator=createDurableMutationCoordinator();
  const attempt=(next:(v:PlanningState)=>PlanningState)=>coordinator.enqueue({
   getCommitted:()=>committed,
   derive:current=>{
    const candidate=next(current);
    if(!checkPlanningAssessmentContinuity(data,candidate,cfg).allowed)
     throw new AssessmentContinuityError('planning');
    return candidate;
   },
   persist:async()=>{writes++;},
   publish:next=>{committed=next;published++;}
  });
  await expect(attempt(current=>({...current,
   profiles:current.profiles.map(p=>({...p,schoolYear:'2025/2026'}))
  }))).rejects.toThrow('Programmazione non salvata');
  expect(writes).toBe(0);expect(published).toBe(0);
  expect(JSON.stringify(committed)).toBe(before);
  await attempt(current=>({...current,profiles:current.profiles.map(p=>({...p,schoolYear:'2026/27'}))}));
  expect(writes).toBe(1);expect(published).toBe(1);
  expect(JSON.stringify(data)).toBe(archiveBefore);
  const code=readFileSync('src/App.tsx','utf8');
  expect(code).toContain('checkPlanningAssessmentContinuity(');
  expect(code).toContain('appDataRef.current, candidatePlanning, settingsRef.current');
  expect(code).toContain("throw new AssessmentContinuityError('planning')");
  expect(code).toContain('secureStorage.savePlanningAndMeta(candidate.planning, candidate.meta)');
 });


 test('F3-CONT-01 removal conserves student-linked observations and only allows an unreferenced roster entry',()=>{
  const original=classroom(),before=JSON.stringify(original);
  expect(checkStudentRemovalContinuity(original,'s1')).toEqual({allowed:false,reason:'HISTORICAL_RECORD'});
  expect(checkStudentRemovalContinuity(original,'s5')).toEqual({allowed:false,reason:'HISTORICAL_RECORD'});
  expect(checkStudentRemovalContinuity(original,'foreign')).toEqual({allowed:false,reason:'UNKNOWN_STUDENT'});
  // s4 has no observation, binding, grade, council record or aggregate snapshot.
  expect(checkStudentRemovalContinuity(original,'s4')).toEqual({allowed:true});
  const candidate=app();
  candidate.classes[0].students=candidate.classes[0].students.filter(s=>s.id!=='s4');
  expect(validateAssessmentArchiveV1(candidate,resolveApprovedAssessmentScopes(candidate,planning(),settings)))
   .toEqual({valid:true,state:'present'});
  expect(JSON.stringify(original)).toBe(before);
 });
 test('F3-CONT-01 grades, behavior, council judgements and roster snapshots cannot be deleted',()=>{
  const base=classroom();
  delete base.assessmentEvidenceV1;
  const grade=structuredClone(base);
  grade.grades.push({id:'grade-s4',studentId:'s4',date:'2026-11-20',
   type:'disegno',period:'Q1',title:'Prova fittizia',value:'7'});
  expect(checkStudentRemovalContinuity(grade,'s4')).toEqual({allowed:false,reason:'HISTORICAL_RECORD'});
  const behavior=structuredClone(base);
  behavior.behaviors.push({id:'b-s4',studentId:'s4',date:'2026-11-20',status:'Costruttivo 👍'});
  expect(checkStudentRemovalContinuity(behavior,'s4')).toEqual({allowed:false,reason:'HISTORICAL_RECORD'});
  const council=structuredClone(base);
  council.councilAssessments=[{studentId:'s4',schoolYear:'2026/2027',moment:'ingresso',
   value:'In acquisizione',updatedAt:'2026-11-20T10:00:00.000Z'}];
  expect(checkStudentRemovalContinuity(council,'s4')).toEqual({allowed:false,reason:'HISTORICAL_RECORD'});
  const aggregate=structuredClone(base);
  aggregate.councilEvidenceSnapshots=[{} as NonNullable<ClassData['councilEvidenceSnapshots']>[number]];
  expect(checkStudentRemovalContinuity(aggregate,'s4')).toEqual({allowed:false,reason:'HISTORICAL_RECORD'});
  const malformed=classroom();
  malformed.assessmentEvidenceV1={version:1,documents:[]};
  expect(checkStudentRemovalContinuity(malformed,'s4')).toEqual({allowed:false,reason:'INVALID_ARCHIVE'});
  expect(base.students).toHaveLength(boardScope.studentIds.length);
 });
 test('F3-CONT-01 settings update needs independent adopted historical authority',()=>{
  const data=app(),before=JSON.stringify(data);
  const sourceSettings:AppSettings={...DEFAULT_SETTINGS,year:'2026/2027',subject:'TECH'};
  const savedSettings=JSON.stringify(sourceSettings);
  const changeYear={...sourceSettings,year:'2027/2028'};
  const changeSubject={...sourceSettings,subject:'MATH'};
  expect(checkSettingsAssessmentContinuity(data,planning('draft'),sourceSettings,changeYear))
   .toEqual({allowed:false,reason:'SCOPE_NOT_APPROVED'});
  expect(checkSettingsAssessmentContinuity(data,planning('draft'),sourceSettings,changeSubject))
   .toEqual({allowed:false,reason:'SCOPE_NOT_APPROVED'});
  expect(checkSettingsAssessmentContinuity(data,planning(),sourceSettings,changeYear))
   .toEqual({allowed:true});
  expect(checkSettingsAssessmentContinuity(data,planning(),sourceSettings,changeSubject))
   .toEqual({allowed:true});
  for(const year of ['2026/27','2026-2027','2026/2027']){
   expect(checkSettingsAssessmentContinuity(data,planning('draft'),sourceSettings,{...sourceSettings,year}))
    .toEqual({allowed:true});
  }
  expect(checkSettingsAssessmentContinuity(data,planning('draft'),sourceSettings,
   {...sourceSettings,theme:'matrix'})).toEqual({allowed:true});
  expect(checkSettingsAssessmentContinuity(data,planning(),sourceSettings,
   {...sourceSettings,year:'invalid'})).toEqual({allowed:false,reason:'SCOPE_NOT_APPROVED'});
  const absent=app();
  delete absent.classes[0].assessmentEvidenceV1;
  expect(checkSettingsAssessmentContinuity(absent,planning('draft'),sourceSettings,changeYear))
   .toEqual({allowed:true});
  expect(JSON.stringify(data)).toBe(before);
  expect(JSON.stringify(sourceSettings)).toBe(savedSettings);
 });
 test('F3-CONT-01 blocked changes cannot persist or publish and production UI explains refusal',async()=>{
  const start=app(),before=JSON.stringify(start);
  let committed=start, persisted=0, published=0;
  const coordinator=createDurableMutationCoordinator();
  await expect(coordinator.enqueue({
   getCommitted:()=>committed,
   derive:current=>{
    if(!checkStudentRemovalContinuity(current.classes[0],'s1').allowed)
     throw new AssessmentContinuityError('student');
    return current;
   },
   persist:async()=>{persisted++;},
   publish:next=>{published++;committed=next;}
  })).rejects.toThrow('Rimozione sospesa');
  expect(persisted).toBe(0);expect(published).toBe(0);
  expect(JSON.stringify(committed)).toBe(before);
  const originalSettings:AppSettings={...DEFAULT_SETTINGS,year:'2026/2027',subject:'TECH'};
  await expect(coordinator.enqueue({
   getCommitted:()=>originalSettings,
   derive:current=>{
    if(!checkSettingsAssessmentContinuity(start,planning('draft'),current,
      {...current,year:'2027/2028'}).allowed)throw new AssessmentContinuityError('settings');
    return current;
   },
   persist:async()=>{persisted++;},
   publish:()=>{published++;}
  })).rejects.toThrow('Modifica non salvata');
  expect(persisted).toBe(0);expect(published).toBe(0);
  const appCode=readFileSync('src/App.tsx','utf8');
  expect(appCode).toContain('checkStudentRemovalContinuity(targetClass, studentId)');
  expect(appCode).toContain('checkSettingsAssessmentContinuity(appDataRef.current, planningRef.current');
  expect(appCode).toContain('validateAssessmentArchiveV1(candidate, scopes)');
  const ui=readFileSync('src/components/StudentsManagementView.tsx','utf8');
  expect(ui).toContain('la rimozione sarà bloccata per conservarle');
 });


 test('F3-CPL-01 current teacher year is canonical across all four assessment flows',()=>{
  const original=app(),before=JSON.stringify(original),sourcePlanning=planning();
  const savedPlanning=JSON.stringify(sourcePlanning);
  for(const year of ['2027/28','2027-2028','2027/2028','2027 / 2028']){
   const alternative={...settings,year},beforeSettings=JSON.stringify(alternative);
   const approved=resolveApprovedAssessmentScopes(original,sourcePlanning,alternative);
   expect(canonicalAssessmentSchoolYear(year)).toBe('2027/2028');
   expect(approved).toEqual([current,older]);
   expect(validateAssessmentArchiveV1(original,approved)).toEqual({valid:true,state:'present'});
   const preview=previewDailyAssessmentSetup(original.classes[0],alternative,request(),'completed',approved);
   expect(preview.valid).toBe(true);
   if(!preview.valid)throw Error('Current assessment context denied');
   expect(preview.review.scope.schoolYear).toBe(current.schoolYear);
   const next=deriveConfirmedDailyAssessmentSetup(original,approved,preview.review,confirmation);
   expect(validateAssessmentArchiveV1(next,approved)).toEqual({valid:true,state:'present'});
   expect(next.classes[0].assessmentEvidenceV1?.documents[0].document)
    .toEqual(original.classes[0].assessmentEvidenceV1?.documents[0].document);
   expect(next.classes[0].assessmentEvidenceV1?.documents[1].document.schoolYear).toBe(current.schoolYear);
   expect(listDailyPlannedProofs(next.classes[0],alternative,approved).status).toBe('ready');
   expect(resolveDailyCriterionRecordingContext(next.classes[0],alternative,approved).status).toBe('ready');
   expect(readStudentCriterionEvidence(next.classes[0],alternative,'s1',approved).status).toBe('ready');
   expect(JSON.stringify(alternative)).toBe(beforeSettings);
  }
  expect(JSON.stringify(original)).toBe(before);
  expect(JSON.stringify(sourcePlanning)).toBe(savedPlanning);
 });
 test('F3-CPL-01 invalid years or unapproved scopes fail closed without altering source',()=>{
  const original=app(),before=JSON.stringify(original);
  for(const year of ['2027/29','2027-2029','2027/2027','2027-2026','2027','unexpected']){
   expect(canonicalAssessmentSchoolYear(year)).toBeNull();
   const alternative={...settings,year};
   const approved=resolveApprovedAssessmentScopes(original,planning(),alternative);
   expect(approved).toEqual([]);
   expect(previewDailyAssessmentSetup(original.classes[0],alternative,request(),'completed',approved).valid).toBe(false);
   expect(listDailyPlannedProofs(original.classes[0],alternative,approved).status).toBe('unverified');
   expect(resolveDailyCriterionRecordingContext(original.classes[0],alternative,approved).status).toBe('unverified');
   expect(readStudentCriterionEvidence(original.classes[0],alternative,'s1',approved).status).toBe('unverified');
  }
  expect(previewDailyAssessmentSetup(original.classes[0],{...settings,year:'2027/28'},request(),'completed',[]).valid).toBe(false);
  expect(JSON.stringify(original)).toBe(before);
 });
 test('F3-CPL-01 App comparisons use canonical scope year and preserve raw settings-change guard',()=>{
  const source=readFileSync('src/App.tsx','utf8');
  expect(source.split('scope.schoolYear!==canonicalAssessmentSchoolYear(approvedSettings.year)').length-1).toBe(3);
  expect(source.split('settingsRef.current.year!==approvedSettings.year').length-1).toBe(3);
 });

 test('teacher settings and an adopted approved planning profile authorize separate years without reading document scope',()=>{
  const data=app(),before=structuredClone(data);
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  expect(approved).toEqual([current,older]);
  expect(validateAssessmentArchiveV1(data,approved)).toEqual({valid:true,state:'present'});
  expect(data).toEqual(before);
 });
 test('unlinked historical document cannot self-authorize, even if valid, complete and signed by teacher',()=>{
  const data=app();
  const onlyCurrent=resolveApprovedAssessmentScopes(data,planning('draft'),settings);
  expect(onlyCurrent).toEqual([current]);
  expect(validateAssessmentArchiveV1(data,onlyCurrent)).toEqual({valid:false,issue:'INVALID_SCOPE'});
  expect(previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',onlyCurrent).valid).toBe(false);
  const badClass=resolveApprovedAssessmentScopes(data,planning('approved','foreign'),settings);
  const badAdoption=resolveApprovedAssessmentScopes(data,planning('approved',boardScope.classId,'wrong-version'),settings);
  const wrongDiscipline=resolveApprovedAssessmentScopes(data,planning('approved',boardScope.classId,'version-h','MATH'),settings);
  expect(badClass).toEqual([current]);
  expect(badAdoption).toEqual([current]);
  expect(wrongDiscipline).toEqual([current,{...older,subjectCode:'MATH'}]);
  for(const scopes of [badClass,badAdoption,wrongDiscipline]){
   expect(validateAssessmentArchiveV1(data,scopes).valid).toBe(false);
  }
 });
 test('current setup appends a new document and preserves historical proof byte for byte',()=>{
  const data=app(),oldSnapshot=JSON.stringify(data.classes[0].assessmentEvidenceV1);
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  const preview=previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',approved);
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Authorized current preview was rejected');
  expect(preview.review.baseDocument).toBeNull();
  const next=deriveConfirmedDailyAssessmentSetup(data,approved,preview.review,confirmation);
  const docs=next.classes[0].assessmentEvidenceV1?.documents;
  expect(docs).toHaveLength(2);
  expect(JSON.stringify({version:1,documents:[docs![0]]})).toBe(oldSnapshot);
  expect(docs![1].document.schoolYear).toBe(current.schoolYear);
  expect(docs![1].document.assessments.map(a=>a.status)).toEqual(['planned','completed']);
  expect(validateAssessmentArchiveV1(next,approved)).toEqual({valid:true,state:'present'});
  expect(listDailyPlannedProofs(next.classes[0],settings,approved).status).toBe('ready');
  expect(resolveDailyCriterionRecordingContext(next.classes[0],settings,approved).status).toBe('ready');
  expect(readStudentCriterionEvidence(next.classes[0],settings,'s1',approved).status).toBe('ready');
  expect(JSON.stringify(data.classes[0].assessmentEvidenceV1)).toBe(oldSnapshot);
 });
 test('current read surfaces treat fully authorized historical-only archives as absent, not damaged',()=>{
  const c=classroom(),authorized=resolveApprovedAssessmentScopes({classes:[c]},planning(),settings);
  expect(listDailyPlannedProofs(c,settings,authorized)).toEqual({status:'absent'});
  expect(resolveDailyCriterionRecordingContext(c,settings,authorized)).toEqual({status:'absent'});
  expect(readStudentCriterionEvidence(c,settings,'s1',authorized)).toEqual({status:'absent'});
  expect(listDailyPlannedProofs(c,settings,[current]).status).toBe('unverified');
  expect(resolveDailyCriterionRecordingContext(c,settings,[current]).status).toBe('unverified');
 });
 test('scope authority does not change when the historical document forges its subject',()=>{
  const data=app(),authorized=resolveApprovedAssessmentScopes(data,planning(),settings);
  (data.classes[0].assessmentEvidenceV1!.documents[0].document as unknown as {subjectCode:string}).subjectCode='MATH';
  expect(resolveApprovedAssessmentScopes(data,planning(),settings)).toEqual(authorized);
  expect(validateAssessmentArchiveV1(data,authorized).valid).toBe(false);
 });

 test('approved historical planning years normalize slash-short and dash-long formats without rewriting source',()=>{
  const original=app(),before=JSON.stringify(original);
  for(const schoolYear of ['2026/27','2026-2027','2026 / 2027']){
   const source=planning();
   const adapted:PlanningState={...source,
    profiles:source.profiles.map(p=>({...p,schoolYear}))};
   const saved=JSON.stringify(adapted);
   const scopes=resolveApprovedAssessmentScopes(original,adapted,settings);
   expect(scopes).toEqual([current,older]);
   expect(validateAssessmentArchiveV1(original,scopes)).toEqual({valid:true,state:'present'});
   expect(JSON.stringify(adapted)).toBe(saved);
  }
  for(const schoolYear of ['2026/28','2026-2028','2026/2026','2026-2025']){
   const source=planning();
   const adapted:PlanningState={...source,
    profiles:source.profiles.map(p=>({...p,schoolYear}))};
   const scopes=resolveApprovedAssessmentScopes(original,adapted,settings);
   expect(scopes).toEqual([current]); // A malformed profile cannot grant authority.
   expect(validateAssessmentArchiveV1(original,scopes)).toEqual({valid:false,issue:'INVALID_SCOPE'});
  }
  expect(JSON.stringify(original)).toBe(before);
 });
 test('multiple classes retain full-archive validation while all four class readers accept their scoped approvals',()=>{
  const data=app();
  const second:ClassData={id:'class-second',name:'Seconda classe sintetica',
   students:[{id:'other-student',name:'Studente sintetico seconda classe'}],
   grades:[],behaviors:[]};
  data.classes.push(second);
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  expect(approved.some(scope=>scope.classId===second.id)).toBe(true);
  expect(approved.filter(scope=>scope.classId===boardScope.classId)).toEqual([current,older]);
  expect(validateAssessmentArchiveV1(data,approved)).toEqual({valid:true,state:'present'});
  // Reproduce Copilot's original false rejection without relaxing the validator.
  expect(validateAssessmentArchiveV1({classes:[data.classes[0]]},approved))
   .toEqual({valid:false,issue:'INVALID_SCOPE'});
  const preview=previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',approved);
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Multi-class preview denied despite independent scopes');
  const updated=deriveConfirmedDailyAssessmentSetup(data,approved,preview.review,confirmation);
  expect(validateAssessmentArchiveV1(updated,approved)).toEqual({valid:true,state:'present'});
  expect(updated.classes[1]).toEqual(second);
  expect(listDailyPlannedProofs(updated.classes[0],settings,approved).status).toBe('ready');
  expect(resolveDailyCriterionRecordingContext(updated.classes[0],settings,approved).status).toBe('ready');
  expect(readStudentCriterionEvidence(updated.classes[0],settings,'s1',approved).status).toBe('ready');
 });
 test('class-scoped filtering cannot grant a foreign scope or bypass a corrupt second class at commit',()=>{
  const data=app();
  data.classes.push({id:'class-second',name:'Altra classe sintetica',
   students:[{id:'other-student',name:'Altro studente'}],grades:[],behaviors:[]});
  const approved=resolveApprovedAssessmentScopes(data,planning(),settings);
  const foreign=approved.filter(scope=>scope.classId==='class-second');
  expect(previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',foreign).valid).toBe(false);
  expect(listDailyPlannedProofs(data.classes[0],settings,foreign).status).toBe('unverified');
  expect(resolveDailyCriterionRecordingContext(data.classes[0],settings,foreign).status).toBe('unverified');
  expect(readStudentCriterionEvidence(data.classes[0],settings,'s1',foreign).status).toBe('unverified');
  const preview=previewDailyAssessmentSetup(data.classes[0],settings,request(),'completed',approved);
  expect(preview.valid).toBe(true);
  if(!preview.valid)throw Error('Expected authorized synthetic review');
  const damaged=structuredClone(data);
  damaged.classes[1].assessmentEvidenceV1={version:1,documents:[]};
  expect(validateAssessmentArchiveV1(damaged,approved).valid).toBe(false);
  expect(()=>deriveConfirmedDailyAssessmentSetup(damaged,approved,preview.review,confirmation)).toThrow();
 });
});
