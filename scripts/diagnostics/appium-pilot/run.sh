#!/usr/bin/env bash
set -euo pipefail
# Local-only server; enable only the documented official ChromeDriver download.
# No broad relaxed-security, no raw logs or screenshot artifacts.
# An occupied or uninspectable listener must not be accepted as our server.
listener_rows() { ss -H -ltnp 'sport = :4723'; }
listeners=$(listener_rows)
if test -n "$listeners"; then printf '%s\n' 'APPIUM_PORT_OCCUPIED' >&2; exit 1; fi
if test "${Q5_DUAL_DIAGNOSTIC:-false}" = true || test "${Q5_DUAL_QUALIFICATION:-false}" = true; then
  appium server --address 127.0.0.1 --port 4723 --log-level error >"$RUNNER_TEMP/q5-appium.log" 2>&1 &
else
  appium server --address 127.0.0.1 --port 4723 --log-level error --allow-insecure uiautomator2:chromedriver_autodownload >"$RUNNER_TEMP/q5-appium.log" 2>&1 &
fi
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
owns_listener() {
  kill -0 "$server" || return 1
  local rows
  rows=$(listener_rows) || return 1
  printf '%s\n' "$rows" | awk -v owner="$server" '$4=="127.0.0.1:4723" && index($0,"pid=" owner ",")>0 {n++} END{exit !(NR==1 && n==1)}'
}
ready=false
for _ in $(seq 1 40); do
  kill -0 "$server"
  if curl --noproxy '*' -fsS --max-time 2 http://127.0.0.1:4723/status >/dev/null; then
    owns_listener || { printf '%s\n' 'APPIUM_LISTENER_NOT_OWNED' >&2; exit 1; }
    ready=true; break
  fi
  sleep 1
done
test "$ready" = true
owns_listener
if test "${Q5_DUAL_DIAGNOSTIC:-false}" = true || test "${Q5_DUAL_QUALIFICATION:-false}" = true; then
  timeout --signal=TERM --kill-after=10s 900s node scripts/diagnostics/ap02-native-device-v7.mjs
else
  timeout --signal=TERM --kill-after=10s 900s "$RUNNER_TEMP/q5-appium-venv/bin/python" scripts/diagnostics/appium-pilot/pilot.py
fi
