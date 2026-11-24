import unittest
from native_contracts import classify_activity

class NativeContracts(unittest.TestCase):
    def test_activity_needs_resumed_component(self):
        self.assertEqual(classify_activity("background com.android.documentsui/.FilesActivity", "lab.app"), "unknown")
        self.assertEqual(classify_activity("topResumedActivity=ActivityRecord{ x com.google.android.documentsui/.FilesActivity }", "lab.app"), "documentsui")
        self.assertEqual(classify_activity("mResumedActivity: ActivityRecord{ x lab.app/.Main }", "lab.app"), "application")
        self.assertEqual(classify_activity("mResumedActivity: ActivityRecord{ x other.app/.Main }", "lab.app"), "other")
