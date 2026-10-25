import type { UdaActivityType, UdaRecord } from '../types';
import type { LibrarySource, LibrarySourceKind } from './types';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

export interface LibraryProposalRequestV1 {
  schemaVersion: 1;
  action: 'prepare-activity';
  classification: 'TEACHER_PROFESSIONAL';
  explicitTeacherOptIn: true;
  source: {
    id: string;
    kind: LibrarySourceKind;
    title: string;
    text?: string;
    mimeType?: string;
    dataBase64?: string;
  };
  context: {
    udaId: string;
    udaTitle: string;
    className: string;
    period: string;
    lessonId?: string;
    lessonTopic?: string;
    activityType?: UdaActivityType;
  };
}

export interface TeachingProposalContent {
  title: string;
  objective: string;
  teacherSetup: string;
  studentTask: string;
  steps: string[];
  questions: string[];
  adaptationHint: string;
}

export interface TeachingProposalV1 extends TeachingProposalContent {
  schemaVersion: 1;
  kind: 'activity';
  sourceId: string;
  context: {
    udaId: string;
    lessonId?: string;
  };
  provenance: {
    mode: 'remote';
    provider: string;
    model: string;
    generatedAt: string;
  };
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function requireString(value: unknown): string {
  if (!nonEmptyString(value)) throw new Error('Proposta didattica non valida.');
  return value.trim();
}

function requireStringArray(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0 || !value.every(nonEmptyString)) {
    throw new Error('Proposta didattica non valida.');
  }
  return value.map(item => item.trim());
}

export function parseTeachingProposalContent(value: unknown): TeachingProposalContent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Proposta didattica non valida.');
  }
  const proposal = value as Record<string, unknown>;
  return {
    title: requireString(proposal.title),
    objective: requireString(proposal.objective),
    teacherSetup: requireString(proposal.teacherSetup),
    studentTask: requireString(proposal.studentTask),
    steps: requireStringArray(proposal.steps),
    questions: requireStringArray(proposal.questions),
    adaptationHint: requireString(proposal.adaptationHint)
  };
}

export function parseTeachingProposalV1(value: unknown): TeachingProposalV1 {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Proposta didattica non valida.');
  }
  const proposal = value as Record<string, unknown>;
  if (proposal.schemaVersion !== 1 || proposal.kind !== 'activity') {
    throw new Error('Proposta didattica non valida.');
  }
  if (!proposal.context || typeof proposal.context !== 'object' || Array.isArray(proposal.context)) {
    throw new Error('Proposta didattica non valida.');
  }
  if (!proposal.provenance || typeof proposal.provenance !== 'object' || Array.isArray(proposal.provenance)) {
    throw new Error('Proposta didattica non valida.');
  }
  const context = proposal.context as Record<string, unknown>;
  const provenance = proposal.provenance as Record<string, unknown>;
  if (provenance.mode !== 'remote') throw new Error('Proposta didattica non valida.');

  return {
    schemaVersion: 1,
    kind: 'activity',
    ...parseTeachingProposalContent(value),
    sourceId: requireString(proposal.sourceId),
    context: {
      udaId: requireString(context.udaId),
      ...(nonEmptyString(context.lessonId) ? { lessonId: context.lessonId.trim() } : {})
    },
    provenance: {
      mode: 'remote',
      provider: requireString(provenance.provider),
      model: requireString(provenance.model),
      generatedAt: requireString(provenance.generatedAt)
    }
  };
}

function decodeDataUrl(dataUrl: string, expectedMimeType?: string): { mimeType: string; dataBase64: string } {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(dataUrl);
  if (!match) throw new Error('Contenuto file non valido.');
  const mimeType = match[1]!.toLowerCase();
  if (expectedMimeType && mimeType !== expectedMimeType.toLowerCase()) {
    throw new Error('Tipo file incoerente.');
  }
  return { mimeType, dataBase64: match[2]!.replace(/\s+/g, '') };
}

