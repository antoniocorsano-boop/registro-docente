/**
 * VAL-01/D1a.1 — isolated local assessment evidence contract.
 * No application integration, persistence, network, AI, grades or authority import.
 * Validate JSON-shaped data; never derive a pedagogical result or mutate inputs.
 */
export type LearningKind = 'competence' | 'general-objective' | 'specific-objective' |
  'knowledge' | 'skill' | 'attainment-target' | 'foundational-core' | 'key-competence' | 'requirement';
export type EvidenceKind = 'process' | 'product' | 'performance' | 'argumentation';
export type AssessmentPurpose = 'diagnostic' | 'formative' | 'summative';
export type AssessmentStatus = 'planned' | 'completed' | 'cancelled';
export type SupportMode = 'visual' | 'oral' | 'manipulative' | 'written' | 'extended-time';
export interface AssessmentScopeV1 {
  readonly classId: string;
  readonly schoolYear: string;
  readonly subjectCode: string;
  readonly studentIds: readonly string[];
}
interface Confirmation {
  readonly revisionId: string;
  readonly supersedesRevisionId?: string;
  readonly confirmedByTeacher: true;
  readonly confirmedAt: string;
}
interface LocalSource { readonly kind: 'local'; readonly sourceVersion: string }
export interface LearningReferenceRevision extends Confirmation {
  readonly referenceId: string;
  readonly kind: LearningKind;
  readonly text: string;
  readonly source: LocalSource;
}
export interface CriterionRevision extends Confirmation {
  readonly criterionId: string;
  readonly description: string;
  readonly targetReferenceRevisionIds: readonly string[];
  readonly contextualReferenceRevisionIds: readonly string[];
}
interface RubricCriterion {
  readonly criterionRevisionId: string;
  readonly levels: readonly { readonly levelId: string; readonly label: string; readonly description: string }[];
}
export interface RubricRevision extends Confirmation {
  readonly rubricId: string;
  readonly source: LocalSource;
  readonly criteria: readonly RubricCriterion[];
}
interface ExpectedEvidence {
  readonly kind: EvidenceKind;
  readonly description: string;
  readonly method: string;
}
interface AssessmentCriterion {
  readonly criterionRevisionId: string;
  readonly rubricRevisionId?: string;
  readonly expected: ExpectedEvidence;
}
export interface AssessmentDefinitionRevision extends Confirmation {
  readonly assessmentId: string;
  readonly date: string;
  readonly period: 'Q1' | 'Q2';
  readonly title: string;
  readonly purpose: AssessmentPurpose;
  readonly status: AssessmentStatus;
  readonly completedOn?: string;
  readonly source: { readonly kind: 'explicit-activity'; readonly activityId: string };
  readonly criteria: readonly AssessmentCriterion[];
}
interface ObservedFact extends ExpectedEvidence {
  readonly phase?: string;
  readonly productRef?: string;
  readonly support?: SupportMode;
}
type Interpretation =
  | { readonly kind: 'pending' }
  | { readonly kind: 'level'; readonly levelId: string }
  | { readonly kind: 'description'; readonly description: string };
interface EvidenceIdentity extends Confirmation {
  readonly evidenceId: string;
  readonly observationEventId: string;
  readonly assessmentRevisionId: string;
  readonly studentId: string;
  readonly criterionRevisionId: string;
  readonly observedOn: string;
  readonly recordedAt: string;
}
export type IndividualEvidenceRevision = EvidenceIdentity & (
  | { readonly state: 'observed'; readonly fact: ObservedFact; readonly interpretation: Interpretation }
  | { readonly state: 'not_observed' | 'not_applicable' }
  | { readonly state: 'withdrawn'; readonly reason: string }
);
export interface AssessmentEvidenceV1 {
  readonly version: 1;
  readonly classId: string;
  readonly schoolYear: string;
  readonly subjectCode: string;
  readonly references: readonly LearningReferenceRevision[];
  readonly criteria: readonly CriterionRevision[];
  readonly rubrics: readonly RubricRevision[];
  readonly assessments: readonly AssessmentDefinitionRevision[];
  readonly evidence: readonly IndividualEvidenceRevision[];
}
export type AssessmentIssue = 'INVALID_SCOPE' | 'INVALID_DOCUMENT' | 'INVALID_REFERENCE' |
  'INVALID_CRITERION' | 'INVALID_RUBRIC' | 'INVALID_ASSESSMENT' | 'INVALID_EVIDENCE' |
  'INVALID_REVISION_CHAIN' | 'DUPLICATE_ID' | 'INVALID_LINK';
