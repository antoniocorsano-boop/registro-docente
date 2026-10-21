import { describe, expect, test } from 'bun:test';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

async function listFiles(root: string): Promise<string[]> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(root, entry.name);
        if (entry.isDirectory()) return listFiles(fullPath);
        return [fullPath.replaceAll('\\', '/')];
      })
    );
    return nested.flat().sort();
  } catch (error: any) {
    if (error?.code === 'ENOENT') return [];
    throw error;
  }
}

describe('PREDEPLOY repository and static-asset hygiene', () => {
  test('does not publish AI Studio scratch assets from public/', async () => {
    const files = await listFiles('public/assets/aistudio');
    expect(files).toEqual([]);
  });

  test('does not track AI Studio temporary media artifacts', async () => {
    const files = await listFiles('.aistudio');
    const tempMedia = files.filter((file) => file.includes('/.tempmediaStorage/'));
    expect(tempMedia).toEqual([]);
  });
});
