# Persona LLM Release Candidate v1 (No-Training First)

Status: Frozen for Step 8 go/no-go.

## 1) Model Strategy

Runtime:
- Provider: `ollama`
- Minimum runtime version: `0.5.0`

Locked models:
- Primary: `qwen3.5:8b-instruct`
- Fallback: `llama3.1:8b-instruct`
- Embeddings: `nomic-embed-text:latest`

Implementation refs:
- `Chat/src/config/releaseCandidate.ts`
- `Chat/src/services/llm/LLMGateway.ts`

## 2) Prompt & Inference Policy (Frozen)

Chat decoding:
- `temperature`: `0.0`
- `top_p`: `0.08`
- `top_k`: `24`
- `repeat_penalty`: `1.15`
- `max_tokens`: `420`

Style analysis decoding:
- `temperature`: `0.2`
- `top_p`: `0.7`
- `top_k`: `30`
- `repeat_penalty`: `1.05`
- `max_tokens`: `800`

Fact/relationship extraction decoding:
- `temperature`: `0.05`
- `top_p`: `0.2`
- `top_k`: `20`
- `repeat_penalty`: `1.1`
- `max_tokens`: `1024`

Prompt/context tuning:
- Max context tokens: `7000`
- Max context docs: `5`
- Max excerpt tokens per evidence block: `280`
- Citation-ready context formatting with `[documentId:chunkId]` headers

Implementation refs:
- `Chat/src/services/chat/PromptBuilder.ts`
- `Chat/src/services/persona/PersonaService.ts`

## 3) Evaluation Go/No-Go

Runner commands:
- `npm run eval:compare`
- `npm run eval:go-no-go`
- `npm run eval:release-candidate`

Artifacts:
- Baseline scorecard: `Chat/evals/results/baseline-current.scorecard.json`
- Candidate scorecard: `Chat/evals/results/candidate-example.scorecard.json`
- Comparison: `Chat/evals/results/baseline-current-vs-candidate-example.comparison.json`
- Go/no-go decision: `Chat/evals/results/release-candidate.go-no-go.json`

Current result:
- Decision: `GO`

Launch thresholds (must pass):
- grounded precision `>= 0.90`
- unsupported-claim rate `<= 0.05`
- refusal precision `>= 0.95`
- refusal recall `>= 0.95`
- persona style consistency `>= 0.85`
- citation coverage `>= 0.95`
- p95 latency `<= 4500 ms`
- mean tokens/response `<= 420`

## 4) Deferred Training Gate (Future)

Minimum dataset gate before fine-tuning:
- At least `1,500` high-quality labeled dialogue turns
- At least `300` refusal-required turns
- At least `300` adversarial injection turns
- Citation-grounded labels with reviewer agreement `>= 0.9`

ROI gate before fine-tuning:
- Expected unsupported-claim reduction `>= 20%` vs release candidate
- Expected refusal precision improvement `>= 5%`
- No regression in persona consistency
- Total training + serving cost justified against evaluation gains

Scope rule:
- Custom model training remains out of scope until both data and ROI gates are satisfied.
