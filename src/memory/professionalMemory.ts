import { canPersistProfessionalMemoryCandidate } from './memoryPolicy';
import type {
  ProfessionalMemoryAllowedClassification,
  ProfessionalMemoryCandidateClassification,
  ProfessionalMemoryCategory,
  ProfessionalMemoryContextRefsV1,
  ProfessionalMemoryEntryV1,
  ProfessionalMemoryEventKind,
  ProfessionalMemoryEventV1,
  ProfessionalMemoryStateV1,
  ProfessionalMemoryWorkingSetV1,
  RemoteProfessionalMemoryProjectionV1
} from './types';

export interface RecordProfessionalMemoryEventInput {
  id: string;
  kind: Exclude<ProfessionalMemoryEventKind, 'remember-explicit'>;
  category: ProfessionalMemoryCategory;
  occurredAt: string;
  descriptor: string;
  context: ProfessionalMemoryContextRefsV1;
  canonicalRef?: string;
  privacyClassification: ProfessionalMemoryCandidateClassification;
}

export interface RememberProfessionalItemInput {
  eventId: string;
  entryId: string;
  category: ProfessionalMemoryCategory;
  summary: string;
  occurredAt: string;
  context: ProfessionalMemoryContextRefsV1;
  canonicalRef?: string;
  privacyClassification: ProfessionalMemoryCandidateClassification;
}

export interface CorrectProfessionalMemoryEntryInput {
  entryId: string;
  summary: string;
  correctedAt: string;
}

export interface SelectProfessionalMemoryWorkingSetInput {
  state: ProfessionalMemoryStateV1;
  context: ProfessionalMemoryContextRefsV1;
  activeCanonicalRefs?: readonly string[];
}

function requireAllowedClassification(
  classification: ProfessionalMemoryCandidateClassification
): ProfessionalMemoryAllowedClassification {
  if (classification === 'STUDENT_PERSONAL') {
    throw new Error('Memoria professionale rifiutata: dato personale studente non memorizzabile.');
  }
  if (classification === 'AMBIGUOUS') {
    throw new Error('Memoria professionale rifiutata: classificazione privacy ambigua.');
  }
  return classification;
}

function optionalCanonicalRefs(canonicalRef?: string): string[] {
  return canonicalRef?.trim() ? [canonicalRef.trim()] : [];
}

function sameContext(
  left: ProfessionalMemoryContextRefsV1,
  right: ProfessionalMemoryContextRefsV1
): boolean {
  return left.className === right.className
    && left.udaId === right.udaId
    && left.lessonId === right.lessonId
    && left.sourceId === right.sourceId
    && left.planningProfileId === right.planningProfileId
    && left.assessmentId === right.assessmentId;
}

function appendUnique(values: readonly string[], value: string): string[] {
  return values.includes(value) ? [...values] : [...values, value];
}

function automaticEntryId(input: RecordProfessionalMemoryEventInput): string {
  return `memory-auto-${input.id}`;
}

export function setAutoRememberCategory(
  state: ProfessionalMemoryStateV1,
  category: ProfessionalMemoryCategory,
  enabled: boolean
): ProfessionalMemoryStateV1 {
  if (state.settings.autoRemember[category] === enabled) return state;
  return {
    ...state,
    settings: {
      ...state.settings,
      autoRemember: {
        ...state.settings.autoRemember,
        [category]: enabled
      }
    }
  };
}

export function removeProfessionalMemoryCategory(
  state: ProfessionalMemoryStateV1,
  category: ProfessionalMemoryCategory
): ProfessionalMemoryStateV1 {
  return {
    ...state,
    events: state.events.filter(event => event.category !== category),
    entries: state.entries.filter(entry => entry.category !== category),
    settings: {
      ...state.settings,
      autoRemember: {
        ...state.settings.autoRemember,
        [category]: false
      }
    }
  };
}

export function recordProfessionalMemoryEvent(
  state: ProfessionalMemoryStateV1,
  input: RecordProfessionalMemoryEventInput
): ProfessionalMemoryStateV1 {
  if (!state.settings.autoRemember[input.category]) return state;
  if (canPersistProfessionalMemoryCandidate({ classification: input.privacyClassification }).decision !== 'ALLOW') {
    return state;
  }
  if (state.events.some(event => event.id === input.id)) return state;

  const privacyClassification = input.privacyClassification as ProfessionalMemoryAllowedClassification;
  const canonicalRefs = optionalCanonicalRefs(input.canonicalRef);
  const event: ProfessionalMemoryEventV1 = {
    id: input.id,
    kind: input.kind,
    category: input.category,
    occurredAt: input.occurredAt,
    descriptor: input.descriptor,
    context: { ...input.context },
    provenance: {
      kind: 'product-event',
      ...(canonicalRefs[0] ? { canonicalRef: canonicalRefs[0] } : {})
    },
    privacyClassification
  };

  const reusableIndex = state.entries.findIndex(entry => (
    entry.status === 'active'
    && entry.category === input.category
    && entry.provenance.kind === 'consolidated-inference'
    && sameContext(entry.context, input.context)
    && entry.canonicalRefs.length === canonicalRefs.length
    && entry.canonicalRefs.every((ref, index) => ref === canonicalRefs[index])
  ));

  const entries = [...state.entries];
  if (reusableIndex >= 0) {
    const current = entries[reusableIndex]!;
    entries[reusableIndex] = {
      ...current,
      summary: input.descriptor,
      sourceEventIds: appendUnique(current.sourceEventIds, input.id),
      updatedAt: input.occurredAt
    };
  } else {
    const entry: ProfessionalMemoryEntryV1 = {
      id: automaticEntryId(input),
      category: input.category,
      summary: input.descriptor,
      provenance: {
        kind: 'consolidated-inference',
        ...(canonicalRefs[0] ? { canonicalRef: canonicalRefs[0] } : {})
      },
      sourceEventIds: [input.id],
      canonicalRefs,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt,
      status: 'active',
      context: { ...input.context },
      privacyClassification
    };
    entries.push(entry);
  }

  return {
    ...state,
    events: [...state.events, event],
    entries
  };
}

