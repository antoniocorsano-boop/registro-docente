/** DOC-01/D4c3e3 — separate institutional document model.
 * Explicitly NOT a migration of the demo-only V1 history or V8 codec. */
export type InstitutionalDocumentKindV2='final-report'|'program-completed'|'disciplinary-plan'|'council-disciplinary-contribution';
export type InstitutionalDocumentScopeV2=Readonly<{institutionCode:string;siteCode:string;schoolYear:string;schoolOrder:'lower-secondary';gradeLevel:1|2|3;classId:string;subjectCode:string;purpose:'disciplinary-plan'|'council-contribution'}>;
export type InstitutionalDocumentSectionV2=Readonly<{field:string;text:string}>;
export type InstitutionalDocumentRecordV2=Readonly<{
 schemaVersion:2;labOnly:false;official:false;approval:'teacher-confirmed';documentId:string;revisionId:string;
 revisionNumber:number;previousRevisionId:string|null;revisionReason:'initial'|'content-update'|'source-update'|'correction';
 kind:InstitutionalDocumentKindV2;scope:InstitutionalDocumentScopeV2;
 confirmedAt:string;title:string;sections:readonly InstitutionalDocumentSectionV2[];
 contentDigest:string;
}>;
export type InstitutionalDocumentEventV2=Readonly<{eventId:string;previousDigest:string|null;operation:
 |{kind:'append';record:InstitutionalDocumentRecordV2}
 |{kind:'revoke';documentId:string;revisionId:string;reason:'withdrawn'|'correction-required';confirmedAt:string;confirmedByTeacher:true};
 eventDigest:string}>;
export type InstitutionalDocumentHistoryV2=Readonly<{schemaVersion:2;labOnly:false;events:readonly InstitutionalDocumentEventV2[]}>;
export type InstitutionalDocumentInspectionV2={valid:true;archive:InstitutionalDocumentHistoryV2;head:string|null;confirmedCount:number;revokedCount:number}
 |{valid:false;issue:string};
export async function createInstitutionalDocumentRecordV2(_input:unknown):Promise<InstitutionalDocumentRecordV2>{throw Error('DOC01_D4C3E3_NOT_IMPLEMENTED');}
export async function validateInstitutionalDocumentHistoryV2(_history:unknown,_scope:unknown):Promise<InstitutionalDocumentInspectionV2>{throw Error('DOC01_D4C3E3_NOT_IMPLEMENTED');}
export async function appendInstitutionalDocumentV2(_history:unknown,_scope:unknown,_record:unknown,_expectedHead:string|null,_eventId:string):Promise<InstitutionalDocumentInspectionV2>{throw Error('DOC01_D4C3E3_NOT_IMPLEMENTED');}
export async function revokeInstitutionalDocumentV2(_history:unknown,_scope:unknown,_revoke:unknown,_expectedHead:string|null,_eventId:string):Promise<InstitutionalDocumentInspectionV2>{throw Error('DOC01_D4C3E3_NOT_IMPLEMENTED');}
