export type CanonicalClassResolution =
  | {
      status: 'resolved';
      semanticKey: string;
      classId: string;
      label: string;
      aliases: string[];
    }
  | {
      status: 'ambiguous';
      semanticKey: string;
      candidates: Array<{ classId: string; label: string }>;
    }
  | {
      status: 'unresolved';
      sourceLabel: string;
      semanticKey: string | null;
    };

const COMPACT_OR_SPACED_CLASS = /^([1-3])\s*([a-z])$/i;
const ORDINAL_CLASS = /^([1-3])\s*[ªº°]\s*([a-z])$/i;

export function parseLowerSecondaryClassSemanticKey(label: string): string | null {
  const normalized = label.trim();
  if (!normalized) return null;

  const match = ORDINAL_CLASS.exec(normalized) ?? COMPACT_OR_SPACED_CLASS.exec(normalized);
  if (!match) return null;

  return `${match[1]}:${match[2].toUpperCase()}`;
}

export function resolveCanonicalRegistroClass(
  sourceLabel: string,
  classes: Array<{ id: string; name: string }>
): CanonicalClassResolution {
  const semanticKey = parseLowerSecondaryClassSemanticKey(sourceLabel);
  if (!semanticKey) {
    return { status: 'unresolved', sourceLabel, semanticKey: null };
  }

  const candidatesById = new Map<string, { classId: string; label: string }>();
  for (const candidate of classes) {
    if (parseLowerSecondaryClassSemanticKey(candidate.name) !== semanticKey) continue;
    if (!candidatesById.has(candidate.id)) {
      candidatesById.set(candidate.id, { classId: candidate.id, label: candidate.name });
    }
  }

  const candidates = Array.from(candidatesById.values());
  if (candidates.length === 0) {
    return { status: 'unresolved', sourceLabel, semanticKey };
  }

  if (candidates.length > 1) {
    return { status: 'ambiguous', semanticKey, candidates };
  }

  const [resolved] = candidates;
  const aliases = Array.from(new Set([sourceLabel.trim(), resolved.label].filter(Boolean)));
  return {
    status: 'resolved',
    semanticKey,
    classId: resolved.classId,
    label: resolved.label,
    aliases
  };
}
