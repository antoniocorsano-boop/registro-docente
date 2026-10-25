import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import * as intakeModule from './intake';
import {
  MAX_LIBRARY_SOURCE_BYTES,
  createFileSource,
  createTextSource,
  createWebSource
} from './intake';
import type { LibrarySource } from './types';

const originalFileReader = globalThis.FileReader;
const EXPECTED_TEXT_BUDGET = 262_144;

class FakeFileReader {
  result: string | ArrayBuffer | null = null;
  error: DOMException | null = null;
  onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

  readAsDataURL(blob: Blob): void {
    this.result = `data:${blob.type || 'application/octet-stream'};base64,ZmFrZQ==`;
    queueMicrotask(() => this.onload?.call(this as unknown as FileReader, {} as ProgressEvent<FileReader>));
  }
}

beforeAll(() => {
  globalThis.FileReader = FakeFileReader as unknown as typeof FileReader;
});

afterAll(() => {
  globalThis.FileReader = originalFileReader;
});

describe('LIB-01A private source intake', () => {
  test('rejects empty text and keeps text sources privacy-unknown until teacher review', () => {
    expect(() => createTextSource({ id: 'a', title: 'Idea', text: '  ', capturedAt: '2026-10-24T10:00:00.000Z' })).toThrow();

    const source = createTextSource({
      id: 'a', title: ' Idea ', text: ' Energia eolica ', capturedAt: '2026-10-24T10:00:00.000Z', kind: 'concept'
    });
    expect(source.kind).toBe('concept');
    expect(source.title).toBe('Idea');
    expect(source.payload.text).toBe('Energia eolica');
    expect(source.status).toBe('ready');
    expect(source.privacy).toBe('unknown');
  });

  test('rejects malformed URLs and preserves their normalized form without fetching them', () => {
    expect(() => createWebSource({ id: 'w0', title: 'Web', url: 'not a url', capturedAt: '2026-10-24T10:00:00.000Z' })).toThrow();
    expect(() => createWebSource({ id: 'w0', title: 'Web', url: 'javascript:alert(1)', capturedAt: '2026-10-24T10:00:00.000Z' })).toThrow();

    const source = createWebSource({
      id: 'w1', title: 'Articolo', url: 'https://example.org/a b?x=1', capturedAt: '2026-10-24T10:00:00.000Z', capturedText: ' estratto '
    });
    expect(source.sourceUrl).toBe('https://example.org/a%20b?x=1');
    expect(source.origin).toBe('example.org');
    expect(source.payload.text).toBe('estratto');
  });

  test('captures image/file bytes locally as data URLs and keeps privacy unknown', async () => {
    const image = new File(['fake'], 'foto.png', { type: 'image/png' });
    const source = await createFileSource({ id: 'img-1', file: image, capturedAt: '2026-10-24T10:00:00.000Z' });
    expect(source.kind).toBe('image');
    expect(source.payload.mimeType).toBe('image/png');
    expect(source.payload.dataUrl).toStartWith('data:image/png;base64,');
    expect(source.status).toBe('captured');
    expect(source.privacy).toBe('unknown');

    const readable = new File(['fake'], 'TECNOLOGIA_VERDE_2026_2027.json', { type: 'application/json' });
    const readableSource = await createFileSource({ id: 'readable-1', file: readable, capturedAt: '2026-10-24T10:00:00.000Z' });
    expect(readableSource.title).toBe('TECNOLOGIA VERDE 2026 2027');
    expect(readableSource.origin).toBe('TECNOLOGIA_VERDE_2026_2027.json');

    const unknown = new File(['fake'], 'asset.bin', { type: 'application/x-custom' });
    const unknownSource = await createFileSource({ id: 'f-1', file: unknown, capturedAt: '2026-10-24T10:00:00.000Z' });
    expect(unknownSource.kind).toBe('file');
    expect(unknownSource.extractedText).toBeUndefined();
  });

  test('rejects oversized files before FileReader is invoked', async () => {
    let reads = 0;
    class CountingReader extends FakeFileReader {
      readAsDataURL(blob: Blob): void {
        reads += 1;
        super.readAsDataURL(blob);
      }
    }
    globalThis.FileReader = CountingReader as unknown as typeof FileReader;
    const oversized = new File([new Uint8Array(MAX_LIBRARY_SOURCE_BYTES + 1)], 'large.bin', { type: 'application/octet-stream' });
    await expect(createFileSource({ id: 'large', file: oversized, capturedAt: '2026-10-24T10:00:00.000Z' })).rejects.toThrow(/8 MiB/);
    expect(reads).toBe(0);
    globalThis.FileReader = FakeFileReader as unknown as typeof FileReader;
  });
});

