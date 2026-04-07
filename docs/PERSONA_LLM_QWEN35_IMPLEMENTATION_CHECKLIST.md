# Persona LLM Implementation Checklist (No-Training First)

This plan is based on a review of:
- `docs/persona-llm-spec.md`
- `Chat/src/services/chat/ChatService.ts`
- `Chat/src/services/chat/PromptBuilder.ts`
- `Chat/src/services/llm/LLMGateway.ts`
- `Chat/src/services/retrieval/RetrievalService.ts`
- `Chat/src/services/persona/PersonaService.ts`
- Existing docs in `docs/` (`STRICT_PERSONA_SYSTEM.md`, `TALK_LLM_INTEGRATION_PLAN.md`, `PHASE1_CHAT_ARCHITECTURE.md`)

Current strategy for this phase:
- [x] No custom model training required.
- [x] Focus on system instructions, retrieval gating, validation, and inference tuning.
- [x] Revisit fine-tuning only after enough high-quality data exists.

---

## 0) Target Outcome (must hold true)

- [ ] Persona stays in-character for >= 95% of eval prompts.
- [ ] Unsupported questions produce refusal-first responses (not guesses).
- [ ] Every non-refusal answer is evidence-grounded in retrieved data.
- [ ] No fabricated names/dates/places/relationships in acceptance eval set.
- [ ] Prompt/system-tuned model configuration meets groundedness and persona consistency targets without custom training.

---

## 1) Current-State Gaps (from review)

- [x] Current guardrails and post-validation exist, but behavior is still primarily prompt/regex-driven.
- [x] `PromptBuilder.buildPrompt` defaults to `temperature: 0.7` and `topP: 0.9`, which conflicts with strict grounding goals.
- [x] Retrieval can return empty results, but the system still proceeds to generation instead of deterministic refusal.
- [x] Fallback uncertainty response is randomized; response mode contract is not deterministic.
- [x] `PersonaService.getPersonDisplayName()` is hardcoded (`"Keith Buck"`), harming persona fidelity.
- [x] `LLMGateway.checkDocumentSupport()` has a logic bug (capitalized-word regex over lowercased text), reducing unsupported-claim detection quality.
- [x] `docs/persona-llm-spec.md` defines intent but leaves key sections as placeholders (system prompt and schema specifics).

---

## 2) Architecture Decision (locked)

- [x] Approach locked: Full redesign (greenfield replacement), not incremental refactor.
- [x] Existing persona/chat/RAG implementation can be removed and replaced in-place.
- [x] No versioning, feature flags, or dual-run model required in this phase.
- [ ] Lock response contract for all model outputs:
  - [ ] `FACT_SUPPORTED`
  - [ ] `STORY_SUPPORTED`
  - [ ] `QUOTE_SUPPORTED`
  - [ ] `INSUFFICIENT_EVIDENCE`
- [ ] Define strict output shape (internal JSON contract) before coding.
- [ ] Define refusal copy policy (single canonical phrase + optional safe variants).

Acceptance:
- [x] Redesign approach finalized (full replacement, no versioning).
- [ ] Response contract and refusal policy documented before coding starts.

---

## 3) Retrieval-First Grounding Layer (must happen before generation changes)

- [ ] Introduce an `EvidencePacket` domain object (query, chunks, scores, metadata, persona scope).
- [ ] Enforce mandatory retrieval gate:
  - [ ] If no evidence above threshold, skip LLM generation and return `INSUFFICIENT_EVIDENCE`.
- [ ] Add confidence thresholds:
  - [ ] minimum top score
  - [ ] minimum aggregate support
  - [ ] optional min distinct sources
- [ ] Add citation payload in retrieval output:
  - [ ] `documentId`
  - [ ] `chunkId`
  - [ ] source title
  - [ ] chunk offsets / excerpt
- [ ] Add hybrid retrieval plan (semantic + lexical) and reranking step.
- [ ] Add retrieval observability:
  - [ ] hit rate
  - [ ] empty retrieval rate
  - [ ] average top-k score

