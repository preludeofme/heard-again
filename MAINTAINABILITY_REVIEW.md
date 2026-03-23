# Codebase Maintainability Review

> Project: heard-again  
> Review Type: Senior Software Maintainability Assessment  
> Date: March 2026

---

## 1. Overall Assessment

### Maintainability Health: **MODERATE – NEEDS ATTENTION**

The codebase demonstrates a reasonable foundation with consistent patterns in API route handling and some separation between UI (controllers/hooks) and data access. However, there are several structural issues that will impede scaling, increase bug risk, and slow developer velocity as the project grows.

### Major Architectural Concerns

1. **Direct Database Access in API Routes** – Business logic is tightly coupled to Prisma queries in API routes, making testing difficult and scattering domain knowledge
2. **Overgrown Controllers** – Controller hooks exceed 700+ lines with bloated state interfaces, reducing readability and maintainability
3. **Type Safety Gaps** – Excessive use of `any` and `as any` undermines TypeScript benefits
4. **Duplicated Mapping Logic** – Data transformation between API responses and component props is repeated across controllers
5. **Mixed Responsibilities** – Form validation, data fetching, state management, and business logic all coexist in controllers

### Most Important Improvement Opportunities

1. Extract service layer for business logic (highest impact)
2. Consolidate type definitions and eliminate `any` usage
3. Refactor controllers into focused, smaller hooks
4. Introduce repository pattern for data access
5. Standardize API response handling and error boundaries

---

## 2. Critical Maintainability Issues

These issues should block scaling, major feature work, or team velocity:

### Issue 1: Direct Prisma Access in API Routes (Business Logic Leakage)
**Why it matters:** API routes directly execute complex Prisma queries, embedding business rules in HTTP handlers. This makes unit testing impossible without mocking the entire HTTP stack, and business logic cannot be reused across routes or batch operations.

**Evidence:**
- `/src/pages/api/stories/index.ts` lines 32-54, 103-131 – Direct story creation with workspace validation logic inline
- `/src/pages/api/voice/synthesize.ts` lines 42-162 – Complex voice synthesis workflow with consent checking, job lifecycle management, and asset creation all in the route handler
- `/src/pages/api/people/index.ts` lines 28-74 – Person listing with relationship counts computed inline

### Issue 2: Monolithic Controllers
**Why it matters:** `useVoiceLabController.ts` is 770 lines with 25+ state properties and 20+ actions. Changes require understanding the entire surface area, and testing requires mocking all dependencies. Risk of unintended side effects increases with state surface area.

**Evidence:**
- `/src/controllers/useVoiceLabController.ts` – 770 lines, 50-line state interface, mixed document upload + voice training + preprocessing concerns
- `/src/controllers/useTalkController.ts` – now reduced to 128 lines and composed from focused hooks (`useConversation`, `useVoicePlayback`, `useVoiceComparison`, `useTalkSynthesis`, `useTalkVoiceModels`)

**Progress Note (Mar 23, 2026):**
- `useTalkController` decomposition is complete for Finding 5.5
- `useVoiceLabController` legacy implementation still exists and remains monolithic

### Issue 3: Unsafe Type Assertions
**Why it matters:** 32 instances of `any` in controllers alone. Type safety is a primary reason for using TypeScript; pervasive `any` negates this benefit and hides refactoring hazards.

**Evidence:**
- `/src/controllers/useVoiceLabController.ts` lines 202-211, 214-222 – `(p: any)` mapping patterns
- `/src/controllers/useStoriesController.ts` lines 49-58 – API response mapped with `(s: any)`
- `/src/controllers/useTalkController.ts` line 261 – `(p: any)` in profile mapping
- `/src/pages/api/instance/register.ts` – 4 instances of `as any`

---

## 3. Maintainability Findings

### [x] Finding 1: Missing Service Layer
**Severity:** HIGH  
**Affected Area:** `/src/pages/api/**/*.ts`  
**Issue:** No abstraction layer between API routes and database. Business rules (workspace scoping, consent checks, slug generation) are embedded in route handlers.  
**Long-term Impact:** Cannot unit test business logic; cannot reuse logic for batch operations, background jobs, or CLI tools; changes to data model require  Finding and updating scattered query logic.  
**Recommended Refactor:**
```
Create /src/services/ directory with domain services:
- StoryService – createStory(), listStories(), validateStoryAccess()
- VoiceService – synthesize(), checkConsent(), manageJobLifecycle()
- PersonService – createPerson(), buildPersonQuery()
- WorkspaceService – resolveWorkspace(), checkRole()

Each service receives PrismaClient via constructor injection.
```

