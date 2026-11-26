import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

SOURCE = "a" * 40
RUN = {"run_id": "1", "run_attempt": "2", "job": "probe"}
ENV = dict(os.environ, SOURCE_SHA=SOURCE, GITHUB_RUN_ID="1", GITHUB_RUN_ATTEMPT="2", GITHUB_JOB="probe")


class NativeInventoryTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.apk = self.root / "app.apk"
        self.marker = "META-INF/androidx.lifecycle_lifecycle-runtime.version"
        self.make_apk([(self.marker, "task ':lifecycle:lifecycle-runtime:writeVersionFile' property 'version'")])
        self.manifest = self.root / "manifest.txt"
        self.raw = self.root / "raw.json"
        self.output = self.root / "native-inventory.json"
        self.readable = self.root / "native-inventory.txt"
        self.component_id = "androidx.lifecycle:lifecycle-runtime:2.6.2"
        self.report = {
            "schema": 1, "configuration": ":app:releaseRuntimeClasspath",
            "source_sha": SOURCE, "build": RUN, "apk_sha256": self.apk_hash(),
            "root": ":app",
            "components": [
                {"id": ":app", "kind": "project", "path": ":app", "categories": []},
                {"id": self.component_id, "kind": "module", "group": "androidx.lifecycle",
                 "module": "lifecycle-runtime", "version": "2.6.2", "categories": ["library"]},
            ],
            "edges": [{"from": ":app", "requested": "androidx.lifecycle:lifecycle-runtime:2.6.1",
                       "selected": self.component_id, "constraint": False}],
            "unresolved": [],
            "artifacts": [{"component": self.component_id, "file": "runtime.aar", "size": 10,
                           "sha256": "b" * 64, "variant": "release"}],
            "inputs": [{"file": name, "sha256": "c" * 64} for name in
                       ["app/build.gradle", "settings.gradle", "gradle/wrapper/gradle-wrapper.properties"]],
            "toolchain": dict(java="21", gradle="8.14.3", agp="8.13.0", compile_sdk="36",
                              build_tools="36.0.0", capacitor_android="8.6.0",
                              capacitor_core="8.6.0", capacitor_cli="8.6.0"),
        }

    def apk_hash(self):
        return hashlib.sha256(self.apk.read_bytes()).hexdigest()

    def make_apk(self, markers):
        with zipfile.ZipFile(self.apk, "w") as apk:
            apk.writestr("META-INF/com/android/build/gradle/app-metadata.properties",
                         "androidGradlePluginVersion=8.13.0\n")
            for name, value in markers:
                apk.writestr(name, value)

    def run_gate(self, report, *, diagnostic=None):
        self.manifest.write_text(f"source_sha={SOURCE}\nvisible_build_source_sha={SOURCE}\napk_sha256={self.apk_hash()}\n")
        if report is not None:
            self.raw.write_text(json.dumps(report) if report != "" else "")
        result = subprocess.run(
            [sys.executable, str(Path(__file__).with_name("verify-native-inventory.py")),
             str(self.raw), str(self.apk), str(self.manifest), str(self.output), str(self.readable)],
            env=ENV, text=True, capture_output=True,
        )
        if diagnostic:
            self.assertNotEqual(result.returncode, 0)
            self.assertIn(diagnostic, result.stderr)
            self.assertFalse(self.output.exists())
            self.assertFalse(self.readable.exists())
        else:
            self.assertEqual(result.returncode, 0, result.stderr)
        return result

    def test_missing_report(self):
        self.run_gate(None, diagnostic="report missing")

    def test_empty_report(self):
        self.run_gate("", diagnostic="report invalid")

    def test_source_mismatch(self):
        self.report["source_sha"] = "b" * 40
        self.run_gate(self.report, diagnostic="source SHA")

    def test_apk_mismatch(self):
        self.report["apk_sha256"] = "d" * 64
        self.run_gate(self.report, diagnostic="APK SHA-256")

    def test_build_mismatch(self):
        self.report["build"] = dict(RUN, run_attempt="3")
        self.run_gate(self.report, diagnostic="build identity")

    def test_unresolved_dependency(self):
        self.report["unresolved"] = [{"requested": "example:missing:1"}]
        self.run_gate(self.report, diagnostic="unresolved")

    def test_unverifiable_artifact(self):
        self.report["artifacts"][0]["sha256"] = None
        self.run_gate(self.report, diagnostic="artifact digest")

    def test_marker_without_match(self):
        self.make_apk([("META-INF/unknown_library.version", "1.0")])
        self.report["apk_sha256"] = self.apk_hash()
        self.run_gate(self.report, diagnostic="no artifact-backed component")

    def test_marker_version_conflict(self):
        self.make_apk([(self.marker, "2.6.1")])
        self.report["apk_sha256"] = self.apk_hash()
        self.run_gate(self.report, diagnostic="marker version conflict")

    def test_local_project_is_recorded_but_cannot_claim_maven_marker(self):
        self.report["components"][1] = {"id": self.component_id, "kind": "project",
                                        "path": ":local", "categories": ["library"]}
        self.run_gate(self.report, diagnostic="no artifact-backed component")

    def test_valid_placeholder_and_manifest_are_bound_to_graph(self):
        self.run_gate(copy.deepcopy(self.report))
        report = json.loads(self.output.read_text())
        self.assertEqual(report["status"], "complete")
        self.assertEqual(report["markers"][0]["version"], "2.6.2")
        self.assertEqual(report["markers"][0]["component"], self.component_id)
        self.assertIn(f"native_inventory_sha256={hashlib.sha256(self.output.read_bytes()).hexdigest()}",
                      self.manifest.read_text())
        self.assertIn(self.component_id, self.readable.read_text())

    def test_coroutines_core_alias_resolves_jvm_artifact(self):
        self.make_apk([("META-INF/kotlinx_coroutines_core.version", "1.8.1")])
        self.report["apk_sha256"] = self.apk_hash()
        old_id = self.component_id
        self.component_id = "org.jetbrains.kotlinx:kotlinx-coroutines-core-jvm:1.8.1"
        self.report = json.loads(json.dumps(self.report).replace(old_id, self.component_id))
        self.report["components"][1].update(group="org.jetbrains.kotlinx",
                                             module="kotlinx-coroutines-core-jvm", version="1.8.1")
        self.run_gate(self.report)
        self.assertEqual(json.loads(self.output.read_text())["markers"][0]["component"], self.component_id)


if __name__ == "__main__":
    unittest.main()
