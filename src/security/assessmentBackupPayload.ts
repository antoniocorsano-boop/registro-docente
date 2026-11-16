/**
 * VAL-01/D1b.2a: isolated v7 codec and inspection, NOT a restore authority.
 * The production v6 reader/writer, encrypted envelope, Vault and UI are unchanged.
 */
import { validateAssessmentArchiveV1 } from '../assessment/assessmentArchive';
import { snapshotAssessmentData } from '../assessment/assessmentRevisionBindings';
import { normalizeBackupPayloadVerified, BACKUP_DATA_VERSION_V6 } from './backupPayload';
import { sanitizePersistedSettings } from './dataClassification';
import type { CompleteSecureAppSnapshot } from './secureAppStorage';

export const ASSESSMENT_BACKUP_DATA_VERSION_V7 = 7;
type NormalizedSnapshot = Awaited<ReturnType<typeof normalizeBackupPayloadVerified>>;
type SourceVersion = 2|3|4|5|6|7|'legacy';
export interface AssessmentBackupPayloadV7 {
  readonly app:'registro-docente';
  readonly backupDataVersion:7;
  readonly exportedAt:string;
  readonly snapshot:NormalizedSnapshot;
}
export interface AssessmentBackupInspection {
  readonly sourceVersion:SourceVersion;
  readonly snapshot:NormalizedSnapshot;
  /** Conservative warning, never a permission to replace the destination. */
  readonly replacementRequiresReview:boolean;
}

type Row=Record<string,unknown>;
const DATASETS=['appData','settings','udas','customTests','submissions','planning','library','professionalMemory','copilotState','meta'] as const;
const ROOT=['app','backupDataVersion','exportedAt','snapshot'] as const;
const DOMAIN='assessmentEvidenceV1';
const own=(o:object,k:string)=>Object.prototype.hasOwnProperty.call(o,k);
const row=(v:unknown):v is Row=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:readonly string[]):v is Row=>row(v)&&Object.keys(v).length===keys.length&&keys.every(k=>own(v,k));
const bad=()=>new Error('Copia di sicurezza valutativa non valida o non supportata.');

function timestamp(v:unknown):v is string{
  if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v))return false;
  const t=Date.parse(v);
  return Number.isFinite(t)&&new Date(t).toISOString()===(v.length===20?v.slice(0,-1)+'.000Z':v);
}

/** Reuse the defensive snapshot boundary; no getters or user-supplied toJSON.
 * Convert null-prototype records to plain objects only after rejecting keys
 * which cannot safely survive the existing JSON encryption serializer.
 */
function detach(v:unknown):unknown{
  try{
    const copy=(x:unknown):unknown=>{
      if(Array.isArray(x))return x.map(copy);
      if(row(x)){
        const out:Row={};
        for(const k of Object.keys(x)){
          if(k==='__proto__'||k==='constructor'||k==='prototype'||k==='toJSON')throw bad();
          out[k]=copy(x[k]);
        }
        return out;
      }
      if(typeof x==='number'&&!Number.isFinite(x))throw bad();
      return x;
    };
    return copy(snapshotAssessmentData(v));
  }catch{throw bad();}
}

function hasDomain(v:unknown):boolean{
  if(Array.isArray(v))return v.some(hasDomain);
  return row(v)&&(own(v,DOMAIN)||Object.values(v).some(hasDomain));
}
function assertPortable(v:unknown,allowDomain=false):void{
  if(v===undefined)throw bad();
  if(Array.isArray(v)){for(const x of v)assertPortable(x,allowDomain);return;}
  if(!row(v))return;
  for(const [k,x] of Object.entries(v)){
    // The crypto serializer removes apiKey fields recursively. Never report a
    // v7 payload as fully preserved if that serializer would silently drop one.
    if(k==='apiKey'||(k===DOMAIN&&!allowDomain))throw bad();
    assertPortable(x,allowDomain);
  }
}

function assertV7Placement(s:Row):void{
  const app=s.appData;
  if(!row(app)||!Array.isArray(app.classes))throw bad();
  // Only class-level containers may carry this reserved domain.
  for(const [k,v] of Object.entries(s))if(k!=='appData'&&hasDomain(v))throw bad();
  for(const [k,v] of Object.entries(app))if(k!=='classes'&&(k===DOMAIN||hasDomain(v)))throw bad();
  for(const cls of app.classes){
    if(!row(cls))throw bad();
    for(const [k,v] of Object.entries(cls)){
      if(k===DOMAIN){if(hasDomain(v))throw bad();}
      else if(hasDomain(v))throw bad();
    }
  }
}

async function normalizeV7(s:unknown,scopes:unknown):Promise<NormalizedSnapshot>{
  if(!exact(s,DATASETS)||!row(s.settings))throw bad();
  assertV7Placement(s);
  if(!validateAssessmentArchiveV1(s.appData,scopes).valid)throw bad();
  assertPortable(s,true);
  // Adapt only the version discriminator in memory to reuse all the existing
  // v6 dataset and council-integrity checks. Never export this internal shape.
  // Use the source itself as the mode reference; a destination must not confer
  // a new archive mode on a v7 file that does not declare one.
  const normalized=await normalizeBackupPayloadVerified({
    app:'registro-docente',backupDataVersion:BACKUP_DATA_VERSION_V6,snapshot:s
  },s as unknown as CompleteSecureAppSnapshot);
  if(!validateAssessmentArchiveV1(normalized.appData,scopes).valid)throw bad();
  return normalized;
}

export async function createAssessmentBackupPayloadV7(
  snapshot:unknown,approvedScopes:unknown,exportedAt:string
):Promise<AssessmentBackupPayloadV7>{
  if(!timestamp(exportedAt))throw bad();
  const s=detach(snapshot),scopes=detach(approvedScopes);
  if(!exact(s,DATASETS)||!row(s.settings))throw bad();
  // Keep the established secret exclusion on export. All other apiKey
  // occurrences are refused rather than silently lost during encryption.
  s.settings=sanitizePersistedSettings(s.settings as CompleteSecureAppSnapshot['settings']);
  const normalized=await normalizeV7(s,scopes);
  return {app:'registro-docente',backupDataVersion:7,exportedAt,snapshot:normalized};
}

export async function inspectAssessmentBackupPayload(
  payload:unknown,current:CompleteSecureAppSnapshot,approvedScopes:unknown
):Promise<AssessmentBackupInspection>{
  const p=detach(payload),destination=detach(current),scopes=detach(approvedScopes);
  if(!row(p)||!row(destination)||!row(destination.appData)||!Array.isArray(destination.appData.classes))throw bad();
  const replacementRequiresReview=hasDomain(destination.appData);
  if(p.backupDataVersion===7){
    if(!exact(p,ROOT)||p.app!=='registro-docente'||!timestamp(p.exportedAt))throw bad();
    return {sourceVersion:7,snapshot:await normalizeV7(p.snapshot,scopes),replacementRequiresReview};
  }

  // Historic labels may not smuggle the new reserved domain through any
  // recognized or ignored alias. No derivation from current evidence.
  if(hasDomain(p))throw bad();
  const version=p.backupDataVersion;
  if(version!==2&&version!==3&&version!==4&&version!==5&&version!==6&&
     (version!==undefined||own(p,'backupDataVersion')))throw bad();
  const normalized=await normalizeBackupPayloadVerified(p,destination as unknown as CompleteSecureAppSnapshot);
  if(hasDomain(normalized.appData))throw bad();
  return {sourceVersion:version===undefined?'legacy':version,snapshot:normalized,replacementRequiresReview};
}
