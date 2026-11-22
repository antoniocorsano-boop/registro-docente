// VAL-01/PRODUCT-05/S7d.3d — real Chromium on synthetic physical stores.
// Deliberately tests that simultaneous rollback of both origin stores can
// escape detection; NEVER call this an actual trusted anti-rollback witness.
const {chromium}=require('@playwright/test');
const assert=require('node:assert/strict');
const {mkdirSync,writeFileSync}=require('node:fs');
const {resolve}=require('node:path');
const origin=process.env.BASE_URL||'http://127.0.0.1:4173';
const candidate=process.env.CANDIDATE_SHA;
assert.match(candidate||'',/^[0-9a-f]{40}$/);
const target=resolve(process.env.V10_EVIDENCE_DIR||'../v10-evidence/browser');
mkdirSync(target,{recursive:true});
const stages=[];
function stage(name,details={}){
 stages.push({stage:name,status:'PASS',...details});
 writeFileSync(resolve(target,'result.json'),JSON.stringify({
  candidate,platform:'real-chromium',syntheticOnly:true,
  antiRollbackAuthority:'NOT_PROVIDED',results:stages
 },null,2)+'\n');
 console.log(name,'PASS');
}
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  const call=(action,...args)=>page.evaluate(({action,args})=>
   window.__val01V10Physical[action](...args),{action,args});
  await page.goto(origin,{waitUntil:'load'});
  assert.match(await page.locator('#status').textContent(),/sintetico disponibile/);
  const state=await page.evaluate(()=>window.__val01V10Physical.status());
  assert.equal(state.syntheticOnly,true);
  assert.equal(state.witnessStore,'web-localstorage');
  assert.match(state.storage,/NOT genuine anti-rollback/);
  stage('chromium-fixture-loaded',{origin:state.origin});
  assert.equal(await call('reset'),'pristine-synthetic-lab');
  const first=await call('first');
  assert.equal(first.outcome.state,'lab-anchored-not-official');
  assert.equal(first.outcome.epoch,1);
  await page.reload({waitUntil:'load'});
  assert.deepEqual((await call('inspect')).state,'consistent-synthetic-lab');
  assert.equal((await call('inspect')).epoch,1);
  stage('chromium-idb-cold-page-reload',{epoch:1});
  const second=await call('second');
  assert.equal(second.outcome.epoch,2);
  await page.reload({waitUntil:'load'});
  assert.equal((await call('inspect')).epoch,2);
  stage('chromium-versioned-epoch-two',{epoch:2});
  assert.equal((await call('rollbackPair')).state,'quarantined');
  await page.reload({waitUntil:'load'});
  assert.equal((await call('inspect')).state,'quarantined');
  stage('chromium-single-store-rollback-quarantined');
  assert.equal(await call('reset'),'pristine-synthetic-lab');
  await call('first');
  assert.equal((await call('removePair')).state,'quarantined');
  await page.reload({waitUntil:'load'});
  assert.equal((await call('inspect')).state,'quarantined');
  stage('chromium-missing-pair-quarantined');
  assert.equal(await call('reset'),'pristine-synthetic-lab');
  await call('first');
  assert.equal((await call('corruptHead')).state,'quarantined');
  await page.reload({waitUntil:'load'});
  assert.equal((await call('inspect')).state,'quarantined');
  stage('chromium-missing-trusted-head-quarantined');
  assert.equal(await call('reset'),'pristine-synthetic-lab');
  const fault=await call('faultAfterPair');
  assert.equal(fault.rejected,true);
  assert.equal(fault.inspection.state,'quarantined');
  assert.equal(fault.pairPresent,true);
  await page.reload({waitUntil:'load'});
  assert.equal((await call('inspect')).state,'quarantined');
  stage('chromium-ambiguous-idb-commit-fail-closed');
  assert.equal(await call('reset'),'pristine-synthetic-lab');
  await call('first');
  await call('second');
  // This passes as an explicit risk demonstration, NOT anti-rollback PASS.
  const both=await call('rollbackBoth');
  assert.deepEqual({state:both.state,epoch:both.epoch},
   {state:'consistent-synthetic-lab',epoch:1});
  stage('chromium-double-rollback-unprotected-observed',
   {limitation:'Both mutable stores reverted; no genuine trust root'});
  await page.screenshot({path:resolve(target,'synthetic-v10-browser.png')});
  assert.deepEqual(errors,[]);
  stage('chromium-no-page-errors',{scenarios:stages.length+1});
  await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
