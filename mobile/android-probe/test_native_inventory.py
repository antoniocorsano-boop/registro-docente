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
                           "sha256": "b" * 64, "variant": "release",
                           "representation": "published-variant"}],
            "inputs": [{"file": name, "sha256": "c" * 64} for name in
                       ["app/build.gradle", "settings.gradle", "build.gradle", "variables.gradle",
                        "gradle.properties", "gradle/wrapper/gradle-wrapper.properties",
                        "app/capacitor.build.gradle", "capacitor.settings.gradle", "../package.json",
                        "../beta-identity.json", "../native-inventory.init.gradle",
                        "../verify-native-inventory.py", "../../../bun.lock"]],
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
        self.report["artifacts"][0].update(file="runtime.jar", representation="project-runtime-jar",
                                           attributes={"artifactType": "jar"})
        self.run_gate(self.report, diagnostic="no artifact-backed component")

    def test_invalid_placeholder_path(self):
        self.make_apk([(self.marker, "task ':foreign:library:writeVersionFile' property 'version'")])
        self.report["apk_sha256"] = self.apk_hash()
        self.run_gate(self.report, diagnostic="unrecognized marker placeholder")

    def test_agp_version_mismatch(self):
        self.report["toolchain"]["agp"] = "8.12.0"
        self.run_gate(self.report, diagnostic="APK AGP version mismatch")

    def test_unattested_agp_input(self):
        self.report["inputs"] = [entry for entry in self.report["inputs"] if entry["file"] != "build.gradle"]
        self.run_gate(self.report, diagnostic="build input digest missing")

    def test_missing_representation(self):
        self.report["artifacts"][0].pop("representation")
        self.run_gate(self.report, diagnostic="'representation'")

    def test_valid_placeholder_and_manifest_are_bound_to_graph(self):
        self.run_gate(copy.deepcopy(self.report))
        report = json.loads(self.output.read_text())
        self.assertEqual(report["status"], "complete")
        self.assertEqual(report["markers"][0]["version"], "2.6.2")
        self.assertEqual(report["markers"][0]["component"], self.component_id)
        self.assertIn(f"native_inventory_sha256={hashlib.sha256(self.output.read_bytes()).hexdigest()}",
                      self.manifest.read_text())
        self.assertIn(self.component_id, self.readable.read_text())

    def with_external_variant(self):
        owner = self.component_id
        alias = "fixtures:relocated:1.0"
        variant = "jvmRuntime"
        self.report["components"][1]["selected_variants"] = [variant]
        self.report["artifacts"][0]["variant"] = f"{owner} variant {variant}"
        self.report["components"].append({
            "id": alias, "kind": "module", "group": "fixtures", "module": "relocated",
            "version": "1.0", "categories": ["library"], "selected_variants": [variant],
        })
        original = self.report["edges"][0]
        original.update(requested=alias, selected=alias, selected_variant=variant)
        self.report["edges"].append({
            "from": alias, "requested": owner, "selected": owner, "selected_variant": variant, "constraint": False,
        })
        self.report["artifact_delegations"] = [{
            "from": alias, "variant": variant, "to": owner, "target_variant": variant,
        }]
        return alias

    def test_external_variant_covers_wrapper_without_fabricating_an_artifact(self):
        alias = self.with_external_variant()
        self.run_gate(self.report)
        verified = json.loads(self.output.read_text())
        self.assertEqual([row["component"] for row in verified["artifacts"]], [self.component_id])
        self.assertEqual(verified["artifact_delegations"][0]["from"], alias)

    def test_ordinary_dependency_does_not_cover_absent_artifact(self):
        self.with_external_variant()
        del self.report["artifact_delegations"]
        self.run_gate(self.report, diagnostic="artifact evidence missing")

    def test_external_variant_only_covers_its_own_selected_variant(self):
        alias = self.with_external_variant()
        component = next(row for row in self.report["components"] if row["id"] == alias)
        component["selected_variants"].append("unbackedRuntime")
        self.run_gate(self.report, diagnostic="artifact evidence missing")

    def test_external_variant_rejects_circular_chains(self):
        alias = self.with_external_variant()
        variant = "jvmRuntime"
        self.report["edges"].append({
            "from": self.component_id, "requested": alias, "selected": alias,
            "selected_variant": variant, "constraint": False,
        })
        self.report["artifact_delegations"].append({
            "from": self.component_id, "variant": variant, "to": alias, "target_variant": variant,
        })
        self.run_gate(self.report, diagnostic="circular external variant")

    def test_external_variant_requires_selected_target_and_its_artifact(self):
        self.with_external_variant()
        self.report["artifacts"][0]["variant"] = "different variant"
        self.run_gate(self.report, diagnostic="external variant has no artifact evidence")

    def test_external_variant_cannot_substitute_an_unrelated_graph_edge(self):
        self.with_external_variant()
        self.report["edges"][1]["selected_variant"] = "different variant"
        self.run_gate(self.report, diagnostic="external variant edge missing")

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