function sourceContent(source: LibrarySource): Pick<LibraryProposalRequestV1['source'], 'text' | 'mimeType' | 'dataBase64'> {
  const localText = source.extractedText?.trim() || source.payload.text?.trim();

  if (source.kind === 'web') {
    if (!localText) throw new Error('Contenuto della pagina non disponibile nella fonte.');
    return { text: localText };
  }

  if (source.kind === 'text' || source.kind === 'note' || source.kind === 'concept' || source.kind === 'internal') {
    if (!localText) throw new Error('Contenuto testuale non disponibile nella fonte.');
    return { text: localText };
  }

  if (source.kind === 'image') {
    const mimeType = source.payload.mimeType?.toLowerCase();
    const dataUrl = source.payload.dataUrl;
    if (!mimeType?.startsWith('image/') || !dataUrl) throw new Error('Immagine non disponibile nella fonte.');
    return decodeDataUrl(dataUrl, mimeType);
  }

  if (source.kind === 'file') {
    const mimeType = source.payload.mimeType?.toLowerCase();
    if (!mimeType) throw new Error('Formato file non supportato.');
    if (mimeType.startsWith('text/')) {
      if (localText) return { text: localText, mimeType };
      if (source.payload.dataUrl) return decodeDataUrl(source.payload.dataUrl, mimeType);
      throw new Error('Contenuto file non disponibile nella fonte.');
    }
    if (mimeType !== 'application/pdf') throw new Error('Formato file non supportato.');
    if (!source.payload.dataUrl) throw new Error('Contenuto file non disponibile nella fonte.');
    return decodeDataUrl(source.payload.dataUrl, mimeType);
  }

  throw new Error('Fonte non supportata per la proposta didattica.');
}

export function buildLibraryProposalRequest(input: {
  source: LibrarySource;
  teachingContext: ResolvedLibraryTeachingContext;
  uda: UdaRecord;
  explicitTeacherOptIn: boolean;
}): LibraryProposalRequestV1 {
  const { source, teachingContext, uda, explicitTeacherOptIn } = input;

  if (!explicitTeacherOptIn) throw new Error('Consenso remoto richiesto.');
  if (source.privacy !== 'teacher-professional') {
    throw new Error('Fonte non classificata come materiale professionale del docente.');
  }
  if (teachingContext.udaId !== uda.id || teachingContext.className !== uda.className || teachingContext.period !== uda.period) {
    throw new Error('Contesto didattico non valido.');
  }

  const lesson = teachingContext.lessonId
    ? (uda.lessons ?? []).find(candidate => candidate.id === teachingContext.lessonId)
    : undefined;
  if (teachingContext.lessonId && !lesson) throw new Error('Contesto didattico non valido.');

  const content = sourceContent(source);
  return {
    schemaVersion: 1,
    action: 'prepare-activity',
    classification: 'TEACHER_PROFESSIONAL',
    explicitTeacherOptIn: true,
    source: {
      id: source.id,
      kind: source.kind,
      title: source.title,
      ...content
    },
    context: {
      udaId: uda.id,
      udaTitle: uda.title,
      className: uda.className,
      period: String(uda.period),
      ...(lesson ? { lessonId: lesson.id, lessonTopic: lesson.topic } : {}),
      ...(teachingContext.activityType ? { activityType: teachingContext.activityType } : {})
    }
  };
}

function serializeTeachingProposal(content: TeachingProposalContent): string {
  return [
    content.title,
    '',
    'Obiettivo',
    content.objective,
    '',
    'Preparazione docente',
    content.teacherSetup,
    '',
    'Consegna agli studenti',
    content.studentTask,
    '',
    'Passaggi',
    ...content.steps.map((step, index) => `${index + 1}. ${step}`),
    '',
    'Domande guida',
    ...content.questions.map(question => `- ${question}`),
    '',
    'Adattamento',
    content.adaptationHint
  ].join('\n');
}

export function createInternalSourceFromTeachingProposal(input: {
  id: string;
  proposal: TeachingProposalV1;
  content: TeachingProposalContent;
  capturedAt: string;
}): LibrarySource {
  const content = parseTeachingProposalContent(input.content);
  const proposal = parseTeachingProposalV1(input.proposal);
  const capturedAt = requireString(input.capturedAt);
  const link = proposal.context.lessonId
    ? { targetType: 'lesson' as const, targetId: proposal.context.lessonId }
    : { targetType: 'uda' as const, targetId: proposal.context.udaId };

  return {
    id: requireString(input.id),
    kind: 'internal',
    title: content.title,
    capturedAt,
    origin: 'Proposta didattica adottata dal docente',
    payload: {
      text: serializeTeachingProposal(content)
    },
    status: 'ready',
    privacy: 'teacher-professional',
    links: [link],
    provenance: {
      derivedFromSourceId: proposal.sourceId,
      generation: {
        provider: proposal.provenance.provider,
        model: proposal.provenance.model,
        generatedAt: proposal.provenance.generatedAt,
        kind: 'activity'
      }
    }
  };
}
