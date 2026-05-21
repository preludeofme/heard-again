# Heard Again Task Log

Last updated: 2026-05-20 22:29:29 CDT

This is an append-oriented log for project work. Keep entries concise and factual.

## 2026-05-20 — Project rediscovery and memory docs

### Infrastructure tasks completed
- Successfully updated production Google OAuth credentials.
- Configured Vercel `TTS_PROVIDER=runpod_serverless` and `RUNPOD_TTS_ENDPOINT_ID`.
- Fixed `CHAT_SYSTEM_URL` to the bare chat-service base URL.
- Configured Cloudflare R2 CORS for direct browser PUT uploads.

### Commands run

- `pwd`
- `date '+%Y-%m-%d %H:%M:%S %Z'`
- `git status --short --branch`
- `git log --oneline -5`
- File searches and reads through Hermes file tools.

### Findings

- Working branch at discovery was `main`.
- Recent HEAD at discovery was `35a6074 fix: cleaned up docs`.
- Working tree had untracked `.claude/` before project memory docs were written.
- Trigger.dev root config points tasks to `UI/src/trigger`.
- Missing RunPod worker remains documented as outstanding.
- QA report contains critical user-facing blockers around sign out, profile edit date fields, and delete confirmation.

### Recommended next task

Fix profile edit 400 errors caused by empty date fields being submitted as empty strings.

### Validation status

No product code changes were made in this pass. Validation for this pass is limited to verifying that the project memory docs exist and contain the intended handoff context.

## 2026-05-20 — Infrastructure tasks marked complete

### Completed

- Marked manual infrastructure/deployment tasks complete based on Ryan's update:
  - Production Google OAuth credentials updated.
  - Vercel `TTS_PROVIDER=runpod_serverless` and `RUNPOD_TTS_ENDPOINT_ID=gjtkiwlc3ja3y3` set.
  - Vercel `CHAT_SYSTEM_URL` fixed to the bare chat-service base URL.
  - Cloudflare R2 CORS configured for direct browser PUT uploads.

### Notes

- No secret values were recorded.
- Remaining RunPod worker item should be reassessed separately as a code-side architecture/deployment task.

## 2026-05-20 — Fixed duplicate React invalid-hook-call blocker

### Completed

- Reproduced `/login` runtime failure: `Cannot read properties of null (reading 'useState')` with Next.js invalid hook call warning.
- Confirmed root cause was duplicate React installs:
  - root `node_modules/react` / `react-dom` at `19.2.6`
  - stale nested `UI/node_modules/react` / `react-dom` at `19.2.4`
- Updated `UI/package.json` to pin `react` and `react-dom` to `19.2.6`.
- Removed stale nested React package-lock entries and ran `npm install --workspaces`, leaving React resolved only from root `node_modules`.
- Updated `UI/next.config.js` webpack aliases for `react`, `react-dom`, `react/jsx-runtime`, and `react/jsx-dev-runtime` to the workspace root React packages.

### Validation

- Verified no nested UI React packages remain physically installed.
- Verified `/login` renders successfully via browser automation against `https://localhost:4777/login`.
- Verified rendered page text includes the login UI and no `useState` / invalid hook call errors were reported in the browser run.
- Screenshot captured at `/tmp/heard-again-login-react-fixed.png`.

### Follow-up notes

- Full `npm run dev` still reports separate non-blocking service issues:
  - Trigger.dev CLI profile/project mismatch for `proj_pcwbloaahiyfikeyicmv`.
  - TTS model startup import error: `cannot import name 'auto_docstring' from 'transformers.utils'`.
- These did not block the main login UI render test.
