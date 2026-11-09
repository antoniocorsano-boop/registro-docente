import { describe, expect, test } from 'bun:test';
import { buildAiBudgetAssessmentKey } from '../library/assessmentGeneration';
import { createAiBudgetAuthorization } from '../copilot/aiBudgetGovernor';

const MODULE = new URL('../server/assessmentGenerationRoute.ts', import.meta.url);
const BASE = {
  schemaVersion: 1, action: 'generate-assessment-draft',
  classification: 'TEACHER_PROFESSIONAL', explicitTeacherOptIn: true,
  source: { kind: 'note', status: 'ready', privacy: 'teacher-professional',
    title: 'Materiale professionale Energia',
    text: 'Le centrali elettriche trasformano forme di energia primaria in energia elettrica.' },
  context: { className: '3C', objective: 'Verificare le trasformazioni energetiche.' },
  budget: { schemaVersion: 1, profile: 'balanced', activityKey: buildAiBudgetAssessmentKey('3C') }
};
const DRAFT = {
  schemaVersion: 1, kind: 'assessment-draft', title: 'Verifica energia',
  description: 'Esercizio formativo',
  questions: [
    { type: 'multiple_choice', q: 'Quale grandezza si misura in watt?',
      options: ['Energia', 'Potenza', 'Tensione'], correct: 1, explanation: 'La potenza si misura in watt.' }
  ]
};
function provider(output: unknown = DRAFT) {
  const calls: unknown[] = [];
  return {
    calls,
    instance: {
      descriptor: { id: 'fake', displayName: 'Servizio simulato', model: 'fake-model' },
      async generate(input: unknown, options: unknown) {
        calls.push({input,options});
        return { output, metadata: {promptTokens: 50,outputTokens: 100} };
      }
    }
  };
}

