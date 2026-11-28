"""Pure contracts for native picker selection; no application data or UI dump persistence."""
import re
import signal
from contextlib import contextmanager

DOCUMENTS_PACKAGES = ("com.google.android.documentsui", "com.android.documentsui")

def classify_activity(raw, app_package):
    row = next((line for line in raw.splitlines() if re.search(r"\b(?:topResumedActivity|mResumedActivity)\b", line)), "")
    match = re.search(r"\b([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)+)/[A-Za-z0-9_.$]+", row)
    if not match:
        return "unknown"
    package = match.group(1)
    if package == app_package:
        return "application"
    return "documentsui" if package in DOCUMENTS_PACKAGES else "other"


class WebviewDeadlineExceeded(RuntimeError):
    pass


@contextmanager
def webview_deadline(seconds):
    """Linux lab wall-clock guard; a blocked HTTP command cannot extend the deadline."""
    if seconds <= 0 or signal.getitimer(signal.ITIMER_REAL)[0] != 0:
        raise RuntimeError("INVALID_OR_NESTED_WEBVIEW_DEADLINE")

    def expired(_signum, _frame):
        raise WebviewDeadlineExceeded("WEBVIEW_WALL_CLOCK_EXCEEDED")

    previous = signal.signal(signal.SIGALRM, expired)
    try:
        signal.setitimer(signal.ITIMER_REAL, seconds)
        yield
    finally:
        signal.setitimer(signal.ITIMER_REAL, 0)
        signal.signal(signal.SIGALRM, previous)


def webview_attempt(driver, app_package, missing_context, on_transient, on_step=lambda _step: None):
    """Observe and attach only the application's local WebView; caller bounds retries."""
    target = "WEBVIEW_" + app_package
    try:
        on_step("foreground-before")
        if driver.current_package != app_package:
            return False
        on_step("discover-context")
        contexts = [context for context in driver.contexts if context == target]
        if len(contexts) > 1:
            raise RuntimeError("AMBIGUOUS_WEBVIEW")
        if not contexts:
            return False
        on_step("attach-context")
        driver.switch_to.context(target)
        on_step("verify-local-url")
        if not driver.current_url.startswith(("http://localhost/", "https://localhost/")):
            return False
        on_step("foreground-after")
        return driver.current_package == app_package
    except missing_context:
        # Context may disappear between discovery and attachment (SAF lifecycle).
        # Rediscover on the next poll. Do not replay any user action or restart the app.
        on_transient()
        return False
