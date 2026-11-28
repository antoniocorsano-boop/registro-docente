"""Validate the isolated Android probe before any Gradle invocation."""
import argparse
import base64
import hashlib
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree

ROOT = Path(__file__).resolve().parent
NPM_VERSION = '10.9.9'
URL = r'https\://services.gradle.org/distributions/gradle-8.14.8-bin.zip'
TEMPLATE_URL = r'https\://services.gradle.org/distributions/gradle-8.14.3-all.zip'
DISTRIBUTION_SHA = '94da89692fc3ca6d2d0ce6bb48548762ea0f1897ba444286f5c7f3759c7af651'
WRAPPER = {
    'gradlew': 'b187b4c52e749f5760afdd6fadc31b2a98ad35fb249bf0dff03b72650f320409',
    'gradlew.bat': '1d297e00bd21de3ace22b4d7f2de1f9dfa858883d66bbf7c1ccbecccec8f4f3b',
    'gradle-wrapper.jar': 'ad16bca46cb71bb5887c546860d93992aeee35c1fdaf4a242b0a612375d937e0',
}
TEMPLATE_JAR = '7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172'


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    sha = hashlib.sha256()
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(65536), b''):
            sha.update(chunk)
    return sha.hexdigest()


def unique_object(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, f'duplicate JSON field: {key}')
        result[key] = value
    return result


def read_json(path):
    return json.loads(path.read_text(), object_pairs_hook=unique_object)


def check_lock(probe):
    manifest = read_json(probe / 'package.json')
    lock = read_json(probe / 'package-lock.json')
    root = lock['packages']['']
    require(lock['lockfileVersion'] == 3, 'npm lockfile format must be 3')
    for key in ('name', 'version', 'dependencies', 'devDependencies'):
        require(manifest[key] == root[key], f'npm lockfile mismatch: {key}')
    expected = {**manifest['dependencies'], **manifest['devDependencies']}
    for name, version in expected.items():
        require(lock['packages'][f'node_modules/{name}']['version'] == version,
                f'npm direct version mismatch: {name}')
    for name, package in lock['packages'].items():
        if not name:
            continue
        url = urlsplit(package['resolved'])
        require(name.startswith('node_modules/') and not package.get('link')
                and url.scheme == 'https' and url.netloc == 'registry.npmjs.org'
                and url.path.endswith('.tgz') and not (url.query or url.fragment),
                f'unexpected npm source: {name}')
        integrity = package['integrity']
        require(integrity.startswith('sha512-')
                and len(base64.b64decode(integrity[7:], validate=True)) == 64,
                f'invalid npm integrity: {name}')


def properties(path):
    values = {}
    for line in path.read_text(encoding='ascii').splitlines():
        if not line.strip() or line.lstrip().startswith(('#', '!')):
            continue
        match = re.fullmatch(r'([A-Za-z][A-Za-z0-9]*)=([!-~]+)', line)
        require(match and not line.endswith('\\'), 'ambiguous wrapper property syntax')
        key, value = match.groups()
        require(key not in values, f'duplicate wrapper property: {key}')
        values[key] = value
    return values


def wrapper_paths(android):
    return {name: android / ('gradle/wrapper' if name.endswith('.jar') else '') / name
            for name in WRAPPER}


def check_wrapper(android):
    pins = properties(android / 'gradle/wrapper/gradle-wrapper.properties')
    require(pins.get('distributionUrl') == URL, 'Gradle distribution URL/version mismatch')
    require(pins.get('distributionSha256Sum') == DISTRIBUTION_SHA, 'Gradle distribution checksum mismatch')
    require(pins.get('validateDistributionUrl') == 'true', 'Gradle URL validation required')
    for name, path in wrapper_paths(android).items():
        require(digest(path) == WRAPPER[name], f'Gradle wrapper checksum mismatch: {name}')


def metadata():
    path = ROOT / 'verification-metadata.xml'
    tree = ElementTree.parse(path)
    ns = {'v': 'https://schema.gradle.org/dependency-verification'}
    configs = tree.findall('v:configuration', ns)
    require(len(configs) == 1, 'Missing or ambiguous Gradle verification configuration')
    flags = [(child.tag.rsplit('}', 1)[-1], child.text) for child in configs[0]]
    require(sorted(flags) == [('verify-metadata', 'true'), ('verify-signatures', 'false')],
            'Unexpected Gradle verification flags or trust override')
    components = tree.findall('v:components/v:component', ns)
    require(components and all(component.findall('v:artifact/v:sha256', ns) for component in components),
            'Missing Gradle verification hashes')
    for element in tree.findall('.//v:artifact', ns):
        hashes = list(element)
        require(len(hashes) == 1 and hashes[0].tag.endswith('}sha256') and
                re.fullmatch(r'[0-9a-f]{64}', hashes[0].get('value', '')) and not list(hashes[0]),
                'Ambiguous or incomplete Gradle artifact pin')
    return path


def prepare(probe):
    check_lock(probe)
    android = probe / 'android'
    path = android / 'gradle/wrapper/gradle-wrapper.properties'
    values = properties(path)
    require(values.get('distributionUrl') == TEMPLATE_URL
            and 'distributionSha256Sum' not in values
            and values.get('validateDistributionUrl') == 'true', 'unexpected Capacitor wrapper template')
    paths = wrapper_paths(android)
    for name, destination in paths.items():
        expected = TEMPLATE_JAR if name.endswith('.jar') else WRAPPER[name]
        require(digest(destination) == expected, f'unexpected Capacitor wrapper file: {name}')
        require(digest(ROOT / 'gradle-8.14.8' / name) == WRAPPER[name], f'untrusted replacement: {name}')
    verified_metadata = metadata()
    require(not (android / 'gradle/verification-metadata.xml').exists(), 'unexpected template verification metadata')
    shutil.copyfile(verified_metadata, android / 'gradle/verification-metadata.xml')
    for name, destination in paths.items():
        shutil.copyfile(ROOT / 'gradle-8.14.8' / name, destination)
    original = path.read_text(encoding='ascii')
    pinned = re.sub(r'^distributionUrl=.*$', lambda _: (
        f'distributionUrl={URL}\ndistributionSha256Sum={DISTRIBUTION_SHA}'),
        original, count=1, flags=re.MULTILINE)
    path.write_text(pinned, encoding='ascii')
    check_wrapper(android)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('lock', 'prepare', 'verify', 'npm-version'))
    parser.add_argument('--probe', type=Path, default=ROOT)
    parser.add_argument('--distribution', type=Path, help='Verify a local official bin ZIP before use')
    args = parser.parse_args()
    try:
        if args.distribution:
            require(digest(args.distribution) == DISTRIBUTION_SHA, 'Gradle ZIP checksum mismatch')
        if args.action == 'npm-version':
            print(NPM_VERSION)
        elif args.action == 'prepare':
            prepare(args.probe)
        else:
            check_lock(args.probe)
            if args.action == 'verify':
                check_wrapper(args.probe / 'android')
                require(digest(args.probe / 'android/gradle/verification-metadata.xml') == digest(metadata()),
                        'Gradle verification metadata mismatch')
    except (OSError, ValueError, KeyError, TypeError, ElementTree.ParseError) as error:
        parser.exit(1, f'Android build contract: {error}\n')
