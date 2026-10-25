import { describe, expect, test } from 'bun:test';

const ROOT_PACKAGE = new URL('../../package.json', import.meta.url);
const ROOT_LOCK = new URL('../../bun.lock', import.meta.url);
const VENDOR_ROOT = new URL('../../vendor/contextual-copilot-intent-embedding/', import.meta.url);
const PROVENANCE = new URL('../../vendor/contextual-copilot-intent-embedding.provenance.json', import.meta.url);
const EMBEDDING = new URL('../library/localIntentEmbedding.ts', import.meta.url);
const CATALOG = new URL('../library/libraryIntentCatalog.ts', import.meta.url);
const ADAPTER = new URL('../library/contextualCoreAdapter.ts', import.meta.url);
const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);

async function readIfExists(url: URL): Promise<string> {
  const file = Bun.file(url);
  return await file.exists() ? file.text() : '';
}

describe('LIB-06A local intent discovery consumer contract', () => {
  test('vendors the qualified TRAMA intent embedding package as a local dependency', async () => {
    const rootPackage = await Bun.file(ROOT_PACKAGE).json();
    const rootLock = await Bun.file(ROOT_LOCK).text();
    const provenanceText = await readIfExists(PROVENANCE);
    const packageText = await readIfExists(new URL('package.json', VENDOR_ROOT));
    const declarations = await readIfExists(new URL('index.d.ts', VENDOR_ROOT));
    const runtime = await readIfExists(new URL('src/index.js', VENDOR_ROOT));

    expect(rootPackage.dependencies?.['@trama/contextual-copilot-intent-embedding'])
      .toBe('file:vendor/contextual-copilot-intent-embedding');
    expect(rootLock).toContain('"@trama/contextual-copilot-intent-embedding": "file:vendor/contextual-copilot-intent-embedding"');
    expect(rootLock).toContain('"@trama/contextual-copilot-intent-embedding@file:vendor/contextual-copilot-intent-embedding"');
    expect(packageText).toContain('"name": "@trama/contextual-copilot-intent-embedding"');
    expect(packageText).toContain('"version": "0.1.0"');
    expect(declarations).toContain('createEmbeddingIntentPort');
    expect(runtime).toContain('export function createEmbeddingIntentPort');

    expect(provenanceText).toContain('4cd5d41176a63f15939162b7c33275fbb4130ac5');
    expect(provenanceText).toContain('13aeba119ce041850ac78ce97c0d19d58a179b4f');
    expect(provenanceText).toContain('84d5220832578cd9fa01cd372dfb833f5a2a003799b9078e5cc0fc05fb9ed3dd');
    expect(provenanceText).toContain('f2c7d425f37cc525f6cabb671c0dc4ec36896ef7f76fb348fabb9791af21d403');
    expect(provenanceText).toContain('c0eb015cfc7ee7f649edbb8bab39e3986810e48d18b2a7ee596aa6c173ff09ac');
    expect(provenanceText).toContain('edcf38132434b90294012b9bff5ab20e2c750d4757877f5b16c58aa20d69ab39');
  });

  test('keeps embedding local and the intent catalog consumer-owned', async () => {
    const embedding = await readIfExists(EMBEDDING);
    const catalog = await readIfExists(CATALOG);

    expect(embedding).toContain('export async function embedLocalIntentText');
    expect(embedding).not.toContain('fetch(');
    expect(embedding).not.toContain('http://');
    expect(embedding).not.toContain('https://');

    expect(catalog).toContain("actionId: 'review-source'");
    expect(catalog).toContain("actionId: 'link-source-to-uda'");
    expect(catalog).toContain("actionId: 'prepare-from-source'");
    expect(catalog).not.toContain("actionId: 'summarize-source'");
  });

  test('injects local intent discovery while preserving Core authority', async () => {
    const adapter = await readIfExists(ADAPTER);

    expect(adapter).toContain("from '@trama/contextual-copilot-intent-embedding'");
    expect(adapter).toContain('createEmbeddingIntentPort');
    expect(adapter).toContain('intentPort: libraryIntentPort');
    expect(adapter).toContain('export function discoverLibraryCopilotIntent');
    expect(adapter).toContain('.discoverRequestIntent(buildLibraryCopilotRequest(input))');
    expect(adapter).not.toContain("'SUMMARIZE'\n]);");
  });

  test('routes PREPARE only to the existing proposal handoff and leaves LINK governed', async () => {
    const composer = await readIfExists(COMPOSER);

    expect(composer).toContain('discoverLibraryCopilotIntent');
    expect(composer).toContain("intent.actionId === 'prepare-from-source'");
    expect(composer).toContain('setIsPrepareOpen(true)');
    expect(composer).toContain('resolveLibraryCopilotRequest');
    expect(composer).toContain("actionId: 'link-source-to-uda'");
    expect(composer).toContain('humanConfirmed: false');
    expect(composer).toContain('humanConfirmed: true');
    expect(composer).not.toContain("from '../services/libraryProposalService'");
    expect(composer).not.toContain("from '../library/teachingProposal'");
  });
});
