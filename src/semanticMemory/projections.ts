import type { LibrarySource } from '../library/types';
import type {
  ProfessionalMemoryAllowedClassification,
  ProfessionalMemoryStateV1,
} from '../memory/types';
import {
  type SemanticMemoryProjectionV1,
  validateSemanticMemoryProjection,
} from '../../vendor/contextual-copilot-semantic-memory';

const SOURCE_APP_ID = 'registro-docente';
const LIBRARY_NAMESPACE = 'registro/library';
const PROFESSIONAL_MEMORY_NAMESPACE = 'registro/professional-memory';

const PROFESSIONAL_MEMORY_CLASS_MAP: Readonly<Record<ProfessionalMemoryAllowedClassification, SemanticMemoryProjectionV1['dataClass']>> = Object.freeze({
  TEACHER_PROFESSIONAL: 'TEACHER_PROFESSIONAL',
  CURRICULUM_PLANNING: 'CURRICOLO',
  PUBLIC_EXTERNAL_CONTENT: 'PUBLIC_APP',
  AGGREGATED_NON_IDENTIFIABLE: 'AGGREGATED_NON_IDENTIFIABLE',
});

function nonBlank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function semanticTextForLibrarySource(source: LibrarySource): string {
  const payloadText = typeof source.payload.text === 'string' ? source.payload.text : '';
  return [source.title, source.extractedText, payloadText, source.notes]
    .filter(nonBlank)
    .map(value => value.trim())
    .join(' ');
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(item => stableSerialize(item)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map(key => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
}

async function sha256Hex(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

async function validateWithRevision(
  projectionWithoutRevision: Omit<SemanticMemoryProjectionV1, 'revision'>,
): Promise<SemanticMemoryProjectionV1> {
  const revision = await sha256Hex(projectionWithoutRevision);
  return validateSemanticMemoryProjection({
    ...projectionWithoutRevision,
    revision,
  });
}

function librarySourceIsEligible(source: LibrarySource): boolean {
  return source.privacy === 'teacher-professional'
    && source.status !== 'restricted'
    && source.status !== 'failed';
}

export async function buildLibrarySemanticMemoryProjections(
  sources: readonly LibrarySource[],
): Promise<SemanticMemoryProjectionV1[]> {
  const projections = await Promise.all(sources.map(async source => {
    if (!librarySourceIsEligible(source)) {
      return null;
    }

    const text = semanticTextForLibrarySource(source);
    if (!nonBlank(text)) {
      return null;
    }

    return validateWithRevision({
      schema: 'trama.semantic-memory-projection/v1',
      sourceAppId: SOURCE_APP_ID,
      sourceType: 'library-source',
      sourceId: source.id,
      namespace: LIBRARY_NAMESPACE,
      title: nonBlank(source.title) ? source.title.trim() : undefined,
      text,
      dataClass: 'TEACHER_PROFESSIONAL',
      canonicalRef: `registro://library/source/${source.id}`,
      updatedAt: source.capturedAt,
      metadata: Object.freeze({
        kind: source.kind,
        privacy: source.privacy,
      }),
    });
  }));

  return projections
    .filter((projection): projection is SemanticMemoryProjectionV1 => projection !== null)
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

export async function buildProfessionalMemoryProjections(
  state: ProfessionalMemoryStateV1,
): Promise<SemanticMemoryProjectionV1[]> {
  const projections = await Promise.all(state.entries.map(async entry => {
    if (entry.status !== 'active' || !nonBlank(entry.summary)) {
      return null;
    }

    const dataClass = PROFESSIONAL_MEMORY_CLASS_MAP[entry.privacyClassification];
    if (!dataClass) {
      return null;
    }

    return validateWithRevision({
      schema: 'trama.semantic-memory-projection/v1',
      sourceAppId: SOURCE_APP_ID,
      sourceType: 'professional-memory-entry',
      sourceId: entry.id,
      namespace: PROFESSIONAL_MEMORY_NAMESPACE,
      text: entry.summary.trim(),
      dataClass,
      canonicalRef: `registro://professional-memory/entry/${entry.id}`,
      updatedAt: entry.updatedAt,
      metadata: Object.freeze({
        category: entry.category,
        provenanceKind: entry.provenance.kind,
      }),
    });
  }));

  return projections
    .filter((projection): projection is SemanticMemoryProjectionV1 => projection !== null)
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

export async function buildRegistroSemanticMemorySnapshot(input: {
  librarySources: readonly LibrarySource[];
  professionalMemory: ProfessionalMemoryStateV1;
}): Promise<SemanticMemoryProjectionV1[]> {
  const [library, professionalMemory] = await Promise.all([
    buildLibrarySemanticMemoryProjections(input.librarySources),
    buildProfessionalMemoryProjections(input.professionalMemory),
  ]);

  return [...library, ...professionalMemory].sort((left, right) => {
    const namespaceOrder = left.namespace.localeCompare(right.namespace);
    return namespaceOrder !== 0 ? namespaceOrder : left.sourceId.localeCompare(right.sourceId);
  });
}
