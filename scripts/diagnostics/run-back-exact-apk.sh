#!/usr/bin/env bash
set -euo pipefail
mkdir -p native-evidence
collect() {
  adb shell dumpsys activity activities > native-evidence/activity.txt 2>&1 || true
  adb logcat -d -t 1500 > native-evidence/logcat.txt 2>&1 || true
}
trap collect EXIT
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = 36
adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural
adb shell cmd overlay list > native-evidence/overlays.txt
grep -E '^\[x\] com\.android\.internal\.systemui\.navbar\.gestural$' native-evidence/overlays.txt
adb install "$APK"
adb shell am start -W -n "$LAB_PACKAGE/it.trama.registrodocente.prova.MainActivity"
node --check scripts/diagnostics/back-exact-apk.mjs
node scripts/diagnostics/back-exact-apk.mjs
