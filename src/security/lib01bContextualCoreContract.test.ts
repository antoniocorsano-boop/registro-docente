import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from '../library/types';

const ROOT_PACKAGE = new URL('../../package.json', import.meta.url);
const ROOT_LOCK = new URL('../../bun.lock', import.meta.url);
const VENDOR_ROOT = new URL('../../vendor/contextual-copilot-core/', import.meta.url);
const PROVENANCE = new URL('../../vendor/contextual-copilot-core.provenance.json', import.meta.url);
const ADAPTER = new URL('../library/contextualCoreAdapter.ts', import.meta.url);
const CARD = new URL('../components/LibrarySourceCard.tsx', import.meta.url);

const EXPECTED_SOURCE_COMMIT = 'a40e715a87d674db69364b50fa23f39a4b565ac4';
const EXPECTED_DISTRIBUTION_COMMIT = 'f5549b8a9cbbcd40752f8aa85183b3db23faf0ce';
const EXPECTED_HASHES: Record<string, string> = {
  'README.md': 'b512324bc498b2fc436037700784d3f6f6415ad062e95b257663033c310ff7a7',
  'index.d.ts': '10a3bedccdc7eb5c48e2f478d4b083fa3afaa787786346c606774e84d6448079',
  'package.json': '06464e314190f743e66b47395e2b86049e3c1a7d803e4c8cbad118034049d138',
  'src/index.js': '02ed409b30fdb0b76ab8923ae82986eda9ae63be0faa4af30a853978347178cb'
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
    expect(provenance.package).toEqual({ name: '@trama/contextual-copilot-core', version: '0.3.0' });
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
