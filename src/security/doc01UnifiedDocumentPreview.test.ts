import {describe,expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';
describe('DOC-01/D1d4b isolated unified preview boundary',()=>{
 test('uses the qualified review and never creates independent confirmation',()=>{
  const ui=readFileSync('src/components/documents/UnifiedDocumentPreview.tsx','utf8');
  expect(ui).toContain('createUnifiedDocumentReview(input)');
  expect(ui).toContain('snapshot.review.confirm(input).valid');
  expect(ui).toContain('disabled={!p.canConfirm}');
 });
 test('no production wiring, persistence, document export or network',()=>{
  for(const path of ['src/App.tsx','src/main.tsx','src/components/documents/DocumentPlanningPreview.tsx','src/components/CouncilView.tsx'])expect(readFileSync(path,'utf8')).not.toContain('UnifiedDocumentPreview');
  const ui=readFileSync('src/components/documents/UnifiedDocumentPreview.tsx','utf8');
  expect(ui).not.toMatch(/localStorage|indexedDB|fetch\(|window\.print|download\s*=|writeFile|SecureStorage/);
 });
});
