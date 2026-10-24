import React from 'react';

type AutoLockMinutes = 0 | 15 | 30 | 60;

interface VaultControlsProps {
  autoLockMinutes: AutoLockMinutes;
  onAutoLockChange: (minutes: AutoLockMinutes) => void;
  onLock: () => void;
}

export const VaultControls: React.FC<VaultControlsProps> = ({
  autoLockMinutes,
  onAutoLockChange,
  onLock,
}) => (
  <>
    <div className="md:hidden fixed bottom-16 right-3 z-50 flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/95 p-1 text-xs text-slate-200 shadow-xl">
      <label htmlFor="vault-auto-lock-mobile" className="sr-only">Blocco automatico Registro</label>
      <select
        id="vault-auto-lock-mobile"
        aria-label="Blocco automatico Registro"
        value={autoLockMinutes}
        onChange={(event) => onAutoLockChange(Number(event.target.value) as AutoLockMinutes)}
        className="min-h-11 w-[88px] rounded-lg border border-slate-700 bg-slate-900 px-2 text-xs"
        title="Blocco automatico per inattività"
      >
        <option value={0}>Mai</option>
        <option value={15}>15 min</option>
        <option value={30}>30 min</option>
        <option value={60}>60 min</option>
      </select>
      <button
        type="button"
        onClick={onLock}
        aria-label="Blocca Registro"
        className="min-h-11 min-w-11 rounded-lg border border-slate-600 px-3 font-semibold hover:bg-slate-800"
      >
        Blocca
      </button>
    </div>

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
