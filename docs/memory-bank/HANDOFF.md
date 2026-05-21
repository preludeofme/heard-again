# Heard Again Handoff

Last updated: 2026-05-20 22:10:40 CDT

## Current goal

Continue Heard Again development with project state preserved in repository docs so future Hermes/Codex sessions can resume without rediscovery.

## Current state

The project context has been rediscovered and summarized into project memory docs.

Project root:

`/home/trubuck-design/Projects/Personal/heard-again`

Git state at discovery:

- Branch: `main`
- Recent HEAD: `35a6074 fix: cleaned up docs`
- Only untracked `.claude/` existed before these docs were written.

## Files created in this handoff pass

- `docs/PROJECT_STATUS.md`
- `docs/HANDOFF.md`
- `docs/DECISIONS.md`
- `docs/TASK_LOG.md`

## Context read during discovery

- `AGENTS.md`
- `CLAUDE.md`
- `GEMINI.md`
- `README.md`
- `package.json`
- `UI/package.json`
- `Chat/package.json`
- `trigger.config.ts`
- `todo.md`
- `qa_validation_report.md`
- `docs/archived-dev-docs/OUTSTANDING_TASKS.md`
- `docs/archived-dev-docs/LOCAL_INFRA_GAP_ANALYSIS.md`

## Important implementation context

- UI is Next.js Pages Router.
- UI depends heavily on `SelectedFamilyMemberContext`.
- Prisma schema is shared at `prisma/schema.prisma`.
- After Prisma schema edits, run Prisma generation.
- Root package manager is npm workspaces, not pnpm/yarn.
- Root scripts include:
  - `npm run dev`
  - `npm run build`
  - `npm run type-check`
  - `npm run verify`
  - `npm run db:generate`
  - `npm run db:migrate`
- UI package scripts include:
  - `npm run typecheck`
  - `npm run test`
  - `npm run build`
  - `npm run db:generate`
- Chat package scripts include:
  - `npm run type-check`
  - `npm run test`
  - `npm run eval:release-candidate`

## Known issues / blockers

### Product QA blockers

From `qa_validation_report.md`:

1. Sign out redirects to a 404 route.
2. Profile edit returns 400 when date fields are empty strings.
3. Relative/person delete in profile preview is missing confirmation and can delete immediately.
4. Media/document/audio flows need follow-up validation after blockers are fixed.

### Infrastructure / deployment status

- Manual infrastructure tasks are completed per Ryan on 2026-05-20:
  - Production Google OAuth credentials updated.
  - Vercel `TTS_PROVIDER=runpod_serverless` and `RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3` set.
  - Vercel `CHAT_SYSTEM_URL` fixed to bare chat-service base URL, not `/api/chat` suffixed URL.
  - Cloudflare R2 CORS configured for direct browser PUT uploads.
- Remaining code-side deployment item: missing RunPod serverless Python worker at `RunPod/worker/handler.py` if RunPod serverless is still required by the current architecture.

## Recommended next action

Fix the profile edit 400 error first.

Target behavior:

- Empty date form fields should not be sent as empty strings.
- Convert `""` to `null`, or omit the key, before sending the PUT request.
- Confirm the affected flow works for both family tree relative editing and relative profile editing.

Suggested search terms:

- `birthDate`
- `deathDate`
- `Save Changes`
- profile edit components
- family tree edit modal/sidebar components

Validation after fix:

- Run targeted UI typecheck if feasible: `npm --workspace UI run typecheck`
- Run any nearest related tests if present.
- Manually verify the edit flow if the dev app is running.

## Next queue after recommended task

1. Fix sign-out callback URL to redirect to `/login` or a known valid route.
2. Add shared `ConfirmDialog` around destructive person/relative deletion in the preview modal.
3. Re-run relevant QA flows from `qa_validation_report.md`.
4. Reassess whether the RunPod worker is still needed after current infrastructure completion; if yes, implement/scaffold it after user-facing QA blockers are handled unless deployment becomes the priority.

## Notes for future agents

- Do not assume archived docs are stale; many recent outstanding items were generated from archived migration docs and are still relevant.
- Do not print secrets from `.env`, Vercel, Trigger.dev, RunPod, or R2.
- Avoid broad rewrites. Prefer small focused diffs and targeted validation.
- Keep this file and `docs/PROJECT_STATUS.md` updated after each completed task.
