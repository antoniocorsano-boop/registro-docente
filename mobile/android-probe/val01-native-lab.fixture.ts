// CI emulator only. This file is never imported by the product entrypoint.
import '../../tests/browser/fixtures/val01-fence-candidate.fixture';
import { createAuthorizedVaultMigration } from '../../src/security/authorizedVaultMigration';
import { readEncryptedBackupOnAndroid, saveEncryptedBackupOnAndroid } from '../../src/security/androidBackupExport';
import { readAndroidSessionState, authorizeAndroidSession, acknowledgeAndroidShield, registerAndroidFileAccess } from '../../src/security/androidSessionLifecycle';

const password='synthetic-archive-compatibility-only';
const backupPassword='synthetic-archive-backup-only';
const filename='Backup_Cifrato_GDPR_2031-01-15.enc.json';
const migration=createAuthorizedVaultMigration();
let grant:Awaited<ReturnType<typeof migration.prepare>>|null=null;
let generation=0;
// A synthetic lab session, not the production Vault owner. The native plugin
// and actual document picker are unchanged. Reauthorize after picker return
// only within the current synthetic operation; never use this in production.
async function access(active:()=>boolean){
  for(let i=0;i<100&&active();i++){
    const s=await readAndroidSessionState();
    if(s?.foreground){
      await authorizeAndroidSession(s.epoch);
      if(!active())return false;
      await acknowledgeAndroidShield(s.epoch,true);
      return active();
    }
    await new Promise(r=>setTimeout(r,100));
  }
  return false;
}
registerAndroidFileAccess(access);
Object.assign(globalThis,{__val01NativeLab:{
  async ready(){return access(()=>true);},
  async write(backup:string){const epoch=++generation;return saveEncryptedBackupOnAndroid(backup,filename,()=>epoch===generation);},
  async readAndPrepare(wrongPassword=false){
    migration.invalidate();grant=null;
    const epoch=++generation;
    const active=()=>epoch===generation;
    const text=await readEncryptedBackupOnAndroid(active);
    if(text===null||!active())return null;
    grant=await migration.prepare(password,new Blob([text]),wrongPassword?'wrong-synthetic':backupPassword);
    if(!active()){migration.invalidate();grant=null;return null;}
    return grant;
  },
  async migrate(confirmed:boolean){if(!grant)throw Error('No authorization');await migration.migrate(grant,confirmed);return true;},
  invalidate(){generation++;grant=null;migration.invalidate();}
}});
