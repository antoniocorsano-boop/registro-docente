import unittest
from native_contracts import classify_activity, native_selector, StableSelection, xpath_literal

class NativeContracts(unittest.TestCase):
    def test_activity_needs_resumed_component(self):
        self.assertEqual(classify_activity("background com.android.documentsui/.FilesActivity", "lab.app"), "unknown")
        self.assertEqual(classify_activity("topResumedActivity=ActivityRecord{ x com.google.android.documentsui/.FilesActivity }", "lab.app"), "documentsui")
        self.assertEqual(classify_activity("mResumedActivity: ActivityRecord{ x lab.app/.Main }", "lab.app"), "application")
        self.assertEqual(classify_activity("mResumedActivity: ActivityRecord{ x other.app/.Main }", "lab.app"), "other")
    def test_selector_scope_and_exact_match(self):
        selector = native_selector(("Save", "Salva"))
        self.assertIn("@package='com.android.documentsui'", selector)
        self.assertIn("@text='Save' or @text='Salva'", selector)
        self.assertIn("@enabled='true'", selector)
        self.assertIn("anteprima", native_selector(("Backup.enc.json",), reject_preview=True))
        with self.assertRaises(ValueError):
            native_selector(("x",), "unknown")
    def test_stable_selection_resets_on_missing_or_changed(self):
        s = StableSelection()
        self.assertFalse(s.observe("a"))
        self.assertFalse(s.observe("b"))
        self.assertFalse(s.observe(None))
        self.assertFalse(s.observe("b"))
        self.assertTrue(s.observe("b"))
    def test_literal(self):
        self.assertEqual(xpath_literal("Save"), "'Save'")
        self.assertEqual(xpath_literal("a'b"), '"a\'b"')
        self.assertTrue(xpath_literal('a\'"b').startswith("concat("))
