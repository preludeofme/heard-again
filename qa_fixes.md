# QA Fixes: Heard Again Platform

This document outlines the required changes to resolve the issues identified in the [QA Report](qa_report.md).

## Critical Fixes

### 1. Profile Editing (405 Method Not Allowed)
The API route `/api/people/[id].ts` implements `PUT` for updates, but several client-side components call it without specifying the method, causing them to default to `POST`.

- [x] **UI/src/components/pages/FamilyTreePage.tsx**: Update `fetchWithCSRFAndJSON` calls for person updates to explicitly use `method: 'PUT'`.
- [x] **UI/src/components/modals/PersonModal.tsx**: Update the save handler to use `method: 'PUT'` when calling the person update endpoint.
- [x] **UI/src/components/pages/family-tree/useFamilyTree.ts**: Update the `updatePerson` logic to use the `PUT` method.
- [x] **Audit API handlers**: API route at `/api/people/[id].ts` correctly implements `PUT`, `DELETE`. Client-side callers now use correct methods.
    - [x] **Fixed 400 Bad Request**: `updatePersonSchema` rewritten to use `.nullish()` for all nullable DB fields — Prisma returns `null` for optional columns but the old schema only accepted `undefined`, causing every edit to fail validation. Also fixed `PersonModal.handleSave` to send a clean payload (schema-only fields) and corrected `PERSON_TYPES` from invalid `LIVING/DECEASED/ANCESTOR/DESCENDANT` to the actual `PersonType` enum values (`FAMILY/FRIEND/MENTOR/COLLEAGUE/OTHER`).
    - [x] **Fixed TypeError crash in fetchPeople**: Added null guards in `/api/people/family-tree.ts` for `c.child` and `p.parent` — orphaned FK rows where the referenced person was deleted caused `...edge.relatedPerson` to throw at response construction time.

### 2. Authentication Redirect Failure
Users are not redirected automatically after login, requiring a manual refresh.

- [x] **UI/src/components/pages/LoginPage.tsx**: Replaced `router.push(callbackUrl)` with `window.location.href = callbackUrl` to force full session state refresh.
- [x] **UI/src/components/pages/LoginPage.tsx**: `callbackUrl` defaults to `/legacy`; middleware handles `/onboarding` redirect for new users.
- [x] **UI/src/components/pages/CreateAccountPage.tsx**: Changed `router.push('/onboarding')` to `window.location.href = '/onboarding'` to force full session state refresh after signup.

## High Priority Fixes

### 3. Cross-Space Data Contamination
The family member dropdown shows members from all spaces because the session's `defaultFamilyspaceId` is not updated in the JWT until it expires.

- [x] **UI/src/lib/auth.ts**: Updated `jwt` callback to refresh `defaultFamilyspaceId` from the database when `trigger === 'update'` is received.
- [x] **UI/src/components/layout/FamilyspaceSwitcher.tsx**: `clearSelectedFamilyMember()` is now called before `window.location.reload()` to prevent stale member IDs from carrying over.
- [x] **UI/src/contexts/SelectedFamilyMemberContext.tsx**: Updated `clearSelectedFamilyMember` to also clear `recentlyViewedMembers` state and the `heard-again:recent-members` localStorage key. Root cause: the flyout's "Recently viewed" section was populated from localStorage which was never cleared on space switch, so members from the previous space appeared in the new space's flyout.

### 4. Family Tree Canvas Rendering
Relatives in secondary spaces fail to render on the canvas unless directly focused.

- [x] **UI/src/pages/api/people/family-tree.ts**: Simplified fallback root selection to use `createdAt` ordering instead of brittle birthDate comparison.
- [x] **UI/src/components/pages/FamilyTreePage.tsx**: Tree data re-fetched via `window.location.reload()` after adding/editing a person (already in place).
- [x] **Fix session issues**: JWT now refreshes `defaultFamilyspaceId` on `trigger === 'update'`, ensuring correct `familyspaceId` is used in API calls after space switch.

## Medium Priority Fixes

### 5. Custom MUI Confirmation Dialogs
Replace native browser `confirm()` calls with stylized MUI components.

- [x] **Create Common Component**: `UI/src/components/modals/ConfirmDialog.tsx` created — reusable MUI Dialog with confirm/cancel actions, loading state, and configurable color.
- [x] **UI/src/pages/stories/[id]/edit.tsx**: Replaced `confirm()` with `ConfirmDialog` for story deletion.
- [x] **UI/src/pages/family-merge.tsx**: Replaced `confirm()` for proposal deletion.
- [x] **UI/src/pages/tunnel-setup.tsx**: Replaced `confirm()` for tunnel deletion.
- [x] **UI/src/components/modals/PersonModal.tsx**: Replaced `confirm()` for relationship removal and discard-changes prompts using `ConfirmDialog`.

### 6. Loading States & Feedback
- [x] **UI/src/components/modals/AddEditPersonModal.tsx**: Added `CircularProgress` spinner to the Save button when `isSubmitting` is true.
- [x] **UI/src/components/modals/PersonModal.tsx**: Added `CircularProgress` spinner to Save Changes button when `isSaving` is true.
- [x] **Global Progress**: Audited — LoginPage, CreateAccountPage, AddEditPersonModal, and PersonModal all have loading spinners and disabled states. Primary forms are covered. Spinner now visible during save since the 400 error is resolved — the request takes time to complete rather than failing instantly.

## Low Priority / Polish

### 7. Empty States & Onboarding
- [x] **UI/src/components/pages/FamilyTreePage.tsx**: Replaced icon-only circle button with a prominent `Button` variant="contained" reading "Add Your First Relative" with a `People` icon illustration above it.
- [x] **Header UI**: Added `FamilyspaceSwitcher` to the desktop AppBar in `Layout.tsx` between the nav spacer and `ActiveMemberHeader`, displaying the active space name and plan tier.
