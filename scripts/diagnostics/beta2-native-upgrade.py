"""Non-debuggable APK upgrade on fresh CI emulator; synthetic archive only."""
import json, os, pathlib, re, subprocess, time, xml.etree.ElementTree as ET

PKG = "it.trama.registrodocente"
ACTIVITY = PKG + "/it.trama.registrodocente.prova.MainActivity"
MARKER = "Collaudo aggiornamento 2026"
PASSWORD = "SyntheticUpgradeOnly2026"
EVIDENCE = pathlib.Path("native-evidence")
EVIDENCE.mkdir(exist_ok=True)
stages = []

def adb(*args):
    return subprocess.check_output(["adb", *args], text=True, timeout=45).strip()

def stage(name, **details):
    stages.append({"stage":name,"status":"PASS",**details})
    (EVIDENCE/"upgrade-result.json").write_text(json.dumps({
        "oldSource":os.environ["BETA1_SHA"],"newSource":os.environ["BETA2_SHA"],
        "api":os.environ["LAB_API"],"releaseAuthorized":False,"ownerSignatureQualified":False,
        "results":stages},indent=2))
    print(name,"PASS",details,flush=True)

def nodes():
    adb("shell","uiautomator","dump","/sdcard/trama-upgrade.xml")
    return list(ET.fromstring(adb("shell","cat","/sdcard/trama-upgrade.xml")).iter("node"))

def label(n):
    return (n.get("text",""),n.get("content-desc",""))

def bounds(n):
    nums = list(map(int,re.findall(r"\d+", n.get("bounds",""))))
    return nums if len(nums)==4 and nums[2]>nums[0] and nums[3]>nums[1] else None

def wait_node(predicate, name, timeout=35):
    deadline=time.monotonic()+timeout
    while time.monotonic()<deadline:
        try:
            for n in nodes():
                if predicate(n) and bounds(n):
                    return n
        except (subprocess.SubprocessError,ET.ParseError):
            pass
        time.sleep(1)
    raise RuntimeError("Missing observable UI: "+name)

