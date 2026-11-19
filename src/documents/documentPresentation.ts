/** DOC-01/D1c: a synthetic, read-only presentation over the qualified D1b domain.
 * The raw canonical basis stays inside an ephemeral closure, never in the view.
 * Not a source adapter, official document, export, or persistent receipt.
 */
import { prepareDocumentPreview, confirmDocumentPreview } from './documentProjection';
const labels: Record<string,string> = {
  objectives:'Obiettivi disciplinari', transversal:'Raccordi trasversali',
  plannedActivities:'Attività programmate', completedCount:'Attività svolte',
  assessmentMethods:'Modalità di verifica', strategies:'Strategie didattiche',
};
const values: Record<string,string> = {
  'technical-systems':'Sistemi tecnologici', 'technical-representation':'Rappresentazione tecnica',
  'responsible-citizenship':'Cittadinanza responsabile', collaboration:'Collaborazione',
  'design-task':'Compito di progettazione', 'guided-analysis':'Analisi guidata',
  'practical-task':'Prova pratica', 'structured-observation':'Osservazione strutturata',
  'guided-practice':'Esercitazione guidata', 'progressive-support':'Supporto progressivo',
};
const origins: Record<string,string> = {arena:'Curricolo', 'docente-os':'Progettazione didattica', registro:'Attività registrate', teacher:'Scelta del docente'};
export type DocumentPresentationField = Readonly<{
  label:string; value:string|null; status:'Disponibile'|'Mancante'|'Da verificare';
  required:boolean; source:string|null;
}>;
export type DocumentPresentation = Readonly<{
  schoolYear:string; fields:readonly DocumentPresentationField[]; complete:boolean; official:false;
}>;
export type DocumentReview = Readonly<{
  presentation:DocumentPresentation;
  isCurrent:(context:unknown,template:unknown,sources:unknown)=>boolean;
}>;
export function createDocumentReview(context:unknown,template:unknown,sources:unknown):
  {valid:false}|{valid:true;review:DocumentReview} {
  const result=prepareDocumentPreview(context,template,sources);
  if(!result.valid)return {valid:false};
  const raw=result.preview;
  const rows=raw.fields.map((row):DocumentPresentationField=>Object.freeze({
    label:labels[row.key],
    value:row.state!=='available'?null:typeof row.value==='number'?String(row.value):values[String(row.value)]??null,
    status:row.state==='available'?'Disponibile':row.state==='review-required'?'Da verificare':'Mancante',
    required:row.required,
    source:row.provenance?origins[row.provenance.origin]??null:null,
  }));
  const presentation:DocumentPresentation=Object.freeze({
    schoolYear:raw.context.schoolYear,fields:Object.freeze(rows),complete:raw.complete,official:false,
  });
  const review:DocumentReview=Object.freeze({
    presentation,
    isCurrent:(c:unknown,t:unknown,s:unknown)=>confirmDocumentPreview(c,t,s,raw).valid,
  });
  return {valid:true,review};
}
