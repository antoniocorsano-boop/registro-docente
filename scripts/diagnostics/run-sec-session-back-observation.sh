#!/usr/bin/env bash
set -euo pipefail
mkdir -p native-evidence
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = "$LAB_API"
adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural
adb shell cmd overlay list > native-evidence/overlays.txt
grep -E '^\[x\] com\.android\.internal\.systemui\.navbar\.gestural$' native-evidence/overlays.txt
adb install "$APK"
node --check scripts/diagnostics/sec-session-back-observation.mjs
for trial in native dom-setup; do
  adb shell am force-stop "$LAB_PACKAGE"
  adb shell pm clear "$LAB_PACKAGE"
  adb logcat -b all -c
  adb logcat -b all -v threadtime > "native-evidence/logcat-$trial.txt" &
  log_pid=$!
  trap 'kill "$log_pid" 2>/dev/null || true' EXIT
  adb shell am start -W -n "$LAB_PACKAGE/it.trama.registrodocente.prova.MainActivity"
  set +e
  LAB_TRIAL="$trial" node scripts/diagnostics/sec-session-back-observation.mjs
  outcome=$?
  set -e
  echo "$outcome" > "native-evidence/exit-$trial.txt"
  adb shell dumpsys activity activities > "native-evidence/activity-$trial.txt" 2>&1 || true
  adb shell dumpsys window windows > "native-evidence/window-$trial.txt" 2>&1 || true
  adb shell dumpsys input > "native-evidence/input-$trial.txt" 2>&1 || true
  adb shell uiautomator dump /sdcard/trama-final-window.xml >/dev/null 2>&1 && adb shell cat /sdcard/trama-final-window.xml > "native-evidence/window-$trial.xml" || true
  kill "$log_pid" 2>/dev/null || true
  wait "$log_pid" 2>/dev/null || true
  trap - EXIT
done
