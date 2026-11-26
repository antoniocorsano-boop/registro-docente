import { describe, expect, test } from 'bun:test';
import * as XLSX from 'xlsx';
import { readFileSync } from "node:fs";
import { parseStudentImport } from '../components/studentImport';
import { STUDENT_IMPORT_LIMITS, studentImportFormat } from '../components/studentImportLimits';

function workbook(rows: string[][], bookType: 'xls' | 'xlsx' | 'xlsm' | 'csv'): ArrayBuffer {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Classe');
  return XLSX.write(book, { bookType, type: 'array' });
}

describe('R1-06-01 student roster import', () => {
  test('uses the official SheetJS distribution and locked integrity', () => {
    const url = 'https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz';
    const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(XLSX.version).toBe('0.20.3');
    expect(manifest.dependencies.xlsx).toBe(url);
    const lock = readFileSync('bun.lock', 'utf8');
    expect(lock).toContain(url);
    expect(lock).toContain('sha512-oLDq3jw7AcLqKWH2AhCpVTZl8mf6X2YReP+Neh0SJUzV/BdZYjth94tG5toiMB1PPrYtxOCfaoUCkvtuH+3AJA==');
    expect(lock).not.toContain('xlsx@0.18.5');
  });

  for (const format of ['xls', 'xlsx', 'csv'] as const) {
    test(`imports normalized, sorted names once from ${format}`, () => {
      const file = workbook([
        ['Cognome e Nome'], ['  Zeta   Àda '], ['Alfa D’Anna'], ['alfa d\'anna'], ['SERRA LIA'],
      ], format);
      expect(parseStudentImport(file, format, ['Serra Lia'])).toEqual(['Alfa D\'Anna', 'Zeta Àda']);
    });
  }

  test('rejects unsupported extensions, invalid bytes, mismatches and oversized inputs', () => {
    expect(studentImportFormat('roster.XLSX', 123)).toBe('xlsx');
    expect(() => studentImportFormat('roster.xlsm', 123)).toThrow();
    expect(() => studentImportFormat('roster.csv', STUDENT_IMPORT_LIMITS.bytes + 1)).toThrow();
    expect(() => parseStudentImport(new Uint8Array([0, 1, 2, 3]).buffer, 'csv', [])).toThrow();
    expect(() => parseStudentImport(workbook([['Alfa Ada']], 'xlsx'), 'xls', [])).toThrow();
    expect(() => parseStudentImport(workbook([['Alfa Ada']], 'xlsm'), 'xlsx', [])).toThrow();
    expect(() => parseStudentImport(new TextEncoder().encode('<html>Alfa Ada</html>').buffer, 'csv', [])).toThrow();
    expect(() => parseStudentImport(new TextEncoder().encode('"Alfa Ada').buffer, 'csv', [])).toThrow();
  });

  for (const format of ['xls', 'xlsx', 'csv'] as const) {
    test(`rejects excess rows instead of accepting a partial ${format} roster`, () => {
      const rows = Array.from({ length: STUDENT_IMPORT_LIMITS.rows + 1 }, () => ['Alfa Ada']);
      expect(() => parseStudentImport(workbook(rows, format), format, [])).toThrow();
    });
  }
});
