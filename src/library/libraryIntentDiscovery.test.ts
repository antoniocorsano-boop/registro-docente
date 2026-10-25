import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from './types';

const makeSource = (): LibrarySource => ({
  id: 'lib06a-source',
  kind: 'note',
  title: 'Fonte sintetica LIB-06A',
  capturedAt: '2026-10-25T21:00:00.000Z',
  origin: 'fixture LIB-06A',
  payload: { text: 'Materiale sintetico per la classificazione locale.' },
  extractedText: 'Materiale sintetico per la classificazione locale.',
  status: 'ready',
  privacy: 'teacher-professional',
  links: [],
  notes: ''
});

describe('LIB-06A Core intent discovery boundary', () => {
  test('discovers REVIEW from teacher free text', async () => {
    const adapter = await import('./contextualCoreAdapter') as typeof import('./contextualCoreAdapter') & {
      discoverLibraryCopilotIntent?: (input: { source: LibrarySource; message: string }) => Promise<{
        status: string;
        reason: string;
        intents: readonly { actionId: string; capability: string }[];
      }>;
    };

    expect(typeof adapter.discoverLibraryCopilotIntent).toBe('function');
    if (typeof adapter.discoverLibraryCopilotIntent !== 'function') return;

    const result = await adapter.discoverLibraryCopilotIntent({
      source: makeSource(),
      message: 'rivedi questa fonte nel contesto della programmazione'
    });

    expect(result.status).toBe('DISCOVERED');
    expect(result.reason).toBe('INTENT_DISCOVERED');
    expect(result.intents).toEqual([{ actionId: 'review-source', capability: 'REVIEW' }]);
  });

  test('discovers LINK and resolveRequest still applies Core authority', async () => {
    const adapter = await import('./contextualCoreAdapter') as typeof import('./contextualCoreAdapter') & {
      discoverLibraryCopilotIntent?: (input: { source: LibrarySource; message: string }) => Promise<{
        status: string;
        reason: string;
        intents: readonly { actionId: string; capability: string }[];
      }>;
    };

    expect(typeof adapter.discoverLibraryCopilotIntent).toBe('function');
    if (typeof adapter.discoverLibraryCopilotIntent !== 'function') return;

    const input = {
      source: makeSource(),
      message: 'collega questa fonte alla UDA'
    };
    const discovery = await adapter.discoverLibraryCopilotIntent(input);
    const resolution = await adapter.resolveLibraryCopilotRequest(input);

    expect(discovery.intents).toEqual([{ actionId: 'link-source-to-uda', capability: 'LINK' }]);
    expect(resolution.status).toBe('RESOLVED');
    expect(resolution.reason).toBe('INTENT_RESOLVED');
    expect(resolution.actions.map(action => action.id)).toEqual(['link-source-to-uda']);
    expect(resolution.actions[0]?.policy.humanConfirmationRequired).toBe(true);
  });

  test('discovers PREPARE even though the local Core has no generative provider', async () => {
    const adapter = await import('./contextualCoreAdapter') as typeof import('./contextualCoreAdapter') & {
      discoverLibraryCopilotIntent?: (input: { source: LibrarySource; message: string }) => Promise<{
        status: string;
        reason: string;
        intents: readonly { actionId: string; capability: string }[];
      }>;
    };

    expect(typeof adapter.discoverLibraryCopilotIntent).toBe('function');
    if (typeof adapter.discoverLibraryCopilotIntent !== 'function') return;

    const input = {
      source: makeSource(),
      message: "prepara un'attività per questa lezione"
    };
    const discovery = await adapter.discoverLibraryCopilotIntent(input);
    const resolution = await adapter.resolveLibraryCopilotRequest(input);

    expect(discovery.status).toBe('DISCOVERED');
    expect(discovery.intents).toEqual([{ actionId: 'prepare-from-source', capability: 'PREPARE' }]);
    expect(resolution.status).toBe('UNRESOLVED');
    expect(resolution.actions.map(action => action.id)).not.toContain('prepare-from-source');
  });

  test('keeps SUMMARIZE out of text-intent routing and fails closed on mixed intent', async () => {
    const adapter = await import('./contextualCoreAdapter') as typeof import('./contextualCoreAdapter') & {
      discoverLibraryCopilotIntent?: (input: { source: LibrarySource; message: string }) => Promise<{
        status: string;
        reason: string;
        intents: readonly { actionId: string; capability: string }[];
      }>;
    };

    expect(typeof adapter.discoverLibraryCopilotIntent).toBe('function');
    if (typeof adapter.discoverLibraryCopilotIntent !== 'function') return;

    const summary = await adapter.discoverLibraryCopilotIntent({
      source: makeSource(),
      message: 'riassumi questa fonte'
    });
    const mixed = await adapter.discoverLibraryCopilotIntent({
      source: makeSource(),
      message: 'collega e prepara questa fonte per la UDA'
    });

    expect(summary.status).toBe('UNRESOLVED');
    expect(summary.reason).toBe('NO_INTENT_MATCH');
    expect(summary.intents).toEqual([]);
    expect(mixed.status).toBe('UNRESOLVED');
    expect(mixed.reason).toBe('NO_INTENT_MATCH');
    expect(mixed.intents).toEqual([]);
  });
});
