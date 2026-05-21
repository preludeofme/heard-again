# Usability & Wayfinding Audit Report: Heard Again

## Executive Summary
* **Overall Ease of Use Score:** **6.5 / 10**
* **Summary:** The core application features beautiful visuals and typography. However, the site suffers from Information Architecture (IA) inconsistencies, unpredictable header layouts across public pages, critical mobile responsiveness issues, and a severe CSRF authentication blocker. Resolving these fundamental navigation and layout issues is required before production deployment.

## Navigation Friction Points
1. **Dynamic / Inconsistent Header layouts (Severe Wayfinding Defect):**
   * **Landing Page (`/`):** Contains `Pricing`, `Privacy`, `Terms & Conditions`, and `Sign In` button.
   * **Terms & Privacy Pages:** Contains the above links PLUS a `Start Story` button.
   * **Sign In Page (`/login`):** Contains ONLY the `Start Story` button.
   * **Sign Up Page (`/signup`):** Contains ONLY `Sign In` and `Start Story` buttons.
   * *Impact:* Creates dead ends and jarring transitions. Users on the `/login` screen cannot easily access legal links or pricing without using the browser's back button.

2. **Public `/pricing` Redirection (IA Failure):**
   * *Issue:* The `/pricing` route automatically redirects unauthenticated users to the `/login` page.
   * *Impact:* A user expecting to see a dedicated details page for pricing is blocked by a login screen.

3. **Implicit Plan Context on Signup:**
   * *Issue:* The "Get Started" buttons inside the pricing cards on the landing page redirect to the generic `/signup` page without transferring the selected plan context.
   * *Impact:* Users must re-select their plan choice during/after registration, creating an unnecessary friction point.

4. **Vague Action Metaphors:**
   * *Issue:* The registration workflow uses multiple custom terms: `"Start Your Story"`, `"Start Story"`, and `"Start My Living Story"`.
   * *Impact:* Increases cognitive load. Standardized action labels are required.

## The Re-labeling Log

| Current Label | Proposed Label | Reason for Change |
| :--- | :--- | :--- |
| **`Terms & Conditions`** (Header) | **`Terms of Service`** | Align header with the page title and footer standard. |
| **`Terms of Legacy`** (Footer) | **`Terms of Service`** | "Terms of Legacy" is highly stylized; standardizing reduces cognitive confusion for legal expectation. |
| **`Start Your Story`** (Landing CTA) | **`Get Started`** | Uses a standard, highly recognizable call to action. |
| **`Start Story`** (Header Button) | **`Get Started`** | Consistency across all public headers. |
| **`Start My Living Story`** (Signup CTA) | **`Create Account`** | Action-oriented, setting clear expectations for form submission. |

## Mobile UX Observations
1. **Horizontal Nav Menu Overcrowding:**
   * *Issue:* On mobile viewports (e.g., iPhone 390px width), the navigation items (Pricing, Privacy, Terms) and the buttons do not collapse into a hamburger menu properly, causing overcrowding or overlaps.
2. **Registration Form Input Sizes:**
   * *Issue:* Certain input fields on the registration page appear side-by-side, squeezing the touch target size and making them difficult to tap on mobile. They should stack vertically.
3. **Developer/Auth Float Overlap:**
   * *Issue:* Auth/developer floating widgets (like NextAuth dev tools) overlap critical footer links or form submit buttons on smaller screens.
4. **Header Link Omission on Mobile:**
   * *Issue:* The dynamic omission of menu links on the Sign In and Sign Up page presents a harsher bottleneck on mobile. Vertical scrolling makes finding footer legal links tedious when the header is bare.

## Critical Bugs & Blockers
1. **CSRF Token / 403 Forbidden on Auth:**
   * *Issue:* Attempting to Sign In or Sign Up results in a 403 Forbidden / CSRF token required error.
   * *Impact:* **Critical Blocker.** Users cannot authenticate or register, completely blocking the core product experience.
2. **Unlabeled Footer Buttons (Accessibility Blocker):**
   * *Issue:* The two circular icon buttons in the footer DOM lack text, `aria-label`, and title attributes.
   * *Impact:* Screen readers will simply announce "Button", violating accessibility standards.
3. **`/pricing` Route Redirection:**
   * *Issue:* The `/pricing` page forcefully redirects to the login screen instead of showing pricing details.
