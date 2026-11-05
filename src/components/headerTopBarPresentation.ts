import type { HeaderSaveNotice } from './headerSaveEvidence';

/**
 * Presentation-only semantics of the compact header.
 * Never reads the secure vault, student data, storage, or transient toasts.
 */
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
