import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import App, { type SessionLockRequest } from '../App';
import {
  CUSTOM_TESTS_KEY,
  META_KEY,
  SETTINGS_KEY,
  STORAGE_KEY,
  SUBMISSIONS_KEY,
  UDA_KEY
} from '../utils';
import { cleanupVerifiedLegacyAfterActivation, migrateLegacyToVault } from '../security/legacyMigration';
import {
  SecureAppStorage,
  decideVaultBootstrap,
  type SecureAppSnapshot,
  type VaultGateState
} from '../security/secureAppStorage';
import { initializeNewArchive, type NewArchiveSetup } from '../security/initialArchiveSetup';
import { SecureVault } from '../security/secureVault';
import { IndexedDbVaultStore } from '../security/vaultStore';
import { VaultControls } from './VaultControls';
import { VaultGate } from './VaultGate';
import { BootFault, bootMessage, createProtectedBootstrap, observeArchive } from '../security/protectedBootstrap';
import type { SuspendedMutationLease } from '../persistence/durableMutationCoordinator';
import {
  ANDROID_SESSION_EVENT, isAndroidSessionRuntime, readAndroidSessionState,
  authorizeAndroidSession, revokeAndroidSession, acknowledgeAndroidShield, registerAndroidFileAccess,
  type AndroidSessionState
} from '../security/androidSessionLifecycle';

const LEGACY_DATA_KEYS = [
  STORAGE_KEY,
  CUSTOM_TESTS_KEY,
  SETTINGS_KEY,
  UDA_KEY,
  SUBMISSIONS_KEY,
  META_KEY
] as const;

// Positive local evidence only: no credentials or personal records.
const ESTABLISHED_ARCHIVE_KEY = 'registro_archive_established_v1';
const COMPLETE_ARCHIVE_KEY = 'registro_archive_complete_v1';
const AUTO_LOCK_STORAGE_KEY = 'registro_auto_lock_minutes';
const DEFAULT_AUTO_LOCK_MS = 15 * 60_000;
type AutoLockMinutes = 0 | 15 | 30 | 60;

function readAutoLockMinutes(): AutoLockMinutes {
  const raw = window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY);
  const parsed = raw === null ? 15 : Number(raw);
  return parsed === 0 || parsed === 15 || parsed === 30 || parsed === 60 ? parsed : 15;
}

