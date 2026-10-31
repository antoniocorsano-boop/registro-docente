import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import type { LibrarySource } from '../library/types';
import type { UdaRecord } from '../types';
import { buildLibraryContextSnapshot } from '../library/contextualCoreAdapter';

const SOURCE: LibrarySource = {
  id: 'source-lib01c',
  kind: 'concept',
  title: 'Titolo privato da non esportare',
  capturedAt: '2026-10-24T10:00:00.000Z',
  sourceUrl: 'https://example.invalid/private-source',
  payload: { text: 'Contenuto privato da non esportare' },
  extractedText: 'Estratto privato da non esportare',
  notes: 'Nota privata da non esportare',
  status: 'ready',
  privacy: 'unknown',
  links: []
};

const UDA: UdaRecord = {
  id: 'uda-lib01c',
  title: 'Energia e trasformazioni',
  className: '3C',
  hours: 8,
  period: 'Q1',
  startMonth: 1,
  durationMonths: 2,
  lessons: [
    {
      id: 'lesson-lib01c',
      date: '2026-10-24',
      topic: 'Centrale elettrica: trasformazioni di energia',
      notes: 'Nota didattica da non esportare',
      hours: 1,
      activityType: 'laboratorio'
    }
  ]
};

const OTHER_UDA: UdaRecord = {
  ...UDA,
  id: 'uda-other',
  title: 'Altra UDA',
  lessons: [
    {
      id: 'lesson-other',
      date: '2026-10-25',
      topic: 'Altro contenuto',
      hours: 1,
      activityType: 'teoria'
    }
  ]
};

const OTHER_CLASS_UDA: UdaRecord = {
  ...UDA,
  id: 'uda-3e',
  title: 'Energia 3E',
  className: '3E',
  lessons: [
    {
      id: 'lesson-3e',
      date: '2026-10-24',
      topic: 'Energia 3E',
      hours: 1,
      activityType: 'teoria'
    }
  ]
};

async function loadTeachingContextModule() {
  try {
    const module = await import('../library/teachingContext');
    return { module, error: null as unknown };
  } catch (error) {
    return { module: null, error };
  }
}

type SuggestInput = {
  udas: UdaRecord[];
  currentClassName?: string | null;
  explicitContext?: { udaId: string; lessonId?: string } | null;
  lastExplicitChoice?: { udaId: string; lessonId?: string } | null;
  today: string;
};

type Suggestion = {
  context: { udaId: string; lessonId?: string };
  reason: 'explicit-origin' | 'current-class-today-lesson' | 'current-class-active-uda' | 'session-last-choice';
};

function suggestionFunction(module: unknown): ((input: SuggestInput) => Suggestion | null) | undefined {
  return (module as { suggestLibraryTeachingContext?: (input: SuggestInput) => Suggestion | null }).suggestLibraryTeachingContext;
}

