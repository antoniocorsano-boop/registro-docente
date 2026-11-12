import { describe, expect, test } from 'bun:test';
import { buildObservationChanges, applyObservationChanges } from '../behavior/observationChanges';
import type { ClassData, BehaviorRecord } from '../types';

const old: BehaviorRecord = {id:'old',studentId:'s1',date:'2026-11-12',status:'Costruttivo 👍',note:'Nota fittizia'};
const cls: ClassData = {id:'class-a',name:'Sintetica',students:[{id:'s1',name:'Fittizio uno'},{id:'s2',name:'Fittizio due'}],grades:[],behaviors:[old]};
describe('FLOW-03 explicit behaviour contract, all routes', () => {
  test('no unobserved state, no rewriting an unchanged observation', () => {
    expect(buildObservationChanges(cls,old.date,new Map())).toEqual([]);
    expect(buildObservationChanges(cls,old.date,new Map([['s1',old.status]]))).toEqual([]);
    const changes=buildObservationChanges(cls,old.date,new Map([['s2','Distratto ⚠️']]));
    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({studentId:'s2',date:old.date,status:'Distratto ⚠️'});
    expect(applyObservationChanges(cls,changes).behaviors[0]).toEqual(old);
  });
  test('updates preserve note, identity and older legacy duplicates; other date isolated', () => {
    const prior={...old,id:'prior',note:'Nota precedente'};
    const other={...old,id:'other',date:'2026-11-11'};
    const base={...cls,behaviors:[prior,other,old]};
    const changes=buildObservationChanges(base,old.date,new Map([['s1','Distratto ⚠️']]));
    expect(changes).toEqual([{...old,status:'Distratto ⚠️'}]);
    expect(applyObservationChanges(base,changes).behaviors).toEqual([prior,other,{...old,status:'Distratto ⚠️'}]);
    expect(buildObservationChanges(base,'2026-11-11',new Map([['s1','Ottimale 🌟']]))[0].id).toBe('other');
  });
  test('invalid dates, duplicate student, foreign student and stale existing identity are rejected', () => {
    expect(buildObservationChanges(cls,'2026-02-30',new Map([['s2','Ottimale 🌟']]))).toEqual([]);
    expect(()=>applyObservationChanges(cls,[{...old,studentId:'foreign'}])).toThrow();
    expect(()=>applyObservationChanges(cls,[old,old])).toThrow();
    expect(()=>applyObservationChanges(cls,[{...old,id:'stale'}])).toThrow();
  });
  test('latest committed note remains authoritative', () => {
    const changes=buildObservationChanges(cls,old.date,new Map([['s1','Distratto ⚠️']]));
    const latest={...cls,behaviors:[{...old,note:'Nota aggiornata'}]};
    expect(applyObservationChanges(latest,changes).behaviors[0].note).toBe('Nota aggiornata');
  });
  test('ordinary and FLOW-03 share explicit editor and durable merge', async () => {
    const view=await Bun.file('src/components/BehaviorsView.tsx').text();
    const app=await Bun.file('src/App.tsx').text();
    expect(view).not.toContain("|| 'Ottimale 🌟'");
    expect(view).toContain('buildObservationChanges(currentClass, selectedDate, draftRef.current)');
    expect(view).toContain('key={props.currentClass.id}');
    expect(app).toContain('applyObservationChanges(targetClass, newRecords)');
    expect(app).toContain("completeRecordFlow('behaviour', navigationVersionAtSave, recordSessionAtSave, classId)");
    expect(app).toContain('onRegisterDraftGuard={registerBehaviorDraftGuard}');
  });
});
