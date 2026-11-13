import regularFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf?url';
import boldFontUrl from 'dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf?url';
import { formatGrade } from '../utils';
import { RESTITUTION_FIELDS, type FormativeRestitution, type RestitutionDraft } from './formativeRestitution';

const TITLE = 'Bilancio formativo individuale';
const LEFT=15, RIGHT=195, BOTTOM=274;
const periodLabel = (period: FormativeRestitution['period']) => period==='Q1'?'1° periodo':period==='Q2'?'2° periodo':'Intero anno scolastico';
const dateLabel = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date)?date.split('-').reverse().join('/'):'Data non disponibile';
const normalize = (value: string) => value.replace(/\r\n?/g,'\n').replace(/\t/g,' ');

async function fontBase64(url: string) {
  const local=new URL(url,window.location.href);
  if(local.origin!==window.location.origin) throw new Error('Carattere PDF locale non disponibile.');
  const response=await fetch(local.href);
  if(!response.ok) throw new Error('Carattere PDF locale non disponibile.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  let binary='';
  for(let i=0;i<bytes.length;i+=16384) binary+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(binary);
}

/** Dedicated selectable-text document. Never reads DOM or a dossier.
 * Only the already reviewed protected model and teacher narrative are accepted.
 */
export async function renderFormativePdf(model: FormativeRestitution, draft: RestitutionDraft): Promise<ArrayBuffer> {
  if(typeof html2pdf==='undefined') throw new Error('Generatore PDF locale non disponibile.');
  if(model.version!==1 || model.rows.length!==model.summary.count) throw new Error('Bilancio non completo.');
  const header=[model.subject+' · '+model.schoolYear,model.classLabel+' · '+periodLabel(model.period),model.recipientLabel];
  const narrative=RESTITUTION_FIELDS.filter(([field])=>draft[field].trim()).map(([field,label])=>[label,normalize(draft[field])]);
  const metric='Media '+(model.weighted?'ponderata':'aritmetica')+': '+formatGrade(model.summary.mean);
  const counts=model.summary.count+' registrazioni; '+model.summary.numericCount+' valutazioni numeriche; '+(model.summary.count-model.summary.numericCount)+' senza voto numerico; '+model.summary.includedCount+' voti nella media.';
  const caution='La media è un indicatore di andamento, non un voto di scrutinio.';
  const noMean=model.summary.mean===null?'Media non disponibile: non equivale a un giudizio negativo.':'';
  const types=model.byType.map(t=>t.label+': '+formatGrade(t.mean)+' · '+t.count+' registrazioni · '+t.includedCount+' nella media'+(t.weight!==null?' · Peso '+t.weight+'%':''));
  const rows=model.rows.map((r,i)=>[
    (i+1)+'. '+dateLabel(r.date)+' · '+periodLabel(r.period)+' · '+r.type,
    normalize(r.title), ...(r.uda?[normalize(r.uda)]:[]),
    'Esito: '+r.value+(!r.included?' · Fuori media':'')+(r.delayed?' · Ritardo / recupero registrato':'')
  ]);
  const foot='L’elenco comprende tutte le registrazioni disponibili per il destinatario e il periodo. Attività non registrate non sono desunte dall’assenza di un voto.';
  const empty='Nessuna registrazione disponibile per il periodo selezionato.';
  const labels=[TITLE,'A. Sintesi formativa','B. Rendiconto delle valutazioni','Riepilogo per tipologia','Attività registrate nel periodo','Pagina 1 di 1','Nessuna sintesi inserita dal docente.'];
  const allText=[...labels,...header,...narrative.flat(),metric,counts,caution,noMean,...types,...rows.flat(),foot,empty];
  const seed=document.createElement('canvas');seed.width=1;seed.height=1;
  const ctx=seed.getContext('2d');if(!ctx)throw new Error('Generatore PDF locale non disponibile.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,1,1);
  const worker=(html2pdf() as any).set({margin:15,enableLinks:false,image:{type:'png'},jsPDF:{unit:'mm',format:'a4',orientation:'portrait',compress:false}}).from(seed,'canvas').toPdf();
  const pdf=await worker.get('pdf');
  const family='RegistroFormativo';
  const [regular,bold]=await Promise.all([fontBase64(regularFontUrl),fontBase64(boldFontUrl)]);
  pdf.addFileToVFS('RegistroFormativo-Regular.ttf',regular);
  pdf.addFileToVFS('RegistroFormativo-Bold.ttf',bold);
  pdf.addFont('RegistroFormativo-Regular.ttf',family,'normal');
  pdf.addFont('RegistroFormativo-Bold.ttf',family,'bold');
  for(const style of ['normal','bold']){
    pdf.setFont(family,style);
    const font=pdf.getFont().metadata;
    if(typeof font?.characterToGlyph!=='function')throw new Error('Carattere PDF non verificabile.');
    for(const value of allText)for(const char of normalize(value)){
      if(char==='\n')continue;
      const code=char.codePointAt(0)!;
      if(code<32||code>0xffff||!font.characterToGlyph(code))throw new Error('Il documento contiene caratteri non supportati dal PDF locale.');
    }
  }
  pdf.addPage();pdf.deletePage(1);pdf.setPage(1);
  pdf.setProperties({title:TITLE,subject:'Restituzione didattica',author:'',keywords:'',creator:'Registro Docente'});
  let y=15, section='A. Sintesi formativa', emitted=0;
  function style(size:number,bold=false){
    pdf.setFont(family,bold?'bold':'normal');pdf.setFontSize(size);pdf.setTextColor(15,23,42);
  }
  function rawLines(text:string,size:number,bold=false):string[]{
    style(size,bold);
    return normalize(text).split('\n').flatMap(line=>line?pdf.splitTextToSize(line,RIGHT-LEFT):['']);
  }
  function pageHeader(){
    y=15;style(15,true);pdf.text(TITLE,LEFT,y+5);y+=10;
    for(const line of header){
      const lines=rawLines(line,10);
      if(y+lines.length*4.6>65)throw new Error('Intestazione PDF troppo lunga.');
      for(const part of lines){pdf.text(part,LEFT,y+3.5);y+=4.6;}
    }
    y+=3;pdf.setDrawColor(160,174,192);pdf.line(LEFT,y,RIGHT,y);y+=6;
    style(12,true);pdf.text(section,LEFT,y+4);y+=10;
  }
  function newPage(){pdf.addPage();pageHeader();}
  function ensure(height:number){if(y+height>BOTTOM)newPage();}
  function paragraph(text:string,size=10,bold=false){
    if(!text)return;
    const lines=rawLines(text,size,bold), step=size*0.36*1.35;
    for(const line of lines){ensure(step);style(size,bold);pdf.text(line,LEFT,y+size*0.36);y+=step;}
    y+=2;
  }
  pageHeader();
  if(!narrative.length)paragraph('Nessuna sintesi inserita dal docente.');
  for(const [label,body] of narrative){ensure(15);paragraph(label,11,true);paragraph(body,11);y+=2;}
  section='B. Rendiconto delle valutazioni';newPage();
  paragraph(metric,14,true);paragraph(counts);paragraph(caution);paragraph(noMean);
  if(types.length){ensure(14);paragraph('Riepilogo per tipologia',11,true);for(const line of types)paragraph(line);}
  ensure(18);paragraph('Attività registrate nel periodo',11,true);
  if(!rows.length)paragraph(empty);
  for(const row of rows){
    // A complete ordinary record stays together; unusually long records may continue on the next page.
    const height=row.reduce((sum,line,index)=>sum+rawLines(line,index===0?10:11,index===0||index===row.length-1).length*(index===0?4.86:5.346)+2,0)+4;
    if(height<150)ensure(height);else ensure(12);
    paragraph(row[0],10,true);
    row.slice(1).forEach((line,index)=>paragraph(line,11,index===row.length-2));
    y+=2;emitted++;
  }
  paragraph(foot,9);
  const pages=pdf.internal.getNumberOfPages();
  for(let i=1;i<=pages;i++){pdf.setPage(i);style(9);pdf.setTextColor(71,85,105);pdf.text('Pagina '+i+' di '+pages,RIGHT,287,{align:'right'});}
  if(emitted!==model.rows.length||pages<2)throw new Error('Bilancio PDF incompleto.');
  const buffer:ArrayBuffer=pdf.output('arraybuffer');
  if(buffer.byteLength<1000||new TextDecoder().decode(buffer.slice(0,5))!=='%PDF-')throw new Error('Bilancio PDF non valido.');
  return buffer;
}
