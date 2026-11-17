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
import { ExistingSessionVaultStore } from '../security/existingSessionVaultStore';
import { createDb2Lifecycle } from '../security/db2Lifecycle';
import { captureDb2, type ErasedDb2 } from '../security/db2PhysicalLifecycle';
import { inspectArchiveVersion } from '../security/inspectArchiveVersion';
import { createRecoveryCopyHandoff, type RecoverySessionStamp } from '../security/migrationRecoveryHandoff';
import { createLocalMigrationSessionBoundary, type MigrationSessionResult } from '../security/migrationSessionBoundary';
import type { DurableMutationCoordinator, SuspendedMutationLease } from '../persistence/durableMutationCoordinator';
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

const AUTO_LOCK_STORAGE_KEY = 'registro_auto_lock_minutes';
const DEFAULT_AUTO_LOCK_MS = 15 * 60_000;
type AutoLockMinutes = 0 | 15 | 30 | 60;

function readAutoLockMinutes(): AutoLockMinutes {
  const raw = window.localStorage.getItem(AUTO_LOCK_STORAGE_KEY);
  const parsed = raw === null ? 15 : Number(raw);
  return parsed === 0 || parsed === 15 || parsed === 30 || parsed === 60 ? parsed : 15;
}

/** Explicit lab entrypoint only: main.tsx never enables this candidate. */
export const SecureRegistroRoot: React.FC<{archiveMigrationCandidate?:boolean}> = ({archiveMigrationCandidate=false}) => {
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
  const archiveVersionRef=useRef<1|2|null>(null);
  const [archiveVersion,setArchiveVersion]=useState<1|2|null>(null);
  const requireExistingRef=useRef(false);
  const handoffRef=useRef<ReturnType<typeof createRecoveryCopyHandoff>|null>(null);
  const archiveMigrationRef=useRef<{revoke():void}|null>(null);
  const erasedDb2Ref=useRef<ErasedDb2|null>(null);
  const db2ChannelRef=useRef<BroadcastChannel|null>(null);
  const [migrationNotice,setMigrationNotice]=useState<string|null>(null);
  const discardRecoveryCopy=useCallback(()=>{handoffRef.current?.invalidate();handoffRef.current=null;},[]);
  const invalidateArchiveMigration=useCallback(()=>{
    discardRecoveryCopy();
    archiveMigrationRef.current?.revoke();
  },[discardRecoveryCopy]);
  useEffect(()=>()=>invalidateArchiveMigration(),[invalidateArchiveMigration]);
  const registerSessionSuspension = useCallback((request: (() => SuspendedMutationLease) | null) => {
    suspendRequestRef.current = request;
  }, []);
  const registerSessionLockRequest = useCallback((request: SessionLockRequest | null) => {
    lockRequestRef.current = request;
  }, []);

  const getRuntime = useCallback(() => {
    if (!storeRef.current) {
      storeRef.current = archiveMigrationCandidate && archiveVersionRef.current===2
        ? new ExistingSessionVaultStore(2)
        : new IndexedDbVaultStore(globalThis.indexedDB,archiveMigrationCandidate&&archiveVersionRef.current===1);
      vaultRef.current = new SecureVault(storeRef.current);
      storageRef.current = new SecureAppStorage(vaultRef.current);
    }

    return {
      store: storeRef.current,
      vault: vaultRef.current!,
      storage: storageRef.current!
    };
  }, [archiveMigrationCandidate]);

  const inspectBootstrap = useCallback(async () => {
    setGateState('CHECKING');
    setErrorMessage(null);

    const indexedDbAvailable = Boolean(globalThis.indexedDB);
    const webCryptoAvailable = Boolean(globalThis.crypto?.subtle);
    if (!indexedDbAvailable || !webCryptoAvailable) {
      setErrorMessage('IndexedDB o Web Crypto non sono disponibili: il Registro non userà un fallback in chiaro.');
      setGateState('ERROR');
      return;
    }

    try {
      if(archiveMigrationCandidate){
        const version=await inspectArchiveVersion();
        if(version===null&&requireExistingRef.current)throw Error('Archivio esistente non verificabile. Nessun nuovo archivio verrà creato.');
        if(storeRef.current&&archiveVersionRef.current!==version){
          vaultRef.current?.lock();await storeRef.current.retireConnection();
          storeRef.current=null;vaultRef.current=null;storageRef.current=null;
        }
        archiveVersionRef.current=version;setArchiveVersion(version);
        erasedDb2Ref.current=null;
        if(version===2){
          const physical=await captureDb2(globalThis.indexedDB);
          if(physical.state==='erased'){
            vaultRef.current?.lock();await storeRef.current?.retireConnection();
            storeRef.current=null;vaultRef.current=null;storageRef.current=null;
            if(LEGACY_DATA_KEYS.some(key=>window.localStorage.getItem(key)!==null))throw Error('Residui di un archivio precedente da verificare. Nessun dato verrà recuperato automaticamente.');
            erasedDb2Ref.current=physical.metadata;requireExistingRef.current=true;
            setGateState('SETUP_REQUIRED');return;
          }
        }
      }
      const { store } = getRuntime();
      const metadata = await store.getMetadata();
      if(archiveMigrationCandidate&&requireExistingRef.current&&metadata?.state!=='ACTIVE')throw Error('Archivio esistente non verificabile. Nessun ripristino automatico.');
      if(archiveMigrationCandidate&&archiveVersionRef.current===null){archiveVersionRef.current=1;setArchiveVersion(1);}
      const hasLegacyData = LEGACY_DATA_KEYS.some(key => window.localStorage.getItem(key) !== null);
      const nextState = decideVaultBootstrap({
        metadataState: metadata?.state ?? null,
        hasLegacyData,
        indexedDbAvailable,
        webCryptoAvailable
      });

      if (nextState === 'ERROR' && metadata?.state === 'STAGING') {
        setErrorMessage('È stata rilevata una configurazione o migrazione interrotta. Riprova: gli archivi già attivi non verranno cancellati.');
      }
      setGateState(nextState);
    } catch (error) {
      if(archiveMigrationCandidate){
        vaultRef.current?.lock();await storeRef.current?.retireConnection();
        storeRef.current=null;vaultRef.current=null;storageRef.current=null;
      }
      setErrorMessage(error instanceof Error ? error.message : 'Controllo del Secure Local Vault non riuscito.');
      setGateState('ERROR');
    }
  }, [getRuntime,archiveMigrationCandidate]);

  useEffect(() => {
    void inspectBootstrap();
  }, [inspectBootstrap]);

  const revokeNativeAuthorization = useCallback(() => {
    const epoch = authenticatedEpochRef.current;
    authenticatedEpochRef.current = null;
    if (epoch !== null && isAndroidSessionRuntime()) {
      void revokeAndroidSession(epoch).catch(() => {});
    }
  }, []);

  const lockImmediately = useCallback(() => {
    invalidateArchiveMigration();
    revokeNativeAuthorization();
    vaultRef.current?.lock();
    setSnapshot(null);
    // A confirmed reset can finish while the manual lock is draining.
    // Its terminal setup state is authoritative, even if React batches
    // the reset and lock updates in the same render.
    setGateState(current => current === 'READY' ? 'LOCKED' : current);
  }, [revokeNativeAuthorization,invalidateArchiveMigration]);

  // Manual lock and menu exit share the App's existing draft guard.
  // Close admission synchronously before hiding the still-mounted App so
  // already accepted durable work can settle without starting new work.
  const handleLock = useCallback(() => {
    if (closingRef.current) {archiveMigrationRef.current?.revoke();return;}
    const request = lockRequestRef.current;
    if (!request) return; // No active App authority; never silently discard its drafts.
    request(drain => {
      if (closingRef.current) return;
      closingRef.current = true;
      invalidateArchiveMigration();
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
  }, [lockImmediately, revokeNativeAuthorization,invalidateArchiveMigration]);

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
        archiveMigrationRef.current?.revoke();
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
      archiveMigrationRef.current?.revoke();
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
      archiveMigrationRef.current?.revoke();
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
    if (epoch === null) {
      if(archiveMigrationCandidate&&(document.hidden||lifecycleRevisionRef.current!==revision))throw Error('Sessione cambiata. Autenticati nuovamente.');
      commit(); return;
    }
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
  }, [syncNativeSession,archiveMigrationCandidate]);

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
    const nextSnapshot = await storage.loadSnapshot();

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
      setSnapshot(nextSnapshot);
      setGateState('READY');
    });
  }, [getRuntime, confirmForegroundEpoch]);

  const handleSetup = useCallback(async (password: string, setup: NewArchiveSetup) => {
    const attempt = await getForegroundEpoch();
    if(archiveMigrationCandidate&&archiveVersionRef.current===2){
      const erased=erasedDb2Ref.current;
      if(!erased||archiveMigrationRef.current||closingRef.current||gateStateRef.current!=='SETUP_REQUIRED')throw Error('Nuova configurazione non autorizzata.');
      const service=createDb2Lifecycle();
      let revoked=false;
      const owner={revoke:()=>{revoked=true;service.invalidate();}};
      const current=()=>!revoked&&archiveMigrationRef.current===owner&&erasedDb2Ref.current===erased&&
        gateStateRef.current==='MIGRATING'&&lifecycleRevisionRef.current===attempt.revision&&
        (attempt.epoch===null?!document.hidden:nativeStateRef.current?.foreground===true&&nativeStateRef.current.epoch===attempt.epoch);
      archiveMigrationRef.current=owner;closingRef.current=true;
      setGateState('MIGRATING');
      let committed=false;
      const deadline=window.setTimeout(()=>owner.revoke(),120_000);
      try{
        if(!current()||LEGACY_DATA_KEYS.some(key=>window.localStorage.getItem(key)!==null))throw Error('Configurazione non autorizzata.');
        const grant=await service.prepare({operation:'setup',password,setup},erased);
        if(isAndroidSessionRuntime())await syncNativeSession();
        if(!current())throw Error('Sessione cambiata.');
        // Submitting the explicit new-archive setup form is the consent.
        await service.commit(grant,true);committed=true;
      }finally{
        window.clearTimeout(deadline);owner.revoke();archiveMigrationRef.current=null;
        closingRef.current=false;revokeNativeAuthorization();setSnapshot(null);
        try{db2ChannelRef.current?.postMessage('archive-generation-changed');}catch{/* Advisory only; durable generation is authoritative. */}
        setMigrationNotice(committed?'Nuovo archivio creato. Autenticati con la nuova password.':'Configurazione non confermata. Verifica lo stato dell’archivio.');
        await inspectBootstrap();
      }
      return;
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
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch,archiveMigrationCandidate,syncNativeSession,revokeNativeAuthorization,inspectBootstrap,setGateState]);

  const handleUnlock = useCallback(async (password: string) => {
    const attempt = await getForegroundEpoch();
    const { vault,store } = getRuntime();
    try {
      if(archiveMigrationCandidate&&store instanceof ExistingSessionVaultStore)await store.verifyAuthenticatedRecords(password);
      await vault.unlock(password);
      if(!archiveMigrationCandidate||archiveVersionRef.current!==2)await cleanupVerifiedLegacyAfterActivation(window.localStorage, vault);
      await loadReadySnapshot(attempt);
      setMigrationNotice(null);
    } catch (error) {
      vault.lock();
      if(store instanceof ExistingSessionVaultStore){
        await store.retireConnection();
        if(storeRef.current===store){storeRef.current=null;vaultRef.current=null;storageRef.current=null;}
      }
      throw error;
    }
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch,archiveMigrationCandidate]);

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
    void (async () => {
      try {
        if (storeRef.current && vaultRef.current && !requireExistingRef.current && archiveVersionRef.current!==2) {
          const metadata = await storeRef.current.getMetadata();
          if (metadata?.state === 'STAGING') {
            await vaultRef.current.discardStaging();
          }
        }
        await inspectBootstrap();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Ripristino del controllo di sicurezza non riuscito.');
        setGateState('ERROR');
      }
    })();
  }, [inspectBootstrap]);

  const handleFactoryReset = useCallback(async () => {
    invalidateArchiveMigration();
    if(archiveMigrationCandidate&&archiveVersionRef.current===2)throw Error('Operazione non disponibile in questa versione di collaudo.');
    const { vault } = getRuntime();
    await vault.clearAll();
    for (const legacyKey of LEGACY_DATA_KEYS) {
      window.localStorage.removeItem(legacyKey);
    }
    revokeNativeAuthorization();
    suspendedRef.current = null;
    setSuspensionPhase(null);
    setSuspensionDelayed(false);
    setSnapshot(null);
    setGateState('SETUP_REQUIRED');
  }, [getRuntime, revokeNativeAuthorization,invalidateArchiveMigration,archiveMigrationCandidate]);

  useEffect(() => {
    if (gateState !== 'READY' || closing || suspensionPhase !== null || autoLockMinutes === 0) return;
    const timeoutLock = () => {
      if (closingRef.current) {archiveMigrationRef.current?.revoke();return;}
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

  // The candidate's logical owner survives the existing native suspension UI,
  // not an explicit lock, replacement or unmount. No alternate native authority.
  const stampCurrent=useCallback((stamp:RecoverySessionStamp)=>{
    if(lifecycleRevisionRef.current!==stamp.revision)return false;
    if(isAndroidSessionRuntime())return stamp.epoch!==null&&nativeStateRef.current?.foreground===true&&
      nativeStateRef.current.epoch===stamp.epoch&&authenticatedEpochRef.current===stamp.epoch;
    return stamp.epoch===null&&!document.hidden;
  },[]);
  const recoveryOwnerReady=useCallback(()=>gateStateRef.current==='READY'&&!closingRef.current&&
    !suspendedRef.current&&vaultRef.current?.isUnlocked()===true&&(archiveVersionRef.current===1||archiveVersionRef.current===2),[]);
  const selectRecoveryCopy=useCallback(async(file?:File)=>{
    if(!archiveMigrationCandidate||!recoveryOwnerReady())return false;
    const logicalOwner=storeRef.current,version=archiveVersionRef.current;
    if(!logicalOwner)return false;
    const owns=()=>storeRef.current===logicalOwner&&archiveVersionRef.current===version&&gateStateRef.current==='READY'&&!closingRef.current;
    const handoff=handoffRef.current??(handoffRef.current=createRecoveryCopyHandoff({
      isOwner:owns,
      observeAuthenticated:async()=>{
        const state=await syncNativeSession();
        if(!owns()||!recoveryOwnerReady()||(isAndroidSessionRuntime()&&!state?.foreground))return null;
        return {epoch:state?.epoch??null,revision:lifecycleRevisionRef.current};
      },
      isCurrent:stamp=>owns()&&recoveryOwnerReady()&&stampCurrent(stamp)
    }));
    return isAndroidSessionRuntime()?handoff.selectAndroid():file?handoff.selectWeb(file):false;
  },[archiveMigrationCandidate,recoveryOwnerReady,stampCurrent,syncNativeSession]);

  const startArchiveMigration=useCallback((
    queue:DurableMutationCoordinator,localPassword:string,copyPassword:string
  ):Promise<MigrationSessionResult>=>{
    const handoff=handoffRef.current;
    if(!archiveMigrationCandidate||archiveVersionRef.current!==1||!handoff||!recoveryOwnerReady()||archiveMigrationRef.current)return Promise.resolve('not-started');
    return handoff.consume((copy,stamp)=>{
      const oldStore=storeRef.current,oldVault=vaultRef.current;
      if(!oldStore||!oldVault||!recoveryOwnerReady()||!stampCurrent(stamp))return Promise.resolve<MigrationSessionResult>('not-started');
      handoffRef.current=null;
      let boundary:ReturnType<typeof createLocalMigrationSessionBoundary>;
      const current=()=>archiveMigrationRef.current===boundary&&storeRef.current===oldStore&&
        closingRef.current&&gateStateRef.current==='READY'&&!suspendedRef.current&&stampCurrent(stamp);
      boundary=createLocalMigrationSessionBoundary({
        queue,isCurrent:current,
        readLocalCopy:async signal=>signal.aborted?null:copy,
        confirm:async signal=>!signal.aborted&&current()&&window.confirm('La copia è stata verificata. Aggiornare l’archivio locale? Dovrai autenticarti nuovamente.'),
        retireDb1:async()=>{
          if(isAndroidSessionRuntime())await syncNativeSession();
          if(!current())throw Error('Sessione non attuale.');
          oldVault.lock();await oldStore.retireConnection();
        }
      });
      archiveMigrationRef.current=boundary;
      closingRef.current=true;setClosing(true);setClosingDelayed(false);
      // run seals the actual App coordinator before its first await.
      return (async()=>{
        let result:MigrationSessionResult='inspect-reopen-required';
        const deadline=window.setTimeout(()=>boundary.revoke(),120_000);
        try{result=await boundary.run(localPassword,copyPassword);return result;}
        finally{
          window.clearTimeout(deadline);
          boundary.revoke();archiveMigrationRef.current=null;
          oldVault.lock();await oldStore.retireConnection();
          storeRef.current=null;vaultRef.current=null;storageRef.current=null;
          requireExistingRef.current=true;
          revokeNativeAuthorization();setSnapshot(null);
          setMigrationNotice(result==='migrated-reopen-required'
            ?'Archivio aggiornato. Autenticati per verificarlo e riaprire il Registro.'
            :result==='inspect-reopen-required'
              ?'Operazione interrotta. Autenticati per verificare lo stato dell’archivio.'
              :'Aggiornamento non completato. Autenticati per riaprire il Registro.');
          await inspectBootstrap();
          closingRef.current=false;setClosing(false);
        }
      })();
    })??Promise.resolve('not-started');
  },[archiveMigrationCandidate,recoveryOwnerReady,stampCurrent,revokeNativeAuthorization,inspectBootstrap,syncNativeSession]);

  const runDb2Replacement=useCallback((
    queue:DurableMutationCoordinator,stamp:RecoverySessionStamp,password:string,
    replacement:{operation:'restore';file:Blob;backupPassword:string}|{operation:'erase'}
  ):Promise<MigrationSessionResult>=>{
    const oldStore=storeRef.current,oldVault=vaultRef.current;
    if(!archiveMigrationCandidate||archiveVersionRef.current!==2||!oldStore||!oldVault||
      !recoveryOwnerReady()||!stampCurrent(stamp)||archiveMigrationRef.current)return Promise.resolve('not-started');
    const service=createDb2Lifecycle();let revoked=false;
    const owner={revoke:()=>{revoked=true;service.invalidate();}};
    const current=()=>!revoked&&archiveMigrationRef.current===owner&&storeRef.current===oldStore&&closingRef.current&&
      gateStateRef.current==='READY'&&!suspendedRef.current&&stampCurrent(stamp);
    archiveMigrationRef.current=owner;
    closingRef.current=true;setClosing(true);setClosingDelayed(false);
    return (async()=>{
      let result:MigrationSessionResult='blocked-reopen-required',invoked=false;
      const deadline=window.setTimeout(()=>owner.revoke(),120_000);
      try{
        await queue.sealAndDrain();
        if(!current()||LEGACY_DATA_KEYS.some(key=>window.localStorage.getItem(key)!==null))throw Error('Archivio non verificabile.');
        const metadata=await oldStore.getMetadata();
        if(!metadata||!current())throw Error('Sessione cambiata.');
        const grant=await service.prepare({...replacement,password},metadata);
        if(!current())throw Error('Sessione cambiata.');
        const confirmation=replacement.operation==='erase'
          ?'Cancellare tutti i dati e la chiave dell’archivio locale? Le copie esterne restano disponibili.'
          :'La copia è stata verificata. Sostituire tutti i dati attuali con quelli della copia? Dovrai autenticarti nuovamente.';
        if(!window.confirm(confirmation)){result='cancelled-reopen-required';return result;}
        if(isAndroidSessionRuntime())await syncNativeSession();
        if(!current())throw Error('Sessione cambiata.');
        oldVault.lock();await oldStore.retireConnection();
        if(!current())throw Error('Sessione cambiata.');
        invoked=true;await service.commit(grant,true);
        result=current()?'migrated-reopen-required':'inspect-reopen-required';
        return result;
      }catch{
        result=invoked?'inspect-reopen-required':current()?'blocked-reopen-required':'cancelled-reopen-required';
        return result;
      }finally{
        window.clearTimeout(deadline);owner.revoke();archiveMigrationRef.current=null;
        oldVault.lock();await oldStore.retireConnection();
        storeRef.current=null;vaultRef.current=null;storageRef.current=null;
        requireExistingRef.current=true;revokeNativeAuthorization();setSnapshot(null);
        if(invoked)try{db2ChannelRef.current?.postMessage('archive-generation-changed');}catch{/* Advisory only. */}
        setMigrationNotice(result==='migrated-reopen-required'
          ?replacement.operation==='erase'?'Archivio locale cancellato. Configura un nuovo archivio. Le copie esterne non sono state cancellate.':'Archivio ripristinato. Autenticati per riaprire il Registro.'
          :result==='inspect-reopen-required'?'Operazione interrotta. Verifica lo stato dell’archivio.':'Operazione non completata. Autenticati per riaprire il Registro.');
        await inspectBootstrap();
        closingRef.current=false;setClosing(false);
      }
    })();
  },[archiveMigrationCandidate,recoveryOwnerReady,stampCurrent,syncNativeSession,revokeNativeAuthorization,inspectBootstrap]);

  const startDb2Restore=useCallback((queue:DurableMutationCoordinator,password:string,backupPassword:string)=>{
    const handoff=handoffRef.current;
    if(!handoff||archiveVersionRef.current!==2)return Promise.resolve<MigrationSessionResult>('not-started');
    return handoff.consume((file,stamp)=>{
      handoffRef.current=null;
      return runDb2Replacement(queue,stamp,password,{operation:'restore',file,backupPassword});
    })??Promise.resolve<MigrationSessionResult>('not-started');
  },[runDb2Replacement]);
  const startDb2Erase=useCallback((queue:DurableMutationCoordinator,password:string)=>{
    discardRecoveryCopy();
    const stamp={epoch:isAndroidSessionRuntime()?authenticatedEpochRef.current:null,revision:lifecycleRevisionRef.current};
    return runDb2Replacement(queue,stamp,password,{operation:'erase'});
  },[discardRecoveryCopy,runDb2Replacement]);

  useEffect(()=>{
    if(!archiveMigrationCandidate)return;
    const protect=()=>{if(document.hidden){archiveMigrationRef.current?.revoke();if(!isAndroidSessionRuntime()){lifecycleRevisionRef.current++;discardRecoveryCopy();}}};
    const hide=()=>invalidateArchiveMigration();
    document.addEventListener('visibilitychange',protect);
    window.addEventListener('pagehide',hide);
    return()=>{document.removeEventListener('visibilitychange',protect);window.removeEventListener('pagehide',hide);};
  },[archiveMigrationCandidate,discardRecoveryCopy,invalidateArchiveMigration]);

  // Broadcast carries no data or authority; verify durable generation even
  // without BroadcastChannel. Stale writes are independently fenced by DB2.
  useEffect(()=>{
    if(!archiveMigrationCandidate)return;
    let disposed=false,checking=false;
    const probe=async()=>{
      if(disposed||checking||closingRef.current||archiveVersionRef.current!==2||
        gateStateRef.current!=='READY')return;
      const store=storeRef.current;
      if(!store)return;
      checking=true;
      try{await store.getMetadata();}
      catch{
        if(disposed||storeRef.current!==store||closingRef.current)return;
        invalidateArchiveMigration();
        revokeNativeAuthorization();vaultRef.current?.lock();
        suspendedRef.current=null;setSuspensionPhase(null);setSuspensionDelayed(false);
        setSnapshot(null);setGateState('CHECKING');
        await store.retireConnection();
        if(storeRef.current===store){storeRef.current=null;vaultRef.current=null;storageRef.current=null;}
        requireExistingRef.current=true;
        setMigrationNotice('L’archivio è cambiato. Verifica lo stato e autenticati nuovamente.');
        await inspectBootstrap();
      }finally{checking=false;}
    };
    const check=()=>{void probe();};
    const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('registro-docente-db2-generation'):null;
    db2ChannelRef.current=channel;
    if(channel)channel.onmessage=check;
    const timer=window.setInterval(check,2000);
    window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);
    return()=>{
      disposed=true;window.clearInterval(timer);
      window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);
      channel?.close();if(db2ChannelRef.current===channel)db2ChannelRef.current=null;
    };
  },[archiveMigrationCandidate,invalidateArchiveMigration,revokeNativeAuthorization,inspectBootstrap,setGateState]);

  const handleAutoLockChange = (minutes: AutoLockMinutes) => {
    setAutoLockMinutes(minutes);
    window.localStorage.setItem(AUTO_LOCK_STORAGE_KEY, String(minutes));
  };

  return (
    <VaultGate
      state={gateState}
      errorMessage={errorMessage}
      notice={migrationNotice}
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
            archiveMigration={archiveMigrationCandidate&&archiveVersion!==null?{
              select:selectRecoveryCopy,start:archiveVersion===2?startDb2Restore:startArchiveMigration,discard:discardRecoveryCopy,
              mode:archiveVersion===2?'restore':'migrate',erase:archiveVersion===2?startDb2Erase:undefined
            }:undefined}
            onInvalidateArchiveMigration={archiveMigrationCandidate?invalidateArchiveMigration:undefined}
            archiveReplacementBlocked={archiveMigrationCandidate&&archiveVersion===2}
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
