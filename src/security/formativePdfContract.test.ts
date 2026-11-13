import { describe, expect, test } from 'bun:test';
const source=(path:string)=>Bun.file(path).text();
describe('S3 protected family PDF boundaries',()=>{
  test('dedicated renderer does not read the dossier or capture a view',async()=>{
    const renderer=await source('src/report/formativePdfRendering.ts');
    expect(renderer).toContain('model: FormativeRestitution, draft: RestitutionDraft');
    expect(renderer).toContain('emitted!==model.rows.length');
    expect(renderer).toContain('pdf.setProperties');
    expect(renderer).toContain('pdf.deletePage(1)');
    expect(renderer).not.toContain('querySelector');
    expect(renderer).not.toContain('studentId');
    expect(renderer).not.toContain('.toCanvas()');
    expect(renderer).toContain('local.origin!==window.location.origin');
  });
  test('save only after confirmation and mount-bound validation, no native fallback',async()=>{
    const view=await source('src/components/FormativeRestitutionView.tsx');
    expect(view).toContain('if(!preview||!validated||pending.current||!mounted.current)return');
    expect(view.indexOf('window.confirm')).toBeLessThan(view.indexOf('await renderFormativePdf'));
    expect(view).toContain('if(!isActive())return;');
    expect(view).toContain('saveWorkPdfOnAndroid(bytes,filename,isActive)');
    expect(view).toContain('Scaricamento avviato');
    expect(view).toContain('mounted.current=false');
    const native=await source('mobile/android-probe/native/RegistroPdfFilesPlugin.java');
    expect(native).toContain('(?:Prospetto_Lavoro|Bilancio_Formativo)_');
    expect(native).toContain('LOCAL_PROVIDERS.contains(uri.getAuthority())');
  });
});
