# Persona LLM + Qwen3.5 Implementation Checklist

This plan is based on a review of:
- `docs/persona-llm-spec.md`
- `Chat/src/services/chat/ChatService.ts`
- `Chat/src/services/chat/PromptBuilder.ts`
- `Chat/src/services/llm/LLMGateway.ts`
- `Chat/src/services/retrieval/RetrievalService.ts`
- `Chat/src/services/persona/PersonaService.ts`
- Existing docs in `docs/` (`STRICT_PERSONA_SYSTEM.md`, `TALK_LLM_INTEGRATION_PLAN.md`, `PHASE1_CHAT_ARCHITECTURE.md`)

---

## 0) Target Outcome (must hold true)

- [ ] Persona stays in-character for >= 95% of eval prompts.
- [ ] Unsupported questions produce refusal-first responses (not guesses).
- [ ] Every non-refusal answer is evidence-grounded in retrieved data.
- [ ] No fabricated names/dates/places/relationships in acceptance eval set.
- [ ] Qwen3.5-based custom model outperforms current baseline on groundedness and persona consistency.

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

## 2) Architecture Decision Gate (restart vs increment)

- [ ] Decide approach:
  - [ ] Option A: Incremental refactor on current services (recommended for faster delivery).
  - [ ] Option B: Fresh persona/chat pipeline behind feature flag.
- [ ] Lock response contract for all model outputs:
  - [ ] `FACT_SUPPORTED`
  - [ ] `STORY_SUPPORTED`
  - [ ] `QUOTE_SUPPORTED`
  - [ ] `INSUFFICIENT_EVIDENCE`
- [ ] Define strict output shape (internal JSON contract) before coding.
- [ ] Define refusal copy policy (single canonical phrase + optional safe variants).

Acceptance:
- [ ] Team agrees on A or B and contract is documented before implementation starts.

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

## 8) Qwen3.5 Custom Model Plan (focused on grounding + persona fidelity)

### 8.1 Base Model + Scope
- [ ] Select base (`Qwen3.5 Instruct` variant) by quality/latency budget.
- [ ] Confirm licensing and deployment constraints.
- [ ] Decide tuning strategy:
  - [ ] QLoRA (recommended first)
  - [ ] optional full fine-tune later if needed

### 8.2 Training Data
- [ ] Build supervised dataset with strict templates:
  - [ ] grounded answer examples with citations
  - [ ] refusal examples for insufficient evidence
  - [ ] anti-hallucination negatives (bad -> corrected)
  - [ ] style-preserving persona examples
- [ ] Add hard-negative prompts that tempt speculation.
- [ ] Split data into train/validation/test with persona/workspace leakage controls.

### 8.3 Training
- [ ] Run SFT (LoRA/QLoRA) on structured persona-grounded format.
- [ ] Optional preference tuning (DPO/ORPO) for:
  - [ ] refusal preference over guessing
  - [ ] citation-backed preference over uncited answers
- [ ] Track run config, checkpoints, and reproducibility metadata.

### 8.4 Packaging + Serving
- [ ] Export adapter/merged model.
- [ ] Quantize for serving target(s) (if Ollama path, prepare compatible artifacts).
- [ ] Create model deployment manifest/config with fixed inference params.
- [ ] Add canary route or model flag for gradual rollout.

### 8.5 Evaluation and Go/No-Go
- [ ] Compare Qwen3.5 custom model vs current baseline on full harness.
- [ ] Set launch thresholds (must pass):
  - [ ] lower unsupported-claim rate
  - [ ] higher refusal precision
  - [ ] equal or better persona consistency
  - [ ] acceptable latency/cost

Acceptance:
- [ ] Custom model only promoted if all go/no-go thresholds are met.

---

## 9) Rollout and Safety Operations

- [ ] Add feature flags:
  - [ ] by workspace
  - [ ] by persona
  - [ ] by endpoint (`sendMessage` vs `streamResponse`)
- [ ] Add real-time monitoring dashboard:
  - [ ] refusal rate
  - [ ] hallucination/violation rate
  - [ ] retrieval-empty rate
  - [ ] citation-missing rate
- [ ] Add rollback protocol (single-switch revert to baseline model + old policy).
- [ ] Run red-team suite weekly until stability targets are met.

Acceptance:
- [ ] Safe rollback verified in staging.
- [ ] Production monitoring alerts on drift.

---

## 10) Implementation Order (recommended)

- [ ] Step 1: Complete and lock `docs/persona-llm-spec.md` (no placeholders).
- [ ] Step 2: Implement retrieval gate + `EvidencePacket` + citation transport.
- [ ] Step 3: Unify prompt/inference configuration and deterministic refusal behavior.
- [ ] Step 4: Upgrade validator (claim-evidence checks + bug fixes + tests).
- [ ] Step 5: Replace hardcoded persona fields and complete schema/provenance flow.
- [ ] Step 6: Build baseline evaluation harness and run current model.
- [ ] Step 7: Train Qwen3.5 custom model (QLoRA SFT -> optional preference tuning).
- [ ] Step 8: Evaluate, canary deploy, monitor, and roll out gradually.

---

## 11) Definition of Done

- [ ] Placeholder sections removed from `docs/persona-llm-spec.md`.
- [ ] No-retrieval path returns deterministic `INSUFFICIENT_EVIDENCE` without generation.
- [ ] Response modes are enforced and logged for every answer.
- [ ] Citation payload available for all supported responses.
- [ ] Evaluation harness exists and is part of pre-release checks.
- [ ] Qwen3.5 custom model is benchmarked and only promoted if thresholds are met.
- [ ] Runbook exists for rollback and incident response.
