import React from 'react';

export type MatrixSurface='daily'|'historical'|'evidence';
type Props=
 | {mode:'daily'|'historical';onChange:(mode:'daily'|'historical')=>void;laboratory?:false}
 | {mode:MatrixSurface;onChange:(mode:MatrixSurface)=>void;laboratory:true};

/** Existing two-view switcher, with an explicit laboratory-only third surface.
 * The normal application does not request laboratory mode. No data access. */
export function MatrixSurfaceSelector(props:Props){
 const style=(active:boolean)=>'min-h-[48px] min-w-0 rounded-lg border whitespace-normal [overflow-wrap:anywhere] '+(active?'neon-btn-primary':'border-[var(--border)]');
 return <div role="group" aria-label="Vista Tabellone" className={'grid gap-2 '+(props.laboratory?'grid-cols-3':'grid-cols-2')}>
  <button type="button" aria-pressed={props.mode==='daily'} onClick={()=>props.onChange('daily')} className={style(props.mode==='daily')}>Oggi</button>
  <button type="button" aria-pressed={props.mode==='historical'} onClick={()=>props.onChange('historical')} className={style(props.mode==='historical')}>Storico</button>
  {props.laboratory===true&&<button type="button" aria-pressed={props.mode==='evidence'} onClick={()=>props.onChange('evidence')} className={style(props.mode==='evidence')}>Evidenze</button>}
 </div>;
}
