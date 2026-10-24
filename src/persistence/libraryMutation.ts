import type { LibraryStateV1 } from '../library/types';
import { incrementBackupChanges } from './backupCheckpoint';
import type { SecureMeta } from '../security/secureAppStorage';

export interface LibraryMutationState {
  library: LibraryStateV1;
  meta: SecureMeta;
}

export async function persistLibraryMutation(
  current: LibraryMutationState,
  derive: (library: LibraryStateV1) => LibraryStateV1,
  persist: (library: LibraryStateV1, meta: SecureMeta) => Promise<void>
): Promise<LibraryMutationState> {
  const candidate: LibraryMutationState = {
    library: derive(current.library),
    meta: incrementBackupChanges(current.meta)
  };

  await persist(candidate.library, candidate.meta);
  return candidate;
}
