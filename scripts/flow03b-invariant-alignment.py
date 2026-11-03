from pathlib import Path
import json

# FLOW-02: preserve the semantic invariant (Conduci suppresses ambient trigger)
# without freezing the whole expression, which FLOW-03B legitimately extends.
path = Path('src/security/flow02AppIntegrationContract.test.ts')
text = path.read_text(encoding='utf-8')
old = '''    expect(app).toContain("showClosedTrigger={todayAction !== 'conduct'}");\n'''
new = '''    expect(app).toContain("showClosedTrigger={todayAction !== 'conduct'");\n'''
if text.count(old) != 1:
    raise SystemExit(f'FLOW-02 trigger expectation count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# FLOW-01: review remains navigation-only, now contextualized through the FLOW-03B resolver.
path = Path('src/security/flow01PreparationUiContract.test.ts')
text = path.read_text(encoding='utf-8')
old = "    expect(dashboard).toContain('getTodayContinuationOptions(todayAction)');\n"
new = "    expect(dashboard).toContain('getRecordReviewOptions(reviewEvidenceKind)');\n"
if text.count(old) != 1:
    raise SystemExit(f'FLOW-01 review expectation count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# TODAY-01: keep prepare/conduct/record delegation and navigation-only review,
# but accept contextual ordering from the session-only evidence kind.
path = Path('src/security/today01ContinuationContract.test.ts')
text = path.read_text(encoding='utf-8')
old = '''    expect(dashboard).toContain("import { getTodayContinuationOptions, type TodayAction, type TodayContinuationAction } from '../today/todayRouter';");\n'''
new = '''    expect(dashboard).toContain("import { getRecordReviewOptions } from '../recording/reviewRouting';");\n    expect(dashboard).toContain("import { type TodayAction, type TodayContinuationAction } from '../today/todayRouter';");\n'''
if text.count(old) != 1:
    raise SystemExit(f'TODAY import expectation count={text.count(old)}')
text = text.replace(old, new, 1)
old = "    expect(dashboard).toContain('getTodayContinuationOptions(todayAction)');\n"
new = "    expect(dashboard).toContain('getRecordReviewOptions(reviewEvidenceKind)');\n"
if text.count(old) != 1:
    raise SystemExit(f'TODAY review expectation count={text.count(old)}')
path.write_text(text.replace(old, new, 1), encoding='utf-8')

# Map exact FLOW-03B governance artifacts to the existing FLOW-03 invariant family.
registry_path = Path('qualification/invariants.v1.json')
registry = json.loads(registry_path.read_text(encoding='utf-8'))
invariant = next((item for item in registry['invariants'] if item['id'] == 'FLOW-03-I01'), None)
if invariant is None:
    raise SystemExit('FLOW-03-I01 missing')
for impact in [
    'docs/superpowers/specs/2026-11-03-flow-03b-post-record-ux-design.md',
    'docs/superpowers/plans/2026-11-03-flow-03b-post-record-ux.md',
    'docs/superpowers/receipts/2026-11-03-flow-03b-browser-integration-checkpoint.md'
]:
    if impact not in invariant['impactPaths']:
        invariant['impactPaths'].append(impact)
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
