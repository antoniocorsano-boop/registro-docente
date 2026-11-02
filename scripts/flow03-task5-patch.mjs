import { readFile, writeFile } from 'node:fs/promises';

// Re-run on the current exact branch head after aligning inherited FLOW-01/FLOW-02/PERSIST contracts.
async function patchFile(path, transforms) {
  let source = await readFile(path, 'utf8');
  for (const [label, before, after] of transforms) {
    const first = source.indexOf(before);
    if (first < 0) throw new Error(`${path} ${label}: anchor not found`);
    if (source.indexOf(before, first + before.length) >= 0) throw new Error(`${path} ${label}: anchor is not unique`);
    source = source.slice(0, first) + after + source.slice(first + before.length);
  }
  await writeFile(path, source);
}

await patchFile('src/components/EvaluationsView.tsx', [
  [
    'props',
    "  udas?: UdaRecord[];\n  onSaveEvaluations:",
    "  udas?: UdaRecord[];\n  initialUdaId?: string;\n  initialDate?: string;\n  onSaveEvaluations:"
  ],
  [
    'destructure',
    "  editingBatchId,\n  udas = [],\n  onSaveEvaluations,",
    "  editingBatchId,\n  udas = [],\n  initialUdaId,\n  initialDate,\n  onSaveEvaluations,"
  ],
  [
    'date validator',
    "export const EvaluationsView: React.FC<EvaluationsViewProps> = ({",
    "const isIsoDate = (value?: string): value is string => {\n  if (!value || !/^\\d{4}-\\d{2}-\\d{2}$/.test(value)) return false;\n  const parsed = new Date(`${value}T00:00:00Z`);\n  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;\n};\n\nexport const EvaluationsView: React.FC<EvaluationsViewProps> = ({"
  ],
  [
    'new evaluation prefill',
    "    } else {\n      setTitle('');\n      setDate(today());\n      setUdaId('');\n      setGradesMap({});\n    }\n  }, [editingBatchId, currentClass]);",
    "    } else {\n      const safeInitialUdaId = udas.some(u => u.id === initialUdaId && u.className === currentClass.name) ? initialUdaId || '' : '';\n      setTitle('');\n      setDate(isIsoDate(initialDate) ? initialDate! : today());\n      setUdaId(safeInitialUdaId);\n      setGradesMap({});\n    }\n  }, [editingBatchId, currentClass, udas, initialUdaId, initialDate]);"
  ],
  [
    'class filtered UDA choices',
    "              {udas.map(u => (",
    "              {udas.filter(u => u.className === currentClass.name).map(u => ("
  ]
]);

await patchFile('src/App.tsx', [
  [
    'evaluation context wiring',
    "            editingBatchId={editingBatchId}\n            udas={udas}\n            onSaveEvaluations={handleSaveEvaluations}",
    "            editingBatchId={editingBatchId}\n            udas={udas}\n            initialUdaId={recordSession?.status === 'editing' && recordSession.evidenceKind === 'evaluation'\n              ? recordSession.context.udaId\n              : undefined}\n            initialDate={recordSession?.status === 'editing' && recordSession.evidenceKind === 'evaluation' ? today() : undefined}\n            onSaveEvaluations={handleSaveEvaluations}"
  ]
]);

console.log('FLOW-03 Task 5 patch applied fail-closed.');
