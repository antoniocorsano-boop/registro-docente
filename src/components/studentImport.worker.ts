import { parseStudentImport } from './studentImport';
import type { StudentImportFormat } from './studentImportLimits';

self.onmessage = ({ data }: MessageEvent<{ buffer: ArrayBuffer; format: StudentImportFormat; existingNames: string[] }>) => {
  try {
    self.postMessage({ names: parseStudentImport(data.buffer, data.format, data.existingNames) });
  } catch {
    self.postMessage({ failed: true });
  }
};