@unittest.skipUnless(os.getenv("NATIVE_INVENTORY_GRADLE"), "set NATIVE_INVENTORY_GRADLE to run the offline Gradle fixture")
class GradleArtifactSelectionTest(unittest.TestCase):
    def test_selected_release_artifact_files(self):
        """Real Gradle variant matching on an offline JVM model, not an AGP build."""
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            probe = root / "mobile/android-probe"
            android = probe / "android"
            source = Path(__file__).resolve().parent

            def put(path, text):
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(text)

            def archive(path, entry, data):
                path.parent.mkdir(parents=True, exist_ok=True)
                with zipfile.ZipFile(path, "w") as result:
                    result.writestr(entry, data)

            for name in ("native-inventory.init.gradle", "verify-native-inventory.py"):
                put(probe / name, (source / name).read_text())
            for name in ("package.json", "beta-identity.json"):
                put(probe / name, "{}")
            for name in ("android", "core", "cli"):
                put(probe / f"node_modules/@capacitor/{name}/package.json", '{"version":"8.6.0"}')
            put(root / "bun.lock", "{}")
            for name in ("variables.gradle", "gradle.properties", "gradle/wrapper/gradle-wrapper.properties",
                         "app/capacitor.build.gradle", "capacitor.settings.gradle"):
                put(android / name, "")
            put(android / "settings.gradle", """
rootProject.name = 'inventory-fixture'
include ':app', ':capacitor-android', ':capacitor-cordova-android-plugins'
""")
            put(android / "build.gradle", """
subprojects {
    repositories {
        maven {
            url = rootProject.file('repo')
            metadataSources { gradleMetadata(); mavenPom() }
        }
    }
}
""")
            module_files = {}
            for name, extension in (("runtime-aar", "aar"), ("runtime-jar", "jar"), ("multiplatform", "jar"), ("bom", "pom")):
                repo = android / f"repo/fixtures/{name}/1.0"
                put(repo / f"{name}-1.0.pom",
                    f"<project><modelVersion>4.0.0</modelVersion><groupId>fixtures</groupId>"
                    f"<artifactId>{name}</artifactId><version>1.0</version><packaging>{extension}</packaging></project>")
                if extension != "pom":
                    file = repo / f"{name}-1.0.{extension}"
                    archive(file, "synthetic.txt", name)
                    module_files[name] = file
            bom = android / "repo/fixtures/bom/1.0"
            put(bom / "bom-1.0.module", json.dumps({
                "formatVersion": "1.1", "component": {"group": "fixtures", "module": "bom", "version": "1.0"},
                "variants": [{"name": "runtimePlatform", "attributes": {
                    "org.gradle.category": "platform", "org.gradle.usage": "java-runtime",
                }}],
            }))
            repo = module_files["multiplatform"].parent
            module_files["multiplatform"] = repo / "multiplatform-1.0-jvm.jar"
            archive(module_files["multiplatform"], "runtime.txt", "jvm-runtime")
            archive(repo / "multiplatform-1.0-common.jar", "common.txt", "non-runtime")
            common = {"name": "commonMetadata", "attributes": {"org.gradle.usage": "kotlin-metadata"},
                      "files": [{"name": "multiplatform-1.0-common.jar", "url": "multiplatform-1.0-common.jar"}]}
            jvm = {"name": "jvmRuntime", "attributes": {"org.gradle.usage": "java-runtime"},
                   "files": [{"name": "multiplatform-1.0-jvm.jar", "url": "multiplatform-1.0-jvm.jar"}]}
            put(repo / "multiplatform-1.0.module", json.dumps({
                "formatVersion": "1.1", "component": {"group": "fixtures", "module": "multiplatform", "version": "1.0"},
                "variants": [common, jvm],
            }))
            for name in ("relocated", "second-wrapper"):
                alias = android / f"repo/fixtures/{name}/1.0/{name}-1.0.module"
                put(alias, json.dumps({
                    "formatVersion": "1.1", "component": {"group": "fixtures", "module": name, "version": "1.0"},
                    "variants": [{"name": "jvmRuntime", "attributes": {"org.gradle.usage": "java-runtime"},
                                  "available-at": {"url": "../../multiplatform/1.0/multiplatform-1.0.module",
                                                   "group": "fixtures", "module": "multiplatform", "version": "1.0"}}],
                }))
            local_paths = [":capacitor-android", ":capacitor-cordova-android-plugins"]
            for path in local_paths:
                put(android / path[1:] / "build.gradle", """
def runtime = configurations.create('runtimeElements') {
    canBeResolved = false
    attributes { attribute(Usage.USAGE_ATTRIBUTE, objects.named(Usage, Usage.JAVA_RUNTIME)) }
}
['jar', 'aar'].each { type ->
    def output = layout.buildDirectory.file("runtime-${project.name}.${type}")
    def producer = tasks.register("produce${type.capitalize()}") {
        outputs.file(output)
        doLast {
            def file = output.get().asFile
            file.parentFile.mkdirs()
            file.text = "${project.name}:${type}"
        }
    }
    runtime.outgoing.variants.create(type) {
        artifact(output) { setType(type); builtBy(producer) }
    }
}
""")
            put(android / "app/build.gradle", """
def runtime = configurations.create('releaseRuntimeClasspath') {
    canBeConsumed = false
    attributes { attribute(Usage.USAGE_ATTRIBUTE, objects.named(Usage, Usage.JAVA_RUNTIME)) }
}
dependencies {
    releaseRuntimeClasspath project(':capacitor-android')
    releaseRuntimeClasspath project(':capacitor-cordova-android-plugins')
    releaseRuntimeClasspath 'fixtures:runtime-aar:1.0'
    releaseRuntimeClasspath 'fixtures:runtime-jar:1.0'
    releaseRuntimeClasspath 'fixtures:relocated:1.0'
    releaseRuntimeClasspath 'fixtures:second-wrapper:1.0'
    releaseRuntimeClasspath platform('fixtures:bom:1.0')
}
extensions.add('android', new Expando(compileSdk: 36, buildToolsVersion: '36.0.0'))
extensions.add('androidComponents', new Expando(pluginVersion: new Expando(major: 8, minor: 13, micro: 0)))
tasks.register('assembleRelease')
""")
            apk = android / "app/build/outputs/apk/release/app-release-unsigned.apk"
            archive(apk, "META-INF/fixtures_runtime-aar.version", "1.0")
            with zipfile.ZipFile(apk, "a") as packaged:
                packaged.writestr("META-INF/com/android/build/gradle/app-metadata.properties",
                                  "androidGradlePluginVersion=8.13.0\n")
            result = subprocess.run(
                [os.environ["NATIVE_INVENTORY_GRADLE"], "--offline", "--no-daemon", "--console=plain",
                 "--init-script", str(probe / "native-inventory.init.gradle"), ":app:captureReleaseNativeInventory"],
                cwd=android, env=ENV, capture_output=True, text=True, timeout=150,
            )
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            raw = probe / "native-inventory-raw.json"
            report = json.loads(raw.read_text())
            rows = {row["component"]: row for row in report["artifacts"]}
            self.assertEqual(len(rows), len(report["artifacts"]))
            for name, file in module_files.items():
                row = rows[f"fixtures:{name}:1.0"]
                self.assertEqual(row["representation"], "published-variant")
                self.assertEqual(row["file"], file.name)
                self.assertEqual(row["sha256"], hashlib.sha256(file.read_bytes()).hexdigest())
            for path in local_paths:
                row = rows[f"project {path}"]
                expected = f"{path[1:]}:jar".encode()
                self.assertEqual(row["representation"], "project-runtime-jar")
                self.assertEqual(row["file"], f"runtime-{path[1:]}.jar")
                self.assertEqual(row["sha256"], hashlib.sha256(expected).hexdigest())
            self.assertNotIn("fixtures:bom:1.0", rows)
            components = {row["id"]: row for row in report["components"]}
            self.assertEqual(components["fixtures:bom:1.0"]["categories"], ["platform"])

            manifest = probe / "manifest.txt"
            manifest.write_text(f"source_sha={SOURCE}\nvisible_build_source_sha={SOURCE}\n"
                                f"apk_sha256={hashlib.sha256(apk.read_bytes()).hexdigest()}\n")
            verified = subprocess.run([sys.executable, str(probe / "verify-native-inventory.py"), str(raw),
                                       str(apk), str(manifest), str(probe / "inventory.json"),
                                       str(probe / "inventory.txt")], env=ENV, text=True, capture_output=True)
            self.assertEqual(verified.returncode, 0, verified.stderr)
            self.assertIn("native_inventory_status=complete", manifest.read_text())
            self.assertEqual({(entry["from"], entry["to"]) for entry in report["artifact_delegations"]}, {
                ("fixtures:relocated:1.0", "fixtures:multiplatform:1.0"),
                ("fixtures:second-wrapper:1.0", "fixtures:multiplatform:1.0"),
            })


