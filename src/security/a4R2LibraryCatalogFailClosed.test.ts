import { describe, expect, test } from 'bun:test';

const CARD = new URL('../components/LibrarySourceCard.tsx', import.meta.url);

describe('A4-R2B Biblioteca unified-catalog fail-closed boundary', () => {
  test('catalog-excluded local UDA cannot reappear through automatic context or relevance suggestions', async () => {
    const card = await Bun.file(CARD).text();

    expect(card).toContain("const selectableLocalUdas = udas.filter(uda =>");
    expect(card).toContain("candidate.origin === 'registro' && candidate.id === uda.id");
    expect(card).toContain('udas: selectableLocalUdas,');
    expect(card).toContain('udas={selectableLocalUdas}');
  });
});
