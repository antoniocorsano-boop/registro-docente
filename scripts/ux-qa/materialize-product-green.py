from pathlib import Path

APP = Path('src/App.tsx')
BROWSER_TEST = Path('tests/browser/ux-trust-01-qualification.spec.cjs')
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

template = HOME_TEMPLATE.read_text()
template = template.replace("from '../../src/types'", "from '../types'")
template = template.replace("from '../../src/utils'", "from '../utils'")
template = template.replace("from '../../src/components/Sparkline'", "from './Sparkline'")
HOME_TARGET.write_text(template)

HOME_TEMPLATE.unlink()
SELF.unlink()
