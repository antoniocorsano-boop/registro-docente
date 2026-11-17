// Compiled inside each exact historical source checkout. Synthetic only.
import './beta2-archive-compatibility.fixture';
import { IndexedDbVaultStore } from '../../../src/security/vaultStore';
import { SecureVault } from '../../../src/security/secureVault';
const password='synthetic-archive-compatibility-only';
const store=new IndexedDbVaultStore();
const vault=new SecureVault(store);
async function attempt(action:()=>Promise<unknown>){
  try{await action();return 'ACCEPTED';}
  catch(e){return e instanceof DOMException?e.name:e instanceof Error?e.message:String(e);}
}
Object.assign(globalThis,{__val01FenceHistorical:{
  async read(){return attempt(()=>store.getMetadata());},
  async unlock(){return attempt(()=>vault.unlock(password));},
  async write(){return attempt(()=>store.putRecords([]));},
  async delete(){return attempt(()=>store.deleteRecord('appData'));},
  async clear(){return attempt(()=>vault.clearAll());},
  async initialize(){return attempt(()=>vault.initializeActive(password));},
  async removeFixtureRecord(){await store.deleteRecord('meta');}
}});
