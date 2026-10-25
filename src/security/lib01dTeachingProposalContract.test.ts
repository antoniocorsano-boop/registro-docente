import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from '../library/types';
import type { UdaRecord } from '../types';
import type { ResolvedLibraryTeachingContext } from '../library/teachingContext';

const UDA: UdaRecord = {
  id: 'uda-lib01d',
  title: 'Energia e trasformazioni',
  className: '3C',
  hours: 8,
  period: 'Q1',
  startMonth: 1,
  durationMonths: 2,
  lessons: [
    {
      id: 'lesson-lib01d',
      date: '2026-10-25',
      topic: 'Trasformazioni di energia nella centrale elettrica',
      notes: 'Nota locale che non deve essere esportata',
      hours: 1,
      activityType: 'laboratorio'
    }
  ]
};

const CONTEXT: ResolvedLibraryTeachingContext = {
  udaId: UDA.id,
  className: UDA.className,
  period: UDA.period,
  lessonId: 'lesson-lib01d',
  activityType: 'laboratorio'
};

function source(overrides: Partial<LibrarySource> = {}): LibrarySource {
  return {
    id: 'source-lib01d',
    kind: 'concept',
    title: 'Centrale elettrica e trasformazioni',
    capturedAt: '2026-10-25T05:30:00.000Z',
    payload: { text: 'Una centrale elettrica trasforma energia primaria in energia elettrica.' },
    status: 'ready',
    privacy: 'teacher-professional',
    links: [],
    ...overrides
  };
}

async function loadProposalModule() {
  try {
    const module = await import('../library/teachingProposal');
    return { module, error: null as unknown };
  } catch (error) {
    return { module: null, error };
  }
}

describe('LIB-01D teaching proposal contract', () => {
  test('materializes the proposal module before any provider integration', async () => {
    const loaded = await loadProposalModule();
    expect(loaded.error).toBeNull();
    expect(loaded.module).not.toBeNull();
  });

  test('builds a minimized teacher-professional request from local text content', async () => {
    const loaded = await loadProposalModule();
    if (!loaded.module) return;

    const request = loaded.module.buildLibraryProposalRequest({
      source: source({
        extractedText: 'Estratto locale prioritario',
        notes: 'Nota privata che non deve uscire'
      }),
      teachingContext: CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: true
    });

    expect(request).toEqual({
      schemaVersion: 1,
      action: 'prepare-activity',
      classification: 'TEACHER_PROFESSIONAL',
      explicitTeacherOptIn: true,
      source: {
        id: 'source-lib01d',
        kind: 'concept',
        title: 'Centrale elettrica e trasformazioni',
        text: 'Estratto locale prioritario'
      },
      context: {
        udaId: 'uda-lib01d',
        udaTitle: 'Energia e trasformazioni',
        className: '3C',
        period: 'Q1',
        lessonId: 'lesson-lib01d',
        lessonTopic: 'Trasformazioni di energia nella centrale elettrica',
        activityType: 'laboratorio'
      }
    });

    const serialized = JSON.stringify(request);
    expect(serialized).not.toContain('Nota privata che non deve uscire');
    expect(serialized).not.toContain('Studente Sintetico');
    expect(serialized).not.toContain('studentId');
    expect(serialized).not.toContain('grade');
  });

  test('fails closed for URL-only web sources and unsupported file MIME types', async () => {
    const loaded = await loadProposalModule();
    if (!loaded.module) return;

    expect(() => loaded.module.buildLibraryProposalRequest({
      source: source({
        kind: 'web',
        sourceUrl: 'https://example.invalid/article',
        payload: {}
      }),
      teachingContext: CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: true
    })).toThrow('Contenuto della pagina non disponibile nella fonte');

    expect(() => loaded.module.buildLibraryProposalRequest({
      source: source({
        kind: 'file',
        payload: {
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          dataUrl: 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,AAAA'
        }
      }),
      teachingContext: CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: true
    })).toThrow('Formato file non supportato');
  });

  test('normalizes inline image and PDF data without leaking the data URL prefix', async () => {
    const loaded = await loadProposalModule();
    if (!loaded.module) return;

    const imageRequest = loaded.module.buildLibraryProposalRequest({
      source: source({
        kind: 'image',
        payload: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,QUJD' }
      }),
      teachingContext: CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: true
    });
    expect(imageRequest.source).toEqual({
      id: 'source-lib01d',
      kind: 'image',
      title: 'Centrale elettrica e trasformazioni',
      mimeType: 'image/png',
      dataBase64: 'QUJD'
    });

    const pdfRequest = loaded.module.buildLibraryProposalRequest({
      source: source({
        kind: 'file',
        payload: { mimeType: 'application/pdf', dataUrl: 'data:application/pdf;base64,JVBERg==' }
      }),
      teachingContext: CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: true
    });
    expect(pdfRequest.source.mimeType).toBe('application/pdf');
    expect(pdfRequest.source.dataBase64).toBe('JVBERg==');
  });

  test('requires explicit opt-in and parses only complete structured proposal content', async () => {
    const loaded = await loadProposalModule();
    if (!loaded.module) return;

    expect(() => loaded.module.buildLibraryProposalRequest({
      source: source(),
      teachingContext: CONTEXT,
      uda: UDA,
      explicitTeacherOptIn: false
    })).toThrow('Consenso remoto richiesto');

    const parsed = loaded.module.parseTeachingProposalContent({
      title: 'Dalla fonte al modello energetico',
      objective: 'Riconoscere le principali trasformazioni di energia.',
      teacherSetup: 'Mostrare la fonte e richiamare il lessico essenziale.',
      studentTask: 'Ricostruire la catena delle trasformazioni osservate.',
      steps: ['Osserva la fonte', 'Individua le trasformazioni', 'Confronta il modello'],
      questions: ['Quale energia entra?', 'Quale energia esce?'],
      adaptationHint: 'Ridurre i passaggi e fornire una tabella guida se necessario.'
    });
    expect(parsed.steps).toHaveLength(3);
    expect(parsed.questions).toHaveLength(2);

    expect(() => loaded.module.parseTeachingProposalContent({
      title: 'Incompleta',
      objective: '',
      steps: []
    })).toThrow('Proposta didattica non valida');
  });
});
