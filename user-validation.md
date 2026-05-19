# Task: Full UX, UI, and Functional QA Review of the Application

You are acting as a product QA tester, UX reviewer, and UI design reviewer.

Use your browser tool to visit and interact with the application. Your goal is to evaluate the app from the perspective of a first-time user and identify issues that would prevent the app from feeling intuitive, polished, trustworthy, or functional.

## Primary Review Areas

For every flow listed below, assess the following:

### 1. User Flow / UX
- Is the flow intuitive?
- Does the sequence of steps make sense?
- Is it clear what the user should do next?
- Are labels, buttons, page titles, empty states, and calls-to-action clear?
- Are there confusing, missing, or redundant steps?
- Does the app provide enough feedback after each action?

### 2. Visual Design / UI
- Is the app visually appealing?
- Is the layout modern, clean, and consistent?
- Is the app easy to read?
- Are spacing, alignment, typography, colors, and component styles consistent?
- Does the design feel polished and production-ready?
- Are there any mobile/responsive layout issues?

### 3. Bugs / Functional Issues
- Do buttons, links, forms, tabs, menus, and dropdowns work?
- Do modals open, close, submit, and cancel correctly?
- Do uploads work where applicable?
- Does audio playback work where applicable?
- Are loading, success, error, and empty states handled properly?
- Are there console errors, failed network requests, or broken interactions?
- Are permissions, validation messages, and redirects working correctly?

---

# Testing Instructions

Work through the flows in the checklist below one by one.

For each flow:

1. Complete the flow using the browser tool.
2. Observe the user experience, visual design, and functionality.
3. Record any issues found.
4. Provide recommendations for improvement.
5. Mark the checklist item as completed after testing it.
6. If a flow cannot be completed because of a blocker, mark it as blocked and clearly explain why.
7. Continue testing the remaining flows where possible.

Do not only give general feedback. Provide specific, actionable findings tied to the page, component, or interaction where the issue occurred.

When possible, include:
- The page or area where the issue occurred
- Steps to reproduce
- Expected behavior
- Actual behavior
- Severity: Critical, High, Medium, Low
- Recommendation

---

# Flow Checklist

## Account and Authentication

- [ ] Create account flow
- [ ] Sign in flow

## Family Space

- [ ] Create family space flow
- [ ] Invite family member flow

## Family Tree

- [ ] Create family tree flow
- [ ] View family tree flow
- [ ] Add a relative to the family tree flow
- [ ] Edit a relative in the family tree flow
- [ ] Delete a relative from the family tree flow
- [ ] Add a profile photo to a relative in the family tree flow
- [ ] Add an audio recording to a relative in the family tree flow
- [ ] Add a document to a relative in the family tree flow
- [ ] Add a narrative to a relative in the family tree flow

## Relative Profiles

- [ ] View a relative's profiles
- [ ] Edit a relative's profiles
- [ ] Delete a relative's profiles

## Relative Videos

- [ ] View a relative's videos
- [ ] Edit a relative's videos
- [ ] Delete a relative's videos

## Relative Audio Recordings

- [ ] View a relative's audio recordings
- [ ] Edit a relative's audio recordings
- [ ] Delete a relative's audio recordings

## Relative Documents

- [ ] View a relative's documents
- [ ] Edit a relative's documents
- [ ] Delete a relative's documents

## Relative Narratives

- [ ] View a relative's narratives
- [ ] Edit a relative's narratives
- [ ] Delete a relative's narratives

---

# Required Output Format

Provide your final report in the following structure:

## Executive Summary

Briefly summarize the overall quality of the app, including:
- Biggest UX concerns
- Biggest UI/design concerns
- Biggest functional or bug-related concerns
- Whether the app feels ready for users or needs more refinement

## Completed Checklist

Copy the checklist and mark each item as one of:

- `[x] Completed`
- `[!] Blocked`
- `[ ] Not tested`

For blocked items, include the reason.

## Issues Found

Group issues by flow.

For each issue, use this format:

### Issue Title

**Flow:**  
Name of the tested flow

**Severity:**  
Critical / High / Medium / Low

**Steps to Reproduce:**  
1. Step one
2. Step two
3. Step three

**Expected Behavior:**  
Describe what should happen.

**Actual Behavior:**  
Describe what actually happened.

**Recommendation:**  
Give a clear, actionable fix.

## UX Recommendations

Provide broader recommendations to improve the user journey, onboarding, navigation, empty states, feedback messages, and overall clarity.

## UI / Visual Design Recommendations

Provide recommendations for layout, typography, spacing, colors, hierarchy, responsive behavior, and consistency.

## Functional QA Recommendations

Provide recommendations for bugs, validation, error handling, loading states, upload flows, media playback, and edge cases.

## Priority Fix List

End with a prioritized list of fixes:

### Critical
- Fix 1
- Fix 2

### High
- Fix 1
- Fix 2

### Medium
- Fix 1
- Fix 2

### Low
- Fix 1
- Fix 2

---

# Important Notes

- Be thorough.
- Be specific.
- Do not skip flows unless blocked.
- Do not assume something works without testing it.
- Use the browser tool actively.
- If you encounter errors, capture the exact behavior.
- If the app has console logs, network errors, broken routes, or failed requests, include them in the report.
- Focus on whether a normal non-technical user could successfully understand and use the app.