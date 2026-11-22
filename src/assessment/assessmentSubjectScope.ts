/** Local assessment subject identity based on an explicitly configured teacher
 * discipline. Machine codes are retained exactly (legacy TECH fixtures); the
 * existing professional display label is resolved through the established
 * curricular mapping, never guessed from a historical assessment document.
 */
import {resolveCurricularSubjectCode} from '../planning/curricularSubjectCode';
const code=(x:string)=>/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
export function resolveAssessmentSubjectCode(display:string|undefined):string|null{
 if(typeof display!=='string'||!display.trim())return null;
 const trimmed=display.trim();
 if(code(trimmed))return trimmed;
 const resolved=resolveCurricularSubjectCode(trimmed);
 return code(resolved)?resolved:null;
}
