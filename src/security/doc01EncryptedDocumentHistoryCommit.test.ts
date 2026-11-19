import {describe, expect, test} from 'bun:test';
import {readFileSync} from 'node:fs';
import {createDurableMutationCoordinator} from '../persistence/durableMutationCoordinator';
import {commitEncryptedDocumentHistory, DOC01_HISTORY_RECORD_KEY,
  type SyntheticDocumentHistoryOwner, type DocumentHistoryCipherSlot} from '../persistence/documentHistoryEncryptedCommit';
import {generateDataEncryptionKey, decryptJsonRecord} from './cryptoPrimitives';
import type {EncryptedVaultRecord} from './vaultTypes';
import {validateDocumentHistory} from '../documents/documentHistoryTransitions';
import {fixtureApproved,fixtureFirst,fixtureBlank,fixtureAppend,fixtureRevoke,fixtureHead,fixtureStep} from './doc01D4c3Fixture';

async function harness(){
  const key=await generateDataEncryptionKey();
  let generation='demo-genesis',stored:EncryptedVaultRecord|null=null;
  let writes=0,reads=0,active=true;
  let beforeCas:()=>void=()=>{},afterCas:()=>void=()=>{},onRead:()=>void=()=>{};
  let shouldFail=false;
  const storage={
    async read():Promise<DocumentHistoryCipherSlot>{
      reads++;onRead();
      return {generation,encrypted:stored};
    },
    async compareAndSwap(expectedGeneration:string,value:EncryptedVaultRecord){
      beforeCas();
      if(shouldFail||expectedGeneration!==generation)return {committed:false} as const;
      writes++;
      generation='demo-generation-'+writes;
      stored=value;
      const committedGeneration=generation; // CAS receipt binds its actual commit.
      afterCas(); // A different writer may advance the store before readback.
      return {committed:true,generation:committedGeneration} as const;
    }
  };
  const owner:SyntheticDocumentHistoryOwner={
    mode:'SYNTHETIC_ONLY',
    coordinator:createDurableMutationCoordinator(),storage,
    isActive:()=>active,getSessionKey:()=>key
  };
  return {
    owner,key,storage,
    state:()=>({generation,stored,writes,reads}),
    setEncrypted:(v:EncryptedVaultRecord|null)=>{stored=v;},
    setGeneration:(v:string)=>{generation=v;},
    failCas:(v:boolean)=>{shouldFail=v;},
    revoke:()=>{active=false;},
    beforeCas:(v:()=>void)=>{beforeCas=v;},
    afterCas:(v:()=>void)=>{afterCas=v;},
    onRead:(v:()=>void)=>{onRead=v;}
  };
}
const commit=async(h:Awaited<ReturnType<typeof harness>>,request:unknown,scopes:unknown=fixtureApproved)=>
  commitEncryptedDocumentHistory(h.owner,scopes,request);

