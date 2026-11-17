/** S-R03b: read-only compatibility review of already authenticated payloads.
 * No file access, grants, persistence, export, or runtime caller. The summary
 * is not authorization to replace the current archive. */
import {inspectAssessmentBackupPayload} from './assessmentBackupPayload';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';

const BASE=['appData','settings','udas','customTests','submissions','meta'] as const;
const ADDITIONS=['planning','library','professionalMemory','copilotState'] as const;
type Dataset=(typeof BASE)[number]|(typeof ADDITIONS)[number];
type HistoricalVersion=2|3|4|5;
export type HistoricalRecoveryPreview=Readonly<{
  sourceVersion:HistoricalVersion;
  exportedAt:string;
  presentDatasets:readonly Dataset[];
  absentDatasets:readonly Dataset[];
  replacementRequiresReview:true;
  assessmentReviewRequired:boolean;
}>;
const row=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const exact=(v:unknown,keys:readonly string[])=>row(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.prototype.hasOwnProperty.call(v,k));
const refused=()=>Error('Formato storico non verificabile per questa anteprima.');

export async function previewHistoricalRecovery(
  payload:unknown,current:CompleteSecureAppSnapshot
):Promise<HistoricalRecoveryPreview>{
  // Detach before asynchronous validation. Never expose normalized contents.
  const source:unknown=structuredClone(payload);
  if(!row(source)||!exact(source,['app','backupDataVersion','exportedAt','snapshot'])||
    source.app!=='registro-docente'||typeof source.exportedAt!=='string'||
    !Number.isFinite(Date.parse(source.exportedAt)))throw refused();
  const version=source.backupDataVersion;
  if(version!==2&&version!==3&&version!==4&&version!==5)throw refused();
  const present:Dataset[]=[...BASE,...ADDITIONS.slice(0,version-2)];
  const absent:Dataset[]=ADDITIONS.slice(version-2);
  if(!row(source.snapshot)||!exact(source.snapshot,present))throw refused();
  // A version label alone is not evidence of a valid historical snapshot.
  const meta=source.snapshot.meta;
  if(!row(meta)||typeof meta.changes!=='number'||!Number.isSafeInteger(meta.changes)||meta.changes<0||
    !(meta.lastBackup===null||(typeof meta.lastBackup==='string'&&Number.isFinite(Date.parse(meta.lastBackup)))))throw refused();
  const checked=await inspectAssessmentBackupPayload(source,current,[]);
  if(checked.sourceVersion!==version)throw refused();
  return Object.freeze({
    sourceVersion:version,exportedAt:source.exportedAt,
    presentDatasets:Object.freeze(present),absentDatasets:Object.freeze(absent),
    replacementRequiresReview:true,
    assessmentReviewRequired:checked.replacementRequiresReview
  });
}
