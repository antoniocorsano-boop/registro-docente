export interface PlanningDraftGuard {
  hasUnsavedChanges: () => boolean;
  saveChanges: () => Promise<boolean>;
}
