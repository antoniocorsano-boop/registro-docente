#!/usr/bin/env bash
# Verify the exact production-candidate suffix. Callers separately enforce
# repository, PR, ref, base and event authorization.
set -euo pipefail
r1=891a2e2e47b8c86ee0829d18462aac1b6f740ad8
mobile=96b9f79055a50f8309ead2e985c2550e49118294
diagnostics=4b6e24c14e163b172a8bd798a5ffc9a15f00d2ca
check_delta() {
  local parent="$1" child="$2" actual expected
  shift 2
  test "$(git rev-list --parents -n 1 "$child")" = "$child $parent"
  actual=$(git diff --name-only --no-renames "$parent" "$child" | LC_ALL=C sort)
  expected=$(printf '%s\n' "$@" | LC_ALL=C sort)
  test "$actual" = "$expected"
}
test "$CANDIDATE_SHA" = "$(git rev-parse HEAD)"
check_delta "$r1" "$mobile" \
  mobile/android-probe/native-inventory.init.gradle \
  mobile/android-probe/test_native_inventory.py \
  mobile/android-probe/verify-native-inventory.py
check_delta "$mobile" "$diagnostics" \
  scripts/diagnostics/ap02-native-device-v7.mjs \
  scripts/diagnostics/native-lab-runtime.mjs \
  scripts/diagnostics/native-lab-runtime.test.mjs
r3=8d8de5a6a09350a057cf1061909d264fc01b5a8e
check_delta "$diagnostics" "$r3" \
  .github/workflows/qa-appium-replacement-pilot.yml \
  .github/workflows/val01-native-evidence.yml \
  scripts/diagnostics/android-r3-admission.sh \
  scripts/diagnostics/appium-pilot/contract.test.mjs \
  scripts/diagnostics/val01-native-evidence.mjs
r3a=5e725e2d9241e03f3e04fb4372dda617bc4a2606
check_delta "$r3" "$r3a" \
  .github/workflows/val01-native-evidence.yml \
  scripts/diagnostics/android-r3-admission.sh \
  scripts/diagnostics/appium-pilot/contract.test.mjs \
  scripts/diagnostics/val01-native-evidence.mjs
