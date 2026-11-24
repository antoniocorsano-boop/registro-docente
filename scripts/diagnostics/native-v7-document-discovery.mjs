// F2-DEVICE: discover only lab V7 files created by Android ACTION_CREATE_DOCUMENT.
// Android is the owner of the file names and normally adds "(1)" on collision.
// Do not rename files via shell or interpret the receipt as proof of a new file.
const base=/^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc\.json$/;
const variants=[
 /^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2}) ?\(\d{1,3}\)\.enc\.json$/,
 /^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc ?\(\d{1,3}\)\.json$/,
 /^Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc\.json ?\(\d{1,3}\)$/
];
export function labV7Date(name) {
  if(typeof name!=='string')return null;
  const match=base.exec(name)||variants.map(r=>r.exec(name)).find(Boolean);
  return match?match[1]:null;
}
export function isOriginalV7Name(name){return base.test(name);}
export function selectNewLabV7Name(before,after){
  // Never guess a file by date alone. Each export must add exactly one
  // distinct, physically discoverable document; its old peer must still exist.
  if(!Array.isArray(before)||!Array.isArray(after)||
     before.some(n=>labV7Date(n)===null)||after.some(n=>labV7Date(n)===null)||
     new Set(before).size!==before.length||new Set(after).size!==after.length)
    throw Error('INVALID_LAB_V7_FILE_LIST');
  if(before.length===0){
    if(after.length!==1||!isOriginalV7Name(after[0]))
      throw Error('V7_FIRST_FILE_NOT_UNIQUE');
    return after[0];
  }
  if(before.length!==1||!isOriginalV7Name(before[0])||
     after.length!==2||!after.includes(before[0]))
    throw Error('V7_SECOND_DISTINCT_DOCUMENT_MISSING');
  const added=after.filter(n=>!before.includes(n));
  if(added.length!==1||added[0]===before[0]||
     labV7Date(added[0])!==labV7Date(before[0]))
    throw Error('V7_SECOND_DISTINCT_DOCUMENT_MISSING');
  return added[0];
}
// A constrained shell path for exact laboratory filenames; the quotes protect
// Android's parenthesized collision suffix, never arbitrary user input.
export function quotedLabV7Path(name){
  if(labV7Date(name)===null)throw Error('INVALID_LAB_V7_FILE_NAME');
  return "'/sdcard/Download/"+name+"'";
}
