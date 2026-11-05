import React from 'react';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Menu,
  PencilLine,
} from 'lucide-react';
import type { HeaderContext } from './headerContext';
import type { HeaderSaveNotice } from './headerSaveEvidence';
import {
  getHeaderPrivacyPresentation,
  getHeaderSaveAnnouncement,
} from './headerTopBarPresentation';

/**
 * HEADER-01 / Task 2: controlled, standalone top bar.
 *
 * This component is NOT wired into Navbar/App in this increment.
 * The secure root retains authority for onLock; the existing privacy state
 * remains authoritative for onTogglePrivacyShield. The caller owns navigation,
 * focus return, menu contents and the lifecycle of save evidence.
 */
export interface Header01TopBarProps {
  context: Readonly<HeaderContext>;
  saveNotice?: Readonly<HeaderSaveNotice> | null;
  isPrivacyShieldActive: boolean;
  isMenuOpen: boolean;
  /** Must identify the real navigation drawer when this component is wired. */
  menuId: string;
  onToggleMenu: () => void;
  onTogglePrivacyShield: () => void;
  /** Must delegate directly to the existing SecureRegistroRoot lock handler. */
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
  const privacyPresentation = getHeaderPrivacyPresentation(isPrivacyShieldActive);
  const announcement = getHeaderSaveAnnouncement(saveNotice);

  return (
    <header
      data-testid="header01-topbar"
      className="sticky top-0 z-40 w-full min-w-0 border-b border-[var(--border)] bg-[var(--surface)]/95 text-slate-100 shadow-sm backdrop-blur-md"
    >
      <div className="flex w-full min-w-0 items-center gap-2 px-3 py-2.5 sm:px-4">
        <button
          type="button"
          data-testid="header01-open-menu"
          onClick={onToggleMenu}
          aria-label="Menu di navigazione"
          aria-expanded={isMenuOpen}
          aria-controls={menuId}
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-variant)] text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div data-testid="header01-context" className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            {context.showBrand && (
              <BookOpen
                className="hidden h-5 w-5 shrink-0 text-[var(--primary)] sm:block"
                aria-hidden="true"
              />
            )}
            <span
              className="block min-w-0 truncate text-sm font-semibold text-white sm:text-base"
              title={context.title}
            >
              {context.title}
            </span>
          </div>
          {context.subtitle && (
            <span
              className="block truncate text-[11px] leading-4 text-slate-300 sm:text-xs"
              title={context.subtitle}
            >
              {context.subtitle}
            </span>
          )}
        </div>

        <button
          type="button"
          data-testid="header01-privacy"
          onClick={onTogglePrivacyShield}
          aria-label={privacyPresentation.label}
          title={privacyPresentation.title}
          aria-pressed={privacyPresentation.pressed}
          className={`flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 ${
            isPrivacyShieldActive
              ? 'border-purple-500 bg-purple-950/70 text-purple-200'
              : 'border-[var(--border)] bg-[var(--surface-variant)] text-slate-200'
          }`}
        >
          {isPrivacyShieldActive
            ? <EyeOff className="h-5 w-5" aria-hidden="true" />
            : <Eye className="h-5 w-5" aria-hidden="true" />}
        </button>

        <button
          type="button"
          data-testid="header01-lock"
          onClick={onLock}
          aria-label="Blocca Registro"
          title="Blocca Registro"
          className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-variant)] text-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        >
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {announcement && (
        <div
          data-testid="header01-save-notice"
          role={announcement.role}
          aria-live={announcement.critical ? 'assertive' : 'polite'}
          aria-atomic="true"
          className={`flex min-w-0 items-center gap-2 border-t border-[var(--border)] px-3 py-1.5 text-xs sm:px-4 ${
            announcement.critical ? 'bg-rose-950/40 text-rose-200' : 'text-slate-300'
          }`}
        >
          {saveNotice?.kind === 'error'
            ? <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            : saveNotice?.kind === 'saved-local'
              ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
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
