import { afterEach, describe, expect, test } from 'bun:test';
import { buildAssessmentGenerationRequest, isAssessmentGenerationRequestCurrent } from '../library/assessmentGeneration';
import { createGeminiAssessmentGenerationProvider } from '../server/geminiAssessmentGenerationProvider';
import { handleAssessmentGenerationRequest } from '../server/assessmentGenerationRoute';
import { requestAssessmentDraftFromCopilot } from '../services/assessmentGenerationService';
import type { LibrarySource } from '../library/types';
import type { AssessmentGenerationRequestV1 } from '../library/assessmentGeneration';
import type { AssessmentDraftV1 } from '../library/assessmentDraft';

const SOURCE: LibrarySource = {
  id:'source-1',kind:'note',title:'Energia',
  capturedAt:'2026-11-09T00:00:00Z',
  payload:{text:'Una turbina sfrutta un fluido in movimento.'},
  status:'ready',privacy:'teacher-professional',links:[]
};
const DRAFT: AssessmentDraftV1 = {
  schemaVersion:1,kind:'assessment-draft',title:'Energia',
  description:'Verifica formativa con revisione obbligatoria',
  questions:[{type:'multiple_choice',q:'Che cosa mette in moto una turbina idraulica?',
    options:['Acqua','Sole','Vento'],correct:0,explanation:'Una turbina idraulica usa acqua in movimento.'}]
};
const settings = {source:SOURCE,confirmedSourceId:'source-1',
  activeClassName:'3C',confirmedClassName:'3C',
  objective:'Verificare le trasformazioni energetiche.',explicitTeacherOptIn:true} as const;
const originalFetch=globalThis.fetch;
afterEach(()=>{globalThis.fetch=originalFetch});

function request():AssessmentGenerationRequestV1 {
  return buildAssessmentGenerationRequest(settings);
}
function fakeProvider(output: unknown = DRAFT) {
  let count=0;
  const instance={
    descriptor:{id:'fake',displayName:'Fake',model:'fake-1'},
    async generate(_input:unknown,_options:unknown) {count++;return{output,metadata:{promptTokens:20}};}
  };
  return {instance,get count(){return count;}};
}

describe('INT-02/S3b — costruzione locale e trasmissione governata',()=>{
  test('la fonte e la classe devono essere confermate prima dell’invio',()=>{
    expect(()=>buildAssessmentGenerationRequest({...settings,explicitTeacherOptIn:false})).toThrow();
    expect(()=>buildAssessmentGenerationRequest({...settings,confirmedClassName:'2C'})).toThrow();
    expect(()=>buildAssessmentGenerationRequest({...settings,confirmedSourceId:'altra'})).toThrow();
    expect(()=>buildAssessmentGenerationRequest({...settings,source:{...SOURCE,privacy:'student-personal'}})).toThrow();
    expect(()=>buildAssessmentGenerationRequest({...settings,source:{...SOURCE,status:'restricted'}})).toThrow();
    expect(()=>buildAssessmentGenerationRequest({...settings,source:{...SOURCE,kind:'image'}})).toThrow();
    expect(()=>buildAssessmentGenerationRequest({...settings,source:{
      ...SOURCE,payload:{text:'Lo studente Marco Rossi ha un PDP.'}
    }})).toThrow();
  });

  test('la richiesta è minimizzata, non contiene identificativi di fonte o UDA',()=>{
    const req=request();
    for(const forbidden of ['sourceId','classId','udaId','studentId','grades','provenance','dataBase64']){
      expect(JSON.stringify(req)).not.toContain(forbidden);
    }
    expect(req.context.className).toBe('3C');
  });

  test('la risposta viene invalidata se la fonte o la classe cambiano',()=>{
    const req=request();
    const live={source:SOURCE,confirmedSourceId:'source-1',activeClassName:'3C'};
    expect(isAssessmentGenerationRequestCurrent(req,live)).toBe(true);
    expect(isAssessmentGenerationRequestCurrent(req,{...live,activeClassName:'2C'})).toBe(false);
    expect(isAssessmentGenerationRequestCurrent(req,{...live,source:{...SOURCE,status:'restricted'}})).toBe(false);
    expect(isAssessmentGenerationRequestCurrent(req,{...live,source:{...SOURCE,payload:{text:'Fonte modificata'}}})).toBe(false);
    expect(isAssessmentGenerationRequestCurrent(req,{...live,source:null})).toBe(false);
  });

  test('il servizio client non restituisce una bozza divenuta estranea alla classe',async()=>{
    const req=request();
    let liveClass='3C',count=0;
    globalThis.fetch=(async(_url,opts)=>{
      count++;
      expect(_url).toBe('/api/copilot/assessment-draft');
      expect(opts?.method).toBe('POST');
      const body=JSON.parse(String(opts?.body));
      expect(body).toEqual(req);
      liveClass='2C';
      return new Response(JSON.stringify({draft:DRAFT,receipt:{
        requestId:'req',provider:'fake',model:'fake',attemptCount:1,
        budget:{tier:'remote-low',profile:'balanced',escalated:false},
        ignoredSecret:'MUST_NOT_SURFACE'
      }}),{status:200,headers:{'Content-Type':'application/json'}});
    }) as typeof fetch;
    await expect(requestAssessmentDraftFromCopilot({
      request:req,getLiveContext:()=>({source:SOURCE,confirmedSourceId:'source-1',activeClassName:liveClass})
    })).rejects.toMatchObject({code:'CONTEXT_CHANGED'});
    expect(count).toBe(1);
  });

  test('il servizio client controlla anche la risposta del provider e non effettua retry',async()=>{
    const req=request();
    let count=0;
    globalThis.fetch=(async()=>{
      count++;
      return new Response(JSON.stringify({draft:{...DRAFT,udaId:'iniettato'},receipt:{}}),{status:200});
    }) as typeof fetch;
    await expect(requestAssessmentDraftFromCopilot({
      request:req,getLiveContext:()=>({source:SOURCE,confirmedSourceId:'source-1',activeClassName:'3C'})
    })).rejects.toMatchObject({code:'PROVIDER_OUTPUT_INVALID'});
    expect(count).toBe(1);
  });
});

