import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { UdaRecord } from '../types';
import { reconcileOpenUdaRecord } from '../components/UdaGanttView';

const viewSource = readFileSync(
  fileURLToPath(new URL('../components/UdaGanttView.tsx', import.meta.url)),
  'utf8'
);

function uda(id: string, lessons: Array<{ id: string; topic: string }> = []): UdaRecord {
  return {
    id,
    title: `UDA ${id}`,
    className: '3ª A',
    hours: 10,
    period: 'Q1',
    startMonth: 1,
    durationMonths: 2,
    description: 'Fixture sintetico AIC-02',
    lessons: lessons.map(lesson => ({
      id: lesson.id,
      date: '2026-10-27',
      topic: lesson.topic,
      hours: 1
    }))
  };
}

describe('AIC-02 open UDA dossier reconciliation', () => {
  test('rebases an open dossier onto the latest committed UDA after an external compound adoption', () => {
    const staleOpenDossier = uda('uda-1');
    const committedAfterAdoption = uda('uda-1', [{ id: 'lesson-adopted', topic: 'Attività adottata' }]);

    const reconciled = reconcileOpenUdaRecord(staleOpenDossier, [committedAfterAdoption]);

    expect(reconciled).toBe(committedAfterAdoption);
    expect(reconciled?.lessons?.map(lesson => lesson.id)).toEqual(['lesson-adopted']);
  });

  test('closes a dossier whose UDA disappeared from committed state', () => {
    expect(reconcileOpenUdaRecord(uda('removed'), [])).toBeNull();
  });

  test('wires committed UDA changes into open dossier state without overwriting an in-flight local UDA mutation', () => {
    expect(viewSource).toContain("import React, { useEffect, useRef, useState } from 'react';");
    expect(viewSource).toContain('udaTextMutationDepthRef.current > 0 || udaActionMutationDepthRef.current > 0');
    expect(viewSource).toContain('setSelectedUdaForDetail(current => reconcileOpenUdaRecord(current, udas));');
  });
});
