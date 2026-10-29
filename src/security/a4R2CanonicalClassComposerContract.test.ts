import { describe, expect, test } from 'bun:test';

const COMPOSER = new URL('../components/LibraryCopilotComposer.tsx', import.meta.url);
const APP = new URL('../App.tsx', import.meta.url);

async function read(url: URL): Promise<string> {
  return Bun.file(url).text();
}

describe('A4-R2A canonical class Composer wiring', () => {
  test('teacher-first class selection is bound to real Registro class ids', async () => {
    const composer = await read(COMPOSER);
    const app = await read(APP);

    expect(composer).toContain("from '../copilot/teacherFirstTeachingCatalog'");
    expect(composer).toContain('classes?: ClassData[]');
    expect(composer).toContain('const [teacherFirstClassId, setTeacherFirstClassId]');
    expect(composer).toContain('buildTeacherFirstTeachingCatalog({');
    expect(composer).toContain('udasForCanonicalClass(teacherFirstCatalog, teacherFirstClassId)');
    expect(composer).not.toContain('const [teacherFirstClassName, setTeacherFirstClassName]');
    expect(composer).not.toContain('...udas.map(uda => uda.className)');
    expect(composer).not.toContain('udas.filter(uda => uda.className === teacherFirstClassName)');
    expect(app).toContain('classes={appData.classes}');
  });

  test('legacy class aliases participate in request interpretation but never become stored class identity', async () => {
    const composer = await read(COMPOSER);

    expect(composer).toContain('...teacherFirstCatalog.classes.flatMap(entry => entry.aliases)');
    expect(composer).toContain('entry.aliases.some(alias => requestedLabels.has(alias))');
    expect(composer).toContain('entry.label === framed.classCandidates[0] || entry.aliases.includes(framed.classCandidates[0])');
    expect(composer).not.toContain('setTeacherFirstClassId(framed.classCandidates[0])');
  });

  test('the canonical repair does not add persistence or provider authority', async () => {
    const composer = await read(COMPOSER);

    expect(composer).not.toContain('saveCanonicalClass');
    expect(composer).not.toContain('mergeClass');
    expect(composer).not.toContain('rewriteUdaClass');
    expect(composer).toContain('interpretCopilotIntent');
    expect(composer).toContain('CopilotMissionBridge');
  });
});