---

### [ ]  Finding 2: Overgrown Custom Hooks (Controllers)
**Severity:** HIGH  
**Affected Area:** `/src/controllers/useVoiceLabController.ts`, `/src/controllers/useTalkController.ts`  
**Issue:** Controllers combine data fetching, form state, UI state, caching, and business logic. The `VoiceLabController` has 25+ state fields and manages documents AND voice training AND preprocessing.  
**Long-term Impact:** Impossible to test independently; changes require understanding entire state surface; difficult to reuse specific behaviors; new developers face steep learning curve.  
**Recommended Refactor:**
```
Split into focused hooks:
- useVoiceProfiles() – fetch, cache, CRUD voice profiles
- useDocumentUpload() – file upload with progress
- useVoiceTraining() – training flow state machine
- useVoiceSynthesis() – synthesis with caching

Each hook < 150 lines, single responsibility.
```

---

### [x] Finding 3: Duplicated Data Mapping Logic
**Severity:** MEDIUM  
**Affected Area:** `/src/controllers/useVoiceLabController.ts`, `/src/controllers/useTalkController.ts`  
**Issue:** Voice profile mapping from API to component format is duplicated in `refreshData()` and `loadVoiceModels()` (lines 202-211 and 458-470). Document type mapping appears in `uploadDocument()` and `refreshData()`.  
**Long-term Impact:** Inconsistent data shapes; fixes require multiple locations; type mismatches propagate silently.  
**Recommended Refactor:**
```
Create /src/mappers/ directory:
- voiceProfileMapper.ts – toViewModel(profile: VoiceProfileResponse): VoiceModel
- documentMapper.ts – toViewModel(asset: AssetResponse): DocumentArtifact

Use mappers consistently in controllers.
```

---

### [ ] Finding 4: Inconsistent Error Handling
**Severity:** MEDIUM  
**Affected Area:** `/src/controllers/*.ts`  
**Issue:** Controllers mix try/catch patterns. Some use `error: any` and access `.message`, others pass generic strings. No standardized error classification.  
**Long-term Impact:** Users see inconsistent error messages; debugging requires console diving; retry logic cannot distinguish transient vs permanent failures.  
**Recommended Refactor:**
```
Standardize ApiError class with codes:
- NETWORK_ERROR (retryable)
- VALIDATION_ERROR (fix input)
- NOT_FOUND (terminal)
- PERMISSION_DENIED (terminal)

Controllers catch and wrap errors consistently.
```

---

### [x] Finding 5: Weak Request/Response Typing
**Severity:** MEDIUM  
**Affected Area:** `/src/controllers/*.ts`, `/src/pages/api/**/*.ts`  
**Issue:** API routes return generic `{ success: true, data: any }`. Controllers use `any` for response parsing. No shared request/response contracts.  
**Long-term Impact:** Breaking API changes go undetected; frontend crashes from unexpected response shapes; contracts drift between teams.  
**Recommended Refactor:**
```
Create /src/contracts/ directory with:
- ApiContracts.ts – shared request/response interfaces
- VoiceApi.ts – voice-specific DTOs
- StoryApi.ts – story-specific DTOs

Use strict types in both API routes and controllers.
```

---

### [ ] Finding 6: Mixed Form and Data State
**Severity:** MEDIUM  
**Affected Area:** `/src/controllers/useStoriesController.ts`  
**Issue:** `formTitle`, `formContent`, `formType` stored alongside `stories` array. Form state should be local to components.  
**Long-term Impact:** Form state persists unnecessarily; component unmount doesn't clear form; difficult to have multiple forms simultaneously.  
**Recommended Refactor:**
```
Move form state to components using useState.
Controllers expose:
- submitStory(data: CreateStoryRequest)
- submitAudioStory(blob, metadata)

Forms manage their own validation and submission state.
```

---

### [x] Finding 7: Hardcoded Values and Magic Strings
**Severity:** LOW  
**Affected Area:** `/src/controllers/useVoiceLabController.ts`, `/src/pages/api/**/*.ts`  
**Issue:** `'user123'` mock user ID appears in multiple files. Language codes like `'en'` scattered. Style suggestions array in VoiceTrainingModal.  
**Long-term Impact:** Configuration changes require code edits; testing requires mocking; internationalization blocked.  
**Recommended Refactor:**
```
Create /src/config/constants.ts:
- DEFAULT_LANGUAGE = 'en'
- SUPPORTED_LANGUAGES = ['en', 'es', ...]

Move user ID resolution to auth context.
Move style suggestions to config or CMS.
```