class BuildContractTest(unittest.TestCase):
    def setUp(self):
        from importlib import import_module
        import shutil

        self.contract = import_module("build-contract")
        self.inventory = import_module("verify-build-inventory")
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.probe = Path(directory.name)
        for name in ("package.json", "package-lock.json"):
            shutil.copyfile(Path(__file__).with_name(name), self.probe / name)

    def test_lock_missing_and_incoherent(self):
        lock = self.probe / "package-lock.json"
        self.contract.check_lock(self.probe)
        value = json.loads(lock.read_text())
        value["packages"]["node_modules/@capacitor/cli"]["version"] = "8.6.1"
        lock.write_text(json.dumps(value))
        with self.assertRaisesRegex(ValueError, "direct version"):
            self.contract.check_lock(self.probe)
        lock.unlink()
        with self.assertRaises(FileNotFoundError):
            self.contract.check_lock(self.probe)

    def test_wrapper_version_checksum_binary_and_duplicate(self):
        import shutil

        android = self.probe / "android"
        for name, path in self.contract.wrapper_paths(android).items():
            path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(self.contract.ROOT / "gradle-8.14.8" / name, path)
        pins = android / "gradle/wrapper/gradle-wrapper.properties"
        valid = (f"distributionUrl={self.contract.URL}\nvalidateDistributionUrl=true\n"
                 f"distributionSha256Sum={self.contract.DISTRIBUTION_SHA}\n")
        pins.write_text(valid)
        self.contract.check_wrapper(android)
        for bad, message in [
            (valid.replace(self.contract.URL, self.contract.TEMPLATE_URL), "URL/version"),
            (valid.replace(self.contract.DISTRIBUTION_SHA, "0" * 64), "distribution checksum"),
            (valid.split("distributionSha256Sum")[0], "distribution checksum"),
            (valid + "distributionUrl=unexpected\n", "duplicate wrapper property"),
        ]:
            pins.write_text(bad)
            with self.assertRaisesRegex(ValueError, message):
                self.contract.check_wrapper(android)
        pins.write_text(valid)
        self.contract.wrapper_paths(android)["gradle-wrapper.jar"].write_bytes(b"invalid")
        with self.assertRaisesRegex(ValueError, "wrapper checksum"):
            self.contract.check_wrapper(android)

    def test_npm_graph_missing_or_discordant(self):
        lock = self.contract.read_json(self.probe / "package-lock.json")
        with self.assertRaisesRegex(ValueError, "Incomplete npm"):
            self.inventory.npm_graph({}, lock)
        with self.assertRaisesRegex(ValueError, "absent from lock"):
            self.inventory.npm_graph({"dependencies": {"@capacitor/core": {"version": "0.0.0"}}}, lock)

    def test_build_inventory_rejects_wrong_source_and_apk(self):
        lock = self.contract.read_json(self.probe / "package-lock.json")
        apk = self.probe / "synthetic.apk"
        apk.write_bytes(b"synthetic")
        runtime = {"source_sha": SOURCE, "apk_sha256": self.contract.digest(apk)}
        gradle = {"source_sha": "b" * 40, "apk_sha256": runtime["apk_sha256"]}
        with self.assertRaisesRegex(ValueError, "source mismatch"):
            self.inventory.verify(runtime, gradle, apk, {}, lock)
        gradle.update(source_sha=SOURCE, apk_sha256="0" * 64)
        with self.assertRaisesRegex(ValueError, "APK mismatch"):
            self.inventory.verify(runtime, gradle, apk, {}, lock)
        gradle.update(apk_sha256=runtime["apk_sha256"], gradle="8.14.8", classpaths=[])
        runtime["toolchain"] = {"gradle": "8.14.8", "agp": "8.13.0"}
        with self.assertRaisesRegex(ValueError, "Missing root Gradle"):
            self.inventory.verify(runtime, gradle, apk, {}, lock)


