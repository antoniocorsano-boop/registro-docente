/** DOC-01/D1d1 — read-only, explicitly selected professional planning references.
 * No document text, personal data, inferred institutional authority or runtime wiring.
 * The caller supplies a separately reviewed institution/cohort binding: the
 * Docente OS V1 contract itself does not establish these identities.
 */
import { normalizePlanningState } from '../planning/normalizePlanningState';
import { normalizeSchoolYear } from '../planning/planningFrameResolver';
import { resolveCurricularSubjectCode } from '../planning/curricularSubjectCode';
import { resolveCanonicalRegistroClass } from '../teaching/classIdentity';

type Row=Record<string,unknown>;
type Issue='INVALID_CONTEXT'|'INVALID_ACCEPTANCE'|'STALE_SELECTION'|'UNCONFIRMED_SECTION'|'INVALID_CLASS'|'INVALID_UDA'|'INVALID_INPUT';
type PlannedReference=Readonly<{udaId:string;plannedHours:number}>;
type Source=Readonly<{kind:'planned-uda-references';official:false;completedActivities:null;count:number;references:readonly PlannedReference[];projectionHash:string;acceptedAt:string;sourceSectionId:string}>;
type Review={valid:false;issue:Issue}|{valid:true;source:Source};
const fail=(issue:Issue):Review=>({valid:false,issue});
function exact(value:unknown,keys:readonly string[]):value is Row {
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
  const own=Reflect.ownKeys(value);
  return own.length===keys.length&&keys.every(key=>{
    const d=Object.getOwnPropertyDescriptor(value,key);
    return !!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');
  });
}
const nonempty=(x:unknown):x is string=>typeof x==='string'&&!!x.trim()&&x.length<=512;
const instant=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x;
export function reviewPlanningDocumentSource(scope:unknown,classes:unknown,accepted:unknown,selection:unknown):Review {
 try {
  if(!exact(scope,['institutionRef','cohortRef','classId','schoolYear','subjectCode','gradeLevel'])
    ||!nonempty(scope.institutionRef)||!nonempty(scope.cohortRef)||!nonempty(scope.classId)
    ||!nonempty(scope.schoolYear)||!nonempty(scope.subjectCode)
    ||typeof scope.gradeLevel!=='number'||![1,2,3].includes(scope.gradeLevel))return fail('INVALID_CONTEXT');
  const year=normalizeSchoolYear(scope.schoolYear),subject=resolveCurricularSubjectCode(scope.subjectCode);
  if(!year||!subject)return fail('INVALID_CONTEXT');
  if(!exact(selection,['confirmedByTeacher','institutionRef','cohortRef','projectionHash','acceptedAt','sourceSectionId','udaIds'])
    ||selection.confirmedByTeacher!==true||selection.institutionRef!==scope.institutionRef||selection.cohortRef!==scope.cohortRef
    ||typeof selection.projectionHash!=='string'||!/^[a-f0-9]{64}$/.test(selection.projectionHash)||!instant(selection.acceptedAt)
    ||!nonempty(selection.sourceSectionId)||!Array.isArray(selection.udaIds)||!selection.udaIds.length
    ||!selection.udaIds.every(nonempty)||new Set(selection.udaIds).size!==selection.udaIds.length)return fail('STALE_SELECTION');
  if(!Array.isArray(classes)||!classes.every(c=>exact(c,['id','name'])&&nonempty(c.id)&&nonempty(c.name))
    ||new Set(classes.map(c=>c.id)).size!==classes.length)return fail('INVALID_CLASS');
  const identities=classes as {id:string;name:string}[];
  if(!Array.isArray(accepted))return fail('INVALID_ACCEPTANCE');
  // Reuse canonical planning validation, not an independent archive schema.
  const state=normalizePlanningState({schemaVersion:2,profiles:[],arenaContexts:[],resources:[],masterPrograms:[],classInstances:[],docenteOsProjections:accepted});
  const matches=state.docenteOsProjections.filter(a=>normalizeSchoolYear(a.projection.schoolYear)===year
    &&resolveCurricularSubjectCode(a.projection.disciplineName)===subject);
  if(matches.length!==1)return fail('INVALID_ACCEPTANCE');
  const a=matches[0];
  if(a.projection.projectionFingerprint.hash!==selection.projectionHash||a.acceptedAt!==selection.acceptedAt)return fail('STALE_SELECTION');
  const sections=a.projection.classes.filter(s=>s.sourceSectionId===selection.sourceSectionId);
  if(sections.length!==1)return fail('STALE_SELECTION');
  const section=sections[0];
  if(section.sectionStatus!=='CONFERMATA')return fail('UNCONFIRMED_SECTION');
  if(section.grade!==scope.gradeLevel)return fail('INVALID_CLASS');
  const binding=a.classReconciliation.filter(r=>r.sourceSectionId===section.sourceSectionId);
  if(binding.length!==1||binding[0].status!=='resolved'||binding[0].registroClassId!==scope.classId)return fail('INVALID_CLASS');
  const resolution=resolveCanonicalRegistroClass(section.compactLabel,identities);
  if(resolution.status!=='resolved'||resolution.classId!==scope.classId)return fail('INVALID_CLASS');
  const references:PlannedReference[]=[];
  for(const id of selection.udaIds){
    const found=section.udas.filter(u=>u.projectedUdaId===id);
    if(found.length!==1)return fail('INVALID_UDA');
    references.push(Object.freeze({udaId:found[0].projectedUdaId,plannedHours:found[0].plannedHours}));
  }
  return {valid:true,source:Object.freeze({kind:'planned-uda-references',official:false,completedActivities:null,
    count:references.length,references:Object.freeze(references),projectionHash:a.projection.projectionFingerprint.hash,
    acceptedAt:a.acceptedAt,sourceSectionId:section.sourceSectionId})};
 }catch{return fail('INVALID_INPUT');}
}