export function rememberProfessionalItem(
  state: ProfessionalMemoryStateV1,
  input: RememberProfessionalItemInput
): ProfessionalMemoryStateV1 {
  const privacyClassification = requireAllowedClassification(input.privacyClassification);
  if (state.events.some(event => event.id === input.eventId)) {
    throw new Error(`Evento memoria già esistente: ${input.eventId}.`);
  }
  if (state.entries.some(entry => entry.id === input.entryId)) {
    throw new Error(`Voce memoria già esistente: ${input.entryId}.`);
  }

  const canonicalRefs = optionalCanonicalRefs(input.canonicalRef);
  const provenance = {
    kind: 'teacher-explicit' as const,
    ...(canonicalRefs[0] ? { canonicalRef: canonicalRefs[0] } : {})
  };
  const event: ProfessionalMemoryEventV1 = {
    id: input.eventId,
    kind: 'remember-explicit',
    category: input.category,
    occurredAt: input.occurredAt,
    descriptor: input.summary,
    context: { ...input.context },
    provenance,
    privacyClassification
  };
  const entry: ProfessionalMemoryEntryV1 = {
    id: input.entryId,
    category: input.category,
    summary: input.summary,
    provenance,
    sourceEventIds: [input.eventId],
    canonicalRefs,
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
    status: 'active',
    context: { ...input.context },
    privacyClassification
  };

  return {
    ...state,
    events: [...state.events, event],
    entries: [...state.entries, entry]
  };
}

export function correctProfessionalMemoryEntry(
  state: ProfessionalMemoryStateV1,
  input: CorrectProfessionalMemoryEntryInput
): ProfessionalMemoryStateV1 {
  const index = state.entries.findIndex(entry => entry.id === input.entryId);
  if (index < 0) throw new Error(`Voce memoria non trovata: ${input.entryId}.`);
  const entries = [...state.entries];
  entries[index] = {
    ...entries[index]!,
    summary: input.summary,
    updatedAt: input.correctedAt,
    correctedByTeacherAt: input.correctedAt
  };
  return { ...state, entries };
}

export function removeProfessionalMemoryEntry(
  state: ProfessionalMemoryStateV1,
  entryId: string
): ProfessionalMemoryStateV1 {
  const entries = state.entries.filter(entry => entry.id !== entryId);
  return entries.length === state.entries.length ? state : { ...state, entries };
}

function contextMatchScore(
  entry: ProfessionalMemoryEntryV1,
  context: ProfessionalMemoryContextRefsV1
): number {
  let score = 0;
  if (context.lessonId && entry.context.lessonId === context.lessonId) score += 80;
  if (context.udaId && entry.context.udaId === context.udaId) score += 60;
  if (context.sourceId && entry.context.sourceId === context.sourceId) score += 50;
  if (context.planningProfileId && entry.context.planningProfileId === context.planningProfileId) score += 40;
  if (context.assessmentId && entry.context.assessmentId === context.assessmentId) score += 40;
  if (context.className && entry.context.className === context.className) score += 20;
  return score;
}

export function selectProfessionalMemoryWorkingSet(
  input: SelectProfessionalMemoryWorkingSetInput
): ProfessionalMemoryWorkingSetV1 {
  const activeRefs = input.activeCanonicalRefs ? new Set(input.activeCanonicalRefs) : null;
  const candidates = input.state.entries.filter(entry => {
    if (entry.status !== 'active') return false;
    if (activeRefs && entry.canonicalRefs.length > 0 && !entry.canonicalRefs.some(ref => activeRefs.has(ref))) {
      return false;
    }
    return true;
  });

  const ranked = candidates.map(entry => ({
    entry,
    score: (entry.provenance.kind === 'teacher-explicit' ? 100 : 0)
      + contextMatchScore(entry, input.context)
      + (entry.correctedByTeacherAt ? 10 : 0)
  })).sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const updatedOrder = right.entry.updatedAt.localeCompare(left.entry.updatedAt);
    if (updatedOrder !== 0) return updatedOrder;
    return left.entry.id.localeCompare(right.entry.id);
  });

  return {
    schema: 'registro.professional-memory-working-set/v1',
    items: ranked.slice(0, 5).map(({ entry }) => ({
      entryId: entry.id,
      category: entry.category,
      summary: entry.summary,
      context: { ...entry.context },
      provenanceKind: entry.provenance.kind,
      updatedAt: entry.updatedAt
    }))
  };
}

export function toRemoteProfessionalMemoryProjection(
  workingSet: ProfessionalMemoryWorkingSetV1
): RemoteProfessionalMemoryProjectionV1 {
  return {
    schema: 'registro.professional-memory-remote/v1',
    items: workingSet.items.slice(0, 5).map(item => ({
      category: item.category,
      summary: item.summary
    }))
  };
}
