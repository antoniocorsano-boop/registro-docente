import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  MAX_LIBRARY_SOURCE_BYTES,
  createFileSource,
  createTextSource,
  createWebSource
} from './intake';

const originalFileReader = globalThis.FileReader;

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
  test('rejects empty text and normalizes text sources as teacher-professional ready material', () => {
    expect(() => createTextSource({ id: 'a', title: 'Idea', text: '  ', capturedAt: '2026-10-24T10:00:00.000Z' })).toThrow();

    const source = createTextSource({
      id: 'a', title: ' Idea ', text: ' Energia eolica ', capturedAt: '2026-10-24T10:00:00.000Z', kind: 'concept'
    });
    expect(source.kind).toBe('concept');
    expect(source.title).toBe('Idea');
    expect(source.payload.text).toBe('Energia eolica');
    expect(source.status).toBe('ready');
    expect(source.privacy).toBe('teacher-professional');
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
