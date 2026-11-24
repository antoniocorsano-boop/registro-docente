#!/usr/bin/env bash
set -euo pipefail
# Local-only server; enable only the documented official ChromeDriver download.
# No broad relaxed-security, no raw logs or screenshot artifacts.
appium server --address 127.0.0.1 --port 4723 --log-level error --allow-insecure uiautomator2:chromedriver_autodownload >"$RUNNER_TEMP/q5-appium.log" 2>&1 &
server=$!
trap 'kill "$server" 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do
  if curl -fsS --max-time 2 http://127.0.0.1:4723/status >/dev/null; then break; fi
  kill -0 "$server"
  sleep 1
done
curl -fsS --max-time 2 http://127.0.0.1:4723/status >/dev/null
timeout --signal=TERM --kill-after=10s 480s "$RUNNER_TEMP/q5-appium-venv/bin/python" scripts/diagnostics/appium-pilot/pilot.py
