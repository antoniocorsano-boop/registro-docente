"""Validate the release inventory and bind it to the APK and packaging manifesto."""

import hashlib
import json
import os
from pathlib import Path
import re
import sys
import zipfile


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(file):
    with file.open("rb") as stream:
        sha = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            sha.update(block)
        return sha.hexdigest()


def sha256(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{64}", value)


def field(row, key):
    value = row[key]
    require(isinstance(value, str) and value.strip(), f"missing {key}")
    return value


def unique_rows(rows, key):
    result = {}
    for row in rows:
        value = field(row, key)
        require(value not in result, f"duplicate {key}: {value}")
        result[value] = row
    return result


def properties(text):
    result = {}
    for line in text.splitlines():
        if "=" in line:
            key, value = line.split("=", 1)
            require(key not in result, f"duplicate manifest key: {key}")
            result[key] = value
    return result


def reconcile(apk, components, artifact_ids):
    modules = {
        (c["group"], c["module"]): c for c in components.values()
        if c["kind"] == "module" and c["id"] in artifact_ids
    }
    names = sorted(name for name in apk.namelist()
                   if re.fullmatch(r"META-INF/[^/]+\.version", name))
    require(names and len(names) == len(set(names)), "APK markers missing or duplicated")
    results = []
    for name in names:
        stem = name.removeprefix("META-INF/").removesuffix(".version")
        group, separator, module = stem.partition("_")
        require(separator and module, f"invalid marker name: {name}")
        if stem == "kotlinx_coroutines_core":
            coordinates = [("org.jetbrains.kotlinx", "kotlinx-coroutines-core-jvm"),
                           ("org.jetbrains.kotlinx", "kotlinx-coroutines-core")]
        elif stem == "kotlinx_coroutines_android":
            coordinates = [("org.jetbrains.kotlinx", "kotlinx-coroutines-android")]
        else:
            coordinates = [(group, module)]
            if group.startswith("androidx."):
                coordinates.append((group, module + "-android"))
        candidates = [modules[key] for key in coordinates if key in modules]
        require(candidates, f"no artifact-backed component for marker: {name}")
        require(len({c["version"] for c in candidates}) == 1,
                f"conflicting artifact-backed components for marker: {name}")
        component = candidates[0]
        with apk.open(name) as stream:
            raw = stream.read(1025)
        require(len(raw) <= 1024, f"oversized marker: {name}")
        observed = raw.decode("utf-8").strip()
        version = component["version"]
        placeholder = re.fullmatch(r"task '(:[\w.:-]+):writeVersionFile' property 'version'", observed)
        if placeholder:
            project_path = ":".join([group.removeprefix("androidx.").replace(".", ":"), module])
            require(group.startswith("androidx.") and placeholder[1] == ":" + project_path,
                    f"unrecognized marker placeholder: {name}")
        else:
            require(observed == version, f"marker version conflict: {name} ({observed!r} vs {version})")
        results.append({"marker": name, "observed": observed, "component": component["id"],
                        "version": version, "method": "resolved_placeholder" if placeholder else "exact_version"})
    return results


def verify(raw_path, apk_path, manifest_path, output, readable):
    require(raw_path.is_file(), "report missing")
    try:
        report = json.loads(raw_path.read_text())
    except (ValueError, UnicodeError) as exc:
        raise ValueError("report invalid") from exc
    require(report["schema"] == 1 and report["configuration"] == ":app:releaseRuntimeClasspath",
            "unexpected inventory configuration")
    source = os.environ["SOURCE_SHA"]
    require(re.fullmatch(r"[0-9a-f]{40}", source) and report["source_sha"] == source,
            "source SHA mismatch")
    build = {key: os.environ[env] for key, env in
             [("run_id", "GITHUB_RUN_ID"), ("run_attempt", "GITHUB_RUN_ATTEMPT"), ("job", "GITHUB_JOB")]}
    require(all(build.values()) and report["build"] == build, "build identity mismatch")
    apk_hash = digest(apk_path)
    require(report["apk_sha256"] == apk_hash, "APK SHA-256 mismatch")
    manifest_text = manifest_path.read_text()
    manifest = properties(manifest_text)
    require(manifest["source_sha"] == manifest["visible_build_source_sha"] == source,
            "manifest source SHA mismatch")
    require(manifest["apk_sha256"] == apk_hash, "manifest APK SHA-256 mismatch")
    require(not any(key.startswith("native_inventory_") for key in manifest),
            "manifest already contains inventory status")

    require(report["unresolved"] == [], "unresolved runtime dependencies")
    components = unique_rows(report["components"], "id")
    root = report["root"]
    require(root in components and components[root]["kind"] == "project" and
            components[root]["path"] == ":app", "release graph root missing")
    coordinates = set()
    for c in components.values():
        require(isinstance(c["categories"], list) and
                all(isinstance(cat, str) and cat for cat in c["categories"]), "invalid variant categories")
        if c["kind"] == "module":
            key = (field(c, "group"), field(c, "module"))
            field(c, "version")
            require(key not in coordinates, f"multiple versions for {key}")
            coordinates.add(key)
        else:
            require(c["kind"] == "project", "unknown component kind")
            field(c, "path")

    connections = {key: set() for key in components}
    for e in report["edges"]:
        require(e["from"] in components and e["selected"] in components and
                isinstance(e["constraint"], bool), "invalid dependency edge")
        field(e, "requested")
        connections[e["from"]].add(e["selected"])
    seen, pending = set(), [root]
    while pending:
        current = pending.pop()
        if current not in seen:
            seen.add(current)
            pending.extend(connections[current] - seen)
    require(len(seen) > 1 and seen == components.keys(), "empty or disconnected runtime graph")

    artifact_ids = set()
    require(report["artifacts"], "runtime artifacts missing")
    for artifact in report["artifacts"]:
        component = field(artifact, "component")
        field(artifact, "file")
        field(artifact, "variant")
        require(component in components, "artifact component missing from graph")
        representation = field(artifact, "representation")
        if components[component]["kind"] == "project":
            require(representation == "project-runtime-jar" and artifact["file"].endswith(".jar") and
                    artifact["attributes"].get("artifactType") == "jar",
                    f"invalid local project runtime JAR: {component}")
        else:
            require(representation == "published-variant", f"invalid published artifact: {component}")
        require(sha256(artifact["sha256"]) and type(artifact["size"]) is int and
                artifact["size"] > 0, "artifact digest or size unavailable")
        artifact_ids.add(component)
    for c in components.values():
        if c["id"] != root and c["id"] not in artifact_ids:
            require(c["kind"] == "module" and c["categories"] and
                    set(c["categories"]) <= {"platform", "enforced-platform"},
                    f"artifact evidence missing for {c['id']}")

    inputs = unique_rows(report["inputs"], "file")
    required_inputs = {
        "app/build.gradle", "settings.gradle", "build.gradle", "variables.gradle",
        "gradle.properties", "gradle/wrapper/gradle-wrapper.properties",
        "app/capacitor.build.gradle", "capacitor.settings.gradle",
        "../package.json", "../beta-identity.json", "../native-inventory.init.gradle",
        "../verify-native-inventory.py", "../../../bun.lock",
    }
    require(required_inputs <= inputs.keys() and all(sha256(v["sha256"]) for v in inputs.values()),
            "build input digest missing")
    for name in ("java", "gradle", "agp", "compile_sdk", "build_tools",
                 "capacitor_android", "capacitor_core", "capacitor_cli"):
        field(report["toolchain"], name)
    with zipfile.ZipFile(apk_path) as apk:
        name = "META-INF/com/android/build/gradle/app-metadata.properties"
        require(apk.namelist().count(name) == 1, "APK AGP metadata missing or duplicated")
        agp = properties(apk.read(name).decode("utf-8"))
        require(agp["androidGradlePluginVersion"] == report["toolchain"]["agp"], "APK AGP version mismatch")
        report["markers"] = reconcile(apk, components, artifact_ids)

    report["status"] = "complete"
    report["coverage"] = {
        "runtime": ("One resolved releaseRuntimeClasspath; original selected published variant files and "
                    "AGP/Gradle-produced full runtime JARs for local projects from the release invocation"),
        "build": "Toolchain and selected input digests; build plugin transitive graph outside scope",
        "optional": "Selected dependencies only; unselected variants and npm probe transitives outside scope",
        "apk": "Marker-to-graph reconciliation; no assertion that every class survives packaging",
    }
    output.write_text(json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n")
    lines = ["Native inventory complete for releaseRuntimeClasspath",
             f"Source SHA: {source}", f"APK SHA-256: {apk_hash}", f"Build: {build}",
             f"Components: {len(components)}; edges: {len(report['edges'])}; artifacts: {len(report['artifacts'])}",
             "", "Components:"]
    lines.extend(f"- {c['id']} ({c['kind']})" for c in report["components"])
    lines.extend(["", "APK markers:"])
    lines.extend(f"- {m['marker']}: {m['component']} ({m['method']})" for m in report["markers"])
    lines.extend(["", "Coverage:", *(f"- {k}: {v}" for k, v in report["coverage"].items())])
    readable.write_text("\n".join(lines) + "\n")
    manifest_update = manifest_path.with_suffix(".inventory.tmp")
    manifest_update.write_text(manifest_text.rstrip("\n") + "\n"
                               "native_inventory_status=complete\n"
                               f"native_inventory_sha256={digest(output)}\n"
                               f"native_inventory_text_sha256={digest(readable)}\n")
    manifest_update.replace(manifest_path)


if __name__ == "__main__":
    raw, apk, manifest, report, text = map(Path, sys.argv[1:])
    try:
        report.unlink(missing_ok=True)
        text.unlink(missing_ok=True)
        verify(raw, apk, manifest, report, text)
    except (ValueError, KeyError, TypeError, AttributeError, OSError, RuntimeError, zipfile.BadZipFile) as error:
        report.unlink(missing_ok=True)
        text.unlink(missing_ok=True)
        print(f"Native inventory incomplete: {error}", file=sys.stderr)
        raise SystemExit(1)
