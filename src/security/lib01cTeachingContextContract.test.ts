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

async function loadTeachingContextModule() {
  try {
    const module = await import('../library/teachingContext');
    return { module, error: null as unknown };
  } catch (error) {
    return { module: null, error };
  }
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
});
