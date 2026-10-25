import { createHash } from 'node:crypto';
import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from '../library/types';

const VENDOR_ROOT = new URL('../../vendor/contextual-copilot-core/', import.meta.url);
const PROVENANCE = new URL('../../vendor/contextual-copilot-core.provenance.json', import.meta.url);

const EXPECTED_SOURCE_COMMIT = 'a40e715a87d674db69364b50fa23f39a4b565ac4';
const EXPECTED_DISTRIBUTION_COMMIT = 'f5549b8a9cbbcd40752f8aa85183b3db23faf0ce';
const EXPECTED_HASHES: Record<string, string> = {
  'README.md': 'b512324bc498b2fc436037700784d3f6f6415ad062e95b257663033c310ff7a7',
  'index.d.ts': '10a3bedccdc7eb5c48e2f478d4b083fa3afaa787786346c606774e84d6448079',
  'package.json': '06464e314190f743e66b47395e2b86049e3c1a7d803e4c8cbad118034049d138',
  'src/index.js': '02ed409b30fdb0b76ab8923ae82986eda9ae63be0faa4af30a853978347178cb'
};

const makeSource = (): LibrarySource => ({
  id: 'source-core-03',
  kind: 'note',
  title: 'Fonte professionale sintetica',
  capturedAt: '2026-10-25T19:30:00.000Z',
  origin: 'fixture locale',
  payload: { text: 'Materiale professionale sintetico' },
  extractedText: 'Materiale professionale sintetico',
  status: 'ready',
  privacy: 'teacher-professional',
  links: []
});

async function sha256(url: URL): Promise<string> {
  const bytes = new Uint8Array(await Bun.file(url).arrayBuffer());
  return createHash('sha256').update(bytes).digest('hex');
}

describe('LIB-05B Core 0.3 consumer upgrade contract', () => {
  test('vendors exactly the qualified Core 0.3 package and provenance', async () => {
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
      expect(await sha256(new URL(path, VENDOR_ROOT))).toBe(digest);
    }
  });

  test('keeps the local executable action surface unchanged after the package upgrade', async () => {
    const { resolveLibraryContextActions } = await import('../library/contextualCoreAdapter');
    const actions = await resolveLibraryContextActions(makeSource());
    expect(actions.map((action: { id: string }) => action.id)).toEqual([
      'review-source',
      'link-source-to-uda'
    ]);
  });
});
