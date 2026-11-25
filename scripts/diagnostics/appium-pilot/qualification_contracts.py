"""Fail-closed mapping from observed hybrid proofs to the existing F2 evidence schema."""
import re

STARTUP = ["native-session", "webview-setup", "professional-home",
           "native-stop-verified", "cold-lock", "cold-authenticated-home"]
FULL = ["native-session", "webview-setup", "professional-home", "privacy-navigation",
        "home-navigation", "target-class", "target-export", "recovery-class",
        "recovery-export", "restore", "native-stop-verified", "cold-lock",
        "cold-authenticated-home", "cold-restored-content"]
RETURNS = ["target-export", "recovery-export", "target-source", "recovery-source"]
VERSIONS = ["adb","platformTools","emulator","webviewPackage","webviewVersion",
            "androidBuild","runnerImage","runnerVersion","node","chromium"]
DESTINATIONS = {"setup","lock","session","home"}

def require(value):
    if not value:
        raise ValueError("HYBRID_CANONICAL_EVIDENCE_INCOMPLETE")

def canonical_records(e, env, destinations, mode, trial):
    require(mode in ("startup", "full"))
    require(e.get("status") == "PASS" and e.get("syntheticOnly") is True
            and e.get("productionRelease") is False and e.get("fullF2Qualified") is False)
    require(e.get("stages") == (STARTUP if mode == "startup" else FULL))
    require(env.get("candidate") == e.get("candidate") and env.get("api") == e.get("api"))
    require(all(env.get(key) is True for key in ("bootReady","packageReady","foreground","cdpReady","complete")))
    require(env.get("launches") == 2 and env.get("bootObservation") in ("ready-stopped","ready-absent-verified"))
    versions = env.get("versions", {})
    require(all(isinstance(versions.get(k),str) and versions[k] for k in VERSIONS))
    identity = env.get("emulatorIdentity", {})
    require(identity.get("version") == versions["emulator"] and
            re.fullmatch(r"[a-f0-9]{64}",identity.get("binarySha256") or "") and
            re.fullmatch(r"[0-9]+(?:\.[0-9]+){1,4}",identity.get("revision") or ""))
    require((identity.get("source"),identity.get("probeStatus")) == ("executable","ok") or
            (identity.get("source") == "sdk-package" and identity.get("probeStatus") in
             ("timeout","spawn-error","nonzero-exit","missing-version")))
    require(set(destinations) == (DESTINATIONS if mode == "startup" else DESTINATIONS | {"class","class-detail","privacy"}))
    stop = e.get("coldProcess",{})
    require(stop.get("forcedStop") is True and stop.get("absenceSamples") == 2
            and isinstance(stop.get("beforePidsCount"),int) and stop["beforePidsCount"] > 0
            and stop.get("afterPidsCount") == 0)
    base = {k:e[k] for k in ("candidate","api","syntheticOnly","productionRelease")}
    def record(name, **facts):
        return dict(stage=name, status="PASS", **facts)
    results = [record("installed-professional-android-webview"),
               record("professional-vault-created-with-synthetic-profile")]
    docs = {}
    if mode == "startup":
        require(trial in (1,2,3) and not e.get("physicalCopies") and not e.get("safReturns"))
        docs["startup.json"] = dict(base, schemaVersion=1, trial=trial, mode="startup-only",
                                    fullF2Qualified=False, setupHome=True,coldAuthenticatedHome=True,**stop)
    else:
        copies = e.get("physicalCopies",[])
        returns = e.get("safReturns",[])
        require(len(copies) == 2 and returns == RETURNS)
        require(all(isinstance(c.get("bytes"),int) and c["bytes"] > 300 and
                    re.fullmatch(r"[a-f0-9]{64}",c.get("sha256") or "") for c in copies))
        require(copies[0]["sha256"] != copies[1]["sha256"])
        results += [record("native-v7-target-export-saf-verified",target=copies[0],physical=True,nativeReauthCount=len(returns[:1])),
                    record("native-v7-current-recovery-export-saf-verified",recovery=copies[1],physical=True,nativeReauthCount=len(returns[:2])),
                    record("actual-professional-v7-native-saf-import-and-restored-ui",twoFileSelection=True,encryptedFilesDistinct=True,nativeReauthCount=len(returns)),
                    record("actual-android-process-cold-reopen-preserves-v7-restore",**stop)]
    docs["result.json"] = dict(base,schemaVersion=1,package="it.trama.registrodocente.lab.ap02v7",
        mode="installed-professional-ui-real-saf",source="Appium public installed WebView and real Android DocumentsUI",results=results)
    docs["environment.json"] = env
    docs["surface-readiness.json"] = dict(candidate=e["candidate"],api=e["api"],rawDomStored=False,readyDestinations=sorted(destinations))
    return docs
