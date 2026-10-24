import type { LibraryStateV1 } from './types';

export function createEmptyLibraryState(): LibraryStateV1 {
  return {
    schemaVersion: 1,
    sources: []
  };
}
