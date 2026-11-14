import type { ActiveTab } from '../types';

/** Presence, not authorization. Current composer supports professional preparation,
 * source work, UDA and assessment drafting. No generic entry in student-record,
 * consultation-only analysis, administration or security workspaces.
 * Dedicated contextual actions and existing mission guards remain independent.
 */
export function shouldOfferAmbientCopilot(input: {
  tab: ActiveTab;
  hasClass: boolean;
  drawerOpen: boolean;
  assessmentEditorFocused: boolean;
  conductActive: boolean;
  recordingActive: boolean;
}): boolean {
  if (input.drawerOpen || input.assessmentEditorFocused || input.conductActive || input.recordingActive) return false;
  switch (input.tab) {
    case 'home': // intentional professional entry, including resuming existing missions
    case 'biblioteca':
    case 'uda-gantt':
    case 'programmazione':
    case 'verifiche-online':
      return true;
    case 'dashboard':
      return input.hasClass;
    default:
      return false;
  }
}
