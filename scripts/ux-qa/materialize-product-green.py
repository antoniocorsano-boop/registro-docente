from pathlib import Path

APP = Path('src/App.tsx')
BROWSER_TEST = Path('tests/browser/ux-trust-01-qualification.spec.cjs')
HOME_FAIL_CLOSED_TEST = Path('src/security/p2HomeFailClosedIntegrity.test.ts')
PERSIST_UI_TEST = Path('src/security/persist01hUiContract.test.ts')
PERSIST_BACKUP_TEST = Path('src/security/persist01hBackupRestoreContract.test.ts')
HOME_TEMPLATE = Path('scripts/ux-qa/HomeView.next.tsx')
HOME_TARGET = Path('src/components/HomeView.tsx')
SELF = Path('scripts/ux-qa/materialize-product-green.py')


def replace_exact(text: str, old: str, new: str, expected: int = 1) -> str:
    count = text.count(old)
    if count != expected:
        raise SystemExit(f'expected {expected} occurrence(s), found {count}: {old[:120]!r}')
    return text.replace(old, new)


app = APP.read_text()
app = replace_exact(
    app,
    '        currentClassId: persisted.currentClassId || null\n',
    '        // Navigation context is session-only: never reactivate a persisted class on entry.\n'
    '        currentClassId: null\n'
)
app = replace_exact(
    app,
    '  const libraryMutationPendingCountRef = useRef(0);\n'
    '  const mutationCoordinatorRef = useRef<ReturnType<typeof createDurableMutationCoordinator> | null>(null);\n',
    '  const libraryMutationPendingCountRef = useRef(0);\n\n'
    '  const handleNavigateTab = useCallback((tab: ActiveTab) => {\n'
    '    navigationVersionRef.current += 1;\n'
    '    setActiveTabState(tab);\n'
    '    const classId = currentClassIdRef.current;\n'
    '    try {\n'
    '      const state = { classId, tab };\n'
    '      const params = new URLSearchParams();\n'
    "      if (classId) params.set('class', classId);\n"
    "      if (tab !== 'home' && tab !== 'dashboard') params.set('tab', tab);\n"
    '      const query = params.toString();\n'
    "      history.pushState(state, '', query ? `?${query}` : window.location.pathname);\n"
    '    } catch (e) {}\n'
    '  }, []);\n\n'
    '  const mutationCoordinatorRef = useRef<ReturnType<typeof createDurableMutationCoordinator> | null>(null);\n'
)
app = replace_exact(
    app,
    '      appDataRef.current = restored.appData;\n'
    '      currentClassIdRef.current = restored.appData.currentClassId;\n',
    '      const restoredVisibleAppData = { ...restored.appData, currentClassId: null };\n'
    '      appDataRef.current = restoredVisibleAppData;\n'
    '      currentClassIdRef.current = null;\n'
)
app = replace_exact(
    app,
    '      setAppData(restored.appData);\n',
    '      setAppData(restoredVisibleAppData);\n'
)
app = replace_exact(
    app,
    '        setActiveTab={setActiveTab}\n',
    '        setActiveTab={handleNavigateTab}\n'
)
app = replace_exact(
    app,
    '            onNavigateTab={setActiveTab}\n',
    '            onNavigateTab={handleNavigateTab}\n',
    expected=2
)
APP.write_text(app)

browser = BROWSER_TEST.read_text()
browser = replace_exact(
    browser,
    "  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();\n"
    "  await expect(page.getByText(/Ultimo backup cifrato:/)).toBeVisible();\n",
    "  await expect(page.getByRole('heading', { name: 'Le mie classi' })).toBeVisible();\n"
    "  await page.getByRole('main').getByRole('button', { name: 'Sintesi', exact: true }).click();\n"
    "  await expect(page.getByText(/Ultimo backup cifrato:/)).toBeVisible();\n"
)
BROWSER_TEST.write_text(browser)

