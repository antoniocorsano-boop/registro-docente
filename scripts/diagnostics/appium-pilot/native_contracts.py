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

def xpath_literal(value):
    if "'" not in value:
        return "'" + value + "'"
    if '"' not in value:
        return '"' + value + '"'
    return "concat(" + ", " .join([part for i, segment in enumerate(value.split("'")) for part in ((['"\'"'] if i else []) + ["'" + segment + "'"])]) + ")"

def native_selector(labels, attribute="text", reject_preview=False):
    if attribute not in ("text", "content-desc") or not labels:
        raise ValueError("INVALID_SELECTOR_CONTRACT")
    packages = " or ".join("@package=" + xpath_literal(p) for p in DOCUMENTS_PACKAGES)
    matches = " or ".join("@" + attribute + "=" + xpath_literal(label) for label in labels)
    preview = (" and not(contains(translate(@content-desc,'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
               "'abcdefghijklmnopqrstuvwxyz'),'preview')) and not(contains(translate(@content-desc,"
               "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'anteprima'))") if reject_preview else ""
    return "//*[(" + packages + ") and (" + matches + ") and @enabled='true'" + preview + "]"

class StableSelection:
    def __init__(self):
        self.previous = None
        self.count = 0
    def observe(self, signature):
        if signature is None:
            self.previous = None
            self.count = 0
            return False
        self.count = self.count + 1 if signature == self.previous else 1
        self.previous = signature
        return self.count >= 2
