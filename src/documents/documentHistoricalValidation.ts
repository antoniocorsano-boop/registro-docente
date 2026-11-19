/** DOC-01/D4c2a — fail-closed RED scaffold. Historical validation
 * must not require current sources and does not authorize persistence.
 */
import type {DocumentArchiveCandidateV1} from './documentArchiveCandidate';
type Result={valid:true;record:DocumentArchiveCandidateV1}|{valid:false;issue:'NOT_IMPLEMENTED'|'INVALID_RECORD'|'INVALID_SCOPE'|'INVALID_CONTENT'|'INVALID_DIGEST'};
export async function validateHistoricalDocumentRecord(_record:unknown,_approvedScope:unknown):Promise<Result>{
 return {valid:false,issue:'NOT_IMPLEMENTED'};
}
