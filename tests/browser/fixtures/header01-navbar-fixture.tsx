import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Navbar, type Header01SecurityBindings } from '../../../src/components/Navbar';
import { VaultControls } from '../../../src/components/VaultControls';
import type { ActiveTab, ClassData } from '../../../src/types';
import '../../../src/index.css';

/**
 * Mount the real Navbar and the real VaultControls with synthetic bindings.
 * The secure root, real student data, persistence and professional navigation
 * are intentionally not available in this fixture.
 */
function Fixture() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('voti');
  const [currentClass, setCurrentClass] = useState<ClassData | undefined>({
    id: 'test-3a', name: '3ª A', students: [],
  } as unknown as ClassData);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPrivacyShieldActive, setIsPrivacyShieldActive] = useState(true);
  const [autoLockMinutes, setAutoLockMinutes] = useState<0 | 15 | 30 | 60>(15);
  const [lockClicks, setLockClicks] = useState(0);
  const [homeVisits, setHomeVisits] = useState(0);

  const security: Header01SecurityBindings = {
    autoLockMinutes,
    onAutoLockChange: setAutoLockMinutes,
    onLock: () => setLockClicks(v => v + 1),
  };

  return (
    <>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentClass={currentClass}
        classes={currentClass ? [currentClass] : []}
        onNavigateHome={() => {
          setHomeVisits(v => v + 1);
          setCurrentClass(undefined);
          setActiveTab('home');
        }}
        isDrawerOpen={isDrawerOpen}
        setIsDrawerOpen={setIsDrawerOpen}
        saveIndicatorText="Sincronizzato"
        onExportBackup={() => {}}
        onImportBackup={() => {}}
        isPrivacyShieldActive={isPrivacyShieldActive}
        onTogglePrivacyShield={() => setIsPrivacyShieldActive(v => !v)}
        headerSecurity={security}
      />
      <VaultControls
        autoLockMinutes={autoLockMinutes}
        onAutoLockChange={setAutoLockMinutes}
        onLock={security.onLock}
        mobileControlsEnabled={false}
      />
      <main className="p-3 text-slate-100">
        <p data-testid="header01-integration-active-tab">{activeTab}</p>
        <p data-testid="header01-integration-home-visits">Visite Oggi: {homeVisits}</p>
        <p data-testid="header01-integration-lock-count">Blocchi: {lockClicks}</p>
        <p data-testid="header01-integration-auto-lock">Blocco automatico: {autoLockMinutes} minuti</p>
        <input aria-label="Campo di prova tastiera" className="mt-6 w-full rounded border p-3 text-black"/>
      </main>
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Fixture />);
