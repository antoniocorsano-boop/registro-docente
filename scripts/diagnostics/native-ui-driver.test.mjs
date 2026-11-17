import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseNativeNodes,resumedActivity,createNativeUiDriver,NativeUiFault,demoRadio,vaultField,passwordEvidence,surface} from './native-ui-driver.mjs';
const pkg='it.trama.registrodocente';
const heading={text:'Configura archivio protetto',desc:'',pkg,id:'',clickable:false,enabled:true,focused:false,clazz:'android.widget.TextView',password:false,bounds:[115,800,966,889]};
const radio={text:'Ambiente dimostrativo Esplora con dati di esempio, non reali.',desc:'',pkg,id:'',clickable:true,enabled:true,focused:false,checked:false,clazz:'android.widget.RadioButton',password:false,bounds:[149,1438,194,1483]};
const field={text:'',desc:'',pkg,id:'vault-password',clickable:true,enabled:true,focused:false,checked:false,clazz:'android.widget.EditText',password:true,bounds:[115,1506,966,1638]};
const submit={text:'Avvia la prova',desc:'',pkg,id:'',clickable:true,enabled:true,focused:false,checked:false,clazz:'android.widget.Button',password:false,bounds:[115,1666,966,1795]};
const credential='synthetic-only';
function lab({view,foreground=()=>true,onTap=()=>{},onInput=()=>{},onClear=()=>{},onHide=()=>{}}){
  let time=0;const events=[],taps=[],inputs=[];
  const driver=createNativeUiDriver({pkg,readNodes:view,isForeground:foreground,now:()=>time,pause:async ms=>{time+=ms;},
    tap:n=>{taps.push(n);onTap(n);},input:s=>{inputs.push(s);onInput(s);},clear:onClear,hideKeyboard:onHide,report:e=>events.push(e)});
  return {driver,events,taps,inputs};
}
test('API32 XML parser decodes accessibility entities, IDs and bounds; invalid dump rejected',()=>{
  const xml='<hierarchy rotation="0"><node text="Ambiente dimostrativo &amp; prova" resource-id="" class="android.widget.RadioButton" package="'+pkg+'" content-desc="A &#x27; B" clickable="true" enabled="true" focused="false" checked="true" password="false" bounds="[149,1438][194,1483]"/></hierarchy>';
  const [n]=parseNativeNodes(xml);assert.equal(n.text,'Ambiente dimostrativo & prova');assert.equal(n.desc,"A ' B");assert.equal(n.checked,true);assert.deepEqual(n.bounds,[149,1438,194,1483]);
  assert.throws(()=>parseNativeNodes('ERROR: null root node'),NativeUiFault);
});
test('API32 and API36 activity formats match exact owner, not a different package',()=>{
  assert.equal(resumedActivity('mResumedActivity: ActivityRecord{123 u0 '+pkg+'/it.trama.MainActivity t1}',pkg),true);
  assert.equal(resumedActivity('topResumedActivity=ActivityRecord{123 u0 '+pkg+'/it.trama.MainActivity t1}',pkg),true);
  assert.equal(resumedActivity('topResumedActivity=ActivityRecord{123 u0 '+pkg+'.other/Activity t1}',pkg),false);
  assert.equal(resumedActivity('mLastPausedActivity: '+pkg+'/Activity',pkg),false);
});
test('artifact 14321827343 and 14334994658: real radio distinguished from title and other package',()=>{
  assert.equal(demoRadio(radio,pkg),true);
  assert.equal(demoRadio({...radio,text:'Ambiente dimostrativo',clazz:'android.widget.TextView',clickable:false},pkg),false);
  assert.equal(demoRadio({...radio,pkg:'other.package'},pkg),false);
  assert.equal(demoRadio({...radio,bounds:[1,1,1,1]},pkg),false);
  assert.equal(surface([heading,radio],pkg),'Configura archivio protetto');
});
test('artifact 14335019948: checked demo does not imply password focus',()=>{
  const observed=[{...heading,bounds:[115,585,966,672]},{...radio,checked:true,focused:true,bounds:[149,1220,194,1265]},{...field,text:'[redacted]',desc:'[redacted]'},submit];
  assert.equal(observed.some(n=>vaultField(n,pkg)&&n.focused),false);
  assert.equal(observed.filter(n=>vaultField(n,pkg)).length,1);
  assert.equal(passwordEvidence(observed[2],credential),null);
});
test('transient foreground mismatch discards sample and eventually selects only stable actual radio',async()=>{
  let selected=false,calls=0;
  const h=lab({view:()=>selected?[heading,{...radio,checked:true},field,submit]:[heading,radio],
    foreground:()=>++calls!==2,onTap:n=>{assert.equal(n.clazz,'android.widget.RadioButton');selected=true;}});
  await h.driver.selectDemo();assert.equal(h.taps.length,1);assert.equal(h.inputs.length,0);
});
test('reflow coordinates are never tapped until identical samples; postcondition required',async()=>{
  let samples=0,selected=false;
  const h=lab({view:()=>selected?[heading,radio,field,submit]:[heading,{...radio,bounds:++samples===1?[1,1,10,10]:radio.bounds}],
    onTap:n=>{assert.deepEqual(n.bounds,radio.bounds);selected=true;}});
  await h.driver.selectDemo();assert.equal(h.taps.length,1);
});
test('ambiguous or wrong-package radio never tapped; selection retry bounded',async()=>{
  for(const view of [[heading,radio,{...radio,bounds:[2,2,4,4]}],[heading,{...radio,pkg:'other'}]]){
    const h=lab({view:()=>view});await assert.rejects(h.driver.selectDemo(),NativeUiFault);
    assert.equal(h.taps.length,0);assert.equal(h.events.filter(e=>e.status==='RETRY').length,3);
  }
});
test('focus failure on first safe tap retries focus, then enters once; submit exactly once',async()=>{
  let taps=0,focused=false,text='';
  const h=lab({view:()=>[heading,radio,{...field,focused,text},submit],
    onTap:n=>{if(n.id==='vault-password'){if(++taps===2)focused=true;}},
    onInput:s=>{assert.equal(focused,true);text='•'.repeat(s.length);},
    onHide:()=>{focused=false;}});
  assert.equal(await h.driver.enterPassword(credential,heading.text),'masked-length');
  assert.equal(h.inputs.length,1);assert.equal(taps,2);
  await h.driver.submitGate('Avvia la prova',credential,heading.text);
  assert.equal(h.taps.filter(n=>n.clazz==='android.widget.Button').length,1);
  assert.equal(h.events.filter(e=>e.phase==='gate-submit'&&e.status==='SUBMITTED').length,1);
  assert.ok(!JSON.stringify(h.events).includes(credential));
});
test('partial input is cleared only with attested focus, no submit before exact/masked evidence',async()=>{
  let text='',focused=true,entries=0,clears=0;
  const h=lab({view:()=>[heading,{...field,focused,text},submit],onInput:s=>{text=++entries===1?'••':s;},onClear:()=>{assert.equal(focused,true);clears++;text='';}});
  assert.equal(await h.driver.enterPassword(credential,heading.text),'exact');assert.equal(entries,2);assert.equal(clears,1);
  assert.equal(h.taps.filter(n=>n.clazz==='android.widget.Button').length,0);
});
test('persistent focus failure never injects a credential or submits',async()=>{
  const h=lab({view:()=>[heading,radio,field,submit]});
  await assert.rejects(h.driver.enterPassword(credential,heading.text),NativeUiFault);
  assert.equal(h.inputs.length,0);assert.equal(h.taps.length,3);
});
test('gate requires field value, correct screen and unique enabled button in same sample',async()=>{
  for(const view of [[heading,{...field,text:'••'},submit],[heading,{...field,text:credential},submit,{...submit,bounds:[1,1,5,5]}],[{...heading,text:'Sicurezza non disponibile'},{...field,text:credential},submit]]){
    const h=lab({view:()=>view});
    await assert.rejects(h.driver.submitGate('Avvia la prova',credential,heading.text),NativeUiFault);
    assert.equal(h.taps.length,0);
  }
});
test('failed submit is not retried and does not report success',async()=>{
  const h=lab({view:()=>[heading,{...field,text:credential},submit],onTap:()=>{throw Error('synthetic input transport failure');}});
  await assert.rejects(h.driver.submitGate('Avvia la prova',credential,heading.text));
  assert.equal(h.taps.length,1);assert.equal(h.events.some(e=>e.status==='SUBMITTED'),false);
});
