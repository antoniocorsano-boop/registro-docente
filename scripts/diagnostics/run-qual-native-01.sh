#!/usr/bin/env bash
set -euo pipefail
mkdir -p native-evidence
collect() {
  adb shell dumpsys activity activities > native-evidence/final-activity.txt 2>&1 || true
  adb shell dumpsys input > native-evidence/final-input.txt 2>&1 || true
  adb logcat -d -t 3000 > native-evidence/final-logcat.txt 2>&1 || true
  adb exec-out screencap -p > native-evidence/final-screen.png 2>/dev/null || true
}
trap collect EXIT
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = "$LAB_API"
adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural
adb shell cmd overlay list > native-evidence/overlays.txt
grep -E '^\[x\] com\.android\.internal\.systemui\.navbar\.gestural$' native-evidence/overlays.txt
adb install "$APK"
adb shell am start -W -n "$LAB_PACKAGE/it.trama.registrodocente.prova.MainActivity"
node --check scripts/diagnostics/qual-native-01.mjs
node scripts/diagnostics/qual-native-01.mjs
