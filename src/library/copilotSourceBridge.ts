import { createFileSource, createTextSource, createWebSource } from './intake';
import type { LibrarySource } from './types';

export type CopilotSourceInput =
  | {
      mode: 'text';
      id: string;
      title: string;
      text: string;
      capturedAt: string;
      kind?: 'text' | 'note' | 'concept';
    }
  | {
      mode: 'web';
      id: string;
      title: string;
      url: string;
      capturedAt: string;
      capturedText?: string;
    }
  | {
      mode: 'file';
      id: string;
      file: File;
      capturedAt: string;
    };

export async function createCopilotLibrarySource(
  input: CopilotSourceInput
): Promise<LibrarySource> {
  switch (input.mode) {
    case 'text':
      return createTextSource({
        id: input.id,
        title: input.title,
        text: input.text,
        capturedAt: input.capturedAt,
        ...(input.kind ? { kind: input.kind } : {})
      });
    case 'web':
      return createWebSource({
        id: input.id,
        title: input.title,
        url: input.url,
        capturedAt: input.capturedAt,
        ...(input.capturedText ? { capturedText: input.capturedText } : {})
      });
    case 'file':
      return createFileSource({
        id: input.id,
        file: input.file,
        capturedAt: input.capturedAt
      });
  }
}
