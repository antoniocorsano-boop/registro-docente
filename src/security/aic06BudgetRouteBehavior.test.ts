import { describe, expect, test } from 'bun:test';
import { buildAiBudgetActivityKey, createAiBudgetAuthorization } from '../copilot/aiBudgetGovernor';
import { handleLibraryProposalRequest } from '../server/libraryProposalRoute';

const OUTPUT = {
  title: 'Sistema energetico',
  objective: 'Riconoscere una trasformazione energetica.',
  teacherSetup: 'Predisporre la fonte.',
  studentTask: 'Ricostruire la trasformazione.',
  steps: ['Osserva', 'Descrivi'],
  questions: ['Quale energia entra?'],
  adaptationHint: 'Usare una tabella guida.'
};

const ACTIVITY_KEY = buildAiBudgetActivityKey('uda-aic06', 'lesson-aic06');

const BASE_REQUEST = {
  schemaVersion: 1,
  action: 'prepare-activity',
  classification: 'TEACHER_PROFESSIONAL',
  explicitTeacherOptIn: true,
  source: {
    id: 'source-aic06',
    kind: 'note',
    title: 'Energia',
    text: 'Una centrale trasforma energia primaria in energia elettrica.'
  },
  context: {
    udaId: 'uda-aic06',
    udaTitle: 'Energia e trasformazioni',
    className: '3C',
    period: 'Q1',
    lessonId: 'lesson-aic06',
    lessonTopic: 'Trasformazioni di energia'
  },
  budget: {
    schemaVersion: 1,
    profile: 'balanced',
    activityKey: ACTIVITY_KEY
  }
} as const;

function runtimeStub() {
  const calls: Array<{ input: unknown; options: any }> = [];
  const runtime = {
    config: {
      provider: 'gemini' as const,
      model: 'gemini-3.8-flash' as const,
      deadlineMs: 45_000,
      maxTextBytes: 262_144,
      maxInlineBytes: 8 * 1024 * 1024,
      maxOutputTokens: 2_048
    },
    async generate(input: unknown, options?: any) {
      calls.push({ input, options });
      return {
        output: OUTPUT,
        receipt: {
          requestId: options?.requestId ?? 'request-aic06',
          provider: 'google-gemini',
          model: 'gemini-3.8-flash',
          durationMs: 10,
          attemptCount: 1 as const
        }
      };
    }
  };
  return { runtime, calls };
}

function errorOf(result: any) {
  return result.body.error as Record<string, unknown>;
}

describe('AIC-06 server-side budget enforcement', () => {
  test('routine professional text reaches the provider once on the low tier', async () => {
    const { runtime, calls } = runtimeStub();
    const result = await handleLibraryProposalRequest(BASE_REQUEST, runtime as any, {
      requestId: 'request-aic06-low',
      now: () => '2026-10-27T18:00:00.000Z'
    } as any);

    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.options.maxOutputTokens).toBe(1024);
    expect((result.body as any).receipt.budget).toEqual({
      tier: 'remote-low',
      profile: 'balanced',
      escalated: false
    });
  });

  test('binary source requires escalation and does not invoke the provider first', async () => {
    const { runtime, calls } = runtimeStub();
    const request = structuredClone(BASE_REQUEST) as any;
    request.source = {
      id: 'source-aic06-image',
      kind: 'image',
      title: 'Schema energetico',
      mimeType: 'image/png',
      dataBase64: 'QUJDRA=='
    };

    const result = await handleLibraryProposalRequest(request, runtime as any, {
      requestId: 'request-aic06-escalation',
      now: () => '2026-10-27T18:00:00.000Z'
    } as any);

    expect(result.status).toBe(409);
    expect(errorOf(result)).toMatchObject({
      code: 'AI_BUDGET_ESCALATION_REQUIRED',
      retriable: false,
      reason: 'BINARY_SOURCE'
    });
    expect(calls).toHaveLength(0);
  });

  test('valid same-activity authorization is recomputed server-side and uses expanded capacity', async () => {
    const { runtime, calls } = runtimeStub();
    const request = structuredClone(BASE_REQUEST) as any;
    request.source = {
      id: 'source-aic06-image',
      kind: 'image',
      title: 'Schema energetico',
      mimeType: 'image/png',
      dataBase64: 'QUJDRA=='
    };
    request.budget.authorization = createAiBudgetAuthorization({
      scope: 'activity',
      activityKey: ACTIVITY_KEY,
      issuedAt: '2026-10-27T18:00:00.000Z'
    });

    const result = await handleLibraryProposalRequest(request, runtime as any, {
      requestId: 'request-aic06-expanded',
      now: () => '2026-10-27T18:10:00.000Z'
    } as any);

    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.options.maxOutputTokens).toBe(2048);
    expect((result.body as any).receipt.budget).toEqual({
      tier: 'remote-expanded',
      profile: 'balanced',
      escalated: true
    });
  });

  test('expired or wrong-activity authorization never upgrades an expensive request', async () => {
    for (const variant of ['expired', 'wrong-activity'] as const) {
      const { runtime, calls } = runtimeStub();
      const request = structuredClone(BASE_REQUEST) as any;
      request.source = {
        id: `source-aic06-${variant}`,
        kind: 'image',
        title: 'Schema energetico',
        mimeType: 'image/png',
        dataBase64: 'QUJDRA=='
      };
      request.budget.authorization = createAiBudgetAuthorization({
        scope: 'activity',
        activityKey: variant === 'wrong-activity' ? buildAiBudgetActivityKey('uda-other') : ACTIVITY_KEY,
        issuedAt: '2026-10-27T17:00:00.000Z'
      });

      const result = await handleLibraryProposalRequest(request, runtime as any, {
        requestId: `request-aic06-${variant}`,
        now: () => '2026-10-27T18:10:00.000Z'
      } as any);

      expect(result.status).toBe(409);
      expect(errorOf(result).code).toBe('AI_BUDGET_ESCALATION_REQUIRED');
      expect(calls).toHaveLength(0);
    }
  });
});
