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

from appium import webdriver
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

def save():
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(evidence, indent=2), encoding="utf-8")

def stage(name, next_phase):
    evidence["stages"].append(name)
    evidence["failurePhase"] = next_phase
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
    def unique(d):
        contexts = [c for c in d.contexts if c == "WEBVIEW_" + PKG]
        if len(contexts) > 1:
            raise RuntimeError("AMBIGUOUS_WEBVIEW")
        return contexts[0] if len(contexts) == 1 else False
    context = wait(driver, unique)
    driver.switch_to.context(context)
    wait(driver, lambda d: d.current_url.startswith(("http://localhost/", "https://localhost/")))

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

def assert_stopped():
    for index in range(2):
        if index:
            time.sleep(0.5)
        result = process_probe()
        if result.returncode != 1 or result.stdout.strip() or result.stderr.strip():
            raise RuntimeError("PROCESS_ABSENCE_NOT_VERIFIED")

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
    # A visible save notification is acknowledged only if actually present.
    if driver.execute_script("return document.body.innerText.includes('Dati Salvati in Locale con Successo!')"):
        exact_button(driver, "Chiudi").click()
    navigate(driver, "Oggi", "home")
    wait(driver, lambda d: class_visible(d, name))

def documents_foreground(driver):
    return re.fullmatch(r"(?:com\.google\.android|com\.android)\.documentsui", driver.current_package or "") is not None

def native_match(driver, predicate):
    items = []
    for e in driver.find_elements(By.XPATH, "//*"):
        if e.is_displayed() and e.is_enabled() and predicate(e):
            items.append(e)
    return items[0] if len(items) == 1 else False

def doc_control(driver, labels, attribute="text"):
    def sample(d):
        if not documents_foreground(d):
            return False
        return native_match(d, lambda e: e.get_attribute(attribute) in labels)
    return wait(driver, sample, 60)

def open_downloads(driver):
    driver.switch_to.context("NATIVE_APP")
    wait(driver, documents_foreground, 90)
    def sample(d):
        if not documents_foreground(d):
            return False
        folder = native_match(d, lambda e: e.get_attribute("text") in ("Download", "Downloads"))
        if folder:
            return ("folder", folder)
        root = native_match(d, lambda e: (e.get_attribute("content-desc") or "").lower() in
                            ("show roots", "open navigation drawer", "mostra radici"))
        return ("root", root) if root else False
    kind, element = wait(driver, sample, 60)
    if kind == "root":
        element.click()
        doc_control(driver, ("Download", "Downloads")).click()

def picker_return(driver, role, expected_dialog):
    wait(driver, lambda d: d.current_package == PKG, 60)
    webview(driver)
    def locked(d):
        f = surface(d)
        if f["gate"]:
            raise RuntimeError("PUBLIC_GATE_ERROR")
        return f["visible"] and f["lockReady"] and not f["blocked"] and d.current_package == PKG
    wait(driver, locked, 60)
    visible(driver, "#vault-password").send_keys(PASSWORD)
    click_allow_alert(exact_button(driver, "Sblocca Registro"))
    # An exact downstream dialog is required, not merely the submit response.
    alert = alert_matching(driver, expected_dialog)
    alert.accept()
    evidence.setdefault("safReturns", []).append(role)
    save()

def select_document(driver, name):
    open_downloads(driver)
    doc_control(driver, (name,)).click()
    def next_step(d):
        if d.current_package == PKG:
            return "returned"
        if documents_foreground(d):
            element = native_match(d, lambda e: (e.get_attribute("text") or "").lower() in ("open", "apri"))
            if element:
                return element
        return False
    result = wait(driver, next_step, 60)
    if result != "returned":
        if not documents_foreground(driver):
            raise RuntimeError("PICKER_FOREGROUND_CHANGED")
        result.click()
    wait(driver, lambda d: d.current_package == PKG, 60)

