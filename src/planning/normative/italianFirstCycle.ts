import type { NormativeReference, SchoolOrder } from '../types';

const VERSION = 'DPR-89-2009';
const SECONDARY_SOURCE = 'DPR_89_2009_ART5_TABLE_3';
const PRIMARY_SOURCE = 'DPR_89_2009_ART4';

interface NormativeLookupInput {
  schoolOrder: SchoolOrder;
  subjectCode: string;
  schoolYear: string;
}

interface LowerSecondaryAllocation {
  weeklyHours: number;
  annualHours: number;
  scope: 'discipline' | 'group';
  groupCode?: string;
}

const LOWER_SECONDARY_ALLOCATIONS: Readonly<Record<string, LowerSecondaryAllocation>> = {
  tecnologia: {
    weeklyHours: 2,
    annualHours: 66,
    scope: 'discipline'
  },
  inglese: {
    weeklyHours: 3,
    annualHours: 99,
    scope: 'discipline'
  },
  italiano: {
    weeklyHours: 9,
    annualHours: 297,
    scope: 'group',
    groupCode: 'italiano-storia-geografia'
  },
  storia: {
    weeklyHours: 9,
    annualHours: 297,
    scope: 'group',
    groupCode: 'italiano-storia-geografia'
  },
  geografia: {
    weeklyHours: 9,
    annualHours: 297,
    scope: 'group',
    groupCode: 'italiano-storia-geografia'
  }
};

export function getFirstCycleNormativeReference(input: NormativeLookupInput): NormativeReference {
  const subjectCode = input.subjectCode.trim().toLowerCase();
  const id = `first-cycle:${input.schoolOrder}:${subjectCode}:${input.schoolYear}`;

  if (input.schoolOrder === 'primary') {
    return {
      id,
      sourceRef: PRIMARY_SOURCE,
      version: VERSION,
      nationalHoursDefined: false,
      allocationScope: 'institution'
    };
  }

  const allocation = LOWER_SECONDARY_ALLOCATIONS[subjectCode];
  if (!allocation) {
    return {
      id,
      sourceRef: SECONDARY_SOURCE,
      version: VERSION,
      nationalHoursDefined: false,
      allocationScope: 'institution'
    };
  }

  return {
    id,
    sourceRef: SECONDARY_SOURCE,
    version: VERSION,
    nationalHoursDefined: true,
    nationalWeeklyHours: allocation.weeklyHours,
    nationalAnnualHours: allocation.annualHours,
    allocationScope: allocation.scope,
    ...(allocation.groupCode ? { allocationGroupCode: allocation.groupCode } : {})
  };
}
