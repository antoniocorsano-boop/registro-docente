import { describe, expect, test } from 'bun:test';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SENSITIVE_SYMBOLS = [
  'STORAGE_KEY',
  'CUSTOM_TESTS_KEY',
  'SETTINGS_KEY',
  'UDA_KEY',
  'SUBMISSIONS_KEY',
  'META_KEY'
] as const;

const SENSITIVE_RAW_KEYS = [
  'registro_docente_data_v35',
  'registro_custom_tests_v1',
  'registro_settings_v1',
  'registro_uda_v1',
  'scuola_verifiche_submissions',
  'registro_meta'
] as const;

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

describe('SEC-1 plaintext storage regression guard', () => {
  test('forbids sensitive localStorage writes and broad clear operations in production source', async () => {
    const violations: string[] = [];

    for (const file of await sourceFiles('src')) {
      const source = await fs.readFile(file, 'utf8');

      if (source.includes('localStorage.clear()') || source.includes('window.localStorage.clear()')) {
        violations.push(`${file}: broad localStorage.clear()`);
      }

      for (const symbol of SENSITIVE_SYMBOLS) {
        const direct = new RegExp(`(?:window\\.)?localStorage\\.setItem\\(\\s*${symbol}\\b`);
        if (direct.test(source)) violations.push(`${file}: setItem(${symbol})`);
      }

      for (const rawKey of SENSITIVE_RAW_KEYS) {
        const escaped = rawKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const direct = new RegExp(`(?:window\\.)?localStorage\\.setItem\\(\\s*['\"]${escaped}['\"]`);
        if (direct.test(source)) violations.push(`${file}: setItem(${rawKey})`);
      }
    }

    expect(violations).toEqual([]);
  });

  test('legacy migration may read/remove legacy keys but never write them back', async () => {
    const source = await fs.readFile('src/security/legacyMigration.ts', 'utf8');

    expect(source).toContain('storage.getItem(key)');
    expect(source).toContain('storage.removeItem(legacyKey)');
    expect(source).not.toContain('setItem(');
  });
});
