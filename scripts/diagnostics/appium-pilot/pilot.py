"""Q5-SYS-01: real Appium/UiAutomator2/ChromeDriver feasibility pilot.
Not F2 qualification; no application hooks, no synthetic PASS, no mutation replay.
"""
import json
import hashlib
import re
import tempfile
import os
import subprocess
import time
from pathlib import Path
from native_contracts import classify_activity, webview_attempt
from qualification_contracts import canonical_records

from appium import webdriver
from appium.common.exceptions import NoSuchContextException
from appium.options.android import UiAutomator2Options
from selenium.common.exceptions import StaleElementReferenceException, NoAlertPresentException, UnexpectedAlertPresentException
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

PKG = "it.trama.registrodocente.lab.ap02v7"
ACTIVITY = "it.trama.registrodocente.prova.MainActivity"
PASSWORD = "appium-local-synthetic-only-2026"
OUT = Path("ap02-device-evidence/appium-pilot.json")
evidence = dict(candidate=os.environ["CANDIDATE_SHA"], api=int(os.environ["AP02_API"]),
                syntheticOnly=True, productionRelease=False, fullF2Qualified=False,
                stages=[], status="FAIL", failurePhase="native-session")

MODE = os.environ.get("HYBRID_QUALIFICATION_MODE", "pilot")
if MODE not in ("pilot", "startup", "full"):
    raise SystemExit("INVALID_HYBRID_MODE")
environment = dict(candidate=evidence["candidate"],api=evidence["api"],schemaVersion=1,
                   syntheticOnly=True,productionRelease=False,launches=0)
destinations = set()
q3_surface = None

def q3_command(mode, timeout):
    return subprocess.run(["node", str(Path(__file__).with_name("q3-evidence.mjs")), mode],
                          check=True,capture_output=True,text=True,timeout=timeout).stdout

def canonical_ready(driver, destination, label=None):
    if MODE == "pilot":
        return
    consecutive = 0
    def sample(d):
        nonlocal consecutive
        state = d.execute_script(q3_surface,label,destination)
        if state == "gate-error":
            raise RuntimeError("PUBLIC_GATE_ERROR")
        if state == "locked":
            raise RuntimeError("PUBLIC_RELOCK_AFTER_AUTH")
        if state == "ready" and activity_is(d,"application"):
            consecutive += 1
        else:
            consecutive = 0
        return consecutive >= 2
    wait(driver,sample)
    destinations.add(destination)

def prove_launch(driver,destination):
    if MODE == "pilot":
        return
    if not re.match(rb"^package:/[^\r\n]+\.apk(?:\r?\n|$)",adb_read("shell","pm","path",PKG)):
        raise RuntimeError("PREFLIGHT_PACKAGE_UNAVAILABLE")
    wait(driver,lambda d: activity_is(d,"application"))
    if assert_running() != 1:
        raise RuntimeError("PREFLIGHT_PROCESS_NOT_UNIQUE")
    chromium = driver.execute_script("return navigator.userAgent.match(/Chrome\\/([0-9.]+)/)?.[1]??null")
    if not isinstance(chromium,str) or not re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,4}",chromium):
        raise RuntimeError("PREFLIGHT_VERSION_INCOMPLETE")
    if environment["versions"].get("chromium") not in (None,chromium):
        raise RuntimeError("PREFLIGHT_VERSION_CHANGED")
    canonical_ready(driver,destination)
    environment["versions"]["chromium"] = chromium
    environment.update(packageReady=True,foreground=True,cdpReady=True,complete=True,
                       launches=environment["launches"]+1)
    (OUT.parent/"environment.json").write_text(json.dumps(environment,indent=2),encoding="utf-8")

def save():
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

def phase(name):
    evidence["failureDetail"] = name
    save()
    print("APPIUM_TRANSITION", name, flush=True)

def stage(name, next_phase):
    evidence["stages"].append(name)
    evidence["failurePhase"] = next_phase
    evidence["failureDetail"] = None
    save()
    print("APPIUM_PILOT_STAGE_PASS", name, flush=True)

