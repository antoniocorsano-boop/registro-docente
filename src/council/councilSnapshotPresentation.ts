import { formatCouncilDate } from './councilModel';

/** Render the originally captured local civil time, never the viewer's current timezone. */
export function formatCouncilSnapshotCaptureTime(
  capturedAt: string,
  captureLocalDate: string,
  captureUtcOffsetMinutes: number
): string {
  const millis = Date.parse(capturedAt);
  if (!Number.isFinite(millis) || !Number.isInteger(captureUtcOffsetMinutes)
    || Math.abs(captureUtcOffsetMinutes) > 840) return 'Data di acquisizione non disponibile';
  // Date.getTimezoneOffset(): positive west of UTC, negative east.
  const local = new Date(millis - captureUtcOffsetMinutes * 60_000);
  if (!Number.isFinite(local.getTime())
    || local.toISOString().slice(0, 10) !== captureLocalDate) {
    return 'Data di acquisizione non disponibile';
  }
  const hh = String(local.getUTCHours()).padStart(2, '0');
  const mm = String(local.getUTCMinutes()).padStart(2, '0');
  return `${formatCouncilDate(captureLocalDate)}, alle ${hh}:${mm}`;
}
