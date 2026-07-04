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
- [x] Lock response contract for all model outputs:
  - [x] `FACT_SUPPORTED`
  - [x] `STORY_SUPPORTED`
  - [x] `QUOTE_SUPPORTED`
  - [x] `INSUFFICIENT_EVIDENCE`
- [x] Define strict output shape (internal JSON contract) before coding.
- [x] Define refusal copy policy (single canonical phrase + optional safe variants).

Acceptance:
- [x] Redesign approach finalized (full replacement, no versioning).
- [x] Response contract and refusal policy documented before coding starts.

---

## 3) Retrieval-First Grounding Layer (must happen before generation changes)

- [x] Introduce an `EvidencePacket` domain object (query, chunks, scores, metadata, persona scope).
- [x] Enforce mandatory retrieval gate:
  - [x] If no evidence above threshold, skip LLM generation and return `INSUFFICIENT_EVIDENCE`.
- [x] Add confidence thresholds:
  - [x] minimum top score
  - [x] minimum aggregate support
  - [x] optional min distinct sources
- [x] Add citation payload in retrieval output:
  - [x] `documentId`
  - [x] `chunkId`
  - [x] source title
  - [x] chunk offsets / excerpt
- [ ] Add hybrid retrieval plan (semantic + lexical) and reranking step.
- [ ] Add retrieval observability:
  - [ ] hit rate
  - [ ] empty retrieval rate
  - [ ] average top-k score

Acceptance:
- [x] Unsupported queries are refused before LLM call.
- [x] Supported queries carry citations through the pipeline.

---

## 4) Prompt and Inference Hardening

- [x] Refactor prompt assembly to strict sections:
  - [x] identity block (persona)
  - [x] rules block (non-overridable)
  - [x] evidence block (explicitly bounded)
  - [x] user query
- [x] Align inference defaults with spec:
  - [x] `temperature: 0.0`
  - [x] `top_p: 0.1`
  - [x] penalties set to conservative values
- [x] Remove setting drift across builder methods (`buildPrompt`, `buildPersonaPrompt`, extraction prompts).
- [x] Add explicit rule: no claim unless directly grounded in evidence or verified facts.
- [x] Standardize deterministic refusal mode (no random uncertainty phrase selection).

Acceptance:
- [x] Prompt contract is consistent across chat and stream paths.
- [x] Inference settings are centralized and environment-configurable.

---

## 5) Validation Layer 2.0 (claim-evidence, not regex-only)

- [x] Keep regex checks for quick wins, but add structured claim validation:
  - [x] extract atomic claims from draft response
  - [x] verify each claim against `EvidencePacket`
  - [x] fail response if unsupported claims exceed threshold
- [x] Fix `checkDocumentSupport` bug and add tests for it.
- [x] Implement deterministic enforcement policy:
  - [x] High severity -> refusal response
  - [x] Medium severity -> constrained rewrite or refusal
  - [x] Low severity -> allow with logging
- [ ] Add explicit contradiction checks against verified persona facts.
- [ ] Add per-response audit record:
  - [ ] retrieved sources
  - [ ] violations
  - [ ] final response mode

Acceptance:
- [ ] Hallucination rate and unsupported-claim rate are measurable and trending down in evals.

---

## 6) Persona Data and Schema Completion

- [x] Finalize schema definitions in `docs/persona-llm-spec.md`:
  - [x] `PersonaProfile`
  - [x] `StoryRecord`
  - [x] `QuoteRecord`
  - [x] `FactRecord`
- [x] Add provenance fields for all memory records:
  - [x] source document
  - [x] source span/chunk
  - [x] confidence
  - [x] verification state
  - [x] timestamp/era
- [x] Replace hardcoded display name lookup with real person record retrieval.
- [ ] Add confidence and verification workflow for extracted facts/relationships.

Acceptance:
- [x] Persona profile is fully derived from persisted data, no hardcoded identity.

---

## 7) Evaluation Harness (before custom model training)

- [x] Build benchmark set (at least 4 categories):
  - [x] answerable factual prompts
  - [x] unanswerable prompts
  - [x] adversarial injection prompts
  - [x] persona-consistency prompts
- [x] Define metrics:
  - [x] grounded precision
  - [x] unsupported-claim rate
  - [x] refusal precision/recall
  - [x] persona style consistency score
  - [x] citation coverage
- [x] Add repeatable eval runner for baseline vs candidate model.
- [x] Store eval outputs for regression comparisons.

