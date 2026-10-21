import { describe, expect, test } from 'bun:test';
import { getEmbedding, testEmbeddingConnection } from '../services/embeddingService';
import type { LocalEmbeddingConfig } from '../types';

async function withProductionServer<T>(run: (baseUrl: string) => Promise<T>): Promise<T> {
  const port = 44000 + Math.floor(Math.random() * 1000);
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = Bun.spawn(['node', 'server.ts'], {
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: String(port),
      GEMINI_API_KEY: ''
    },
    stdout: 'pipe',
    stderr: 'pipe'
  });

  try {
    let ready = false;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      try {
        const probe = await fetch(`${baseUrl}/api/embeddings/test`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}'
        });
        if (probe.status === 400) {
          ready = true;
          break;
        }
      } catch {
        // Server not listening yet.
      }
      await Bun.sleep(50);
    }

    expect(ready).toBe(true);
    return await run(baseUrl);
  } finally {
    server.kill();
    await server.exited;
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

  test('UDA Gemini server boundary fails closed when policy metadata is missing', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/gemini/generate-uda-description`, {
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
  });

  test('UDA Gemini server boundary blocks student personal data even with opt-in', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/gemini/generate-uda-description`, {
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
  });

  test('local embedding server proxy rejects a non-loopback endpoint before outbound fetch', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/embeddings/test`, {
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
  });

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
  });

  test('embedding generate route rejects an unknown provider before local fallback', async () => {
    await withProductionServer(async baseUrl => {
      const response = await fetch(`${baseUrl}/api/embeddings/generate`, {
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
  });

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
  });
});