import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import {
  buildCopilotContextProjection,
  toRemoteRoutingProjection
} from '../copilot/contextProjection';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import {
  rememberProfessionalItem,
  selectProfessionalMemoryWorkingSet,
  toRemoteProfessionalMemoryProjection
} from '../memory/professionalMemory';
import type { ProfessionalMemoryStateV1 } from '../memory/types';
import { buildLibraryProposalRequest } from '../library/teachingProposal';
import type { LibrarySource } from '../library/types';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';
import type { UdaRecord } from '../types';
import { handleLibraryProposalRequest } from '../server/libraryProposalRoute';
import { createGeminiTeachingProposalProvider } from '../server/geminiTeachingProposalProvider';

const UDA: UdaRecord = {
  id: 'uda-memory-context',
  title: 'Energia e trasformazioni',
  className: '3C',
  hours: 8,
  period: 'Q1',
  startMonth: 1,
  durationMonths: 2,
  lessons: [{
    id: 'lesson-memory-context',
    date: '2026-10-27',
    topic: 'Trasformazioni di energia',
    notes: '',
    hours: 1,
    activityType: 'laboratorio'
  }]
};

const TEACHING_CONTEXT: ResolvedLibraryTeachingContext = {
  udaId: UDA.id,
  className: UDA.className,
  period: UDA.period,
  lessonId: 'lesson-memory-context',
  activityType: 'laboratorio'
};

const SOURCE: LibrarySource = {
  id: 'source-memory-context',
  kind: 'concept',
  title: 'Centrale elettrica',
  capturedAt: '2026-10-27T10:00:00.000Z',
  payload: { text: 'Una centrale elettrica trasforma energia.' },
  status: 'ready',
  privacy: 'teacher-professional',
  links: []
};

function memoryState(count = 6): ProfessionalMemoryStateV1 {
  let state = createEmptyProfessionalMemoryState();
  for (let index = 0; index < count; index += 1) {
    state = rememberProfessionalItem(state, {
      eventId: `event-memory-${index}`,
      entryId: `entry-memory-${index}`,
      category: index % 2 === 0 ? 'format-preference' : 'didactic-pattern',
      summary: `Preferenza professionale sintetica ${index}`,
      occurredAt: `2026-10-27T10:0${index}:00.000Z`,
      context: { className: '3C', udaId: UDA.id },
      privacyClassification: 'TEACHER_PROFESSIONAL'
    });
  }
  return state;
}

function safeRemoteMemory() {
  const workingSet = selectProfessionalMemoryWorkingSet({
    state: memoryState(),
    context: { className: '3C', udaId: UDA.id, lessonId: 'lesson-memory-context' }
  });
  return toRemoteProfessionalMemoryProjection(workingSet);
}

const VALID_PROVIDER_OUTPUT = {
  title: 'Attività energia',
  objective: 'Riconoscere le trasformazioni di energia.',
  teacherSetup: 'Presentare la fonte.',
  studentTask: 'Ricostruire la catena energetica.',
  steps: ['Osserva', 'Ricostruisci'],
  questions: ['Quale energia entra?'],
  adaptationHint: 'Ridurre i passaggi se necessario.'
};

