#!/usr/bin/env bash
set -euo pipefail
mkdir -p native-evidence
collect() {
  adb shell dumpsys activity activities > native-evidence/activity.txt 2>&1 || true
  adb logcat -d -t 1500 > native-evidence/logcat.txt 2>&1 || true
  adb exec-out screencap -p > native-evidence/synthetic-screen.png 2>/dev/null || true
}
trap collect EXIT
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = "$LAB_API"
adb install "$APK"
adb shell am start -W -n "$LAB_PACKAGE/it.trama.registrodocente.prova.MainActivity"
node --check scripts/diagnostics/persist-b43-exact-apk.mjs
node scripts/diagnostics/persist-b43-exact-apk.mjs
