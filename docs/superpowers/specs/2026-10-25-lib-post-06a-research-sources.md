# LIB — Post-LIB-06A Research Sources

**Data:** 2026-10-25  
**Scope:** external evidence used by the post-LIB-06A product/architecture audit.  
**Status:** RESEARCH RECEIPT / DOCS ONLY

## Product and Human-AI UX

### Nielsen Norman Group — Progressive Disclosure

https://www.nngroup.com/articles/progressive-disclosure/

Used for:
- show only a small number of important choices initially;
- disclose specialized/advanced options on request;
- avoid permanent feature walls.

### Microsoft Research — Guidelines for Human-AI Interaction

https://www.microsoft.com/en-us/research/articles/guidelines-for-human-ai-interaction-eighteen-best-practices-for-human-centered-ai-design/

Used for:
- time services based on context;
- show contextually relevant information;
- support efficient invocation, dismissal and correction;
- make system behavior understandable.

### Microsoft HAX — Scope services when in doubt

https://www.microsoft.com/en-us/haxtoolkit/guideline/scope-services-when-in-doubt/

Used for:
- disambiguate before acting;
- gracefully degrade when user goals are uncertain.

### Google People + AI Guidebook — Patterns / Feedback + Control / Errors

https://pair.withgoogle.com/guidebook-v2/patterns

https://pair.withgoogle.com/guidebook-v2/chapter/feedback-controls/

https://pair.withgoogle.com/chapter/errors-failing/

Used for:
- partial automation and user supervision;
- preserve user control;
- provide a path forward when AI fails;
- increase automation progressively rather than by default.

## Education, privacy and human agency

### UNESCO — Guidance for generative AI in education and research

https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research

Used for:
- human-centred adoption;
- data-privacy protection;
- pedagogical/ethical validation rather than uncontrolled automation.

## Intent classification / abstention

### den Hengst et al. — Conformal Intent Classification and Clarification, NAACL 2024

https://aclanthology.org/2024.findings-naacl.156/

Used for:
- ambiguity-aware intent classification;
- small targeted clarification sets;
- out-of-scope detection.

### Zawbaa et al. — Improved Out-of-Scope Intent Classification, LREC-COLING 2024

https://aclanthology.org/2024.lrec-main.763/

Used for:
- OOS detection as a first-class requirement;
- threshold-based re-classification evidence.

### Li et al. — Generating Hard-Negative Out-of-Scope Data, LREC-COLING 2024

https://aclanthology.org/2024.lrec-main.674/

Used for:
- hard-negative OOS examples are harder and must be represented in evaluation;
- robust intent qualification should not rely only on obvious OOS utterances.

## Local/on-device model feasibility

### Hugging Face — Transformers.js

https://huggingface.co/docs/transformers.js/en/index

https://huggingface.co/docs/transformers.js/guides/webgpu

Used for:
- in-browser Transformer inference is technically feasible through ONNX Runtime;
- WASM is the broad fallback; WebGPU can accelerate but is not universal;
- quantization is recommended in resource-constrained browser environments.

Audit consequence: this is a future option, not current evidence that the deterministic feature-hash intent embedding must be replaced.

## Local-first architecture

### Ink & Switch — Local-first software

https://www.inkandswitch.com/essay/local-first/

Used for:
- user ownership and agency;
- offline/local resilience;
- privacy and long-term control of user data.

## Research ruling

The external evidence supports the following sequence:

1. consolidate the interaction model and progressive disclosure;
2. preserve explicit human control and Core authority;
3. measure OOS/ambiguity on a realistic teacher-utterance corpus;
4. only then decide whether clarification or a heavier local model is justified;
5. do not expand the capability catalog merely because the infrastructure can support it.
