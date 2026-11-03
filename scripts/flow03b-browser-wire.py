from pathlib import Path
import json

workflow_path = Path('.github/workflows/browser-qualification.yml')
workflow = workflow_path.read_text(encoding='utf-8')

copy_anchor = """          cp tests/browser/flow-03-registra.spec.cjs .browser-tools/flow-03-registra.spec.cjs\n          cp tests/browser/browser-qualification.spec.cjs .browser-tools/browser-qualification.spec.cjs\n"""
copy_replacement = """          cp tests/browser/flow-03-registra.spec.cjs .browser-tools/flow-03-registra.spec.cjs\n          cp tests/browser/flow-03b-post-record-ux.spec.cjs .browser-tools/flow-03b-post-record-ux.spec.cjs\n          cp tests/browser/browser-qualification.spec.cjs .browser-tools/browser-qualification.spec.cjs\n"""
if workflow.count(copy_anchor) != 1:
    raise SystemExit(f'browser copy anchor count={workflow.count(copy_anchor)}')
workflow = workflow.replace(copy_anchor, copy_replacement, 1)

step_anchor = """      - name: Run LSM-01C consumer Chromium qualification\n"""
step_replacement = """      - name: Run FLOW-03B Chromium qualification\n        shell: bash\n        run: |\n          set -euo pipefail\n          cd .browser-tools\n          BASE_URL=\"http://127.0.0.1:${PORT}\" \\\n          EVIDENCE_DIR=\"../browser-evidence\" \\\n          CANDIDATE_SHA=\"${CANDIDATE_SHA}\" \\\n          ./node_modules/.bin/playwright test \\\n            flow-03b-post-record-ux.spec.cjs \\\n            --workers=1 \\\n            --reporter=line \\\n            --output=../browser-evidence/flow-03b-test-results\n\n      - name: Run LSM-01C consumer Chromium qualification\n"""
if workflow.count(step_anchor) != 1:
    raise SystemExit(f'browser step anchor count={workflow.count(step_anchor)}')
workflow = workflow.replace(step_anchor, step_replacement, 1)
workflow_path.write_text(workflow, encoding='utf-8')

registry_path = Path('qualification/invariants.v1.json')
registry = json.loads(registry_path.read_text(encoding='utf-8'))
invariant = next((item for item in registry['invariants'] if item['id'] == 'FLOW-03-I01'), None)
if invariant is None:
    raise SystemExit('FLOW-03-I01 missing')
for impact in [
    'tests/browser/flow-03b-post-record-ux.spec.cjs',
    'src/security/flow03bBrowserQualificationContract.test.ts'
]:
    if impact not in invariant['impactPaths']:
        invariant['impactPaths'].append(impact)
test_path = 'src/security/flow03bBrowserQualificationContract.test.ts'
if test_path not in invariant['tests']:
    invariant['tests'].append(test_path)
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
