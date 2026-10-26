import { describe, expect, test } from 'bun:test';
import type { IntentEnvelopeV1 } from './agentIntent';
import type { LibrarySource } from './types';
import type { ResolvedLibraryTeachingContext } from './teachingContext';

const ROUTING = new URL('./agentIntentRouting.ts', import.meta.url);

const professionalSource: LibrarySource = {
  id: 'agent-intent-source',
  kind: 'note',
  title: 'Centrale elettrica',
  capturedAt: '2026-10-26T10:00:00.000Z',
  origin: 'agent-intent test fixture',
  payload: { text: 'Materiale professionale sintetico.' },
  extractedText: 'Materiale professionale sintetico.',
  status: 'ready',
  privacy: 'teacher-professional',
  links: [],
  notes: ''
};

const studentPersonalSource: LibrarySource = {
  ...professionalSource,
  id: 'agent-intent-student-personal',
  privacy: 'student-personal'
};

const teachingContext: ResolvedLibraryTeachingContext = {
  udaId: 'uda-energia',
  lessonId: 'lesson-centrale',
  className: '3ª A',
  period: 'Q1',
  activityType: 'theory'
};

function envelope(intent: IntentEnvelopeV1['intent'], overrides: Partial<IntentEnvelopeV1> = {}): IntentEnvelopeV1 {
  return {
    schema: 'registro.agent-intent/v1',
    intent,
    goal: 'obiettivo didattico',
    contextTarget: 'current',
    confidence: 'high',
    needsClarification: false,
    ...overrides
  };
}

describe('AGENT-INTENT-01 governed routing', () => {
  test('materializes the routing adapter before agent output can reach product actions', async () => {
    expect(await Bun.file(ROUTING).exists()).toBe(true);
  });

  test('maps REVIEW and LINK only when the shared Core exposes the exact action', async () => {
    if (!await Bun.file(ROUTING).exists()) return;
    const { routeAgentIntent } = await import('./agentIntentRouting');

    const review = await routeAgentIntent({
      envelope: envelope('REVIEW'),
      source: professionalSource,
      teachingContext
    });
    expect(review.kind).toBe('ACTION');
    if (review.kind === 'ACTION') expect(review.action.id).toBe('review-source');

    const link = await routeAgentIntent({
      envelope: envelope('LINK'),
      source: professionalSource,
      teachingContext
    });
    expect(link.kind).toBe('ACTION');
    if (link.kind === 'ACTION') expect(link.action.id).toBe('link-source-to-uda');
  });

  test('routes PREPARE to the existing governed handoff without dispatching it', async () => {
    if (!await Bun.file(ROUTING).exists()) return;
    const { routeAgentIntent } = await import('./agentIntentRouting');
    const result = await routeAgentIntent({
      envelope: envelope('PREPARE', {
        goal: 'far comprendere il funzionamento della centrale elettrica',
        requestedArtifact: 'attività didattica'
      }),
      source: professionalSource,
      teachingContext
    });
    expect(result.kind).toBe('PREPARE');
  });

  test('fails closed on missing teaching context for PREPARE', async () => {
    if (!await Bun.file(ROUTING).exists()) return;
    const { routeAgentIntent } = await import('./agentIntentRouting');
    const result = await routeAgentIntent({
      envelope: envelope('PREPARE'),
      source: professionalSource,
      teachingContext: null
    });
    expect(result.kind).toBe('DENIED');
  });

  test('never promotes CLARIFY, low confidence or future intents into executable actions', async () => {
    if (!await Bun.file(ROUTING).exists()) return;
    const { routeAgentIntent } = await import('./agentIntentRouting');

    const clarify = await routeAgentIntent({
      envelope: envelope('CLARIFY', {
        confidence: 'low',
        needsClarification: true,
        clarificationQuestion: 'Vuoi collegare la fonte oppure preparare una nuova attività?'
      }),
      source: professionalSource,
      teachingContext
    });
    expect(clarify.kind).toBe('CLARIFY');

    const future = await routeAgentIntent({
      envelope: envelope('CREATE_ASSESSMENT'),
      source: professionalSource,
      teachingContext
    });
    expect(future.kind).toBe('UNSUPPORTED');
  });

  test('Core denial wins over a high-confidence agent proposal', async () => {
    if (!await Bun.file(ROUTING).exists()) return;
    const { routeAgentIntent } = await import('./agentIntentRouting');
    const result = await routeAgentIntent({
      envelope: envelope('LINK'),
      source: studentPersonalSource,
      teachingContext
    });
    expect(result.kind).toBe('DENIED');
  });
});