Acceptance:
- [ ] Unsupported queries are refused before LLM call.
- [ ] Supported queries carry citations through the pipeline.

---

## 4) Prompt and Inference Hardening

- [ ] Refactor prompt assembly to strict sections:
  - [ ] identity block (persona)
  - [ ] rules block (non-overridable)
  - [ ] evidence block (explicitly bounded)
  - [ ] user query
- [ ] Align inference defaults with spec:
  - [ ] `temperature: 0.0`
  - [ ] `top_p: 0.1`
  - [ ] penalties set to conservative values
- [ ] Remove setting drift across builder methods (`buildPrompt`, `buildPersonaPrompt`, extraction prompts).
- [ ] Add explicit rule: no claim unless directly grounded in evidence or verified facts.
- [ ] Standardize deterministic refusal mode (no random uncertainty phrase selection).

Acceptance:
- [ ] Prompt contract is consistent across chat and stream paths.
- [ ] Inference settings are centralized and environment-configurable.

---

## 5) Validation Layer 2.0 (claim-evidence, not regex-only)

- [ ] Keep regex checks for quick wins, but add structured claim validation:
  - [ ] extract atomic claims from draft response
  - [ ] verify each claim against `EvidencePacket`
  - [ ] fail response if unsupported claims exceed threshold
- [ ] Fix `checkDocumentSupport` bug and add tests for it.
- [ ] Implement deterministic enforcement policy:
  - [ ] High severity -> refusal response
  - [ ] Medium severity -> constrained rewrite or refusal
  - [ ] Low severity -> allow with logging
- [ ] Add explicit contradiction checks against verified persona facts.
- [ ] Add per-response audit record:
  - [ ] retrieved sources
  - [ ] violations
  - [ ] final response mode

Acceptance:
- [ ] Hallucination rate and unsupported-claim rate are measurable and trending down in evals.

---

## 6) Persona Data and Schema Completion

- [ ] Finalize schema definitions in `docs/persona-llm-spec.md`:
  - [ ] `PersonaProfile`
  - [ ] `StoryRecord`
  - [ ] `QuoteRecord`
  - [ ] `FactRecord`
- [ ] Add provenance fields for all memory records:
  - [ ] source document
  - [ ] source span/chunk
  - [ ] confidence
  - [ ] verification state
  - [ ] timestamp/era
- [ ] Replace hardcoded display name lookup with real person record retrieval.
- [ ] Add confidence and verification workflow for extracted facts/relationships.

Acceptance:
- [ ] Persona profile is fully derived from persisted data, no hardcoded identity.

---

## 7) Evaluation Harness (before custom model training)

- [ ] Build benchmark set (at least 4 categories):
  - [ ] answerable factual prompts
  - [ ] unanswerable prompts
  - [ ] adversarial injection prompts
  - [ ] persona-consistency prompts
- [ ] Define metrics:
  - [ ] grounded precision
  - [ ] unsupported-claim rate
  - [ ] refusal precision/recall
  - [ ] persona style consistency score
  - [ ] citation coverage
- [ ] Add repeatable eval runner for baseline vs candidate model.
- [ ] Store eval outputs for regression comparisons.

Acceptance:
- [ ] Baseline scorecard generated and checked in as reference.

---

## 8) Model Strategy (No-Training First)

### 8.1 Base Model Selection
- [ ] Select best available base instruct model for current stack (include at least one Qwen3.5 candidate).
- [ ] Confirm serving compatibility with current infrastructure (Ollama/runtime constraints).
- [ ] Lock one primary model and one fallback model for reliability.

### 8.2 System Instruction Pack
- [ ] Create canonical persona system instruction template v1.
- [ ] Create canonical refusal policy and uncertainty phrasing policy.
- [ ] Create strict response-mode contract prompt instructions (`FACT_SUPPORTED`, `STORY_SUPPORTED`, `QUOTE_SUPPORTED`, `INSUFFICIENT_EVIDENCE`).
- [ ] Add explicit non-negotiable grounding constraints and anti-injection clauses.

