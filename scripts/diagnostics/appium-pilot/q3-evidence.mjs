// Reuse the canonical Q3 observations; this adapter never drives product UI.
import {execFileSync,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join} from 'node:path';
import {waitBootReadiness,emulatorIdentity,versionFacts,publicSurfaceFrame,isInteractiveElement,classifySurface} from '../native-lab-readiness.mjs';
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']}).trim();
async function boot(){
  let bootObservation=null;
  await waitBootReadiness(adb,{onState:state=>{bootObservation=state;}});
  if(Number(adb('shell','getprop','ro.build.version.sdk'))!==Number(process.env.AP02_API))throw Error('WRONG_API');
  const sdk=process.env.ANDROID_HOME||process.env.ANDROID_SDK_ROOT;
  if(!sdk)throw Error('SDK_UNAVAILABLE');
  const directory=join(sdk,'emulator'),binary=join(directory,'emulator');
  const identity=emulatorIdentity({probe:spawnSync(binary,['-version'],{encoding:'utf8',timeout:10000,killSignal:'SIGKILL'}),
    packageMetadata:readFileSync(join(directory,'source.properties'),'utf8'),
    binarySha256:createHash('sha256').update(readFileSync(binary)).digest('hex')});
  if(!identity.version)throw Error('EMULATOR_IDENTITY_UNAVAILABLE');
  const versions=versionFacts({adb:adb('version'),emulator:'Android emulator version '+identity.version+(identity.build?' (build_id '+identity.build+')':''),
    webview:adb('shell','dumpsys','webviewupdate'),androidBuild:adb('shell','getprop','ro.build.fingerprint'),
    runnerImage:process.env.ImageOS,runnerVersion:process.env.ImageVersion,node:process.version});
  for(const key of ['adb','platformTools','emulator','webviewPackage','webviewVersion','androidBuild','runnerImage','runnerVersion','node'])
    if(!versions[key])throw Error('VERSION_INCOMPLETE');
  return {bootObservation,bootReady:true,versions,emulatorIdentity:identity};
}
try{
  if(process.argv[2]==='boot')console.log(JSON.stringify(await boot()));
  else if(process.argv[2]==='surface')console.log('return ('+classifySurface.toString()+')({...('+publicSurfaceFrame.toString()+')(arguments[0],document,getComputedStyle,'+isInteractiveElement.toString()+'),foreground:true},arguments[1]);');
  else throw Error('INVALID_ADAPTER_MODE');
}catch{console.error('HYBRID_Q3_ADAPTER_FAILED');process.exitCode=1;}
