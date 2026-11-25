"""Pure contracts for native picker selection; no application data or UI dump persistence."""
import re

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


def webview_attempt(driver, app_package, missing_context, on_transient):
    """Observe and attach only the application's local WebView; caller bounds retries."""
    target = "WEBVIEW_" + app_package
    try:
        if driver.current_package != app_package:
            return False
        contexts = [context for context in driver.contexts if context == target]
        if len(contexts) > 1:
            raise RuntimeError("AMBIGUOUS_WEBVIEW")
        if not contexts:
            return False
        driver.switch_to.context(target)
        return (driver.current_url.startswith(("http://localhost/", "https://localhost/"))
                and driver.current_package == app_package)
    except missing_context:
        # Context may disappear between discovery and attachment (SAF lifecycle).
        # Rediscover on the next poll. Do not replay any user action or restart the app.
        on_transient()
        return False
