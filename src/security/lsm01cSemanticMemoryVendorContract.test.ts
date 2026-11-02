import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';

const VENDOR_ROOT = new URL('../../vendor/contextual-copilot-semantic-memory/', import.meta.url);
const PROVENANCE = new URL('../../vendor/contextual-copilot-semantic-memory.provenance.json', import.meta.url);

async function readIfExists(url: URL): Promise<string> {
  const file = Bun.file(url);
  return await file.exists() ? file.text() : '';
}

async function sha256(url: URL): Promise<string> {
  const bytes = Buffer.from(await Bun.file(url).arrayBuffer());
  return createHash('sha256').update(bytes).digest('hex');
}

describe('LSM-01C-A shared semantic-memory vendor contract', () => {
  test('vendors the exact qualified TRAMA semantic memory package without registry or lockfile coupling', async () => {
    const provenanceText = await readIfExists(PROVENANCE);
    const readmeUrl = new URL('README.md', VENDOR_ROOT);
    const declarationsUrl = new URL('index.d.ts', VENDOR_ROOT);
    const packageUrl = new URL('package.json', VENDOR_ROOT);
    const runtimeUrl = new URL('src/index.js', VENDOR_ROOT);
    const readme = await readIfExists(readmeUrl);
    const packageText = await readIfExists(packageUrl);
    const declarations = await readIfExists(declarationsUrl);
    const runtime = await readIfExists(runtimeUrl);

    expect(readme).toContain('derived');
    expect(packageText).toContain('"name": "@trama/contextual-copilot-semantic-memory"');
    expect(packageText).toContain('"version": "0.1.0"');
    expect(declarations).toContain('LocalSemanticMemoryPort');
    expect(declarations).toContain('validateSemanticMemoryProjection');
    expect(runtime).toContain('export function validateSemanticMemoryProjection');
    expect(runtime).toContain('export function validateSemanticMemoryHealth');

    expect(await sha256(readmeUrl)).toBe('3b171c79c1ab8080bedccff2c89f4d555c90b76886aa6af503158d3bbfe2ad76');
    expect(await sha256(declarationsUrl)).toBe('08dbcdacbc74509efa896c52fd9dbf176741589e684e78b0e8d8320a354d9696');
    expect(await sha256(packageUrl)).toBe('49795e6bbe91ddc521b7b06eba4fc13f49d836e8f038da056d8ccaa0221a4a04');
    expect(await sha256(runtimeUrl)).toBe('5be6d22caeab3d6052cf0a2efb5a44c30d4dd60125a3b12820c59543b0edd676');

    expect(provenanceText).toContain('fc85d33fd0e9ef3f452f3c823027a0b2b9a74808');
    expect(provenanceText).toContain('shared/contextual-copilot-semantic-memory');
    expect(provenanceText).toContain('"consumerMode": "vendored-file-package"');
    expect(provenanceText).toContain('"networkRequiredAtBuild": false');
    expect(provenanceText).toContain('"externalRegistryRequired": false');
    expect(provenanceText).toContain('3b171c79c1ab8080bedccff2c89f4d555c90b76886aa6af503158d3bbfe2ad76');
    expect(provenanceText).toContain('08dbcdacbc74509efa896c52fd9dbf176741589e684e78b0e8d8320a354d9696');
    expect(provenanceText).toContain('49795e6bbe91ddc521b7b06eba4fc13f49d836e8f038da056d8ccaa0221a4a04');
    expect(provenanceText).toContain('5be6d22caeab3d6052cf0a2efb5a44c30d4dd60125a3b12820c59543b0edd676');

    const shared = await import('../../vendor/contextual-copilot-semantic-memory/src/index.js');
    expect(typeof shared.validateSemanticMemoryProjection).toBe('function');
    expect(typeof shared.validateSemanticMemoryHealth).toBe('function');
  });
});
