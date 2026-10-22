import type { UdaRecord } from '../types';

type UdaPatch = Partial<UdaRecord> & Pick<UdaRecord, 'id'>;

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function buildPatch(base: UdaRecord, candidate: UdaRecord): UdaPatch {
  const patch: UdaPatch = { id: candidate.id };
  const keys = new Set([
    ...Object.keys(base),
    ...Object.keys(candidate)
  ] as Array<keyof UdaRecord>);

  keys.delete('id');
  for (const key of keys) {
    if (!valuesEqual(base[key], candidate[key])) {
      (patch as Record<string, unknown>)[key as string] = candidate[key];
    }
  }
  return patch;
}

export function createUdaSnapshotMutation(
  base: UdaRecord[],
  candidate: UdaRecord[]
): (current: UdaRecord[]) => UdaRecord[] {
  const baseById = new Map(base.map(item => [item.id, item]));
  const candidateById = new Map(candidate.map(item => [item.id, item]));
  const deletedIds = new Set(
    base.filter(item => !candidateById.has(item.id)).map(item => item.id)
  );
  const patches = candidate
    .filter(item => baseById.has(item.id))
    .map(item => buildPatch(baseById.get(item.id)!, item))
    .filter(patch => Object.keys(patch).length > 1);
  const additions = candidate.filter(item => !baseById.has(item.id));

  return current => {
    const patchesById = new Map(patches.map(patch => [patch.id, patch]));
    const rebased = current
      .filter(item => !deletedIds.has(item.id))
      .map(item => {
        const patch = patchesById.get(item.id);
        return patch ? { ...item, ...patch } : item;
      });
    const currentIds = new Set(rebased.map(item => item.id));
    for (const addition of additions) {
      if (!currentIds.has(addition.id)) {
        rebased.push(addition);
        currentIds.add(addition.id);
      }
    }
    return rebased;
  };
}
