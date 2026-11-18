// Copied into each exact predecessor tree; imports only its actual source.
import './beta2-archive-compatibility.fixture';
import { decryptDataWithPassword } from '../../../src/cryptoUtils';
import { BACKUP_DATA_VERSION_V6 } from '../../../src/security/backupPayload';
const password='synthetic-archive-backup-only';
Object.assign(globalThis,{__val01HistoricalReader:{
  async decrypt(backup:string){
    const decoded=await decryptDataWithPassword(backup,password);
    return {readerVersion:BACKUP_DATA_VERSION_V6,payloadVersion:decoded.backupDataVersion,
      evidence:decoded.snapshot.appData.classes[0].assessmentEvidenceV1,
      changedGrade:decoded.snapshot.appData.classes[0].grades[0].value};
  }
}});
