/** DOC-01/D4c3e4: independent institutional V9 codec — RED.
 * No persistence, Android picker, DB2 grant or product wiring in this stage.
 */
import type {CompleteSecureAppSnapshot} from './secureAppStorage';
import type {AppData} from '../types';
import type {InstitutionalDocumentHistoryV2} from '../documents/institutionalDocumentHistoryV2';
export const INSTITUTIONAL_BACKUP_DATA_VERSION_V9=9;
export type InstitutionalSnapshotV9=Omit<CompleteSecureAppSnapshot,'appData'>&{appData:AppData&{documentHistoryV2:InstitutionalDocumentHistoryV2}};
export interface InstitutionalBackupPayloadV9 {
 readonly app:'registro-docente';
 readonly backupDataVersion:9;
 readonly exportedAt:string;
 readonly snapshot:InstitutionalSnapshotV9;
}
export interface InstitutionalBackupInspectionV9 {
 readonly sourceVersion:9;
 readonly snapshot:InstitutionalSnapshotV9;
 readonly replacementRequiresReview:true;
}
export async function createInstitutionalBackupPayloadV9(_snapshot:unknown,_assessmentScopes:unknown,_scope:unknown,_exportedAt:string):Promise<InstitutionalBackupPayloadV9>{throw Error('DOC01_V9_NOT_IMPLEMENTED');}
export async function inspectInstitutionalBackupPayloadV9(_payload:unknown,_current:CompleteSecureAppSnapshot,_assessmentScopes:unknown,_scope:unknown):Promise<InstitutionalBackupInspectionV9>{throw Error('DOC01_V9_NOT_IMPLEMENTED');}
export async function projectInstitutionalRestoreV9(_current:CompleteSecureAppSnapshot,_incoming:unknown,_recovery:unknown,
 _currentAssessmentScopes:unknown,_incomingAssessmentScopes:unknown,_scope:unknown):Promise<CompleteSecureAppSnapshot>{throw Error('DOC01_V9_NOT_IMPLEMENTED');}
export async function encryptInstitutionalBackupV9(_snapshot:unknown,_password:string,_assessmentScopes:unknown,_scope:unknown,_exportedAt:string):Promise<string>{throw Error('DOC01_V9_NOT_IMPLEMENTED');}
export async function decryptAndInspectInstitutionalBackupV9(_ciphertext:string,_password:string,_current:CompleteSecureAppSnapshot,
 _assessmentScopes:unknown,_scope:unknown):Promise<InstitutionalBackupInspectionV9>{throw Error('DOC01_V9_NOT_IMPLEMENTED');}