describe('INT-02/S3b — confine remoto per bozza di verifica', () => {
  test('il gestore dedicato esiste e non sostituisce quello delle attività', async () => {
    expect(await Bun.file(MODULE).exists()).toBe(true);
    if (!await Bun.file(MODULE).exists()) return;
    const module = await import('../server/assessmentGenerationRoute');
    expect(typeof module.handleAssessmentGenerationRequest).toBe('function');
  });

  test('rifiuta consenso assente, classificazione personale, fonte revocata e campi di autorità prima del provider', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest } = await import('../server/assessmentGenerationRoute');
    const cases = [
      { ...BASE, explicitTeacherOptIn: false },
      { ...BASE, classification: 'STUDENT_PERSONAL' },
      { ...BASE, source: {...BASE.source, status:'restricted'} },
      { ...BASE, source: {...BASE.source, privacy:'student-personal'} },
      { ...BASE, source: {...BASE.source, studentId:'id-1'} },
      { ...BASE, source: {...BASE.source, dataBase64:'YWJj'} },
      { ...BASE, context:{...BASE.context, udaId:'uda-autoselezionata'} },
      { ...BASE, studentGrades:[7,9] }
    ];
    for(const request of cases) {
      const {instance,calls}=provider();
      const result=await handleAssessmentGenerationRequest(request,instance);
      expect(result.status).toBeGreaterThanOrEqual(400);
      expect(calls).toHaveLength(0);
    }
  });

  test('rifiuta dati personali nel nome classe prima del provider', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest }=await import('../server/assessmentGenerationRoute');
    const className='3C alunno Marco Rossi';
    const {instance,calls}=provider();
    const result=await handleAssessmentGenerationRequest({
      ...BASE,
      context:{...BASE.context,className},
      budget:{...BASE.budget,activityKey:buildAiBudgetAssessmentKey(className)}
    },instance);
    expect(result.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  test('consente una sola produzione governata e restituisce soltanto bozza e ricevuta', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest } = await import('../server/assessmentGenerationRoute');
    const { instance,calls } = provider();
    const result=await handleAssessmentGenerationRequest(BASE,instance);
    expect(result.status).toBe(200);
    expect(result.body.draft).toEqual(DRAFT);
    expect(calls).toHaveLength(1);
    const input=JSON.stringify((calls[0] as any).input);
    for (const forbidden of ['studentId','sourceId','udaId','provenance','explicitTeacherOptIn','activityKey','grades','assessmentId']) {
      expect(input).not.toContain(forbidden);
    }
    expect((result.body as any).saved).toBeUndefined();
    expect((result.body as any).receipt).toMatchObject({provider:'fake',model:'fake-model',attemptCount:1});
  });

  test('scarta senza contenuti parziali una risposta con soluzione invalida o campi aggiunti',async()=>{
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest } = await import('../server/assessmentGenerationRoute');
    for (const output of [
      {...DRAFT,id:'test-che-non-deve-esistere'},
      {...DRAFT,questions:[{...DRAFT.questions[0],correct:20}]},
      {title:'Attività senza test'}
    ]) {
      const {instance}=provider(output);
      const result=await handleAssessmentGenerationRequest(BASE,instance);
      expect(result.status).toBe(502);
      expect(result.body).not.toHaveProperty('draft');
    }
  });

  test('rispetta il budget e non esegue richieste eccedenti senza consenso aggiuntivo',async()=>{
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest } = await import('../server/assessmentGenerationRoute');
    const longText='E'.repeat(20*1024);
    const {instance,calls}=provider();
    const result=await handleAssessmentGenerationRequest({
      ...BASE,source:{...BASE.source,text:longText},budget:{...BASE.budget,profile:'economy'}
    },instance);
    expect(result.status).toBe(409);
    expect(calls).toHaveLength(0);
  });

  test('rifiuta contenuto personale anche se introdotto nella proposta del provider', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest } = await import('../server/assessmentGenerationRoute');
    const {instance}=provider({...DRAFT,title:'Verifica per alunno Marco Rossi'});
    const result=await handleAssessmentGenerationRequest(BASE,instance);
    expect(result.status).toBe(502);
    expect(result.body).not.toHaveProperty('draft');
  });

  test('l’autorizzazione di aumento budget per singola operazione non può essere riutilizzata', async () => {
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest } = await import('../server/assessmentGenerationRoute');
    const authorization=createAiBudgetAuthorization({
      scope:'operation',
      activityKey:BASE.budget.activityKey,
      issuedAt:'2026-11-09T00:00:00.000Z'
    });
    const request={
      ...BASE,
      source:{...BASE.source,text:'E'.repeat(20 * 1024)},
      budget:{...BASE.budget,profile:'economy',authorization}
    };
    const {instance,calls}=provider();
    const options={now:()=> '2026-11-09T00:01:00.000Z'};
    const first=await handleAssessmentGenerationRequest(request,instance,options);
    expect(first.status).toBe(200);
    // Different ISO spellings represent the same instants and must not
    // revive a consumed one-operation authorization.
    const changedTimestampRepresentation={
      ...request,
      budget:{...request.budget,authorization:{
        ...authorization,
        issuedAt:'2026-11-09T00:00:00Z',
        expiresAt:'2026-11-09T00:05:00Z'
      }}
    };
    const second=await handleAssessmentGenerationRequest(changedTimestampRepresentation,instance,options);
    expect(second.status).toBe(409);
    const third=await handleAssessmentGenerationRequest(request,instance,options);
    expect(third.status).toBe(409);
    expect(calls).toHaveLength(1);
  });

  test('il provider privo di credenziali non riversa messaggi o dati sensibili nel risultato',async()=>{
    if (!await Bun.file(MODULE).exists()) return;
    const { handleAssessmentGenerationRequest } = await import('../server/assessmentGenerationRoute');
    const { TeachingProposalProviderError }=await import('../server/teachingProposalProvider');
    const {instance}=provider();
    instance.generate=async()=>{throw new TeachingProposalProviderError('not-configured')};
    const result=await handleAssessmentGenerationRequest(BASE,instance);
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain('GEMINI_API_KEY');
    expect(result.body).not.toHaveProperty('draft');
  });
});