describe('AIC-05 Task 5 safe professional memory context', () => {
  test('keeps remote intent routing projection unchanged and memory-free', () => {
    const local = buildCopilotContextProjection({
      surface: 'lesson',
      className: '3C',
      udaId: UDA.id,
      lessonId: 'lesson-memory-context',
      sourceId: SOURCE.id,
      planningProfileId: 'planning-3c'
    });
    const routing = toRemoteRoutingProjection(local);

    expect(routing).toEqual({
      surface: 'lesson',
      hasCurrentClass: true,
      hasCurrentUda: true,
      hasSelectedSource: true
    });
    expect(Object.keys(routing).sort()).toEqual([
      'hasCurrentClass',
      'hasCurrentUda',
      'hasSelectedSource',
      'surface'
    ]);
    expect(JSON.stringify(routing)).not.toMatch(/memory|summary|provenance|entryId/i);
  });

  test('adds at most five compact memory summaries only to an already-authorized PREPARE request', () => {
    const remoteMemory = safeRemoteMemory();
    expect(remoteMemory.items).toHaveLength(5);

    const request = buildLibraryProposalRequest({
      source: SOURCE,
      teachingContext: TEACHING_CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: true,
      professionalMemory: remoteMemory
    } as any) as any;

    expect(request.professionalMemory).toEqual(remoteMemory);
    expect(request.professionalMemory.items).toHaveLength(5);
    const serialized = JSON.stringify(request.professionalMemory);
    expect(serialized).not.toMatch(/entry-memory|event-memory|provenance|sourceEventIds|canonicalRefs|student/i);
  });

  test('server validates compact memory and forwards only safe summaries to the already-authorized provider', async () => {
    const remoteMemory = safeRemoteMemory();
    const baseRequest = buildLibraryProposalRequest({
      source: SOURCE,
      teachingContext: TEACHING_CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: true
    });
    let providerInput: any = null;
    const provider = {
      id: 'test-provider',
      model: 'test-model',
      async generate(input: unknown) {
        providerInput = input;
        return VALID_PROVIDER_OUTPUT;
      }
    };

    const result = await handleLibraryProposalRequest({
      ...baseRequest,
      professionalMemory: remoteMemory
    }, provider, () => '2026-10-27T10:20:00.000Z');

    expect(result.status).toBe(200);
    expect(providerInput.professionalMemory).toEqual(remoteMemory);
    expect(JSON.stringify(providerInput.professionalMemory)).not.toMatch(/entryId|provenance|sourceEventIds|canonicalRefs/i);

    const invalid = await handleLibraryProposalRequest({
      ...baseRequest,
      professionalMemory: {
        ...remoteMemory,
        rawEvents: [{ studentId: 'student-1' }]
      }
    }, provider, () => '2026-10-27T10:20:00.000Z');
    expect(invalid.status).toBe(400);
  });

  test('governed Gemini input uses compact memory as bounded context without leaking local metadata', async () => {
    let capturedRequest: Record<string, unknown> | null = null;
    const provider = createGeminiTeachingProposalProvider({
      apiKey: 'synthetic-key',
      clientFactory: () => ({
        models: {
          async generateContent(request: Record<string, unknown>) {
            capturedRequest = request;
            return {
              text: JSON.stringify(VALID_PROVIDER_OUTPUT),
              usageMetadata: {}
            };
          }
        }
      })
    });

    await provider.generate({
      source: {
        id: SOURCE.id,
        kind: SOURCE.kind,
        title: SOURCE.title,
        text: SOURCE.payload.text
      },
      context: {
        udaId: UDA.id,
        udaTitle: UDA.title,
        className: UDA.className,
        period: String(UDA.period),
        lessonId: 'lesson-memory-context',
        lessonTopic: 'Trasformazioni di energia',
        activityType: 'laboratorio'
      },
      professionalMemory: safeRemoteMemory()
    } as any, {
      requestId: 'req-memory',
      signal: new AbortController().signal,
      maxOutputTokens: 512
    });

    const serialized = JSON.stringify(capturedRequest);
    expect(serialized).toContain('Preferenza professionale sintetica');
    expect(serialized).not.toMatch(/entry-memory|event-memory|provenance|sourceEventIds|canonicalRefs/i);
  });

  test('wires committed local memory through the single Copilot surface without adding it to intent routing', async () => {
    const root = resolve(import.meta.dir, '..');
    const [app, composer, panel] = await Promise.all([
      Bun.file(resolve(root, 'App.tsx')).text(),
      Bun.file(resolve(root, 'components/LibraryCopilotComposer.tsx')).text(),
      Bun.file(resolve(root, 'components/LibraryProposalPanel.tsx')).text()
    ]);

    expect(app).toContain('professionalMemory={professionalMemory}');
    expect(composer).toContain('professionalMemory: ProfessionalMemoryStateV1');
    expect(composer).toContain('selectProfessionalMemoryWorkingSet');
    expect(composer).toContain('toRemoteProfessionalMemoryProjection');
    expect(composer).toContain('professionalMemory={remoteProfessionalMemory}');
    expect(panel).toContain('professionalMemory: RemoteProfessionalMemoryProjectionV1');
    expect(panel).toContain('professionalMemory');
    expect(composer).not.toContain('buildAgentRoutingRequestFromProjection(message.trim(), copilotContextProjection, professionalMemory');
  });
});