describe('LIB-01C teaching context contract', () => {
  test('resolves only structural UDA/lesson context and rejects stale lesson ownership', async () => {
    const loaded = await loadTeachingContextModule();
    expect(loaded.error).toBeNull();
    expect(loaded.module).not.toBeNull();
    if (!loaded.module) return;

    const valid = loaded.module.resolveLibraryTeachingContext(
      [UDA, OTHER_UDA],
      { udaId: UDA.id, lessonId: UDA.lessons?.[0]?.id }
    );
    expect(valid).toEqual({
      udaId: 'uda-lib01c',
      className: '3C',
      period: 'Q1',
      lessonId: 'lesson-lib01c',
      activityType: 'laboratorio'
    });

    const stale = loaded.module.resolveLibraryTeachingContext(
      [UDA, OTHER_UDA],
      { udaId: UDA.id, lessonId: OTHER_UDA.lessons?.[0]?.id }
    );
    expect(stale).toBeNull();

    const udaOnly = loaded.module.resolveLibraryTeachingContext(
      [UDA],
      { udaId: UDA.id }
    );
    expect(udaOnly).toEqual({
      udaId: 'uda-lib01c',
      className: '3C',
      period: 'Q1'
    });
  });

  test('suggestion priority prefers a valid explicit origin over class and time signals', async () => {
    const loaded = await loadTeachingContextModule();
    expect(loaded.error).toBeNull();
    expect(loaded.module).not.toBeNull();
    if (!loaded.module) return;

    const suggest = suggestionFunction(loaded.module);
    expect(typeof suggest).toBe('function');
    if (!suggest) return;

    expect(suggest({
      udas: [UDA, OTHER_CLASS_UDA],
      currentClassName: '3C',
      explicitContext: { udaId: OTHER_CLASS_UDA.id, lessonId: 'lesson-3e' },
      today: '2026-10-24'
    })).toEqual({
      context: { udaId: 'uda-3e', lessonId: 'lesson-3e' },
      reason: 'explicit-origin'
    });
  });

  test('suggests the only lesson scheduled today for the current class', async () => {
    const loaded = await loadTeachingContextModule();
    expect(loaded.module).not.toBeNull();
    if (!loaded.module) return;
    const suggest = suggestionFunction(loaded.module);
    expect(typeof suggest).toBe('function');
    if (!suggest) return;

    expect(suggest({
      udas: [UDA, OTHER_CLASS_UDA],
      currentClassName: '3C',
      today: '2026-10-24'
    })).toEqual({
      context: { udaId: 'uda-lib01c', lessonId: 'lesson-lib01c' },
      reason: 'current-class-today-lesson'
    });
  });

  test('falls back to the only active UDA for the current class when today has no unique lesson', async () => {
    const loaded = await loadTeachingContextModule();
    if (!loaded.module) return;
    const suggest = suggestionFunction(loaded.module);
    expect(typeof suggest).toBe('function');
    if (!suggest) return;

    const activeWithoutTodayLesson: UdaRecord = {
      ...UDA,
      lessons: [{ ...UDA.lessons![0], date: '2026-10-23' }]
    };

    expect(suggest({
      udas: [activeWithoutTodayLesson, OTHER_CLASS_UDA],
      currentClassName: '3C',
      today: '2026-10-24'
    })).toEqual({
      context: { udaId: 'uda-lib01c' },
      reason: 'current-class-active-uda'
    });
  });

  test('never breaks ambiguity by array order and does not derive active UDA in July or August', async () => {
    const loaded = await loadTeachingContextModule();
    if (!loaded.module) return;
    const suggest = suggestionFunction(loaded.module);
    expect(typeof suggest).toBe('function');
    if (!suggest) return;

    const second3C: UdaRecord = {
      ...UDA,
      id: 'uda-second-3c',
      title: 'Seconda UDA 3C',
      lessons: [{ ...UDA.lessons![0], id: 'lesson-second', date: '2026-10-24' }]
    };

    expect(suggest({
      udas: [UDA, second3C],
      currentClassName: '3C',
      today: '2026-10-24'
    })).toBeNull();

    expect(suggest({
      udas: [UDA],
      currentClassName: '3C',
      today: '2027-07-15'
    })).toBeNull();
    expect(suggest({
      udas: [UDA],
      currentClassName: '3C',
      today: '2027-08-15'
    })).toBeNull();
  });

  test('uses only a still-valid same-class last explicit choice after stronger signals fail', async () => {
    const loaded = await loadTeachingContextModule();
    if (!loaded.module) return;
    const suggest = suggestionFunction(loaded.module);
    expect(typeof suggest).toBe('function');
    if (!suggest) return;

    expect(suggest({
      udas: [UDA, OTHER_CLASS_UDA],
      currentClassName: '3C',
      lastExplicitChoice: { udaId: UDA.id, lessonId: 'lesson-lib01c' },
      today: '2027-07-15'
    })).toEqual({
      context: { udaId: 'uda-lib01c', lessonId: 'lesson-lib01c' },
      reason: 'session-last-choice'
    });

    expect(suggest({
      udas: [UDA, OTHER_CLASS_UDA],
      currentClassName: '3C',
      lastExplicitChoice: { udaId: OTHER_CLASS_UDA.id, lessonId: 'lesson-3e' },
      today: '2027-07-15'
    })).toBeNull();

    expect(suggest({
      udas: [UDA, OTHER_UDA],
      currentClassName: '3C',
      lastExplicitChoice: { udaId: UDA.id, lessonId: 'lesson-other' },
      today: '2027-07-15'
    })).toBeNull();
  });

  test('invalid explicit origin falls through to deterministic class signals instead of being repaired', async () => {
    const loaded = await loadTeachingContextModule();
    if (!loaded.module) return;
    const suggest = suggestionFunction(loaded.module);
    expect(typeof suggest).toBe('function');
    if (!suggest) return;

    expect(suggest({
      udas: [UDA, OTHER_UDA],
      currentClassName: '3C',
      explicitContext: { udaId: UDA.id, lessonId: 'lesson-other' },
      today: '2026-10-24'
    })).toEqual({
      context: { udaId: 'uda-lib01c', lessonId: 'lesson-lib01c' },
      reason: 'current-class-today-lesson'
    });
  });

  test('adds minimized CURRICOLO teaching entities without weakening fail-closed source privacy', async () => {
    const loaded = await loadTeachingContextModule();
    expect(loaded.error).toBeNull();
    expect(loaded.module).not.toBeNull();
    if (!loaded.module) return;

    const teachingContext = loaded.module.resolveLibraryTeachingContext(
      [UDA],
      { udaId: UDA.id, lessonId: UDA.lessons?.[0]?.id }
    );
    expect(teachingContext).not.toBeNull();

    const snapshot = (buildLibraryContextSnapshot as unknown as (
      source: LibrarySource,
      teachingContext: unknown
    ) => ReturnType<typeof buildLibraryContextSnapshot>)(SOURCE, teachingContext);

    expect(snapshot.entities).toEqual([
      {
        type: 'library-source',
        id: 'source-lib01c',
        kind: 'concept',
        status: 'ready',
        privacy: 'unknown',
        linkCount: 0
      },
      {
        type: 'uda',
        id: 'uda-lib01c',
        className: '3C',
        period: 'Q1'
      },
      {
        type: 'lesson',
        id: 'lesson-lib01c',
        udaId: 'uda-lib01c',
        activityType: 'laboratorio'
      }
    ]);
    expect(snapshot.privacy.dataClasses).toEqual(['STUDENT_PERSONAL', 'CURRICOLO']);
    expect(snapshot.privacy.remoteProviderAllowed).toBe(false);
    expect(snapshot.surface).toBe('LIBRARY_SOURCE_TEACHING_CONTEXT');

    const serialized = JSON.stringify(snapshot);
    expect(serialized).not.toContain(SOURCE.title);
    expect(serialized).not.toContain(SOURCE.payload.text!);
    expect(serialized).not.toContain(SOURCE.extractedText!);
    expect(serialized).not.toContain(SOURCE.sourceUrl!);
    expect(serialized).not.toContain(SOURCE.notes!);
    expect(serialized).not.toContain(UDA.title);
    expect(serialized).not.toContain(UDA.lessons![0].topic);
    expect(serialized).not.toContain(UDA.lessons![0].notes!);
  });

  test('wires deterministic suggestion and teacher override into the exact Copilot launch context', () => {
    const cardSource = readFileSync(new URL('../components/LibrarySourceCard.tsx', import.meta.url), 'utf8');

    expect(cardSource).toContain('resolveLibraryTeachingContext');
    expect(cardSource).toContain('suggestLibraryTeachingContext');
    expect(cardSource).toContain('onExplicitTeachingContextChange');
    expect(cardSource).toContain("value.split('::')");
    expect(cardSource).toContain('setContextLessonId(lessonId)');
    expect(cardSource).toContain('onOpenCopilot');
    expect(cardSource).toContain('udaId: resolvedTeachingContext.udaId');
    expect(cardSource).toContain('lessonId: resolvedTeachingContext.lessonId');
    expect(cardSource).toContain('intent');
    expect(cardSource).not.toContain('resolveLibraryContextActions');
    expect(cardSource).not.toContain('dispatchLibraryContextAction');
    expect(cardSource).not.toContain('UDA di destinazione');
  });
});
