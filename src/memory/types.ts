export type ProfessionalMemoryCategory =
  | 'format-preference'
  | 'didactic-pattern'
  | 'material-reuse'
  | 'planning-continuity'
  | 'workflow-preference';

export type ProfessionalMemoryEventKind =
  | 'proposal-adopted'
  | 'proposal-rejected'
  | 'proposal-modified'
  | 'source-reused'
  | 'source-linked'
  | 'artifact-created'
  | 'remember-explicit';

export type ProfessionalMemoryAllowedClassification =
  | 'TEACHER_PROFESSIONAL'
  | 'CURRICULUM_PLANNING'
  | 'PUBLIC_EXTERNAL_CONTENT'
  | 'AGGREGATED_NON_IDENTIFIABLE';

export type ProfessionalMemoryCandidateClassification =
  | ProfessionalMemoryAllowedClassification
  | 'STUDENT_PERSONAL'
  | 'AMBIGUOUS';

export interface ProfessionalMemoryContextRefsV1 {
  className?: string;
  udaId?: string;
  lessonId?: string;
  sourceId?: string;
  planningProfileId?: string;
  assessmentId?: string;
}

export interface ProfessionalMemoryProvenanceV1 {
  kind: 'teacher-explicit' | 'product-event' | 'consolidated-inference';
  canonicalRef?: string;
}

export interface ProfessionalMemoryEventV1 {
  id: string;
  kind: ProfessionalMemoryEventKind;
  category: ProfessionalMemoryCategory;
  occurredAt: string;
  descriptor: string;
  context: ProfessionalMemoryContextRefsV1;
  provenance: ProfessionalMemoryProvenanceV1;
  privacyClassification: ProfessionalMemoryAllowedClassification;
}

export interface ProfessionalMemoryEntryV1 {
  id: string;
  category: ProfessionalMemoryCategory;
  summary: string;
  provenance: ProfessionalMemoryProvenanceV1;
  sourceEventIds: string[];
  canonicalRefs: string[];
  createdAt: string;
  updatedAt: string;
  correctedByTeacherAt?: string;
  status: 'active' | 'stale';
  context: ProfessionalMemoryContextRefsV1;
  privacyClassification: ProfessionalMemoryAllowedClassification;
}

export interface ProfessionalMemorySettingsV1 {
  autoRemember: Record<ProfessionalMemoryCategory, boolean>;
}

export interface ProfessionalMemoryStateV1 {
  schemaVersion: 1;
  events: ProfessionalMemoryEventV1[];
  entries: ProfessionalMemoryEntryV1[];
  settings: ProfessionalMemorySettingsV1;
}

export interface ProfessionalMemoryWorkingItemV1 {
  entryId: string;
  category: ProfessionalMemoryCategory;
  summary: string;
  context: ProfessionalMemoryContextRefsV1;
  provenanceKind: ProfessionalMemoryProvenanceV1['kind'];
  updatedAt: string;
}

export interface ProfessionalMemoryWorkingSetV1 {
  schema: 'registro.professional-memory-working-set/v1';
  items: ProfessionalMemoryWorkingItemV1[];
}

export interface RemoteProfessionalMemoryProjectionV1 {
  schema: 'registro.professional-memory-remote/v1';
  items: Array<{
    category: ProfessionalMemoryCategory;
    summary: string;
  }>;
}
