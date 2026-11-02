import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROUTER_MODULE_URL = new URL('../preparation/preparationRouter.ts', import.meta.url);
const ROUTER_MODULE_PATH = fileURLToPath(ROUTER_MODULE_URL);

const routerExists = () => existsSync(ROUTER_MODULE_PATH);

const loadRouter = async () => {
  if (!routerExists()) return null;
  return import('../preparation/preparationRouter');
};

describe('FLOW-01 preparation routing contract', () => {
  test('materializes one focused preparation routing module', () => {
    expect(routerExists()).toBe(true);
  });

  test('exposes exactly five teacher intentions in stable order', async () => {
    const router = await loadRouter();
    if (!router) return;

    const options = router.getPreparationOptions();
    expect(options.map(option => option.id)).toEqual([
      'curriculum-frame',
      'uda-lesson',
      'material',
      'assessment',
      'copilot'
    ]);
    expect(options.map(option => option.label)).toEqual([
      'Definisci la cornice',
      'Sviluppa UDA o lezione',
      'Trova o usa un materiale',
      'Prepara una verifica',
      'Chiedi supporto'
    ]);
    expect(options.map(option => option.description)).toEqual([
      'Programmazione e riferimenti professionali.',
      'Organizza il percorso e le attività.',
      'Apri la Biblioteca nel contesto della classe.',
      'Costruisci o gestisci una verifica online.',
      'Apri il Copilota con il contesto già noto.'
    ]);
  });

  test('routes only to authoritative preparation surfaces', async () => {
    const router = await loadRouter();
    if (!router) return;

    expect(router.getPreparationOptions().map(option => option.destination)).toEqual([
      { kind: 'tab', tab: 'programmazione' },
      { kind: 'tab', tab: 'uda-gantt' },
      { kind: 'tab', tab: 'biblioteca' },
      { kind: 'tab', tab: 'verifiche-online' },
      { kind: 'copilot', intent: 'prepare' }
    ]);

    const serialized = JSON.stringify(router.getPreparationOptions());
    for (const forbidden of ['voti', 'comportamenti', 'tabellone', 'analytics', 'storico', 'report']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  test('builds a class-only explicit preparation context for Copilota', async () => {
    const router = await loadRouter();
    if (!router) return;

    expect(router.buildPreparationCopilotLaunchContext({ name: ' 2ª C ' })).toEqual({
      surface: 'class-dashboard',
      className: '2ª C',
      intent: 'prepare'
    });
    expect(router.buildPreparationCopilotLaunchContext(null)).toBeNull();
    expect(router.buildPreparationCopilotLaunchContext(undefined)).toBeNull();
    expect(router.buildPreparationCopilotLaunchContext({ name: '   ' })).toBeNull();
  });
});
