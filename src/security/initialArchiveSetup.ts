import type { AppSettings } from '../types';
import { DEFAULT_SETTINGS, INITIAL_CLASSES, INITIAL_TESTS, INITIAL_UDAS } from '../utils';
import { createEmptyPlanningState } from '../planning/emptyPlanningState';
import { createEmptyLibraryState } from '../library/emptyLibraryState';
import { createEmptyProfessionalMemoryState } from '../memory/emptyProfessionalMemoryState';
import { createEmptyCopilotState } from '../copilot/emptyCopilotState';
import { sanitizePersistedSettings } from './dataClassification';
import { SecureAppStorage, type CompleteSecureAppSnapshot } from './secureAppStorage';
import { SecureVault } from './secureVault';

export type ArchiveProfile = Pick<AppSettings, 'school' | 'year' | 'teacher' | 'subject'>;
export type NewArchiveSetup =
  | { mode: 'professional'; profile: ArchiveProfile }
  | { mode: 'demo' };

function validateProfile(profile: ArchiveProfile): ArchiveProfile {
  const school = profile.school.trim();
  const year = profile.year.trim();
  const teacher = profile.teacher.trim();
  const subject = profile.subject.trim();
  if (!school || !year || !teacher || !subject) {
    throw new Error('Completa istituto, anno scolastico, docente e disciplina.');
  }
  return { school, year, teacher, subject };
}

/** New archives only. Never infer archive type from existing contents. */
export function createInitialArchiveSnapshot(setup: NewArchiveSetup): CompleteSecureAppSnapshot {
  const isDemo = setup.mode === 'demo';
  const profile = setup.mode === 'professional'
    ? validateProfile(setup.profile)
    : { school: 'Istituto dimostrativo', year: DEFAULT_SETTINGS.year, teacher: 'Docente dimostrativo', subject: 'Tecnologia' };
  const settings: AppSettings = sanitizePersistedSettings({
    ...structuredClone(DEFAULT_SETTINGS), ...profile, archiveMode: setup.mode
  });
  return {
    appData: { classes: isDemo ? structuredClone(INITIAL_CLASSES) : [], currentClassId: null },
    settings,
    udas: isDemo ? structuredClone(INITIAL_UDAS) : [],
    customTests: isDemo ? structuredClone(INITIAL_TESTS) : {},
    submissions: [],
    planning: createEmptyPlanningState(),
    library: createEmptyLibraryState(),
    professionalMemory: createEmptyProfessionalMemoryState(),
    copilotState: createEmptyCopilotState(),
    meta: { changes: 0, lastBackup: null }
  };
}

/** Verify the complete encrypted archive before activation.
 * createStaging rejects an existing vault; only our own staging may be discarded.
 */
export async function initializeNewArchive(vault: SecureVault, password: string, setup: NewArchiveSetup): Promise<void> {
  const candidate = createInitialArchiveSnapshot(setup);
  await vault.createStaging(password);
  try {
    await new SecureAppStorage(vault).restoreSnapshotVerified(candidate);
    await vault.activate();
  } catch (error) {
    try {
      await vault.discardStaging();
    } finally {
      vault.lock();
    }
    throw error;
  }
}
