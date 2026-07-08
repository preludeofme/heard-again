# E2E Test Suite

End-to-end tests for Heard Again, built on [Playwright](https://playwright.dev).
The suite exercises the real app — real signup API, real NextAuth login, real
PostgreSQL writes — with no mocked internals.

## Quick start

```bash
# 1. Start the full stack (PostgreSQL, Redis, UI at https://localhost:4777)
npm run dev

# 2. Install browsers once
npx playwright install chromium

# 3. Run the suite
npm run test:e2e

# 4. Optional: purge test users/familyspaces from the dev database
npm run test:e2e:cleanup
```

The suite targets `https://localhost:4777` by default. Point it elsewhere with
`PLAYWRIGHT_BASE_URL=https://host:port npm run test:e2e`. A global setup pings
the target first and fails fast with a clear message if the app isn't running.

## Scripts

| Script                 | What it does                              |
| ---------------------- | ----------------------------------------- |
| `npm run test:e2e`         | Full suite, headless                  |
| `npm run test:e2e:ui`      | Playwright UI mode                    |
| `npm run test:e2e:debug`   | Step-through debugging (`--debug`)    |
| `npm run test:e2e:headed`  | Headed browsers                       |
| `npm run test:e2e:report`  | Open the last HTML report             |
| `npm run test:e2e:cleanup` | Delete all E2E users + familyspaces from the dev DB |

Run one spec / one test:

```bash
npx playwright test e2e/stories/stories.spec.ts
npx playwright test e2e/auth/auth.spec.ts -g "invalid credentials"
```

## Projects (viewports)

- **desktop-chromium** — the entire suite at a desktop viewport.
- **mobile-chromium** — Pixel-7 viewport, running only tests tagged `@mobile`
  (the highest-value flows: signup, login, onboarding, create/view story,
  person profile, bottom-nav navigation). Tests tagged `@mobile-only` exercise
  mobile-specific UI and are excluded from the desktop project.

## Test files (by feature area)

### auth/
| `auth.spec.ts`             | Registration, duplicate email, login (valid/invalid), logout, password recovery, protected-route redirects, session persistence |
| `onboarding.spec.ts`       | Wizard validation, completion, persistence across reload/re-login, pre-onboarding empty tree |

### stories/
| `stories.spec.ts`          | Create via UI, validation, lens listing, detail view, special characters, long content, edit, delete, empty state |
| `story-advanced.spec.ts`   | Narrative generation, voice profiles, publishing, collections |

### family/
| `family-lifecycle.spec.ts` | The full journey: signup → onboarding → add relative with relationship → edit → delete (single-flow regression guard) |
| `family-merge.spec.ts`     | Merging duplicate family members |
| `people.spec.ts`           | Person creation validation, person profile pages, tree ↔ profile navigation |

### voice/
| `voice-pipeline.spec.ts`   | Voice cloning, training, synthesis end-to-end |
| `consent.spec.ts`          | Voice-consent lifecycle: grant, duplicate guard, validation, cross-familyspace refusal, persistence across sessions, revoke + re-grant |

### account/
| `account-security.spec.ts` | MFA setup, session management, account settings, linked-person pairing |
| `billing.spec.ts`          | Free-plan baseline + entitlements, plan catalog, subscription tab, Stripe test-mode checkout start, abandoned checkout leaves plan unchanged |
| `password-reset.spec.ts`   | Forgot password flow, reset token validation, new password enforcement |

### ui/
| `public-pages.spec.ts`     | Landing page, terms, privacy — rendered and responsive |
| `navigation.spec.ts`       | Desktop top nav, memories lens switching + deep links, user menu, legacy-route redirects, mobile bottom nav, back behaviour |
| `empty-states.spec.ts`     | New-family empty states and a simulated API failure with retry recovery |
| `page-ui.spec.ts`          | Visual regression and responsive layout checks |
| `screenshots.spec.ts`      | Screenshot capture for documentation |

### Other
| `access-control.spec.ts` (access/) | Unauthenticated 401s, cross-familyspace isolation, CSRF enforcement |
| `multi-familyspace.spec.ts` (social/) | Cross-familyspace interactions, invites, role switching |
| `collections-interactions.spec.ts` (collections/) | Collections CRUD and interactions |
| `search-deep.spec.ts` (collections/) | Full-text search across stories, people, documents |
| `timeline-deep.spec.ts` (timeline/) | Timeline event creation, reordering, GEDCOM integration |
| `media-uploads.spec.ts` (audio/) | Audio/file upload flows and validation |
| `support-contact.spec.ts` (support/) | Contact form and support flows |
| `import-export.spec.ts` (impexp/) | GEDCOM import/export, JSON/PDF export |

Shared infrastructure:

- `helpers/api.ts` — `TestUser`: API-level factory (signup → login → onboard)
  with CSRF-aware request helpers and story/person creation shortcuts.
- `fixtures.ts` — the `user` fixture (fresh onboarded user, cookies installed
  on the default browser context), `signUpFreshUser`, `expectAlert`.
- `global-setup.ts` — reachability check.
- `cleanup-test-data.mjs` — targeted DB purge (see below).

> `full-suite.spec.ts` and `screenshots.spec.ts` are **legacy** files that
> predate this suite (they target removed routes and a pre-seeded demo user).
> They are excluded via `testIgnore` in `playwright.config.ts` and can be
> deleted.

## Test-data strategy

- Every test creates its **own isolated user + familyspace** through the real
  public signup API — no pre-seeded accounts, no production data, no
  cross-test coupling.
- Emails follow a reserved pattern: `e2e-<prefix>-<runId>@heardagain.test`
  (unique per run/process — repeated runs never collide).
- Cleanup is opt-in and targeted: `npm run test:e2e:cleanup` deletes only
  users matching `e2e-*@heardagain.test` and the familyspaces they own
  (cascading their people/stories/memberships/subscriptions). Leftover rows
  between runs are harmless — each run uses fresh identities.
- Each simulated user/browser context presents a unique synthetic client IP
  (`x-forwarded-for`), so the app's per-IP rate limits behave as they would
  for real, distinct users instead of tripping on a single test machine.

## External services

| Service            | Approach in the suite                                              |
| ------------------ | ------------------------------------------------------------------ |
| Stripe             | Test mode only. `subscribe` creates a Checkout *session* (URL/secret asserted); the suite never opens Stripe, never enters a card, and asserts an abandoned checkout leaves the plan on FREE. |
| Email (SMTP)       | Never asserted on. Signup/reset emails are fire-and-forget server-side; the reset flow is tested up to the anti-enumeration confirmation screen. |
| TTS / voice cloning| Not called. Consent (the safety-critical part) is DB-backed and fully tested via API; voice training/synthesis needs the GPU TTS service and is deferred (see below). |
| ClamAV / storage   | Not exercised — file-upload pipelines are deferred (see below).    |

## Intentionally deferred

- **Voice training / narration / audio playback** — requires the GPU TTS
  service; not available in most dev/CI environments.
- **Audio recording via microphone** — the contribute page supports it, but
  the save path goes through presigned R2/storage uploads which aren't
  provisioned everywhere; revisit with a storage fake.
- **Completing Stripe Checkout / webhook delivery** — needs `stripe listen`
  forwarding; covered manually (see `.claude/memory/handoff.md`) and by unit
  tests of the webhook handler's callers.
- **MFA challenge login** — email-code delivery isn't capturable yet; needs a
  local mailbox (e.g. Mailpit) first.
- **GEDCOM import/export, collections, comments, favorites, search,
  family-merge** — secondary flows; add specs incrementally using the same
  `TestUser` fixture.

## CI

The suite is CI-ready but requires a running stack:

```yaml
# sketch
- run: docker compose up -d postgres redis      # or service containers
- run: npm ci && npm --workspace UI run db:push && npm run db:seed
- run: npx playwright install --with-deps chromium
- run: npm --workspace UI run build && npm --workspace UI run start &   # or npm run dev
- run: PLAYWRIGHT_BASE_URL=http://localhost:4776 npm run test:e2e
```

CI behaviour is preconfigured: 1 worker, 2 retries, trace on first retry,
screenshots on failure, HTML report in `playwright-report/`.

## Environment variables

| Variable              | Default                   | Purpose                    |
| --------------------- | ------------------------- | -------------------------- |
| `PLAYWRIGHT_BASE_URL` | `https://localhost:4777`  | Target app URL             |
| `DATABASE_URL`        | read from `UI/.env`       | Only for `test:e2e:cleanup` |

No other variables are required — test users are self-created.

## Conventions for new tests

- Import `test`/`expect` from `./fixtures`, not `@playwright/test`.
- Need an authenticated page? Add `user` to the test args — done.
- Prefer `getByRole` / `getByLabel` / `getByText`; avoid CSS classes.
- Create data through `TestUser` helpers (API), assert through the UI — or
  vice versa; every test should verify a real persisted outcome.
- Tag with `@mobile` if the flow is core enough to run on the phone viewport;
  `@mobile-only` if it exercises mobile-specific UI.
