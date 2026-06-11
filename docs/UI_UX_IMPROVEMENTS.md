# UI/UX Improvements - Implementation Plan

## Completed ✅

| Improvement | Status |
|-------------|--------|
| Account link in dropdown with description | ✅ Done (was already there, enhanced description) |
| Usage gating implementation | ✅ Done (quota checks + tracking) |
| Warmup exemption | ✅ Done (skips usage tracking) |
| Connected plan has 20 min | ✅ Done (seed.ts updated) |

## Remaining TODO

These require more extensive refactoring - recommended to do in a separate PR:

### 1. Usage Progress Bar in Top Nav
**File**: `UI/src/components/layout/Layout.tsx`  
**Approach**: Add simple usage indicator component  
**Complexity**: Medium  
**Priority**: HIGH

### 2. Plan Comparison Table  
**File**: `UI/src/pages/account.tsx`  
**Add after line 400**: Comparison table showing all 4 tiers side-by-side  
**Complexity**: Low  
**Priority**: HIGH

### 3. First-Time Tooltips
**File**: New hook or component  
**Approach**: Use localStorage to track "seen" state, show MUI Tooltip/Popover on first visit  
**Complexity**: Medium  
**Priority**: MEDIUM  

### 4. Voting Visualization
**File**: `UI/src/pages/familyspaces/[id]/settings.tsx` (delete dialog)  
**Add**: Progress bar showing votes received/needed with member avatars  
**Complexity**: Medium  
**Priority**: MEDIUM

### 5. Quota Warning Banners
**File**: `UI/src/pages/account.tsx`  
**Add**: Alert banner when usage >80% or >90%  
**Complexity**: Low  
**Priority**: HIGH

## Recommendation

Complete items 1, 2, and 5 now (high priority, straightforward).  
Defer 3 and 4 to next sprint (require more design work).

Want me to implement the plan comparison table and quota warnings now?
