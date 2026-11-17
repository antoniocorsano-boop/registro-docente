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
import { captureDb2, sameDb2Physical, type ErasedDb2 } from '../security/db2PhysicalLifecycle';
import { BootFault, bootMessage, createProtectedBootstrap, observeArchive, type BootTrace } from '../security/protectedBootstrap';
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

// Positive evidence only: absence of this local, non-identifying flag is
// never proof that an archive has not existed. No credential or record data.
const ESTABLISHED_ARCHIVE_KEY='registro_archive_established_v1';
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
  const bootstrapRef=useRef<ReturnType<typeof createProtectedBootstrap>|null>(null);
  const bootstrapFlightRef=useRef<Promise<void>|null>(null);
  const bootstrapGenerationRef=useRef(0);
  const [bootTrace,setBootTrace]=useState<BootTrace[]>([]);
  const markEstablished=useCallback(()=>{
    requireExistingRef.current=true;
    window.localStorage.setItem(ESTABLISHED_ARCHIVE_KEY,'1');
  },[]);
  const established=useCallback(()=>requireExistingRef.current||window.localStorage.getItem(ESTABLISHED_ARCHIVE_KEY)==='1',[]);
  const protectedBootstrap=useCallback(()=>{
    if(!bootstrapRef.current)bootstrapRef.current=createProtectedBootstrap({
      observe:signal=>observeArchive(globalThis.indexedDB,signal),established
    });
    return bootstrapRef.current;
  },[established]);
  const handoffRef=useRef<ReturnType<typeof createRecoveryCopyHandoff>|null>(null);
  const archiveMigrationRef=useRef<{revoke():void}|null>(null);
  const erasedDb2Ref=useRef<ErasedDb2|null>(null);
  const db2UnlockBusyRef=useRef(false);
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
    if(archiveMigrationCandidate&&bootstrapFlightRef.current)return bootstrapFlightRef.current;
    setGateState('CHECKING');
    setErrorMessage(null);
    const indexedDbAvailable = Boolean(globalThis.indexedDB);
    const webCryptoAvailable = Boolean(globalThis.crypto?.subtle);
    if (!indexedDbAvailable || !webCryptoAvailable) {
      setErrorMessage('IndexedDB o Web Crypto non sono disponibili: il Registro non userà un fallback in chiaro.');
      setGateState('ERROR');
      return;
    }
    if(archiveMigrationCandidate){
      setBootTrace([]);
      const generation=++bootstrapGenerationRef.current;
      const current=()=>bootstrapGenerationRef.current===generation;
      const run=async()=>{
        try{
          // Only an owner already at a protected boundary may call this.
          // Do not keep a possibly failed or stale store across attempts.
          vaultRef.current?.lock();await storeRef.current?.retireConnection();
          if(!current())return;
          storeRef.current=null;vaultRef.current=null;storageRef.current=null;
          erasedDb2Ref.current=null;
          const result=await protectedBootstrap().run();
          if(!current())return;
          setBootTrace(result.trace);
          if(result.kind==='error')throw result.fault;
          const observation=result.observation;
          const hasLegacyData=LEGACY_DATA_KEYS.some(key=>window.localStorage.getItem(key)!==null);
          if(observation.kind==='erased'&&hasLegacyData)throw new BootFault('classification','invalid-inventory');
          if(observation.kind==='active'||observation.kind==='erased')markEstablished();
          // A successful inspection never opens a writable runtime. In
          // particular, absence must not create DB1 before explicit setup.
          const version=observation.kind==='absent'?null:observation.version;
          archiveVersionRef.current=version;setArchiveVersion(version);
          if(observation.kind==='erased')erasedDb2Ref.current=observation.marker;
          if(observation.kind==='active')setGateState('LOCKED');
          else if(observation.kind==='erased')setGateState('SETUP_REQUIRED');
          else setGateState(hasLegacyData?'MIGRATION_REQUIRED':'SETUP_REQUIRED');
        }catch(error){
          if(!current())return;
          const failure=error instanceof BootFault?error:new BootFault('classification','unknown');
          setBootTrace(previous=>previous.some(t=>t.phase===failure.phase&&t.code===failure.code)?previous:[...previous,{attempt:previous.length+1,phase:failure.phase,code:failure.code}]);
          setErrorMessage(bootMessage(failure));setGateState('ERROR');
        }
      };
      const pending=run().finally(()=>{if(bootstrapGenerationRef.current===generation)bootstrapFlightRef.current=null;});
      bootstrapFlightRef.current=pending;
      return pending;
    }
    // Existing non-candidate entrypoint retains its qualified legacy behavior.
    try{
      const {store}=getRuntime();
      const metadata=await store.getMetadata();
      const hasLegacyData=LEGACY_DATA_KEYS.some(key=>window.localStorage.getItem(key)!==null);
      const nextState=decideVaultBootstrap({metadataState:metadata?.state??null,hasLegacyData,indexedDbAvailable,webCryptoAvailable});
      if(nextState==='ERROR'&&metadata?.state==='STAGING')setErrorMessage('È stata rilevata una configurazione o migrazione interrotta. Riprova: gli archivi già attivi non verranno cancellati.');
      setGateState(nextState);
    }catch(error){
      setErrorMessage(error instanceof Error?error.message:'Controllo del Secure Local Vault non riuscito.');
      setGateState('ERROR');
    }
  }, [getRuntime,archiveMigrationCandidate,protectedBootstrap,markEstablished,setGateState]);

  useEffect(()=>{
    void inspectBootstrap();
    return ()=>{
      if(archiveMigrationCandidate){
        bootstrapGenerationRef.current++;
        bootstrapFlightRef.current=null;
        bootstrapRef.current?.cancel();
      }
    };
  },[inspectBootstrap,archiveMigrationCandidate]);

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
    if(archiveMigrationCandidate){
      if(gateStateRef.current!=='SETUP_REQUIRED'||closingRef.current||established())throw Error('Nuova configurazione non autorizzata.');
      const inspected=await protectedBootstrap().run();
      if(inspected.kind!=='ok'||(inspected.observation.kind!=='absent'&&inspected.observation.kind!=='empty')||gateStateRef.current!=='SETUP_REQUIRED'||closingRef.current||established()){
        await inspectBootstrap();throw Error('Stato dell’archivio cambiato. Verifica prima di configurare.');
      }
      archiveVersionRef.current=inspected.observation.kind==='empty'?1:null;
    }
    if(!archiveMigrationCandidate){
      const {vault,store}=getRuntime();
      if(await store.getMetadata()||LEGACY_DATA_KEYS.some(key=>window.localStorage.getItem(key)!==null))throw new Error('È già presente un archivio. Riapri il Registro senza creare nuovi dati.');
      await initializeNewArchive(vault,password,setup);
      try{await loadReadySnapshot(attempt);}catch(error){vault.lock();setGateState('LOCKED');throw error;}
      return;
    }
    if(archiveMigrationCandidate){
      if(lifecycleRevisionRef.current!==attempt.revision||document.hidden||
        (attempt.epoch!==null&&(!nativeStateRef.current?.foreground||nativeStateRef.current.epoch!==attempt.epoch)))throw Error('Sessione cambiata.');
      // Protected gate is closed synchronously before the explicit first setup.
      setGateState('MIGRATING');
    }
    const { vault, store } = getRuntime();
    try{
      if (await store.getMetadata() || LEGACY_DATA_KEYS.some(key => window.localStorage.getItem(key) !== null)) {
        throw new Error('È già presente un archivio. Riapri il Registro senza creare nuovi dati.');
      }
      await initializeNewArchive(vault, password, setup);
      if(archiveMigrationCandidate){markEstablished();archiveVersionRef.current=1;setArchiveVersion(1);}
      await loadReadySnapshot(attempt);
    }catch(error){
      vault.lock();
      await inspectBootstrap();
      throw error;
    }
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch,archiveMigrationCandidate,syncNativeSession,revokeNativeAuthorization,inspectBootstrap,setGateState,established,protectedBootstrap,markEstablished]);

  const handleUnlock = useCallback(async (password: string) => {
    const track=archiveMigrationCandidate;
    if(track&&(db2UnlockBusyRef.current||gateStateRef.current!=='LOCKED'||closingRef.current))throw Error('Sessione non attuale.');
    if(track)db2UnlockBusyRef.current=true;
    try{
      const attempt = await getForegroundEpoch();
      if(track&&(gateStateRef.current!=='LOCKED'||closingRef.current))throw Error('Sessione non attuale.');
      const { vault,store } = getRuntime();
      try {
        if(archiveMigrationCandidate&&store instanceof ExistingSessionVaultStore)await store.verifyAuthenticatedRecords(password);
        await vault.unlock(password);
        if(!archiveMigrationCandidate||archiveVersionRef.current!==2)await cleanupVerifiedLegacyAfterActivation(window.localStorage, vault);
        await loadReadySnapshot(attempt);
        setMigrationNotice(null);
      } catch (error) {
        vault.lock();
        if(archiveMigrationCandidate){
          await store.retireConnection();
          if(storeRef.current===store){
            storeRef.current=null;vaultRef.current=null;storageRef.current=null;
            // Concurrent erasure can look like a failed password. Inspect
            // durable state rather than repeatedly opening the erased archive.
            requireExistingRef.current=true;
            revokeNativeAuthorization();setSnapshot(null);
            await inspectBootstrap();
          }
        }
        throw error;
      }
    }finally{if(track)db2UnlockBusyRef.current=false;}
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch,archiveMigrationCandidate,revokeNativeAuthorization,inspectBootstrap]);

  const handleMigrate = useCallback(async (password: string) => {
    const attempt = await getForegroundEpoch();
    if(archiveMigrationCandidate){
      if(gateStateRef.current!=='MIGRATION_REQUIRED'||closingRef.current||established())throw Error('Migrazione non autorizzata.');
      const inspected=await protectedBootstrap().run();
      if(inspected.kind!=='ok'||(inspected.observation.kind!=='absent'&&inspected.observation.kind!=='empty')||gateStateRef.current!=='MIGRATION_REQUIRED'||closingRef.current||established()){
        await inspectBootstrap();throw Error('Stato dell’archivio cambiato.');
      }
      archiveVersionRef.current=inspected.observation.kind==='empty'?1:null;
    }
    const { vault } = getRuntime();
    setGateState('MIGRATING');
    try {
      await migrateLegacyToVault(window.localStorage, vault, password);
      if(archiveMigrationCandidate){markEstablished();archiveVersionRef.current=1;setArchiveVersion(1);}
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
  }, [getRuntime, loadReadySnapshot, getForegroundEpoch, inspectBootstrap,archiveMigrationCandidate,established,protectedBootstrap,markEstablished]);

  const handleRetry = useCallback(() => {
    void (async () => {
      try {
        if (!archiveMigrationCandidate && storeRef.current && vaultRef.current && !requireExistingRef.current && archiveVersionRef.current!==2) {
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
  }, [inspectBootstrap,archiveMigrationCandidate]);

  const handleFactoryReset = useCallback(async () => {
    invalidateArchiveMigration();
    if(archiveMigrationCandidate&&archiveVersionRef.current===2)throw Error('Operazione non disponibile in questa versione di collaudo.');
    const { vault } = getRuntime();
    await vault.clearAll();
    for (const legacyKey of LEGACY_DATA_KEYS) {
      window.localStorage.removeItem(legacyKey);
    }
    if(archiveMigrationCandidate){
      // Only the explicit legacy DB1 reset can remove the positive marker.
      window.localStorage.removeItem(ESTABLISHED_ARCHIVE_KEY);requireExistingRef.current=false;
      await storeRef.current?.retireConnection();storeRef.current=null;vaultRef.current=null;storageRef.current=null;
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
      const state=gateStateRef.current;
      if(disposed||checking||closingRef.current||db2UnlockBusyRef.current||archiveVersionRef.current!==2||
        (state!=='READY'&&state!=='LOCKED'&&state!=='SETUP_REQUIRED'))return;
      const store=storeRef.current,marker=erasedDb2Ref.current;
      checking=true;
      try{
        let changed=false;
        try{
          if(store&&state!=='SETUP_REQUIRED'){
            // Metadata-only guarded read for active or manually locked owners.
            await store.getMetadata();
          }else{
            // An erased setup gate has no handle. Verify its durable marker.
            const physical=await captureDb2(globalThis.indexedDB);
            changed=state==='SETUP_REQUIRED'
              ?physical.state!=='erased'||!sameDb2Physical(physical.metadata,marker)
              :physical.state!=='active'||state==='READY';
          }
        }catch{changed=true;}
        if(!changed||disposed||storeRef.current!==store||erasedDb2Ref.current!==marker||
          closingRef.current||db2UnlockBusyRef.current||gateStateRef.current!==state)return;
        // Do not race an in-flight authentication or local setup.
        invalidateArchiveMigration();
        revokeNativeAuthorization();vaultRef.current?.lock();
        suspendedRef.current=null;setSuspensionPhase(null);setSuspensionDelayed(false);
        setSnapshot(null);setGateState('CHECKING');
        await store?.retireConnection();
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
      bootTrace={archiveMigrationCandidate?bootTrace:undefined}
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