---

### [x] Finding 8: Lack of Validation Boundaries
**Severity:** MEDIUM  
**Affected Area:** `/src/pages/api/**/*.ts`  
**Issue:** Validation rules are inline and duplicated. No schema validation library (Zod, Yup) used. Type guards missing.  
**Long-term Impact:** Invalid data reaches database; type assertions hide validation gaps; manual validation is error-prone.  
**Recommended Refactor:**
```
Replace /src/lib/validation.ts with Zod schemas:
- CreateStorySchema, UpdateStorySchema
- CreatePersonSchema
- VoiceSynthesisSchema

Validate at API boundary with schema.parse(req.body).
```

---

### [x] Finding 9: File System Operations in Route Handlers
**Severity:** MEDIUM  
**Affected Area:** `/src/pages/api/voice/synthesize.ts`  
**Issue:** Direct `fs.mkdir`, `fs.writeFile` calls in the API route. File paths constructed manually with `path.join`.  
**Long-term Impact:** Cannot unit test without file system mocks; path construction errors; no abstraction for storage backends (S3 vs local).  
**Recommended Refactor:**
```
Create StorageService:
- saveAudio(workspaceId: string, audioId: string, buffer: Buffer): Promise<string>
- getAudioUrl(path: string): string

Service handles path construction and storage backend.
```

---

### [x] Finding 10: Global Type Declarations Abuse
**Severity:** LOW  
**Affected Area:** `/src/types/voice.ts`  
**Issue:** `declare global` for `uploadedFiles`, `voiceModelsGlobal`, `trainingJobsGlobal` pollutes global namespace.  
**Long-term Impact:** Name collisions; unclear data ownership; impossible to track lifecycle; memory leaks likely.  
**Recommended Refactor:**
```
Remove global declarations.
Use React context or state management for shared state.
For server-side caching, use a proper cache service with TTL.
```

---

### [ ] Finding 11: Ref Pattern Workarounds
**Severity:** LOW  
**Affected Area:** `/src/controllers/useTalkController.ts`  
**Issue:** Lines 72-73, 420-423 use refs to work around stale closure issues instead of properly managing dependencies.  
**Long-term Impact:** Obscures data flow; bypasses React's declarative model; refs can become stale.  
**Recommended Refactor:**
```
Use useCallback with proper dependency arrays.
If circular dependencies exist, extract shared logic to a separate hook or service.
```

---

### [ ] Finding 12: Duplicate Modal Components
**Severity:** LOW  
**Affected Area:** `/src/components/AddPersonModal.tsx`, `/src/components/AddEditPersonModal.tsx`  
**Issue:** Two similar person modals with different interfaces. CreatePersonData vs PersonFormData.  
**Long-term Impact:** Inconsistent UX; duplicate maintenance; unclear which to use.  
**Recommended Refactor:**
```
Consolidate to single AddEditPersonModal.
Unify on PersonFormData interface.
Remove AddPersonModal or make it a thin wrapper.
```

---

## 4. Approved Patterns

These patterns are worth keeping and extending:

### ✅ apiHandler Wrapper (`/src/lib/api-helpers.ts`)
Centralized error handling, logging, and method routing. Should be extended for all routes consistently.

### ✅ Auth Helpers (`/src/lib/auth-helpers.ts`)
Clean workspace resolution and role checking. Extract workspace logic to service layer to reduce duplication.

### ✅ Consistent Response Format (`{ success, data/error }`)
Predictable structure across API. Add strict typing to data field.

### ✅ Prisma Singleton Pattern (`/src/lib/prisma.ts`)
Correctly handles global singleton for development hot reload.

### ✅ Component + Controller Separation
Pattern is sound; controllers need to be smaller and more focused.

---

## 5. Refactor Plan (Prioritized)

### Phase 1: Foundation (Week 1-2) – **HIGHEST PRIORITY**

| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| **5.1 Create Service Layer** | New: `/src/services/*` | 2-3 days | Unblocks testing, enables reuse |
| | Extract from: `/src/pages/api/stories/index.ts` | | |
| | Extract from: `/src/pages/api/people/index.ts` | | |
| | Extract from: `/src/pages/api/voice/*.ts` | | |
| **5.2 Add Zod Schema Validation** | `/src/lib/validation.ts` → `/src/schemas/*.ts` | 1 day | Eliminates `any`, catches errors early |
| **5.3 Define API Contracts** | `/src/contracts/*.ts` | 1 day | Enforces type safety across boundary |