export type AssessmentValidation = { readonly valid: true; readonly issues: readonly [] } |
  { readonly valid: false; readonly issues: readonly AssessmentIssue[] };

type Row = Record<string, unknown>;
const kinds = ['competence','general-objective','specific-objective','knowledge','skill','attainment-target','foundational-core','key-competence','requirement'] as const;
const targetKinds = ['competence','general-objective','specific-objective'] as const;
const evidenceKinds = ['process','product','performance','argumentation'] as const;
const supports = ['visual','oral','manipulative','written','extended-time'] as const;
const confirmationKeys = ['revisionId','confirmedByTeacher','confirmedAt'];
const confirmationOptional = ['supersedesRevisionId'];

function record(value: unknown): value is Row {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return (proto === Object.prototype || proto === null) &&
    Reflect.ownKeys(value).every(k => typeof k === 'string' &&
      Object.prototype.propertyIsEnumerable.call(value,k) &&
      'value' in Object.getOwnPropertyDescriptor(value,k)!);
}
function has(o: Row, key: string): boolean { return Object.prototype.hasOwnProperty.call(o,key); }
function exact(value: unknown, required: readonly string[], optional: readonly string[] = []): value is Row {
  return record(value) && required.every(k => has(value,k)) &&
    Object.keys(value).every(k => required.includes(k) || optional.includes(k)) &&
    optional.every(k => !has(value,k) || value[k] !== undefined);
}
function id(x: unknown): x is string {
  return typeof x === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(x);
}
function prose(x: unknown): x is string {
  return typeof x === 'string' && x.length <= 2000 && x.trim().length > 0;
}
function oneOf<T extends string>(x: unknown, values: readonly T[]): x is T {
  return typeof x === 'string' && (values as readonly string[]).includes(x);
}
function array(x: unknown): x is unknown[] {
  return Array.isArray(x) && Reflect.ownKeys(x).length === x.length + 1 &&
    Array.from({length:x.length},(_,i)=>i).every(i => {
      const d = Object.getOwnPropertyDescriptor(x,String(i));
      return !!d && 'value' in d && d.enumerable;
    });
}
function ids(x: unknown, nonempty = false): x is string[] {
  return array(x) && (!nonempty || x.length > 0) && x.every(id) && new Set(x).size === x.length;
}
function day(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
  const t = Date.parse(x+'T00:00:00.000Z');
  return Number.isFinite(t) && new Date(t).toISOString().slice(0,10) === x;
}
function instant(x: unknown): x is string {
  if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)) return false;
  const t = Date.parse(x);
  return Number.isFinite(t) && new Date(t).toISOString() === x;
}
function schoolYear(x: unknown): x is string {
  return typeof x === 'string' && /^\d{4}\/\d{4}$/.test(x) &&
    Number(x.slice(5)) === Number(x.slice(0,4)) + 1;
}
function inYear(date: string, year: string): boolean {
  // Exact institutional calendar is outside D1a.1; do not invent term boundaries.
  return date.slice(0,4) === year.slice(0,4) || date.slice(0,4) === year.slice(5);
}
function confirmed(o: Row): boolean {
  return id(o.revisionId) && o.confirmedByTeacher === true && instant(o.confirmedAt) &&
    (!has(o,'supersedesRevisionId') || id(o.supersedesRevisionId));
}
function revision(value: unknown, keys: string[], optional: string[] = []): value is Row {
  return exact(value,[...confirmationKeys,...keys],[...confirmationOptional,...optional]) && confirmed(value);
}
function local(x: unknown): boolean {
  return exact(x,['kind','sourceVersion']) && x.kind === 'local' && id(x.sourceVersion);
}
function expected(x: unknown): x is Row {
  return exact(x,['kind','description','method']) && oneOf(x.kind,evidenceKinds) && prose(x.description) && prose(x.method);
}
function fact(x: unknown): x is Row {
  return exact(x,['kind','description','method'],['phase','productRef','support']) &&
    oneOf(x.kind,evidenceKinds) && prose(x.description) && prose(x.method) &&
    (!has(x,'phase') || prose(x.phase)) && (!has(x,'productRef') || id(x.productRef)) &&
    (!has(x,'support') || oneOf(x.support,supports));
}
function unique<T>(values: readonly T[], key: (v:T)=>string): boolean {
  return new Set(values.map(key)).size === values.length;
}
const str = (x: unknown) => x as string;
const rows = (x: unknown) => x as Row[];

