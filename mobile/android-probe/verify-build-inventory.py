"""Bind the build and npm evidence to the existing Android inventory receipt."""
import json
import re
import subprocess
import sys
from pathlib import Path

from importlib import import_module

contract = import_module('build-contract')
ROOT = Path(__file__).resolve().parent
SHA = re.compile(r'[0-9a-f]{64}')


def require(condition, message):
    if not condition:
        raise ValueError(message)


def npm_graph(tree, lock):
    selected = {(name.rsplit('node_modules/', 1)[-1], pkg['version'])
                for name, pkg in lock['packages'].items() if name}
    edges = set()
    installed = set()

    def visit(node, parent):
        require(not node.get('problems'), 'npm reported graph problems')
        for name, child in node.get('dependencies', {}).items():
            version = child.get('version')
            require((name, version) in selected, f'npm graph coordinate absent from lock: {name}')
            installed.add((name, version))
            coordinate = f'{name}@{version}'
            edges.add((parent, coordinate))
            visit(child, coordinate)

    visit(tree, '<probe>')
    require(edges and installed == selected, 'Incomplete npm installed graph')
    return [{'from': parent, 'selected': selected} for parent, selected in sorted(edges)]


def verify(runtime, gradle, apk, tree, lock):
    contract.check_lock(ROOT)
    require(re.fullmatch(r'[0-9a-f]{40}', runtime['source_sha']) and
            runtime['source_sha'] == gradle['source_sha'], 'Build inventory source mismatch')
    require(runtime['apk_sha256'] == gradle['apk_sha256'] == contract.digest(apk),
            'Build inventory APK mismatch')
    require(gradle['gradle'] == runtime['toolchain']['gradle'] == '8.14.8', 'Unexpected Gradle in build evidence')
    classpaths = gradle.get('classpaths')
    require(isinstance(classpaths, list) and any(row['project'] == ':' for row in classpaths),
            'Missing root Gradle buildscript classpath')
    agp = runtime['toolchain']['agp']
    require(any(edge['selected'] == f'com.android.tools.build:gradle:{agp}'
                for row in classpaths if row['project'] == ':' for edge in row['edges']),
            'Missing AGP from root buildscript classpath')
    for row in classpaths:
        require(row['configuration'] == 'buildscript:classpath' and row['edges'] and row['artifacts'],
                'Incomplete classpath evidence')
        require(all(SHA.fullmatch(artifact['sha256']) for artifact in row['artifacts']),
                'Invalid classpath artifact SHA-256')
    graph = npm_graph(tree, lock)
    return {
        'schema': 1, 'source_sha': runtime['source_sha'], 'apk_sha256': runtime['apk_sha256'],
        'scope': 'Project buildscript classpaths and installed npm probe graph. Excludes Gradle internals, SDK internals and APK class reachability.',
        'toolchain': {**runtime['toolchain'], 'node': subprocess.check_output(['node', '--version'], text=True).strip(),
                      'npm': contract.NPM_VERSION},
        'inputs': {'npm_lock_sha256': contract.digest(ROOT / 'package-lock.json'),
                   'gradle_metadata_sha256': contract.digest(ROOT / 'verification-metadata.xml'),
                   'gradle_distribution_sha256': contract.DISTRIBUTION_SHA,
                   'wrapper_sha256': contract.WRAPPER},
        'gradle_classpaths': classpaths, 'npm_edges': graph,
    }


if __name__ == '__main__':
    runtime, gradle, apk, tree, output = map(Path, sys.argv[1:])
    report = verify(contract.read_json(runtime), contract.read_json(gradle), apk,
                    contract.read_json(tree), contract.read_json(ROOT / 'package-lock.json'))
    output.write_text(json.dumps(report, indent=2, sort_keys=True) + '\n')
