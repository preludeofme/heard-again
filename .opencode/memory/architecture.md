# Architecture: Heard Again

## Design Pattern: Contextual Familyspace
The application implements a **Contextual Familyspace** pattern. It utilizes a **Tenant/Familyspace-based multi-tenancy model** where the primary unit of isolation is a `Familyspace`. All core entities—including `People`, `Documents`, and `Assets`—are strictly scoped to a `Familyspace` to ensure data boundaries are maintained.

The core of the application is built around a **Contextual Design Pattern**. The application state and UI are heavily driven by the `SelectedFamilyMemberContext`. This context allows the interface to respond dynamically to the "Active Member," ensuring that all data fetches, navigation, and UI elements are scoped to the specific family member being explored.

## Data Architecture
The application uses a highly relational, graph-based hierarchy to manage family histories:
`User` $\to$ `FamilyspaceUser` $\to$ `Familyspace` $\to$ `Person` $\to$ `Asset`/`Document`

## State Management
To drive the "Contextual UI" and prevent complex prop-drilling, global providers inject critical identifiers into the application scope:
- `activeFamilyspaceID`: Defines the current tenant/familyspace boundary.
- `activePersonID`: Drives the specific person-centric view within the active familyspace.

## Navigation Architecture
Navigation is context-dependent and relies on explicit switching mechanisms:
- **Familyspace Switching**: Driven by the `FamilyspaceSwitcher` component to move between different family archives.
- **Person Switching**: Driven by the `SelectedFamilyMemberChip` to change the focus within a familyspace.
- **Device-Specific Navigation**:
    - **Desktop**: A persistent **Sidebar** for efficient lateral movement.
    - **Mobile**: A **Bottom Navigation** bar for ergonomic use.

## Intelligence & Processing Layer

### 1. **LLM & Prompt Engineering**
- **LLM Gateway (`LLMGateway.ts`)**: Manages interactions with LLMs (via Ollama). It implements critical safety features:
    - **Prompt Injection Detection**: Scans for malicious instruction patterns.
    - **PII Leakage Detection**: Filters for sensitive information (SSNs, emails, etc.).
    - **Hallucination Prevention**: Detects uncertainty language and validates claims against provided documents.
    - **Reliability**: Implements model fallback mechanisms.
- **Prompt Engineering (`PromptBuilder.ts`)**: Uses a template engine (supporting conditional blocks and loops) to dynamically construct prompts using:
    - **Persona Profiles**: Injecting personality and persona-specific instructions.
    - **Retrieved Context**: Integrating document excerpts as the "source of truth."
    - **Conversation History**: Managing context window via history management.
    - **Strict Enforcement**: Programmatically injects rules to prevent the model from breaking character or revealing system instructions.

### 2. **RAG (Retrieval-Augmented Generation) Pipeline**
- **Retreival Engine (`RetrievalService.ts`)**: 
    - **Vector Search**: Utilizes **ChromaDB** for semantic retrieval.
    - **Context-Aware Scoping**: Performs searches strictly scoped to `familyspaceId`, `personId`, and specific `documentTypes` or `documentRanges`.
    - **Relevance Ranking**: Uses distance metrics from ChromaDB to rank and present the most relevant context.

### 3. **Voice & Persona Integration**
- **Voice Integration (`VoiceIntegrationService.ts`)**:
    - **Persona-Driven TTS**: Matches a persona's writing style (warmth, formality) to a specific `VoiceProfile`.
    - **Streaming Support**: Implements `AsyncIterable` for real-time audio chunk streaming.
    - **Style Matching**: Uses a similarity algorithm to select voices based on emotional and structural characteristics.
