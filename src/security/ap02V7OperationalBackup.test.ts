import { describe, expect, test } from 'bun:test';
import { createInitialArchiveSnapshot } from './initialArchiveSetup';
import { createVersionedBackupReceiptAuthority, verifiedBackupDateForVersion } from '../persistence/versionedBackupReceipt';
import { decryptDataWithPassword } from '../cryptoUtils';
import { projectAssessmentRestoreV7, selectApprovedScopesForIncomingV7Backup } from './assessmentRestorePolicy';
import { verifiedBackupDate } from '../persistence/backupCheckpoint';
import { createAssessmentBackupPayloadV7 } from './assessmentBackupPayload';

const stamp = '2026-11-22T20:00:00.000Z';
const password = 'ap02-synthetic-only';
const empty = () => createInitialArchiveSnapshot({
  mode: 'professional',
  profile: { school: 'Istituto sintetico', teacher: 'Docente sintetico', year: '2026/2027', subject: 'Tecnologia' }
});

describe('AUDIT-PRE-01/AP-02 — operational V7 export and conservative recovery contract', () => {
  test('a decrypted V7 copy is exact, and byte-verified copy receipts are version-bound and one-use', async () => {
    const archive = empty();
    const authority = createVersionedBackupReceiptAuthority(7);
    const prepared = await authority.prepare(archive, [], password, stamp);
    const decoded = await decryptDataWithPassword(prepared.encryptedText, password);
    expect(decoded.backupDataVersion).toBe(7);
    expect(decoded.snapshot.appData).toEqual(archive.appData);
    expect(decoded.snapshot.meta).toEqual({ changes: 0, lastBackup: stamp });
    expect(prepared.receipt.payloadVersion).toBe(7);
    expect(() => authority.consume(archive.meta, prepared.receipt, 7)).toThrow();
    // A rejected premature consumption revokes that grant by design.
    // Verify a newly prepared grant, never reuse the invalidated one.
    const fresh = await authority.prepare(archive, [], password, stamp);
    expect(await authority.verifyWeb(fresh.receipt, new Blob([fresh.encryptedText]), () => true)).toBe('verified');
    const saved = authority.consume(archive.meta, fresh.receipt, 7);
    expect(saved.verifiedBackupEvidence?.payloadVersion).toBe(7);
    expect(verifiedBackupDateForVersion(saved, 7)).toBe(stamp);
    expect(verifiedBackupDate(saved)).toBe(stamp);
    expect(verifiedBackupDateForVersion(saved, 6)).toBeNull();
    expect(verifiedBackupDate({ ...saved, verifiedBackupEvidence: {
      ...saved.verifiedBackupEvidence!, sha256: 'bad'
    } })).toBeNull();
    expect(verifiedBackupDate({ ...saved, verifiedBackupEvidence: {
      ...saved.verifiedBackupEvidence!, payloadVersion: 8 as 7
    } })).toBeNull();
    expect(() => authority.consume(archive.meta, fresh.receipt, 7)).toThrow();
  });

  test('V7 restore requires an authenticated exact current-state recovery, not a matching label', async () => {
    const archive = empty();
    const authority = createVersionedBackupReceiptAuthority(7);
    const prepared = await authority.prepare(archive, [], password, stamp);
    const copy = await decryptDataWithPassword(prepared.encryptedText, password);
    const result = await projectAssessmentRestoreV7(archive, copy, copy, [], []);
    expect(result.appData).toEqual(archive.appData);
    await expect(projectAssessmentRestoreV7(archive, copy, null, [], [])).rejects.toThrow();
    await expect(projectAssessmentRestoreV7(archive, { ...copy, backupDataVersion: 6 }, copy, [], [])).rejects.toThrow();
    const forgedRecovery = structuredClone(copy);
    forgedRecovery.snapshot.settings.school = 'Scuola diversa';
    await expect(projectAssessmentRestoreV7(archive, copy, forgedRecovery, [], [])).rejects.toThrow();
  });

  test('a prior V7 copy excludes classes added later without granting any new scope', async () => {
    const initial = empty();
    const earlierClass = { id: 'synthetic-A', name: 'Classe A', students: [], grades: [], behaviors: [] };
    const laterClass = { id: 'synthetic-B', name: 'Classe B', students: [], grades: [], behaviors: [] };
    const earlier = { ...initial, appData: { ...initial.appData, classes: [earlierClass] } };
    const current = { ...initial, appData: { ...initial.appData, classes: [earlierClass, laterClass] } };
    const approved = [
      { classId: earlierClass.id, schoolYear: '2026/2027', subjectCode: 'tecnologia' },
      { classId: laterClass.id, schoolYear: '2026/2027', subjectCode: 'tecnologia' }
    ];
    const imported = await createAssessmentBackupPayloadV7(earlier, [approved[0]], stamp);
    const recovery = await createAssessmentBackupPayloadV7(current, approved, stamp);

    // This was the functional AP-02 false rejection: approved scope B is
    // absent from the older import and validateAssessmentArchiveV1 rejects it.
    await expect(projectAssessmentRestoreV7(current, imported, recovery, approved, approved))
      .rejects.toThrow('Copia di sicurezza valutativa non valida');

    const inbound = selectApprovedScopesForIncomingV7Backup(imported, approved);
    expect(inbound).toEqual([approved[0]]);
    const result = await projectAssessmentRestoreV7(current, imported, recovery, approved, inbound);
    expect(result.appData.classes.map(c => c.id)).toEqual([earlierClass.id]);

    // A file cannot invent an approved class by declaring it in its own data.
    const unrelated = { ...imported, snapshot: {
      ...imported.snapshot, appData: { ...imported.snapshot.appData, classes: [
        { id: 'untrusted', name: 'Untrusted', students: [], grades: [], behaviors: [] }
      ] }
    } };
    expect(selectApprovedScopesForIncomingV7Backup(unrelated, approved)).toEqual([]);
    expect(() => selectApprovedScopesForIncomingV7Backup({ backupDataVersion: 7, snapshot: {
      appData: { classes: [{ id: earlierClass.id }, { id: earlierClass.id }] }
    } }, approved)).toThrow();
  });

  test('production App serializes V7 authority and restoration before persistent writing', async () => {
    const app = await Bun.file('src/App.tsx').text();
    const v7Export = app.slice(app.indexOf('const prepareAssessmentV7Backup ='), app.indexOf('// CDC-01: teacher-assigned council entry'));
    expect(v7Export).toContain('mutationCoordinator.enqueueTask');
    expect(v7Export).toContain('resolveApprovedAssessmentScopes(snapshot.appData, snapshot.planning, snapshot.settings)');
    expect(v7Export).toContain('assessmentBackupAuthority.prepare(');
    expect(v7Export).toContain('assessmentBackupAuthority.verifyWeb(');
    expect(v7Export).toContain('assessmentBackupAuthority.verifyAndroid(');
    // A real Android picker changes the native foreground epoch. Waiting for
    // that picker inside the durable mutation tail deadlocks Root's mandatory
    // pauseAndDrain before the fresh-password gate can be displayed.
    const nativeVerify = app.slice(
      app.indexOf('const verifyAssessmentV7AndroidBackup ='),
      app.indexOf('const recordAssessmentV7Backup =')
    );
    expect(nativeVerify).toContain('assessmentBackupAuthority.verifyAndroid(');
    expect(nativeVerify).not.toContain('mutationCoordinator.enqueueTask');
    const receiptCommit = app.slice(
      app.indexOf('const recordAssessmentV7Backup ='),
      app.indexOf('// CDC-01: teacher-assigned council entry')
    );
    expect(receiptCommit).toContain('mutationCoordinator.enqueue<SecureMeta>');
    expect(receiptCommit).toContain('assessmentBackupAuthority.consume(current, receipt, 7)');
    expect(v7Export).toContain('assessmentBackupAuthority.consume(current, receipt, 7)');
    expect(v7Export).toContain('secureStorage.saveMeta(candidate)');
    const restore = app.slice(app.indexOf('const handleImportEncryptedBackup ='), app.indexOf('const handleFactoryReset ='));
    const projection = restore.indexOf('projectAssessmentRestoreV7(');
    const persistence = restore.indexOf('secureStorage.restoreSnapshotVerified(');
    expect(projection).toBeGreaterThan(0);
    expect(persistence).toBeGreaterThan(projection);
    expect(restore).toContain('resolveApprovedAssessmentScopes(');
    expect(restore).toContain('selectApprovedScopesForIncomingV7Backup(decryptedData, scopes)');
    expect(restore).toContain('assertHistoricalAssessmentRestoreAllowed(previousLogical.appData, decryptedData)');
    expect(restore).toContain('const handleImportEncryptedBackup = (decryptedData: unknown): Promise<void> =>');
    expect(restore).toContain('const handleImportAssessmentV7Backup = (decryptedData: unknown, recoveryData: unknown): Promise<void> =>');
    expect(restore).toContain('const restoreVerifiedCandidate = async (');
    expect(restore).toContain('assessmentBackupAuthority.invalidate()');
    expect(restore).toContain('wouldLoseCouncilEntries(');
  });

  test('F2-DEVICE uses the installed professional UI and real Android SAF without distributing an APK', async () => {
    const workflow = await Bun.file('.github/workflows/ap02-f2-native-device.yml').text();
    const driver = await Bun.file('scripts/diagnostics/ap02-native-device-v7.mjs').text();
    expect(workflow).toContain('bun run build');
    expect(workflow).toContain('src/main.tsx');
    expect(workflow).toContain('it.trama.registrodocente.lab.ap02v7');
    expect(workflow).toContain('android:allowBackup="false"');
    expect(workflow).toContain('ap02-native-device-v7.mjs');
    expect(workflow).toContain('api: [32, 36]');
    expect(workflow).toContain('productionRelease==false');
    expect(workflow).toContain('ap02-device-evidence/result.json');
    expect(workflow).not.toContain('upload-release-asset');
    expect(workflow).not.toContain('actions/create-release');
    expect(driver).toContain('Page.javascriptDialogOpening');
    expect(driver).toContain("if(d.type==='prompt') {");
    expect(driver).toContain('Page.handleJavaScriptDialog');
    expect(driver).toContain('classPromptAcknowledged++');
    expect(driver).toContain("await button('Nuova Classe')");
    expect(driver).toContain('VISIBLE_CLASS_CREATION_CONTROL');
    expect(driver).toContain('VISIBLE_EXACT_HOME_CONFIRM');
    expect(driver).toContain('PRIVACY_V7_EXPORT_BUTTON_READY');
    expect(driver).toContain('NATIVE_V7_EXPORT_REJECTED_BEFORE_SAF');
    expect(driver).toContain('NATIVE_V7_VAULT_LOCKED_BEFORE_SAF');
    expect(driver).toContain('NATIVE_V7_EXPORT_STILL_IN_PROGRESS');
    expect(driver).toContain('NATIVE_V7_SAF_NOT_OBSERVED_OFF_FOREGROUND');
    expect(workflow).toContain('ap02-device-evidence/saf-diagnostic.json');
    expect(driver).toContain('native-v7-export-submit');
    expect(driver).toContain('BUTTON_MATCH_COUNT_0');
    expect(driver).toContain('HOME_CONFIRM_DISMISSED');
    expect(driver).toContain('HOME_NAVIGATION_OR_CONFIRM');
    expect(driver).toContain('HOME_INTERACTIVE_READY');
    // F2-DIAG-06: Android SAF must own both same-day files. A shell mv or media
    // broadcast can invalidate DocumentsProvider bookkeeping and hang API32.
    const discovery = await Bun.file('scripts/diagnostics/native-v7-document-discovery.mjs').text();
    expect(discovery).toContain('selectNewLabV7Name(before,after)');
    expect(discovery).toContain('V7_SECOND_DISTINCT_DOCUMENT_MISSING');
    expect(discovery).toContain('quotedLabV7Path(name)');
    expect(driver).toContain('name=selectNewLabV7Name(filesBefore,filesAfter)');
    expect(driver).toContain('await verifiedEncryptedFile(previous.name)');
    expect(driver).toContain('await restoreFromRealSaf(target.name,recovery.name)');
    expect(driver).toContain('assert.notEqual(digest.sha256,previous.digest.sha256');
    expect(driver).not.toContain('MEDIA_SCANNER_SCAN_FILE');
    expect(driver).not.toContain("adb('shell','mv'");
    expect(driver).not.toContain('AP02_F2_TARGET.enc.json');
    expect(driver).toContain("if(first==='confirmation')");
    expect(driver.indexOf("'HOME_NAVIGATION_OR_CONFIRM'")).toBeLessThan(
      driver.indexOf("if(first==='confirmation')")
    );
    // Two stable, accessible Home samples are required; a protected class
    // page or stale text never qualifies as a successful navigation.
    expect(driver).toContain("await ensureInteractiveSession('during-home-navigation')");
    expect(driver).toContain("await ensureInteractiveSession('after-home-navigation')");
    expect(driver).toContain("return (await sample())==='home-ready'");
    expect(driver).toContain('homeNavigationDiagnostic=safeHomeNavigationReport(transitions,lastFrame)');
    const navigationClassifier = await Bun.file('scripts/diagnostics/native-home-navigation-probe.mjs').text();
    expect(navigationClassifier).toContain('classifyHomeNavigationFrame');
    expect(navigationClassifier).toContain('classHeadingVisible');
    expect(navigationClassifier).toContain('newClassButtonVisible');
    expect(navigationClassifier).toContain('documentVisible');
    expect(navigationClassifier).toContain('rawDomStored:false');
    // Android API32: textContent is stable even when WebView innerText
    // has not been calculated; never skip the visible modal confirmation.
    expect(driver).toContain('e.textContent?.trim()==="Torna a Oggi"');
    expect(driver).not.toContain('e.innerText?.trim()==="Torna a Oggi"');
    expect(driver).toContain('[role=alertdialog][aria-modal=true]');
    expect(driver).toContain('HOME_CONFIRM_DIALOG_MISSING');
    expect(driver).toContain('homeConfirmDiagnostic=await captureHomeConfirmDiagnostic()');
    expect(driver).toContain('exactLabelCount:named.length');
    expect(driver).toContain('planningExitDialogOpen:');
    expect(driver).toContain('inertOwnerIsDrawer:');
    expect(driver).toContain('inertOwnerIsRoot:');
    expect(driver).toContain('inertOwnerContainsNavbar:');
    expect(driver).toContain('buttonHasLayoutRect:');
    expect(driver).toContain('homeConfirmDiagnostic:homeConfirmDiagnostic||undefined');
    // Android API32 may protect the mounted App after a native prompt. CDP
    // must not click controls through a hidden/inert Vault surface.
    expect(driver).toContain('async function ensureInteractiveSession(scope)');
    expect(driver).toContain('ANDROID_INTERACTIVE_OR_LOCK_');
    expect(driver).toContain('ANDROID_SESSION_REAUTHORIZED_');
    expect(driver).toContain('ANDROID_PROTECTED_SURFACE_');
    expect(driver).toContain('AP02_SESSION_REAUTH_VIA_REAL_UI');
    // Fail closed but tolerate a transient lifecycle transition between samples.
    expect(driver).toContain('for(let attempt=0;attempt<4;attempt++)');
    expect(driver).toContain('AP02_INTERACTIVE_SURFACE_RETRY');
    expect(driver).toContain("assert.fail('ANDROID_PROTECTED_SURFACE_'+scope)");
    expect(driver).toContain("await ensureInteractiveSession('after-class-prompt')");
    expect(driver).toContain("await ensureInteractiveSession('before-v7-export')");
    expect(driver).toContain("await ensureInteractiveSession('before-nav-'+label)");
    expect(driver).toContain('!brand.closest("[inert]")');

    expect(driver).toContain('NATIVE_UI_TREE_UNAVAILABLE');
    expect(driver).toContain('NATIVE_V7_PHYSICAL_READ_UNAVAILABLE');
    expect(driver).toContain('NATIVE_V7_PHYSICAL_READ_UNAVAILABLE_AFTER_RETRY');
    expect(driver).toContain('NATIVE_V7_ENVELOPE_INVALID_JSON');
    const readback = driver.slice(driver.indexOf('function inspectEncryptedFile('),
      driver.indexOf('async function exportV7('));
    expect(readback.indexOf("if(/^(?:cat:|sh:|")).toBeGreaterThan(0);
    expect(readback.indexOf("if(/^(?:cat:|sh:|")).toBeLessThan(readback.indexOf('JSON.parse(text)'));
    expect(driver).toContain('e.closest("[inert]")');
    expect(driver).toContain('visible-ui-close-save-notice');
    expect(driver).toContain('SYNTHETIC_CLASS_PROMPT_NOT_ACCEPTED');
    // Class creation may suspend the Android session before React presents
    // the resulting page; the real Vault gate must be processed first.
    const classFlow = driver.slice(driver.indexOf('async function createClass(name){'),
      driver.indexOf('function findV7Name()'));
    expect(classFlow.indexOf("await ensureInteractiveSession('after-class-prompt')")).toBeGreaterThan(0);
    expect(classFlow.indexOf("await ensureInteractiveSession('after-class-prompt')")).toBeLessThan(
      classFlow.indexOf("const expectedClassHeading='Gestione Elenco Alunni: '+name")
    );
    expect(classFlow).toContain('INTERACTIVE_SYNTHETIC_CLASS_AFTER_PROMPT');
    expect(classFlow).toContain('if(state.locked){');
    expect(classFlow).toContain('return state.ready&&state.classVisible;');
    expect(driver).not.toContain('ui.enterClassName(name)');
    expect(driver).not.toContain('ui.submitClass(name)');
    expect(driver).not.toContain('window.__ap02F2');
    expect(driver).not.toContain('UNEXPECTED_PROMPT');
    expect(driver).toContain('Configura archivio protetto');
    expect(driver).toContain('input[name="archive-mode"][value="professional"]');
    expect(driver).toContain('Esporta copia completa V7');
    expect(discovery).toContain('Backup_Valutazioni_V7_');
    expect(driver).toContain('Scegli file e ripristina');
    expect(driver).toContain('await nativeChoose(target)');
    expect(driver).toContain('await nativeChoose(recovery)');
    expect(driver).toContain('verifiedProcessStop(');
    expect(driver).toContain('reauthenticateAfterPicker(');
    expect(driver).toContain('ANDROID_SESSION_REAUTH_REQUIRED_');
    expect(driver).toContain('Sblocca Registro');
    expect(driver).not.toContain('window.__ap02F2');
    expect(driver).not.toContain('window.__val01NativeRestore');
  });

  test('native Android SAF accepts the exact V7 filename without relaxing the legacy V6 allowlist', async () => {
    const native = await Bun.file('mobile/android-probe/native/RegistroBackupFilesPlugin.java').text();
    const privacy = await Bun.file('src/components/PrivacyView.tsx').text();
    const fixture = await Bun.file('mobile/android-probe/val01-native-restore.fixture.ts').text();
    const diagnostic = await Bun.file('scripts/diagnostics/val01-native-evidence.mjs').text();
    expect(privacy).toContain('Backup_Valutazioni_V7_${today()}.enc.json');
    expect(native).toContain('filename.matches("(?:Backup_Cifrato_GDPR_|Backup_Valutazioni_V7_)');
    expect(native).toContain('[0-9]{4}-[0-9]{2}-[0-9]{2}');
    expect(native).toContain('INVALID_FILENAME');
    for (const source of [fixture, diagnostic]) {
      expect(source).toContain('Backup_Valutazioni_V7_2031-01-15.enc.json');
      expect(source).toContain('Backup_Valutazioni_V7_2031-01-16.enc.json');
    }
    expect(native).toContain('validateEnvelope(encrypted)');
    expect(native).toContain('MessageDigest.getInstance("SHA-256")');
  });

  test('Privacy V7 requires a separate recovery copy, protects legacy UI and never grants a web receipt on download', async () => {
    const privacy = await Bun.file('src/components/PrivacyView.tsx').text();
    expect(privacy).toContain('onPrepareAssessmentV7Backup(encryptPassword)');
    expect(privacy).toContain('onVerifyAssessmentV7AndroidBackup(');
    expect(privacy).toContain('onVerifyAssessmentV7WebBackup(');
    expect(privacy).toContain('onRecordAssessmentV7Backup(');
    expect(privacy).toContain('selectedV7RecoveryFile');
    expect(privacy).toContain('isV7EncryptedEnvelope(recoveryText)');
    expect(privacy).toContain('isV7EncryptedEnvelope(encryptedText)');
    expect(privacy).toContain('onImportAssessmentV7Backup(decryptedData, recoveryData)');
    expect(privacy).toContain('onImportEncryptedBackup(decryptedData)');
    const webExport = privacy.slice(privacy.indexOf('const handleExportAssessmentV7 ='), privacy.indexOf('const handleImportEncrypted ='));
    expect(webExport).toContain('v7VerificationRef.current = receipt');
    expect(webExport.indexOf('v7VerificationRef.current = receipt')).toBeGreaterThan(webExport.indexOf('link.click()'));
    expect(webExport).not.toContain('onRecordAssessmentV7Backup(receipt);\n      } else');
    expect(privacy).toContain('const payload = createBackupPayload(checkpoint.snapshot)');
    expect(privacy).toContain('onImportAssessmentV7Backup?: (decryptedData: unknown, recoveryData: unknown) => Promise<void>;');
  });
});
