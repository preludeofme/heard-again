# Architecture: Heard Again

## Design Pattern: Contextual Design
The core of the application is built around a **Contextual Design Pattern**. The application state and UI are heavily driven by the `SelectedFamilyMemberContext`. This context allows the interface to respond dynamically to the "Active Member," ensuring that all data fetches, navigation, and UI elements are scoped to the specific family member being explored.

## Navigation Strategy
The application employs a dual-mode navigation strategy to provide a seamless experience across device types:
- **Desktop**: A persistent **Sidebar** for efficient lateral movement through the application's feature set.
- **Mobile**: A **Bottom Navigation** bar for easy one-handed use and thumb-friendly interactions.

## Data Layer
- **ORM**: Prisma is used for type-safe interactions with the database.
- **Database**: PostgreSQL serves as the single source of truth for all family members, media, and transcriptions.
- **Schema Integrity**: All schema changes must be followed by `npx prisma generate` to maintain type safety across the application.

## Component Architecture
- **Context-Driven Components**: Many components rely on the `SelectedFamilyMemberContext`. Developers must verify if a component's logic or data fetching should be scoped to the current context.
- **UI Library**: Material UI (MUI) provides the structural building blocks, ensuring consistent spacing, elevation, and interaction patterns.
