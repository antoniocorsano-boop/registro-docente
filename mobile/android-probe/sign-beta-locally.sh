#!/usr/bin/env bash
# Owner-controlled local signing. Never run with a key on CI or in a shared shell.
set -euo pipefail
if [[ $# -lt 4 || $# -gt 5 ]]; then
  echo "Usage: bash sign-beta-locally.sh unsigned.apk expected_sha256 owner-keystore.p12 signed.apk [previous-signed.apk]" >&2
  exit 2
fi
unsigned="$1"; expected="$2"; keystore="$3"; output="$4"; previous="${5:-}"
: "${ANDROID_HOME:?Set ANDROID_HOME to a local Android SDK}"
tools="$ANDROID_HOME/build-tools/36.0.0"
aapt="$tools/aapt"; signer="$tools/apksigner"; align="$tools/zipalign"
for tool in "$aapt" "$signer" "$align"; do test -x "$tool"; done
[[ "$expected" =~ ^[0-9a-f]{64}$ ]]
[[ -f "$unsigned" && -f "$keystore" && ! -e "$output" ]]
[[ "$unsigned" != "$output" && "$keystore" != "$output" ]]
actual="$(sha256sum "$unsigned" | awk '{print $1}')"
[[ "$actual" == "$expected" ]] || { echo 'Unexpected candidate SHA-256' >&2; exit 1; }
if "$signer" verify "$unsigned" >/dev/null 2>&1; then
  echo 'Input must be unsigned' >&2; exit 1
fi
identity() {
  "$aapt" dump badging "$1" | sed -n "s/^package: name='\([^']*\)' versionCode='\([^']*\)' versionName='\([^']*\)'.*/\1 \2 \3/p"
}
read -r app version name < <(identity "$unsigned")
[[ "$app" == "it.trama.registrodocente" && "$version" =~ ^[0-9]+$ && "$version" -ge 10001 ]]
[[ "$name" =~ ^0\.1\.0-beta\.1-rc\.[1-9][0-9]*$ ]]
if "$aapt" dump badging "$unsigned" | grep -q '^application-debuggable'; then
  echo 'Debuggable candidate rejected' >&2; exit 1
fi
cert() {
  "$signer" verify --print-certs "$1" | awk -F': ' '/^Signer #1 certificate SHA-256 digest:/{print $2}'
}
if [[ "$version" -gt 10001 && -z "$previous" ]]; then
  echo 'Previous signed Beta required for subsequent updates' >&2; exit 1
fi
if [[ -n "$previous" ]]; then
  "$signer" verify "$previous"
  read -r old_app old_version old_name < <(identity "$previous")
  [[ "$old_app" == "$app" && "$old_version" =~ ^[0-9]+$ && "$version" -gt "$old_version" ]]
  old_cert="$(cert "$previous")"
  [[ "$old_cert" =~ ^[0-9a-f]{64}$ ]]
fi
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
"$align" -P 16 -f 4 "$unsigned" "$temp/aligned.apk"
# Password is requested by apksigner directly on the owner's terminal.
# No password arguments, environment variables, logs or repository secrets.
"$signer" sign --ks "$keystore" --ks-key-alias registro-docente --out "$temp/signed.apk" "$temp/aligned.apk"
"$signer" verify --print-certs "$temp/signed.apk"
new_cert="$(cert "$temp/signed.apk")"
[[ "$new_cert" =~ ^[0-9a-f]{64}$ ]]
if [[ -n "$previous" && "$new_cert" != "$old_cert" ]]; then
  echo 'Signing certificate differs from the previous Beta' >&2; exit 1
fi
[[ "$(identity "$temp/signed.apk")" == "$(identity "$unsigned")" ]]
"$align" -c -P 16 4 "$temp/signed.apk"
# Copy only a verified signed APK; the private key stays with the owner.
( set -o noclobber; cat "$temp/signed.apk" > "$output" )
sha256sum "$output"
printf 'Certificate SHA-256: %s\n' "$new_cert"
printf 'Signed candidate, NOT released. Device qualification required.\n'