home_test = HOME_FAIL_CLOSED_TEST.read_text()
home_test = replace_exact(
    home_test,
    "    expect(home).toContain('const instituteSuffRate = allStudentAverages.length > 0');\n"
    "    expect(home).toContain(': null;');\n"
    "    expect(home).toContain(\"instituteSuffRate === null ? '—' : `${instituteSuffRate}%`\");\n"
    "    expect(home).toContain(\"instituteSuffRate === null ? 'Nessun dato' : 'Sufficienze Totali'\");\n",
    "    expect(home).toContain('const instituteSufficiency = allAverages.length > 0');\n"
    "    expect(home).toContain(': null;');\n"
    "    expect(home).toContain(\"instituteSufficiency === null ? '—' : `${instituteSufficiency}%`\");\n"
    "    expect(home).toContain(\"instituteSufficiency === null ? 'Nessun dato' : 'Sufficienze Totali'\");\n"
)
home_test = replace_exact(
    home_test,
    "    expect(home).toContain('const hasClassAverages = cAvgs.length > 0;');\n"
    "    expect(home).toContain('const cSuff = hasClassAverages');\n"
    "    expect(home).toContain(': null;');\n"
    "    expect(home).toContain('const advancedCount = hasClassAverages ? cAvgs.filter(v => v >= 8.5).length : null;');\n"
    "    expect(home).toContain('const atRiskCount = hasClassAverages ? cAvgs.filter(v => v < 6.0).length : null;');\n"
    "    expect(home).toContain(\"{cSuff === null ? '—' : `${cSuff}%`}\");\n"
    "    expect(home).toContain(\"{advancedCount === null ? '—' : advancedCount}\");\n"
    "    expect(home).toContain(\"{atRiskCount === null ? '—' : atRiskCount}\");\n",
    "    expect(home).toContain('const sufficiency = averages.length > 0');\n"
    "    expect(home).toContain(': null;');\n"
    "    expect(home).toContain('advancedCount: averages.length > 0 ? averages.filter(value => value >= 8.5).length : null');\n"
    "    expect(home).toContain('atRiskCount: averages.length > 0 ? averages.filter(value => value < 6).length : null');\n"
    "    expect(home).toContain(\"{item.sufficiency === null ? '—' : `${item.sufficiency}%`}\");\n"
    "    expect(home).toContain(\"{item.advancedCount === null ? '—' : item.advancedCount}\");\n"
    "    expect(home).toContain(\"{item.atRiskCount === null ? '—' : item.atRiskCount}\");\n"
)
HOME_FAIL_CLOSED_TEST.write_text(home_test)

persist_ui = PERSIST_UI_TEST.read_text()
persist_ui = replace_exact(
    persist_ui,
    "    expect(restore.indexOf('await secureStorage.restoreSnapshotVerified(candidate, previousLogical)')).toBeLessThan(restore.indexOf('appDataRef.current = restored.appData'));\n"
    "    expect(restore.indexOf('appDataRef.current = restored.appData')).toBeLessThan(restore.indexOf(\"setActiveTab('home')\"));\n",
    "    expect(restore).toContain('const restoredVisibleAppData = { ...restored.appData, currentClassId: null };');\n"
    "    expect(restore).toContain('currentClassIdRef.current = null;');\n"
    "    expect(restore).toContain('setAppData(restoredVisibleAppData);');\n"
    "    expect(restore.indexOf('await secureStorage.restoreSnapshotVerified(candidate, previousLogical)')).toBeLessThan(restore.indexOf('const restoredVisibleAppData = { ...restored.appData, currentClassId: null };'));\n"
    "    expect(restore.indexOf('const restoredVisibleAppData = { ...restored.appData, currentClassId: null };')).toBeLessThan(restore.indexOf('appDataRef.current = restoredVisibleAppData'));\n"
    "    expect(restore.indexOf('appDataRef.current = restoredVisibleAppData')).toBeLessThan(restore.indexOf(\"setActiveTab('home')\"));\n"
)
PERSIST_UI_TEST.write_text(persist_ui)

persist_backup = PERSIST_BACKUP_TEST.read_text()
persist_backup = replace_exact(
    persist_backup,
    "    expect(restore.indexOf('await secureStorage.restoreSnapshotVerified(candidate, previousLogical)')).toBeLessThan(restore.indexOf('appDataRef.current = restored.appData'));\n"
    "    expect(restore).toContain(\"setActiveTab('home')\");\n",
    "    expect(restore).toContain('const restoredVisibleAppData = { ...restored.appData, currentClassId: null };');\n"
    "    expect(restore).toContain('currentClassIdRef.current = null;');\n"
    "    expect(restore).toContain('setAppData(restoredVisibleAppData);');\n"
    "    expect(restore.indexOf('await secureStorage.restoreSnapshotVerified(candidate, previousLogical)')).toBeLessThan(restore.indexOf('const restoredVisibleAppData = { ...restored.appData, currentClassId: null };'));\n"
    "    expect(restore.indexOf('const restoredVisibleAppData = { ...restored.appData, currentClassId: null };')).toBeLessThan(restore.indexOf('appDataRef.current = restoredVisibleAppData'));\n"
    "    expect(restore).toContain(\"setActiveTab('home')\");\n"
)
PERSIST_BACKUP_TEST.write_text(persist_backup)

template = HOME_TEMPLATE.read_text()
template = template.replace("from '../../src/types'", "from '../types'")
template = template.replace("from '../../src/utils'", "from '../utils'")
template = template.replace("from '../../src/components/Sparkline'", "from './Sparkline'")
HOME_TARGET.write_text(template)

HOME_TEMPLATE.unlink()
SELF.unlink()
