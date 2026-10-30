import { describe, expect, test } from 'bun:test';
import {
  resolveLaunchTeachingContextFromCatalog,
  type LibraryCopilotLaunchRequest
} from '../library/copilotLaunchContext';
import type { TeachingUdaCandidate } from '../teaching/teachingUdaCatalog';

const projectedUda: TeachingUdaCandidate = {
  id: 'docente-os:section-1a:plan-generation-1:1-01',
  origin: 'docente-os',
  classId: 'class-1a',
  classLabel: '1A',
  className: '1A',
  title: 'Tecnologia, bisogni, risorse e sistemi',
  periodLabel: 'Settembre/Ottobre',
  period: 'Settembre/Ottobre',
  plannedHours: 8,
  sourceRef: '1-01',
  writableByRegistro: false,
  lessons: []
};

function launch(mission = false): LibraryCopilotLaunchRequest {
  return {
    nonce: 1,
    context: {
      surface: 'library',
      sourceId: 'source-1',
      className: '1A',
      udaId: projectedUda.id
    },
    ...(mission ? { mission: { missionId: 'mission-1', objective: 'Prepara attività' } } : {})
  };
}

describe('A4-R2B projected Library-to-Copilot launch authority', () => {
  test('a non-mission launch resolves projected UDA from the unified catalog as read-only context', () => {
    expect(resolveLaunchTeachingContextFromCatalog(launch(false), [projectedUda])).toEqual({
      udaId: projectedUda.id,
      className: '1A',
      period: 'Settembre/Ottobre',
      udaOrigin: 'docente-os',
      writableByRegistro: false
    });
  });

  test('composer keeps governed mission launch on the local-only resolver', async () => {
    const source = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
    expect(source).toContain('launchRequest?.mission');
    expect(source).toContain('resolveLaunchTeachingContext(launchRequest, udas)');
    expect(source).toContain('resolveLaunchTeachingContextFromCatalog(launchRequest, teachingUdaCatalog)');
  });

  test('automatic Copilot suggestions use only local UDA that survived the fail-closed unified catalog', async () => {
    const source = await Bun.file(new URL('../components/LibraryCopilotComposer.tsx', import.meta.url)).text();
    expect(source).toContain("candidate.origin === 'registro' && candidate.localUda");
    expect(source).toContain('udas: selectableLocalUdas');
    expect(source).not.toContain("suggestLibraryTeachingContext({\n      udas,\n      currentClassName: effectiveClassName");
  });
});