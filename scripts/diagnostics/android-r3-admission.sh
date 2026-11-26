#!/usr/bin/env bash
# Verify the exact production-candidate suffix. Callers separately enforce
# repository, PR, ref, base and event authorization.
set -euo pipefail
r1=891a2e2e47b8c86ee0829d18462aac1b6f740ad8
mobile=96b9f79055a50f8309ead2e985c2550e49118294
diagnostics=4b6e24c14e163b172a8bd798a5ffc9a15f00d2ca
check_delta() {
  local parent="$1" child="$2" actual expected
  shift 2
  test "$(git rev-list --parents -n 1 "$child")" = "$child $parent"
  actual=$(git diff --name-only --no-renames "$parent" "$child" | LC_ALL=C sort)
  expected=$(printf '%s\n' "$@" | LC_ALL=C sort)
  test "$actual" = "$expected"
}
test "$CANDIDATE_SHA" = "$(git rev-parse HEAD)"
check_delta "$r1" "$mobile" \
  mobile/android-probe/native-inventory.init.gradle \
  mobile/android-probe/test_native_inventory.py \
  mobile/android-probe/verify-native-inventory.py
check_delta "$mobile" "$diagnostics" \
  scripts/diagnostics/ap02-native-device-v7.mjs \
  scripts/diagnostics/native-lab-runtime.mjs \
  scripts/diagnostics/native-lab-runtime.test.mjs
r3=8d8de5a6a09350a057cf1061909d264fc01b5a8e
check_delta "$diagnostics" "$r3" \
  .github/workflows/qa-appium-replacement-pilot.yml \
  .github/workflows/val01-native-evidence.yml \
  scripts/diagnostics/android-r3-admission.sh \
  scripts/diagnostics/appium-pilot/contract.test.mjs \
  scripts/diagnostics/val01-native-evidence.mjs
check_delta "$r3" "$CANDIDATE_SHA" \
  .github/workflows/val01-native-evidence.yml \
  scripts/diagnostics/android-r3-admission.sh \
  scripts/diagnostics/appium-pilot/contract.test.mjs \
  scripts/diagnostics/val01-native-evidence.mjs
