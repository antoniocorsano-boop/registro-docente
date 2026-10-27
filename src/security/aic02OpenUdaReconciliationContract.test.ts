import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { UdaRecord } from '../types';
import * as udaViewModule from '../components/UdaGanttView';
import { createDurableMutationCoordinator } from '../persistence/durableMutationCoordinator';
import { createUdaSnapshotMutation } from '../persistence/udaSnapshotMutation';

const { reconcileOpenUdaRecord } = udaViewModule;

const viewSource = readFileSync(
  fileURLToPath(new URL('../components/UdaGanttView.tsx', import.meta.url)),
  'utf8'
);

type OpenUdaFieldCandidateBuilder = (
  currentUdas: UdaRecord[],
  openDossier: UdaRecord,
  field: keyof UdaRecord,
  value: unknown
) => UdaRecord[];

const legacyStaleDossierBuilder: OpenUdaFieldCandidateBuilder = (
  currentUdas,
  openDossier,
  field,
  value
) => currentUdas.map(item => (
  item.id === openDossier.id
    ? ({ ...openDossier, [field]: value } as UdaRecord)
    : item
));

function getFieldCandidateBuilder(): OpenUdaFieldCandidateBuilder {
  const productionBuilder = (
    udaViewModule as unknown as { rebaseOpenUdaFieldEdit?: OpenUdaFieldCandidateBuilder }
  ).rebaseOpenUdaFieldEdit;
  const handlerUsesProductionBuilder = viewSource.includes(
    'rebaseOpenUdaFieldEdit(udas, selectedUdaForDetail, field, value)'
  );

  return productionBuilder && handlerUsesProductionBuilder
    ? productionBuilder
    : legacyStaleDossierBuilder;
}

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

  test('preserves an externally adopted lesson across queued dossier edits that started from a stale open dossier', async () => {
    const coordinator = createDurableMutationCoordinator();
    const buildFieldCandidate = getFieldCandidateBuilder();
    const adoptedLesson = {
      id: 'lesson-adopted',
      date: '2026-10-27',
      topic: 'Attività adottata',
      hours: 1
    };
    const staleOpenDossier = uda('uda-1');
    let committed = [staleOpenDossier];

    let releaseFirstPersist = () => undefined;
    const firstPersistGate = new Promise<void>(resolve => {
      releaseFirstPersist = resolve;
    });

    const enqueueSnapshotMutation = (
      mutation: (current: UdaRecord[]) => UdaRecord[],
      persist: () => Promise<void> = async () => undefined
    ) => coordinator.enqueue<UdaRecord[]>({
      getCommitted: () => committed,
      derive: current => mutation(current),
      persist: async () => persist(),
      publish: candidate => {
        committed = candidate;
      }
    });

    const firstCandidate = buildFieldCandidate(
      committed,
      staleOpenDossier,
      'description',
      'Prima modifica locale'
    );
    const firstMutation = createUdaSnapshotMutation(committed, firstCandidate);
    const firstSave = enqueueSnapshotMutation(firstMutation, async () => firstPersistGate);

    const adoption = coordinator.enqueueTask(async () => {
      committed = committed.map(item => item.id === staleOpenDossier.id
        ? { ...item, lessons: [adoptedLesson] }
        : item
      );
    });

    const openAfterFirstEdit: UdaRecord = {
      ...staleOpenDossier,
      description: 'Prima modifica locale'
    };
    const secondCandidate = buildFieldCandidate(
      committed,
      openAfterFirstEdit,
      'competencies',
      'Seconda modifica locale'
    );
    const secondMutation = createUdaSnapshotMutation(committed, secondCandidate);
    const secondSave = enqueueSnapshotMutation(secondMutation);

    releaseFirstPersist();
    await firstSave;
    await adoption;
    await secondSave;

    expect(committed[0]?.lessons?.map(lesson => lesson.id)).toEqual(['lesson-adopted']);

    const stillStaleOpenDossier: UdaRecord = {
      ...openAfterFirstEdit,
      competencies: 'Seconda modifica locale'
    };
    const thirdCandidate = buildFieldCandidate(
      committed,
      stillStaleOpenDossier,
      'authenticTask',
      'Terza modifica locale'
    );
    const thirdMutation = createUdaSnapshotMutation(committed, thirdCandidate);
    await enqueueSnapshotMutation(thirdMutation);

    expect(committed[0]?.lessons?.map(lesson => lesson.id)).toEqual(['lesson-adopted']);
    expect(committed[0]?.description).toBe('Prima modifica locale');
    expect(committed[0]?.competencies).toBe('Seconda modifica locale');
    expect(committed[0]?.authenticTask).toBe('Terza modifica locale');
  });
});