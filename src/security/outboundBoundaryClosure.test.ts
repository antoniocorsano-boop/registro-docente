import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { openEmbeddingSession, revokeEmbeddingSession } from './embeddingSession';
beforeEach(() => { openEmbeddingSession(); });
afterEach(() => { revokeEmbeddingSession(); });
import { getEmbedding, testEmbeddingConnection } from '../services/embeddingService';
import type { LocalEmbeddingConfig } from '../types';

const SERVER_START_TIMEOUT_MS = 15_000;
const SERVER_REQUEST_TIMEOUT_MS = 5_000;
const SERVER_TEST_TIMEOUT_MS = 30_000;

async function withProductionServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  // Ask the OS for a free port. Require the child's own listening
  // announcement so an unrelated process on that port cannot qualify.
  const reservation = Bun.serve({
    hostname: '127.0.0.1', port: 0,
    fetch: () => new Response(null, { status: 503 })
  });
  const port = reservation.port;
  reservation.stop(true);
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = Bun.spawn(['node', 'server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      TRAMA_BIND_HOST: '127.0.0.1',
      PORT: String(port),
      GEMINI_API_KEY: ''
    },
    stdout: 'pipe',
    stderr: 'ignore'
  });

  let listening = false;
  const marker = `Server avviato su ${baseUrl}`;
  const drain = (async () => {
    const decoder = new TextDecoder();
    const reader = server.stdout.getReader();
    let tail = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        tail += decoder.decode(value, { stream: true });
        const lines = tail.split(/\r?\n/);
        tail = (lines.pop() ?? '').slice(-1024);
        if (lines.some(line => line.trim() === marker)) listening = true;
      }
    } finally {
      reader.releaseLock();
    }
  })().catch(() => { /* readiness remains false unless the marker was seen */ });

  try {
    const deadline = performance.now() + SERVER_START_TIMEOUT_MS;
    while (performance.now() < deadline) {
      if (server.exitCode !== null) throw new Error('SEC3_SERVER_EXITED_BEFORE_READY');
      if (listening) {
        let ready = false;
        try {
          const probe = await fetch(`${baseUrl}/api/embeddings/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
            signal: AbortSignal.timeout(1_000)
          });
          const status = probe.status;
          await probe.body?.cancel();
          ready = status === 400;
        } catch {
          // Only the readiness probe can be retried, never the security test.
          if (server.exitCode !== null) throw new Error('SEC3_SERVER_EXITED_BEFORE_READY');
        }
        if (ready && server.exitCode === null) return await run(baseUrl);
      }
      await Bun.sleep(50);
    }
    throw new Error('SEC3_SERVER_READY_TIMEOUT');
  } finally {
    if (server.exitCode === null) server.kill('SIGKILL');
    await server.exited;
    await drain;
  }
}

describe('SEC-3 outbound boundary closure', () => {
  test('UDA Gemini action declares professional classification and explicit teacher opt-in', async () => {
    const source = await Bun.file('src/components/UdaGanttView.tsx').text();
    const routeIndex = source.indexOf("fetch('/api/gemini/generate-uda-description'");
    expect(routeIndex).toBeGreaterThan(-1);

    const requestSlice = source.slice(routeIndex, routeIndex + 1400);
    expect(requestSlice).toContain("classification: 'TEACHER_PROFESSIONAL'");
    expect(requestSlice).toContain('explicitTeacherOptIn: true');
  });

  test('R1-05-02 UDA route rejects unnecessary class and free narrative fields before provider access', async () => {
    await withProductionServer(async baseUrl => {
      const safe = { title: 'Energia', durationMonths: 2, hours: 12, period: 'Q1', civicEducation: false,
        classification: 'TEACHER_PROFESSIONAL', explicitTeacherOptIn: true };
      for (const extra of [{ className: 'Classe sintetica' }, { competencies: 'Testo sintetico' }, { authenticTask: 'Testo sintetico' }]) {
        const response = await fetch(`${baseUrl}/api/gemini/generate-uda-description`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...safe, ...extra }), signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS)
        });
        expect(response.status).toBe(400);
        await response.body?.cancel();
      }
      const response = await fetch(`${baseUrl}/api/gemini/generate-uda-description`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(safe), signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS)
      });
      // With no real Gemini key, the minimal request reaches the configuration check.
      expect(response.status).toBe(500);
      expect((await response.json()).error).toContain('non è configurata nel server');
    });
  }, SERVER_TEST_TIMEOUT_MS);

  test('UDA Gemini server boundary fails closed when policy metadata is missing', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/gemini/generate-uda-description`, {
        signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Materiali e sostenibilità',
          durationMonths: 2,
          hours: 12,
          className: '2C',
          period: 'Q1'
        })
      });

      expect(response.status).toBe(403);
    });
  }, SERVER_TEST_TIMEOUT_MS);

  test('UDA Gemini server boundary blocks student personal data even with opt-in', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/gemini/generate-uda-description`, {
        signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Profilo individuale studente',
          className: '3C',
          period: 'Q1',
          classification: 'STUDENT_PERSONAL',
          explicitTeacherOptIn: true
        })
      });

      expect(response.status).toBe(403);
    });
  }, SERVER_TEST_TIMEOUT_MS);

  test('R1-05-01 both local proxy routes deny forbidden or absent classifications before provider contact', async () => {
    let calls = 0;
    const captured: unknown[] = [];
    const provider = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      async fetch(request) {
        calls += 1;
        captured.push(await request.json());
        return Response.json({ data: [{ embedding: [0.25, 0.75] }], model: 'synthetic-local' });
      }
    });
    const config: LocalEmbeddingConfig = {
      provider: 'local',
      endpointUrl: `http://127.0.0.1:${provider.port}`,
      modelName: 'synthetic-local',
      apiType: 'openai-compatible',
      enabled: true
    };
    try {
      await withProductionServer(async baseUrl => {
        for (const route of ['test', 'generate']) {
          const payload = route === 'test'
            ? { config, prompt: 'Contenuto esclusivamente sintetico' }
            : { config, texts: ['Contenuto esclusivamente sintetico'] };
          const post = (classification: string | undefined) => fetch(
            `${baseUrl}/api/embeddings/${route}`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...payload, classification, explicitTeacherOptIn: true }),
              signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS)
            });
          const before = calls;
          for (const classification of [undefined, 'UNKNOWN', 'STUDENT_PERSONAL', 'SECRET']) {
            const response = await post(classification);
            expect(response.status).toBe(403);
            await response.body?.cancel();
            expect(calls).toBe(before);
          }
          const allowed = await post('TEACHER_PROFESSIONAL');
          expect(allowed.status).toBe(200);
          await allowed.json();
          expect(calls).toBe(before + 1);
          expect(captured.at(-1)).toMatchObject({ input: route === 'test'
            ? 'Programmazione didattica per competenze D.M. 221/2025' : 'Contenuto esclusivamente sintetico' });
        }
      });
    } finally {
      provider.stop(true);
    }
  }, SERVER_TEST_TIMEOUT_MS);

  test('local embedding server proxy rejects a non-loopback endpoint before outbound fetch', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/embeddings/test`, {
        signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            provider: 'local',
            endpointUrl: 'http://example.invalid:8080',
            modelName: 'nomic-embed-text',
            apiType: 'openai-compatible',
            enabled: true
          },
          prompt: 'contenuto professionale del docente',
          classification: 'TEACHER_PROFESSIONAL'
        })
      });

      expect(response.status).toBe(403);
    });
  }, SERVER_TEST_TIMEOUT_MS);

  test('local embedding direct client rejects a non-loopback endpoint before any fetch', async () => {
    const config: LocalEmbeddingConfig = {
      provider: 'local',
      endpointUrl: 'https://example.invalid:8080',
      modelName: 'nomic-embed-text',
      apiType: 'openai-compatible',
      enabled: true
    };
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async input => {
      calls.push(String(input));
      return new Response('{}', { status: 500 });
    }) as typeof fetch;

    try {
      await expect(
        getEmbedding('contenuto professionale SEC-3 direct boundary', config, {
          classification: 'TEACHER_PROFESSIONAL'
        })
      ).rejects.toThrow(/loopback|locale|non consentito/i);
      expect(calls).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('embedding test route rejects an unknown provider before local fallback', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/embeddings/test`, {
        signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: {
            provider: 'other',
            endpointUrl: 'http://example.invalid:8080',
            modelName: 'nomic-embed-text',
            apiType: 'openai-compatible',
            enabled: true
          },
          prompt: 'contenuto professionale del docente',
          classification: 'TEACHER_PROFESSIONAL'
        })
      });

      expect(response.status).toBe(403);
    });
  }, SERVER_TEST_TIMEOUT_MS);

  test('embedding generate route rejects an unknown provider before local fallback', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/embeddings/generate`, {
        signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS),
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          texts: ['contenuto professionale del docente'],
          config: {
            provider: 'other',
            endpointUrl: 'http://example.invalid:8080',
            modelName: 'nomic-embed-text',
            apiType: 'openai-compatible',
            enabled: true
          },
          classification: 'TEACHER_PROFESSIONAL'
        })
      });

      expect(response.status).toBe(403);
    });
  }, SERVER_TEST_TIMEOUT_MS);

  test('getEmbedding rejects an unknown provider before any direct-client fetch', async () => {
    const config = {
      provider: 'other',
      endpointUrl: 'https://example.invalid:8080',
      modelName: 'nomic-embed-text',
      apiType: 'openai-compatible',
      enabled: true
    } as unknown as LocalEmbeddingConfig;
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async input => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }], model: 'unexpected' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      await expect(
        getEmbedding('contenuto professionale SEC-3 unknown provider', config, {
          classification: 'TEACHER_PROFESSIONAL'
        })
      ).rejects.toThrow(/provider|non consentito/i);
      expect(calls).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('testEmbeddingConnection rejects an unknown provider before any direct-client fetch', async () => {
    const config = {
      provider: 'other',
      endpointUrl: 'https://example.invalid:8080',
      modelName: 'nomic-embed-text',
      apiType: 'openai-compatible',
      enabled: true
    } as unknown as LocalEmbeddingConfig;
    const originalFetch = globalThis.fetch;
    const calls: string[] = [];
    globalThis.fetch = (async input => {
      calls.push(String(input));
      return new Response(
        JSON.stringify({ data: [{ embedding: [0.1, 0.2, 0.3] }], model: 'unexpected' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }) as typeof fetch;

    try {
      const result = await testEmbeddingConnection(config);
      expect(result.success).toBe(false);
      expect(result.error).toMatch(/provider|non consentito/i);
      expect(calls).toHaveLength(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test('local embedding boundaries do not follow redirects from an allowed loopback endpoint', async () => {
    let redirectedRequests = 0;
    const redirectTarget = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch() {
        redirectedRequests += 1;
        return new Response(
          JSON.stringify({ data: [{ embedding: [0.4, 0.5, 0.6] }], model: 'redirect-target' }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
    });
    const redirector = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch() {
        return new Response(null, {
          status: 307,
          headers: { Location: `http://127.0.0.1:${redirectTarget.port}/capture` }
        });
      }
    });
    const config: LocalEmbeddingConfig = {
      provider: 'local',
      endpointUrl: `http://127.0.0.1:${redirector.port}`,
      modelName: 'nomic-embed-text',
      apiType: 'openai-compatible',
      enabled: true
    };

    try {
      await withProductionServer(async baseUrl => {
        const response = await fetch(`${baseUrl}/api/embeddings/test`, {
          signal: AbortSignal.timeout(SERVER_REQUEST_TIMEOUT_MS),
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config,
            prompt: 'contenuto professionale redirect server',
            classification: 'TEACHER_PROFESSIONAL'
          })
        });

        expect(response.ok).toBe(false);
      });
      expect(redirectedRequests).toBe(0);

      await expect(
        getEmbedding('contenuto professionale redirect direct client', config, {
          classification: 'TEACHER_PROFESSIONAL'
        })
      ).rejects.toThrow();
      expect(redirectedRequests).toBe(0);
    } finally {
      redirector.stop(true);
      redirectTarget.stop(true);
    }
  }, SERVER_TEST_TIMEOUT_MS);
});