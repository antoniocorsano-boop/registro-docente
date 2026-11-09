import {
  isAssessmentGenerationRequestCurrent,
  type AssessmentGenerationSessionV1
} from '../library/assessmentGeneration';
import { parseAssessmentDraftV1, type AssessmentDraftV1 } from '../library/assessmentDraft';
import type { LibrarySource } from '../library/types';

export type AssessmentGenerationErrorCode =
  | 'REQUEST_INVALID'
  | 'REMOTE_POLICY_DENIED'
  | 'AI_BUDGET_ESCALATION_REQUIRED'
  | 'REQUEST_CONFLICT'
  | 'PROVIDER_NOT_CONFIGURED'
  | 'PROVIDER_RATE_LIMITED'
  | 'PROVIDER_TIMEOUT'
  | 'PROVIDER_BLOCKED'
  | 'PROVIDER_UNAVAILABLE'
  | 'PROVIDER_OUTPUT_INVALID'
  | 'PROVIDER_ERROR'
  | 'CONTEXT_CHANGED';

export class AssessmentGenerationError extends Error {
  constructor(
    public readonly code: AssessmentGenerationErrorCode,
    public readonly status: number
  ) {
    super(code === 'CONTEXT_CHANGED'
      ? 'La fonte o la classe sono cambiate: la proposta va richiesta nuovamente.'
      : 'La generazione della bozza di verifica non è stata completata.');
    this.name='AssessmentGenerationError';
  }
}

export interface AssessmentGenerationReceipt {
  requestId: string;
  provider: string;
  model: string;
  attemptCount: 1;
  budget: { tier: 'remote-low'|'remote-expanded'; profile:'economy'|'balanced'|'quality'; escalated:boolean };
  promptTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value==='object' && !Array.isArray(value);
}
function text(value:unknown): string | null {
  return typeof value==='string' && value.trim() ? value.trim() : null;
}
function parseReceipt(raw:unknown):AssessmentGenerationReceipt {
  if(!isRecord(raw)||!isRecord(raw.budget)) throw new AssessmentGenerationError('PROVIDER_OUTPUT_INVALID',502);
  const budget=raw.budget;
  if(!text(raw.requestId)||!text(raw.provider)||!text(raw.model)||raw.attemptCount!==1
    ||(budget.tier!=='remote-low'&&budget.tier!=='remote-expanded')
    ||(budget.profile!=='economy'&&budget.profile!=='balanced'&&budget.profile!=='quality')
    ||typeof budget.escalated!=='boolean') throw new AssessmentGenerationError('PROVIDER_OUTPUT_INVALID',502);
  const result:AssessmentGenerationReceipt={
    requestId:text(raw.requestId)!,provider:text(raw.provider)!,model:text(raw.model)!,
    attemptCount:1,
    budget:{tier:budget.tier,profile:budget.profile,escalated:budget.escalated}
  };
  for(const key of ['promptTokens','outputTokens','totalTokens'] as const){
    const value=raw[key];
    if(typeof value==='number'&&Number.isFinite(value)&&value>=0) result[key]=value;
  }
  return result;
}
function errorFromHttp(payload:unknown,status:number):AssessmentGenerationError {
  const code=isRecord(payload)&&isRecord(payload.error)?payload.error.code:null;
  const codes = new Set<AssessmentGenerationErrorCode>([
    'REQUEST_INVALID','REMOTE_POLICY_DENIED','AI_BUDGET_ESCALATION_REQUIRED',
    'REQUEST_CONFLICT','PROVIDER_NOT_CONFIGURED','PROVIDER_RATE_LIMITED','PROVIDER_TIMEOUT',
    'PROVIDER_BLOCKED','PROVIDER_UNAVAILABLE','PROVIDER_OUTPUT_INVALID','PROVIDER_ERROR'
  ]);
  return new AssessmentGenerationError(typeof code==='string'&&codes.has(code as AssessmentGenerationErrorCode)
    ? code as AssessmentGenerationErrorCode : 'PROVIDER_ERROR',status);
}

export async function requestAssessmentDraftFromCopilot(input: {
  session:AssessmentGenerationSessionV1;
  getLiveContext:() => {source:LibrarySource|null;confirmedSourceId:string;activeClassName:string};
  signal?:AbortSignal;
}):Promise<{draft:AssessmentDraftV1;receipt:AssessmentGenerationReceipt}> {
  // Capture an immutable comparison reference before the first await. Source
  // identity is retained locally, never included in the HTTP request.
  const session:AssessmentGenerationSessionV1={
    request:JSON.parse(JSON.stringify(input.session.request)),
    authorizedSourceId:input.session.authorizedSourceId,
    authorizedClassName:input.session.authorizedClassName
  };
  const current = () => isAssessmentGenerationRequestCurrent(session,input.getLiveContext());
  if(!current()) throw new AssessmentGenerationError('CONTEXT_CHANGED',409);

  // One POST, no silent retry; an untrusted provider response has no commit authority.
  const response=await fetch('/api/copilot/assessment-draft',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(session.request),
    signal:input.signal
  });
  let payload:unknown;
  try{
    payload=await response.json();
  }catch{
    throw new AssessmentGenerationError('PROVIDER_ERROR',response.status);
  }
  if(!response.ok) throw errorFromHttp(payload,response.status);
  if(!isRecord(payload)) throw new AssessmentGenerationError('PROVIDER_OUTPUT_INVALID',502);
  let draft:AssessmentDraftV1;
  try{
    draft=parseAssessmentDraftV1(payload.draft);
  }catch{
    throw new AssessmentGenerationError('PROVIDER_OUTPUT_INVALID',502);
  }
  const receipt=parseReceipt(payload.receipt);
  if(!current()||input.signal?.aborted) throw new AssessmentGenerationError('CONTEXT_CHANGED',409);
  return {draft,receipt};
}
