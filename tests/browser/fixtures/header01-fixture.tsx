import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Header01TopBar } from '../../../src/components/Header01TopBar';
import { Header01DrawerSecurity, type HeaderAutoLockMinutes } from '../../../src/components/Header01DrawerSecurity';
import { resolveHeaderContext } from '../../../src/components/headerContext';
import { resolveHeaderSaveNotice } from '../../../src/components/headerSaveEvidence';
import '../../../src/index.css';

/**
 * Synthetic HEADER-01 experience in a real browser.
 * No real personal data, SecureRegistroRoot, persistence, navigation backend,
 * class switching or professional writes. Buttons invoke state fakes only.
 */
function Fixture() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [privacyActive, setPrivacyActive] = useState(true);
  const [lockClicks, setLockClicks] = useState(0);
  const [status, setStatus] = useState<'unknown' | 'error' | 'success'>('unknown');
  const [longTitle, setLongTitle] = useState(false);
  const [homeVisits, setHomeVisits] = useState(0);
  const [autoLockMinutes, setAutoLockMinutes] = useState<HeaderAutoLockMinutes>(15);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (menuOpen) {
      document.getElementById('header01-go-home')?.focus();
    } else if (wasOpen.current) {
      document.querySelector<HTMLButtonElement>('[data-testid="header01-brand-navigation"]')?.focus();
    }
    wasOpen.current = menuOpen;
  }, [menuOpen]);

  const context = longTitle
    ? {
        title: 'Programmazione didattica interdisciplinare e documentazione del percorso per le classi seconde',
        subtitle: 'Classe Seconda C — Modifica in corso',
        showBrand: false,
      }
    : homeVisits > 0
      ? resolveHeaderContext({ activeTab: 'home', currentClassName: '2C' })
      : resolveHeaderContext({ activeTab: 'voti', currentClassName: '2C' });

  const saveNotice = resolveHeaderSaveNotice(
    status === 'error'
      ? { unresolvedFailure: { operationId: '', scope: 'programmazione', unresolved: true }, confirmedCommit: { operationId: 'previous', scope: 'registro', durableConfirmed: true } }
      : status === 'success'
        ? { confirmedCommit: { operationId: 'committed', scope: 'registro', durableConfirmed: true } }
        : {},
  );

  return (
    <>
      <Header01TopBar
        context={context}
        saveNotice={saveNotice}
        isPrivacyShieldActive={privacyActive}
        isMenuOpen={menuOpen}
        menuId="header01-test-drawer"
        onToggleMenu={() => setMenuOpen(open => !open)}
        onTogglePrivacyShield={() => setPrivacyActive(active => !active)}
        onLock={() => setLockClicks(count => count + 1)}
      />
      <nav
        id="header01-test-drawer"
        data-testid="header01-navigation-drawer"
        aria-label="Navigazione del Registro"
        hidden={!menuOpen}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setMenuOpen(false);
          }
        }}
        className="border-b border-[var(--border)] bg-[var(--surface)] p-3"
      >
        <h2 className="mb-3 text-sm font-semibold">Navigazione</h2>
        <button
          id="header01-go-home"
          type="button"
          data-testid="header01-go-home"
          className="min-h-[48px] w-full rounded-xl bg-slate-800 px-3 text-left font-semibold"
          onClick={() => {
            setHomeVisits(count => count + 1);
            setMenuOpen(false);
            setLongTitle(false);
          }}
        >
          Oggi
        </button>
        <Header01DrawerSecurity
          autoLockMinutes={autoLockMinutes}
          onAutoLockChange={setAutoLockMinutes}
        />
      </nav>
      <main className="px-3 py-6 text-slate-100">
        <p data-testid="header01-home-visits">Visite Oggi: {homeVisits}</p>
        <p data-testid="header01-lock-clicks">Blocchi: {lockClicks}</p>
        <p data-testid="header01-auto-lock-minutes">Blocco automatico: {autoLockMinutes} minuti</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" data-testid="header01-show-error" onClick={() => setStatus('error')}>Simula errore</button>
          <button type="button" data-testid="header01-show-success" onClick={() => setStatus('success')}>Simula conferma</button>
          <button type="button" data-testid="header01-clear-status" onClick={() => setStatus('unknown')}>Azzera stato</button>
          <button type="button" data-testid="header01-long-context" onClick={() => setLongTitle(true)}>Titolo lungo</button>
        </div>
        <input aria-label="Campo di prova tastiera" className="mt-6 w-full rounded border border-slate-500 p-3 text-slate-950" />
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<Fixture />);
