"""Q5-SYS-01: real Appium/UiAutomator2/ChromeDriver feasibility pilot.
Not F2 qualification; no application hooks, no synthetic PASS, no mutation replay.
"""
import json
import os
import subprocess
from pathlib import Path

from appium import webdriver
from appium.options.android import UiAutomator2Options
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
    return WebDriverWait(driver, seconds, poll_frequency=0.5).until(condition)

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

def assert_stopped():
    # Independent process absence, not inferred from a successful stop command.
    for _ in range(2):
        result = subprocess.run(["adb", "shell", "pidof", PKG], capture_output=True, text=True, timeout=10)
        if result.returncode != 1 or result.stdout.strip():
            raise RuntimeError("PROCESS_ABSENCE_NOT_VERIFIED")

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
        heading(driver, "Le mie classi")
        visible(driver, "#today-heading")
        stage("professional-home", "native-stop-verified")
        driver.switch_to.context("NATIVE_APP")
        assert_native_foreground(driver)
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
        heading(driver, "Le mie classi")
        visible(driver, "#today-heading")
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
