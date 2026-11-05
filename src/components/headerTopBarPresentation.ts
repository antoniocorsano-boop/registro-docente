import type { HeaderContext } from './headerContext';
import type { HeaderSaveNotice } from './headerSaveEvidence';

/**
 * HEADER-01: narrow professional app bar. Display context is a presentation
 * projection only. It never changes the actual class, route, or save authority.
 */
export interface HeaderVisualContext {
  title: string;
  subtitle: string | null;
}

export function getHeaderVisualContext(context: Readonly<HeaderContext>): HeaderVisualContext {
  return context.showBrand && context.subtitle === 'Oggi'
    ? { title: 'Oggi', subtitle: context.title }
    : { title: context.title, subtitle: context.subtitle };
}

export interface HeaderNavigationPresentation {
  expanded: boolean;
  label: string;
}

/** The brand is a *single* explicit navigation trigger, never Home. */
export function getHeaderNavigationPresentation(expanded: boolean): HeaderNavigationPresentation {
  return {
    expanded,
    label: expanded ? 'Chiudi navigazione del Registro' : 'Apri navigazione del Registro',
  };
}

export interface HeaderPrivacyPresentation {
  pressed: boolean;
  label: string;
  title: string;
}

export function getHeaderPrivacyPresentation(active: boolean): HeaderPrivacyPresentation {
  return active
    ? {
        pressed: true,
        label: 'Nomi protetti. Mostra i nomi',
        title: 'Protezione nominativi attiva',
      }
    : {
        pressed: false,
        label: 'Nomi visibili. Proteggi i nomi',
        title: 'Protezione nominativi disattivata',
      };
}

export interface HeaderSaveAnnouncement {
  role: 'status' | 'alert';
  message: string;
  critical: boolean;
}

export function getHeaderSaveAnnouncement(
  notice: Readonly<HeaderSaveNotice> | null | undefined,
): HeaderSaveAnnouncement | null {
  if (!notice || notice.kind === 'unknown' || !notice.message) return null;
  return {
    role: notice.kind === 'error' ? 'alert' : 'status',
    message: notice.message,
    critical: notice.kind === 'error',
  };
}
