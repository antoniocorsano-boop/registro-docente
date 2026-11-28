import unittest
from copy import deepcopy
from qualification_contracts import canonical_records,STARTUP,FULL,RETURNS,DESTINATIONS,VERSIONS

class Qualification(unittest.TestCase):
    def fixture(self,mode):
        e=dict(candidate="a"*40,api=32,syntheticOnly=True,productionRelease=False,
               fullF2Qualified=False,status="PASS",stages=list(STARTUP if mode=="startup" else FULL),
               coldProcess=dict(forcedStop=True,absenceSamples=2,beforePidsCount=1,afterPidsCount=0))
        env=dict(candidate=e["candidate"],api=32,bootReady=True,packageReady=True,foreground=True,
                 cdpReady=True,complete=True,launches=2,bootObservation="ready-stopped",
                 versions={k:"1.2" for k in VERSIONS},
                 emulatorIdentity=dict(version="1.2",binarySha256="a"*64,revision="1.2",source="executable",probeStatus="ok"))
        d=set(DESTINATIONS)
        if mode=="full":
            e.update(physicalCopies=[dict(bytes=500,sha256="b"*64),dict(bytes=600,sha256="c"*64)],safReturns=list(RETURNS))
            d.update({"class","class-detail","privacy"})
        return e,env,d
    def test_startup_is_not_full(self):
        e,v,d=self.fixture("startup")
        r=canonical_records(e,v,d,"startup",1)
        self.assertEqual(len(r["result.json"]["results"]),2)
        self.assertFalse(r["startup.json"]["fullF2Qualified"])
        with self.assertRaises(ValueError): canonical_records(e,v,d,"full",0)
    def test_full_has_six_records(self):
        e,v,d=self.fixture("full")
        r=canonical_records(e,v,d,"full",0)
        self.assertEqual(len(r["result.json"]["results"]),6)
        self.assertEqual(r["result.json"]["results"][4]["nativeReauthCount"],4)
        self.assertNotIn("startup.json",r)
    def test_missing_independent_proofs_fail(self):
        e,v,d=self.fixture("full")
        for key in ("launches","emulatorIdentity","bootObservation","versions"):
            bad=deepcopy(v); bad.pop(key)
            with self.assertRaises(ValueError): canonical_records(e,bad,d,"full",0)
        for key in ("stages","coldProcess","physicalCopies","safReturns"):
            bad=deepcopy(e); bad.pop(key)
            with self.assertRaises(ValueError): canonical_records(bad,v,d,"full",0)
        with self.assertRaises(ValueError): canonical_records(e,v,d-{"class-detail"},"full",0)
        e["physicalCopies"][1]["sha256"]=e["physicalCopies"][0]["sha256"]
        with self.assertRaises(ValueError): canonical_records(e,v,d,"full",0)
