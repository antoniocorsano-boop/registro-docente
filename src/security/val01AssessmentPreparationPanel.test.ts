// S5c isolation contract; functional interactions are qualified separately in Chromium.
import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
const read=(p:string)=>readFileSync(p,'utf8');
describe('VAL-01/S5c — isolated preparation boundary',()=>{
  test('uses S5a and S5b without direct persistence or remote calls',()=>{
    const panel=read('src/components/AssessmentPreparationPanel.tsx');
    expect(panel).toContain('listAssessmentPreparationOptions');
    expect(panel).toContain('previewAssessmentDefinition');
    expect(panel).toContain('confirmAssessmentDefinition');
    expect(panel).toContain('Configurazione confermata nella dimostrazione');
    expect(panel).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\s*\(|secureVault|secureAppStorage|axios|navigator\.sendBeacon/);
  });
  test('synthetic demonstration is not wired into production App or main',()=>{
    for(const file of ['src/App.tsx','src/main.tsx']){
      expect(read(file)).not.toContain('AssessmentPreparationPanel');
      expect(read(file)).not.toContain('val01-s5c');
    }
    const fixture=read('tests/browser/fixtures/val01-s5c-fixture.tsx');
    expect(fixture).toContain('Ambiente esclusivamente sintetico');
    expect(fixture).toContain('Simulazione d’esame');
    expect(fixture).not.toMatch(/localStorage|sessionStorage|indexedDB|fetch\s*\(|secureVault|secureAppStorage/);
  });
  test('browser qualification explicitly invokes the new fixture spec',()=>{
    const workflow=read('.github/workflows/beta2-reference-qualification.yml');
    expect(workflow).toContain('cp tests/browser/val01-s5c-preparation.spec.cjs .nav-context-browser-tools/');
    expect(workflow).toMatch(/\n\s+val01-s5c-preparation\.spec\.cjs\s+\\/);
  });
});
