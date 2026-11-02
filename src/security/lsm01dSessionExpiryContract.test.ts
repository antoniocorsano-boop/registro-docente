import { describe, expect, test } from 'bun:test';
import type { LocalSemanticMemoryPort } from '../../vendor/contextual-copilot-semantic-memory/index';
import type { LibraryStateV1 } from '../library/types';
import { SemanticMemoryHttpError } from '../semanticMemory/httpClient';
import { retrieveLibrarySourcesFromSemanticMemory } from '../semanticMemory/libraryRetrieval';
import { syncRegistroSemanticMemory } from '../semanticMemory/sync';

describe('LSM-01D expired session transport behavior', () => {
  test('sync surfaces HTTP_401 once and performs no retry or derived mutation attempt', async () => {
    let healthCalls = 0;
    let mutationCalls = 0;
    const port = {
      mode: 'local',
      async health() {
        healthCalls += 1;
        throw new SemanticMemoryHttpError('HTTP_401', 401);
      },
      async upsert() {
        mutationCalls += 1;
        throw new Error('upsert must not run after expired health');
      },
      async remove() {
        mutationCalls += 1;
        throw new Error('remove must not run after expired health');
      },
      async search() {
        throw new Error('not used');
      },
    } as LocalSemanticMemoryPort;

    const result = await syncRegistroSemanticMemory({
      port,
      endpoint: 'http://127.0.0.1:8765',
      projections: [],
    });

    expect(result.status).toBe('failed');
    expect(result.errorCode).toBe('HTTP_401');
    expect(healthCalls).toBe(1);
    expect(mutationCalls).toBe(0);
  });

  test('search propagates HTTP_401 once instead of converting it into NO_SEMANTIC_MATCH', async () => {
    let searchCalls = 0;
    const port = {
      mode: 'local',
      async search() {
        searchCalls += 1;
        throw new SemanticMemoryHttpError('HTTP_401', 401);
      },
    } as LocalSemanticMemoryPort;

    try {
      await retrieveLibrarySourcesFromSemanticMemory({
        query: 'energia',
        port,
        library: { schemaVersion: 1, sources: [] } as LibraryStateV1,
      });
      throw new Error('expected expired session search failure');
    } catch (error) {
      expect(error).toBeInstanceOf(SemanticMemoryHttpError);
      expect((error as SemanticMemoryHttpError).code).toBe('HTTP_401');
    }
    expect(searchCalls).toBe(1);
  });
});

describe('LSM-01D expired session application contract', () => {
  test('App owns one fail-closed invalidation path for sync and Library search', async () => {
    const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();
    const librarySource = await Bun.file(new URL('../components/LibraryView.tsx', import.meta.url)).text();

    expect(appSource).toContain('invalidateSemanticMemorySession');
    expect(appSource).toContain("result.errorCode === 'HTTP_401'");
    expect(appSource).toContain('onSemanticMemorySessionExpired={invalidateSemanticMemorySession}');
    expect(appSource).toContain('semanticMemorySessionErrorCode={semanticMemorySession.errorCode ?? null}');
    expect(librarySource).toContain('onSemanticMemorySessionExpired');
    expect(librarySource).toContain("error.code === 'HTTP_401'");
    expect(librarySource).toContain('La memoria locale non è più attiva. Riattivala dalle Impostazioni.');
  });

  test('session view records expiry metadata but never a capability and exposes reactivation copy', async () => {
    const settingsSource = await Bun.file(new URL('../components/SemanticMemorySettings.tsx', import.meta.url)).text();
    const appSource = await Bun.file(new URL('../App.tsx', import.meta.url)).text();

    expect(settingsSource).toContain('expiresAt: string | null');
    expect(settingsSource).toContain("session.errorCode === 'SESSION_EXPIRED'");
    expect(settingsSource).toContain('La sessione locale è scaduta. Attiva di nuovo la memoria locale.');
    expect(appSource).toContain('expiresAt: bootstrap.expiresAt');
    expect(appSource).not.toMatch(/localStorage|sessionStorage/);
    expect(settingsSource).not.toContain('token: string');
  });
});
