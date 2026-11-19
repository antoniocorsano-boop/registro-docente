/** DOC-01/D1b — pure synthetic projection for the disciplinary planning contribution.
 * No real data adapter, personal text, storage, network, export or official authority.
 * The exact canonical basis is internal laboratory evidence, not a signature.
 */
const fields = [
  { key:'objectives', origin:'arena', required:true, nature:'transcription', values:['technical-systems','technical-representation'] },
  { key:'transversal', origin:'arena', required:false, nature:'transcription', values:['responsible-citizenship','collaboration'] },
  { key:'plannedActivities', origin:'docente-os', required:true, nature:'transcription', values:['design-task','guided-analysis'] },
  { key:'completedCount', origin:'registro', required:false, nature:'deterministic-count', values:null },
  { key:'assessmentMethods', origin:'docente-os', required:true, nature:'transcription', values:['practical-task','structured-observation'] },
  { key:'strategies', origin:'teacher', required:false, nature:'teacher-selection', values:['guided-practice','progressive-support'] },
];
const contextKeys=['institutionId','classId','schoolYear','subject','grade','cohort','purpose'];
const templateKeys=['id','version','institutionId','grade','status'];
const sourceKeys=['field','value','origin','sourceId','revision','context','state','authority','mapping'];
const invalid=issue=>({valid:false as const,issue});
function plain(value: unknown): value is Record<string, any> {
  if (value===null || typeof value!=='object' || Array.isArray(value)) return false;
  if (![Object.prototype,null].includes(Object.getPrototypeOf(value))) return false;
  return Reflect.ownKeys(value).every(k=>{
    const d=Object.getOwnPropertyDescriptor(value,k);
    return typeof k==='string' && !!d && d.enumerable && Object.prototype.hasOwnProperty.call(d,'value');
  });
}
function exact(value: unknown, keys: string[]): value is Record<string, any> {
  return plain(value) && Object.keys(value).length===keys.length && keys.every(k=>Object.prototype.hasOwnProperty.call(value,k));
}
function dense(value: unknown): value is any[] {
  if (!Array.isArray(value) || value.length>100 || Reflect.ownKeys(value).length!==value.length+1) return false;
  return Array.from({length:value.length},(_,i)=>Object.getOwnPropertyDescriptor(value,String(i))).every(d=>!!d&&d.enumerable&&Object.prototype.hasOwnProperty.call(d,'value'));
}
const demoId=x=>typeof x==='string'&&/^demo-[a-z0-9-]{1,48}$/.test(x);
const positive=x=>Number.isSafeInteger(x)&&x>0;
function year(x: unknown): boolean {
  if(typeof x!=='string'||!/^20[0-9]{2}\/20[0-9]{2}$/.test(x))return false;
  return Number(x.slice(5))===Number(x.slice(0,4))+1;
}
function validContext(x: unknown): x is Record<string, any> {
  return exact(x,contextKeys)&&demoId(x.institutionId)&&demoId(x.classId)&&demoId(x.cohort)&&year(x.schoolYear)&&x.subject==='TEC'&&x.grade===2&&x.purpose==='annual-council-planning';
}
function validTemplate(x: unknown, c: Record<string, any>): x is Record<string, any> {
  return exact(x,templateKeys)&&x.id==='demo-council'&&x.version===1&&x.status==='synthetic'&&x.institutionId===c.institutionId&&x.grade===c.grade;
}
function canonical(value: unknown, depth=0): string {
  if(depth>20)throw Error('invalid depth');
  if(value===null||typeof value==='string'||typeof value==='boolean'||(typeof value==='number'&&Number.isSafeInteger(value)))return JSON.stringify(value);
  if(dense(value))return '['+value.map(v=>canonical(v,depth+1)).join(',')+']';
  if(plain(value))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k],depth+1)).join(',')+'}';
  throw Error('invalid value');
}
function validSource(x: unknown,c: Record<string, any>): x is Record<string, any> {
  if(!exact(x,sourceKeys)||!validContext(x.context)||canonical(x.context)!==canonical(c)||!demoId(x.sourceId)||!positive(x.revision))return false;
  const spec=fields.find(f=>f.key===x.field);
  if(!spec||x.origin!==spec.origin||!['confirmed','provisional'].includes(x.state))return false;
  if(x.origin==='arena'){
    if(!['approved-current','provisional','not-current'].includes(x.authority)||x.mapping!=='resolved')return false;
  }else{
    if(x.authority!=='not-applicable'||!(x.origin==='docente-os'?['resolved','ambiguous','unresolved']:['resolved']).includes(x.mapping))return false;
  }
  return spec.values===null?Number.isSafeInteger(x.value)&&x.value>=0:typeof x.value==='string'&&spec.values.includes(x.value);
}
function eligible(x: Record<string, any>): boolean {
  return x.state==='confirmed'&&x.mapping==='resolved'&&(x.origin!=='arena'||x.authority==='approved-current');
}
export function prepareDocumentPreview(context: unknown, template: unknown, sources: unknown) {
  try {
    if(!validContext(context))return invalid('INVALID_CONTEXT');
    if(!validTemplate(template,context))return invalid('INVALID_TEMPLATE');
    if(!dense(sources)||sources.length>fields.length)return invalid('INVALID_SOURCES');
    const selected=new Map<string,Record<string,any>>();
    for(const source of sources){
      if(!validSource(source,context)||selected.has(source.field))return invalid('INVALID_SOURCE');
      selected.set(source.field,source);
    }
    const projected=fields.map(spec=>{
      const s=selected.get(spec.key);
      const available=!!s&&eligible(s);
      return {key:spec.key,required:spec.required,nature:spec.nature,state:!s?'missing':available?'available':'review-required',value:available?s.value:null,
        provenance:s?{origin:s.origin,sourceId:s.sourceId,revision:s.revision}:null};
    });
    // Canonical detached data. Includes withheld synthetic source revisions so
    // a new review is required even when a changed source is not displayable.
    const basis=canonical({context,template,sources:fields.map(f=>selected.get(f.key)??null)});
    return {valid:true as const,preview:{kind:'synthetic-document-preview',official:false,confirmed:false,context:JSON.parse(canonical(context)),template:JSON.parse(canonical(template)),
      fields:projected,complete:projected.every(f=>!f.required||f.state==='available'),basis}};
  } catch { return invalid('INVALID_INPUT'); }
}
export function confirmDocumentPreview(context: unknown, template: unknown, sources: unknown, reviewed: unknown) {
  try {
    const current=prepareDocumentPreview(context,template,sources);
    if(!current.valid)return invalid('INVALID_CURRENT_SOURCE');
    if(canonical(reviewed)!==canonical(current.preview))return invalid('STALE_PREVIEW');
    // Explicit confirmation of the reviewed contents, not completion or approval.
    return {valid:true as const,document:{...current.preview,confirmed:true}};
  } catch { return invalid('INVALID_REVIEW'); }
}
