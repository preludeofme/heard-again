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
- Centralized the people-name search field list in `PersonService` and kept the Prisma query as case-insensitive `contains` across first, middle, last, maiden, display, and nickname.
- Corrected `/api/people` consumers touched by this fix to read the real response shape: `Array.isArray(data.data) ? data.data : no update`.
- Updated the member switcher local filter to search across first, middle, last, and display name fields, not only the rendered label.
- Added a regression test that asserts `PersonService.listPeople` sends the expected case-insensitive `contains` query for `rya` across all name fields.

## Verification
- `npm test -- --runInBand src/__tests__/services/PersonService.search.test.ts`
- `npm run typecheck`
