#!/usr/bin/env bash
# Canonical laboratory preflight. No application, telephony, or security
# settings are changed: wait for the fresh emulator to finish initialization.
set -euo pipefail
mkdir -p native-evidence
test "${LAB_PACKAGE:-}" = it.trama.registrodocente.lab.b43
case "${LAB_API:-}" in 32|36) ;; *) exit 1;; esac
test "$(adb shell getprop sys.boot_completed | tr -d '\r')" = 1
test "$(adb shell getprop ro.build.version.sdk | tr -d '\r')" = "$LAB_API"
qemu="$(adb shell getprop ro.kernel.qemu | tr -d '\r')"
boot_qemu="$(adb shell getprop ro.boot.qemu | tr -d '\r')"
[[ "$qemu" == 1 || "$boot_qemu" == 1 ]]
home="$(adb shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tr -d '\r' | tail -n 1)"
[[ "$home" == */* ]]
home_package="${home%%/*}"
# Send Home before the tested application is installed/launched. This is
# environment initialization, not part of any navigation assertion.
adb shell input keyevent KEYCODE_HOME
start=$SECONDS
quiet_since=$SECONDS
previous=""
while (( SECONDS - start < 180 )); do
  sim="$(adb shell getprop gsm.sim.state | tr -d '\r')"
  boot="$(adb shell getprop sys.boot_completed | tr -d '\r')"
  activities="$(adb shell dumpsys activity activities)"
  resumed="$(printf '%s\n' "$activities" | grep -E 'topResumedActivity|mResumedActivity' || true)"
  # Compare the tail of lifecycle and subscription changes, not all log traffic.
  # No clearing of the logs; the complete evidence is retained by the caller.
  events="$(adb logcat -b all -d -v brief | grep -E 'START.*SimDialogActivity|wm_(create|resume|pause|finish|destroy|set_resumed)_activity.*SimDialogActivity|Active subscription info list changed|notifySubscriptionInfoChanged|SIM_STATE_CHANGED' | tail -n 30 || true)"
  fingerprint="$(printf '%s\n%s\n%s\n' "$sim" "$resumed" "$events" | sha256sum | cut -d' ' -f1)"
  stable_sim=true
  IFS=, read -ra slots <<< "$sim"
  if (( ${#slots[@]} == 0 )); then stable_sim=false; fi
  for slot in "${slots[@]}"; do
    case "$slot" in READY|LOADED|ABSENT) ;; *) stable_sim=false;; esac
  done
  if [[ "$fingerprint" != "$previous" || "$stable_sim" != true || "$boot" != 1 || "$resumed" != *"$home_package/"* ]]; then
    quiet_since=$SECONDS
  fi
  previous="$fingerprint"
  printf 'elapsed=%s quiet=%s sim=%s homeForeground=%s\n' "$((SECONDS-start))" "$((SECONDS-quiet_since))" "$sim" "$([[ "$resumed" == *"$home_package/"* ]] && echo true || echo false)" | tee -a native-evidence/emulator-readiness.txt
  # Minimum warmup exceeds the measured late SIM initialization; the quiet
  # interval restarts after any observed subscription or activity transition.
  if (( SECONDS - start >= 45 && SECONDS - quiet_since >= 20 )) && [[ "$stable_sim" == true && "$boot" == 1 && "$resumed" == *"$home_package/"* ]]; then
    echo 'EMULATOR_PREFLIGHT_PASS' | tee -a native-evidence/emulator-readiness.txt
    exit 0
  fi
  sleep 3
done
echo 'EMULATOR_PREFLIGHT_FAIL: boot/telephony/foreground did not settle' | tee -a native-evidence/emulator-readiness.txt >&2
exit 1