### 8.3 Inference and Prompt Tuning
- [ ] Tune decoding parameters using eval harness:
  - [ ] `temperature`
  - [ ] `top_p`
  - [ ] `top_k`
  - [ ] repeat penalty
  - [ ] max generation length
- [ ] Tune retrieval-to-context formatting for citation clarity.
- [ ] Tune prompt structure for concise, evidence-bounded responses.

### 8.4 Evaluation and Go/No-Go (No Training)
- [ ] Compare tuned configuration vs current baseline on full harness.
- [ ] Set launch thresholds (must pass):
  - [ ] lower unsupported-claim rate
  - [ ] higher refusal precision
  - [ ] equal or better persona consistency
  - [ ] acceptable latency/cost
- [ ] Freeze model + prompt + inference configuration as release candidate.

### 8.5 Deferred Training Gate (Future)
- [ ] Define minimum dataset threshold required to justify fine-tuning (quality + volume + labeling standards).
- [ ] Define training ROI criteria (expected gain vs effort/cost).
- [ ] Keep custom training explicitly out of current implementation scope.

Acceptance:
- [ ] Launch targets are achieved through prompt/inference/retrieval tuning alone.
- [ ] Custom model training remains deferred until data and ROI gates are met.

---

## 9) Cutover and Safety Operations (single-track)

- [ ] Prepare hard cutover plan (single production path, no version split):
  - [ ] freeze redesigned contracts before final integration
  - [ ] deploy redesigned pipeline as the only active path
  - [ ] run smoke checks immediately after deploy
- [ ] Add real-time monitoring dashboard:
  - [ ] refusal rate
  - [ ] hallucination/violation rate
  - [ ] retrieval-empty rate
  - [ ] citation-missing rate
- [ ] Add rollback protocol (revert to last known-good commit/image if needed).
- [ ] Run red-team suite weekly until stability targets are met.

Acceptance:
- [ ] Safe rollback verified in staging.
- [ ] Production monitoring alerts on drift.

---

## 10) Implementation Order (recommended)

- [ ] Step 1: Complete and lock `docs/persona-llm-spec.md` (no placeholders).
- [ ] Step 2: Define clean-slate service contracts and module boundaries for the new pipeline.
- [ ] Step 3: Implement retrieval gate + `EvidencePacket` + citation transport.
- [ ] Step 4: Implement unified prompt/inference policy and deterministic refusal behavior.
- [ ] Step 5: Implement validator 2.0 (claim-evidence checks + bug fixes + tests).
- [ ] Step 6: Implement persona data/provenance flow and remove hardcoded identity paths.
- [ ] Step 7: Build baseline evaluation harness and benchmark the current baseline.
- [ ] Step 8: Tune base model + prompt + inference configuration and freeze release candidate.
- [ ] Step 9: Evaluate, perform hard cutover to redesigned pipeline, and remove superseded code.
- [ ] Step 10: Document deferred fine-tuning gate and data requirements as backlog.

---

## 11) Definition of Done

- [ ] Placeholder sections removed from `docs/persona-llm-spec.md`.
- [ ] No-retrieval path returns deterministic `INSUFFICIENT_EVIDENCE` without generation.
- [ ] Response modes are enforced and logged for every answer.
- [ ] Citation payload available for all supported responses.
- [ ] Evaluation harness exists and is part of pre-release checks.
- [ ] Launch quality targets are met without custom model training.
- [ ] Fine-tuning scope is explicitly deferred behind data/ROI gates.
- [ ] Redesigned pipeline is the only active runtime path (no version split/feature-flag branch).
- [ ] Superseded persona/chat/LLM code paths are removed from runtime.
- [ ] Runbook exists for rollback and incident response.
