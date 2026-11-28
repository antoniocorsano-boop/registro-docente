#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$0")"
python3 build-contract.py lock
export npm_config_registry=https://registry.npmjs.org
export npm_config_audit=false npm_config_fund=false
expected=$(python3 build-contract.py npm-version)
npm_cli=(npm)
if test "$(npm --version)" != "$expected"; then
  bootstrap=$(mktemp -d)
  trap 'rm -rf -- "$bootstrap"' EXIT
  npm_archive="$bootstrap/npm.tgz"
  curl --proto '=https' --fail --silent --show-error --max-time 60 \
    "https://registry.npmjs.org/npm/-/npm-$expected.tgz" --output "$npm_archive"
  printf '%s  %s\n' 'c80bd097147cce32e31010b791bab8c71a26a5e10668210ec9d2e7f4c7cea2a1' "$npm_archive" | sha256sum -c - >&2
  tar -xzf "$npm_archive" -C "$bootstrap" --no-same-owner
  npm_cli=(node "$bootstrap/package/bin/npm-cli.js")
fi
test "$("${npm_cli[@]}" --version)" = "$expected"
case "${1:-}" in
  install)
    before=$(sha256sum package.json package-lock.json)
    "${npm_cli[@]}" ci --dry-run=false
    test "$(sha256sum package.json package-lock.json)" = "$before"
    ;;
  inventory)
    "${npm_cli[@]}" ls --all --json
    ;;
  *) exit 2 ;;
esac
