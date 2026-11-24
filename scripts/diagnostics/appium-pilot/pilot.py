"""Q5-SYS-01: real Appium/UiAutomator2/ChromeDriver feasibility pilot.
Not F2 qualification; no application hooks, no synthetic PASS, no mutation replay.
"""
import json
import os
import subprocess
import time
from pathlib import Path

from appium import webdriver
from appium.options.android import UiAutomator2Options
from selenium.common.exceptions import StaleElementReferenceException
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
        const visible = e => !!e && e.getClientRects().length > 0 &&
            !e.closest('[inert],[hidden],[aria-hidden="true"]') &&
            getComputedStyle(e).visibility === 'visible' && !e.disabled;
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
        ready = f["brand"] and not f["blocked"] and not f["lock"] and not f["protectedField"]
        if ready and allow_confirmation and f["confirm"]:
            return "confirmation"
        good = ready and (f[destination] if destination != "session" else True) and not f["confirm"]
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

def main():
    opts = UiAutomator2Options().load_capabilities({
        "platformName": "Android", "appium:automationName": "UiAutomator2",
        "appium:deviceName": "Android Emulator", "appium:app": os.environ["AP02_LAB_APK"],
        "appium:appPackage": PKG, "appium:appActivity": ACTIVITY,
        "appium:noReset": False, "appium:fullReset": False,
        "appium:autoGrantPermissions": False, "appium:newCommandTimeout": 120,
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
        stage("home-navigation", "native-stop-verified")
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
        stage("cold-authenticated-home", "complete")
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
