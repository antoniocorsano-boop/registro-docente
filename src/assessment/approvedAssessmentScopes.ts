/**
 * AUDIT-PRE-01 / AP-03 — Independent authority for archived assessment scopes.
 *
 * Never infer authorization from the assessment documents or their bindings.
 * Current teacher settings authorize current class contexts. An older/different
 * subject is authorized only by a teacher-approved and *adopted* local planning
 * program explicitly bound to that physical Registro class ID.
 *
 * This is a read-only projection of existing encrypted local state. It grants
 * no permissions to change a historical document: the write workflow still
 * requires the selected class, current settings and teacher confirmation.
 */
import type {AppData,AppSettings} from '../types';
import type {PlanningState} from '../planning/types';
import type {ApprovedAssessmentScope} from './assessmentArchive';
import {resolveAssessmentSubjectCode} from './assessmentSubjectScope';

const validId=(x:unknown):x is string=>
 typeof x==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
const validYear=(x:unknown):x is string=>
 typeof x==='string'&&/^\d{4}\/\d{4}$/.test(x)&&
 Number(x.slice(5))===Number(x.slice(0,4))+1;
const key=(s:ApprovedAssessmentScope)=>JSON.stringify([s.classId,s.schoolYear,s.subjectCode]);

export function resolveApprovedAssessmentScopes(
 app:Pick<AppData,'classes'>,
 planning:Pick<PlanningState,'profiles'|'masterPrograms'|'classInstances'>,
 settings:Pick<AppSettings,'year'|'subject'>
):readonly ApprovedAssessmentScope[]{
 if(!Array.isArray(app?.classes)||!Array.isArray(planning?.profiles)||
    !Array.isArray(planning?.masterPrograms)||!Array.isArray(planning?.classInstances))return [];
 const subjectCode=resolveAssessmentSubjectCode(settings?.subject);
 if(!subjectCode||!validYear(settings.year))return [];
 const ids=new Set<string>();
 for(const c of app.classes){
  if(!validId(c?.id)||ids.has(c.id))return [];
  ids.add(c.id);
 }
 const result=new Map<string,ApprovedAssessmentScope>();
 const approve=(s:ApprovedAssessmentScope)=>{
  if(!ids.has(s.classId)||!validId(s.subjectCode)||!validYear(s.schoolYear))return;
  result.set(key(s),s);
 };
 // Current teacher configuration is independent of the detached evidence.
 for(const classId of ids)approve({classId,schoolYear:settings.year,subjectCode});
 const masters=new Map<string,(typeof planning.masterPrograms)[number]>();
 for(const m of planning.masterPrograms){
  if(!validId(m?.id)||masters.has(m.id))return [];
  masters.set(m.id,m);
 }
 const profiles=new Map<string,(typeof planning.profiles)[number]>();
 for(const p of planning.profiles){
  if(!validId(p?.id)||profiles.has(p.id))return [];
  profiles.set(p.id,p);
 }
 for(const instance of planning.classInstances){
  if(!ids.has(instance?.classId)||!validId(instance.masterProgramId)||
     !validId(instance.adoptedVersionId))continue;
  const master=masters.get(instance.masterProgramId);
  if(!master||master.status!=='approved'||
     !master.currentVersionId||master.currentVersionId!==instance.adoptedVersionId)continue;
  const p=profiles.get(master.profileId);
  if(!p||!validYear(p.schoolYear)||!validId(p.subjectCode))continue;
  approve({classId:instance.classId,schoolYear:p.schoolYear,subjectCode:p.subjectCode});
 }
 return [...result.values()];
}
