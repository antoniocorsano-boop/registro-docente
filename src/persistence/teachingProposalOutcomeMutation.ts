import { addLibrarySource } from '../library/libraryState';
import {
  buildTeachingProposalUdaAdoption,
  type TeachingProposalUdaAdoptionInput,
  type TeachingProposalUdaAdoptionReceipt
} from '../library/teachingProposalOutcome';
import type { LibraryStateV1 } from '../library/types';
import type { UdaRecord } from '../types';
import type { SecureMeta } from '../security/secureAppStorage';
import { incrementBackupChanges } from './backupCheckpoint';

export interface TeachingProposalOutcomeState {
  library: LibraryStateV1;
  udas: UdaRecord[];
  meta: SecureMeta;
}

export interface TeachingProposalOutcomeCandidate extends TeachingProposalOutcomeState {
  receipt: TeachingProposalUdaAdoptionReceipt;
}

export function deriveTeachingProposalOutcomeCandidate(
  current: TeachingProposalOutcomeState,
  input: TeachingProposalUdaAdoptionInput
): TeachingProposalOutcomeCandidate {
  const outcome = buildTeachingProposalUdaAdoption({
    ...input,
    udas: current.udas
  });

  return {
    library: addLibrarySource(current.library, outcome.source),
    udas: outcome.udas,
    meta: incrementBackupChanges(current.meta),
    receipt: outcome.receipt
  };
}