def wait(driver, condition, seconds=60):
    return WebDriverWait(driver, seconds, poll_frequency=0.5,
                         ignored_exceptions=(StaleElementReferenceException,)).until(condition)

def visible(driver, selector):
    return wait(driver, EC.visibility_of_element_located((By.CSS_SELECTOR, selector)))

def click(driver, selector):
    # Poll only the read; the click itself is sent exactly once.
    wait(driver, EC.element_to_be_clickable((By.CSS_SELECTOR, selector))).click()

def heading(driver, label):
    return wait(driver, lambda d: any(e.is_displayed() and e.text.strip() == label
                                     for e in d.find_elements(By.CSS_SELECTOR, "h1,h2")))

def webview(driver):
    def transient():
        evidence["webviewContextRetries"] = evidence.get("webviewContextRetries", 0) + 1
        save()
        print("APPIUM_WEBVIEW_CONTEXT_RETRY", evidence["webviewContextRetries"], flush=True)

    # Discovery and attachment are one bounded observation. No UI mutation is replayed.
    wait(driver, lambda d: webview_attempt(d, PKG, NoSuchContextException, transient), 60)


def assert_native_foreground(driver):
    if driver.current_package != PKG:
        raise RuntimeError("NATIVE_FOREGROUND_MISMATCH")

def process_probe():
    return subprocess.run(["adb", "shell", "pidof", PKG], capture_output=True, text=True, timeout=10)

def assert_running():
    result = process_probe()
    pids = result.stdout.split()
    if result.returncode != 0 or result.stderr.strip() or not pids or not all(
            part.isascii() and part.isdigit() for part in pids):
        raise RuntimeError("PROCESS_PRESENCE_NOT_VERIFIED")
    return len(pids)

def assert_stopped():
    for index in range(2):
        if index:
            time.sleep(0.5)
        result = process_probe()
        if result.returncode != 1 or result.stdout.strip() or result.stderr.strip():
            raise RuntimeError("PROCESS_ABSENCE_NOT_VERIFIED")
    return {"absenceSamples":2,"afterPidsCount":0}

def home_ready(driver):
    consecutive = 0
    def sample(d):
        nonlocal consecutive
        frame = d.execute_script("""
            const visible = e => !!e && e.getClientRects().length > 0 &&
                !e.closest('[inert],[hidden],[aria-hidden="true"]') &&
                getComputedStyle(e).visibility === 'visible';
            const unique = (selector, label=null) =>
                [...document.querySelectorAll(selector)].filter(e => visible(e) &&
                  (label===null || e.textContent.trim()===label)).length===1;
            const gate = unique('h1','Sicurezza non disponibile') ||
                (['Configura archivio protetto','Sblocca Registro'].some(label=>unique('h1',label)) &&
                 [...document.querySelectorAll('p.text-rose-300')].some(visible));
            return {
              ready: document.visibilityState==='visible' &&
                !document.querySelector('#vault-password') &&
                unique('#today-heading') &&
                unique('h1,h2','Le mie classi') &&
                unique('button','Nuova Classe') &&
                unique('[data-testid="header01-brand-navigation"]'),
              gateError: gate
            };
        """)
        if frame["gateError"]:
            raise RuntimeError("PUBLIC_GATE_ERROR")
        consecutive = consecutive + 1 if frame["ready"] else 0
        return consecutive >= 2
    wait(driver, sample)
    canonical_ready(driver,"session")
    canonical_ready(driver,"home")


def exact_button(driver, label, scope="button"):
    # Observe only interactive, unique real controls. A click is never retried.
    def candidate(d):
        items = [e for e in d.find_elements(By.CSS_SELECTOR, scope)
                 if e.is_displayed() and e.is_enabled() and e.text.strip() == label
                 and d.execute_script("return !arguments[0].closest('[inert],[hidden],[aria-hidden=true]')", e)]
        return items[0] if len(items) == 1 else False
    return wait(driver, candidate)