describe('LIB-02 governed source normalization', () => {
  test('exposes the same local text budget as the governed remote runtime', () => {
    expect((intakeModule as Record<string, unknown>).MAX_LIBRARY_TEXT_BYTES).toBe(EXPECTED_TEXT_BUDGET);
  });

  test('keeps URL-only sources incomplete until page content is actually captured', () => {
    const source = createWebSource({
      id: 'web-url-only',
      title: 'Articolo energia',
      url: 'https://example.org/energia',
      capturedAt: '2026-10-25T09:00:00.000Z'
    });

    expect(source.status).toBe('needs-review');
    expect(source.payload.text).toBeUndefined();
    expect(source.extractedText).toBeUndefined();
    expect(source.privacy).toBe('unknown');
  });

  test('marks a web source ready only when bounded captured text is preserved locally', () => {
    const source = createWebSource({
      id: 'web-with-text',
      title: 'Articolo energia',
      url: 'https://example.org/energia',
      capturedAt: '2026-10-25T09:00:00.000Z',
      capturedText: '  Una rete elettrica distribuisce energia.  '
    });

    expect(source.status).toBe('ready');
    expect(source.payload.text).toBe('Una rete elettrica distribuisce energia.');
    expect(source.extractedText).toBe('Una rete elettrica distribuisce energia.');
    expect(source.privacy).toBe('unknown');
  });

  test('rejects captured web text above the governed UTF-8 byte budget without truncating it', () => {
    const oversized = 'à'.repeat(Math.floor(EXPECTED_TEXT_BUDGET / 2) + 1);
    expect(() => createWebSource({
      id: 'web-too-large',
      title: 'Articolo lungo',
      url: 'https://example.org/lungo',
      capturedAt: '2026-10-25T09:00:00.000Z',
      capturedText: oversized
    })).toThrow(/testo/i);
  });

  test('extracts small local text and JSON files while preserving the original data URL', async () => {
    const text = new File(['  Energia eolica e rete.  '], 'energia.txt', { type: 'text/plain' });
    const textSource = await createFileSource({
      id: 'text-file',
      file: text,
      capturedAt: '2026-10-25T09:00:00.000Z'
    });
    expect(textSource.payload.dataUrl).toStartWith('data:text/plain;base64,');
    expect(textSource.payload.text).toBe('Energia eolica e rete.');
    expect(textSource.extractedText).toBe('Energia eolica e rete.');
    expect(textSource.status).toBe('ready');
    expect(textSource.privacy).toBe('unknown');

    const json = new File([' {"tema":"energia"} '], 'energia.json', { type: 'application/json' });
    const jsonSource = await createFileSource({
      id: 'json-file',
      file: json,
      capturedAt: '2026-10-25T09:00:00.000Z'
    });
    expect(jsonSource.payload.dataUrl).toStartWith('data:application/json;base64,');
    expect(jsonSource.payload.text).toBe('{"tema":"energia"}');
    expect(jsonSource.extractedText).toBe('{"tema":"energia"}');
    expect(jsonSource.status).toBe('ready');
  });

  test('keeps empty or over-budget textual files reviewable without silently truncating content', async () => {
    const empty = new File(['   '], 'vuoto.txt', { type: 'text/plain' });
    const emptySource = await createFileSource({
      id: 'empty-text',
      file: empty,
      capturedAt: '2026-10-25T09:00:00.000Z'
    });
    expect(emptySource.status).toBe('needs-review');
    expect(emptySource.payload.text).toBeUndefined();
    expect(emptySource.extractedText).toBeUndefined();

    const oversized = new File([new Uint8Array(EXPECTED_TEXT_BUDGET + 1)], 'grande.txt', { type: 'text/plain' });
    const oversizedSource = await createFileSource({
      id: 'large-text',
      file: oversized,
      capturedAt: '2026-10-25T09:00:00.000Z'
    });
    expect(oversizedSource.status).toBe('needs-review');
    expect(oversizedSource.payload.dataUrl).toStartWith('data:text/plain;base64,');
    expect(oversizedSource.payload.text).toBeUndefined();
    expect(oversizedSource.extractedText).toBeUndefined();
  });

  test('keeps images and PDFs captured for the existing governed multimodal path', async () => {
    const image = await createFileSource({
      id: 'photo',
      file: new File(['image'], 'foto.png', { type: 'image/png' }),
      capturedAt: '2026-10-25T09:00:00.000Z'
    });
    const pdf = await createFileSource({
      id: 'pdf',
      file: new File(['pdf'], 'scheda.pdf', { type: 'application/pdf' }),
      capturedAt: '2026-10-25T09:00:00.000Z'
    });

    expect(image.status).toBe('captured');
    expect(image.payload.text).toBeUndefined();
    expect(pdf.status).toBe('captured');
    expect(pdf.payload.text).toBeUndefined();
  });

  test('builds a bounded ready patch only for an incomplete web source', () => {
    const buildPatch = (intakeModule as Record<string, unknown>).buildCapturedWebTextPatch;
    expect(typeof buildPatch).toBe('function');
    if (typeof buildPatch !== 'function') return;

    const web: LibrarySource = createWebSource({
      id: 'web-patch',
      title: 'Pagina',
      url: 'https://example.org/page',
      capturedAt: '2026-10-25T09:00:00.000Z'
    });
    const textSource = createTextSource({
      id: 'text-patch',
      title: 'Nota',
      text: 'contenuto',
      capturedAt: '2026-10-25T09:00:00.000Z'
    });

    expect((buildPatch as (source: LibrarySource, text: string) => unknown)(web, '  testo acquisito  ')).toEqual({
      extractedText: 'testo acquisito',
      status: 'ready'
    });
    expect(() => (buildPatch as (source: LibrarySource, text: string) => unknown)(textSource, 'testo')).toThrow();
    expect(() => (buildPatch as (source: LibrarySource, text: string) => unknown)(web, '   ')).toThrow();
    expect(() => (buildPatch as (source: LibrarySource, text: string) => unknown)(web, 'à'.repeat(Math.floor(EXPECTED_TEXT_BUDGET / 2) + 1))).toThrow();
  });
});
