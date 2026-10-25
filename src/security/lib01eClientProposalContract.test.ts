import { afterEach, describe, expect, test } from 'bun:test';

const REQUEST = {
  schemaVersion: 1,
  action: 'prepare-activity',
  classification: 'TEACHER_PROFESSIONAL',
  explicitTeacherOptIn: true,
  source: {
    id: 'source-lib01e-client',
    kind: 'note',
    title: 'Energia',
    text: 'Una centrale trasforma energia primaria in energia elettrica.'
  },
  context: {
    udaId: 'uda-lib01e-client',
    udaTitle: 'Energia',
    className: '3C',
    period: 'Q1'
  }
} as const;

const PROPOSAL = {
  schemaVersion: 1,
  kind: 'activity',
  title: 'Catena energetica',
  objective: 'Riconoscere le trasformazioni di energia.',
  teacherSetup: 'Predisporre la fonte.',
  studentTask: 'Ricostruire la catena energetica.',
  steps: ['Osserva', 'Ricostruisci'],
  questions: ['Quale energia entra?'],
  adaptationHint: 'Usare una tabella guida.',
  sourceId: 'source-lib01e-client',
  context: { udaId: 'uda-lib01e-client' },
  provenance: {
    mode: 'remote',
    provider: 'google-gemini',
    model: 'gemini-3.8-flash',
    generatedAt: '2026-10-25T08:30:00.000Z'
  }
};

const RECEIPT = {
  requestId: 'request-lib01e-client',
  provider: 'google-gemini',
  model: 'gemini-3.8-flash',
  durationMs: 125,
  promptTokens: 200,
  outputTokens: 100,
  totalTokens: 300,
  attemptCount: 1
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

describe('LIB-01E typed client proposal contract', () => {
  test('materializes stable client error parsing and readable Italian copy', async () => {
    const errors = await import('../services/libraryProposalErrors');
    expect(typeof errors.parseLibraryProposalServiceError).toBe('function');
    expect(typeof errors.libraryProposalErrorMessage).toBe('function');

    const parsed = errors.parseLibraryProposalServiceError({
      error: {
        code: 'PROVIDER_RATE_LIMITED',
        message: 'raw server wording must not become the UI contract',
        retriable: true,
        requestId: 'request-support-only',
        vendorPayload: 'must be ignored'
      }
    }, 429);

    expect(parsed).toMatchObject({
      code: 'PROVIDER_RATE_LIMITED',
      retriable: true,
      requestId: 'request-support-only'
    });
    expect(errors.libraryProposalErrorMessage(parsed.code)).toContain('limite');
    expect(errors.libraryProposalErrorMessage(parsed.code)).not.toContain('raw server wording');
    expect(JSON.stringify(parsed)).not.toContain('vendorPayload');
  });

  test('performs exactly one POST and returns proposal plus metadata-only receipt on success', async () => {
    let calls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      expect(String(input)).toBe('/api/copilot/library-proposal');
      expect(init?.method).toBe('POST');
      return jsonResponse({ proposal: PROPOSAL, receipt: RECEIPT });
    }) as typeof fetch;

    const service = await import('../services/libraryProposalService');
    const result = await service.requestLibraryTeachingProposal(REQUEST as any);

    expect(calls).toBe(1);
    expect(result.proposal).toEqual(PROPOSAL);
    expect(result.receipt).toEqual(RECEIPT);
  });

  test('throws a typed stable error after one failed POST without automatic retry', async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse({
        error: {
          code: 'PROVIDER_TIMEOUT',
          message: 'vendor/private diagnostic',
          retriable: true,
          requestId: 'request-timeout'
        }
      }, 504);
    }) as typeof fetch;

    const service = await import('../services/libraryProposalService');
    let caught: any;
    try {
      await service.requestLibraryTeachingProposal(REQUEST as any);
    } catch (reason) {
      caught = reason;
    }

    expect(calls).toBe(1);
    expect(caught?.name).toBe('LibraryProposalServiceError');
    expect(caught?.code).toBe('PROVIDER_TIMEOUT');
    expect(caught?.retriable).toBe(true);
    expect(caught?.requestId).toBe('request-timeout');
    expect(caught?.message).not.toContain('vendor/private diagnostic');
  });

  test('loads provider disclosure metadata through a separate GET without secrets', async () => {
    let calls = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls += 1;
      expect(String(input)).toBe('/api/copilot/library-proposal/provider');
      expect(init?.method).toBeUndefined();
      return jsonResponse({
        available: true,
        provider: 'Google Gemini',
        model: 'gemini-3.8-flash',
        apiKey: 'must-be-ignored',
        billing: 'must-be-ignored'
      });
    }) as typeof fetch;

    const service = await import('../services/libraryProposalService');
    const metadata = await service.getLibraryProposalProviderMetadata();
    expect(calls).toBe(1);
    expect(metadata).toEqual({
      available: true,
      provider: 'Google Gemini',
      model: 'gemini-3.8-flash'
    });
    expect(JSON.stringify(metadata)).not.toContain('apiKey');
    expect(JSON.stringify(metadata)).not.toContain('billing');
  });

  test('requires provider disclosure copy in the panel without making data-use promises', async () => {
    const { readFile } = await import('node:fs/promises');
    const path = await import('node:path');
    const panel = await readFile(path.resolve(import.meta.dir, '../components/LibraryProposalPanel.tsx'), 'utf8');

    expect(panel).toContain('getLibraryProposalProviderMetadata');
    expect(panel).toContain('servizio remoto configurato');
    expect(panel).toContain('Non includere dati personali degli studenti');
    expect(panel.toLowerCase()).not.toContain('non viene usato per addestrare');
    expect(panel.toLowerCase()).not.toContain('non viene usato per migliorare');
  });
});