import type { TeachingProposalContent, TeachingProposalV1 } from '../library/teachingProposal';
import type { CopilotPreferenceSignalKind } from './preferenceLearning';

function stringArrayEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function countTeachingProposalEdits(
  proposal: TeachingProposalV1,
  content: TeachingProposalContent
): number {
  let changed = 0;
  if (proposal.title !== content.title) changed += 1;
  if (proposal.objective !== content.objective) changed += 1;
  if (proposal.teacherSetup !== content.teacherSetup) changed += 1;
  if (proposal.studentTask !== content.studentTask) changed += 1;
  if (!stringArrayEqual(proposal.steps, content.steps)) changed += 1;
  if (!stringArrayEqual(proposal.questions, content.questions)) changed += 1;
  if (proposal.adaptationHint !== content.adaptationHint) changed += 1;
  return changed;
}

export function classifyTeachingProposalOutcome(
  proposal: TeachingProposalV1,
  content: TeachingProposalContent
): Extract<CopilotPreferenceSignalKind, 'used-as-is' | 'small-edits' | 'heavy-rework'> {
  const edits = countTeachingProposalEdits(proposal, content);
  if (edits === 0) return 'used-as-is';
  if (edits <= 2) return 'small-edits';
  return 'heavy-rework';
}
