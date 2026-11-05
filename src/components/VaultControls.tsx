import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock3, LockKeyhole } from 'lucide-react';

type AutoLockMinutes = 0 | 15 | 30 | 60;

interface VaultControlsProps {
  autoLockMinutes: AutoLockMinutes;
  onAutoLockChange: (minutes: AutoLockMinutes) => void;
  onLock: () => void;
  copilotSurfaceOpen?: boolean;
  /** Keep legacy mobile portal available only for non-HEADER-01 consumers. */
  mobileControlsEnabled?: boolean;
}

export const VaultControls: React.FC<VaultControlsProps> = ({
  autoLockMinutes,
  onAutoLockChange,
  onLock,
  copilotSurfaceOpen = false,
  mobileControlsEnabled = true,
}) => {
  const [mobileSettingsOpen, setMobileSettingsOpen] = useState(false);
  const [mobileHeaderHost, setMobileHeaderHost] = useState<HTMLElement | null>(null);

  // Navbar is mounted by App before this sibling is committed by
  // SecureRegistroRoot. The portal changes only the visual placement;
  // Vault state and handlers remain owned by the secure root.
  useLayoutEffect(() => {
    if (mobileControlsEnabled) {
      setMobileHeaderHost(document.getElementById('registro-vault-header-actions'));
    }
  }, [mobileControlsEnabled]);

  useEffect(() => {
    if (copilotSurfaceOpen) setMobileSettingsOpen(false);
  }, [copilotSurfaceOpen]);

  const mobileControls = (
    <div className="relative flex items-center gap-1 text-xs text-slate-200">
      {!copilotSurfaceOpen && mobileSettingsOpen && (
        <div className="absolute top-full right-0 z-50 mt-2 w-44 rounded-xl border border-slate-700 bg-slate-950/98 p-2 shadow-xl">
          <label htmlFor="vault-auto-lock-mobile" className="mb-1 block text-[11px] font-semibold text-slate-400">Blocco automatico</label>
          <select
            id="vault-auto-lock-mobile"
            aria-label="Blocco automatico Registro"
            value={autoLockMinutes}
            onChange={(event) => {
              onAutoLockChange(Number(event.target.value) as AutoLockMinutes);
              setMobileSettingsOpen(false);
            }}
            className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs"
            title="Blocco automatico per inattività"
          >
            <option value={0}>Mai</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={60}>60 min</option>
          </select>
        </div>
      )}
      {!copilotSurfaceOpen && (
        <button
          type="button"
          onClick={() => setMobileSettingsOpen(value => !value)}
          aria-label="Imposta blocco automatico"
          aria-expanded={mobileSettingsOpen}
          className="min-h-11 min-w-11 rounded-xl border border-slate-700 bg-slate-950/95 p-2 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
        >
          <Clock3 className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
      <button
        type="button"
        onClick={onLock}
        aria-label="Blocca Registro"
        className="min-h-11 min-w-11 rounded-xl border border-slate-600 bg-slate-950/95 p-2 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
      >
        <LockKeyhole className="h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  );

  return (
    <>
      {mobileControlsEnabled && mobileHeaderHost && createPortal(mobileControls, mobileHeaderHost)}

      <div className="hidden md:flex fixed bottom-3 right-3 z-50 items-center gap-2 rounded-xl border border-slate-700 bg-slate-950/95 p-2 text-xs text-slate-200 shadow-xl">
        <label htmlFor="vault-auto-lock-desktop" className="sr-only">Blocco automatico Registro</label>
        <select
          id="vault-auto-lock-desktop"
          value={autoLockMinutes}
          onChange={(event) => onAutoLockChange(Number(event.target.value) as AutoLockMinutes)}
          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-2"
          title="Blocco automatico per inattività"
        >
          <option value={0}>Mai durante la lezione</option>
          <option value={15}>15 min</option>
          <option value={30}>30 min</option>
          <option value={60}>60 min</option>
        </select>
        <button
          type="button"
          onClick={onLock}
          className="rounded-lg border border-slate-600 px-3 py-2 font-semibold hover:bg-slate-800"
        >
          Blocca Registro
        </button>
      </div>
    </>
  );
};
