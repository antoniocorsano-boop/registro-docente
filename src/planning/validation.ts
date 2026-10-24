import type { AssessmentPeriodDefinition, TeachingProfile } from './types';

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function periodsOverlap(left: AssessmentPeriodDefinition, right: AssessmentPeriodDefinition): boolean {
  return left.startDate <= right.endDate && right.startDate <= left.endDate;
}

export function validateTeachingProfile(profile: TeachingProfile): string[] {
  const errors: string[] = [];
  const add = (code: string) => {
    if (!errors.includes(code)) errors.push(code);
  };

  if (profile.reservePercent < 0 || profile.reservePercent > 50) {
    add('RESERVE_PERCENT_OUT_OF_RANGE');
  }

  if (!isIsoDate(profile.calendar.startDate)
    || !isIsoDate(profile.calendar.endDate)
    || profile.calendar.startDate > profile.calendar.endDate) {
    add('CALENDAR_RANGE_INVALID');
  }

  if (!profile.normativeReference.nationalHoursDefined && !profile.localAllocation) {
    add('LOCAL_ALLOCATION_REQUIRED');
  }

  if (profile.localAllocation && profile.localAllocation.annualHours <= 0) {
    add('LOCAL_ALLOCATION_INVALID');
  }

  for (const slot of profile.calendar.weeklySlots) {
    if (slot.hours <= 0) add('WEEKLY_SLOT_HOURS_INVALID');
  }

  for (const closureDate of profile.calendar.closureDates) {
    if (!isIsoDate(closureDate)) add('CLOSURE_DATE_INVALID');
  }

  if (profile.assessmentPeriods.length === 0) {
    add('ASSESSMENT_PERIOD_REQUIRED');
  }

  for (const period of profile.assessmentPeriods) {
    if (!isIsoDate(period.startDate)
      || !isIsoDate(period.endDate)
      || period.startDate > period.endDate) {
      add('ASSESSMENT_PERIOD_RANGE_INVALID');
    }

    if (period.startDate < profile.calendar.startDate || period.endDate > profile.calendar.endDate) {
      add('ASSESSMENT_PERIOD_OUTSIDE_CALENDAR');
    }
  }

  for (let i = 0; i < profile.assessmentPeriods.length; i += 1) {
    for (let j = i + 1; j < profile.assessmentPeriods.length; j += 1) {
      if (periodsOverlap(profile.assessmentPeriods[i], profile.assessmentPeriods[j])) {
        add('ASSESSMENT_PERIOD_OVERLAP');
      }
    }
  }

  return errors;
}
