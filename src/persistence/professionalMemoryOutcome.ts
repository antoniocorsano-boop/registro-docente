import {
  recordProfessionalMemoryEvent,
  type RecordProfessionalMemoryEventInput
} from '../memory/professionalMemory';
import type { ProfessionalMemoryStateV1 } from '../memory/types';

export interface PersistDerivedProfessionalMemoryInput {
  current: ProfessionalMemoryStateV1;
  event: RecordProfessionalMemoryEventInput;
  persist: (candidate: ProfessionalMemoryStateV1) => Promise<void>;
}

export type PersistDerivedProfessionalMemoryResult =
  | { status: 'skipped'; state: ProfessionalMemoryStateV1 }
  | { status: 'persisted'; state: ProfessionalMemoryStateV1 }
  | { status: 'failed'; state: ProfessionalMemoryStateV1; error: string };

export async function persistDerivedProfessionalMemoryAfterCanonicalCommit(
  input: PersistDerivedProfessionalMemoryInput
): Promise<PersistDerivedProfessionalMemoryResult> {
  const candidate = recordProfessionalMemoryEvent(input.current, input.event);
  if (candidate === input.current) {
    return { status: 'skipped', state: input.current };
  }

  try {
    await input.persist(candidate);
    return { status: 'persisted', state: candidate };
  } catch (error) {
    return {
      status: 'failed',
      state: input.current,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
