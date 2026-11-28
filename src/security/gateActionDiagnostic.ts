export type GateActionOperation =
  | 'setup-professional' | 'setup-demo' | 'unlock' | 'resume' | 'migrate';

type RejectionCode =
  | 'ARCHIVE_BUSY' | 'AUTHORITY_REVOKED' | 'ARCHIVE_ADMISSION_REJECTED'
  | 'ARCHIVE_INSPECTION_REJECTED' | 'ARCHIVE_INITIALIZATION_REJECTED'
  | 'READY_SNAPSHOT_REJECTED';

const rejectionCodes = new WeakMap<object, RejectionCode>();

export function markGateRejection<T>(error: T, code: RejectionCode): T {
  if (typeof error === 'object' && error !== null && !rejectionCodes.has(error)) {
    rejectionCodes.set(error, code);
  }
  return error;
}

export function gateRejectionCode(error: unknown): RejectionCode | 'ACTION_REJECTED' {
  return (typeof error === 'object' && error !== null ? rejectionCodes.get(error) : undefined)
    ?? 'ACTION_REJECTED';
}
