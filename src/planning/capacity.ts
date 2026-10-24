import type { EffectiveCapacity, TeachingProfile } from './types';

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isoWeekday(date: Date): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const day = date.getUTCDay();
  return (day === 0 ? 7 : day) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

function roundHours(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function calculateEffectiveCapacity(profile: TeachingProfile): EffectiveCapacity {
  const start = parseIsoDate(profile.calendar.startDate);
  const end = parseIsoDate(profile.calendar.endDate);
  const closures = new Set(profile.calendar.closureDates);
  let effectiveHours = 0;

  for (let current = new Date(start); current <= end; current.setUTCDate(current.getUTCDate() + 1)) {
    const date = isoDate(current);
    if (closures.has(date)) continue;

    const weekday = isoWeekday(current);
    for (const slot of profile.calendar.weeklySlots) {
      if (slot.weekday === weekday) effectiveHours += slot.hours;
    }
  }

  const roundedEffective = roundHours(effectiveHours);
  const reserveHours = roundHours(roundedEffective * profile.reservePercent / 100);

  return {
    effectiveHours: roundedEffective,
    reservePercent: profile.reservePercent,
    reserveHours,
    programmableHours: roundHours(roundedEffective - reserveHours)
  };
}
