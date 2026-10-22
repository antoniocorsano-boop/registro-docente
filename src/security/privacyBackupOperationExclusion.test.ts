import { describe, expect, test } from 'bun:test';

function sectionBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe('PERSIST-01H encrypted backup operation exclusion', () => {
  test('export and restore cannot overlap while either operation is pending', async () => {
    const source = await Bun.file('src/components/PrivacyView.tsx').text();
    const exportHandler = sectionBetween(source, 'const handleExportEncrypted', 'const handleImportEncrypted');
    const importHandler = sectionBetween(source, 'const handleImportEncrypted', '  return (');

    expect(source).toContain('backupOperationPendingRef');

    expect(exportHandler).toContain('if (backupOperationPendingRef.current) return;');
    expect(exportHandler).toContain('backupOperationPendingRef.current = true;');
    expect(exportHandler).toContain('backupOperationPendingRef.current = false;');

    expect(importHandler).toContain('if (backupOperationPendingRef.current) return;');
    expect(importHandler).toContain('backupOperationPendingRef.current = true;');
    expect(importHandler).toContain('backupOperationPendingRef.current = false;');

    expect(source.match(/disabled=\{isEncrypting \|\| isDecrypting\}/g)?.length).toBe(2);
  });
});
