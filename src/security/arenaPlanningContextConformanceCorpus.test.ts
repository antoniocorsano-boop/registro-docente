import { describe, expect, test } from 'bun:test';

const profile = {
  id: 'profile-tech-grade1',
  schoolYear: '2026/27',
  schoolOrder: 'lower_secondary' as const,
  gradeLevel: 1,
  cohortRef: '2026-2027:secondaria:classe-i',
  subjectCode: 'tecnologia',
  normativeRegime: 'Regime 2025',
  normativeReference: {
    id: 'norm-tech',
    sourceRef: 'DPR_89_2009_ART5_TABLE_3',
    version: 'DPR-89-2009',
    nationalHoursDefined: true,
    nationalWeeklyHours: 2,
    nationalAnnualHours: 66,
    allocationScope: 'discipline' as const
  },
  reservePercent: 15,
  assessmentPeriods: [],
  calendar: {
    startDate: '2026-09-14',
    endDate: '2027-06-08',
    closureDates: [],
    weeklySlots: [{ id: 'slot-1', weekday: 1 as const, hours: 2 }]
  }
};

type Mutation = {
  op: 'set' | 'delete';
  path: string[];
  value?: unknown;
};

type Corpus = {
  contract: string;
  corpusVersion: number;
  base: Record<string, unknown>;
  cases: Array<{ id: string; mutations: Mutation[] }>;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

function applyMutation(target: Record<string, any>, mutation: Mutation): void {
  let cursor: any = target;
  for (let index = 0; index < mutation.path.length - 1; index += 1) {
    cursor = cursor[mutation.path[index]];
  }
  const key = mutation.path[mutation.path.length - 1];
  if (mutation.op === 'set') cursor[key] = mutation.value;
  else delete cursor[key];
}

function materializeCase(base: Record<string, unknown>, mutations: Mutation[]): Record<string, unknown> {
  const candidate = clone(base);
  mutations.forEach(mutation => applyMutation(candidate, mutation));
  return candidate;
}

async function loadCorpus(): Promise<Corpus> {
  const url = new URL('../../docs/contracts/fixtures/arena-registro-planning-context-v1-negative-corpus.json', import.meta.url);
  expect(await Bun.file(url).exists()).toBe(true);
  return Bun.file(url).json();
}

async function loadConsumer() {
  const modulePath = '../planning/' + 'arenaPlanningContext';
  return import(modulePath);
}

describe('EDU-PLAN-01B cross-repo contract conformance corpus', () => {
  test('accepts the shared valid base and rejects every mirrored negative case', async () => {
    const corpus = await loadCorpus();
    const { previewArenaPlanningContext } = await loadConsumer();

    expect(corpus.contract).toBe('ARENA_REGISTRO_PLANNING_CONTEXT_V1');
    expect(corpus.corpusVersion).toBe(1);
    expect(previewArenaPlanningContext(corpus.base, profile).ok).toBe(true);

    const acceptedNegativeCases: string[] = [];
    for (const testCase of corpus.cases) {
      const candidate = materializeCase(corpus.base, testCase.mutations);
      if (previewArenaPlanningContext(candidate, profile).ok) acceptedNegativeCases.push(testCase.id);
    }

    expect(acceptedNegativeCases).toEqual([]);
  });
});
