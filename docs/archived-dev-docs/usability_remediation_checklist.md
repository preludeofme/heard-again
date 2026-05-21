# Usability & Wayfinding Remediation Checklist

This checklist tracks the implementation of fixes identified in the [Usability Audit Report](./usability_audit_report.md).

## Phase 1: Critical Fixes & Blockers
- [x] **Fix CSRF Token / 403 Forbidden Error**: Resolve the authentication blocker preventing sign-in and sign-up.
- [x] **Fix Pricing Redirection**: Ensure `/pricing` is accessible to unauthenticated users instead of redirecting to `/login`.
- [x] **Accessibility: Label Footer Buttons**: Add `aria-label` or titles to the circular icon buttons in the footer.

## Phase 2: Navigation & Wayfinding
- [x] **Standardize Public Header Layouts**: Ensure `Pricing`, `Terms of Service`, `Privacy Policy`, and `Get Started/Sign In` are consistently available across:
    - [x] Landing Page (`/`)
    - [x] Terms & Privacy Pages
    - [x] Sign In Page (`/login`)
    - [x] Sign Up Page (`/signup`)
- [x] **Implement Re-labeling Log**:
    - [x] Change `Terms & Conditions` (Header) -> `Terms of Service`
    - [x] Change `Terms of Legacy` (Footer) -> `Terms of Service`
    - [x] Change `Start Your Story` (Landing CTA) -> `Get Started`
    - [x] Change `Start Story` (Header Button) -> `Get Started`
    - [x] Change `Start My Living Story` (Signup CTA) -> `Create Account`

## Phase 3: User Flow Enhancements
- [x] **Preserve Plan Context on Signup**: Pass the selected plan from the pricing cards on the landing page to the `/signup` page.
- [x] **Standardize Action Metaphors**: Replace all variants of "Start Story" with "Get Started" or "Create Account" as appropriate.

## Phase 4: Mobile UX Optimization
- [x] **Implement Hamburger Menu**: Collapse navigation links into a mobile-friendly menu on small viewports.
- [x] **Optimize Registration Form for Mobile**:
    - [x] Ensure all side-by-side inputs stack vertically on mobile.
    - [x] Verify touch target sizes for all form fields.
- [x] **Fix Floating Widget Overlaps**: Ensure developer/auth tools do not overlap critical footer links or action buttons.

## Phase 5: Verification & Validation
- [x] Verify navigation consistency on both Desktop and Mobile.
- [x] Confirm no dead ends in the public-facing pages.
- [x] Validate registration flow with plan selection.
- [x] Perform a final accessibility check on footer elements.