def export_copy(driver, previous=None):
    before = physical_files()
    if previous is None:
        if before:
            raise RuntimeError("UNEXPECTED_EXISTING_DOCUMENT")
    elif before != [previous[0]] or physical_digest(previous[0]) != previous[1]:
        raise RuntimeError("ORIGINAL_DOCUMENT_CHANGED")
    observe_destination(driver, "privacy", {"used": False})
    visible(driver, 'input[placeholder="Inserisci password sicura (min. 6 caratteri)"]').send_keys(COPY_PASSWORD)
    visible(driver, 'input[placeholder="Ripeti la password"]').send_keys(COPY_PASSWORD)
    exact_button(driver, "Esporta copia completa V7").click()
    open_downloads(driver)
    doc_control(driver, ("Save", "Salva", "SAVE", "SALVA")).click()
    picker_return(driver, "target-export" if previous is None else "recovery-export",
                  "Copia completa V7 salvata, riletta e verificata.")
    name = select_new_file(before, physical_files())
    digest = physical_digest(name)
    if previous is not None:
        if physical_digest(previous[0]) != previous[1] or digest["sha256"] == previous[1]["sha256"]:
            raise RuntimeError("DISTINCT_ENCRYPTED_COPY_NOT_VERIFIED")
    evidence.setdefault("physicalCopies", []).append(digest)
    save()
    return name, digest

def restore_copies(driver, target, recovery):
    observe_destination(driver, "privacy", {"used": False})
    visible(driver, 'input[placeholder="Inserisci la password impostata alla cifratura"]').send_keys(COPY_PASSWORD)
    visible(driver, "#restore-v7-recovery-password").send_keys(COPY_PASSWORD)
    exact_button(driver, "Scegli file e ripristina").click()
    select_document(driver, target[0])
    picker_return(driver, "target-source", CONSENT)
    select_document(driver, recovery[0])
    picker_return(driver, "recovery-source", "Backup cifrato verificato e ripristinato con successo!")
    assert_class_state(driver, False)

def main():
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
        driver = webdriver.Remote("http://127.0.0.1:4723", options=opts)
        driver.implicitly_wait(0)
        wait(driver, lambda d: d.current_package == PKG)
        stage("native-session", "webview-setup")
        webview(driver)
        heading(driver, "Configura archivio protetto")
        stage("webview-setup", "professional-home")
        click(driver, 'input[name="archive-mode"][value="professional"]')
        fields = wait(driver, lambda d: (items if len(items := d.find_elements(By.CSS_SELECTOR, "fieldset input[required]")) == 4 else False))
        for field, value in zip(fields, ("Istituto fittizio", "2026/2027", "Docente sintetico", "Tecnologia")):
            field.send_keys(value)
        visible(driver, "#vault-password").send_keys(PASSWORD)
        click(driver, "form button[type=submit]")
        # Read-only confirmation of the real product state, not click acknowledgement.
        home_ready(driver)
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
        assert_running()
        if not driver.terminate_app(PKG):
            raise RuntimeError("NATIVE_TERMINATION_NOT_ACKNOWLEDGED")
        assert_stopped()
        stage("native-stop-verified", "cold-lock")
        driver.activate_app(PKG)
        wait(driver, lambda d: d.current_package == PKG)
        webview(driver)
        heading(driver, "Sblocca Registro")
        visible(driver, "#vault-password")
        stage("cold-lock", "cold-authenticated-home")
        visible(driver, "#vault-password").send_keys(PASSWORD)
        click(driver, "form button[type=submit]")
        home_ready(driver)
        stage("cold-authenticated-home", "cold-restored-content")
        assert_class_state(driver, False)
        stage("cold-restored-content", "complete")
        evidence.update(status="PASS", failurePhase=None)
    except Exception as exc:
        # Persist only a categorical exception type, never page source,
        # credentials, screenshots or arbitrary exception messages.
        evidence["failureType"] = type(exc).__name__
        raise SystemExit("APPIUM_PILOT_FAILED " + evidence["failurePhase"] + " " + type(exc).__name__) from None
    finally:
        if driver is not None:
            try:
                driver.quit()
            except Exception:
                evidence.update(status="FAIL", failurePhase="driver-quit")
        save()
    if evidence["status"] != "PASS":
        raise SystemExit("APPIUM_PILOT_FAILED")

if __name__ == "__main__":
    save()
    main()
