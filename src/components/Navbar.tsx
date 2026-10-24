import React from 'react';
import { ActiveTab, ClassData } from '../types';
import {
  Menu,
  X,
  LayoutDashboard,
  GraduationCap,
  Sparkles,
  ClipboardList,
  BarChart3,
  Table,
  History,
  UserCheck,
  Users,
  FileQuestion,
  CalendarDays,
  Settings,
  Download,
  Upload,
  ArrowLeft,
  BookOpen,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';


interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  currentClass: ClassData | undefined;
  classes?: ClassData[];
  onSelectClass?: (classId: string) => void;
  onNavigateHome: () => void;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  saveIndicatorText: string;
  onExportBackup: () => void;
  onImportBackup: () => void;
  isPrivacyShieldActive: boolean;
  onTogglePrivacyShield: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentClass,
  classes = [],
  onSelectClass,
  onNavigateHome,
  isDrawerOpen,
  setIsDrawerOpen,
  saveIndicatorText,
  onExportBackup,
  onImportBackup,
  isPrivacyShieldActive,
  onTogglePrivacyShield
}) => {

  const handleNav = (tab: ActiveTab) => {
    if (!currentClass && ['dashboard', 'voti', 'comportamenti', 'analytics', 'tabellone', 'storico', 'report', 'dati'].includes(tab)) {
      alert('Seleziona prima una classe da Classi.');
      return;
    }
    setActiveTab(tab);
    setIsDrawerOpen(false);
  };

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-b border-[var(--border)] px-3 sm:px-4 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsDrawerOpen(true)}
            className="min-h-[44px] min-w-[44px] p-2 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-slate-200 hover:text-[var(--primary)] hover:border-[var(--primary)] transition-all cursor-pointer"
            title="Apri Menu Navigazione"
            aria-label="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={onNavigateHome}
            className="cursor-pointer flex items-center gap-2 group select-none"
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/15 border border-[var(--primary)]/40 flex items-center justify-center text-[var(--primary)] shadow-[0_0_12px_var(--primary)] group-hover:scale-105 transition-transform">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <span className="hidden sm:block font-bold text-base tracking-tight text-white">
                Registro<span className="text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)]">Docente</span>
              </span>
              <span className="hidden sm:inline-block ml-2 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider bg-[var(--surface-variant)] text-slate-400 border border-[var(--border)]">
                Pro Neon
              </span>
            </div>
          </div>
        </div>

        {/* Center / Right Header controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick LIM Privacy Shield Toggle */}
          <button
            type="button"
            onClick={onTogglePrivacyShield}
            className={`min-h-[44px] min-w-[44px] px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-all cursor-pointer ${
              isPrivacyShieldActive
                ? 'bg-purple-950/70 border-purple-500 text-purple-300 shadow-[0_0_12px_rgba(192,132,252,0.35)]'
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'
            }`}
            title="Privacy Shield / Modalità LIM: maschera i nomi degli studenti sullo schermo proiettato in classe"
          >
            {isPrivacyShieldActive ? (
              <EyeOff className="w-3.5 h-3.5 text-purple-400" />
            ) : (
              <Eye className="w-3.5 h-3.5 text-slate-400" />
            )}
            <span className="hidden sm:inline">
              {isPrivacyShieldActive ? 'LIM Shield Attivo' : 'Privacy LIM'}
            </span>
          </button>

          {/* Quick Class Switcher Dropdown */}
          {currentClass && classes.length > 1 && onSelectClass ? (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-xs">
              <GraduationCap className="w-3.5 h-3.5 text-[var(--primary)]" />
              <select
                value={currentClass.id}
                onChange={e => onSelectClass(e.target.value)}
                className="bg-transparent text-white font-bold focus:outline-none cursor-pointer pr-1 text-xs"
                title="Cambia rapidamente classe attiva"
              >
                {classes.map(c => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          ) : currentClass ? (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--surface-variant)] border border-[var(--border)] text-xs text-slate-300">
              <GraduationCap className="w-3.5 h-3.5 text-[var(--primary)]" />
              <span>Classe: <b className="text-white">{currentClass.name}</b></span>
            </div>
          ) : null}

          <span
            aria-label={saveIndicatorText}
            title={saveIndicatorText}
            className="inline-flex items-center justify-center gap-1 min-h-[44px] min-w-[44px] sm:min-w-0 sm:px-2.5 rounded-md text-[11px] font-semibold badge-ok"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block sm:mr-0.5" />
            <span className="hidden sm:inline">{saveIndicatorText}</span>
          </span>
        </div>
      </header>

      {/* Desktop / Tablet Workflow Hub Bar — primary class navigation */}
      {currentClass && activeTab !== 'home' && (
        <div className="hidden md:flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-[var(--border)] text-xs overflow-x-auto shadow-sm">
          <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/80">
            <button
              onClick={() => handleNav('dashboard')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'dashboard' ? 'bg-[var(--primary)] text-black font-bold shadow-[0_0_8px_var(--primary)]' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>Riepilogo</span>
            </button>
            <button
              onClick={() => handleNav('voti')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'voti' ? 'bg-[var(--primary)] text-black font-bold shadow-[0_0_8px_var(--primary)]' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Valutazioni</span>
            </button>
            <button
              onClick={() => handleNav('comportamenti')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'comportamenti' ? 'bg-[var(--primary)] text-black font-bold shadow-[0_0_8px_var(--primary)]' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Comportamento</span>
            </button>
            <button
              onClick={() => handleNav('tabellone')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'tabellone' ? 'bg-[var(--primary)] text-black font-bold shadow-[0_0_8px_var(--primary)]' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Table className="w-3.5 h-3.5" />
              <span>Tabellone</span>
            </button>
            <button
              onClick={() => handleNav('analytics')}
              className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'analytics' ? 'bg-[var(--primary)] text-black font-bold shadow-[0_0_8px_var(--primary)]' : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Analisi</span>
            </button>
          </div>

          <button
            onClick={onNavigateHome}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Classi</span>
          </button>
        </div>
      )}

      {/* Class active banner for small screens */}
      {currentClass && activeTab !== 'home' && (
        <div className="md:hidden bg-[var(--surface-variant)] border-b border-[var(--border)] px-4 py-2 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="text-[var(--primary)] font-bold truncate">
              {currentClass.name}
            </span>
            <span className="text-slate-400 text-xs">
              ({currentClass.students.length} alunni)
            </span>
          </div>
          <button
            onClick={onNavigateHome}
            className="shrink-0 min-h-[44px] flex items-center gap-1 px-3 py-1 rounded bg-slate-800 text-slate-200 text-xs cursor-pointer"
          >
            <ArrowLeft className="w-3 h-3" /> Classi
          </button>
        </div>
      )}

      {/* Side Drawer Overlay */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#030712]/80 backdrop-blur-sm transition-opacity"
          onClick={() => setIsDrawerOpen(false)}
        />
      )}

      {/* Side Drawer */}
      <aside
        className={`fixed top-0 bottom-0 left-0 w-80 max-w-[85vw] bg-[var(--surface)] border-r border-[var(--border)] z-50 p-5 flex flex-col transition-transform duration-300 ease-out shadow-2xl ${
          isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[var(--border)] mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-[var(--primary)]" />
            <span className="font-bold text-sm tracking-wide text-white">Altre funzioni</span>
          </div>
          <button
            onClick={() => setIsDrawerOpen(false)}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-1 pr-1 text-sm">
          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 px-3 pt-1 pb-2">
            Generale
          </div>

          <button
            onClick={() => {
              onNavigateHome();
              setIsDrawerOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
              activeTab === 'home'
                ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold shadow-[0_0_12px_var(--border)]'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 text-[var(--primary)]" />
            <span>Classi</span>
          </button>

          {currentClass && (
            <>
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 px-3 pt-3 pb-1 border-t border-[var(--border)] mt-2">
                Classe
              </div>

              <button
                onClick={() => handleNav('storico')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  activeTab === 'storico'
                    ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <History className="w-4 h-4 shrink-0 text-blue-400" />
                <span>Storico prove</span>
              </button>

              <button
                onClick={() => handleNav('report')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  activeTab === 'report'
                    ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4 shrink-0 text-teal-400" />
                <span>Scheda alunno</span>
              </button>

              <button
                onClick={() => handleNav('dati')}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
                  activeTab === 'dati'
                    ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                    : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4 shrink-0 text-indigo-400" />
                <span>Gestione alunni</span>
              </button>
            </>
          )}

          <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 px-3 pt-3 pb-1 border-t border-[var(--border)] mt-2">
            Didattica e strumenti
          </div>

          <button
            onClick={() => handleNav('verifiche-online')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
              activeTab === 'verifiche-online'
                ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <FileQuestion className="w-4 h-4 shrink-0 text-pink-400" />
            <span>Verifiche online</span>
          </button>

          <button
            onClick={() => handleNav('programmazione')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
              activeTab === 'programmazione'
                ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4 shrink-0 text-cyan-400" />
            <span>Programmazione didattica</span>
          </button>

          <button
            onClick={() => handleNav('uda-gantt')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
              activeTab === 'uda-gantt'
                ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <CalendarDays className="w-4 h-4 shrink-0 text-orange-400" />
            <span>UDA</span>
          </button>

          <button
            onClick={() => handleNav('impostazioni')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
              activeTab === 'impostazioni'
                ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4 shrink-0 text-slate-400" />
            <span>Impostazioni</span>
          </button>

          <button
            onClick={() => handleNav('privacy')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all ${
              activeTab === 'privacy'
                ? 'bg-[var(--surface-variant)] text-[var(--primary)] font-semibold'
                : 'text-slate-300 hover:bg-slate-800/60 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>Privacy</span>
          </button>
        </div>


        {/* Drawer footer with backup actions */}
        <div className="pt-4 border-t border-[var(--border)] space-y-2 text-xs">
          <button
            onClick={() => {
              onExportBackup();
              setIsDrawerOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-variant)] hover:bg-slate-800 text-slate-200 border border-[var(--border)] font-medium"
          >
            <Download className="w-3.5 h-3.5 text-[var(--primary)]" />
            <span>Esporta backup cifrato</span>
          </button>

          <button
            onClick={() => {
              onImportBackup();
              setIsDrawerOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-[var(--surface-variant)] hover:bg-slate-800 text-slate-200 border border-[var(--border)] font-medium"
          >
            <Upload className="w-3.5 h-3.5 text-slate-300" />
            <span>Ripristina backup cifrato</span>
          </button>

          <div className="text-[10px] text-slate-500 text-center pt-1 font-mono">
            Registro Docente Pro · v3.5 Neon
          </div>
        </div>
      </aside>

      {/* Bottom Navigation for mobile */}
      {currentClass && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[var(--surface)]/95 backdrop-blur-md border-t border-[var(--border)] flex justify-around p-1 shadow-2xl">
          <button
            onClick={() => handleNav('dashboard')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1.5 px-1 text-[9px] leading-tight ${
              activeTab === 'dashboard' ? 'text-[var(--primary)] font-bold' : 'text-slate-400'
            }`}
          >
            <GraduationCap className="w-4 h-4 mb-0.5" />
            <span>Riepilogo</span>
          </button>
          <button
            onClick={() => handleNav('voti')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1.5 px-1 text-[9px] leading-tight ${
              activeTab === 'voti' ? 'text-[var(--primary)] font-bold' : 'text-slate-400'
            }`}
          >
            <ClipboardList className="w-4 h-4 mb-0.5" />
            <span>Valutazioni</span>
          </button>
          <button
            onClick={() => handleNav('comportamenti')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1.5 px-1 text-[9px] leading-tight ${
              activeTab === 'comportamenti' ? 'text-[var(--primary)] font-bold' : 'text-slate-400'
            }`}
          >
            <Sparkles className="w-4 h-4 mb-0.5" />
            <span>Comportamento</span>
          </button>
          <button
            onClick={() => handleNav('tabellone')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1.5 px-1 text-[9px] leading-tight ${
              activeTab === 'tabellone' ? 'text-[var(--primary)] font-bold' : 'text-slate-400'
            }`}
          >
            <Table className="w-4 h-4 mb-0.5" />
            <span>Tabellone</span>
          </button>
          <button
            onClick={() => handleNav('analytics')}
            className={`flex-1 min-h-[44px] flex flex-col items-center justify-center py-1.5 px-1 text-[9px] leading-tight ${
              activeTab === 'analytics' ? 'text-[var(--primary)] font-bold' : 'text-slate-400'
            }`}
          >
            <BarChart3 className="w-4 h-4 mb-0.5" />
            <span>Analisi</span>
          </button>
        </nav>
      )}
    </>
  );
};
