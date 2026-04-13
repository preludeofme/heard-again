# Decisions: Heard Again

## Core Design Philosophy
### Contextual Design Pattern
- **Decision**: Adopted a "Contextual" design pattern where the UI state is heavily dependent on the `SelectedFamilyMemberContext`.
- **Rationale**: To reduce cognitive load for users. By scoping the interface to a specific family member, the complexity of the global family tree is abstracted away, allowing users to focus on the details, media, and stories of a single person at a time.

## UI/UX Implementation
### Material UI (MUI)
- **Decision**: Selected MUI as the primary UI component library.
- **Rationale**: Ensures a professional, consistent, and high-quality interface. MUI's robust design system provides pre-built, accessible components (like Sidebars, Bottom Navigation, and FABs) that align with the goal of a polished "Living Archive".

### Dual-Mode Navigation
- **Decision**: Implemented Sidebar for Desktop and Bottom Navigation for Mobile.
- **Rationale**: Optimizes for device-specific ergonomics, providing efficient access to navigation on larger screens and thumb-friendly access on mobile devices.
