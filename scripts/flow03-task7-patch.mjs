import fs from 'node:fs';

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected exactly one match, found ${count}`);
  return text.replace(before, after);
}

// FLOW-03 behaviour: require an explicit teacher choice instead of inferring Ottimale.
const behaviorPath = 'src/components/BehaviorsView.tsx';
let behavior = fs.readFileSync(behaviorPath, 'utf8');
behavior = replaceOnce(
  behavior,
  `  onSaveBehaviors: (records: BehaviorRecord[]) => Promise<void>;\n  isPrivacyShieldActive?: boolean;\n}`,
  `  onSaveBehaviors: (records: BehaviorRecord[]) => Promise<void>;\n  isPrivacyShieldActive?: boolean;\n  requireExplicitSelection?: boolean;\n}`,
  'behaviour prop'
);
behavior = replaceOnce(
  behavior,
  `  onSaveBehaviors,\n  isPrivacyShieldActive = true\n}) => {`,
  `  onSaveBehaviors,\n  isPrivacyShieldActive = true,\n  requireExplicitSelection = false\n}) => {`,
  'behaviour destructure'
);
behavior = replaceOnce(
  behavior,
  `      init[s.id] = match ? match.status : 'Ottimale 🌟';`,
  `      init[s.id] = match ? match.status : requireExplicitSelection ? undefined : 'Ottimale 🌟';`,
  'behaviour no inferred state'
);
behavior = replaceOnce(
  behavior,
  `    const newRecords: BehaviorRecord[] = currentClass.students.map(s => ({\n      id: uid(),\n      studentId: s.id,\n      date: selectedDate,\n      status: statusMap[s.id] || 'Ottimale 🌟'\n    }));`,
  `    const selectedStudents = requireExplicitSelection\n      ? currentClass.students.filter(s => Boolean(statusMap[s.id]))\n      : currentClass.students;\n    if (requireExplicitSelection && selectedStudents.length === 0) {\n      alert('Seleziona almeno uno stato di comportamento prima di salvare.');\n      return;\n    }\n    const newRecords: BehaviorRecord[] = selectedStudents.map(s => ({\n      id: uid(),\n      studentId: s.id,\n      date: selectedDate,\n      status: statusMap[s.id] || 'Ottimale 🌟'\n    }));`,
  'behaviour explicit save'
);
behavior = replaceOnce(
  behavior,
  `            const currentStatus = statusMap[student.id] || 'Ottimale 🌟';`,
  `            const currentStatus = statusMap[student.id];`,
  'behaviour selected visual'
);
fs.writeFileSync(behaviorPath, behavior);

// FLOW-03 online outcomes: preserve the explicit class, with no import on mount.
const onlinePath = 'src/components/VerificheOnlineView.tsx';
let online = fs.readFileSync(onlinePath, 'utf8');
online = replaceOnce(
  online,
  `import React, { useRef, useState } from 'react';`,
  `import React, { useEffect, useRef, useState } from 'react';`,
  'online useEffect import'
);
online = replaceOnce(
  online,
  `  settings?: AppSettings;\n  isPrivacyShieldActive?: boolean;`,
  `  settings?: AppSettings;\n  isPrivacyShieldActive?: boolean;\n  initialClassName?: string;`,
  'online initial class prop'
);
online = replaceOnce(
  online,
  `  settings,\n  isPrivacyShieldActive = true,\n  onSaveNewTest,`,
  `  settings,\n  isPrivacyShieldActive = true,\n  initialClassName,\n  onSaveNewTest,`,
  'online initial class destructure'
);
online = replaceOnce(
  online,
  `  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '3ª A');\n  const [selectedTestId, setSelectedTestId] = useState<string>(Object.keys(tests)[0] || 'energia');`,
  `  const [selectedClass, setSelectedClass] = useState<string>(classes[0]?.name || '3ª A');\n\n  useEffect(() => {\n    if (!initialClassName) return;\n    const safeClass = classes.find(item => item.name === initialClassName);\n    if (safeClass) setSelectedClass(safeClass.name);\n  }, [classes, initialClassName]);\n\n  const [selectedTestId, setSelectedTestId] = useState<string>(Object.keys(tests)[0] || 'energia');`,
  'online explicit class effect'
);
fs.writeFileSync(onlinePath, online);

// App specialist wiring.
const appPath = 'src/App.tsx';
let app = fs.readFileSync(appPath, 'utf8');
app = replaceOnce(
  app,
  `          <BehaviorsView\n            currentClass={currentClass}\n            onSaveBehaviors={handleSaveBehaviors}\n            isPrivacyShieldActive={isPrivacyShieldActive}\n          />`,
  `          <BehaviorsView\n            currentClass={currentClass}\n            onSaveBehaviors={handleSaveBehaviors}\n            isPrivacyShieldActive={isPrivacyShieldActive}\n            requireExplicitSelection={recordSession?.status === 'editing'\n              && recordSession.evidenceKind === 'behaviour'\n              && recordSession.context.classId === currentClass.id}\n          />`,
  'app behaviour explicit mode'
);
app = replaceOnce(
  app,
  `            udas={udas}\n            settings={settings}\n            isPrivacyShieldActive={isPrivacyShieldActive}`,
  `            udas={udas}\n            settings={settings}\n            initialClassName={recordSession?.status === 'editing'\n              && recordSession.evidenceKind === 'online-outcomes'\n              && recordSession.context.classId === currentClass?.id\n              ? recordSession.context.className\n              : undefined}\n            isPrivacyShieldActive={isPrivacyShieldActive}`,
  'app online explicit class'
);
fs.writeFileSync(appPath, app);

// FLOW-02 browser regression now reflects explicit FLOW-03 handoff and staged-note transfer.
const flow02Path = 'tests/browser/flow-02-conduci.spec.cjs';
let flow02 = fs.readFileSync(flow02Path, 'utf8');
flow02 = replaceOnce(
  flow02,
  `  const record = page.getByRole('region', { name: 'Continua: Registra' });`,
  `  const record = page.getByRole('region', { name: \`Registra per \${CLASS_NAME}\` });`,
  'FLOW-02 record region'
);
flow02 = replaceOnce(
  flow02,
  `    await expect(record).not.toContainText(RAPID_NOTE);`,
  `    await expect(record.getByLabel('Nota di sessione', { exact: true })).toHaveValue(RAPID_NOTE);`,
  'FLOW-02 staged note handoff'
);
fs.writeFileSync(flow02Path, flow02);

const flow02ContractPath = 'src/security/flow02BrowserQualificationContract.test.ts';
let flow02Contract = fs.readFileSync(flow02ContractPath, 'utf8');
flow02Contract = replaceOnce(
  flow02Contract,
  `    expect(spec).toContain("getByRole('region', { name: 'Continua: Registra' })");\n    expect(spec).toContain('assertSelectedClassStillVisible');`,
  `    expect(spec).toContain("getByRole('region', { name: \\`Registra per \\${CLASS_NAME}\\` })");\n    expect(spec).toContain("getByLabel('Nota di sessione', { exact: true })");\n    expect(spec).toContain('toHaveValue(RAPID_NOTE)');\n    expect(spec).toContain('assertSelectedClassStillVisible');`,
  'FLOW-02 browser contract'
);
fs.writeFileSync(flow02ContractPath, flow02Contract);

// Strengthen dedicated FLOW-03 online route evidence.
const flow03Path = 'tests/browser/flow-03-registra.spec.cjs';
let flow03 = fs.readFileSync(flow03Path, 'utf8');
flow03 = replaceOnce(
  flow03,
  `  await expect(page.getByRole('button', { name: 'Importa Voti nel Registro', exact: true })).toBeVisible();\n  await assertSelectedClassStillVisible(page);`,
  `  await expect(page.getByRole('button', { name: 'Importa Voti nel Registro', exact: true })).toBeVisible();\n  const classSelect = page.getByLabel('Classe Destinataria', { exact: true });\n  await expect(classSelect).toHaveValue(CLASS_NAME);\n  await assertSelectedClassStillVisible(page);`,
  'FLOW-03 online class evidence'
);
fs.writeFileSync(flow03Path, flow03);

// Browser qualification workflow: install and run dedicated FLOW-03 after FLOW-02.
const workflowPath = '.github/workflows/browser-qualification.yml';
let workflow = fs.readFileSync(workflowPath, 'utf8');
workflow = replaceOnce(
  workflow,
  `          cp tests/browser/flow-02-conduci.spec.cjs .browser-tools/flow-02-conduci.spec.cjs\n          cp tests/browser/browser-qualification.spec.cjs .browser-tools/browser-qualification.spec.cjs`,
  `          cp tests/browser/flow-02-conduci.spec.cjs .browser-tools/flow-02-conduci.spec.cjs\n          cp tests/browser/flow-03-registra.spec.cjs .browser-tools/flow-03-registra.spec.cjs\n          cp tests/browser/browser-qualification.spec.cjs .browser-tools/browser-qualification.spec.cjs`,
  'browser install FLOW-03'
);
workflow = replaceOnce(
  workflow,
  `      - name: Run LSM-01C consumer Chromium qualification`,
  `      - name: Run FLOW-03 Chromium qualification\n        shell: bash\n        run: |\n          set -euo pipefail\n          cd .browser-tools\n          BASE_URL="http://127.0.0.1:\${PORT}" \\\n          EVIDENCE_DIR="../browser-evidence" \\\n          CANDIDATE_SHA="\${CANDIDATE_SHA}" \\\n          ./node_modules/.bin/playwright test \\\n            flow-03-registra.spec.cjs \\\n            --workers=1 \\\n            --reporter=line \\\n            --output=../browser-evidence/flow-03-test-results\n\n      - name: Run LSM-01C consumer Chromium qualification`,
  'browser run FLOW-03'
);
fs.writeFileSync(workflowPath, workflow);

// Canonical qualification invariant.
const registryPath = 'qualification/invariants.v1.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
if (!Array.isArray(registry.invariants)) throw new Error('Invariant registry has no invariants array');
if (registry.invariants.some(entry => entry.id === 'FLOW-03-I01')) throw new Error('FLOW-03-I01 already exists');
const flow03Tests = [
  'src/security/flow03RecordSessionContract.test.ts',
  'src/security/flow03ConductHandoffContract.test.ts',
  'src/security/flow03RecordUiContract.test.ts',
  'src/security/flow03AppIntegrationContract.test.ts',
  'src/security/flow03EvaluationPrefillContract.test.ts',
  'src/security/flow03BehaviourExplicitContract.test.ts',
  'src/security/flow03OnlineOutcomesContextContract.test.ts',
  'src/security/flow03UdaDiaryHandoffContract.test.ts',
  'src/security/flow03BrowserQualificationContract.test.ts',
  'src/security/flow03QualificationContract.test.ts'
];
registry.invariants.push({
  id: 'FLOW-03-I01',
  owner: 'FLOW-03',
  statement: 'Registra is a session-only recording orchestrator: it preserves explicit professional context, carries staged lesson evidence without auto-writing it, delegates all durable writes to authoritative specialist surfaces, preserves drafts on failure, and offers Rivedi only after a matching successful durable mutation.',
  impactPaths: [
    'qualification/invariants.v1.json',
    'src/App.tsx',
    'src/recording/',
    'src/components/RecordLessonPanel.tsx',
    'src/components/ConductLessonPanel.tsx',
    'src/components/DashboardView.tsx',
    'src/components/EvaluationsView.tsx',
    'src/components/BehaviorsView.tsx',
    'src/components/VerificheOnlineView.tsx',
    'src/components/UdaWorkspaceView.tsx',
    'src/components/UdaGanttView.tsx',
    'src/today/todayRouter.ts',
    ...flow03Tests,
    'tests/browser/flow-02-conduci.spec.cjs',
    'tests/browser/flow-03-registra.spec.cjs',
    '.github/workflows/browser-qualification.yml'
  ],
  tests: flow03Tests,
  browserSmoke: [
    'tests/browser/qualification-invariant-smoke.spec.cjs',
    'tests/browser/flow-03-registra.spec.cjs'
  ]
});
fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
