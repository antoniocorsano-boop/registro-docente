import type { ClassData } from '../types';
import type { LibraryStateV1 } from './types';
import {
  isAssessmentGenerationRequestCurrent,
  type AssessmentGenerationSessionV1
} from './assessmentGeneration';
import {
  parseAssessmentDraftV1,
  toAssessmentEditorPrefill,
  type AssessmentEditorPrefill
} from './assessmentDraft';

/**
 * INT-02/S3c-01 — local transient transfer only.
 *
 * Do not persist this object in Vault, history, URL or any UDA/test record.
 * The sourceId and classId are only local routing references. An editor user
 * must explicitly save a new test via the existing canonical commit boundary.
 */
export interface AssessmentEditorTransferV1 {
  schemaVersion: 1;
  kind: 'copilot-assessment-prefill';
  classId: string;
  className: string;
  sourceId: string;
  prefill: AssessmentEditorPrefill;
}

export interface AssessmentEditorTransferInput {
  session: AssessmentGenerationSessionV1;
  draft: unknown;
  library: LibraryStateV1;
  classes: ClassData[];
  activeClassId: string | null;
  teacherConfirmedAdoption: boolean;
}

export type AssessmentEditorTransferResult =
  | { status: 'ready'; transfer: AssessmentEditorTransferV1 }
  | { status: 'blocked'; reason: 'CONFIRMATION_REQUIRED' | 'CLASS_CHANGED' | 'SOURCE_CHANGED' | 'DRAFT_INVALID' };

export function canAcceptAssessmentEditorTransfer(input: {
  hasUnsavedChanges: boolean;
  isSaving: boolean;
}): boolean {
  return input.hasUnsavedChanges === false && input.isSaving === false;
}

/** Construct detached editor fields only after an explicit teacher decision. */
export function prepareAssessmentEditorTransfer(input: AssessmentEditorTransferInput): AssessmentEditorTransferResult {
  if (!input.teacherConfirmedAdoption) {
    return {status:'blocked',reason:'CONFIRMATION_REQUIRED'};
  }
  const {session,library,classes,activeClassId} = input;
  if (!activeClassId || !session.authorizedClassName || !session.request) {
    return {status:'blocked',reason:'CLASS_CHANGED'};
  }
  // A current class is authoritative only when both its ID and name are
  // uniquely bound. Do not match by "first class with this name".
  const byId = classes.filter(item => item.id === activeClassId);
  const byName = classes.filter(item => item.name === session.authorizedClassName);
  if (byId.length !== 1 || byName.length !== 1
    || byId[0].id !== byName[0].id
    || session.request.context.className !== byId[0].name) {
    return {status:'blocked',reason:'CLASS_CHANGED'};
  }
  const sources = library.sources.filter(source => source.id === session.authorizedSourceId);
  if (sources.length !== 1 || !isAssessmentGenerationRequestCurrent(session,{
    source:sources[0],
    confirmedSourceId:session.authorizedSourceId,
    activeClassName:byId[0].name
  })) {
    return {status:'blocked',reason:'SOURCE_CHANGED'};
  }
  try {
    // Parse twice at this local trust boundary so no provider-supplied ID,
    // UDA, source provenance, grade or saved flag can reach the editor.
    const draft = parseAssessmentDraftV1(input.draft);
    const prefill = toAssessmentEditorPrefill(draft);
    return {
      status:'ready',
      transfer:{
        schemaVersion:1,kind:'copilot-assessment-prefill',
        classId:byId[0].id,className:byId[0].name,
        sourceId:session.authorizedSourceId,prefill
      }
    };
  } catch {
    return {status:'blocked',reason:'DRAFT_INVALID'};
  }
}

/**
 * Re-run the same checks before the editor accepts an asynchronous handoff.
 * A changed source/class (including identical content under a new ID) or
 * mutated proposal invalidates the transfer.
 */
export function checkAssessmentEditorTransferContext(
  transfer: AssessmentEditorTransferV1,
  input: AssessmentEditorTransferInput
): boolean {
  if (!transfer || transfer.schemaVersion !== 1
    || transfer.kind !== 'copilot-assessment-prefill') return false;
  const current = prepareAssessmentEditorTransfer(input);
  if (current.status !== 'ready') return false;
  return transfer.classId === current.transfer.classId
    && transfer.className === current.transfer.className
    && transfer.sourceId === current.transfer.sourceId
    && JSON.stringify(transfer.prefill) === JSON.stringify(current.transfer.prefill);
}
