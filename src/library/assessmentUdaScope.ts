import type { UdaRecord } from '../types';

// Normalize the full identity, including an explicit school-order suffix.
// The short code is distinct from the canonical full name.
export function normalizeAssessmentClassName(value: string): string | null {
  const parts = value.trim().replace(/[ªº°]/g, '').split(/\s+[-–—]\s+/);
  const code = (parts[0] || '').replace(/\s+/g, '').toLocaleLowerCase('it');
  if (!code) return null;
  const details = parts.slice(1).map(item => item.trim().replace(/\s+/g, ' ').toLocaleLowerCase('it'));
  return details.length > 0 ? [code, ...details].join(' - ') : code;
}

function classShortCode(full: string): string {
  return full.split(' - ', 1)[0];
}

export function isAssessmentUdaForClass(
  uda: Pick<UdaRecord, 'className'>,
  activeClassName: string,
  registeredClassNames: readonly string[]
): boolean {
  const active = normalizeAssessmentClassName(activeClassName);
  const candidate = normalizeAssessmentClassName(uda.className);
  if (!active || !candidate) return false;

  // The active class must still exist, and the label must be unambiguous.
  const registered = registeredClassNames
    .map(normalizeAssessmentClassName)
    .filter((item): item is string => item !== null);
  if (registered.filter(item => item === active).length !== 1) return false;

  // Explicit full names are authoritative. Different school orders never match.
  if (candidate === active) return true;
  if (candidate.includes(' - ') || !active.includes(' - ')) return false;

  // Legacy UDA labels such as "3ª A" can be used only if exactly one
  // registered class shares the short code. Never guess between two orders.
  return candidate === classShortCode(active)
    && registered.filter(item => classShortCode(item) === candidate).length === 1;
}

export function isAssessmentUdaSelectionAllowed(
  udaId: string | undefined,
  udas: Pick<UdaRecord, 'id' | 'className'>[],
  activeClassName: string,
  registeredClassNames: readonly string[]
): boolean {
  if (!udaId) return true; // Optional means no association, never a guess.
  return udas.some(uda =>
    uda.id === udaId && isAssessmentUdaForClass(uda, activeClassName, registeredClassNames)
  );
}
