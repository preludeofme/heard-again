# Family Search Contains Matching Fix

## Date
2026-05-23

## Problem
The family member search flyout could show no results for partial, case-insensitive substrings such as `rya`, even when matching members existed (`Bryan`, `Ryan`, `Enryan`, etc.).

## Findings
- The `/api/people` service builds a Prisma `contains` + `mode: 'insensitive'` name search across individual name fields.
- The family tree searchable-people loader had a stale response-shape assumption (`data.data.people`), but `/api/people` returns a flat array at `data.data`.
- The member switcher filtered only the displayed label, which can miss alternate name fields when display names differ from first/middle/last names.

## Solution
- Centralized the people-name search field list in `UI/src/lib/person-search.ts` and kept the Prisma query as case-insensitive `contains` across first, middle, last, maiden, display, and nickname.
- Corrected `/api/people` consumers touched by this fix to read the real response shape: `Array.isArray(data.data) ? data.data : no update`.
- Replaced the family-tree member switcher’s 500-person local search cap with debounced remote `/api/people?search=...&limit=50` lookups, while keeping a small default browse list for the open state.
- Added `middleName` and `maidenName` to the person list DTO so every server-searchable name field can be represented on clients that need it.
- Removed the unused `FamilyTreeSearchOverlay` path and stale family-tree searchable-people loader/props so there is no second, capped search implementation.
- Reused the shared person-search helper from global people search paths to reduce field/semantics drift.
- Added regression tests that assert the shared name-field list and `PersonService.listPeople` case-insensitive `contains` query for `rya` across all name fields.

## Verification
- `npm --workspace UI test -- --runInBand src/__tests__/services/PersonService.search.test.ts src/__tests__/lib/person-search.test.ts`
- `npm --workspace UI run typecheck`
- `npm --workspace UI run build` — passed with the pre-existing Turbopack NFT trace warning from `UI/next.config.js` via `UI/src/pages/api/assets/[id]/download.ts`.
