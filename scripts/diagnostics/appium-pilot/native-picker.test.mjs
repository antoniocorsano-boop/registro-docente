import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createPicker} from './native-picker.mjs';

const pkg='com.android.documentsui';
const app='it.trama.registrodocente.lab.ap02v7';
const node=(text,desc='',x=0)=>'<node text="'+text+'" content-desc="'+desc+'" package="'+pkg+'" resource-id="" class="android.widget.TextView" enabled="true" bounds="['+x+',0]['+(x+20)+',20]" />';
function fixture(initial,actions){
  let view=initial, foreground=pkg, now=0;const taps=[];
  const adb=(...args)=>{
    if(args[1]==='dumpsys')return 'topResumedActivity '+foreground+'/.Main';
    if(args[1]==='rm'||args[1]==='uiautomator')return '';
    if(args[1]==='cat')return '<hierarchy>'+view+'</hierarchy>';
    if(args[1]==='input'){
      taps.push(Number(args[3]));
      const next=actions.shift();
      assert.ok(next);
      if(next.fail)throw Error('unknown tap outcome');
      view=next.view??view;
      foreground=next.foreground??foreground;
      return '';
    }
    throw Error('unexpected command');
  };
  return {picker:createPicker({adb,api:32,now:()=>now,sleep:async ms=>{now+=ms;}}),taps};
}
test('canonical native path opens roots, selects Download and saves exactly once',async()=>{
  const f=fixture(node('','Show roots',0),[{view:node('Downloads','',20)},{view:node('Save','',40)},{foreground:app}]);
  await f.picker.run('save');
  assert.deepEqual(f.taps,[10,30,50]);
});
test('canonical native path selects exact document and observes automatic return',async()=>{
  const name='Backup_Valutazioni_V7_2026-11-24.enc.json';
  const f=fixture(node('Downloads')+node(name,'',20)+node(name,'Preview',40),[{foreground:app}]);
  await f.picker.run('open',name);
  assert.deepEqual(f.taps,[30]);
});
test('unknown tap outcome is never replayed',async()=>{
  const f=fixture(node('Downloads')+node('Save','',20),[{fail:true}]);
  await assert.rejects(f.picker.run('save'));
  assert.deepEqual(f.taps,[30]);
});
test('ambiguous save target does not authorize a tap',async()=>{
  const f=fixture(node('Downloads')+node('Save','',20)+node('Save','',40),[]);
  await assert.rejects(f.picker.run('save'));
  assert.deepEqual(f.taps,[]);
});
