from pathlib import Path
import json

policy = Path('src/persistence/backupReminderPolicy.ts')
if policy.exists():
    raise SystemExit('backupReminderPolicy.ts already exists')
policy.write_text("""import type { SecureMeta } from '../security/secureAppStorage';

export const BACKUP_REMINDER_INTERVAL = 10;

function normalizedChanges(meta: SecureMeta): number {
  return Number.isFinite(meta.changes) ? Math.max(0, Math.trunc(meta.changes)) : 0;
}

export function shouldSuggestBackupReminder(previous: SecureMeta, next: SecureMeta): boolean {
  const previousChanges = normalizedChanges(previous);
  const nextChanges = normalizedChanges(next);

  if (nextChanges <= previousChanges || nextChanges < BACKUP_REMINDER_INTERVAL) return false;

  return Math.floor(previousChanges / BACKUP_REMINDER_INTERVAL)
    < Math.floor(nextChanges / BACKUP_REMINDER_INTERVAL);
}
""", encoding='utf-8')

app_path = Path('src/App.tsx')
app = app_path.read_text(encoding='utf-8')

import_anchor = """import {
  applyBackupReceipt,
  incrementBackupChanges,
  prepareBackupCheckpoint,
  type PreparedBackupCheckpoint
} from './persistence/backupCheckpoint';
import { applySettingsPatch } from './persistence/settingsMutation';
"""
import_replacement = """import {
  applyBackupReceipt,
  incrementBackupChanges,
  prepareBackupCheckpoint,
  type PreparedBackupCheckpoint
} from './persistence/backupCheckpoint';
import { shouldSuggestBackupReminder } from './persistence/backupReminderPolicy';
import { applySettingsPatch } from './persistence/settingsMutation';
"""
if app.count(import_anchor) != 1:
    raise SystemExit(f'import anchor count={app.count(import_anchor)}')
app = app.replace(import_anchor, import_replacement, 1)

options_anchor = """    const {
      showBackupModal = true,
      successMessage = 'Salvato nel vault locale',
      afterCommit
    } = options;
"""
options_replacement = """    const {
      showBackupModal,
      successMessage = 'Salvato nel vault locale',
      afterCommit
    } = options;
"""
if app.count(options_anchor) != 1:
    raise SystemExit(f'options anchor count={app.count(options_anchor)}')
app = app.replace(options_anchor, options_replacement, 1)

commit_anchor = """      afterCommit: () => {
        if (successMessage) toast(successMessage);
        if (showBackupModal) setIsBackupModalOpen(true);
        afterCommit?.();
      }
"""
commit_replacement = """      afterCommit: (candidate, previous) => {
        if (successMessage) toast(successMessage);
        const shouldOpenBackupModal = showBackupModal === true
          || (showBackupModal === undefined
            && shouldSuggestBackupReminder(previous.meta, candidate.meta));
        if (shouldOpenBackupModal) setIsBackupModalOpen(true);
        afterCommit?.();
      }
"""
if app.count(commit_anchor) != 1:
    raise SystemExit(f'commit anchor count={app.count(commit_anchor)}')
app = app.replace(commit_anchor, commit_replacement, 1)
app_path.write_text(app, encoding='utf-8')

registry_path = Path('qualification/invariants.v1.json')
registry = json.loads(registry_path.read_text(encoding='utf-8'))
invariant = next((item for item in registry['invariants'] if item['id'] == 'FLOW-03-I01'), None)
if invariant is None:
    raise SystemExit('FLOW-03-I01 missing')
for impact in [
    'src/persistence/backupReminderPolicy.ts',
    'src/security/flow03bBackupReminderContract.test.ts'
]:
    if impact not in invariant['impactPaths']:
        invariant['impactPaths'].append(impact)
test_path = 'src/security/flow03bBackupReminderContract.test.ts'
if test_path not in invariant['tests']:
    invariant['tests'].append(test_path)
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
