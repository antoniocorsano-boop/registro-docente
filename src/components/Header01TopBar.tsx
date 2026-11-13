import React from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
} from 'lucide-react';
import type { HeaderContext } from './headerContext';
import type { HeaderSaveNotice } from './headerSaveEvidence';
import {
  getHeaderNavigationPresentation,
  getHeaderPrivacyPresentation,
  getHeaderSaveAnnouncement,
  getHeaderVisualContext,
} from './headerTopBarPresentation';

/**
 * HEADER-01 — premium mobile-first professional app bar.
 *
 * The book mark is the ONE navigation trigger, not a hidden "Go Home" action.
 * Real navigation and unsaved-edit guards belong to the host. Direct locking
 * remains owned by SecureRegistroRoot. Saving is evidence-driven and must
 * never be inferred from a toast message or animation.
 *
 * NOT yet wired into Navbar, App or SecureRegistroRoot.
 */
export interface Header01TopBarProps {
  context: Readonly<HeaderContext>;
  saveNotice?: Readonly<HeaderSaveNotice> | null;
  isPrivacyShieldActive: boolean;
  isMenuOpen: boolean;
  /** ID of the actual drawer, supplied by the host; not a made-up destination. */
  menuId: string;
  onToggleMenu: () => void;
  onTogglePrivacyShield: () => void;
  onLock: () => void;
}

export const Header01TopBar: React.FC<Header01TopBarProps> = ({
  context,
  saveNotice,
  isPrivacyShieldActive,
  isMenuOpen,
  menuId,
  onToggleMenu,
  onTogglePrivacyShield,
  onLock,
}) => {
  const visualContext = getHeaderVisualContext(context);
  const navigationPresentation = getHeaderNavigationPresentation(isMenuOpen);
  const privacyPresentation = getHeaderPrivacyPresentation(isPrivacyShieldActive);
  const announcement = getHeaderSaveAnnouncement(saveNotice);

  const iconButton =
    'flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-xl border border-transparent transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300';

  return (
    <header
      data-testid="header01-topbar"
      data-report-context={context.title === 'Scheda alunno' ? 'true' : undefined}
      data-evaluation-context={context.title === 'Valutazioni' || context.title === 'Tabellone' ? 'true' : undefined}
      className="sticky top-0 z-40 w-full min-w-0 border-b border-[var(--border)] bg-[var(--surface)]/95 text-slate-100 shadow-sm backdrop-blur-md"
    >
      <div className="flex w-full min-w-0 items-center gap-2 px-3 py-2 max-[360px]:gap-1 max-[360px]:px-2 sm:gap-3 sm:px-4 header01-row">
        {/* Single brand-navigation control: no separate hamburger and no home side effect. */}
        <button
          type="button"
          data-testid="header01-brand-navigation"
          onClick={onToggleMenu}
          aria-label={navigationPresentation.label}
          aria-expanded={navigationPresentation.expanded}
          aria-controls={menuId}
          title={navigationPresentation.label}
          className="relative flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface-variant)] text-[var(--primary)] transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <BookOpen className="h-6 w-6" aria-hidden="true" />
          <ChevronDown
            className={`absolute bottom-1 right-1 h-2.5 w-2.5 text-slate-300 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        <div data-testid="header01-context" className="min-w-0 flex-1">
          <div data-testid="header01-context-title" className="min-w-0 break-words text-sm font-semibold leading-5 text-slate-100 sm:text-base" title={visualContext.title}>
            {visualContext.title}
          </div>
          {visualContext.subtitle && (
            <div data-testid="header01-context-subtitle" className="min-w-0 break-words text-[11px] leading-4 text-slate-400 sm:text-xs" title={visualContext.subtitle}>
              {visualContext.subtitle}
            </div>
          )}
        </div>

        {/* One low-noise group. Two distinct security operations; both stay one tap away. */}
        <div
          role="group"
          aria-label="Riservatezza e blocco del Registro"
          className="flex shrink-0 items-center gap-0.5 rounded-2xl border border-slate-700/60 bg-slate-900/60 p-0.5"
        >
          <button
            type="button"
            data-testid="header01-privacy"
            onClick={onTogglePrivacyShield}
            aria-label={privacyPresentation.label}
            title={privacyPresentation.title}
            aria-pressed={privacyPresentation.pressed}
            data-privacy-state={isPrivacyShieldActive ? 'protected' : 'visible'}
            className={`${iconButton} ${isPrivacyShieldActive ? 'bg-violet-500/10 text-violet-200' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            {isPrivacyShieldActive
              ? <EyeOff className="h-5 w-5" aria-hidden="true" />
              : <Eye className="h-5 w-5" aria-hidden="true" />}
          </button>
          <span aria-hidden="true" className="h-5 w-px bg-slate-700/60" />
          <button
            type="button"
            data-testid="header01-lock"
            onClick={onLock}
            aria-label="Blocca Registro"
            title="Blocca Registro"
            className={`${iconButton} text-slate-200 hover:bg-slate-800`}
          >
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {announcement && (
        <div
          data-testid="header01-save-notice"
          role={announcement.role}
          aria-live={announcement.critical ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`flex min-w-0 items-center gap-2 border-t px-3 py-1.5 text-xs sm:px-4 ${
            announcement.critical
              ? 'border-rose-800/60 bg-rose-950/50 text-rose-200'
              : 'border-slate-700/50 text-slate-300'
          }`}
        >
          {saveNotice?.kind === 'error'
            ? <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            : saveNotice?.kind === 'saved-local'
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
              : saveNotice?.kind === 'saving'
                ? <LoaderCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                : <PencilLine className="h-4 w-4 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 truncate" title={announcement.message}>
            {announcement.message}
          </span>
        </div>
      )}
    </header>
  );
};
