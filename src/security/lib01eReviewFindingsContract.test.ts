import { describe, expect, test } from 'bun:test';
import { handleLibraryProposalRequest } from '../server/libraryProposalRoute';

const BASE_REQUEST = {
  schemaVersion: 1,
  action: 'prepare-activity',
  classification: 'TEACHER_PROFESSIONAL',
  explicitTeacherOptIn: true,
  source: {
    id: 'source-lib01e-review',
    kind: 'file',
    title: 'Appunto testuale',
    mimeType: 'text/plain',
    dataBase64: 'SGVsbG8='
  },
  context: {
    udaId: 'uda-lib01e-review',
    udaTitle: 'Energia e trasformazioni',
    className: '3C',
    period: 'Q1'
  }
} as const;

function runtimeStub() {
  const calls: unknown[] = [];
  return {
    calls,
    runtime: {
      config: {
        provider: 'gemini',
        model: 'gemini-3.8-flash',
        deadlineMs: 45_000,
        maxTextBytes: 4,
        maxInlineBytes: 1024,
        maxOutputTokens: 2_048
      },
      async generate(input: unknown) {
        calls.push(input);
        return {
          output: {
            title: 'Non deve essere generato',
            objective: 'Non deve essere generato',
            teacherSetup: 'Non deve essere generato',
            studentTask: 'Non deve essere generato',
            steps: ['Non deve essere generato'],
            questions: ['Non deve essere generato'],
            adaptationHint: 'Non deve essere generato'
          },
          receipt: {
            requestId: 'should-not-run',
            provider: 'google-gemini',
            model: 'gemini-3.8-flash',
            durationMs: 1,
            attemptCount: 1
          }
        };
      }
    }
  };
}

function errorCode(body: Record<string, unknown>) {
  return (body.error as Record<string, unknown>)?.code;
}

describe('LIB-01E review findings regression contract', () => {
  test('counts decoded text-file bytes and accompanying text against the governed text budget', async () => {
    const scenarios = [
      {
        name: 'base64-only text attachment',
        source: {
          ...BASE_REQUEST.source,
          dataBase64: 'SGVsbG8=' // "Hello" = 5 decoded bytes > maxTextBytes 4.
        }
      },
      {
        name: 'combined extracted text plus text attachment',
        source: {
          ...BASE_REQUEST.source,
          text: 'é', // 2 UTF-8 bytes.
          dataBase64: 'QUJD' // "ABC" = 3 decoded bytes; aggregate = 5 > 4.
        }
      }
    ];

    for (const scenario of scenarios) {
      const { runtime, calls } = runtimeStub();
      const body = {
        ...BASE_REQUEST,
        source: scenario.source
      };

      const result = await handleLibraryProposalRequest(body as any, runtime as any, {
        requestId: `review-${scenario.name}`
      });

      expect(result.status, scenario.name).toBe(413);
      expect(errorCode(result.body), scenario.name).toBe('SOURCE_TOO_LARGE');
      expect(calls, scenario.name).toHaveLength(0);
    }
  });
});
