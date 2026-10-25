import type { LibrarySource, LibrarySourceKind } from './types';

export const MAX_LIBRARY_SOURCE_BYTES = 8 * 1024 * 1024;
export const MAX_LIBRARY_TEXT_BYTES = 256 * 1024;

type TextSourceKind = Extract<LibrarySourceKind, 'text' | 'note' | 'concept'>;

function requireValue(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} obbligatorio.`);
  return normalized;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function requireBoundedText(value: string, label: string): string {
  const normalized = requireValue(value, label);
  if (utf8Bytes(normalized) > MAX_LIBRARY_TEXT_BYTES) {
    throw new Error(`${label} troppo lungo: il limite è 256 KiB di testo UTF-8.`);
  }
  return normalized;
}

function deriveFileDisplayTitle(filename: string): string {
  const normalized = filename.trim();
  if (!normalized) return 'Fonte senza nome';

  const withoutFinalExtension = normalized.replace(/\.[^./\\]+$/, '');
  const readable = withoutFinalExtension
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return readable || 'Fonte senza nome';
}

function isLocallyReadableTextMime(mimeType: string): boolean {
  const normalized = mimeType.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  return normalized.startsWith('text/')
    || normalized === 'application/json'
    || normalized.endsWith('+json')
    || normalized === 'application/xml'
    || normalized.endsWith('+xml');
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
    privacy: 'unknown',
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
  if (capturedText && utf8Bytes(capturedText) > MAX_LIBRARY_TEXT_BYTES) {
    throw new Error('Testo acquisito troppo lungo: il limite è 256 KiB di testo UTF-8.');
  }

  return {
    id: requireValue(input.id, 'Identificatore'),
    kind: 'web',
    title: requireValue(input.title, 'Titolo'),
    capturedAt: requireValue(input.capturedAt, 'Data di acquisizione'),
    origin: url.hostname,
    sourceUrl: url.toString(),
    payload: capturedText ? { text: capturedText } : {},
    extractedText: capturedText || undefined,
    status: capturedText ? 'ready' : 'needs-review',
    privacy: 'unknown',
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
  const readableText = isLocallyReadableTextMime(mimeType);

  let extractedText: string | undefined;
  if (readableText && input.file.size <= MAX_LIBRARY_TEXT_BYTES) {
    const candidate = (await input.file.text()).trim();
    if (candidate && utf8Bytes(candidate) <= MAX_LIBRARY_TEXT_BYTES) {
      extractedText = candidate;
    }
  }

  return {
    id: requireValue(input.id, 'Identificatore'),
    kind: mimeType.startsWith('image/') ? 'image' : 'file',
    title: deriveFileDisplayTitle(input.file.name),
    capturedAt: requireValue(input.capturedAt, 'Data di acquisizione'),
    origin: input.file.name || undefined,
    payload: {
      mimeType,
      dataUrl,
      ...(extractedText ? { text: extractedText } : {})
    },
    extractedText,
    status: readableText ? (extractedText ? 'ready' : 'needs-review') : 'captured',
    privacy: 'unknown',
    links: []
  };
}

export function buildCapturedWebTextPatch(
  source: LibrarySource,
  text: string
): Pick<LibrarySource, 'extractedText' | 'status'> {
  if (source.kind !== 'web' || source.status !== 'needs-review') {
    throw new Error('Il completamento testuale è ammesso soltanto per una fonte web incompleta.');
  }

  return {
    extractedText: requireBoundedText(text, 'Testo acquisito'),
    status: 'ready'
  };
}
