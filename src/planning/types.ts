export type SchoolOrder = 'primary' | 'lower_secondary';

export interface AssessmentPeriodDefinition {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
  ordinal: number;
}

export interface WeeklyTeachingSlot {
  id: string;
  weekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  hours: number;
}

export interface TeachingCalendar {
  startDate: string;
  endDate: string;
  closureDates: string[];
  weeklySlots: WeeklyTeachingSlot[];
}

export type NormativeAllocationScope = 'discipline' | 'group' | 'institution';

export interface NormativeReference {
  id: string;
  sourceRef: string;
  version: string;
  nationalHoursDefined: boolean;
  nationalWeeklyHours?: number;
  nationalAnnualHours?: number;
  allocationScope?: NormativeAllocationScope;
  allocationGroupCode?: string;
}

export interface LocalTeachingAllocation {
  annualHours: number;
  weeklyHours?: number;
  source: 'teacher' | 'school';
  note?: string;
}

export interface EffectiveCapacity {
  effectiveHours: number;
  reservePercent: number;
  reserveHours: number;
  programmableHours: number;
}

export interface TeachingProfile {
  id: string;
  schoolYear: string;
  schoolOrder: SchoolOrder;
  gradeLevel: number;
  cohortRef: string;
  subjectCode: string;
  normativeReference: NormativeReference;
  localAllocation?: LocalTeachingAllocation;
  reservePercent: number;
  assessmentPeriods: AssessmentPeriodDefinition[];
  calendar: TeachingCalendar;
}

export interface ArenaPlanningContext {
  id: string;
  curriculumVersionRef: string;
  authorityState: 'APPROVED' | 'PROVISIONAL_COMPLETE';
  vigencyStatus: 'VIGENTE' | 'NON_VIGENTE';
  structuralFingerprint?: string;
  institutionRef: string;
  schoolYear: string;
  subjectCode: string;
  gradeLevel: number;
  cohortRef: string;
  applicabilityStatus: 'APPLICABLE' | 'TRANSITIONAL';
  regimeRef: string;
  requirementRefs: string[];
  provenanceRefs: string[];
}

export interface PrivateTeachingResource {
  id: string;
  kind: 'textbook' | 'teacher_guide' | 'other';
  title: string;
  isbn?: string;
  editionYear?: number;
  fingerprint?: string;
  chunkRefs?: string[];
}

export interface MasterProgram {
  id: string;
  profileId: string;
  arenaContextId: string;
  status: 'draft' | 'approved';
  currentVersionId?: string;
}

export interface MasterProgramVersion {
  id: string;
  masterProgramId: string;
  version: number;
  approvedAt: string;
  udaIds: string[];
}

export interface ClassProgramInstance {
  id: string;
  classId: string;
  masterProgramId: string;
  adoptedVersionId: string;
  localOverrideRefs?: string[];
}

export interface PlanningStateV1 {
  schemaVersion: 1;
  profiles: TeachingProfile[];
  arenaContexts: ArenaPlanningContext[];
  resources: PrivateTeachingResource[];
  masterPrograms: MasterProgram[];
  classInstances: ClassProgramInstance[];
}
