import type { LibrarySource, LibrarySourceKind } from './types';

export const MAX_LIBRARY_SOURCE_BYTES = 8 * 1024 * 1024;

type TextSourceKind = Extract<LibrarySourceKind, 'text' | 'note' | 'concept'>;

function requireValue(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} obbligatorio.`);
  return normalized;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof FileReader === 'undefined') {
      reject(new Error('FileReader non disponibile in questo ambiente.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Lettura del file non completata.'));
        return;
      }
      resolve(reader.result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Lettura del file non riuscita.'));
    reader.readAsDataURL(file);
  });
}

export function createTextSource(input: {
  id: string;
  title: string;
  text: string;
  capturedAt: string;
  kind?: TextSourceKind;
}): LibrarySource {
  const text = requireValue(input.text, 'Testo');
  const title = requireValue(input.title, 'Titolo');

  return {
    id: requireValue(input.id, 'Identificatore'),
    kind: input.kind ?? 'text',
    title,
    capturedAt: requireValue(input.capturedAt, 'Data di acquisizione'),
    payload: { text },
    status: 'ready',
    privacy: 'teacher-professional',
    links: []
  };
}

export function createWebSource(input: {
  id: string;
  title: string;
  url: string;
  capturedAt: string;
  capturedText?: string;
}): LibrarySource {
  const rawUrl = requireValue(input.url, 'URL');
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL non valido.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL non valido: sono ammessi soltanto indirizzi http o https.');
  }

  const capturedText = input.capturedText?.trim();
  return {
    id: requireValue(input.id, 'Identificatore'),
    kind: 'web',
    title: requireValue(input.title, 'Titolo'),
    capturedAt: requireValue(input.capturedAt, 'Data di acquisizione'),
    origin: url.hostname,
    sourceUrl: url.toString(),
    payload: capturedText ? { text: capturedText } : {},
    extractedText: capturedText || undefined,
    status: 'ready',
    privacy: 'teacher-professional',
    links: []
  };
}

export async function createFileSource(input: {
  id: string;
  file: File;
  capturedAt: string;
}): Promise<LibrarySource> {
  if (input.file.size > MAX_LIBRARY_SOURCE_BYTES) {
    throw new Error('File troppo grande: il limite per una fonte è 8 MiB.');
  }

  const mimeType = input.file.type || 'application/octet-stream';
  const dataUrl = await readFileAsDataUrl(input.file);

  return {
    id: requireValue(input.id, 'Identificatore'),
    kind: mimeType.startsWith('image/') ? 'image' : 'file',
    title: input.file.name.trim() || 'Fonte senza nome',
    capturedAt: requireValue(input.capturedAt, 'Data di acquisizione'),
    origin: input.file.name || undefined,
    payload: { mimeType, dataUrl },
    status: 'captured',
    privacy: 'unknown',
    links: []
  };
}
