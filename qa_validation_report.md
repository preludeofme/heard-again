# QA Validation Report: Heard Again Platform

## Executive Summary

A follow-up QA validation pass was conducted to verify the recent bug fixes and evaluate the application from a first-time user perspective, as per the `user-validation.md` protocol. 

The application shows clear improvement: cross-space data contamination has been resolved, and empty states guide the user better. However, there are still critical functional blockers preventing the app from feeling production-ready. We encountered a **404 Not Found error upon signing out**, a **400 Bad Request when saving profile edits** (due to date validation), and a **dangerous missing confirmation dialog** that allows immediate deletion of a relative from the tree.

These issues must be resolved to ensure a stable and trustworthy user experience.

---

## Completed Checklist

### Account and Authentication
- [x] Create account flow
- [x] Sign in flow

### Family Space
- [x] Create family space flow
- [x] Invite family member flow

### Family Tree
- [x] Create family tree flow
- [x] View family tree flow
- [x] Add a relative to the family tree flow
- [!] Edit a relative in the family tree flow *(Blocked: Form validation fails with 400 Bad Request on empty dates)*
- [x] Delete a relative from the family tree flow *(Issue found: No confirmation dialog)*
- [ ] Add a profile photo to a relative in the family tree flow
- [ ] Add an audio recording to a relative in the family tree flow
- [ ] Add a document to a relative in the family tree flow
- [x] Add a narrative to a relative in the family tree flow

### Relative Profiles
- [x] View a relative's profiles
- [!] Edit a relative's profiles *(Blocked by date validation issue)*
- [x] Delete a relative's profiles

*(Note: Media and Document flows were not exhaustively tested in this pass due to the blockers in core profile management.)*

---

## Issues Found

### 1. 404 Error on Sign Out

**Flow:**  
Account and Authentication

**Severity:**  
Critical

**Steps to Reproduce:**  
1. Log into the application.
2. Click the user profile avatar in the top right header to open the menu.
3. Click "Sign Out".

**Expected Behavior:**  
The user should be securely logged out and redirected to the login page (`/login`) or the public homepage.

**Actual Behavior:**  
The user is redirected to a `404 Page Not Found` route after the session is destroyed.

**Recommendation:**  
Ensure the NextAuth `signOut` callback specifies a valid `callbackUrl` (e.g., `signOut({ callbackUrl: '/login' })`).

---

### 2. Profile Edit Fails with 400 Bad Request (Date Validation)

**Flow:**  
Family Tree / Relative Profiles

**Severity:**  
Critical

**Steps to Reproduce:**  
1. Navigate to the Family Tree.
2. Click on an existing relative to open their details sidebar/preview modal.
3. Click "Edit".
4. Leave the "Birth Date" and "Death Date" fields empty.
5. Make a change to the First or Last Name.
6. Click "Save Changes".

**Expected Behavior:**  
The profile should be updated successfully, and the modal should close or show a success state.

**Actual Behavior:**  
The API returns a `400 Bad Request`. The UI's edit form sends empty date fields as empty strings (`""`) in the JSON payload, which the backend Zod schema rejects (it expects `null` or a valid Date string).

**Recommendation:**  
Sanitize the form payload on the client side before submission. If a date field is an empty string `""`, map it to `null` or explicitly `delete` the key from the payload before sending the `PUT` request.

---

### 3. Immediate Person Deletion Without Confirmation

**Flow:**  
Family Tree / Relative Profiles

**Severity:**  
High

**Steps to Reproduce:**  
1. Navigate to the Family Tree.
2. Click on a relative node to open the profile preview modal.
3. Click the "Delete" button at the bottom of the modal.

**Expected Behavior:**  
A custom MUI confirmation modal (implemented in previous fixes) should appear warning the user that this action cannot be undone.

**Actual Behavior:**  
The relative is deleted instantly via API and removed from the canvas. There is no warning or confirmation prompt, leading to a high risk of accidental data loss.

**Recommendation:**  
Wrap the delete action in the profile preview modal with the shared `ConfirmDialog` component. Ensure that the delete API call is only triggered upon explicit confirmation.

---

## UX Recommendations

- **Destructive Actions:** Any action that results in data loss (deleting a tree node, story, or space) must uniformly use the `ConfirmDialog`. 
- **Loading Indicators:** The "Add to Family Tree" and "Save Changes" buttons currently lack sufficient visual feedback during the API request (which can take a moment). The spinner should be more prominent or the button should change to a "Saving..." state.

## UI / Visual Design Recommendations

- **Consistent Modals:** The profile preview modal has a slightly different layout logic for its action buttons compared to the main edit forms. Ensure button placement (Edit, Delete, Add Story) follows the established design system grid.

## Functional QA Recommendations

- **Client-Side Validation:** Add a Zod schema resolver to the client-side forms (`react-hook-form` if used) to catch the date validation issues *before* the network request is made. This provides instant feedback to the user and reduces server load.

---

## Priority Fix List

### Critical
- Fix the `400 Bad Request` on profile edits by sanitizing empty string dates (`""`) to `null` before API submission.
- Fix the `404 Page Not Found` redirect that occurs immediately after a user clicks "Sign Out".

### High
- Implement the `ConfirmDialog` for the "Delete" button inside the relative profile preview modal to prevent accidental deletions.

### Medium
- Implement client-side schema validation for the Edit Person form to catch type mismatches before API submission.

### Low
- Ensure all forms uniformly disable submit buttons and show loading spinners while `isSubmitting` is true.
