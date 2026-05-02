# Implementation Plan: Topola Upgrade for Family Tree Rendering

This document outlines the strategy for upgrading the "Heard Again" family tree from a manual row-based layout to a professional-grade rendering engine based on the **Topola** methodology.

## 1. Objectives
- **Solve Complexity:** Handle inter-marriages, pedigree collapse, and multiple spouses without line crossing.
- **Improve Scaling:** Transition to a "Focal-Point" navigation system to support large family databases.
- **Enhance Performance:** Move heavy layout calculations to a specialized engine (D3-based).
- **Maintain Aesthetic:** Wrap the new engine in the "Heard Again" Material UI design system.

## 2. Technical Stack
- **Engine:** `topola` (core layout and data models).
- **Rendering:** `d3` (SVG manipulation and transitions).
- **Integration:** React 19 (custom wrapper components).

## 3. Phase 1: Foundation & Dependencies
- [x] Add new dependencies:
  - `npm install topola d3`
  - `npm install --save-dev @types/d3`
- [x] Create a new directory structure:
  - `UI/src/components/pages/family-tree/topola/`
  - `UI/src/components/pages/family-tree/topola/adapters/` (Data translation)
  - `UI/src/components/pages/family-tree/topola/renderers/` (Custom SVG nodes)

## 4. Phase 2: Data Adaptation
The current API returns a custom JSON format. We need to map this to Topola's internal `DataProvider`.
- [x] Implement `HeardAgainDataAdapter.ts`:
  - Map `ApiPersonWithEdges` to Topola's `Individual`.
  - Map `RelationshipEdges` to Topola's `Family`.
  - Handle metadata (avatars, role labels, story counts).


## 5. Phase 3: Core Component Implementation
- [x] **`TopolaTreeCanvas.tsx`**:
  - Initialize the Topola layout engine.
  - Set up the D3 SVG container with zoom/pan behavior.
  - Implement the "Focal-Point" logic: clicking a node re-centers the tree around that person.
- [x] **`CustomNodeRenderer.tsx`**:
  - Replace Topola's default boxes with "Heard Again" styled cards (SVG foreignObject or pure SVG).
  - Include avatars, life dates, and activity indicators (story counts).

## 6. Phase 4: Integration & UX
- [x] Replace `FamilyTreeCanvas.tsx` with the new `TopolaTreeCanvas.tsx`.
- [x] Connect existing interaction handlers:
  - Open `PersonModal` on click.
  - Trigger "Add Relative" flow.
- [x] Implement "Smart Search": Selecting a person from search triggers the focal-point transition.

## 7. Phase 5: Validation & Cleanup
- [x] Test with "Edge Case" families (multi-marriage, step-children).
- [x] Verify mobile responsiveness (Topola's fluid layouts).
- [x] Remove legacy `layout-utils.ts` and old coordinate calculation logic.

---

## Technical Details: The "All-Relatives" Layout
Unlike our current "Row" layout, Topola uses a recursive sub-tree approach. It calculates "slots" for each family unit and then connects them using optimized pathfinding.

**Key Change:** Instead of a flat `generations` object, we will provide a `DataProvider` that Topola queries as it builds the view around the focal person.
