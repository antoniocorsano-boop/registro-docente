/** Read version without opening, creating, upgrading or deleting an archive. */
export async function inspectArchiveVersion(factory:IDBFactory|undefined=globalThis.indexedDB):Promise<1|2|null>{
  if(!factory||typeof factory.databases!=='function')throw Error('Versione archivio non verificabile.');
  const matches=(await factory.databases()).filter(db=>db.name==='registro-docente-secure-vault');
  if(matches.length===0)return null;
  if(matches.length!==1||(matches[0].version!==1&&matches[0].version!==2))throw Error('Versione archivio non verificabile.');
  return matches[0].version;
}
