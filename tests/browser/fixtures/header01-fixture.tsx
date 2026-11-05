import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Header01TopBar } from '../../../src/components/Header01TopBar';
import { resolveHeaderContext } from '../../../src/components/headerContext';
import { resolveHeaderSaveNotice } from '../../../src/components/headerSaveEvidence';
import '../../../src/index.css';

/**
 * Synthetic, unconnected fixture to qualify the exact HEADER-01 component in
 * Chromium. There is no access to student data, SecureRegistroRoot, storage,
 * the real navigation dispatcher, or any durable mutation.
 */
function Fixture() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [privacyActive, setPrivacyActive] = useState(true);
  const [lockClicks, setLockClicks] = useState(0);
  const [status, setStatus] = useState<'unknown' | 'error' | 'success'>('unknown');
  const [longTitle, setLongTitle] = useState(false);

  const context = longTitle
    ? { title: 'Programmazione didattica interdisciplinare e documentazione del percorso per le classi seconde', subtitle: 'Classe Seconda C — Modifica in corso', showBrand: false }
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
      <main className="px-3 py-6 text-slate-100">
        <nav id="header01-test-drawer" aria-label="Pannello di prova" hidden={!menuOpen}>
          <p data-testid="header01-menu-open">Menu aperto</p>
        </nav>
        <p data-testid="header01-lock-clicks">Blocchi: {lockClicks}</p>
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
