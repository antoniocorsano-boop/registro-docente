import { describe, expect, test } from 'bun:test';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync, chmodSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('../../', import.meta.url);
const signer = new URL('mobile/android-probe/sign-beta-locally.sh', root).pathname;
const prepare = new URL('mobile/android-probe/prepare-beta.mjs', root).pathname;
const certificate = 'a'.repeat(64);
const another = 'b'.repeat(64);
function withDirectory(run: (dir: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), 'registro-beta2-contract-'));
  try { run(dir); } finally { rmSync(dir, {recursive:true,force:true}); }
}
function write(path: string, value: string, executable=false) {
  writeFileSync(path,value);
  if(executable)chmodSync(path,0o700);
}
type Identity = {app:string;code:number;name:string;debug?:boolean;cert?:string;second?:string};
const base = {app:'it.trama.registrodocente',code:10003,name:'0.1.0-beta.1-rc.3'};
const candidate = {app:base.app,code:10004,name:'0.1.0-beta.2-rc.2'};
// Explicit SDK doubles, not cryptographic or APK evidence.
function signingAttempt(dir:string, next:Identity, prior:Identity|null, options:{key?:string;badHash?:boolean}={}) {
  const sdk=join(dir,'sdk'), tools=join(sdk,'build-tools','36.0.0');
  mkdirSync(tools,{recursive:true});
  const apk=(value:Identity)=>[
    "package: name='"+value.app+"' versionCode='"+value.code+"' versionName='"+value.name+"'",
    ...(value.debug?['application-debuggable']:[]),
    ...(value.cert?['Signer #1 certificate SHA-256 digest: '+value.cert]:[]),
    ...(value.second?['Signer #2 certificate SHA-256 digest: '+value.second]:[])
  ].join('\n')+'\n';
  write(join(tools,'aapt'),'#!/usr/bin/env bash\nset -euo pipefail\n[[ "$1" == dump && "$2" == badging ]]\ncat "$3"\n',true);
  write(join(tools,'zipalign'),'#!/usr/bin/env bash\nset -euo pipefail\nif [[ "$1" != -c ]]; then cp "$5" "$6"; fi\n',true);
  write(join(tools,'apksigner'),[
    '#!/usr/bin/env bash','set -euo pipefail',
    'if [[ "$1" == verify ]]; then',
    '  file="$2"; if [[ "$2" == --print-certs ]]; then file="$3"; fi',
    "  grep -q '^Signer #1 certificate SHA-256 digest:' \"$file\" || exit 1",
    "  if [[ \"$2\" == --print-certs ]]; then grep '^Signer #' \"$file\"; fi",
    'elif [[ "$1" == sign ]]; then',
    '  [[ "$2" == --ks && "$4" == --ks-key-alias && "$6" == --out ]]',
    '  cp "$8" "$7"',
    "  printf 'Signer #1 certificate SHA-256 digest: %s\\n' \"$(cat \"$3\")\" >> \"$7\"",
    'else exit 1','fi',''
  ].join('\n'),true);
  const unsigned=join(dir,'candidate.apk'),previous=join(dir,'previous.apk'),key=join(dir,'test-key.txt'),out=join(dir,'signed.apk');
  write(unsigned,apk(next));if(prior)write(previous,apk(prior));
  write(key,options.key??certificate);
  const expected=options.badHash?'0'.repeat(64):createHash('sha256').update(readFileSync(unsigned)).digest('hex');
  const proc=Bun.spawnSync(['bash',signer,unsigned,expected,key,out,...(prior?[previous]:[])],{
    env:{...process.env,ANDROID_HOME:sdk},stdout:'pipe',stderr:'pipe'
  });
  return {code:proc.exitCode,created:existsSync(out),output:proc.stdout.toString()+proc.stderr.toString()};
}
describe('BETA2-UPDATE-03 owner-local signing guard behavior (SDK doubles only)',()=>{
  test('permits increasing installed Beta1 RC3 to Beta2 RC2 with matching signer',()=>withDirectory(dir=>{
    const result=signingAttempt(dir,candidate,{...base,cert:certificate});
    expect(result.code).toBe(0);
    expect(result.created).toBe(true);
    expect(result.output).toContain('Signed candidate, NOT released');
  }));
  const refusals: {name:string;next:Identity;prior:Identity|null;options?:{key?:string;badHash?:boolean}}[]=[
    {name:'missing predecessor',next:candidate,prior:null},
    {name:'wrong source hash',next:candidate,prior:{...base,cert:certificate},options:{badHash:true}},
    {name:'different certificate',next:candidate,prior:{...base,cert:certificate},options:{key:another}},
    {name:'multiple previous signers',next:candidate,prior:{...base,cert:certificate,second:another}},
    {name:'Beta2 code below RC3 successor',next:{...candidate,code:10002},prior:{...base,cert:certificate}},
    {name:'rejected superseded Beta2 RC1 equals installed RC3 code',next:{...candidate,code:10003,name:'0.1.0-beta.2-rc.1'},prior:{...base,cert:certificate}},
    {name:'non-increasing code',next:candidate,prior:{...candidate,cert:certificate}},
    {name:'Beta series downgrade despite higher code',next:{...base,code:10005},prior:{...candidate,cert:certificate}},
    {name:'different application identity',next:{...candidate,app:'it.trama.registrodocente.lab.b43'},prior:{...base,cert:certificate}},
    {name:'unrecognized candidate version',next:{...candidate,name:'0.1.0-beta.3-rc.1'},prior:{...base,cert:certificate}},
    {name:'invalid predecessor version',next:candidate,prior:{...base,name:'unknown',cert:certificate}},
    {name:'debuggable candidate',next:{...candidate,debug:true},prior:{...base,cert:certificate}},
    {name:'debuggable predecessor',next:candidate,prior:{...base,debug:true,cert:certificate}}
  ];
  for(const refusal of refusals)test('rejects '+refusal.name+' and writes no output',()=>withDirectory(dir=>{
    const result=signingAttempt(dir,refusal.next,refusal.prior,refusal.options);
    expect(result.code).not.toBe(0);
    expect(result.created).toBe(false);
  }));
});
describe('BETA2-UPDATE-03 generated release identity validation',()=>{
  function attempt(dir:string,versionCode:number,versionName:string){
    write(join(dir,'prepare-beta.mjs'),readFileSync(prepare,'utf8'));
    write(join(dir,'beta-identity.json'),JSON.stringify({applicationId:base.app,label:'Registro Docente',versionCode,versionName,status:'UNSIGNED_CANDIDATE_NOT_RELEASED'}));
    const proc=Bun.spawnSync(['node',join(dir,'prepare-beta.mjs')],{stdout:'pipe',stderr:'pipe'});
    return proc.stderr.toString();
  }
  test('rejects invalid series and Beta2 version code below RC3 successor before accessing generated project',()=>withDirectory(dir=>{
    expect(attempt(dir,10004,'0.1.0-beta.3-rc.1')).toContain('Invalid Beta identity');
    expect(attempt(dir,10002,candidate.name)).toContain('Invalid Beta identity');
    expect(attempt(dir,10003,'0.1.0-beta.2-rc.1')).toContain('Invalid Beta identity');
    expect(attempt(dir,10004,candidate.name)).toContain('ENOENT');
  }));
});
