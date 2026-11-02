import fs from 'node:fs';

const path = 'src/components/VerificheOnlineView.tsx';
let source = fs.readFileSync(path, 'utf8');
const needle = `    const safeClass = classes.find(item => item.name === initialClassName);\n    if (safeClass) setSelectedClass(safeClass.name);`;
const replacement = `    const safeClass = classes.find(item => item.name === initialClassName);\n    if (safeClass) {\n      setSelectedClass(safeClass.name);\n      setActiveSubTab('analisi');\n    }`;
const first = source.indexOf(needle);
if (first < 0) throw new Error('PATCH_MARKER_MISSING:online-outcomes-effect');
if (source.indexOf(needle, first + needle.length) >= 0) throw new Error('PATCH_MARKER_AMBIGUOUS:online-outcomes-effect');
source = source.slice(0, first) + replacement + source.slice(first + needle.length);
fs.writeFileSync(path, source);

const effectStart = source.indexOf('if (!initialClassName) return;');
const effectEnd = source.indexOf('}, [classes, initialClassName]);', effectStart);
if (effectStart < 0 || effectEnd <= effectStart) throw new Error('FLOW03_EFFECT_NOT_FOUND');
const effect = source.slice(effectStart, effectEnd);
if (!effect.includes("setActiveSubTab('analisi');")) throw new Error('ANALYSIS_ROUTE_MISSING');
if (effect.includes('onImportSubmissionsToRegister(') || effect.includes('handleImportSubmissions(')) {
  throw new Error('AUTO_IMPORT_FORBIDDEN');
}
console.log('FLOW-03 online outcomes surface fix applied');
