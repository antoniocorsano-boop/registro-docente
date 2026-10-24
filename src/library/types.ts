export type LibrarySourceKind =
  | 'image'
  | 'file'
  | 'web'
  | 'text'
  | 'note'
  | 'concept'
  | 'internal';

export type LibrarySourceStatus =
  | 'captured'
  | 'ready'
  | 'needs-review'
  | 'restricted'
  | 'failed';

export type LibraryPrivacyStatus =
  | 'unknown'
  | 'teacher-professional'
  | 'student-personal';

export interface LibrarySourceLink {
  targetType: 'uda' | 'lesson' | 'activity';
  targetId: string;
}

export interface LibrarySourcePayload {
  mimeType?: string;
  text?: string;
  dataUrl?: string;
}

export interface LibrarySource {
  id: string;
  kind: LibrarySourceKind;
  title: string;
  capturedAt: string;
  origin?: string;
  sourceUrl?: string;
  payload: LibrarySourcePayload;
  extractedText?: string;
  status: LibrarySourceStatus;
  privacy: LibraryPrivacyStatus;
  links: LibrarySourceLink[];
  notes?: string;
}

export interface LibraryStateV1 {
  schemaVersion: 1;
  sources: LibrarySource[];
}
