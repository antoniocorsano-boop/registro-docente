#!/usr/bin/env bash
set -euo pipefail
mkdir -p native-evidence
log_pid=""
collect() {
  adb shell dumpsys activity activities > native-evidence/activity.txt 2>&1 || true
  adb shell dumpsys window windows > native-evidence/window.txt 2>&1 || true
  adb logcat -d -t 1500 > native-evidence/logcat.txt 2>&1 || true
  adb exec-out screencap -p > native-evidence/synthetic-screen.png 2>/dev/null || true
  if [[ -n "$log_pid" ]]; then
    kill "$log_pid" 2>/dev/null || true
    wait "$log_pid" 2>/dev/null || true
  fi
}
trap collect EXIT
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = "$LAB_API"
adb shell cmd overlay enable-exclusive --category com.android.internal.systemui.navbar.gestural
adb shell cmd overlay list > native-evidence/overlays.txt
grep -E '^\[x\] com\.android\.internal\.systemui\.navbar\.gestural$' native-evidence/overlays.txt
# Keep the full boot-to-test event stream, including late system dialogs.
adb logcat -b all -v threadtime > native-evidence/logcat-full.txt &
log_pid=$!
bash scripts/diagnostics/prepare-b43-emulator.sh
adb install "$APK"
adb shell am start -W -n "$LAB_PACKAGE/it.trama.registrodocente.prova.MainActivity"
node --check scripts/diagnostics/sec-session-final-boundary.mjs
node scripts/diagnostics/sec-session-final-boundary.mjs
