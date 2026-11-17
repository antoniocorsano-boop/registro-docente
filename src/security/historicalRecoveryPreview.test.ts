import {describe,expect,test} from 'bun:test';
import {previewHistoricalRecovery} from './historicalRecoveryPreview';
import {createInitialArchiveSnapshot} from './initialArchiveSetup';
import type {CompleteSecureAppSnapshot} from './secureAppStorage';

const sourceDate='2026-10-24T10:00:00.000Z';
const additions=['planning','library','professionalMemory','copilotState'] as const;
const current=()=>createInitialArchiveSnapshot({mode:'professional',profile:{
  school:'Istituto sintetico',year:'2026/2027',teacher:'Docente sintetico',subject:'Tecnologia'
}});
function historical(version:2|3|4|5){
  const full=current();
  const snapshot:Record<string,unknown>={...full,planning:{
    schemaVersion:1,profiles:[],arenaContexts:[],resources:[],masterPrograms:[],classInstances:[]
  }};
  for(const key of additions.slice(version-2))delete snapshot[key];
  return {app:'registro-docente',backupDataVersion:version,exportedAt:sourceDate,snapshot};
}
describe('S-R03b read-only historical recovery review',()=>{
  for(const version of [2,3,4,5] as const){
    test('identifies exact datasets present and absent in v'+version,async()=>{
      const payload=historical(version),destination=current();
      const before=structuredClone(destination),original=structuredClone(payload);
      const summary=await previewHistoricalRecovery(payload,destination);
      expect(summary.sourceVersion).toBe(version);
      expect(summary.presentDatasets).toEqual(['appData','settings','udas','customTests','submissions','meta',...additions.slice(0,version-2)]);
      expect(summary.absentDatasets).toEqual(additions.slice(version-2));
      expect(summary.replacementRequiresReview).toBe(true);
      expect(summary.assessmentReviewRequired).toBe(false);
      expect(summary.exportedAt).toBe(sourceDate);
      expect(Object.keys(summary).sort()).toEqual(['absentDatasets','assessmentReviewRequired','exportedAt','presentDatasets','replacementRequiresReview','sourceVersion']);
      expect(destination).toEqual(before);
      expect(payload).toEqual(original);
      expect(Object.isFrozen(summary)).toBe(true);
    });
  }
  test('refuses a missing dataset and a newer dataset under an older label',async()=>{
    const incomplete=historical(4);delete incomplete.snapshot.library;
    await expect(previewHistoricalRecovery(incomplete,current())).rejects.toThrow();
    const mislabeled=historical(2);mislabeled.snapshot.copilotState=current().copilotState;
    await expect(previewHistoricalRecovery(mislabeled,current())).rejects.toThrow();
  });
  test('refuses malformed timestamps and invalid source metadata',async()=>{
    await expect(previewHistoricalRecovery({...historical(3),exportedAt:'invalid'},current())).rejects.toThrow();
    const invalid=historical(5);invalid.snapshot.meta={changes:-1,lastBackup:null};
    await expect(previewHistoricalRecovery(invalid,current())).rejects.toThrow();
  });
  test('leaves legacy, current and future versions outside the historical preview',async()=>{
    const destination:CompleteSecureAppSnapshot=current();
    for(const payload of [
      {classes:[]},
      {...historical(5),backupDataVersion:6},
      {...historical(5),backupDataVersion:7},
      {...historical(5),backupDataVersion:99}
    ])await expect(previewHistoricalRecovery(payload,destination)).rejects.toThrow();
  });
});