export const SecureRegistroRoot: React.FC = () => {
  const [gateState, setGateStateValue] = useState<VaultGateState>('CHECKING');
  const gateStateRef = useRef<VaultGateState>('CHECKING');
  const setGateState = useCallback((next: VaultGateState | ((current: VaultGateState) => VaultGateState)) => {
    const value = typeof next === 'function' ? next(gateStateRef.current) : next;
    gateStateRef.current = value;
    setGateStateValue(value);
  }, []);
  const [snapshot, setSnapshot] = useState<SecureAppSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockMinutes>(() => readAutoLockMinutes());
  const [isCopilotSurfaceOpen, setIsCopilotSurfaceOpen] = useState(false);
  const storeRef = useRef<IndexedDbVaultStore | null>(null);
  const vaultRef = useRef<SecureVault | null>(null);
  const storageRef = useRef<SecureAppStorage | null>(null);
  const lockRequestRef = useRef<SessionLockRequest | null>(null);
  const closingRef = useRef(false);
  const [closing, setClosing] = useState(false);
  const [closingDelayed, setClosingDelayed] = useState(false);
  const suspendRequestRef = useRef<(() => SuspendedMutationLease) | null>(null);
  const suspendedRef = useRef<SuspendedMutationLease | null>(null);
  const [suspensionPhase, setSuspensionPhase] = useState<'draining' | 'locked' | null>(null);
  const [suspensionDelayed, setSuspensionDelayed] = useState(false);
  const nativeStateRef = useRef<AndroidSessionState | null>(null);
  const authenticatedEpochRef = useRef<number | null>(null);
  const lifecycleRevisionRef = useRef(0);
  const [nativeState, setNativeState] = useState<AndroidSessionState | null>(null);
  const bootstrapGenerationRef = useRef(0);
  const bootstrapRef = useRef<ReturnType<typeof createProtectedBootstrap> | null>(null);
  const establishedArchive = useCallback(() =>
    window.localStorage.getItem(ESTABLISHED_ARCHIVE_KEY) === '1' ||
    window.localStorage.getItem(COMPLETE_ARCHIVE_KEY) === '1', []);
  const protectedBootstrap = useCallback(() => {
    if (!bootstrapRef.current) bootstrapRef.current = createProtectedBootstrap({
      observe: signal => observeArchive(globalThis.indexedDB, signal,
        window.localStorage.getItem(COMPLETE_ARCHIVE_KEY) === '1'),
      established: establishedArchive
    });
    return bootstrapRef.current;
  }, [establishedArchive]);
  const registerSessionSuspension = useCallback((request: (() => SuspendedMutationLease) | null) => {
    suspendRequestRef.current = request;
  }, []);
  const registerSessionLockRequest = useCallback((request: SessionLockRequest | null) => {
    lockRequestRef.current = request;
  }, []);

  const getRuntime = useCallback(() => {
    if (!storeRef.current) {
      storeRef.current = new IndexedDbVaultStore(globalThis.indexedDB);
      vaultRef.current = new SecureVault(storeRef.current);
      storageRef.current = new SecureAppStorage(vaultRef.current);
    }

    return {
      store: storeRef.current,
      vault: vaultRef.current!,
      storage: storageRef.current!
    };
  }, []);

  const inspectBootstrap = useCallback(async () => {
    const generation = ++bootstrapGenerationRef.current;
    const current = () => generation === bootstrapGenerationRef.current;
    setGateState('CHECKING');
    setErrorMessage(null);

    if (!globalThis.indexedDB || !globalThis.crypto?.subtle) {
      setErrorMessage('IndexedDB o Web Crypto non sono disponibili: nessun archivio verrà creato.');
      setGateState('ERROR');
      return;
    }
    try {
      // Never construct the writable store before read-only classification.
      const result = await protectedBootstrap().run();
      if (!current()) return;
      if (result.kind === 'error') throw result.fault;
      const observation = result.observation;
      if (observation.kind === 'active') {
        // The regular product entrypoint owns DB1; DB2 remains laboratory-only.
        if (observation.version !== 1) {
          throw new Error('Versione archivio non attiva in questo Registro. I dati non verranno modificati.');
        }
        window.localStorage.setItem(ESTABLISHED_ARCHIVE_KEY, '1');
        setGateState('LOCKED');
        return;
      }
      if (observation.kind === 'erased') {
        throw new Error('Archivio aggiornato da verificare: nessuna inizializzazione automatica.');
      }
      const hasLegacyData = LEGACY_DATA_KEYS.some(key => window.localStorage.getItem(key) !== null);
      const nextState = decideVaultBootstrap({
        metadataState: null, hasLegacyData, indexedDbAvailable: true, webCryptoAvailable: true,
        archivePreviouslyEstablished: establishedArchive(), physicalArchiveStatus: 'absent'
      });
      setGateState(nextState);
      if (nextState === 'ERROR') {
        setErrorMessage('Archivio precedente non verificabile. Non cancellare i dati o le copie cifrate.');
      }
    } catch (error) {
      if (!current()) return;
      setErrorMessage(error instanceof BootFault ? bootMessage(error) :
        error instanceof Error ? error.message : 'Controllo di sicurezza non riuscito.');
      setGateState('ERROR');
    }
  }, [protectedBootstrap, establishedArchive]);

  useEffect(() => {
    void inspectBootstrap();
    return () => {
      bootstrapGenerationRef.current++;
      bootstrapRef.current?.cancel();
    };
  }, [inspectBootstrap]);

  const revokeNativeAuthorization = useCallback(() => {
    const epoch = authenticatedEpochRef.current;
    authenticatedEpochRef.current = null;
    if (epoch !== null && isAndroidSessionRuntime()) {
      void revokeAndroidSession(epoch).catch(() => {});
    }
  }, []);

  const lockImmediately = useCallback(() => {
    revokeNativeAuthorization();
    vaultRef.current?.lock();
    setSnapshot(null);
    // A confirmed reset can finish while the manual lock is draining.
    // Its terminal setup state is authoritative, even if React batches
    // the reset and lock updates in the same render.
    setGateState(current => current === 'READY' ? 'LOCKED' : current);
  }, [revokeNativeAuthorization]);

  // Manual lock and menu exit share the App's existing draft guard.
  // Close admission synchronously before hiding the still-mounted App so
  // already accepted durable work can settle without starting new work.
  const handleLock = useCallback(() => {
    if (closingRef.current) return;
    const request = lockRequestRef.current;
    if (!request) return; // No active App authority; never silently discard its drafts.
    request(drain => {
      if (closingRef.current) return;
      closingRef.current = true;
      revokeNativeAuthorization();
      const settled = drain();
      setClosingDelayed(false);
      setClosing(true);
      const warning = window.setTimeout(() => setClosingDelayed(true), 10_000);
      void settled.then(() => {
        window.clearTimeout(warning);
        lockImmediately();
        closingRef.current = false;
        setClosing(false);
        setClosingDelayed(false);
      });
    });
  }, [lockImmediately, revokeNativeAuthorization]);

  // The Android shield is installed before onPause returns. JS admission closes
  // on the native generation change; drafts remain only in this mounted tree.
  // The archive key is dropped after admitted operations settle (or on deadline).
  const beginSuspension = useCallback(() => {
    if (gateStateRef.current !== 'READY' || closingRef.current || suspendedRef.current) return;
    const request = suspendRequestRef.current;
    if (!request) {
      lockImmediately();
      return;
    }
    const lease = request();
    suspendedRef.current = lease;
    revokeNativeAuthorization();
    setSuspensionDelayed(false);
    setSuspensionPhase('draining');
    const deadline = window.setTimeout(() => {
      if (suspendedRef.current !== lease) return;
      vaultRef.current?.lock();
      setSuspensionDelayed(true);
    }, 10_000);
    void lease.drained.then(() => {
      window.clearTimeout(deadline);
      if (suspendedRef.current !== lease) return;
      vaultRef.current?.lock();
      if (gateStateRef.current !== 'READY') {
        suspendedRef.current = null;
        setSuspensionPhase(null);
        return;
      }
      setSuspensionPhase('locked');
    });
  }, [lockImmediately, revokeNativeAuthorization]);

  const syncNativeSession = useCallback(async (): Promise<AndroidSessionState | null> => {
    try {
      const current = await readAndroidSessionState();
      if (!current) return null;
      const previous = nativeStateRef.current;
      if (previous && (current.epoch < previous.epoch ||
          (current.epoch === previous.epoch && previous.foreground && !current.foreground))) {
        return previous;
      }
      if (!previous || current.epoch !== previous.epoch || current.foreground !== previous.foreground) {
        lifecycleRevisionRef.current += 1;
      }
      nativeStateRef.current = current;
      setNativeState(current);
      if (gateStateRef.current === 'READY' &&
          (!current.foreground || authenticatedEpochRef.current !== current.epoch)) {
        beginSuspension();
      }
      return current;
    } catch (error) {
      // A missing or invalid native authority must never be treated as a web fallback.
      lifecycleRevisionRef.current += 1;
      beginSuspension();
      throw error;
    }
  }, [beginSuspension]);

  useEffect(() => {
    if (!isAndroidSessionRuntime()) return;
    const sync = () => { void syncNativeSession().catch(() => {}); };
    // Invalidate pending authorization synchronously on the lifecycle signal,
    // even before the asynchronous native state query returns.
    const lifecycleChanged = () => {
      lifecycleRevisionRef.current += 1;
      sync();
    };
    document.addEventListener(ANDROID_SESSION_EVENT, lifecycleChanged);
    // Visibility is only a secondary notification. The generation is native.
    document.addEventListener('visibilitychange', sync);
    sync();
    return () => {
      document.removeEventListener(ANDROID_SESSION_EVENT, lifecycleChanged);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [syncNativeSession]);

  useLayoutEffect(() => {
    if (!nativeState?.foreground) return;
    const protectedSurface = gateState !== 'READY' || closing || suspensionPhase !== null;
    if (protectedSurface || authenticatedEpochRef.current === nativeState.epoch) {
      // This acknowledgment only removes the native cover after React has committed
      // a protected surface or a freshly authenticated session.
      void acknowledgeAndroidShield(nativeState.epoch, !protectedSurface).catch(() => {});
    }
  }, [nativeState, gateState, closing, suspensionPhase]);

  const getForegroundEpoch = useCallback(async () => {
    const native = await syncNativeSession();
    if (!native) return { epoch: null, revision: lifecycleRevisionRef.current };
    if (!native.foreground) throw new Error('Rientra nel Registro per autenticarti.');
    return { epoch: native.epoch, revision: lifecycleRevisionRef.current };
  }, [syncNativeSession]);

  // Only the synchronous commit callback may consume the admission lease or
  // reveal the App. No await between the last validation and that commit.
  const confirmForegroundEpoch = useCallback(async (
    attempt: { epoch: number | null; revision: number }, commit: () => void
  ) => {
    const { epoch, revision } = attempt;
    if (epoch === null) { commit(); return; }
    const assertCurrent = () => {
      const observed = nativeStateRef.current;
      if (lifecycleRevisionRef.current !== revision || !observed?.foreground || observed.epoch !== epoch) {
        throw new Error('Sessione Android cambiata. Autenticati nuovamente.');
      }
    };
    assertCurrent();
    try {
      await authorizeAndroidSession(epoch);
      // A successful bridge response can itself be stale. Query again and
      // compare both the observed epoch and all intervening lifecycle signals.
      const latest = await syncNativeSession();
      if (!latest?.foreground || latest.epoch !== epoch) {
        throw new Error('Sessione Android cambiata. Autenticati nuovamente.');
      }
      assertCurrent();
      authenticatedEpochRef.current = epoch;
      commit();
    } catch (error) {
      if (authenticatedEpochRef.current === epoch) authenticatedEpochRef.current = null;
      // Do not revoke a newer foreground generation after stale authorization.
      await revokeAndroidSession(epoch).catch(() => {});
      throw error;
    }
  }, [syncNativeSession]);

  const resumeSuspendedSession = useCallback(async (password: string) => {
    const lease = suspendedRef.current;
    if (!lease) throw new Error('Sessione non disponibile.');
    const attempt = await getForegroundEpoch();
    if (attempt.epoch === null) throw new Error('Sessione Android non disponibile.');
    const { vault } = getRuntime();
    try {
      await vault.unlock(password);
      // Recheck the native generation after the asynchronous cryptographic unlock.
      await confirmForegroundEpoch(attempt, () => {
        if (suspendedRef.current !== lease || !lease.resume()) {
          throw new Error('Sessione cambiata. Autenticati nuovamente.');
        }
        suspendedRef.current = null;
        setSuspensionDelayed(false);
        setSuspensionPhase(null);
      });
    } catch (error) {
      vault.lock();
      authenticatedEpochRef.current = null;
      throw error;
    }
  }, [getRuntime, getForegroundEpoch, confirmForegroundEpoch]);

  useEffect(() => {
    if (!isAndroidSessionRuntime()) return;
    return registerAndroidFileAccess(async isActive => {
      // The document result may arrive before the native resume event. Query the
      // authoritative generation before allowing any read, write or receipt.
      const expires = Date.now() + 120_000;
      while (isActive() && Date.now() < expires && gateStateRef.current === 'READY' && !closingRef.current) {
        const current = await syncNativeSession();
        if (current?.foreground && authenticatedEpochRef.current === current.epoch &&
            !suspendedRef.current && vaultRef.current?.isUnlocked()) return isActive();
        await new Promise<void>(resolve => window.setTimeout(resolve, 100));
      }
      return false;
    });
  }, [syncNativeSession]);

  const loadReadySnapshot = useCallback(async (attempt: { epoch: number | null; revision: number }) => {
    const { storage } = getRuntime();
    let physicallyComplete = false;
    const nextSnapshot = await storage.loadSnapshot(value => { physicallyComplete = value; });
    if (window.localStorage.getItem(COMPLETE_ARCHIVE_KEY) === '1' && !physicallyComplete) {
      throw new Error('Archivio precedentemente completo ora incompleto. Nessun dato verrà sovrascritto.');
    }

    // Teacher navigation starts from a neutral Home on every vault bootstrap.
    // Replace, rather than push, the current entry so Back cannot restore a
    // class/tab state that was active before reload or lock/unlock.
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') !== 'student') {
      params.delete('class');
      params.delete('tab');
      const query = params.toString();
      const nextUrl = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      try {
        // Keep the app-owned history position: replacing the neutral bootstrap
        // entry must not restart numbering while older entries remain reachable.
        // Remove only stale class/tab authority, never the position marker.
        const existingPosition = window.history.state?.__tramaHistoryPosition;
        const existingEpoch = window.history.state?.__tramaHistoryEpoch;
        const existingEntryId = window.history.state?.__tramaHistoryEntryId;
        const markers = {
          ...(Number.isSafeInteger(existingPosition) ? { __tramaHistoryPosition: existingPosition } : {}),
          ...(typeof existingEpoch === 'string' && existingEpoch.length > 0
            ? { __tramaHistoryEpoch: existingEpoch } : {}),
          ...(typeof existingEntryId === 'string' && existingEntryId.length > 0
            ? { __tramaHistoryEntryId: existingEntryId } : {})
        };
        const neutralHistoryState = Object.keys(markers).length > 0 ? markers : null;
        window.history.replaceState(neutralHistoryState, '', nextUrl);
      } catch (error) {
        console.warn('Unable to normalize neutral navigation history', error);
      }
    }

    await confirmForegroundEpoch(attempt, () => {
      window.localStorage.setItem(ESTABLISHED_ARCHIVE_KEY, '1');
      if (physicallyComplete) window.localStorage.setItem(COMPLETE_ARCHIVE_KEY, '1');
      setSnapshot(nextSnapshot);
      setGateState('READY');
    });
  }, [getRuntime, confirmForegroundEpoch]);

  const handleSetup = useCallback(async (password: string, setup: NewArchiveSetup) => {
    const attempt = await getForegroundEpoch();
    if (establishedArchive()) throw new Error('Archivio già stabilito: non è ammessa una nuova configurazione.');
    const inspected = await protectedBootstrap().run();
    if (inspected.kind !== 'ok' ||
        (inspected.observation.kind !== 'absent' && inspected.observation.kind !== 'empty') ||
        establishedArchive()) {
      await inspectBootstrap();
      throw new Error('Stato dell’archivio cambiato o non verificabile. Nessuna configurazione eseguita.');
    }
    const fresh = await getForegroundEpoch();
    if (attempt.revision !== fresh.revision || attempt.epoch !== fresh.epoch || document.hidden) {
      throw new Error('Sessione cambiata. Ripeti la configurazione in primo piano.');
    }
    const { vault, store } = getRuntime();
    if (await store.getMetadata() || LEGACY_DATA_KEYS.some(key => window.localStorage.getItem(key) !== null)) {
      throw new Error('È già presente un archivio. Riapri il Registro senza creare nuovi dati.');
    }
    await initializeNewArchive(vault, password, setup);
    try {
      await loadReadySnapshot(attempt);
    } catch (error) {
      vault.lock();
      setGateState('LOCKED');
      throw error;
    }
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch, establishedArchive, protectedBootstrap, inspectBootstrap]);

  const handleUnlock = useCallback(async (password: string) => {
    const attempt = await getForegroundEpoch();
    const { vault } = getRuntime();
    await vault.unlock(password);
    try {
      await cleanupVerifiedLegacyAfterActivation(window.localStorage, vault);
      await loadReadySnapshot(attempt);
    } catch (error) {
      vault.lock();
      throw error;
    }
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch]);

  const handleMigrate = useCallback(async (password: string) => {
    const attempt = await getForegroundEpoch();
    const { vault } = getRuntime();
    setGateState('MIGRATING');
    try {
      await migrateLegacyToVault(window.localStorage, vault, password);
      await loadReadySnapshot(attempt);
    } catch (error) {
      // Activation may already have committed before foreground authorization
      // failed. Always revoke the in-memory key and inspect durable state;
      // never ask to migrate an ACTIVE archive again.
      vault.lock();
      authenticatedEpochRef.current = null;
      setSnapshot(null);
      await inspectBootstrap();
      throw error;
    }
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch, inspectBootstrap]);

  const handleRetry = useCallback(() => {
    // Retry only inspects: never silently discard STAGING or residual data.
    void inspectBootstrap();
  }, [inspectBootstrap]);

  const handleFactoryReset = useCallback(async () => {
    const { vault } = getRuntime();
    await vault.clearAll();
    for (const legacyKey of LEGACY_DATA_KEYS) {
      window.localStorage.removeItem(legacyKey);
    }
    // Confirmed reset alone removes positive-history flags after clearAll commits.
    window.localStorage.removeItem(ESTABLISHED_ARCHIVE_KEY);
    window.localStorage.removeItem(COMPLETE_ARCHIVE_KEY);
    revokeNativeAuthorization();
    suspendedRef.current = null;
    setSuspensionPhase(null);
    setSuspensionDelayed(false);
    setSnapshot(null);
    setGateState('SETUP_REQUIRED');
  }, [getRuntime, revokeNativeAuthorization]);

  useEffect(() => {
    if (gateState !== 'READY' || closing || suspensionPhase !== null || autoLockMinutes === 0) return;
    const timeoutLock = () => {
      if (closingRef.current) return;
      if (isAndroidSessionRuntime()) beginSuspension();
      else lockImmediately();
    };

    let timeoutId = window.setTimeout(timeoutLock, autoLockMinutes * 60_000);
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(timeoutLock, autoLockMinutes * 60_000);
    };

    const activityEvents = ['pointerdown', 'keydown'] as const;
    for (const eventName of activityEvents) {
      window.addEventListener(eventName, resetTimer);
    }

    return () => {
      window.clearTimeout(timeoutId);
      for (const eventName of activityEvents) {
        window.removeEventListener(eventName, resetTimer);
      }
    };
  }, [autoLockMinutes, gateState, closing, lockImmediately, suspensionPhase, beginSuspension]);

  const handleAutoLockChange = (minutes: AutoLockMinutes) => {
    setAutoLockMinutes(minutes);
    window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(minutes));
  };

  return (
    <VaultGate
      state={gateState}
      errorMessage={errorMessage}
      onSetup={handleSetup}
      onUnlock={handleUnlock}
      onMigrate={handleMigrate}
      onRetry={handleRetry}
    >
      {snapshot && storageRef.current ? (
        <>
          <div inert={closing || suspensionPhase !== null} aria-hidden={closing || suspensionPhase !== null || undefined} style={closing || suspensionPhase !== null ? { visibility: 'hidden' } : undefined}>
          <App
            initialSnapshot={snapshot}
            secureStorage={storageRef.current}
            onFactoryReset={handleFactoryReset}
            onCopilotSurfaceOpenChange={setIsCopilotSurfaceOpen}
            registerSessionLockRequest={registerSessionLockRequest}
            registerSessionSuspension={registerSessionSuspension}
            headerSecurity={{
              autoLockMinutes,
              onAutoLockChange: handleAutoLockChange,
              onLock: handleLock,
            }}
          />
          <VaultControls
            autoLockMinutes={autoLockMinutes}
            onAutoLockChange={handleAutoLockChange}
            onLock={handleLock}
            copilotSurfaceOpen={isCopilotSurfaceOpen}
            mobileControlsEnabled={false}
          />
          </div>
          {suspensionPhase !== null && (
            <div className="fixed inset-0 z-[110] overflow-y-auto bg-[#030712]">
              {suspensionPhase === 'draining' ? (
                <div role="status" className="min-h-screen flex items-center justify-center p-6 text-center text-slate-100">
                  {suspensionDelayed ? 'Sessione protetta. Attesa della conclusione dell’operazione locale.' : 'Protezione della sessione…'}
                </div>
              ) : (
                <VaultGate state="LOCKED" onUnlock={resumeSuspendedSession}
                  onSetup={handleSetup} onMigrate={handleMigrate} onRetry={handleRetry}>
                  {null}
                </VaultGate>
              )}
            </div>
          )}
          {closing && (
            <div role="status" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#030712] p-6 text-center text-slate-100">
              {closingDelayed ? 'Chiusura in attesa di un’operazione locale. I dati sono nascosti; non spegnere il dispositivo durante il salvataggio.' : 'Chiusura protetta del Registro…'}
            </div>
          )}
        </>
      ) : null}
    </VaultGate>
  );
};
