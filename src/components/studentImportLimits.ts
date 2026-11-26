export type StudentImportFormat = 'xls' | 'xlsx' | 'csv';

// One class fits well below these limits. Read one extra row to detect overflow.
export const STUDENT_IMPORT_LIMITS = { bytes: 2 * 1024 * 1024, rows: 1000, columns: 128 } as const;

export function studentImportFormat(name: string, size: number): StudentImportFormat {
  const format = name.split('.').length > 1 ? name.split('.').pop()?.toLowerCase() : undefined;
  if (format !== 'xls' && format !== 'xlsx' && format !== 'csv') throw new Error('FORMAT');
  if (!size || size > STUDENT_IMPORT_LIMITS.bytes) throw new Error('SIZE');
  return format;
}
