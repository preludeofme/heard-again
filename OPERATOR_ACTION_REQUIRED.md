# Operator Action Required

This file records failed or skipped actions that need follow-up.

## 2026-05-20 22:06:03 CDT — Project state review validation failures

During project state review, validation commands were run and failed with pre-existing project issues. No code changes were made.

Commands and results:

- `npm --workspace UI run typecheck` failed.
  - `UI/src/components/layout/SelectedFamilyMemberChip.tsx`: implicit `any` parameter `e`.
  - `UI/src/pages/_document.tsx`: `Head` and `NextScript` JSX component type errors.
  - `UI/src/pages/chat/[personId].tsx`: `<style jsx global>` props not accepted by current React/TS types.

- `npm --workspace UI test -- --runInBand` failed.
  - Jest haste collision with `.next/standalone/UI/package.json` versus `UI/package.json`.
  - ESM transform failures through `isomorphic-dompurify` / `@exodus/bytes`.
  - Trigger.dev tests fail with `TransformStream is not defined`.
  - CSRF tests and upload integration tests fail because mocked requests lack `req.cookies` and `validateCSRFToken` reads `req.cookies['csrf-token']`.
  - Narration worker expectations are stale relative to current RunPod/externalId and consent behavior.
  - Upload security WAV magic-byte test fails.
  - Jest includes helper/mock files with no tests: `contractHelpers.ts`, `mocks/uuid.ts`, `mocks/file-type.ts`.

- `npm --workspace Chat run type-check` passed.

Recommended follow-up:

1. Fix UI typecheck errors first.
2. Update Jest config to ignore `.next`, exclude helper/mock files, and handle ESM/Trigger.dev polyfills.
3. Fix CSRF null guard or test mocks for `req.cookies`.
4. Refresh narration/upload tests to match current implementation.
