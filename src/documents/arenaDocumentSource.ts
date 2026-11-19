/** DOC-01/D1d2 — read-only annual curriculum source review.
 * Arena V1 supplies annual disciplinary sections, not structured objectives.
 * References are internal and no source text is returned or promoted.
 */
import { previewArenaPlanningContext, bindAcceptedArenaPlanningContext } from '../planning/arenaPlanningContext';
import { normalizeSchoolYear, resolvePlanningFrame } from '../planning/planningFrameResolver';
import { resolveCurricularSubjectCode } from '../planning/curricularSubjectCode';
import { resolveCanonicalRegistroClass } from '../teaching/classIdentity';
import type { TeachingProfile, ArenaPlanningContext } from '../planning/types';

type Row=Record<string,unknown>;
type Issue='INVALID_CONTEXT'|'INVALID_CLASS'|'INVALID_PROFILE'|'INVALID_SOURCE'|'STALE_SELECTION'|'INVALID_ITEM'|'INVALID_INPUT';
type Reference=Readonly<{itemId:string;kind:'ANNUALITA_DISCIPLINARE';sourceSection:string}>;
type Source=Readonly<{kind:'annual-curriculum-references';official:false;objectives:null;transversalObjectives:null;count:number;references:readonly Reference[];contextId:string;masterVersion:string;sourceRevisionId:string}>;
type Internal={valid:false;issue:Issue}|{valid:true;source:Source;basis:string};
type Review={valid:false;issue:Issue}|{valid:true;review:Readonly<{source:Source;isCurrent:(scope:unknown,classes:unknown,profiles:unknown,accepted:unknown,selection:unknown)=>boolean}>};
const fail=(issue:Issue):{valid:false;issue:Issue}=>({valid:false,issue});
function record(value:unknown):value is Row {
  if(value===null||typeof value!=='object'||Array.isArray(value))return false;
  if(![Object.prototype,null].includes(Object.getPrototypeOf(value)))return false;
  return Reflect.ownKeys(value).every(k=>{const d=Object.getOwnPropertyDescriptor(value,k);return typeof k==='string'&&!!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value');});
}
function exact(value:unknown,keys:readonly string[]):value is Row {
  return record(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));
}
const nonempty=(x:unknown):x is string=>typeof x==='string'&&!!x.trim()&&x.length<=512;
const instant=(x:unknown):x is string=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(x)&&Number.isFinite(Date.parse(x));
const scopeKeys=['institutionRef','cohortRef','classId','schoolYear','subjectCode','gradeLevel','regimeRef'];
const selectionKeys=['confirmedByTeacher','contextId','acceptedAt','masterVersion','sourceCommit','sourceRevisionId','sourceSchoolYear','fingerprint','itemIds'];
const contextKeys=['id','acceptedAt','profileId','contract','contractVersion','sourceProduct','targetProduct','importMode','acceptanceRequired','automaticWriteAllowed','institutionRef','schoolYear','sourceSchoolYear','schoolOrder','subjectCode','gradeLevel','cohortRef','cohortRefKind','applicabilityStatus','regimeRef','authorityState','vigencyStatus','authorityReceiptRef','masterId','masterVersion','structuralFingerprint','provenance','curricoloItems','privacyClass'];
function dense(value:unknown):value is unknown[] {
  if(!Array.isArray(value)||value.length>1000||Reflect.ownKeys(value).length!==value.length+1)return false;
  return Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).every(d=>!!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value'));
}
function inspect(scope:unknown,classes:unknown,profiles:unknown,accepted:unknown,selection:unknown):Internal {
 try{
  if(!exact(scope,scopeKeys)||!scopeKeys.filter(k=>k!=='gradeLevel').every(k=>nonempty(scope[k]))||typeof scope.gradeLevel!=='number'||![1,2,3].includes(scope.gradeLevel))return fail('INVALID_CONTEXT');
  const year=normalizeSchoolYear(scope.schoolYear as string),subject=resolveCurricularSubjectCode(scope.subjectCode as string);
  if(!year||!subject)return fail('INVALID_CONTEXT');
  if(!dense(classes)||!classes.every(c=>exact(c,['id','name'])&&nonempty(c.id)&&nonempty(c.name)))return fail('INVALID_CLASS');
  const identities=classes as {id:string;name:string}[];
  if(new Set(identities.map(c=>c.id)).size!==identities.length)return fail('INVALID_CLASS');
  const cls=identities.find(c=>c.id===scope.classId);
  if(!cls)return fail('INVALID_CLASS');
  const resolved=resolveCanonicalRegistroClass(cls.name,identities);
  if(resolved.status!=='resolved'||resolved.classId!==scope.classId)return fail('INVALID_CLASS');
  if(!exact(selection,selectionKeys)||selection.confirmedByTeacher!==true||!instant(selection.acceptedAt)
    ||!selectionKeys.filter(k=>k!=='confirmedByTeacher'&&k!=='itemIds').every(k=>nonempty(selection[k]))
    ||!dense(selection.itemIds)||!selection.itemIds.length||!selection.itemIds.every(nonempty)||new Set(selection.itemIds).size!==selection.itemIds.length)return fail('STALE_SELECTION');
  if(!dense(profiles)||!profiles.every(p=>record(p)&&nonempty(p.id)&&nonempty(p.schoolYear)&&nonempty(p.subjectCode)))return fail('INVALID_PROFILE');
  if(!dense(accepted)||!accepted.every(c=>exact(c,contextKeys)))return fail('INVALID_SOURCE');
  // The existing resolver owns profile/context ambiguity and annual applicability.
  const planning={schemaVersion:2 as const,profiles:profiles as TeachingProfile[],arenaContexts:accepted as ArenaPlanningContext[],resources:[],masterPrograms:[],classInstances:[],docenteOsProjections:[]};
  const frame=resolvePlanningFrame({className:cls.name,planning,schoolYear:year,subjectCode:subject});
  if(frame.status!=='resolved')return fail('INVALID_PROFILE');
  const profile=frame.profile;
  if(profile.schoolOrder!=='lower_secondary'||profile.gradeLevel!==scope.gradeLevel||profile.cohortRef!==scope.cohortRef||profile.normativeRegime!==scope.regimeRef)return fail('INVALID_PROFILE');
  const a=frame.arenaContext;
  if(!a||a.institutionRef!==scope.institutionRef||!instant(a.acceptedAt)||!nonempty(a.authorityReceiptRef)||!normalizeSchoolYear(a.sourceSchoolYear))return fail('INVALID_SOURCE');
  // Revalidate the existing imported context using its canonical V1 consumer.
  const {id,acceptedAt,profileId,institutionRef,regimeRef,...wire}=a;
  const preview=previewArenaPlanningContext({...wire,instituteName:institutionRef,normativeRegime:regimeRef},profile);
  if(!preview.ok||profileId!==profile.id)return fail('INVALID_SOURCE');
  const validated=bindAcceptedArenaPlanningContext([],preview.context,{accepted:true,acceptedAt})[0];
  if(validated.id!==id)return fail('INVALID_SOURCE');
  if(selection.contextId!==id||selection.acceptedAt!==acceptedAt||selection.masterVersion!==validated.masterVersion
     ||selection.sourceCommit!==validated.provenance.sourceCommit||selection.sourceRevisionId!==validated.provenance.sourceRevisionId
     ||selection.sourceSchoolYear!==validated.sourceSchoolYear||selection.fingerprint!==validated.structuralFingerprint.hash)return fail('STALE_SELECTION');
  if(new Set(validated.curricoloItems.map(i=>i.id)).size!==validated.curricoloItems.length)return fail('INVALID_ITEM');
  const gradeLabel='Classe '+['','I','II','III'][profile.gradeLevel];
  const references:Reference[]=[];
  for(const itemId of selection.itemIds){
    const item=validated.curricoloItems.find(i=>i.id===itemId);
    if(!item||item.schoolStage!=='Secondaria di primo grado'||item.gradeLabel!==gradeLabel||item.kind!=='ANNUALITA_DISCIPLINARE')return fail('INVALID_ITEM');
    references.push(Object.freeze({itemId:item.id,kind:'ANNUALITA_DISCIPLINARE',sourceSection:item.sourceSection}));
  }
  // A master fingerprint is not proof of payload integrity. Keep the validated
  // snapshot private in memory and compare exact content on later review.
  const basis=JSON.stringify([scopeKeys.map(k=>scope[k]),cls.id,cls.name,validated,selection.itemIds]);
  return {valid:true,basis,source:Object.freeze({kind:'annual-curriculum-references',official:false,objectives:null,transversalObjectives:null,count:references.length,references:Object.freeze(references),contextId:id,masterVersion:validated.masterVersion,sourceRevisionId:validated.provenance.sourceRevisionId})};
 }catch{return fail('INVALID_INPUT');}
}
export function reviewArenaDocumentSource(scope:unknown,classes:unknown,profiles:unknown,accepted:unknown,selection:unknown):Review {
 const result=inspect(scope,classes,profiles,accepted,selection);
 if(!result.valid)return result;
 return {valid:true,review:Object.freeze({source:result.source,isCurrent:(s:unknown,c:unknown,p:unknown,a:unknown,r:unknown)=>{
   const next=inspect(s,c,p,a,r);return next.valid&&next.basis===result.basis;
 }})};
}
