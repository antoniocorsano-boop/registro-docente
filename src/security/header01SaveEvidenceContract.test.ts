import { describe, expect, test } from 'bun:test';
import { resolveHeaderSaveNotice } from '../components/headerSaveEvidence';

describe('HEADER-01 / Task 4 — indicazione di salvataggio basata su evidenza', () => {
  test('assenza di prove non diventa mai Sincronizzato o Salvato', () => {
    expect(resolveHeaderSaveNotice({})).toEqual({
      kind: 'unknown',
      message: null,
      scope: null,
    });
  });

  test('lo stato in corso non viene confuso con un precedente salvataggio', () => {
    expect(resolveHeaderSaveNotice({
      pendingWrites: 1,
      confirmedCommit: { operationId: 'old', scope: 'registro', durableConfirmed: true },
    })).toEqual({
      kind: 'saving',
      message: 'Salvataggio in corso',
      scope: null,
    });
  });

  test('salvato è possibile soltanto per una persistenza durevole esplicitamente confermata', () => {
    expect(resolveHeaderSaveNotice({
      confirmedCommit: { operationId: 'a', scope: 'biblioteca', durableConfirmed: false },
    }).kind).toBe('unknown');
    expect(resolveHeaderSaveNotice({
      confirmedCommit: { operationId: '', scope: 'biblioteca', durableConfirmed: true },
    }).kind).toBe('unknown');
    expect(resolveHeaderSaveNotice({
      confirmedCommit: { operationId: 'a', scope: 'biblioteca', durableConfirmed: true },
    })).toEqual({
      kind: 'saved-local',
      message: "Salvato nell'archivio locale",
      scope: 'biblioteca',
    });
  });

  test('un errore non viene coperto da un salvataggio successivo non correlato', () => {
    const result = resolveHeaderSaveNotice({
      pendingWrites: 2,
      confirmedCommit: { operationId: 'other', scope: 'registro', durableConfirmed: true },
      unresolvedFailure: { operationId: 'lost', scope: 'programmazione', unresolved: true },
    });
    expect(result).toEqual({
      kind: 'error',
      message: 'Salvataggio non riuscito',
      scope: 'programmazione',
    });
  });

  test('modifiche non salvate prevalgono su un vecchio successo solo quando verificate', () => {
    const latest = { operationId: 'c1', scope: 'registro' as const, durableConfirmed: true };
    expect(resolveHeaderSaveNotice({ confirmedCommit: latest, verifiedUnsavedChanges: true })).toEqual({
      kind: 'unsaved',
      message: 'Modifiche da salvare',
      scope: null,
    });
    expect(resolveHeaderSaveNotice({ confirmedCommit: latest, verifiedUnsavedChanges: false }).kind)
      .toBe('saved-local');
  });

  test('notifiche transitorie non cambiano lo stato del salvataggio', () => {
    const evidence = { toastMessage: 'Operazione completata' } as unknown as Parameters<typeof resolveHeaderSaveNotice>[0];
    expect(resolveHeaderSaveNotice(evidence).kind).toBe('unknown');
    expect(resolveHeaderSaveNotice({
      unresolvedFailure: { operationId: 'e1', scope: 'verifiche', unresolved: true },
      toastMessage: 'Sincronizzato',
    } as Parameters<typeof resolveHeaderSaveNotice>[0]).kind).toBe('error');
  });

  test('l’errore risolto non viene esposto come ancora attivo', () => {
    expect(resolveHeaderSaveNotice({
      unresolvedFailure: { operationId: 'e1', scope: 'impostazioni', unresolved: false },
      confirmedCommit: { operationId: 'fixed', scope: 'impostazioni', durableConfirmed: true },
    }).kind).toBe('saved-local');
  });
});