if test "$CANDIDATE_SHA" != "$r3a"; then
  test "${1:-}" = --allow-r4a
  r4a=b142cc03a8d6b90ee93ec93045e7455ce34639d8
  r4a_head="$CANDIDATE_SHA"
  if test "$CANDIDATE_SHA" != "$r4a" && git merge-base --is-ancestor "$r4a" "$CANDIDATE_SHA"; then
    r4a_head="$r4a"
    gov=1b83f6364985b89cdbd89b73e6c382bd6300f655
    gov_head="$CANDIDATE_SHA"
    if test "$CANDIDATE_SHA" != "$gov" && git merge-base --is-ancestor "$gov" "$CANDIDATE_SHA"; then
      gov_head="$gov"
      build01=c05702fdbd85f3c8bc89dfedfb43df8aee3a85ec
      build01_head="$CANDIDATE_SHA"
      if test "$CANDIDATE_SHA" != "$build01" && git merge-base --is-ancestor "$build01" "$CANDIDATE_SHA"; then
        build01_head="$build01"
        build01a=2e53609d1e627d008e745f043b4e8909b8ed02c3
        build01a_head="$CANDIDATE_SHA"
        if test "$CANDIDATE_SHA" != "$build01a" && git merge-base --is-ancestor "$build01a" "$CANDIDATE_SHA"; then
          build01a_head="$build01a"
          # Historical admission below remains bound to the frozen predecessor.
          local_paths=(
            .github/workflows/ap02-f2-native-device.yml
            .github/workflows/browser-qualification.yml
            .github/workflows/header01-copilot-drawer-isolated-qualification.yml
            .github/workflows/nav-mobile-disclosure-back-isolated-qualification.yml
            .github/workflows/qa-appium-replacement-pilot.yml
            docs/superpowers/plans/2026-11-28-beta-close-01-consolidamento.md
            mobile/android-probe/probe-npm.sh
            mobile/android-probe/test_native_inventory.py
            mobile/android-probe/verify-build-inventory.py
            qualification/invariants.v1.json
            scripts/diagnostics/ap02-native-device-v7.mjs
            scripts/diagnostics/appium-pilot/contract.test.mjs
            scripts/diagnostics/appium-pilot/native-picker.mjs
            scripts/diagnostics/appium-pilot/pilot.py
            scripts/diagnostics/appium-pilot/q3-evidence.mjs
            scripts/diagnostics/appium-pilot/run.sh
            scripts/diagnostics/appium-pilot/test_native_contracts.py
            scripts/diagnostics/native-lab-runtime.mjs
            scripts/diagnostics/native-lab-runtime.test.mjs
            scripts/diagnostics/native-lab-transitions.mjs
            scripts/diagnostics/native-process-probe.mjs
            scripts/diagnostics/native-process-probe.test.mjs
            scripts/diagnostics/native-saf-lifecycle-probe.mjs
            scripts/diagnostics/native-saf-lifecycle-probe.test.mjs
            scripts/diagnostics/val01-native-evidence.mjs
            src/security/ap02LegacyBackupBoundary.test.ts
            src/security/ap02V7OperationalBackup.test.ts
            src/security/protectedBootstrap.test.ts
            src/security/protectedBootstrap.ts
            src/security/secureVault.ts
            src/security/vaultStore.ts
            tests/browser/beta-close-cr06.spec.cjs
            tests/browser/fixtures/beta-close-cr06.fixture.mjs
          )
          check_delta "$build01a" "$CANDIDATE_SHA" scripts/diagnostics/android-r3-admission.sh "${local_paths[@]}"
          # Bind the exact blob and mode of each other changed file.
          # This script's own blob is verified by the independent governance verifier.
          delta_digest=$(git ls-tree -r "$CANDIDATE_SHA" -- "${local_paths[@]}" | sha256sum)
          test "${delta_digest%% *}" = 3c9c5bd7da1fe1f3b5cf94ec61fb5c05be1d2bd896d47d16dd4248a6ebd95823
          test "$(git ls-tree "$CANDIDATE_SHA" -- scripts/diagnostics/android-r3-admission.sh | cut -d ' ' -f 1)" = 100644
        fi
        check_delta "$build01" "$build01a_head" \
          mobile/android-probe/verification-metadata.xml \
          scripts/diagnostics/android-r3-admission.sh
        test "$(git ls-tree "$build01a_head" -- mobile/android-probe/verification-metadata.xml)" = \
          "$(printf '100644 blob %s\t%s' '171aff841a11b8307f5ef1ccdece58a47615cda4' mobile/android-probe/verification-metadata.xml)"
      fi
      check_delta "$gov" "$build01_head" \
        .github/workflows/ap02-f2-native-device.yml \
        .github/workflows/mobile-01-android-probe.yml \
        .github/workflows/qa-appium-replacement-pilot.yml \
        .github/workflows/val01-native-evidence.yml \
        mobile/android-probe/.gitignore \
        mobile/android-probe/build-contract.py \
        mobile/android-probe/build-inventory.init.gradle \
        mobile/android-probe/gradle-8.14.8/.gitattributes \
        mobile/android-probe/gradle-8.14.8/gradle-wrapper.jar \
        mobile/android-probe/gradle-8.14.8/gradlew \
        mobile/android-probe/gradle-8.14.8/gradlew.bat \
        mobile/android-probe/package-lock.json \
        mobile/android-probe/probe-npm.sh \
        mobile/android-probe/test_native_inventory.py \
        mobile/android-probe/verification-metadata.xml \
        mobile/android-probe/verify-build-inventory.py \
        scripts/diagnostics/android-r3-admission.sh \
        scripts/diagnostics/appium-pilot/contract.test.mjs
    fi
    check_delta "$r4a" "$gov_head" \
      .github/workflows/behavior-integrity-qualification.yml \
      .github/workflows/mobile-density-02-qualification.yml \
      .github/workflows/nav-context-01-isolated-qualification.yml \
      scripts/diagnostics/android-r3-admission.sh
    # Tree entries from the qualified PR #393 head (929594d).
    expected=$(cat <<'EOF'
100644 blob d0205c714ef623348cf398c411f81d0f5c387461	.github/workflows/behavior-integrity-qualification.yml
100644 blob 8443ac7dcd15e2703812051cfe34bcbcf4e74ce6	.github/workflows/mobile-density-02-qualification.yml
100644 blob eb366d463f3ab62bf1ad81c80820ab6680d5e1a0	.github/workflows/nav-context-01-isolated-qualification.yml
EOF
)
    actual=$(git ls-tree "$gov_head" -- \
      .github/workflows/behavior-integrity-qualification.yml \
      .github/workflows/mobile-density-02-qualification.yml \
      .github/workflows/nav-context-01-isolated-qualification.yml)
    test "$actual" = "$expected"
  fi
  check_delta "$r3a" "$r4a_head" \
    .github/workflows/ap02-f2-native-device.yml \
    .github/workflows/qa-appium-replacement-pilot.yml \
    qualification/invariants.v1.json \
    scripts/diagnostics/android-r3-admission.sh \
    scripts/diagnostics/ap02-native-device-v7.mjs \
    scripts/diagnostics/native-lab-readiness.mjs \
    scripts/diagnostics/native-lab-runtime.test.mjs \
    src/components/SecureRegistroRoot.tsx \
    src/components/VaultGate.tsx \
    src/security/gateActionDiagnostic.ts
fi
