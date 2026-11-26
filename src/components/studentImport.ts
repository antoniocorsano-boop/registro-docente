import { read, utils, type WorkBook } from 'xlsx';
import { sanitizeName, sortStudents } from '../utils';

import { STUDENT_IMPORT_LIMITS, studentImportFormat, type StudentImportFormat } from './studentImportLimits';

function csvText(bytes: Uint8Array): string {
  let text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) text = new TextDecoder('utf-16le', { fatal: true }).decode(bytes);
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) text = new TextDecoder('utf-16be', { fatal: true }).decode(bytes);
  else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { text = new TextDecoder('windows-1252').decode(bytes); }
  }

  const invalidControls = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/.test(text);
  if (!text.trim() || invalidControls || /^\s*(?:[<{\[]|ID;P|TABLE\r?$)/im.test(text)) throw new Error('FORMAT');

  // Count records before SheetJS allocates a sheet. Quoted newlines and escaped quotes are data.
  const data = text.replace(/^sep=[,;\t]\r?\n/i, '').replace(/(?:\r\n|\r|\n)+$/, '');
  let quoted = false;
  let rows = 1;
  for (let index = 0; index < data.length; index++) {
    const character = data[index];
    if (character === '"') quoted = !quoted;
    if (quoted || (character !== '\n' && character !== '\r')) continue;
    if (character === '\r' && data[index + 1] === '\n') index++;
    if (++rows > STUDENT_IMPORT_LIMITS.rows) throw new Error('ROWS');
  }
  if (quoted) throw new Error('FORMAT');
  return text;
}

// Check the ZIP directory before SheetJS expands XLSX entries. Roster sheets
// need neither multi-disk/ZIP64 archives nor more than 16 MiB of expanded data.
function checkXlsxDirectory(buffer: ArrayBuffer): void {
  const view = new DataView(buffer);
  const u16 = (offset: number) => view.getUint16(offset, true);
  const u32 = (offset: number) => view.getUint32(offset, true);
  let end = buffer.byteLength - 22;
  const earliest = Math.max(0, end - 65535);
  while (end >= earliest && (u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== buffer.byteLength)) end--;
  if (end < earliest || u16(end + 4) || u16(end + 6) || u16(end + 8) !== u16(end + 10)) throw new Error('FORMAT');
  const entries = u16(end + 10);
  let offset = u32(end + 16);
  if (!entries || entries > 256 || offset + u32(end + 12) !== end) throw new Error('FORMAT');
  let expanded = 0;
  for (let entry = 0; entry < entries; entry++) {
    if (offset + 46 > end || u32(offset) !== 0x02014b50) throw new Error('FORMAT');
    expanded += u32(offset + 24);
    if (expanded > 16 * 1024 * 1024) throw new Error('SIZE');
    offset += 46 + u16(offset + 28) + u16(offset + 30) + u16(offset + 32);
  }
  if (offset !== end) throw new Error('FORMAT');
}

function readStudentWorkbook(buffer: ArrayBuffer, format: StudentImportFormat): WorkBook {
  const bytes = new Uint8Array(buffer);
  const options = { sheets: 0, sheetRows: STUDENT_IMPORT_LIMITS.rows + 1, cellFormula: false, cellHTML: false };
  if (format === 'csv') return read(csvText(bytes), { ...options, type: 'string', raw: true });

  const signature = (expected: number[]) => expected.every((byte, index) => bytes[index] === byte);
  const ole = signature([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  const biff = bytes[0] === 0x09 && [0x00, 0x02, 0x04, 0x08].includes(bytes[1]);
  const zip = signature([0x50, 0x4b, 0x03, 0x04]);
  if (format === 'xlsx' ? !zip : !ole && !biff) throw new Error('FORMAT');

  if (format === 'xlsx') checkXlsxDirectory(buffer);
  const workbook = read(bytes, { ...options, type: 'array', bookFiles: format === 'xlsx' });
  const { bookType, files } = workbook as WorkBook & {
    bookType?: string; files?: Record<string, { content?: Uint8Array }>;
  };
  if (format === 'xlsx') {
    const types = files?.['[Content_Types].xml']?.content;
    if (!types || !new TextDecoder().decode(types).includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml') ||
        Object.keys(files ?? {}).some(path => /(?:^|\/)vbaProject\.bin$/i.test(path))) throw new Error('FORMAT');
  }
  if (format === 'xlsx' ? bookType !== 'xlsx' : bookType === 'xlsx' || bookType === 'xlsb') {
    throw new Error('FORMAT');
  }
  return workbook;
}

export function parseStudentImport(buffer: ArrayBuffer, format: StudentImportFormat, existingNames: string[]): string[] {
  studentImportFormat(`roster.${format}`, buffer.byteLength);
  const workbook = readStudentWorkbook(buffer, format);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet?.['!ref']) throw new Error('FORMAT');
  const range = utils.decode_range(sheet['!fullref'] ?? sheet['!ref']);
  if (range.e.r >= STUDENT_IMPORT_LIMITS.rows) throw new Error('ROWS');
  if (range.e.c >= STUDENT_IMPORT_LIMITS.columns) throw new Error('COLUMNS');

  const seen = new Set(existingNames.map(name => sanitizeName(name).toLowerCase()));
  const students = [];
  for (const row of utils.sheet_to_json<unknown[]>(sheet, { header: 1 })) {
    const cell = row.find((value): value is string => typeof value === 'string' && /[A-Za-zÀ-ÿ]{2}/.test(value));
    if (!cell) continue;
    const name = sanitizeName(cell);
    const key = name.toLowerCase();
    if (name.length <= 3 || key.includes('nome') || key.includes('cognome') || seen.has(key)) continue;
    seen.add(key);
    students.push({ id: key, name });
  }
  return sortStudents(students).map(student => student.name);
}
