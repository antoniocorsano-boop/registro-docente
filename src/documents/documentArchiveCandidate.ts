/** DOC-01/D4c1 RED scaffold: deliberately fails closed until implemented.
 * No storage, source copy, signature, real-data adapter or runtime wiring.
 */
import type {proposeDocumentRevision} from './documentRevisionIdentity';
import type {createFinalRevisionReview} from './finalRevisionConfirmation';
import type {createPlanningRevisionReview} from './planningRevisionConfirmation';
type History=Extract<ReturnType<typeof proposeDocumentRevision>,{valid:true}>['history'];
type FinalPreview=Extract<ReturnType<typeof createFinalRevisionReview>,{valid:true}>['review']['preview'];
type PlanningPreview=Extract<ReturnType<typeof createPlanningRevisionReview>,{valid:true}>['review']['preview'];
export type DocumentArchiveCandidateV1=Readonly<{schemaVersion:1;labOnly:true;official:false;complete:false;identity:History['identity'];revision:History['revisions'][number];confirmedAt:string;confirmedByTeacher:true;preview:FinalPreview|PlanningPreview;contentDigest:string}>;
type Result={valid:true;record:DocumentArchiveCandidateV1}|{valid:false;issue:'NOT_IMPLEMENTED'|'INVALID_INPUT'|'INVALID_REVIEW'|'STALE_REVIEW'|'INVALID_DECISION'|'DIGEST_FAILED'};
export async function prepareDocumentArchiveCandidate(_raw:unknown):Promise<Result>{
 return {valid:false,issue:'NOT_IMPLEMENTED'};
}