class BuildProbeContracts(unittest.TestCase):
    def test_agp_requires_root_artifact_digest(self):
        from importlib import import_module

        verifier = import_module("verify-build-inventory")
        coordinate = "com.android.tools.build:gradle:8.13.0"
        with tempfile.TemporaryDirectory() as directory:
            apk = Path(directory) / "synthetic.apk"
            apk.write_bytes(b"synthetic")
            receipt = {"source_sha": SOURCE, "apk_sha256": verifier.contract.digest(apk)}
            runtime = {**receipt, "toolchain": {"agp": "8.13.0", "gradle": "8.14.8"}}
            artifact = {"component": "sample:other:1", "sha256": "a" * 64}
            classpath = {"project": ":", "configuration": "buildscript:classpath",
                         "edges": [{"selected": coordinate}], "artifacts": [artifact]}
            gradle = {**receipt, "gradle": "8.14.8", "classpaths": [classpath]}
            tree = {"dependencies": {"sample": {"version": "1"}}}
            lock = {"packages": {"node_modules/sample": {"version": "1"}}}
            with self.assertRaisesRegex(ValueError, "Missing AGP artifact digest"):
                verifier.verify(runtime, gradle, apk, tree, lock)
            artifact["component"] = coordinate
            evidence = verifier.verify(runtime, gradle, apk, tree, lock)
            self.assertEqual(evidence["gradle_classpaths"], [classpath])

    def test_probe_install_overrides_inherited_npm_dry_run(self):
        from importlib import import_module

        contract = import_module("build-contract")
        with tempfile.TemporaryDirectory() as directory:
            npm = Path(directory) / "npm"
            npm.write_text(
                "#!/bin/sh\n"
                f'if [ "$1" = --version ]; then echo {contract.NPM_VERSION}; exit; fi\n'
                'test "$npm_config_dry_run" = true && test "$*" = "ci --dry-run=false"\n'
            )
            npm.chmod(0o755)
            env = dict(os.environ, PATH=f"{directory}:{os.environ['PATH']}", npm_config_dry_run="true")
            subprocess.run(["bash", str(Path(__file__).with_name("probe-npm.sh")), "install"],
                           env=env, check=True, timeout=10)


if __name__ == "__main__":
    unittest.main()
