import { describe, expect, test } from 'bun:test';
import {
  assertV6AssessmentExportAllowed,
  assertHistoricalAssessmentRestoreAllowed,
  containsAssessmentEvidenceV7
} from './ap02LegacyBackupBoundary';

const withoutEvidence = () => ({
  classes: [{ id: 'synthetic-class', students: [{ id: 'synthetic-student' }], grades: [] }],
  currentClassId: 'synthetic-class'
});
const withEvidence = () => {
  const data = withoutEvidence() as ReturnType<typeof withoutEvidence> & {
    classes: Array<ReturnType<typeof withoutEvidence>['classes'][number] & { assessmentEvidenceV1?: unknown }>;
  };
  data.classes[0].assessmentEvidenceV1 = {
    version: 1, documents: [{ document: { schoolYear: '2026/2027' }, bindings: [] }]
  };
  return data;
};

describe('AUDIT-PRE-01/AP-02 — active historical V6 fail-closed boundary', () => {
  test('ordinary V6 archive remains exportable without V7 evidence', () => {
    expect(() => assertV6AssessmentExportAllowed(withoutEvidence())).not.toThrow();
    expect(() => assertHistoricalAssessmentRestoreAllowed(withoutEvidence(), {
      app: 'registro-docente', backupDataVersion: 6, snapshot: { appData: withoutEvidence() }
    })).not.toThrow();
  });
  test('confirmed, malformed or empty V7 domain cannot be represented as a complete V6 copy', () => {
    for (const value of [withEvidence(), {
      classes: [{ id: 'synthetic-class', assessmentEvidenceV1: null }]
    }, { classes: [{ id: 'synthetic-class', assessmentEvidenceV1: { version: 1, documents: [] } }] }]) {
      expect(containsAssessmentEvidenceV7(value)).toBe(true);
      expect(() => assertV6AssessmentExportAllowed(value)).toThrow(/V7/);
    }
  });
  test('older copy cannot overwrite an archive containing V7 evidence, even if source is otherwise valid', () => {
    expect(() => assertHistoricalAssessmentRestoreAllowed(withEvidence(), {
      app: 'registro-docente', backupDataVersion: 6, snapshot: { appData: withoutEvidence() }
    })).toThrow(/ripristino storico/i);
  });
  test('V6 version forgery and legacy aliases cannot smuggle a V7 domain', () => {
    const original = withEvidence();
    for (const source of [
      { app: 'registro-docente', backupDataVersion: 6, snapshot: { appData: original } },
      { app: 'registro-docente', classes: original.classes },
      { app: 'registro-docente', data: original },
      { app: 'registro-docente', backupDataVersion: 7, snapshot: { appData: original } }
    ]) {
      expect(() => assertHistoricalAssessmentRestoreAllowed(withoutEvidence(), source)).toThrow();
    }
  });
  test('untrusted accessors are not executed and cyclic inputs fail closed', () => {
    let invoked = false;
    const untrusted = { classes: [] as unknown[] };
    Object.defineProperty(untrusted, 'unsafe', { enumerable: true, get() { invoked = true; return null; } });
    expect(containsAssessmentEvidenceV7(untrusted)).toBe(true);
    expect(invoked).toBe(false);
    const cycle: { nested?: unknown } = {};
    cycle.nested = cycle;
    expect(containsAssessmentEvidenceV7(cycle)).toBe(true);
  });
  test('the production app applies the gate before issuing receipts and before normalization', async () => {
    const code = await Bun.file('src/App.tsx').text();
    const exportCode = code.slice(code.indexOf('const prepareEncryptedBackup ='), code.indexOf('const bindBackupEvidence ='));
    expect(exportCode.indexOf('assertV6AssessmentExportAllowed(appDataRef.current)'))
      .toBeLessThan(exportCode.indexOf('backupReceiptAuthority.issue('));
    const importCode = code.slice(code.indexOf('const handleImportEncryptedBackup ='), code.indexOf('const handleFactoryReset ='));
    expect(importCode.indexOf('assertHistoricalAssessmentRestoreAllowed(previousLogical.appData, decryptedData)'))
      .toBeLessThan(importCode.indexOf('normalizeBackupPayloadVerified(decryptedData, previousLogical)'));
    expect(importCode.indexOf('normalizeBackupPayloadVerified(decryptedData, previousLogical)'))
      .toBeLessThan(importCode.indexOf('secureStorage.restoreSnapshotVerified(candidate, previousLogical)'));
  });
});
