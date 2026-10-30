import { describe, expect, test } from 'bun:test';
import { previewDocenteOsTeachingProjection } from '../planning/docenteOsTeachingProjection';

type NegativeCase = {
  id: string;
  expectedCode: string;
  payload: unknown;
};

const fixturePath = 'docs/contracts/fixtures/docente-os-registro-teaching-projection-v1.json';
const negativeCorpusPath = 'docs/contracts/fixtures/docente-os-registro-teaching-projection-v1-negative-corpus.json';

async function readJson(path: string): Promise<unknown> {
  return Bun.file(path).json();
}

describe('A4-R2B Docente OS teaching projection consumer contract', () => {
  test('accepts the exact frozen producer fixture without persisting or accepting it', async () => {
    const fixture = await readJson(fixturePath);

    const result = previewDocenteOsTeachingProjection(fixture);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.projection).toEqual(fixture);
    expect(Object.keys(result).sort()).toEqual(['ok', 'projection']);
  });

  test('rejects every frozen producer-negative case with the same stable error code', async () => {
    const corpus = (await readJson(negativeCorpusPath)) as {
      schema: string;
      cases: NegativeCase[];
    };

    expect(corpus.schema).toBe('docente-os-registro-teaching-projection-negative-corpus/v1');
    expect(corpus.cases.length).toBeGreaterThan(0);

    for (const entry of corpus.cases) {
      const result = previewDocenteOsTeachingProjection(entry.payload);
      expect(result.ok, entry.id).toBe(false);
      if (result.ok) continue;
      expect(result.code, entry.id).toBe(entry.expectedCode);
    }
  });

  test('rejects a structurally valid payload whose content no longer matches its fingerprint', async () => {
    const fixture = (await readJson(fixturePath)) as Record<string, any>;
    const tampered = structuredClone(fixture);
    tampered.classes[0].udas[0].title = 'Titolo alterato dopo export';

    const result = previewDocenteOsTeachingProjection(tampered);

    expect(result).toMatchObject({ ok: false, code: 'FINGERPRINT_MISMATCH' });
  });
});
