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

export type TeachingProposalOutcomeMutationInput = Omit<TeachingProposalUdaAdoptionInput, 'udas'> & {
  targetWritableByRegistro?: boolean;
};

export function deriveTeachingProposalOutcomeCandidate(
  current: TeachingProposalOutcomeState,
  input: TeachingProposalOutcomeMutationInput
): TeachingProposalOutcomeCandidate {
  const { targetWritableByRegistro, ...adoptionInput } = input;
  if (targetWritableByRegistro === false) {
    throw new Error('A4_R2_PROJECTED_UDA_READ_ONLY');
  }

  const outcome = buildTeachingProposalUdaAdoption({
    ...adoptionInput,
    udas: current.udas
  });

  return {
    library: addLibrarySource(current.library, outcome.source),
    udas: outcome.udas,
    meta: incrementBackupChanges(current.meta),
    receipt: outcome.receipt
  };
}
