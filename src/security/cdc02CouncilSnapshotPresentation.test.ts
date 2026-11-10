import { describe, expect, test } from 'bun:test';
import { formatCouncilSnapshotCaptureTime } from '../council/councilSnapshotPresentation';

describe('CDC-02/P5-UX — timestamp di cattura presentato in ora locale originale', () => {
  test('Roma in ora solare: 21:09 UTC corrisponde alle 22:09', () => {
    expect(formatCouncilSnapshotCaptureTime(
      '2026-11-09T21:09:11.284Z', '2026-11-09', -60
    )).toBe('9 novembre 2026, alle 22:09');
  });
  test('ora legale: offset originale -120 non viene ricalcolato dal dispositivo attuale', () => {
    expect(formatCouncilSnapshotCaptureTime(
      '2026-07-10T21:09:11.284Z', '2026-07-10', -120
    )).toBe('10 luglio 2026, alle 23:09');
  });
  test('cambio giorno e ora occidentale sono rispettati', () => {
    expect(formatCouncilSnapshotCaptureTime(
      '2026-11-09T23:45:00.000Z', '2026-11-10', -60
    )).toBe('10 novembre 2026, alle 00:45');
    expect(formatCouncilSnapshotCaptureTime(
      '2026-11-10T02:30:00.000Z', '2026-11-09', 300
    )).toBe('9 novembre 2026, alle 21:30');
  });
  test('data/offset incoerenti non producono una falsa ora civile', () => {
    expect(formatCouncilSnapshotCaptureTime(
      '2026-11-09T21:09:11.284Z', '2026-11-10', -60
    )).toBe('Data di acquisizione non disponibile');
    expect(formatCouncilSnapshotCaptureTime('abc', '2026-11-09', -60))
      .toBe('Data di acquisizione non disponibile');
  });
});