Acceptance:
- [x] Baseline scorecard generated and checked in as reference.

---

## 8) Model Strategy (No-Training First)

### 8.1 Base Model Selection
- [x] Select best available base instruct model for current stack (include at least one Qwen3.5 candidate).
- [x] Confirm serving compatibility with current infrastructure (Ollama/runtime constraints).
- [x] Lock one primary model and one fallback model for reliability.

### 8.2 System Instruction Pack
- [x] Create canonical persona system instruction template v1.
- [x] Create canonical refusal policy and uncertainty phrasing policy.
- [x] Create strict response-mode contract prompt instructions (`FACT_SUPPORTED`, `STORY_SUPPORTED`, `QUOTE_SUPPORTED`, `INSUFFICIENT_EVIDENCE`).
- [x] Add explicit non-negotiable grounding constraints and anti-injection clauses.

### 8.3 Inference and Prompt Tuning
- [x] Tune decoding parameters using eval harness:
  - [x] `temperature`
  - [x] `top_p`
  - [x] `top_k`
  - [x] repeat penalty
  - [x] max generation length
- [x] Tune retrieval-to-context formatting for citation clarity.
- [x] Tune prompt structure for concise, evidence-bounded responses.

### 8.4 Evaluation and Go/No-Go (No Training)
- [x] Compare tuned configuration vs current baseline on full harness.
- [x] Set launch thresholds (must pass):
  - [x] lower unsupported-claim rate
  - [x] higher refusal precision
  - [x] equal or better persona consistency
  - [x] acceptable latency/cost
- [x] Freeze model + prompt + inference configuration as release candidate.

### 8.5 Deferred Training Gate (Future)
- [x] Define minimum dataset threshold required to justify fine-tuning (quality + volume + labeling standards).
- [x] Define training ROI criteria (expected gain vs effort/cost).
- [x] Keep custom training explicitly out of current implementation scope.

Acceptance:
- [x] Launch targets are achieved through prompt/inference/retrieval tuning alone.
- [x] Custom model training remains deferred until data and ROI gates are met.

---

## 9) Cutover and Safety Operations (single-track)

- [x] Prepare hard cutover plan (single production path, no version split):
  - [x] freeze redesigned contracts before final integration
  - [x] deploy redesigned pipeline as the only active path
  - [x] run smoke checks immediately after deploy
- [x] Add real-time monitoring dashboard:
  - [x] refusal rate
  - [x] hallucination/violation rate
  - [x] retrieval-empty rate
  - [x] citation-missing rate
- [x] Add rollback protocol (revert to last known-good commit/image if needed).
- [ ] Run red-team suite weekly until stability targets are met.

Acceptance:
- [ ] Safe rollback verified in staging.
- [x] Production monitoring alerts on drift.

---

## 10) Implementation Order (recommended)

- [x] Step 1: Complete and lock `docs/persona-llm-spec.md` (no placeholders).
- [x] Step 2: Define clean-slate service contracts and module boundaries for the new pipeline.
- [x] Step 3: Implement retrieval gate + `EvidencePacket` + citation transport.
- [x] Step 4: Implement unified prompt/inference policy and deterministic refusal behavior.
- [x] Step 5: Implement validator 2.0 (claim-evidence checks + bug fixes + tests).
- [x] Step 6: Implement persona data/provenance flow and remove hardcoded identity paths.
- [x] Step 7: Build baseline evaluation harness and benchmark the current baseline.
- [x] Step 8: Tune base model + prompt + inference configuration and freeze release candidate.
- [ ] Step 9: Evaluate, perform hard cutover to redesigned pipeline, and remove superseded code.
- [ ] Step 10: Document deferred fine-tuning gate and data requirements as backlog.

---

## 11) Definition of Done

- [x] Placeholder sections removed from `docs/persona-llm-spec.md`.
- [x] No-retrieval path returns deterministic `INSUFFICIENT_EVIDENCE` without generation.
- [ ] Response modes are enforced and logged for every answer.
- [ ] Citation payload available for all supported responses.
- [x] Evaluation harness exists and is part of pre-release checks.
- [x] Launch quality targets are met without custom model training.
- [x] Fine-tuning scope is explicitly deferred behind data/ROI gates.
- [ ] Redesigned pipeline is the only active runtime path (no version split/feature-flag branch).
- [ ] Superseded persona/chat/LLM code paths are removed from runtime.
- [x] Runbook exists for rollback and incident response.