function validScope(x: unknown): x is Row {
  return exact(x,['classId','schoolYear','subjectCode','studentIds']) &&
    id(x.classId) && schoolYear(x.schoolYear) && id(x.subjectCode) && ids(x.studentIds);
}
function validReference(x: unknown): x is Row {
  return revision(x,['referenceId','kind','text','source']) && id(x.referenceId) &&
    oneOf(x.kind,kinds) && prose(x.text) && local(x.source);
}
function validCriterion(x: unknown): x is Row {
  return revision(x,['criterionId','description','targetReferenceRevisionIds','contextualReferenceRevisionIds']) &&
    id(x.criterionId) && prose(x.description) && ids(x.targetReferenceRevisionIds,true) && ids(x.contextualReferenceRevisionIds);
}
function validRubric(x: unknown): x is Row {
  return revision(x,['rubricId','source','criteria']) && id(x.rubricId) && local(x.source) &&
    array(x.criteria) && x.criteria.length > 0 && x.criteria.every(c =>
      exact(c,['criterionRevisionId','levels']) && id(c.criterionRevisionId) && array(c.levels) &&
      c.levels.length > 0 && c.levels.every(l => exact(l,['levelId','label','description']) &&
        id(l.levelId) && prose(l.label) && prose(l.description)) &&
      unique(rows(c.levels),l=>str(l.levelId))) &&
    unique(rows(x.criteria),c=>str(c.criterionRevisionId));
}
function validAssessment(x: unknown): x is Row {
  return revision(x,['assessmentId','date','period','title','purpose','status','source','criteria'],['completedOn']) &&
    id(x.assessmentId) && day(x.date) && oneOf(x.period,['Q1','Q2']) && prose(x.title) &&
    oneOf(x.purpose,['diagnostic','formative','summative']) && oneOf(x.status,['planned','completed','cancelled']) &&
    (x.status === 'completed' ? day(x.completedOn) : !has(x,'completedOn')) &&
    exact(x.source,['kind','activityId']) && x.source.kind === 'explicit-activity' && id(x.source.activityId) &&
    array(x.criteria) && x.criteria.length > 0 && x.criteria.every(c =>
      exact(c,['criterionRevisionId','expected'],['rubricRevisionId']) && id(c.criterionRevisionId) &&
      (!has(c,'rubricRevisionId') || id(c.rubricRevisionId)) && expected(c.expected)) &&
    unique(rows(x.criteria),c=>str(c.criterionRevisionId));
}
function validEvidence(x: unknown): x is Row {
  if (!revision(x,['evidenceId','observationEventId','assessmentRevisionId','studentId','criterionRevisionId','observedOn','recordedAt','state'],['fact','interpretation','reason'])) return false;
  if (![x.evidenceId,x.observationEventId,x.assessmentRevisionId,x.studentId,x.criterionRevisionId].every(id) ||
      !day(x.observedOn) || !instant(x.recordedAt)) return false;
  // Civil observation date has no offset yet; allow the earliest possible UTC instant (UTC+14).
  // Exact local clock and term reconciliation belong to the integration contract.
  if (Date.parse(x.recordedAt) < Date.parse(x.observedOn+'T00:00:00.000Z') - 14*3600000 ||
      Date.parse(str(x.confirmedAt)) < Date.parse(x.recordedAt)) return false;
  if (x.state === 'observed') {
    if (!fact(x.fact) || !record(x.interpretation) || has(x,'reason')) return false;
    const i = x.interpretation;
    return (i.kind === 'pending' && exact(i,['kind'])) ||
      (i.kind === 'level' && exact(i,['kind','levelId']) && id(i.levelId)) ||
      (i.kind === 'description' && exact(i,['kind','description']) && prose(i.description));
  }
  if (x.state === 'not_observed' || x.state === 'not_applicable') {
    return !has(x,'fact') && !has(x,'interpretation') && !has(x,'reason');
  }
  return x.state === 'withdrawn' && has(x,'supersedesRevisionId') && prose(x.reason) &&
    !has(x,'fact') && !has(x,'interpretation');
}
function index(list: Row[]): Map<string,Row> {
  return new Map(list.map(x=>[str(x.revisionId),x]));
}
function chains(list: Row[], logicalKey: string, stable: (a:Row,b:Row)=>boolean): boolean {
  const byRev = index(list);
  const roots = new Map<string,number>();
  const children = new Set<string>();
  for (const x of list) {
    const logical = str(x[logicalKey]);
    if (!has(x,'supersedesRevisionId')) {
      roots.set(logical,(roots.get(logical) ?? 0)+1);
      continue;
    }
    const prevId = str(x.supersedesRevisionId);
    const prev = byRev.get(prevId);
    if (!prev || prevId === x.revisionId || children.has(prevId) || prev[logicalKey] !== logical ||
        str(prev.confirmedAt) > str(x.confirmedAt) || !stable(prev,x)) return false;
    children.add(prevId);
  }
  // One root per logical identity and all rows reachable from roots, independent of array order.
  const next = new Map(list.filter(x=>has(x,'supersedesRevisionId')).map(x=>[str(x.supersedesRevisionId),x]));
  const reached = new Set<string>();
  for (const root of list.filter(x=>!has(x,'supersedesRevisionId'))) {
    if (roots.get(str(root[logicalKey])) !== 1) return false;
    let cursor: Row | undefined = root;
    while (cursor) {
      const key = str(cursor.revisionId);
      if (reached.has(key)) return false;
      reached.add(key); cursor = next.get(key);
    }
  }
  return reached.size === list.length;
}
const reject = (issue: AssessmentIssue): AssessmentValidation => ({valid:false,issues:[issue]});

