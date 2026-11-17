import {describe,test,expect} from 'bun:test';
import {BootFault,createProtectedBootstrap,observeArchive,type BootObservation} from './protectedBootstrap';
const active:BootObservation={kind:'active',version:1};
const noWait=async()=>{};
function sequence(...steps:Array<BootObservation|Error>){
  let calls=0;
  const signals:AbortSignal[]=[];
  return {signals,calls:()=>calls,observe:async(signal:AbortSignal)=>{
    signals.push(signal);const step=steps[calls++];
    if(step instanceof Error)throw step;
    if(!step)throw Error('Unexpected read');return step;
  }};
}
describe('STAB-01 bootstrap coordinator',()=>{
  test('retry only classified temporary read; preserve first fault and fresh signal',async()=>{
    const s=sequence(new BootFault('open','blocked'),active);
    const delays:number[]=[];
    const controller=createProtectedBootstrap({observe:s.observe,established:()=>true,pause:async ms=>{delays.push(ms);}});
    expect(await controller.run()).toEqual({kind:'ok',observation:active,trace:[{attempt:1,phase:'open',code:'blocked'}]});
    expect(s.calls()).toBe(2);expect(s.signals[0]).not.toBe(s.signals[1]);expect(s.signals[0].aborted).toBe(true);expect(delays).toEqual([250]);
  });
  test('persistent transient failure has three bounded attempts',async()=>{
    const s=sequence(...Array.from({length:3},()=>new BootFault('inventory','aborted-read')));
    const result=await createProtectedBootstrap({observe:s.observe,established:()=>true,pause:noWait}).run();
    expect(result.kind).toBe('error');expect(result.trace).toHaveLength(3);expect(s.calls()).toBe(3);
  });
  for(const code of ['invalid-inventory','unsupported','staging','unknown','unavailable'] as const){
    test(code+' never retries or converts to new setup',async()=>{
      const s=sequence(new BootFault('classification',code),active);
      const result=await createProtectedBootstrap({observe:s.observe,established:()=>true,pause:noWait}).run();
      expect(result).toMatchObject({kind:'error',fault:{code},trace:[{attempt:1,phase:'classification',code}]});expect(s.calls()).toBe(1);
    });
  }
  test('version change permits exactly one fresh enumeration',async()=>{
    const s=sequence(new BootFault('open','version-changed'),new BootFault('open','version-changed'),active);
    const result=await createProtectedBootstrap({observe:s.observe,established:()=>true,pause:noWait}).run();
    expect(result).toMatchObject({kind:'error',fault:{code:'version-changed'}});expect(s.calls()).toBe(2);
  });
  test('version race resolves to active DB2 without granting authentication',async()=>{
    const s=sequence(new BootFault('open','version-changed'),{kind:'active',version:2});
    expect(await createProtectedBootstrap({observe:s.observe,established:()=>true,pause:noWait}).run()).toMatchObject({kind:'ok',observation:{kind:'active',version:2}});
  });
  test('known missing or empty archive stays protected, even if all reads succeed',async()=>{
    for(const missing of [{kind:'absent'},{kind:'empty',version:1}] as BootObservation[]){
      const s=sequence(missing,missing,missing);
      const result=await createProtectedBootstrap({observe:s.observe,established:()=>true,pause:noWait}).run();
      expect(result).toMatchObject({kind:'error',fault:{code:'missing-established'}});expect(s.calls()).toBe(3);
    }
  });
  test('fresh absence requires two observations and never creates storage',async()=>{
    const s=sequence({kind:'absent'},{kind:'absent'});
    const result=await createProtectedBootstrap({observe:s.observe,established:()=>false,pause:noWait}).run();
    expect(result).toEqual({kind:'ok',observation:{kind:'absent'},trace:[{attempt:1,phase:'classification',code:'confirm-absence'}]});expect(s.calls()).toBe(2);
  });
  test('established evidence acquired between attempts prevents new setup',async()=>{
    const s=sequence({kind:'absent'},{kind:'absent'},{kind:'absent'});let established=false;
    const result=await createProtectedBootstrap({observe:s.observe,established:()=>established,pause:async()=>{established=true;}}).run();
    expect(result).toMatchObject({kind:'error',fault:{code:'missing-established'}});
  });
  test('double retry shares exact in-flight promise; new generation ignores late result',async()=>{
    let calls=0,lateResolve!:(v:BootObservation)=>void;
    const controller=createProtectedBootstrap({established:()=>true,pause:noWait,observe:async()=>{
      calls++;if(calls===1)return new Promise<BootObservation>(resolve=>{lateResolve=resolve;});
      return active;
    }});
    const old=controller.run();expect(controller.run()).toBe(old);await Promise.resolve();
    controller.cancel();const fresh=controller.run();
    expect(await old).toMatchObject({kind:'error',fault:{code:'cancelled'}});
    expect(await fresh).toMatchObject({kind:'ok',observation:active});lateResolve({kind:'absent'});expect(calls).toBe(2);
  });
  test('deadline aborts an uncooperative read and bounds subsequent reads',async()=>{
    const signals:AbortSignal[]=[];
    const result=await createProtectedBootstrap({established:()=>true,pause:noWait,attemptMs:12,totalMs:100,
      observe:signal=>{signals.push(signal);return new Promise<BootObservation>(()=>{});}}).run();
    expect(result).toMatchObject({kind:'error',fault:{code:'timeout'}});
    expect(signals.length).toBe(3);expect(signals.every(s=>s.aborted)).toBe(true);
  });
});
describe('STAB-02 adapter abandonment',()=>{
  function fake(){
    const request:any={transaction:null,result:null,error:null};
    let opened=0,closed=0,aborted=0;
    const factory={databases:async()=>[{name:'registro-docente-secure-vault',version:1}],open:()=>{opened++;return request;}} as unknown as IDBFactory;
    return {factory,request,opened:()=>opened,closed:()=>closed,aborted:()=>aborted,
      lateUpgrade(){request.transaction={abort:()=>{aborted++;}};request.onupgradeneeded();},
      lateSuccess(){request.result={version:1,close:()=>{closed++;}};request.onsuccess();}};
  }
  test('abandoned request aborts a late upgrade and closes late success',async()=>{
    const f=fake(),controller=new AbortController();
    const result=observeArchive(f.factory,controller.signal);
    await new Promise(r=>setTimeout(r,0));expect(f.opened()).toBe(1);
    controller.abort();await expect(result).rejects.toMatchObject({code:'cancelled'});
    f.lateUpgrade();f.lateSuccess();expect(f.aborted()).toBe(1);expect(f.closed()).toBe(1);
  });
  test('blocked read abandons its request; late versionchange never commits',async()=>{
    const f=fake(),controller=new AbortController();
    const result=observeArchive(f.factory,controller.signal);await new Promise(r=>setTimeout(r,0));
    f.request.onblocked();await expect(result).rejects.toMatchObject({code:'blocked'});
    f.lateUpgrade();f.lateSuccess();expect(f.aborted()).toBe(1);expect(f.closed()).toBe(1);
  });
  test('unsupported enumeration never opens or creates',async()=>{
    let opened=0;const factory={databases:async()=>[{name:'registro-docente-secure-vault',version:3}],open:()=>{opened++;}} as unknown as IDBFactory;
    await expect(observeArchive(factory,new AbortController().signal)).rejects.toMatchObject({code:'unsupported'});expect(opened).toBe(0);
  });
});