def press(n):
    l,t,r,b=bounds(n)
    adb("shell","input","tap",str((l+r)//2),str((t+b)//2))

def button(name):
    return wait_node(lambda n:name in label(n) and
        (n.get("class")=="android.widget.Button" or n.get("clickable")=="true") and
        n.get("enabled")=="true",name)

def edit(password=False):
    return wait_node(lambda n:n.get("class")=="android.widget.EditText" and
        (not password or n.get("password")=="true"),"editable field")

def type_text(value):
    adb("shell","input","text",value.replace(" ","%s"))

def hide_keyboard():
    status=adb("shell","dumpsys","input_method")
    if re.search(r"mInputShown=true|mIsInputViewShown=true",status):
        adb("shell","input","keyevent","KEYCODE_BACK")
        time.sleep(.5)

def enter_gate(action,password):
    press(edit(True)); type_text(password); hide_keyboard()
    press(button(action))

def observe_text(value,timeout=35):
    return wait_node(lambda n:any(value in s for s in label(n)),value,timeout)

def launch():
    adb("shell","am","start","-W","-n",ACTIVITY)

def stop():
    adb("shell","am","force-stop",PKG)

def package_state(expected):
    data=adb("shell","dumpsys","package",PKG)
    version=re.search(r"\bversionCode=(\d+)",data)
    uid=re.search(r"\b(?:userId|appId)=(\d+)",data)
    installed=re.search(r"\bfirstInstallTime=([^\n]+)",data)
    if not(version and uid and installed and version.group(1)==str(expected)):
        raise RuntimeError("Unexpected installed package metadata")
    return {"version":int(version.group(1)),"uid":uid.group(1),"firstInstallTime":installed.group(1).strip()}

def install(path,replace=False):
    # Avoid incremental installation's asynchronous serving path. ADB may
    # append timing information after the exact Success line.
    result=adb("install","--no-incremental",*(["-r"] if replace else []),path)
    print("ADB installation output:",result,flush=True)
    if sum(line.strip()=="Success" for line in result.splitlines())!=1:
        raise RuntimeError("Android install did not succeed: "+result)
    # The caller independently verifies the installed package/version/UID.

def find_class():
    # Observation plus bounded scroll, never repeat a mutation.
    for attempt in range(5):
        try:
            return wait_node(lambda n:"Apri classe "+MARKER in label(n),MARKER,8)
        except RuntimeError:
            size=re.findall(r"(\d+)x(\d+)",adb("shell","wm","size"))[-1]
            w,h=map(int,size)
            adb("shell","input","swipe",str(w//2),str(int(h*.75)),str(w//2),str(int(h*.35)),"450")
    raise RuntimeError("Teacher-created class missing")

try:
    if os.environ.get("GITHUB_ACTIONS")!="true":
        raise RuntimeError("CI emulator only")
    if adb("shell","getprop","ro.kernel.qemu")!="1" and adb("shell","getprop","ro.boot.qemu")!="1":
        raise RuntimeError("Not an emulator")
    if adb("shell","getprop","ro.build.version.sdk")!=os.environ["LAB_API"]:
        raise RuntimeError("Unexpected API")
    if ("package:"+PKG) in adb("shell","pm","list","packages").splitlines():
        raise RuntimeError("Expected fresh emulator, never overwrite an existing archive")
    install(os.environ["OLD_SIGNED_APK"])
    old=package_state(10002); stage("beta1-installed",**old)
    launch()
    enter_gate("Configura archivio protetto",PASSWORD)
    observe_text("Le mie classi")
    press(button("Nuova Classe"))
    press(edit());type_text(MARKER);hide_keyboard();press(button("OK"))
    wait_node(lambda n:n.get("class")!="android.widget.EditText" and
        n.get("package")==PKG and any(MARKER in s for s in label(n)),"saved class context")
    # Confirm persistence in the old APK before replacing it.
    stop();launch();enter_gate("Sblocca Registro",PASSWORD)
    observe_text("Le mie classi");find_class()
    stage("beta1-created-class-survives-reopen",marker=MARKER)
    stop()
    install(os.environ["NEW_SIGNED_APK"],replace=True)
    new=package_state(10003)
    if any(old[k]!=new[k] for k in ("uid","firstInstallTime")):
        raise RuntimeError("Replacement did not retain Android package identity")
    stage("in-place-upgrade",**new)
    launch()
    expected_build = "Android · " + os.environ["BETA2_SHA"][:12]
    wait_node(lambda n:n.get("package")==PKG and expected_build in label(n), "promoted build on locked gate")
    stage("promoted-build-visible-on-gate",identity=expected_build)
    enter_gate("Sblocca Registro","WrongSyntheticPassword")
    observe_text("Password errata")
    stage("wrong-password-rejected")
    stop();launch();enter_gate("Sblocca Registro",PASSWORD)
    observe_text("Le mie classi");find_class()
    stage("beta2-preserved-class-and-password",marker=MARKER)
    stop();launch();enter_gate("Sblocca Registro",PASSWORD)
    observe_text("Le mie classi");find_class()
    stage("beta2-preserved-class-after-reopen",marker=MARKER)
except Exception as exc:
    (EVIDENCE/"failure.txt").write_text(str(exc))
    raise
finally:
    # No private archive, APK or signing key is uploaded.
    try:
        (EVIDENCE/"package.txt").write_text(adb("shell","dumpsys","package",PKG))
        (EVIDENCE/"activity.txt").write_text(adb("shell","dumpsys","activity","activities"))
        with (EVIDENCE/"synthetic-screen.png").open("wb") as file:
            subprocess.run(["adb","exec-out","screencap","-p"],stdout=file,timeout=15,check=False)
    except Exception:
        pass