def surface(driver):
    # Reuse the same public UI predicates as the existing F2 navigation.
    return driver.execute_script("""
        const visible = e => {
            if (!e || e.closest('[inert],[hidden],[aria-hidden="true"]') ||
                e.matches(':disabled,[aria-disabled="true"]') || !e.getClientRects().length) return false;
            for (let n=e; n; n=n.parentElement) {
                const s=getComputedStyle(n);
                if (s.visibility!=='visible'||s.display==='none'||s.opacity==='0'||s.pointerEvents==='none') return false;
            }
            return true;
        };
        const unique = (s, t=null) => [...document.querySelectorAll(s)]
            .filter(e => visible(e) && (t===null || e.textContent.trim()===t)).length===1;
        const h = t => unique('h1,h2,h3,h4,[role=heading]',t);
        const b = t => unique('button',t);
        const lock = h('Sblocca Registro');
        const setup = h('Configura archivio protetto');
        const gate = h('Sicurezza non disponibile') || h('Proteggi i dati esistenti') ||
            ((lock||setup) && [...document.querySelectorAll('p.text-rose-300')].some(visible));
        const blocked = setup || h('Protezione dati in corso') || h('Protezione del Registro') ||
            [...document.querySelectorAll('[role=status]')].some(e=>visible(e) &&
                /^(Protezione della sessione|Sessione protetta|Chiusura protetta|Chiusura in attesa)/.test(e.textContent.trim()));
        const brand = unique('[data-testid="header01-brand-navigation"]');
        return { visible: document.visibilityState==='visible', gate, blocked, brand,
            lock, lockReady: lock && unique('#vault-password') && b('Sblocca Registro'),
            protectedField: !!document.querySelector('#vault-password'),
            home: unique('#today-heading') && h('Le mie classi') && b('Nuova Classe'),
            privacy: h('Ripristina backup cifrato') && b('Esporta copia completa V7') &&
                b('Scegli file e ripristina') &&
                unique('input[placeholder="Inserisci password sicura (min. 6 caratteri)"]') &&
                unique('input[placeholder="Ripeti la password"]') &&
                unique('input[placeholder="Inserisci la password impostata alla cifratura"]') &&
                unique('#restore-v7-recovery-password'),
            drawer: unique('#registro-navigation-drawer'),
            confirm: unique('[data-testid="header01-home-confirm"] [role="alertdialog"][aria-modal="true"]')
        };
    """)

def observe_destination(driver, destination, authentication, allow_confirmation=False):
    consecutive = 0
    def sample(d):
        nonlocal consecutive
        f = surface(d)
        if not f["visible"]:
            consecutive = 0
            return False
        assert_native_foreground(d)
        if f["gate"]:
            raise RuntimeError("PUBLIC_GATE_ERROR")
        if f["lockReady"] and not f["blocked"]:
            return "locked"
        ready = not f["blocked"] and not f["lock"] and not f["protectedField"]
        if ready and allow_confirmation and f["confirm"]:
            return "confirmation"
        # The drawer or modal may intentionally make the background brand inert.
        good = ready and not f["confirm"] and (
            f["drawer"] if destination == "drawer" else
            f["brand"] and (f[destination] if destination != "session" else True))
        consecutive = consecutive + 1 if good else 0
        return "ready" if consecutive >= 2 else False
    while True:
        result = wait(driver, sample, 60)
        if result != "locked":
            if result == "ready" and destination in ("home","privacy","session"):
                canonical_ready(driver,destination)
            return result
        if authentication["used"]:
            raise RuntimeError("PUBLIC_RELOCK_AFTER_AUTH")
        authentication["used"] = True
        visible(driver, "#vault-password").send_keys(PASSWORD)
        exact_button(driver, "Sblocca Registro").click()
        consecutive = 0

def navigate(driver, label, destination):
    authentication = {"used": False}
    observe_destination(driver, "session", authentication)
    click(driver, '[data-testid="header01-brand-navigation"]')
    observe_destination(driver, "drawer", authentication)
    exact_button(driver, label, "#registro-navigation-drawer button").click()
    outcome = observe_destination(driver, destination, authentication, label == "Oggi")
    if outcome == "confirmation":
        exact_button(driver, "Torna a Oggi",
                     '[data-testid="header01-home-confirm"] [role="alertdialog"] button').click()
        observe_destination(driver, destination, authentication)