/** Structural validation only. Failure contains a stable non-personal code, never source values. */
export function validateAssessmentEvidenceV1(value: unknown, scope: unknown): AssessmentValidation {
  try {
    if (!validScope(scope)) return reject('INVALID_SCOPE');
    if (!exact(value,['version','classId','schoolYear','subjectCode','references','criteria','rubrics','assessments','evidence']) ||
        value.version !== 1 || value.classId !== scope.classId || value.schoolYear !== scope.schoolYear ||
        value.subjectCode !== scope.subjectCode) return reject('INVALID_DOCUMENT');
    if (!array(value.references) || !value.references.every(validReference)) return reject('INVALID_REFERENCE');
    if (!array(value.criteria) || !value.criteria.every(validCriterion)) return reject('INVALID_CRITERION');
    if (!array(value.rubrics) || !value.rubrics.every(validRubric)) return reject('INVALID_RUBRIC');
    if (!array(value.assessments) || !value.assessments.every(validAssessment)) return reject('INVALID_ASSESSMENT');
    if (!array(value.evidence) || !value.evidence.every(validEvidence)) return reject('INVALID_EVIDENCE');
    const refs = rows(value.references), criteria = rows(value.criteria), rubrics = rows(value.rubrics);
    const assessments = rows(value.assessments), evidence = rows(value.evidence);
    if (!unique([...refs,...criteria,...rubrics,...assessments,...evidence],x=>str(x.revisionId))) return reject('DUPLICATE_ID');
    if (!chains(refs,'referenceId',(a,b)=>a.kind === b.kind) ||
        !chains(criteria,'criterionId',()=>true) ||
        !chains(rubrics,'rubricId',()=>true) ||
        !chains(assessments,'assessmentId',(a,b)=>(a.source as Row).activityId === (b.source as Row).activityId) ||
        !chains(evidence,'evidenceId',(a,b)=>a.observationEventId === b.observationEventId &&
          a.assessmentRevisionId === b.assessmentRevisionId && a.studentId === b.studentId &&
          a.criterionRevisionId === b.criterionRevisionId && a.observedOn === b.observedOn &&
          str(a.recordedAt) <= str(b.recordedAt) && a.state !== 'withdrawn')) return reject('INVALID_REVISION_CHAIN');

    const refIndex = index(refs), criterionIndex = index(criteria), rubricIndex = index(rubrics), assessmentIndex = index(assessments);
    for (const c of criteria) {
      const targets = c.targetReferenceRevisionIds as string[], contextual = c.contextualReferenceRevisionIds as string[];
      const resolved = [...targets,...contextual].map(k=>refIndex.get(k));
      if (resolved.some(x=>!x) || !unique(resolved as Row[],x=>str(x.referenceId)) ||
          targets.some(k=>!oneOf(refIndex.get(k)?.kind,targetKinds))) return reject('INVALID_LINK');
    }
    for (const r of rubrics) {
      const resolved = rows(r.criteria).map(c=>criterionIndex.get(str(c.criterionRevisionId)));
      if (resolved.some(x=>!x) || !unique(resolved as Row[],x=>str(x.criterionId))) return reject('INVALID_LINK');
    }
    const activities = new Map<string,string>();
    const year = str(scope.schoolYear);
    for (const a of assessments) {
      const activity = str((a.source as Row).activityId), logical = str(a.assessmentId);
      if (activities.has(activity) && activities.get(activity) !== logical) return reject('DUPLICATE_ID');
      activities.set(activity,logical);
      if (!inYear(str(a.date),year) || (has(a,'completedOn') && !inYear(str(a.completedOn),year))) return reject('INVALID_ASSESSMENT');
      const bindings = rows(a.criteria);
      const resolved = bindings.map(c=>criterionIndex.get(str(c.criterionRevisionId)));
      if (resolved.some(x=>!x) || !unique(resolved as Row[],x=>str(x.criterionId))) return reject('INVALID_LINK');
      for (const b of bindings) {
        if (has(b,'rubricRevisionId')) {
          const r = rubricIndex.get(str(b.rubricRevisionId));
          if (!r || !rows(r.criteria).some(c=>c.criterionRevisionId === b.criterionRevisionId)) return reject('INVALID_LINK');
        }
      }
    }
    const identities = new Map<string,string>();
    const roster = new Set(scope.studentIds as string[]);
    for (const e of evidence) {
      const a = assessmentIndex.get(str(e.assessmentRevisionId)), c = criterionIndex.get(str(e.criterionRevisionId));
      if (!a || !c || a.status !== 'completed' || !roster.has(str(e.studentId)) || !inYear(str(e.observedOn),year)) return reject('INVALID_LINK');
      const binding = rows(a.criteria).find(b=>b.criterionRevisionId === e.criterionRevisionId);
      if (!binding) return reject('INVALID_LINK');
      const identity = JSON.stringify([a.assessmentId,c.criterionId,e.studentId,e.observationEventId]);
      if (identities.has(identity) && identities.get(identity) !== e.evidenceId) return reject('DUPLICATE_ID');
      identities.set(identity,str(e.evidenceId));
      if (e.state !== 'observed') continue;
      const i = e.interpretation as Row;
      if (i.kind === 'level') {
        const rubric = rubricIndex.get(str(binding.rubricRevisionId));
        const entry = rubric && rows(rubric.criteria).find(b=>b.criterionRevisionId === e.criterionRevisionId);
        if (!entry || !rows(entry.levels).some(l=>l.levelId === i.levelId)) return reject('INVALID_LINK');
      } else if (i.kind === 'description' && has(binding,'rubricRevisionId')) {
        return reject('INVALID_LINK');
      }
    }
    return {valid:true,issues:[]};
  } catch {
    // Malformed/non-JSON objects must never bypass validation or leak input in an exception.
    return reject('INVALID_DOCUMENT');
  }
}
