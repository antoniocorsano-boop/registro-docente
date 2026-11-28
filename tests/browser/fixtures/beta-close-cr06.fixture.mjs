// Real Chromium IndexedDB and WebCrypto. No real archives, no UI or production build.
import { SecureVault } from '../../../src/security/secureVault.ts';
import { IndexedDbVaultStore } from '../../../src/security/vaultStore.ts';
import { initializeNewArchive } from '../../../src/security/initialArchiveSetup.ts';
import { migrateLegacyToVault } from '../../../src/security/legacyMigration.ts';
import { STORAGE_KEY } from '../../../src/utils.ts';

const password='synthetic-cr06-passphrase';
const put0=IDBObjectStore.prototype.put, get0=IDBObjectStore.prototype.get, clear0=IDBObjectStore.prototype.clear;
const tests=[];
const assert=(x,m='assertion failed')=>{if(!x)throw Error(m)};
const equal=(a,b,m='value differs')=>assert(JSON.stringify(a)===JSON.stringify(b),`${m}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
const reject=async(fn,pattern)=>{let caught;try{await fn()}catch(e){caught=e}assert(caught,'expected refusal');if(pattern)assert(pattern.test(String(caught)),String(caught));return caught};
const fresh=(store)=>new SecureVault(store,m=>store.claimInitialMetadata(m));
const txDone=(tx)=>new Promise((res,rej)=>{tx.addEventListener('complete',res,{once:true});tx.addEventListener('abort',()=>rej(tx.error||Error('transaction aborted')),{once:true})});
const value={classes:[],currentClassId:'synthetic'};
const auth=()=>{};
async function stage(store){let v=fresh(store);await v.createStaging(password,auth);await v.put('appData',value);await v.put('meta',{changes:0,lastBackup:null});return v}
const setup = {
  mode: 'professional',
  profile: { school: 'Istituto sintetico', year: '2026/27', teacher: 'Docente sintetico', subject: 'Tecnologia' },
};
const initialData = { classes: [], currentClassId: null };
async function attempt(store, authorize = auth) {
  const vault = fresh(store);
  await initializeNewArchive(vault, password, setup, authorize);
  return vault;
}
function injectActiveAbort(afterAbort=()=>{}){let injected=0;IDBObjectStore.prototype.put=function(v,...args){const r=put0.call(this,v,...args);if(this.name==='metadata'&&v?.state==='ACTIVE'){const tx=this.transaction;r.addEventListener('success',()=>{injected++;tx.abort();afterAbort(tx)},{once:true})}return r};return ()=>injected}
function snapshotMetadata(m){return {state:m.state,salt:Array.from(m.salt),wrapped:Array.from(new Uint8Array(m.wrappedDek)),iv:Array.from(m.wrapIv),createdAt:m.createdAt,updatedAt:m.updatedAt}}
async function inspect(store,state,n){const m=await store.getMetadata();equal(m?.state??null,state);equal((await store.listRecordKeys()).length,n)}
function test(name,fn){tests.push({name,fn})}

test('CR06 confirmed abort after successful ACTIVE request: empty, then retry',async()=>{const s=new IndexedDbVaultStore();const hits=injectActiveAbort();await reject(()=>attempt(s));equal(hits(),1);await inspect(s,null,0);IDBObjectStore.prototype.put=put0;await attempt(s);await inspect(s,'ACTIVE',10);await s.retireConnection();const reopened=new IndexedDbVaultStore(indexedDB,true);let v=fresh(reopened);await v.unlock(password);equal(await v.get('appData'),initialData);await reopened.retireConnection()});
test('normal activation and reopen with real decrypted record',async()=>{const s=new IndexedDbVaultStore();const v=await attempt(s);equal(await v.get('appData'),initialData);await s.retireConnection();const r=new IndexedDbVaultStore(indexedDB,true);const w=fresh(r);await w.unlock(password);equal(await w.get('appData'),initialData);await inspect(r,'ACTIVE',10);await r.retireConnection()});
test('lost acknowledgement after durable ACTIVE: never delete',async()=>{class Lost extends IndexedDbVaultStore{async putMetadata(m){await super.putMetadata(m);if(m.state==='ACTIVE')throw Error('ack lost')}async activateReservedMetadata(...args){await super.activateReservedMetadata(...args);throw Error('ack lost')}}const s=new Lost();await reject(()=>attempt(s),/ack lost/);await inspect(s,'ACTIVE',10);const w=fresh(s);await w.unlock(password);equal(await w.get('appData'),initialData);await s.retireConnection()});
test('generic uncertain failure without abort proof: keep staging',async()=>{class Unknown extends IndexedDbVaultStore{async putMetadata(m){if(m.state==='ACTIVE')throw Error('unknown outcome');return super.putMetadata(m)}async activateReservedMetadata(expected,authorize,invoked){authorize();invoked();throw Error('unknown outcome')}}const s=new Unknown();await reject(()=>attempt(s),/unknown outcome/);await inspect(s,'STAGING',10);await s.retireConnection()});
test('revoked after ACTIVE abort: preserve staging and encrypted records',async()=>{const s=new IndexedDbVaultStore();let revoked=false;const hits=injectActiveAbort(()=>{revoked=true});await reject(()=>attempt(s,()=>{if(revoked)throw Error('revoked')}));equal(hits(),1);await inspect(s,'STAGING',10);await s.retireConnection()});
test('observation failure in recovery: keep staging',async()=>{const s=new IndexedDbVaultStore();let fail=false;injectActiveAbort(()=>{fail=true});IDBObjectStore.prototype.get=function(...args){if(fail&&this.name==='metadata')throw Error('synthetic observation failure');return get0.apply(this,args)};await reject(()=>attempt(s));fail=false;await inspect(s,'STAGING',10);await s.retireConnection()});
test('cleanup transaction abort: metadata and records both preserved',async()=>{const s=new IndexedDbVaultStore();let cleanup=false,hit=0;injectActiveAbort(()=>{cleanup=true});IDBObjectStore.prototype.clear=function(...args){const r=clear0.apply(this,args);if(cleanup&&this.name==='records'){const tx=this.transaction;r.addEventListener('success',()=>{hit++;tx.abort()},{once:true})}return r};await reject(()=>attempt(s));await inspect(s,'STAGING',10);if(IndexedDbVaultStore.prototype.activateReservedMetadata)equal(hit,1);await s.retireConnection()});
async function race(state){const s=new IndexedDbVaultStore();const v=await stage(s);const original=await s.getMetadata();const other=structuredClone(original);other.salt[0]^=255;other.state=state;let competing;injectActiveAbort(tx=>{const t=tx.db.transaction(['metadata','records'],'readwrite');competing=txDone(t);put0.call(t.objectStore('metadata'),other,'current')});await reject(()=>v.activate(auth,()=>{}));await competing;equal(snapshotMetadata(await s.getMetadata()),snapshotMetadata(other));await inspect(s,state,2);await s.retireConnection()}
test('concurrent different STAGING queued before recovery: preserve',()=>race('STAGING'));
test('concurrent ACTIVE queued before recovery: preserve',()=>race('ACTIVE'));
test('ownership changed before activation: refuse and never clear foreign reservation',async()=>{const s=new IndexedDbVaultStore();const v=await stage(s);const original=await s.getMetadata();const other=structuredClone(original);other.salt[0]^=255;await s.putMetadata(other);await reject(()=>v.activate(auth,()=>{}));await reject(()=>v.discardStaging());equal(snapshotMetadata(await s.getMetadata()),snapshotMetadata(other));await inspect(s,'STAGING',2);await s.retireConnection()});
test('extra unknown metadata field: reject activation and discard',async()=>{const s=new IndexedDbVaultStore();const v=await stage(s);const original=await s.getMetadata();await s.putMetadata({...original,unknown:'synthetic'});await reject(()=>v.activate(auth,()=>{}));await reject(()=>v.discardStaging());equal((await s.getMetadata()).unknown,'synthetic');await inspect(s,'STAGING',2);await s.retireConnection()});
test('pre-activation cancellation: only owned reservation discarded',async()=>{const s=new IndexedDbVaultStore();const v=await stage(s);await v.discardStaging();await inspect(s,null,0);equal(v.isUnlocked(),false);await s.retireConnection()});
test('two concurrent creators: only one claim succeeds, losing creator cannot delete winner',async()=>{const a=new IndexedDbVaultStore(),b=new IndexedDbVaultStore();const va=fresh(a),vb=fresh(b);const results=await Promise.allSettled([va.createStaging(password),vb.createStaging(password)]);equal(results.filter(x=>x.status==='fulfilled').length,1);const loser=results[0].status==='rejected'?va:vb;const original=await a.getMetadata();await reject(()=>loser.discardStaging());equal(snapshotMetadata(await a.getMetadata()),snapshotMetadata(original));await a.retireConnection();await b.retireConnection()});
test('reopened ownerless vault cannot erase staging',async()=>{const s=new IndexedDbVaultStore();await stage(s);await s.retireConnection();const r=new IndexedDbVaultStore(indexedDB,true);await reject(()=>fresh(r).discardStaging());await inspect(r,'STAGING',2);await r.retireConnection()});
test('known abort then generic cleanup caller cannot erase a newly claimed reservation',async()=>{const s=new IndexedDbVaultStore();const v=await stage(s);injectActiveAbort();await reject(()=>v.activate(auth,()=>{}));await inspect(s,null,0);IDBObjectStore.prototype.put=put0;const second=fresh(s);await second.createStaging(password);const m=await s.getMetadata();await reject(()=>v.discardStaging());equal(snapshotMetadata(await s.getMetadata()),snapshotMetadata(m));await s.retireConnection()});
test('migration preserves source on confirmed abort and can then retry', async () => {
  const store = new IndexedDbVaultStore();
  const raw = JSON.stringify(initialData);
  localStorage.setItem(STORAGE_KEY, raw);
  try {
    const hits = injectActiveAbort();
    await reject(() => migrateLegacyToVault(localStorage, fresh(store), password, auth));
    equal(hits(), 1);
    equal(localStorage.getItem(STORAGE_KEY), raw);
    await inspect(store, null, 0);
    IDBObjectStore.prototype.put = put0;
    await migrateLegacyToVault(localStorage, fresh(store), password, auth);
    equal(localStorage.getItem(STORAGE_KEY), null);
    await store.retireConnection();
    const reopened = new IndexedDbVaultStore(indexedDB, true);
    const vault = fresh(reopened);
    await vault.unlock(password);
    equal(await vault.get('appData'), initialData);
    await reopened.retireConnection();
  } finally {
    localStorage.removeItem(STORAGE_KEY);
    await store.retireConnection();
  }
});
export const names=tests.map(t=>t.name);
export async function run(i){try{await tests[i].fn();return {name:tests[i].name,pass:true}}catch(e){return {name:tests[i].name,pass:false,error:String(e),stack:e.stack}}finally{IDBObjectStore.prototype.put=put0;IDBObjectStore.prototype.get=get0;IDBObjectStore.prototype.clear=clear0}}
