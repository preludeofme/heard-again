# Persona LLM Cutover and Safety Runbook (Step 9)

This runbook defines the single-track cutover plan, post-deploy smoke checks, rollback protocol, and weekly red-team operations for the redesigned Persona LLM pipeline.

## 1) Scope

Applies to:
- `Chat` service runtime path for persona responses
- strict response envelope and refusal policy
- retrieval-gated generation and validation controls

Out of scope:
- fine-tuning/training workflows (deferred)
- dual-track or feature-flag runtime splits

## 2) Hard Cutover Plan (Single Path)

### 2.1 Freeze redesigned contracts before final integration

1. Confirm release-candidate lock document is current:
   - `docs/PERSONA_LLM_RELEASE_CANDIDATE_V1.md`
2. Confirm strict envelope and response modes remain unchanged:
   - `FACT_SUPPORTED`
   - `STORY_SUPPORTED`
   - `QUOTE_SUPPORTED`
   - `INSUFFICIENT_EVIDENCE`
3. Confirm refusal copy is canonical and deterministic.

### 2.2 Deploy redesigned pipeline as the only active path

1. Deploy commit that contains Step 8 release candidate and this runbook.
2. Verify no feature flags/version split are routing traffic to superseded persona-chat runtime paths.
3. Ensure deployment manifest/env points to locked model policy:
   - `OLLAMA_PRIMARY_MODEL`
   - `OLLAMA_FALLBACK_MODEL`

### 2.3 Immediate smoke checks after deploy

Run in order:
1. Health checks (`/api/health` and `/api/health/detailed`)
2. Metrics endpoint check (`/api/metrics`) with valid service auth
3. Quick conversational checks against one known persona:
   - answerable factual prompt -> supported response + citation
   - unanswerable prompt -> canonical refusal
   - adversarial prompt -> refusal/guardrail behavior
4. Confirm `safety.alerts.*` flags in `/api/metrics` are all `false` at cutover.

## 3) Runtime Safety Monitoring

Dashboard source: `GET /api/metrics`

Tracked safety rates:
- refusal rate
- hallucination/violation rate
- retrieval-empty rate
- citation-missing rate

Implementation references:
- Collector: `Chat/src/services/monitoring/RuntimeSafetyMetrics.ts`
- Chat instrumentation: `Chat/src/services/chat/ChatService.ts`
- Metrics API: `Chat/src/pages/api/metrics.ts`

Alert env controls:
- `ALERT_MAX_REFUSAL_RATE`
- `ALERT_MAX_VIOLATION_RATE`
- `ALERT_MAX_RETRIEVAL_EMPTY_RATE`
- `ALERT_MAX_CITATION_MISSING_RATE`

## 4) Rollback Protocol

If post-cutover smoke checks fail or monitoring drifts:

1. Trigger rollback to the last known-good commit/image.
2. Revert model env to known-good values if changed.
3. Re-run smoke checks:
   - health endpoints
   - metrics endpoint
   - one answerable + one unanswerable chat check
4. Record incident details:
   - failure symptom and timestamp
   - impacted checks/metrics
   - rollback commit/image identifier
   - follow-up owner and action items

## 5) Incident Response Notes

Escalate immediately if any condition holds for 15+ minutes:
- `safety.alerts.violationRateDrift = true`
- `safety.alerts.citationMissingRateDrift = true`
- sustained refusal drift beyond configured threshold

Recommended first triage:
1. Confirm retrieval health and evidence quality.
2. Confirm model availability and fallback behavior.
3. Validate prompt release-candidate settings and env vars.
4. Compare latest eval scorecard against release baseline.

## 6) Weekly Red-Team Operations

Weekly cadence:
1. Run `npm run eval:release-candidate`.
2. Review:
   - `evals/results/*.scorecard.json`
   - `evals/results/*comparison.json`
   - `evals/results/release-candidate.go-no-go.json`
3. Focus on adversarial injection and unanswerable categories.
4. Open an incident/backlog ticket for any threshold regressions.

Pass condition:
- decision remains `GO` with no failed threshold checks.

## 7) Staging Rollback Verification Checklist

Before production cutover:
- [ ] execute rollback protocol in staging
- [ ] verify staging returns to healthy state
- [ ] document rollback duration and restore steps
- [ ] confirm smoke checks pass after rollback
