import type {ClassData} from '../types';

/**
 * Prevent remote generation when the live class identity is ambiguous.
 *
 * S3c-01 refuses adoption for duplicate names or duplicate IDs. The same
 * requirement must hold before spending budget on an S3b provider call.
 */
export function isAssessmentClassUnambiguous(
  classes: ReadonlyArray<Pick<ClassData,'id'|'name'>>,
  classId: string | null | undefined,
  className: string | null | undefined
): boolean {
  if(!classId || !className?.trim())return false;
  return classes.filter(item=>item.id===classId).length===1
    && classes.filter(item=>item.name===className).length===1
    && classes.some(item=>item.id===classId && item.name===className);
}