**Acceptance Criteria:**
- [x] StoryService.createStory() can be unit tested without HTTP
- [x] All API routes use Zod schemas for input validation
- [ ] No `any` types in request/response handling

---

### Phase 2: Controller Refactoring (Week 3-4)

| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| **5.4 Split useVoiceLabController** | `/src/controllers/useVoiceLabController.ts` | 2 days | Testable, focused hooks |
| | → useVoiceProfiles(), useVoiceTraining(), useVoiceSynthesis() | | |
| **5.5 Split useTalkController** | `/src/controllers/useTalkController.ts` | 2 days | Isolates concerns |
| | → useConversation(), useVoicePlayback(), useVoiceComparison() | | |
| **5.6 Create Data Mappers** | `/src/mappers/*.ts` | 1 day | Eliminates duplication |

**Progress Update (Mar 23, 2026):**
- [x] 5.5 Extract `useVoicePlayback` from `useTalkController`
- [x] 5.5 Extract `useConversation` from `useTalkController`
- [x] 5.5 Extract `useVoiceComparison` from `useTalkController`
- [x] 5.5 Extract `useTalkSynthesis` from `useTalkController`
- [x] 5.5 Extract `useTalkVoiceModels` from `useTalkController`
- [x] 5.5 Convert `useTalkController` into thin composed wrapper (<150 lines)
- [x] 5.5 Task complete

**Acceptance Criteria:**
- [ ] No controller exceeds 150 lines
- [ ] Each hook has single responsibility
- [ ] Mappers used consistently across all controllers

---

### Phase 3: API Route Cleanup (Week 5)

| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| **5.7 Refactor API Routes to Use Services** | `/src/pages/api/**/*.ts` | 3 days | Thin controllers, testable logic |
| **5.8 Extract Storage Abstraction** | New: `/src/services/StorageService.ts` | 1 day | Testable file operations |
| **5.9 Standardize Error Handling** | `/src/lib/errors.ts` | 1 day | Consistent user experience |

**Acceptance Criteria:**
- [x] API routes < 50 lines each
- [x] All database access through services
- [x] File operations abstracted

---

### Phase 4: Type Safety & Cleanup (Week 6)

| Task | Files | Effort | Impact |
|------|-------|--------|--------|
| **5.10 Eliminate `any` Types** | All `/src/controllers/*.ts` | 2 days | Full type safety |
| **5.11 Remove Global Declarations** | `/src/types/voice.ts` | 0.5 days | Clean architecture |
| **5.12 Consolidate Modals** | `/src/components/AddPersonModal.tsx` | 1 day | Reduced duplication |
| **5.13 Remove Hardcoded Values** | Across codebase | 1 day | Configurable system |

**Acceptance Criteria:**
- [ ] Zero `any` usage in production code
- [x] No global type declarations
- [ ] Single person modal component

---

## 6. Decision

### **APPROVED WITH CHANGES**

The codebase has a reasonable foundation with consistent API handling patterns and clear separation between UI and data layers. However, **critical issues around business logic placement and controller size must be addressed before major feature work or team scaling.**

### Required Before Significant Expansion:
1. ✅ Service layer extraction (Phase 1)
2. ✅ Controller refactoring (Phase 2)
3. ✅ API route cleanup (Phase 3)

### Recommended Next Actions:
1. Begin Phase 1 immediately – create StoryService and PersonService as prototypes
2. Establish service layer pattern through code review before wide adoption
3. Add unit tests for services as they are extracted
4. Update development guidelines to enforce hook size limits (<150 lines)

---

## Appendix: Quick Reference

### Service Layer Template
```typescript
// /src/services/StoryService.ts
export class StoryService {
  constructor(private prisma: PrismaClient) {}

  async createStory(
    workspaceId: string,
    userId: string,
    data: CreateStoryInput
  ): Promise<Story> {
    // Validate workspace access
    // Execute business logic
    // Return domain object
  }
}
```

### Mapper Pattern Template
```typescript
// /src/mappers/storyMapper.ts
export const storyMapper = {
  toViewModel(story: StoryWithRelations): StoryViewModel {
    return {
      id: story.id,
      title: story.title,
      // ...mapping logic
    };
  }
};
```

### Refactored Controller Pattern
```typescript
// Before: 770-line god hook
// After: Focused, composable hooks
export function useVoiceLab() {
  const profiles = useVoiceProfiles();
  const training = useVoiceTraining();
  const documents = useDocumentUpload();
  
  return { ...profiles, ...training, ...documents };
}
```
