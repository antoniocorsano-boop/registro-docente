import { describe, expect, test } from 'bun:test';

const VALID_REQUEST = {
  schemaVersion: 1,
  action: 'prepare-activity',
  classification: 'TEACHER_PROFESSIONAL',
  explicitTeacherOptIn: true,
  source: {
    id: 'source-lib01d-route',
    kind: 'note',
    title: 'Energia da una fonte professionale',
    text: 'Una centrale elettrica trasforma energia primaria in energia elettrica.'
  },
  context: {
    udaId: 'uda-lib01d-route',
    udaTitle: 'Energia e trasformazioni',
    className: '3C',
    period: 'Q1',
    lessonId: 'lesson-lib01d-route',
    lessonTopic: 'Trasformazioni di energia',
    activityType: 'laboratorio'
  }
};

const VALID_CONTENT = {
  title: 'Dalla fonte alla catena energetica',
  objective: 'Riconoscere e rappresentare le trasformazioni di energia.',
  teacherSetup: 'Presentare la fonte e richiamare il lessico essenziale.',
  studentTask: 'Ricostruire la catena delle trasformazioni e motivare ogni passaggio.',
  steps: ['Osserva', 'Ricostruisci', 'Confronta'],
  questions: ['Quale energia entra?', 'Quale energia esce?'],
  adaptationHint: 'Fornire una tabella guida con ingresso, trasformazione e uscita.'
};

type Provider = {
  id: string;
  model: string;
  generate(input: unknown): Promise<unknown>;
};

type RouteModule = {
  handleLibraryProposalRequest: (
    body: unknown,
    provider: Provider,
    now?: () => string
  ) => Promise<{ status: number; body: Record<string, unknown> }>;
};

async function loadRouteModule(): Promise<{ module: RouteModule | null; error: unknown }> {
  try {
    const module = await import('../server/libraryProposalRoute');
    return { module: module as RouteModule, error: null };
  } catch (error) {
    return { module: null, error };
  }
}

function fakeProvider(output: unknown = VALID_CONTENT) {
  const calls: unknown[] = [];
  const provider: Provider = {
    id: 'fake-provider',
    model: 'fake-model-v1',
    async generate(input) {
      calls.push(input);
      return output;
    }
  };
  return { provider, calls };
}

describe('LIB-01D governed proposal route contract', () => {
  test('materializes a pure server handler before wiring Express or Gemini', async () => {
    const loaded = await loadRouteModule();
    expect(loaded.error).toBeNull();
    expect(typeof loaded.module?.handleLibraryProposalRequest).toBe('function');
  });

  test('denies missing opt-in and non-professional classification before provider execution', async () => {
    const loaded = await loadRouteModule();
    if (!loaded.module) return;

    for (const body of [
      { ...VALID_REQUEST, explicitTeacherOptIn: false },
      { ...VALID_REQUEST, classification: 'STUDENT_PERSONAL' },
      { ...VALID_REQUEST, classification: 'PUBLIC_APP' }
    ]) {
      const { provider, calls } = fakeProvider();
      const result = await loaded.module.handleLibraryProposalRequest(body, provider);
      expect(result.status).toBe(403);
      expect(calls).toHaveLength(0);
    }
  });

  test('rejects payload creep and unsupported source media before provider execution', async () => {
    const loaded = await loadRouteModule();
    if (!loaded.module) return;

    const malicious = {
      ...VALID_REQUEST,
      studentId: 'student-secret',
      source: { ...VALID_REQUEST.source, grade: 9 }
    };
    const unsupported = {
      ...VALID_REQUEST,
      source: {
        id: VALID_REQUEST.source.id,
        kind: 'file',
        title: VALID_REQUEST.source.title,
        mimeType: 'application/zip',
        dataBase64: 'AAAA'
      }
    };

    for (const body of [malicious, unsupported]) {
      const { provider, calls } = fakeProvider();
      const result = await loaded.module.handleLibraryProposalRequest(body, provider);
      expect(result.status).toBe(400);
      expect(calls).toHaveLength(0);
    }
  });

  test('calls the provider exactly once with policy metadata stripped from provider input', async () => {
    const loaded = await loadRouteModule();
    if (!loaded.module) return;

    const { provider, calls } = fakeProvider();
    const result = await loaded.module.handleLibraryProposalRequest(
      VALID_REQUEST,
      provider,
      () => '2026-10-25T05:40:00.000Z'
    );

    expect(result.status).toBe(200);
    expect(calls).toHaveLength(1);
    const serializedProviderInput = JSON.stringify(calls[0]);
    expect(serializedProviderInput).not.toContain('explicitTeacherOptIn');
    expect(serializedProviderInput).not.toContain('TEACHER_PROFESSIONAL');
    expect(serializedProviderInput).not.toContain('studentId');
    expect(serializedProviderInput).not.toContain('grade');
  });

  test('fails closed on malformed provider output instead of returning a partial proposal', async () => {
    const loaded = await loadRouteModule();
    if (!loaded.module) return;

    const { provider, calls } = fakeProvider({ title: 'Solo titolo' });
    const result = await loaded.module.handleLibraryProposalRequest(VALID_REQUEST, provider);
    expect(calls).toHaveLength(1);
    expect(result.status).toBe(502);
    expect(result.body).not.toHaveProperty('proposal');
  });

  test('adds server-side provenance and binds the proposal to validated source and context', async () => {
    const loaded = await loadRouteModule();
    if (!loaded.module) return;

    const { provider } = fakeProvider();
    const result = await loaded.module.handleLibraryProposalRequest(
      VALID_REQUEST,
      provider,
      () => '2026-10-25T05:40:00.000Z'
    );

    expect(result).toEqual({
      status: 200,
      body: {
        proposal: {
          schemaVersion: 1,
          kind: 'activity',
          ...VALID_CONTENT,
          sourceId: 'source-lib01d-route',
          context: {
            udaId: 'uda-lib01d-route',
            lessonId: 'lesson-lib01d-route'
          },
          provenance: {
            mode: 'remote',
            provider: 'fake-provider',
            model: 'fake-model-v1',
            generatedAt: '2026-10-25T05:40:00.000Z'
          }
        }
      }
    });
  });
});
