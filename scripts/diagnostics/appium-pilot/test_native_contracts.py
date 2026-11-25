import unittest
from native_contracts import classify_activity

class NativeContracts(unittest.TestCase):
    def test_activity_needs_resumed_component(self):
        self.assertEqual(classify_activity("background com.android.documentsui/.FilesActivity", "lab.app"), "unknown")
        self.assertEqual(classify_activity("topResumedActivity=ActivityRecord{ x com.google.android.documentsui/.FilesActivity }", "lab.app"), "documentsui")
        self.assertEqual(classify_activity("mResumedActivity: ActivityRecord{ x lab.app/.Main }", "lab.app"), "application")
        self.assertEqual(classify_activity("mResumedActivity: ActivityRecord{ x other.app/.Main }", "lab.app"), "other")


class ContextMissing(Exception):
    pass


class FakeDriver:
    def __init__(self):
        self.current_package = "lab.app"
        self.current_url = "http://localhost/"
        self.available = ["NATIVE_APP", "WEBVIEW_lab.app"]
        self.switch_to = self
        self.switches = []
        self.reads = 0
        self.failure = None

    @property
    def contexts(self):
        self.reads += 1
        return self.available

    def context(self, value):
        self.switches.append(value)
        if self.failure:
            failure, self.failure = self.failure, None
            raise failure


class WebviewContracts(unittest.TestCase):
    def attempt(self, driver, retries):
        from native_contracts import webview_attempt
        return webview_attempt(driver, "lab.app", ContextMissing, lambda: retries.append(1))

    def test_context_disappears_between_discovery_and_attachment(self):
        driver, retries = FakeDriver(), []
        driver.failure = ContextMissing()
        self.assertFalse(self.attempt(driver, retries))
        driver.available = ["NATIVE_APP"]
        self.assertFalse(self.attempt(driver, retries))
        driver.available.append("WEBVIEW_lab.app")
        self.assertTrue(self.attempt(driver, retries))
        self.assertEqual(driver.reads, 3)
        self.assertEqual(driver.switches, ["WEBVIEW_lab.app"] * 2)
        self.assertEqual(retries, [1])

    def test_reject_foreign_or_missing_context(self):
        driver, retries = FakeDriver(), []
        driver.available = ["NATIVE_APP", "WEBVIEW_other.app"]
        self.assertFalse(self.attempt(driver, retries))
        driver.current_package = "other.app"
        driver.available.append("WEBVIEW_lab.app")
        self.assertFalse(self.attempt(driver, retries))
        self.assertEqual(driver.switches, [])

    def test_ambiguous_context_fails_closed(self):
        driver = FakeDriver()
        driver.available.append("WEBVIEW_lab.app")
        with self.assertRaisesRegex(RuntimeError, "AMBIGUOUS_WEBVIEW"):
            self.attempt(driver, [])

    def test_wrong_url_not_accepted(self):
        driver = FakeDriver()
        driver.current_url = "https://example.org/"
        self.assertFalse(self.attempt(driver, []))

    def test_other_errors_not_retried(self):
        driver, retries = FakeDriver(), []
        driver.failure = RuntimeError("session lost")
        with self.assertRaisesRegex(RuntimeError, "session lost"):
            self.attempt(driver, retries)
        self.assertEqual(retries, [])
