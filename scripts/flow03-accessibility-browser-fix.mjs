import fs from 'node:fs';

function patch(path, replacements) {
  let source = fs.readFileSync(path, 'utf8');
  for (const [label, needle, replacement] of replacements) {
    const first = source.indexOf(needle);
    if (first < 0) throw new Error(`PATCH_MARKER_MISSING:${path}:${label}`);
    const second = source.indexOf(needle, first + needle.length);
    if (second >= 0) throw new Error(`PATCH_MARKER_AMBIGUOUS:${path}:${label}`);
    source = source.slice(0, first) + replacement + source.slice(first + needle.length);
  }
  fs.writeFileSync(path, source);
}

patch('src/components/EvaluationsView.tsx', [[
  'evaluation-uda-aria',
  `            <select\n              value={udaId}\n              onChange={e => setUdaId(e.target.value)}`,
  `            <select\n              aria-label="Collega a UDA Curricolare"\n              value={udaId}\n              onChange={e => setUdaId(e.target.value)}`
]]);

patch('src/components/VerificheOnlineView.tsx', [[
  'online-class-aria',
  `                <select\n                  value={selectedClass}\n                  onChange={e => setSelectedClass(e.target.value)}`,
  `                <select\n                  aria-label="Classe Destinataria"\n                  value={selectedClass}\n                  onChange={e => setSelectedClass(e.target.value)}`
]]);

patch('tests/browser/flow-03-registra.spec.cjs', [[
  'record-close-accessible-name',
  `  for (const label of ['Chiudi', 'Valutazione', 'Comportamento', 'Esiti verifica online', 'Attività / nota UDA']) {`,
  `  for (const label of ['Chiudi Registra', 'Valutazione', 'Comportamento', 'Esiti verifica online', 'Attività / nota UDA']) {`
]]);

const evaluation = fs.readFileSync('src/components/EvaluationsView.tsx', 'utf8');
const online = fs.readFileSync('src/components/VerificheOnlineView.tsx', 'utf8');
const browser = fs.readFileSync('tests/browser/flow-03-registra.spec.cjs', 'utf8');
if (!evaluation.includes('aria-label="Collega a UDA Curricolare"')) throw new Error('EVALUATION_ARIA_MISSING');
if (!online.includes('aria-label="Classe Destinataria"')) throw new Error('ONLINE_ARIA_MISSING');
if (!browser.includes("['Chiudi Registra', 'Valutazione'")) throw new Error('BROWSER_CLOSE_NAME_MISSING');
console.log('FLOW-03 accessibility/browser fix applied');