describe('DOC-01/D4c3a encrypted atomic history admission — synthetic only',()=>{
  test('encrypts a confirmed copy, authenticates readback, issues receipt only after committed CAS',async()=>{
    const h=await harness(),r=await fixtureFirst(),q=fixtureAppend(r);
    const receipt=await commit(h,q);
    expect(receipt).toEqual({changed:true,eventId:'demo-event-one',head:expect.stringMatching(/^[a-f0-9]{64}$/),eventCount:1});
    const {stored,writes}=h.state();
    expect(writes).toBe(1);
    expect(stored?.recordKey).toBe(DOC01_HISTORY_RECORD_KEY);
    expect(stored?.schemaVersion).toBe(1);
    expect(stored?.iv).toHaveLength(12);
    expect(new TextDecoder().decode(stored?.ciphertext)).not.toContain('demo-document');
    const plaintext=await decryptJsonRecord<unknown>(stored!,h.key);
    expect((await validateDocumentHistory(plaintext,fixtureApproved)).valid).toBe(true);
  });
  test('exact retry is idempotent, preserves ciphertext generation and does not rewrite',async()=>{
    const h=await harness(),r=await fixtureFirst(),q=fixtureAppend(r);
    const first=await commit(h,q),before=h.state();
    const retry=await commit(h,structuredClone(q));
    expect(retry).toEqual({...first,changed:false});
    expect(h.state().generation).toBe(before.generation);
    expect(h.state().stored).toBe(before.stored);
    expect(h.state().writes).toBe(1);
  });
  test('second event and explicit revocation require authoritative head, never overwrite earlier event',async()=>{
    const h=await harness(),r=await fixtureFirst();
    const a=await commit(h,fixtureAppend(r));
    await expect(commit(h,fixtureRevoke(r,'demo-revoke',null))).rejects.toThrow();
    const b=await commit(h,fixtureRevoke(r,'demo-revoke',a.head));
    expect(b).toMatchObject({changed:true,eventId:'demo-revoke',eventCount:2});
    const verified=await decryptJsonRecord<{events:unknown[]}>(h.state().stored!,h.key);
    expect(verified.events).toHaveLength(2);
    expect((await validateDocumentHistory(verified,fixtureApproved)).valid).toBe(true);
    expect(h.state().writes).toBe(2);
  });
  test('atomic CAS prevents concurrent stale writer from replacing the new head',async()=>{
    const h=await harness(),r=await fixtureFirst();
    h.beforeCas(()=>h.setGeneration('demo-external-generation'));
    await expect(commit(h,fixtureAppend(r))).rejects.toThrow();
    expect(h.state().writes).toBe(0);
    expect(h.state().stored).toBeNull();
  });
  test('CAS failure never publishes success, and retry after failed write succeeds',async()=>{
    const h=await harness(),r=await fixtureFirst(),q=fixtureAppend(r);
    h.failCas(true);
    await expect(commit(h,q)).rejects.toThrow();
    expect(h.state().writes).toBe(0);
    h.failCas(false);
    expect((await commit(h,q)).changed).toBe(true);
    expect(h.state().writes).toBe(1);
  });
  test('tampered ciphertext is rejected before any new encryption or write',async()=>{
    const h=await harness(),r=await fixtureFirst();
    await commit(h,fixtureAppend(r));
    const before=h.state();
    const corrupted=new Uint8Array(before.stored!.ciphertext.slice(0));
    corrupted[corrupted.byteLength-1]^=1;
    h.setEncrypted({...before.stored!,ciphertext:corrupted.buffer});
    await expect(commit(h,fixtureRevoke(r,'demo-revoke',fixtureHead((await fixtureStep(fixtureBlank(),fixtureAppend(r))).archive)))).rejects.toThrow();
    expect(h.state().writes).toBe(1);
  });
  test('post-commit readback mismatch withholds receipt even if the CAS committed',async()=>{
    const h=await harness(),r=await fixtureFirst();
    h.afterCas(()=>h.setGeneration('demo-other-generation'));
    await expect(commit(h,fixtureAppend(r))).rejects.toThrow();
    expect(h.state().writes).toBe(1);
  });
  test('revocation during admitted persistence withholds receipt and forbids further changes',async()=>{
    const h=await harness(),r=await fixtureFirst(),q=fixtureAppend(r);
    h.afterCas(()=>h.revoke());
    await expect(commit(h,q)).rejects.toThrow();
    expect(h.state().writes).toBe(1);
    await expect(commit(h,q)).rejects.toThrow();
    expect(h.state().writes).toBe(1);
  });
  test('invalid scopes, stale or non-synthetic requests never create a stored record',async()=>{
    const h=await harness(),r=await fixtureFirst(),q=fixtureAppend(r);
    await expect(commit(h,q,[])).rejects.toThrow();
    await expect(commit(h,{...q,mode:'PRODUCTION'})).rejects.toThrow();
    await expect(commit(h,{...q,studentId:'demo-student'})).rejects.toThrow();
    expect(h.state().writes).toBe(0);
  });
  test('no active DB2 migration, backup format, UI or production entrypoint is introduced',()=>{
    for(const path of ['src/App.tsx','src/main.tsx','src/components/SecureRegistroRoot.tsx',
      'src/security/secureAppStorage.ts','src/security/backupPayload.ts',
      'src/security/vaultTypes.ts','src/security/db2PhysicalLifecycle.ts']){
      const s=readFileSync(path,'utf8');
      expect(s).not.toContain('commitEncryptedDocumentHistory');
      expect(s).not.toContain(DOC01_HISTORY_RECORD_KEY);
    }
  });
});
