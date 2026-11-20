# DOC-01/D4c3d2 — Android V8 document-history recovery (laboratory)
Date: 2026-11-20. Exact baseline `e56421e6422c3cfcfd19259bb1ff758efd190240` (PR #375 qualified 11/11). Synthetic data only.

## Teacher scenario
The teacher selects two encrypted V8 backup copies in Android's file picker: an exact recovery copy of the current archive and the proposed newer copy. Before a replacement, both are independently checked. Only explicit consent allows the one-use DB2 change; the entire immutable document chronology, assessments and grades must survive a cold Android process restart. The teacher must be shown readable confirmation/failure in a later separate product activation phase.

## Reuse, not a parallel Android storage system
- Reuse the existing Android native Capacitor `RegistroBackupFiles` SAF picker, write/readback SHA-256 receipt, authenticated foreground session and cancellation/revocation behavior. Only ciphertext crosses the bridge.
- Reuse PR #375's actual encrypted DB2 `prepareDocumentRestore`, exact owner generation, scope validation, atomic compare-and-swap and physical readback.
- Extend the **same** isolated API 32/36 debug runner already used for V7, after completing its original twelve evidence phases. Preserve those phases and add six explicit DOC-01 V8 phases; no second emulator build or production Android route.
- Extend process-stop evidence from four to five verified cold restarts, never soften the prior four. After V8 restore check the complete document event chain, all V7 assessment evidence, grades and physical ciphertext.
- Use truly selected V8 copies, separately decrypt with existing AES-GCM V2 envelope, verify content bytes/digest, and reject cancelled selections. The application remains offline and student data remain synthetic.

## RED → GREEN
1. On a verified branch at exact SHA, register invariant `DOC-01-D4C3D2-I01` and five fixed Bun boundary tests referring to absent V8 native SAF entrypoints, data fixture and stage evidence.
2. Record intentional RED only in the five new tests; all 1,338 inherited tests remain green.
3. Implement isolated fixture and native driver while retaining existing V7 stages. Use independent V8 filenames and native restore grant; do not modify the product Root or App.
4. Require 11/11 exact-SHA gates, including Android API32/API36 with written/reread V8 ciphertext, cancellation, one-use consent, DB2 restore, cold restart. No PASS is claimed without actual evidence.
5. Keep PR draft and product release disabled. Explicit separate decision is required for integration.

## Non-authorities
No production UI, real archive migration or Android deployment, no background work, no signature/hardware anti-rollback, no claims about origin/authenticity of external files. No clinical or personal student data.
