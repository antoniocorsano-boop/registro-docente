import { describe, expect, test } from 'bun:test';
import {
  clearSemanticMemorySyncLedger,
  createEmptySemanticMemorySyncLedger,
  loadSemanticMemorySyncLedger,
  parseSemanticMemorySourceKey,
  saveSemanticMemorySyncLedger,
  semanticMemorySourceKey,
} from './syncLedger';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const ENDPOINT_A = 'http://127.0.0.1:8765';
const ENDPOINT_B = 'http://localhost:8765';
const SOURCE = {
  sourceAppId: 'registro-docente',
  sourceType: 'library-source',
  sourceId: 'source-1',
};

describe('LSM-01C-A endpoint-scoped CAS sync ledger', () => {
  test('source identity key round-trips without storing semantic content', () => {
    const key = semanticMemorySourceKey(SOURCE);
    expect(parseSemanticMemorySourceKey(key)).toEqual(SOURCE);
    expect(key).not.toContain('professional text sentinel');
  });

  test('malformed or foreign payload fails closed to an empty endpoint ledger', () => {
    const storage = new MemoryStorage();
    storage.setItem('registro.semantic-memory-sync-ledger.v1:http%3A%2F%2F127.0.0.1%3A8765', '{broken-json');

    expect(loadSemanticMemorySyncLedger(ENDPOINT_A, storage)).toEqual(
      createEmptySemanticMemorySyncLedger(ENDPOINT_A),
    );

    storage.clear();
    storage.setItem('registro.semantic-memory-sync-ledger.v1:http%3A%2F%2F127.0.0.1%3A8765', JSON.stringify({
      schema: 'foreign-ledger/v1',
      endpoint: ENDPOINT_A,
      sources: { [semanticMemorySourceKey(SOURCE)]: { revision: 'rev-1' } },
    }));
    expect(loadSemanticMemorySyncLedger(ENDPOINT_A, storage)).toEqual(
      createEmptySemanticMemorySyncLedger(ENDPOINT_A),
    );
  });

  test('persists only endpoint-scoped source revision metadata and never token or professional text', () => {
    const storage = new MemoryStorage();
    const sourceKey = semanticMemorySourceKey(SOURCE);

    saveSemanticMemorySyncLedger({
      schema: 'registro.semantic-memory-sync-ledger/v1',
      endpoint: ENDPOINT_A,
      sources: { [sourceKey]: { revision: 'rev-1' } },
    }, storage);
    saveSemanticMemorySyncLedger({
      schema: 'registro.semantic-memory-sync-ledger/v1',
      endpoint: ENDPOINT_B,
      sources: {},
    }, storage);

    expect(loadSemanticMemorySyncLedger(ENDPOINT_A, storage).sources).toEqual({
      [sourceKey]: { revision: 'rev-1' },
    });
    expect(loadSemanticMemorySyncLedger(ENDPOINT_B, storage).sources).toEqual({});

    const raw = Array.from({ length: storage.length }, (_, index) => storage.getItem(storage.key(index) ?? '') ?? '').join('\n');
    expect(raw).toContain('rev-1');
    expect(raw).not.toContain('session-secret-sentinel');
    expect(raw).not.toContain('professional text sentinel');
  });

  test('clears only the selected endpoint ledger', () => {
    const storage = new MemoryStorage();
    const sourceKey = semanticMemorySourceKey(SOURCE);
    saveSemanticMemorySyncLedger({
      schema: 'registro.semantic-memory-sync-ledger/v1',
      endpoint: ENDPOINT_A,
      sources: { [sourceKey]: { revision: 'rev-a' } },
    }, storage);
    saveSemanticMemorySyncLedger({
      schema: 'registro.semantic-memory-sync-ledger/v1',
      endpoint: ENDPOINT_B,
      sources: { [sourceKey]: { revision: 'rev-b' } },
    }, storage);

    clearSemanticMemorySyncLedger(ENDPOINT_A, storage);

    expect(loadSemanticMemorySyncLedger(ENDPOINT_A, storage).sources).toEqual({});
    expect(loadSemanticMemorySyncLedger(ENDPOINT_B, storage).sources[sourceKey]?.revision).toBe('rev-b');
  });
});
