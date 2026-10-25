import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from '../library/types';

const ROOT_PACKAGE = new URL('../../package.json', import.meta.url);
const ROOT_LOCK = new URL('../../bun.lock', import.meta.url);
const VENDOR_ROOT = new URL('../../vendor/contextual-copilot-core/', import.meta.url);
const PROVENANCE = new URL('../../vendor/contextual-copilot-core.provenance.json', import.meta.url);
const ADAPTER = new URL('../library/contextualCoreAdapter.ts', import.meta.url);
const CARD = new URL('../components/LibrarySourceCard.tsx', import.meta.url);

const EXPECTED_SOURCE_COMMIT = '404db9ebf12fe669181f4d503110b04221684212';
const EXPECTED_DISTRIBUTION_COMMIT = '8c47c34048acc943a1f4a2067b29629eb880e7ef';
const EXPECTED_HASHES: Record<string, string> = {
  'README.md': '07f33f65d1c018099707eafde5615e7a06a575a3e4f43e6bb29cf1c18b53f2c7',
  'index.d.ts': 'fc283715c43c9400dabfd29e4a4aad2bac41aa60d234f31a4ea65845b4bc4b7d',
  'package.json': '5b826626dc93339fde1c469588ee9fc2f756ab248ecfae1689a0398bcd7e8af4',
  'src/index.js': '6926b47ba62a87a7c954560a8680d90dc423d1586960ffcbab42aeea4098968d'
};

const makeSource = (privacy: LibrarySource['privacy'] = 'unknown'): LibrarySource => ({
  id: 'source-1',
  kind: 'note',
  title: 'Fonte sintetica privata',
  capturedAt: '2026-10-24T12:00:00.000Z',
  origin: 'fixture locale',
  sourceUrl: 'https://example.test/private',
  payload: { text: 'CONTENUTO_PRIVATO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT' },
  extractedText: 'ESTRATTO_PRIVATO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT',
  status: 'ready',
  privacy,
  links: [{ targetType: 'uda', targetId: 'uda-existing' }],
  notes: 'NOTA_PRIVATA_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT'
});

async function sha256(url: URL): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(url).arrayBuffer());
  return createHash('sha256').update(bytes).digest('hex');
}

describe('LIB-01B shared Contextual Copilot Core integration', () => {
  test('vendors exactly the qualified Core package and binds it to immutable provenance', async () => {
    expect(await Bun.file(PROVENANCE).exists()).toBe(true);
    const provenance = await Bun.file(PROVENANCE).json();
    expect(provenance.schemaVersion).toBe('registro.contextual-copilot-core-vendor/v1');
    expect(provenance.package).toEqual({ name: '@trama/contextual-copilot-core', version: '0.2.0' });
    expect(provenance.source).toEqual({
      repository: 'antoniocorsano-boop/trama-ecosistema',
      commit: EXPECTED_SOURCE_COMMIT,
      distributionCommit: EXPECTED_DISTRIBUTION_COMMIT,
      path: 'shared/contextual-copilot-core'
    });

    for (const [path, digest] of Object.entries(EXPECTED_HASHES)) {
      const file = new URL(path, VENDOR_ROOT);
      expect(await Bun.file(file).exists()).toBe(true);
      expect(await sha256(file)).toBe(digest);
    }

    const packageJson = await Bun.file(ROOT_PACKAGE).json();
    expect(packageJson.dependencies['@trama/contextual-copilot-core']).toBe('file:vendor/contextual-copilot-core');
    const lock = await Bun.file(ROOT_LOCK).text();
    expect(lock).toContain('"@trama/contextual-copilot-core": "file:vendor/contextual-copilot-core"');
  });

  test('builds a minimal fail-closed ContextSnapshot without source content', async () => {
    expect(await Bun.file(ADAPTER).exists()).toBe(true);
    const { buildLibraryContextSnapshot } = await import('../library/contextualCoreAdapter');
    const context = buildLibraryContextSnapshot(makeSource('unknown'));

    expect(context.appId).toBe('registro-docente');
    expect(context.surface).toBe('LIBRARY_SOURCE');
    expect(context.capabilities).toEqual(['REVIEW', 'LINK', 'PREPARE', 'SUMMARIZE']);
    expect(context.privacy.remoteProviderAllowed).toBe(false);
    expect(context.privacy.dataClasses).toEqual(['STUDENT_PERSONAL']);
    expect(context.entities).toEqual([{
      type: 'library-source',
      id: 'source-1',
      kind: 'note',
      status: 'ready',
      privacy: 'unknown',
      linkCount: 1
    }]);

    const serialized = JSON.stringify(context);
    for (const forbidden of [
      'CONTENUTO_PRIVATO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT',
      'ESTRATTO_PRIVATO_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT',
      'NOTA_PRIVATA_NON_DEVE_ENTRARE_NEL_CONTEXT_SNAPSHOT',
      'https://example.test/private',
      'Fonte sintetica privata'
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test('uses the shared resolver and hides generative actions while no provider is authorized', async () => {
    const { resolveLibraryContextActions } = await import('../library/contextualCoreAdapter');
    const actions = await resolveLibraryContextActions(makeSource('teacher-professional'));
    expect(actions.map((action: { id: string }) => action.id)).toEqual([
      'review-source',
      'link-source-to-uda'
    ]);
  });

  test('keeps LINK behind the Core human-confirmation gate', async () => {
    const { dispatchLibraryContextAction } = await import('../library/contextualCoreAdapter');
    let executions = 0;
    const source = makeSource('teacher-professional');

    const pending = await dispatchLibraryContextAction({
      source,
      actionId: 'link-source-to-uda',
      executor: async () => {
        executions += 1;
        return { linked: true };
      }
    });
    expect(pending.status).toBe('HUMAN_CONFIRMATION_REQUIRED');
    expect(executions).toBe(0);

    const accepted = await dispatchLibraryContextAction({
      source,
      actionId: 'link-source-to-uda',
      humanConfirmed: true,
      executor: async () => {
        executions += 1;
        return { linked: true };
      }
    });
    expect(accepted.status).toBe('EXECUTED');
    expect(executions).toBe(1);
  });

  test('progressively reveals only Core-resolved actions after Usa', async () => {
    const card = await Bun.file(CARD).text();
    expect(card).toContain('resolveLibraryContextActions');
    expect(card).toContain('dispatchLibraryContextAction');
    expect(card).toContain('Che cosa vuoi farne?');
    expect(card).toContain('isSelected &&');
    expect(card).not.toContain('Funzioni contestuali disponibili con il copilota');
  });
});