COPY_PASSWORD = "appium-copy-synthetic-2026"
ORIGINAL_CLASS = "Classe fittizia F2 A"
NEWER_CLASS = "Classe fittizia F2 B"
CONSENT = ("Ripristino V7: è necessaria una copia cifrata ESATTA dello stato attuale, "
           "già conservata su un supporto separato. Dopo la conferma scegli il file di recupero. Continuare?")
BASE_NAME = re.compile(r"Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc\.json")
FILE_PATTERNS = (BASE_NAME,
    re.compile(r"Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2}) ?\(\d{1,3}\)\.enc\.json"),
    re.compile(r"Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc ?\(\d{1,3}\)\.json"),
    re.compile(r"Backup_Valutazioni_V7_(\d{4}-\d{2}-\d{2})\.enc\.json ?\(\d{1,3}\)"))

def file_date(name):
    for pattern in FILE_PATTERNS:
        match = pattern.fullmatch(name)
        if match:
            return match.group(1)
    return None

def adb_read(*args):
    return subprocess.run(["adb", *args], check=True, capture_output=True, timeout=30).stdout

def physical_files():
    return sorted(name for name in adb_read("shell", "ls", "-1", "/sdcard/Download").decode().splitlines()
                  if file_date(name))

def physical_digest(name):
    if not file_date(name):
        raise RuntimeError("INVALID_LAB_FILENAME")
    remote = "/sdcard/Download/" + name
    def size():
        data = adb_read("shell", "stat", "-c", "%s", "'" + remote + "'").strip()
        if not data.isdigit() or int(data) <= 0:
            raise RuntimeError("DEVICE_SIZE_UNAVAILABLE")
        return int(data)
    before = size()
    with tempfile.TemporaryDirectory(prefix="appium-v7-") as tmp:
        local = Path(tmp) / "encrypted.bin"
        adb_read("pull", remote, str(local))
        data = local.read_bytes()
    if before != len(data) or before != size():
        raise RuntimeError("PHYSICAL_SIZE_MISMATCH")
    envelope = json.loads(data.decode("utf-8"))
    if (envelope.get("privacy_protocol") != "REGISTRO_DOCENTE_AES_GCM_256" or
            envelope.get("version") != 2 or not isinstance(envelope.get("ciphertext"), str) or
            len(data) <= 300 or ORIGINAL_CLASS.encode() in data or NEWER_CLASS.encode() in data):
        raise RuntimeError("INVALID_ENCRYPTED_ENVELOPE")
    return {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

def select_new_file(before, after):
    if not before and len(after) == 1 and BASE_NAME.fullmatch(after[0]):
        return after[0]
    if len(before) == 1 and len(after) == 2 and before[0] in after and BASE_NAME.fullmatch(before[0]):
        added = set(after) - set(before)
        if len(added) == 1:
            name = next(iter(added))
            if file_date(name) == file_date(before[0]):
                return name
    raise RuntimeError("DISTINCT_DOCUMENT_NOT_VERIFIED")

def alert_matching(driver, expected, prefix=False):
    def sample(d):
        try:
            alert = d.switch_to.alert
            text = alert.text
        except NoAlertPresentException:
            return False
        if not (text.startswith(expected) if prefix else text == expected):
            raise RuntimeError("UNEXPECTED_PUBLIC_DIALOG")
        return alert
    return wait(driver, sample, 60)

def click_allow_alert(element):
    # A synchronous public dialog may interrupt the click response.
    # Never resend it; only a subsequent exact dialog may prove the transition.
    try:
        element.click()
    except UnexpectedAlertPresentException:
        pass

def class_visible(driver, name):
    return driver.execute_script("""
        return [...document.querySelectorAll('h1,h2,h3,h4,p,span,button,[role=heading]')]
          .some(e=>e.textContent.trim()===arguments[0] && e.getClientRects().length &&
            !e.closest('[inert],[hidden],[aria-hidden="true"]') && getComputedStyle(e).visibility==='visible');
    """, name)

def assert_class_state(driver, expected_newer):
    home_ready(driver)
    if not class_visible(driver, ORIGINAL_CLASS) or bool(class_visible(driver, NEWER_CLASS)) != expected_newer:
        raise RuntimeError("SYNTHETIC_CLASS_STATE_MISMATCH")

def create_class(driver, name):
    observe_destination(driver, "home", {"used": False})
    click_allow_alert(exact_button(driver, "Nuova Classe"))
    prompt = alert_matching(driver, "Inserisci la denominazione della nuova classe", prefix=True)
    prompt.send_keys(name)
    prompt.accept()
    observe_destination(driver, "session", {"used": False})
    wait(driver, lambda d: class_visible(d, "Gestione Elenco Alunni: " + name))
    canonical_ready(driver,"class-detail","Gestione Elenco Alunni: " + name)
    # A visible save notification is acknowledged only if actually present.
    if driver.execute_script("return document.body.innerText.includes('Dati Salvati in Locale con Successo!')"):
        exact_button(driver, "Chiudi").click()
    navigate(driver, "Oggi", "home")
    wait(driver, lambda d: class_visible(d, name))
    canonical_ready(driver,"class",name)

def activity_surface():
    raw = adb_read("shell", "dumpsys", "activity", "activities").decode("utf-8", errors="replace")
    return classify_activity(raw, PKG)

def activity_is(driver, expected):
    actual = activity_surface()
    if evidence.get("lastActivity") != actual:
        evidence["lastActivity"] = actual
        trail = evidence.setdefault("activityTransitions", [])
        if len(trail) < 64:
            trail.append(actual)
        save()
        print("APPIUM_ACTIVITY", actual, flush=True)
    if actual != expected:
        return False
    # Independent native activity evidence plus Appium's current-package signal.
    package = driver.current_package
    return package == PKG if expected == "application" else package in (
        "com.google.android.documentsui", "com.android.documentsui")

def native_picker(driver, action, name=None):
    phase("saf-wait-native-activity")
    wait(driver, lambda d: activity_surface() == "documentsui", 90)
    phase("saf-switch-native-context")
    driver.switch_to.context("NATIVE_APP")
    wait(driver, lambda d: activity_is(d, "documentsui"), 60)
    # One accessibility owner: existing Appium session; F2 selection and tap guards.
    # No Appium selector fallback, no second invocation after an unknown result.
    phase("saf-canonical-native-driver")
    script = Path(__file__).with_name("native-picker.mjs")
    result = subprocess.run(["node", str(script)], input=json.dumps({"action": action, "name": name, "sessionId": driver.session_id}),
                            capture_output=True, text=True, timeout=280)
    phases = {"saf-downloads-location", "saf-open-roots", "saf-select-downloads",
              "saf-downloads-ready", "saf-save-control", "saf-select-exact-document",
              "saf-observe-open-or-return", "saf-confirm-open", "saf-observe-document-return",
              "saf-native-complete"}
    last_phase = None
    completed = False
    for line in result.stdout.splitlines():
        event = json.loads(line)
        kind, value = event.get("kind"), event.get("value")
        if kind == "phase" and value in phases:
            last_phase = value
            phase(value)
        elif kind == "observation" and isinstance(value, str) and re.fullmatch(r"[a-z0-9_-]+|[A-Z0-9_]+", value):
            evidence["nativeObservation"] = value
        elif kind == "failure" and isinstance(value, str) and re.fullmatch(r"[A-Z0-9_]+", value):
            evidence["nativeFailureCode"] = value
            print("APPIUM_NATIVE_FAILURE", value, flush=True)
        elif kind == "result" and value == "PASS":
            completed = True
    save()
    if result.returncode != 0 or not completed or last_phase != "saf-native-complete":
        raise RuntimeError("CANONICAL_NATIVE_PICKER_FAILED")

def picker_return(driver, role, expected_dialog):
    phase("saf-wait-application-return")
    wait(driver, lambda d: activity_is(d, "application"), 60)
    phase("saf-reconnect-webview")
    webview(driver)
    phase("saf-wait-protected-lock")
    def locked(d):
        f = surface(d)
        if f["gate"]:
            raise RuntimeError("PUBLIC_GATE_ERROR")
        return f["visible"] and f["lockReady"] and not f["blocked"] and d.current_package == PKG
    wait(driver, locked, 60)
    phase("saf-reauthenticate-once")
    visible(driver, "#vault-password").send_keys(PASSWORD)
    click_allow_alert(exact_button(driver, "Sblocca Registro"))
    # An exact downstream dialog is required, not merely the submit response.
    phase("saf-wait-exact-public-dialog")
    alert = alert_matching(driver, expected_dialog)
    phase("saf-accept-exact-public-dialog")
    alert.accept()
    evidence.setdefault("safReturns", []).append(role)
    save()

def select_document(driver, name):
    native_picker(driver, "open", name)

def export_copy(driver, previous=None):
    phase("export-observe-physical-baseline")
    before = physical_files()
    if previous is None:
        if before:
            raise RuntimeError("UNEXPECTED_EXISTING_DOCUMENT")
    elif before != [previous[0]] or physical_digest(previous[0]) != previous[1]:
        raise RuntimeError("ORIGINAL_DOCUMENT_CHANGED")
    phase("export-verify-privacy-ready")
    observe_destination(driver, "privacy", {"used": False})
    phase("export-fill-encryption-form")
    visible(driver, 'input[placeholder="Inserisci password sicura (min. 6 caratteri)"]').send_keys(COPY_PASSWORD)
    visible(driver, 'input[placeholder="Ripeti la password"]').send_keys(COPY_PASSWORD)
    phase("export-submit-once")
    exact_button(driver, "Esporta copia completa V7").click()
    native_picker(driver, "save")
    picker_return(driver, "target-export" if previous is None else "recovery-export",
                  "Copia completa V7 salvata, riletta e verificata.")
    phase("export-discover-physical-document")
    name = select_new_file(before, physical_files())
    phase("export-verify-encrypted-envelope")
    digest = physical_digest(name)
    if previous is not None:
        if physical_digest(previous[0]) != previous[1] or digest["sha256"] == previous[1]["sha256"]:
            raise RuntimeError("DISTINCT_ENCRYPTED_COPY_NOT_VERIFIED")
    evidence.setdefault("physicalCopies", []).append(digest)
    save()
    return name, digest

def restore_copies(driver, target, recovery):
    phase("restore-verify-privacy-ready")
    observe_destination(driver, "privacy", {"used": False})
    visible(driver, 'input[placeholder="Inserisci la password impostata alla cifratura"]').send_keys(COPY_PASSWORD)
    visible(driver, "#restore-v7-recovery-password").send_keys(COPY_PASSWORD)
    phase("restore-submit-once")
    exact_button(driver, "Scegli file e ripristina").click()
    select_document(driver, target[0])
    picker_return(driver, "target-source", CONSENT)
    select_document(driver, recovery[0])
    picker_return(driver, "recovery-source", "Backup cifrato verificato e ripristinato con successo!")
    phase("restore-verify-class-content")
    assert_class_state(driver, False)

def main():
    global q3_surface
    opts = UiAutomator2Options().load_capabilities({
        "platformName": "Android", "appium:automationName": "UiAutomator2",
        "appium:deviceName": "Android Emulator", "appium:app": os.environ["AP02_LAB_APK"],
        "appium:appPackage": PKG, "appium:appActivity": ACTIVITY,
        "appium:noReset": False, "appium:fullReset": False,
        "appium:autoGrantPermissions": False, "unhandledPromptBehavior": "ignore", "appium:newCommandTimeout": 120,
        "appium:ensureWebviewsHavePages": True, "appium:enableWebviewDetailsCollection": True,
    })
    driver = None
    try:
        phase("session-device-readiness")
        def device_ready(_):
            return (adb_read("get-state").strip() == b"device" and
                    adb_read("shell", "getprop", "sys.boot_completed").strip() == b"1" and
                    adb_read("shell", "pm", "path", "android").strip().startswith(b"package:"))
        WebDriverWait(None, 60, poll_frequency=1).until(device_ready)
        if MODE != "pilot":
            environment.update(json.loads(q3_command("boot",150)))
            q3_surface = q3_command("surface",10)
        phase("session-create-once")
        driver = webdriver.Remote("http://127.0.0.1:4723", options=opts)
        driver.implicitly_wait(0)
        wait(driver, lambda d: d.current_package == PKG)
        stage("native-session", "webview-setup")
        webview(driver)
        heading(driver, "Configura archivio protetto")
        prove_launch(driver,"setup")
        stage("webview-setup", "professional-home")
        click(driver, 'input[name="archive-mode"][value="professional"]')
        fields = wait(driver, lambda d: (items if len(items := d.find_elements(By.CSS_SELECTOR, "fieldset input[required]")) == 4 else False))
        for field, value in zip(fields, ("Istituto fittizio", "2026/2027", "Docente sintetico", "Tecnologia")):
            field.send_keys(value)
        visible(driver, "#vault-password").send_keys(PASSWORD)
        click(driver, "form button[type=submit]")
        # Read-only confirmation of the real product state, not click acknowledgement.
        home_ready(driver)
        if MODE == "startup":
            stage("professional-home", "native-stop-verified")
        else:
            stage("professional-home", "privacy-navigation")
            navigate(driver, "Privacy", "privacy")
            stage("privacy-navigation", "home-navigation")
            navigate(driver, "Oggi", "home")
            stage("home-navigation", "target-class")
            create_class(driver, ORIGINAL_CLASS)
            assert_class_state(driver, False)
            stage("target-class", "target-export")
            navigate(driver, "Privacy", "privacy")
            target = export_copy(driver)
            stage("target-export", "recovery-class")
            navigate(driver, "Oggi", "home")
            create_class(driver, NEWER_CLASS)
            assert_class_state(driver, True)
            stage("recovery-class", "recovery-export")
            navigate(driver, "Privacy", "privacy")
            recovery = export_copy(driver, target)
            stage("recovery-export", "restore")
            restore_copies(driver, target, recovery)
            stage("restore", "native-stop-verified")
        driver.switch_to.context("NATIVE_APP")
        assert_native_foreground(driver)
        before_pids = assert_running()
        if not driver.terminate_app(PKG):
            raise RuntimeError("NATIVE_TERMINATION_NOT_ACKNOWLEDGED")
        stopped = assert_stopped()
        evidence["coldProcess"] = dict(stopped,forcedStop=True,beforePidsCount=before_pids)
        stage("native-stop-verified", "cold-lock")
        driver.activate_app(PKG)
        wait(driver, lambda d: d.current_package == PKG)
        webview(driver)
        heading(driver, "Sblocca Registro")
        visible(driver, "#vault-password")
        prove_launch(driver,"lock")
        stage("cold-lock", "cold-authenticated-home")
        visible(driver, "#vault-password").send_keys(PASSWORD)
        click(driver, "form button[type=submit]")
        home_ready(driver)
        if MODE == "startup":
            stage("cold-authenticated-home", "complete")
        else:
            stage("cold-authenticated-home", "cold-restored-content")
            assert_class_state(driver, False)
            stage("cold-restored-content", "complete")
        evidence.update(status="PASS", failurePhase=None)
    except Exception as exc:
        # Persist only a categorical exception type, never page source,
        # credentials, screenshots or arbitrary exception messages.
        evidence["failureType"] = type(exc).__name__
        raise SystemExit("APPIUM_PILOT_FAILED " + evidence["failurePhase"] + " " + str(evidence.get("failureDetail")) + " " + type(exc).__name__) from None
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                if evidence["status"] == "PASS":
                    evidence.update(status="FAIL", failurePhase="driver-quit")
                else:
                    evidence["cleanupFailed"] = True
        save()
    if evidence["status"] != "PASS":
        raise SystemExit("APPIUM_PILOT_FAILED")
    if MODE != "pilot":
        try:
            records = canonical_records(evidence,environment,destinations,MODE,int(os.environ.get("Q4_TRIAL") or 0))
            for name, value in records.items():
                (OUT.parent/name).write_text(json.dumps(value,indent=2),encoding="utf-8")
        except Exception:
            evidence.update(status="FAIL",failurePhase="canonical-evidence")
            save()
            raise SystemExit("HYBRID_CANONICAL_EVIDENCE_INCOMPLETE") from None

if __name__ == "__main__":
    save()
    main()
