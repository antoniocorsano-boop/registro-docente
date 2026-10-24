import { describe, expect, test } from 'bun:test';

const INTAKE_PATH = new URL('../library/intake.ts', import.meta.url);
const INTAKE_MODULE = '../library/intake.ts';

describe('LIB-01A governed private source intake', () => {
  test('materializes local-only intake factories with an 8 MiB limit', async () => {
    const intakeFile = Bun.file(INTAKE_PATH);
    expect(await intakeFile.exists()).toBe(true);

    const source = await intakeFile.text();
    expect(source).toContain('MAX_LIBRARY_SOURCE_BYTES = 8 * 1024 * 1024');
    expect(source).toContain('new FileReader()');
    expect(source).not.toContain('fetch(');

    const intake = await import(INTAKE_MODULE);
    expect(intake.MAX_LIBRARY_SOURCE_BYTES).toBe(8 * 1024 * 1024);
  });

  test('keeps teacher text and web sources privacy-unknown until policy review', async () => {
    const { createTextSource, createWebSource } = await import(INTAKE_MODULE);

    expect(() => createTextSource({
      id: 'empty', title: 'Vuoto', text: '   ', capturedAt: '2026-10-24T10:00:00.000Z'
    })).toThrow();

    const text = createTextSource({
      id: 'txt-1', title: 'Idea', text: 'Energia dal vento', capturedAt: '2026-10-24T10:00:00.000Z'
    });
    expect(text.status).toBe('ready');
    expect(text.privacy).toBe('unknown');
    expect(text.payload.text).toBe('Energia dal vento');

    expect(() => createWebSource({
      id: 'web-bad', title: 'Web', url: 'not a url', capturedAt: '2026-10-24T10:00:00.000Z'
    })).toThrow();

    const web = createWebSource({
      id: 'web-1', title: 'Articolo', url: 'https://example.org/a b?x=1', capturedAt: '2026-10-24T10:00:00.000Z'
    });
    expect(web.sourceUrl).toBe('https://example.org/a%20b?x=1');
    expect(web.privacy).toBe('unknown');
  });
});
