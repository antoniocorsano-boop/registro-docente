import React, { useCallback, useEffect, useRef, useState } from 'react';
import App from '../App';
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
import { SecureVault } from '../security/secureVault';
import { IndexedDbVaultStore } from '../security/vaultStore';
import { VaultControls } from './VaultControls';
import { VaultGate } from './VaultGate';

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

export const SecureRegistroRoot: React.FC = () => {
  const [gateState, setGateState] = useState<VaultGateState>('CHECKING');
  const [snapshot, setSnapshot] = useState<SecureAppSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoLockMinutes, setAutoLockMinutes] = useState<AutoLockMinutes>(() => readAutoLockMinutes());
  const storeRef = useRef<IndexedDbVaultStore | null>(null);
  const vaultRef = useRef<SecureVault | null>(null);
  const storageRef = useRef<SecureAppStorage | null>(null);

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
      const { store } = getRuntime();
      const metadata = await store.getMetadata();
      const hasLegacyData = LEGACY_DATA_KEYS.some(key => window.localStorage.getItem(key) !== null);
      const nextState = decideVaultBootstrap({
        metadataState: metadata?.state ?? null,
        hasLegacyData,
        indexedDbAvailable,
        webCryptoAvailable
      });

      if (nextState === 'ERROR' && metadata?.state === 'STAGING') {
        setErrorMessage('È stata rilevata una migrazione interrotta. Riprova per ripartire dai dati legacy rimasti intatti.');
      }
      setGateState(nextState);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Controllo del Secure Local Vault non riuscito.');
      setGateState('ERROR');
    }
  }, [getRuntime]);

  useEffect(() => {
    void inspectBootstrap();
  }, [inspectBootstrap]);

  const handleLock = useCallback(() => {
    vaultRef.current?.lock();
    setSnapshot(null);
    setGateState('LOCKED');
  }, []);

  const loadReadySnapshot = useCallback(async () => {
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
        window.history.replaceState(null, '', nextUrl);
      } catch (error) {
        console.warn('Unable to normalize neutral navigation history', error);
      }
    }

    setSnapshot(nextSnapshot);
    setGateState('READY');
  }, [getRuntime]);

  const handleSetup = useCallback(async (password: string) => {
    const { vault } = getRuntime();
    await vault.initializeActive(password);
    await loadReadySnapshot();
  }, [getRuntime, loadReadySnapshot]);

  const handleUnlock = useCallback(async (password: string) => {
    const { vault } = getRuntime();
    await vault.unlock(password);
    try {
      await cleanupVerifiedLegacyAfterActivation(window.localStorage, vault);
      await loadReadySnapshot();
    } catch (error) {
      vault.lock();
      throw error;
    }
  }, [getRuntime, loadReadySnapshot]);

  const handleMigrate = useCallback(async (password: string) => {
    setGateState('MIGRATING');
    try {
      const { vault } = getRuntime();
      await migrateLegacyToVault(window.localStorage, vault, password);
      await loadReadySnapshot();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Migrazione sicura non riuscita.');
      setGateState('MIGRATION_REQUIRED');
      throw error;
    }
  }, [getRuntime, loadReadySnapshot]);

  const handleRetry = useCallback(() => {
    void (async () => {
      try {
        if (storeRef.current && vaultRef.current) {
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
    const { vault } = getRuntime();
    await vault.clearAll();
    for (const legacyKey of LEGACY_DATA_KEYS) {
      window.localStorage.removeItem(legacyKey);
    }
    setSnapshot(null);
    setGateState('SETUP_REQUIRED');
  }, [getRuntime]);

  useEffect(() => {
    if (gateState !== 'READY' || autoLockMinutes === 0) return;

    let timeoutId = window.setTimeout(handleLock, autoLockMinutes * 60_000);
    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(handleLock, autoLockMinutes * 60_000);
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
  }, [autoLockMinutes, gateState, handleLock]);

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
          <App
            initialSnapshot={snapshot}
            secureStorage={storageRef.current}
            onFactoryReset={handleFactoryReset}
          />
          <VaultControls
            autoLockMinutes={autoLockMinutes}
            onAutoLockChange={handleAutoLockChange}
            onLock={handleLock}
          />
        </>
      ) : null}
    </VaultGate>
  );
};
