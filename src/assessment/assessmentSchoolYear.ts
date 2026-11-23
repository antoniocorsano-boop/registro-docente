/** Canonical year for assessment contexts; stored settings and documents are never rewritten. */
import {normalizeSchoolYear} from '../planning/planningFrameResolver';

export function canonicalAssessmentSchoolYear(value:unknown):string|null {
 if(typeof value!=='string')return null;
 const normalized=normalizeSchoolYear(value);
 return normalized ? normalized.replace('-', '/') : null;
}
