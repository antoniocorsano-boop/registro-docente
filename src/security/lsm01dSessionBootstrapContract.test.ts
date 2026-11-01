import { describe, expect, test } from 'bun:test';
import {
  SemanticMemorySessionBootstrapError,
  activateSemanticMemorySession,
} from '../semanticMemory/sessionBootstrap';

const READY_HEALTH = {
  schema: 'trama.semantic-memory-health/v1' as const,
  status: 'ready' as const,
  protocolVersion: 1 as const,
  modelId: 'embeddinggemma-2-local',
  dimensions: 768,
  indexRevision: '1',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function futureIso(): string {
  return new Date(Date.now() + 60_000).toISOString();
}

describe('LSM-01D zero-token session bootstrap', () => {
  test('rejects non-loopback and non-http endpoints before fetch', async () => {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return jsonResponse({});
    };

    await expect(activateSemanticMemorySession({
      endpointUrl: 'https://example.com:8765',
      fetchImpl,
    })).rejects.toThrow();
    await expect(activateSemanticMemorySession({
      endpointUrl: 'http://192.168.1.10:8765',
      fetchImpl,
    })).rejects.toThrow();
    expect(calls).toBe(0);
  });

  test('performs one explicit POST bootstrap with loopback browser safeguards', async () => {
    const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      calls.push({ input, init });
      return jsonResponse({
        schema: 'trama.semantic-memory-session/v1',
        token: 'ephemeral-session-capability',
        expiresAt: futureIso(),
        health: READY_HEALTH,
      });
    };

    const result = await activateSemanticMemorySession({
      endpointUrl: 'http://127.0.0.1:8765',
      fetchImpl,
      timeoutMs: 250,
    });

    expect(calls).toHaveLength(1);
    expect(String(calls[0].input)).toBe('http://127.0.0.1:8765/v1/session');
    expect(calls[0].init?.method).toBe('POST');
    expect(calls[0].init?.credentials).toBe('omit');
    expect(calls[0].init?.cache).toBe('no-store');
    expect(calls[0].init?.redirect).toBe('error');
    expect((calls[0].init as RequestInit & { targetAddressSpace?: string })?.targetAddressSpace).toBe('loopback');
    expect(new Headers(calls[0].init?.headers).has('Authorization')).toBe(false);
    expect(result.token).toBe('ephemeral-session-capability');
    expect(result.health).toEqual(READY_HEALTH);
  });

  test('fails closed for malformed, expired, HTTP and timeout responses', async () => {
    const malformed: typeof fetch = async () => jsonResponse({
      schema: 'trama.semantic-memory-session/v1',
      token: ' ',
      expiresAt: futureIso(),
      health: READY_HEALTH,
    });
    await expect(activateSemanticMemorySession({
      endpointUrl: 'http://127.0.0.1:8765',
      fetchImpl: malformed,
    })).rejects.toBeInstanceOf(SemanticMemorySessionBootstrapError);

    const expired: typeof fetch = async () => jsonResponse({
      schema: 'trama.semantic-memory-session/v1',
      token: 'ephemeral-session-capability',
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      health: READY_HEALTH,
    });
    await expect(activateSemanticMemorySession({
      endpointUrl: 'http://127.0.0.1:8765',
      fetchImpl: expired,
    })).rejects.toBeInstanceOf(SemanticMemorySessionBootstrapError);

    const unavailable: typeof fetch = async () => jsonResponse({ error: 'service_unavailable' }, 503);
    try {
      await activateSemanticMemorySession({
        endpointUrl: 'http://127.0.0.1:8765',
        fetchImpl: unavailable,
      });
      throw new Error('expected HTTP bootstrap failure');
    } catch (error) {
      expect(error).toBeInstanceOf(SemanticMemorySessionBootstrapError);
      expect((error as SemanticMemorySessionBootstrapError).code).toBe('HTTP_503');
    }

    const neverResolves: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
    try {
      await activateSemanticMemorySession({
        endpointUrl: 'http://127.0.0.1:8765',
        fetchImpl: neverResolves,
        timeoutMs: 5,
      });
      throw new Error('expected timeout');
    } catch (error) {
      expect(error).toBeInstanceOf(SemanticMemorySessionBootstrapError);
      expect((error as SemanticMemorySessionBootstrapError).code).toBe('TIMEOUT');
    }
  });
});

describe('LSM-01D zero-token activation UI contract', () => {
  test('removes token entry and exposes one explicit activation gesture', async () => {
    const settingsSource = await Bun.file(new URL('../components/SemanticMemorySettings.tsx', import.meta.url)).text();

    expect(settingsSource).not.toContain('Token di sessione');
    expect(settingsSource).not.toContain('type="password"');
    expect(settingsSource).not.toContain('token: string');
    expect(settingsSource).toContain('Attiva memoria locale');
    expect(settingsSource).toContain("onConnect({ endpoint })");
    expect(settingsSource).toContain('Sincronizza');
  });

  test('App bootstraps an ephemeral session before constructing the existing LSM client', async () => {
    const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();

    expect(appSource).toContain('activateSemanticMemorySession');
    expect(appSource).toContain('createSemanticMemoryHttpClient({ endpointUrl: endpoint, token: bootstrap.token })');
    expect(appSource).not.toContain('SemanticMemoryConnectInput): Promise<boolean> => {\n    setSemanticMemorySession');
    expect(appSource).not.toMatch(/localStorage|sessionStorage/);
  });
});
