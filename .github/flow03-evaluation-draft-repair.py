from pathlib import Path
import json

path = Path('src/components/EvaluationsView.tsx')
text = path.read_text()

old_import = "import React, { useState, useEffect } from 'react';"
new_import = "import React, { useState, useEffect, useRef } from 'react';"
if text.count(old_import) != 1:
    raise SystemExit(f'import anchor cardinality != 1: {text.count(old_import)}')
text = text.replace(old_import, new_import, 1)

old_state = "  const [isSaving, setIsSaving] = useState(false);\n\n  useEffect(() => {"
new_state = "  const [isSaving, setIsSaving] = useState(false);\n  const evaluationInitializationSignatureRef = useRef<string | null>(null);\n\n  useEffect(() => {"
if text.count(old_state) != 1:
    raise SystemExit(f'state anchor cardinality != 1: {text.count(old_state)}')
text = text.replace(old_state, new_state, 1)

old_effect = """  useEffect(() => {
    if (editingBatchId) {
      const existingGrades = (currentClass.grades || []).filter(g => g.batchId === editingBatchId);
      if (existingGrades.length > 0) {
        setPeriod(existingGrades[0].period || 'Q1');
        setType(existingGrades[0].type || 'test');
        setDate(existingGrades[0].date || today());
        setTitle(existingGrades[0].title || '');
        setUdaId(existingGrades[0].udaId || '');

        const newMap: Record<string, { value: string; delayed: boolean }> = {};
        existingGrades.forEach(g => {
          newMap[g.studentId] = {
            value: g.value,
            delayed: !!g.delayed
          };
        });
        setGradesMap(newMap);
      }
    } else {
      const safeInitialUdaId = udas.some(u => u.id === initialUdaId && u.className === currentClass.name) ? initialUdaId || '' : '';
      setTitle('');
      setDate(isIsoDate(initialDate) ? initialDate! : today());
      setUdaId(safeInitialUdaId);
      setGradesMap({});
    }
  }, [editingBatchId, currentClass, udas, initialUdaId, initialDate]);"""

new_effect = """  useEffect(() => {
    const safeInitialUdaId = udas.some(u => u.id === initialUdaId && u.className === currentClass.name) ? initialUdaId || '' : '';
    const signature = JSON.stringify([
      currentClass.id,
      editingBatchId,
      editingBatchId ? null : safeInitialUdaId,
      editingBatchId ? null : (isIsoDate(initialDate) ? initialDate : null)
    ]);
    if (evaluationInitializationSignatureRef.current === signature) return;
    evaluationInitializationSignatureRef.current = signature;

    if (editingBatchId) {
      const existingGrades = (currentClass.grades || []).filter(g => g.batchId === editingBatchId);
      if (existingGrades.length > 0) {
        setPeriod(existingGrades[0].period || 'Q1');
        setType(existingGrades[0].type || 'test');
        setDate(existingGrades[0].date || today());
        setTitle(existingGrades[0].title || '');
        setUdaId(existingGrades[0].udaId || '');

        const newMap: Record<string, { value: string; delayed: boolean }> = {};
        existingGrades.forEach(g => {
          newMap[g.studentId] = {
            value: g.value,
            delayed: !!g.delayed
          };
        });
        setGradesMap(newMap);
      }
    } else {
      setTitle('');
      setDate(isIsoDate(initialDate) ? initialDate! : today());
      setUdaId(safeInitialUdaId);
      setGradesMap({});
    }
  }, [editingBatchId, currentClass, udas, initialUdaId, initialDate]);"""

if text.count(old_effect) != 1:
    raise SystemExit(f'effect anchor cardinality != 1: {text.count(old_effect)}')
path.write_text(text.replace(old_effect, new_effect, 1))

registry_path = Path('qualification/invariants.v1.json')
registry = json.loads(registry_path.read_text())
target = next(item for item in registry['invariants'] if item['id'] == 'FLOW-03-I01')
contract = 'src/security/flow03EvaluationDraftPreservationContract.test.ts'
for key in ('impactPaths', 'tests'):
    if contract not in target[key]:
        anchor = 'src/security/flow03IndependentReviewRepairs.test.ts'
        index = target[key].index(anchor) + 1
        target[key].insert(index, contract)
registry_path.write_text(json.dumps(registry, indent=2, ensure_ascii=False) + '\n')
