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
 test('reflow gate is tied to nominal width and actual PNG, with scalable text and grouped provenance',()=>{
  const ui=readFileSync('src/components/documents/UnifiedDocumentPreview.tsx','utf8');
  const css=readFileSync('src/components/documents/unifiedDocumentPreview.css','utf8');
  const browser=readFileSync('tests/browser/doc01-d1d4b-unified.spec.cjs','utf8');
  expect(ui.match(/Provenienza delle informazioni/g)?.length).toBe(1);
  expect(css).toContain('overflow-wrap: anywhere');
  expect(css).toContain('min-width: 0');
  expect(css).not.toMatch(/overflow-x:\s*hidden|font-size:\s*\d+px|text-size-adjust|zoom\s*:/);
  expect(browser).toContain('root.scrollWidth>width+1');
  expect(browser).toContain('readUInt32BE(16)');
  expect(browser).toContain('range.getClientRects()');
 });
});
