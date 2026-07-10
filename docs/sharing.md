# Sharing — Requirements

## Goal

Let people outside a familyspace see and contribute to it, without every visitor needing an account.

## Current State

| Capability | Status |
|---|---|
| Invite a family member by email (join the familyspace) | **Exists** — `FamilyspaceInvite` model, `api/familyspaces/[id]/invite.ts` sends the email via `EmailService`, `invite.tsx` + `api/invites/[token]/accept.ts` handle acceptance. Requires the invitee to have (or create) an account. |
| Share a link to a single story | **Missing** — no share token, no public story route. The "Share" icon on `StoriesPage` is not wired to a link. |
| Public profile page for a person, open to story contributions from non-members | **Missing** — `profile/[id].tsx` requires auth (not in `proxy.ts`'s public path list); no anonymous contribution flow exists. |

## Requirements

### 1. Family member invites (verify, don't rebuild)
- Confirm the existing flow end-to-end: send invite → email arrives → recipient signs up or logs in → accepts → gains familyspace access with the assigned role.
- Fix only if something in that chain is actually broken; this is not a new feature.

### 2. Share a story via link
- Every story gets a shareable link (e.g. `/stories/{id}/share` or a signed token URL).
- Anyone with the link can view that one story (read-only) without an account.
- Familyspace owner/editors control whether a given story is shareable (off by default, matches existing privacy expectations).
- When creating the link, the sharer chooses whether it expires (e.g. never / 7 days / 30 days) or stays live until manually revoked.
- Link can be revoked/regenerated at any time.

### 3. Public person profile for outside contributions
- A person can have a public, no-login profile page reachable via a shareable link.
- Same expiration choice as story links: the sharer picks never-expires or a time limit when generating it.
- Visitors on that page can submit a story about that person (text at minimum; audio/photo if reasonable to include).
- Anonymous submitters must be verified before their story is queued (e.g. CAPTCHA plus a confirmed name/email) — cuts down on spam/bot submissions and gives moderators someone to attribute the submission to.
- Submitted stories land in a pending/review state — **at least one family member must approve** before a story appears in the family record. Not auto-published. This approval step is the primary spam/quality control, on top of submitter verification.
- Any attached media goes through the same upload validation/malware scanning as authenticated uploads before a moderator ever sees it.
- Page shows only what the familyspace owner chooses to expose (e.g. name + existing public stories), not the full profile/tree.

## Out of Scope (for now)
- Public browsing of the full family tree.
- Commenting/reacting on shared stories by anonymous visitors.
- Social sharing integrations (Facebook/Twitter previews, etc.) beyond a plain link + basic OG tags.
