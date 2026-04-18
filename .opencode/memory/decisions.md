# Decisions: Heard Again

## Core Design Philosophy
### Contextual Design Pattern
- **Decision**: Adopted a "Contextual" design pattern where the UI state is heavily dependent on the `SelectedFamilyMemberContext`.
- **Rationale**: To reduce cognitive load for users. By scoping the interface to a specific family member, the complexity of the global family tree is abstracted away, allowing users to focus on the details, media, and stories of a single person at a time.

## Multi-Tenancy Decision
- **Decision**: Adopted a Workspace-based isolation model.
- **Rationale**: To ensure strict data integrity and privacy between different family archives, preventing cross-workspace data leakage and ensuring that users only access the content within their assigned/created workspaces.