describe('INT-02/S3b — provider JSON guidato e confini remoti',()=>{
  test('schema strutturato, nessun tool e nessun identificativo aggiunto',async()=>{
    let sent:Record<string,any>|null=null;
    const provider=createGeminiAssessmentGenerationProvider({
      apiKey:'test-only',
      clientFactory:()=>({
        models:{generateContent:async (input:Record<string,unknown>)=>{
          sent=input as Record<string,any>;
          return {text:JSON.stringify(DRAFT),usageMetadata:{promptTokenCount:15,candidatesTokenCount:30}};
        }}
      })
    });
    const r=await provider.generate({
      source:{kind:'note',title:SOURCE.title,text:SOURCE.payload.text!},
      context:{className:'3C',objective:'Verificare la comprensione'}
    },{signal:new AbortController().signal,maxOutputTokens:1024});
    expect(r.output).toEqual(DRAFT);
    expect(sent?.config?.responseMimeType).toBe('application/json');
    expect(sent?.config?.responseJsonSchema?.properties?.kind?.enum).toEqual(['assessment-draft']);
    expect(sent?.config?.tools).toBeUndefined();
    expect(sent?.config?.candidateCount).toBe(1);
    expect(sent?.config?.maxOutputTokens).toBe(1024);
    const serialized=JSON.stringify(sent);
    for(const forbidden of ['GEMINI_API_KEY','sourceId','studentId','assessmentId','udaId']){
      expect(serialized).not.toContain(forbidden);
    }
  });

  test('il provider non configurato fallisce senza accesso al servizio remoto',async()=>{
    const p=createGeminiAssessmentGenerationProvider({});
    const result=await handleAssessmentGenerationRequest(request(),p);
    expect(result.status).toBe(503);
    expect(result.body).not.toHaveProperty('draft');
  });

  test('due richieste contemporanee identiche non invocano due volte il provider',async()=>{
    let resolve!: (v:{output:unknown;metadata:{}})=>void, count=0;
    const p={descriptor:{id:'fake',displayName:'Fake',model:'fake'},generate:async()=>{
      count++;
      return await new Promise<{output:unknown;metadata:{}}>(r=>{resolve=r;});
    }};
    const first=handleAssessmentGenerationRequest(request(),p);
    const second=await handleAssessmentGenerationRequest(request(),p);
    expect(second.status).toBe(409);
    expect(count).toBe(1);
    resolve({output:DRAFT,metadata:{}});
    const done=await first;
    expect(done.status).toBe(200);
  });

  test('l’annullamento e il superamento del tempo massimo non restituiscono bozze',async()=>{
    let resolve!: (v:any)=>void;
    const p={descriptor:{id:'fake',displayName:'Fake',model:'fake'},
      generate:async()=>await new Promise<any>(r=>{resolve=r;})};
    const config=(await import('../server/teachingProposalRuntime')).resolveTeachingProposalRuntimeConfig({});
    const pending=handleAssessmentGenerationRequest(request(),p,{
      config:{...config,deadlineMs:15}
    });
    const result=await pending;
    expect(result.status).toBe(504);
    expect(result.body).not.toHaveProperty('draft');
    resolve({output:DRAFT,metadata:{}});
  });
});
