# Resolved Defects from Prod Readiness

The following issues identified during production readiness testing have been resolved.

## Critical
[x] Voice-Lab Crash
    - Fixed: `TypeError: Cannot read properties of undefined (reading 'voiceGenerationJob')` in `VoiceService.ts`.
    - Cause: `this.prisma` was undefined; initialized it with the shared prisma instance.
[x] Create voice CSRF error
    - Fixed: `CSRF token invalid` during voice training.
    - Cause: Race condition in `useCSRF` hook and concurrent request bug in `getCSRFToken` utility. Shared global token state now ensures consistency.
[x] Tiptap SSR Error
    - Fixed: `Tiptap Error: SSR has been detected`.
    - Cause: `immediatelyRender` property was missing; set it to `false` in `RichTextEditor.tsx`.

## Medium
[x] Privacy Access CSRF
    - Fixed: `CSRF token required` when editing Privacy Access.
    - Cause: `x-csrf-token` header was missing from state-changing fetch calls in `settings.tsx`.
[x] Export Full Data Package BigInt
    - Fixed: `Failed to export data` - `Do not know how to serialize a BigInt`.
    - Cause: `sizeBytes` field in Asset model is a BigInt. Added manual conversion and a custom JSON stringifier to the export API.
[x] Member Admin Styling
    - Fixed: Invite relative field looks greyed out.
    - Cause: `opacity: 0.1` was applied to the entire container; changed to a subtle background color.
[x] Email Integration
    - Implemented: Email system integration for invitations.
    - Added `EmailService.ts` using Resend API and integrated it with the invitation endpoint.
[x] Voice Assignment Visibility
    - Fixed: Voice assignments hidden when a family member is selected.
    - Updated `VoiceLabPage.tsx` to always show which person a voice is assigned to.
[x] Document Archive Filtering
    - Fixed: Audio samples and generations appearing in the Documents archive.
    - Added filtering to `api/assets` and updated `upload-sample.ts` to mark samples as AI-related for hiding.

## Minor
[x] Hydration Error: `<p>` cannot contain a nested `<div>`
    - Fixed: Occurred in `FamilyspaceSwitcher.tsx`.
    - Added `secondaryTypographyProps={{ component: 'div' }}` to `ListItemText` because it contains a `Chip` (which renders as a `div`).

## Additional Fixes
[x] Client Logging 404
    - Fixed: `POST /api/logs/client` was returning 404.
    - Created the API handler to receive and centralize client-side logs.
