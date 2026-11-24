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
