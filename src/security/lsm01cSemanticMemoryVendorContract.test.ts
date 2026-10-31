import { describe, expect, test } from 'bun:test';

const ROOT_PACKAGE = new URL('../../package.json', import.meta.url);
const ROOT_LOCK = new URL('../../bun.lock', import.meta.url);
const VENDOR_ROOT = new URL('../../vendor/contextual-copilot-semantic-memory/', import.meta.url);
const PROVENANCE = new URL('../../vendor/contextual-copilot-semantic-memory.provenance.json', import.meta.url);

async function readIfExists(url: URL): Promise<string> {
  const file = Bun.file(url);
  return await file.exists() ? file.text() : '';
}

describe('LSM-01C-A shared semantic-memory vendor contract', () => {
  test('vendors the qualified TRAMA semantic memory package as a local dependency', async () => {
    const rootPackage = await Bun.file(ROOT_PACKAGE).json();
    const rootLock = await Bun.file(ROOT_LOCK).text();
    const provenanceText = await readIfExists(PROVENANCE);
    const readme = await readIfExists(new URL('README.md', VENDOR_ROOT));
    const packageText = await readIfExists(new URL('package.json', VENDOR_ROOT));
    const declarations = await readIfExists(new URL('index.d.ts', VENDOR_ROOT));
    const runtime = await readIfExists(new URL('src/index.js', VENDOR_ROOT));

    expect(rootPackage.dependencies?.['@trama/contextual-copilot-semantic-memory'])
      .toBe('file:vendor/contextual-copilot-semantic-memory');
    expect(rootLock).toContain('"@trama/contextual-copilot-semantic-memory": "file:vendor/contextual-copilot-semantic-memory"');
    expect(rootLock).toContain('"@trama/contextual-copilot-semantic-memory@file:vendor/contextual-copilot-semantic-memory"');

    expect(readme).toContain('derived');
    expect(packageText).toContain('"name": "@trama/contextual-copilot-semantic-memory"');
    expect(packageText).toContain('"version": "0.1.0"');
    expect(declarations).toContain('LocalSemanticMemoryPort');
    expect(declarations).toContain('validateSemanticMemoryProjection');
    expect(runtime).toContain('export function validateSemanticMemoryProjection');
    expect(runtime).toContain('export function validateSemanticMemoryHealth');

    expect(provenanceText).toContain('fc85d33fd0e9ef3f452f3c823027a0b2b9a74808');
    expect(provenanceText).toContain('shared/contextual-copilot-semantic-memory');
    expect(provenanceText).toContain('"consumerMode": "vendored-file-package"');
    expect(provenanceText).toContain('"networkRequiredAtBuild": false');
    expect(provenanceText).toContain('"externalRegistryRequired": false');
    expect(provenanceText).toContain('3b171c79c1ab8080bedccff2c89f4d555c90b76886aa6af503158d3bbfe2ad76');
    expect(provenanceText).toContain('08dbcdacbc74509efa896c52fd9dbf176741589e684e78b0e8d8320a354d9696');
    expect(provenanceText).toContain('49795e6bbe91ddc521b7b06eba4fc13f49d836e8f038da056d8ccaa0221a4a04');
    expect(provenanceText).toContain('5be6d22caeab3d6052cf0a2efb5a44c30d4dd60125a3b12820c59543b0edd676');
  });
});
