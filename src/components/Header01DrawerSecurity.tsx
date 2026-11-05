import React from 'react';

export type HeaderAutoLockMinutes = 0 | 15 | 30 | 60;

/**
 * Secondary, controlled security settings for the existing navigation drawer.
 * It owns no timers, credentials or Vault state. The host must delegate the
 * onAutoLockChange callback to the existing SecureRegistroRoot authority.
 *
 * This is a standalone component for future integration, not mounted in App.
 */
export interface Header01DrawerSecurityProps {
  autoLockMinutes: HeaderAutoLockMinutes;
  onAutoLockChange: (value: HeaderAutoLockMinutes) => void;
  idPrefix?: string;
}

export const Header01DrawerSecurity: React.FC<Header01DrawerSecurityProps> = ({
  autoLockMinutes,
  onAutoLockChange,
  idPrefix = 'header01',
}) => {
  const headingId = `${idPrefix}-security-title`;
  const selectId = `${idPrefix}-auto-lock`;
  return (
    <section
      data-testid="header01-security-section"
      aria-labelledby={headingId}
      className="space-y-3 border-t border-[var(--border)] px-3 py-4"
    >
      <h2 id={headingId} className="text-sm font-semibold text-slate-100">
        Sicurezza
      </h2>
      <label htmlFor={selectId} className="block text-xs font-medium text-slate-300">
        Blocco automatico
      </label>
      <select
        id={selectId}
        data-testid="header01-auto-lock"
        value={autoLockMinutes}
        onChange={(event) => onAutoLockChange(Number(event.target.value) as HeaderAutoLockMinutes)}
        className="min-h-12 w-full rounded-xl border border-[var(--border)] bg-[var(--surface-variant)] px-3 text-sm text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
      >
        <option value={0}>Mai</option>
        <option value={15}>15 minuti</option>
        <option value={30}>30 minuti</option>
        <option value={60}>60 minuti</option>
      </select>
      <p className="text-xs leading-5 text-slate-400">
        Imposta quando bloccare il Registro in caso di inattività.
      </p>
    </section>
  );
};
