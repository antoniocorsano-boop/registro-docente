/**
 * M1-B4/3 — exact Beta 2 RC2 historical V6/V7 boundary.
 *
 * The historical reader is compiled at test time from the original, pinned
 * Git tree (not reimplemented or imported from current production modules).
 * The test is pure Bun: no file picker, IndexedDB, APK, deployment, or R2 flow.
 * The CI contracts/predeploy jobs already use fetch-depth:0. No workflow edits.
 */
import { describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInitialArchiveSnapshot } from './initialArchiveSetup';
import { createAssessmentBackupPayloadV7 } from './assessmentBackupPayload';
import { encryptDataWithPassword, decryptDataWithPassword } from '../cryptoUtils';
import { boardDocument, boardScope } from '../../tests/browser/fixtures/val01-s6c-data';

const BETA2_RC2='ddbf60781514b866b09e1fa1e014e6a6fc3989d3';
const BACKUP_BLOB='b037fba6569254932812fdc260bccbf721f3d23a';
const HISTORICAL_CRYPTO='1adbb66a08b884580306319363ebc320d4433e57';
const STAMP='2026-11-21T10:00:00.000Z';
const PASSPHRASE='synthetic-exact-beta2-rc2-v7-only';

type HistoricalBackupReader = {
  createBackupPayload:(value:unknown,date:string)=>{backupDataVersion:number;snapshot:unknown};
  normalizeBackupPayload:(value:unknown,current:unknown)=>{appData:unknown;settings:unknown};
};

/** No mutable worktree and no substitution of a current implementation for
 * the old one: git archive materializes the exact commit in a temporary path.
 */
async function loadExactReader():Promise<{reader:HistoricalBackupReader;close:()=>void}>{
  const root=resolve(process.cwd());
  const tmp=mkdtempSync(join(tmpdir(),'registro-beta2-rc2-'));
  try{
    const found=execFileSync('git',['rev-parse',BETA2_RC2+'^{commit}'],{
      cwd:root,encoding:'utf8',timeout:15000
    }).trim();
    expect(found).toBe(BETA2_RC2);
    const archive=join(tmp,'historic.tar');
    execFileSync('git',['archive','--format=tar','--output='+archive,BETA2_RC2],{
      cwd:root,timeout:45000
    });
    execFileSync('tar',['-xf',archive,'-C',tmp],{timeout:45000});
    const backup=join(tmp,'src/security/backupPayload.ts');
    const crypto=join(tmp,'src/cryptoUtils.ts');
    expect(execFileSync('git',['hash-object',backup],{encoding:'utf8'}).trim()).toBe(BACKUP_BLOB);
    expect(execFileSync('git',['hash-object',crypto],{encoding:'utf8'}).trim()).toBe(HISTORICAL_CRYPTO);
    const nodeModules=join(root,'node_modules');
    if(!existsSync(nodeModules))throw Error('Install locked dependencies before historical qualification');
    symlinkSync(nodeModules,join(tmp,'node_modules'),'dir');
    const bundle=join(tmp,'rc2-backup-reader.mjs');
    execFileSync('bun',['build',backup,'--target=bun','--outfile',bundle],{
      cwd:root,timeout:60000,stdio:'pipe',maxBuffer:4*1024*1024
    });
    if(!existsSync(bundle))throw Error('Historical RC2 bundle not produced');
    const reader=await import(pathToFileURL(bundle).href) as HistoricalBackupReader;
    if(typeof reader.createBackupPayload!=='function'||typeof reader.normalizeBackupPayload!=='function'){
      throw Error('Historical RC2 exports are missing');
    }
    return {reader,close:()=>rmSync(tmp,{recursive:true,force:true})};
  }catch(error){
    rmSync(tmp,{recursive:true,force:true});
    throw error;
  }
}

describe('M1-B4/3 — Beta 2 RC2 exact source, canonical V7 negative boundary',()=>{
  test('accepts its own historical V6 but refuses a fully formed encrypted V7 assessment archive',async()=>{
    const historical=await loadExactReader();
    try{
      const base=createInitialArchiveSnapshot({mode:'professional',
        profile:{school:'Istituto sintetico',year:'2026/2027',teacher:'Docente sintetico',subject:'Tecnologia'}});
      const before=JSON.stringify(base);
      // Positive control: this exact historical reader must accept its own V6.
      const v6=historical.reader.createBackupPayload(base,STAMP);
      expect(v6.backupDataVersion).toBe(6);
      const accepted=historical.reader.normalizeBackupPayload(v6,base);
      expect(accepted.appData).toEqual(base.appData);
      expect(accepted.settings).toEqual(base.settings);

      // A genuine, canonical V7 from the current assessment codec, including
      // actual synthetic evidence and teacher-approved scope (not a relabeled V6).
      const evidence=structuredClone(base);
      evidence.appData.classes=[{
        id:boardScope.classId,name:'Classe sintetica',students:boardScope.studentIds.map((id,i)=>({
          id,name:'Fittizio '+i
        })),grades:[],behaviors:[],
        assessmentEvidenceV1:{version:1,documents:[{
          document:structuredClone(boardDocument),bindings:[]
        }]}
      } as (typeof evidence.appData.classes)[number]];
      evidence.appData.currentClassId=boardScope.classId;
      const scopes=[{classId:boardScope.classId,schoolYear:boardScope.schoolYear,
        subjectCode:boardScope.subjectCode}];
      const canonical=await createAssessmentBackupPayloadV7(evidence,scopes,STAMP);
      expect(canonical.backupDataVersion).toBe(7);
      expect(canonical.snapshot.appData.classes[0]).toHaveProperty('assessmentEvidenceV1');
      const encrypted=await encryptDataWithPassword(canonical,PASSPHRASE);
      expect(encrypted).not.toContain('Fittizio');
      const decoded=await decryptDataWithPassword(encrypted,PASSPHRASE);
      expect(decoded).toEqual(canonical);
      expect(()=>historical.reader.normalizeBackupPayload(decoded,base))
        .toThrow('Versione dati backup non supportata: 7.');
      // Rejecting a new archive must not mutate the supplied historical state.
      expect(JSON.stringify(base)).toBe(before);
    }finally{
      historical.close();
    }
  },120000);
});
