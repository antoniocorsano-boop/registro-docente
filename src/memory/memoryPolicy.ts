import type { ProfessionalMemoryCandidateClassification } from './types';

export interface MemoryCandidatePolicyInput {
  classification: ProfessionalMemoryCandidateClassification;
}

export type MemoryCandidatePolicyDecision =
  | { decision: 'ALLOW' }
  | { decision: 'DENY_STUDENT_PERSONAL' }
  | { decision: 'DENY_AMBIGUOUS' };

export function canPersistProfessionalMemoryCandidate(
  input: MemoryCandidatePolicyInput
): MemoryCandidatePolicyDecision {
  if (input.classification === 'STUDENT_PERSONAL') {
    return { decision: 'DENY_STUDENT_PERSONAL' };
  }
  if (input.classification === 'AMBIGUOUS') {
    return { decision: 'DENY_AMBIGUOUS' };
  }
  return { decision: 'ALLOW' };
}
