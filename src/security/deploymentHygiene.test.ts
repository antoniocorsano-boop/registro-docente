import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
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

function listTrackedFiles(root: string): string[] {
  const stdout = execFileSync('git', ['ls-files', '--', root], { encoding: 'utf8' });
  return stdout
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .sort();
}

describe('PREDEPLOY repository and static-asset hygiene', () => {
  test('does not publish AI Studio scratch assets from public/', async () => {
    const files = await listFiles('public/assets/aistudio');
    expect(files).toEqual([]);
  });

  test('does not track AI Studio temporary media artifacts', () => {
    const files = listTrackedFiles('.aistudio');
    const tempMedia = files.filter((file) => file.includes('/.tempmediaStorage/'));
    expect(tempMedia).toEqual([]);
  });

  test('ignored AI Studio temporary media is not treated as tracked', async () => {
    const fixtureDir = '.aistudio/artifacts/predeploy-fixture/.tempmediaStorage';
    const fixture = `${fixtureDir}/ignored.jpg`;
    await mkdir(fixtureDir, { recursive: true });
    await writeFile(fixture, 'ignored fixture');

    try {
      const files = listTrackedFiles('.aistudio');
      expect(files).not.toContain(fixture);
    } finally {
      await rm('.aistudio/artifacts/predeploy-fixture', { recursive: true, force: true });
    }
  });
});
