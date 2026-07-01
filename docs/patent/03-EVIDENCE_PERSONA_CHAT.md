# Invention #2 — Evidence-Gated AI Persona Chat

> **Draft status note:** This file contains invention notes and may mix implemented behavior with proposed embodiments. Review [`08-PATENT_REVIEW_CRITIQUE.md`](./08-PATENT_REVIEW_CRITIQUE.md) before relying on it for attorney handoff.

> **Inventor:** Ryan Buck
> **Category:** Retrieval-Augmented Generation (RAG) / AI Persona Systems
> **Related Files:** `Chat/src/services/chat/`, `Chat/src/services/persona/`, `Chat/src/services/retrieval/`

---

## 1. Problem

Generic AI chatbots (ChatGPT, Claude, etc.) answer questions based on broad training data, making them unsuitable for family history conversations where **accuracy and faithfulness to the specific person's life** is paramount. Existing "persona" systems (Character.AI, Replika) use prompt-based personality instructions that do not prevent the model from fabricating information.

**Key gaps in prior art:**
- No system **refuses to answer** when it lacks sufficient documentary evidence
- No system **generates its persona** from uploaded family documents (letters, diaries, audio transcripts) rather than prompting
- No system combines **voice cloning + persona** so you can both talk to and hear the family member

---

## 2. The Invention

### 2.1 Evidence Gate — Grounded Response Filtering

The core innovation is the **Evidence Gate**: a configurable threshold that determines whether the AI has enough documentary evidence to answer a question.

```
User Question
     │
     ▼
Vector Search (ChromaDB)
  → Retrieves top-K document chunks
  → Scores each chunk by cosine similarity
     │
     ▼
Evidence Gate Check
  ┌─────────────────────────────────────┐
  │  minTopScore: 0.12                   │
  │  minAvgTop3: 0.08                    │
  │  minSources: 1                       │
  └─────────────────────────────────────┘
     │
     ├── PASSED → Build prompt → LLM → Response
     └── FAILED  → Natural-language refusal
```

**Evidence Gate Configuration** (`Chat/src/services/chat/ChatService.ts`):
```typescript
const CHAT_EVIDENCE_THRESHOLDS = {
  minTopScore: 0.12,     // Highest single chunk score must be ≥ 0.12
  minAvgTop3: 0.08,      // Average of top 3 chunks must be ≥ 0.08
  minSources: 1,         // At least 1 source document required
}
```

**Natural Language Refusals** (instead of generic "I don't know"):
```typescript
const REFUSAL_PREFIX_OPTIONS = [
  "I can't quite place that right now.",
  "That detail is slipping my mind right now.",
  "My memory is fuzzy on that one.",
  "I'm not certain about that memory.",
  "Getting older does this to me sometimes — it's not coming to me right now.",
]
```

The refusals are designed to sound like an elderly family member with imperfect memory — a deliberate UX choice that makes the AI persona feel more authentic rather than robotic.

### 2.2 Persona Generation from Documents

Instead of manually writing persona prompts, Heard Again **generates** the persona by analyzing uploaded family documents:

```typescript
class PersonaServiceImpl {
  async generatePersonaProfile(personId, familyspaceId, options) {
    // 1. Get all documents linked to this person
    const documents = await this.documentRepository.listDocuments(familyspaceId, { personId })
    
    // 2. Extract writing style (vocabulary, sentence patterns, tone, formality)
    let writingStyle = this.styleExtractor.extract(documents)
    
    // 3. Extract known facts (dates, places, relationships, events)
    let knownFacts = this.factExtractor.extract(documents)
    
    // 4. Extract relationship descriptions
    let relationships = this.relationshipExtractor.extract(documents)
    
    // 5. Build system prompt
    let systemPrompt = this.promptBuilder.build({
      writingStyle, knownFacts, relationships,
      evidenceGate: CHAT_EVIDENCE_THRESHOLDS
    })
    
    return { writingStyle, knownFacts, relationships, systemPrompt }
  }
}
```

The generated `PersonaProfile` contains (Prisma model):
- `vocabulary` — characteristic word usage
- `sentencePatterns` — stylistic sentence structures
- `tone` — emotional palette (JSON)
- `formality` — neutral/casual/formal level
- `commonPhrases` — frequently used expressions
- `emotionIndicators` — how emotion is expressed
- `knownFacts` — verified biographical facts
- `relationships` — documented relationships
- `systemPrompt` — compiled AI instructions
- `responseGuidelines` — behavioral constraints
- `behaviorInstructions` — how the persona should behave
- `confidenceScore` — how confident the system is in this persona

### 2.3 The Canonical Refusal / Evidence Boundary

A central design principle: **the AI persona is a representation of what the documents say, not a free-form generative character.**

```typescript
const CANONICAL_REFUSAL_MESSAGE = 
  "I don't have that documented in the materials I was given."
```

This is enforced at multiple layers:
1. **Evidence Gate** — prevents answering without documentary support
2. **Prompt Engineering** — the persona is instructed to refuse ungrounded questions
3. **Response Validation** — post-generation check for hallucination

### 2.4 RAG Pipeline Architecture

```
Document Upload
     │
     ▼
Ingestion Pipeline (BullMQ Workers)
  ├── Chunk document → DocumentChunk table
  ├── Generate embedding → Float[] vector
  └── Store in ChromaDB with metadata
     
User Message
     │
     ▼
Vector Search
  └── Query ChromaDB with user message embedding
      └── Returns top-K document chunks with scores
          │
          ▼
Evidence Gate
  └── Threshold check
      ├── PASS → Build persona prompt with retrieved chunks
      │         └── LLM (Ollama) → Stream response
      └── FAIL → Return natural-language refusal
```

### 2.5 Streaming Responses

The Chat service streams responses token-by-token using async iterators, allowing real-time display in the UI:

```typescript
interface ChatService {
  streamResponse(request: SendMessageRequest): Promise<AsyncIterable<StreamChunk>>
}
```

---

## 3. Prior Art Distinction

| Feature | Character.AI | Replika | Custom GPT (OpenAI) | Heard Again |
|---------|-------------|--------|-------------------|-------------|
| Evidence-gated responses | ✗ | ✗ | ✗ | ✓ |
| Persona from documents | ✗ | ✗ | ✗ (prompt only) | ✓ |
| Natural-language refusals | ✗ (generic) | ✗ (generic) | ✗ (generic) | ✓ (persona-themed) |
| Minimum evidence threshold | ✗ | ✗ | ✗ | ✓ (configurable) |
| Voice + persona integration | ✗ | ✓ (limited) | ✗ | ✓ |
| Open-source LLM | ✗ | ✗ | ✗ | ✓ (Ollama) |

---

## 4. Claims Ideas

1. **A method for evidence-gated AI persona conversation** comprising: retrieving document chunks from a vector database based on a user query; computing a relevance score for each chunk; comparing the scores against a configurable threshold; and either generating a response grounded in the chunks if the threshold is met, or returning a natural-language refusal message if not.

2. **The method of claim 1** wherein the refusal message is selected from a set of persona-specific phrases that simulate the conversational patterns of a human with imperfect memory.

3. **A system for generating an AI persona from family documents** comprising: a document repository containing digitized family records; a style extractor that analyzes vocabulary, sentence patterns, and tone; a fact extractor that identifies biographical events and relationships; and a prompt builder that compiles the extracted elements into a persona system prompt.

4. **The system of claim 3** wherein the generated persona profile includes a `confidenceScore` that reflects the quantity and quality of source documents used for generation.

---

## 5. Related Source Files

| File | Purpose |
|------|---------|
| `Chat/src/services/chat/ChatService.ts` | Core chat service with evidence gate |
| `Chat/src/services/chat/EvidenceGate.ts` | Evidence threshold logic |
| `Chat/src/services/chat/PromptBuilder.ts` | Persona prompt construction |
| `Chat/src/services/persona/PersonaService.ts` | Persona generation from documents |
| `Chat/src/services/persona/StyleExtractor.ts` | Writing style analysis |
| `Chat/src/services/persona/InstructionProcessor.ts` | Behavior instruction compilation |
| `Chat/src/services/retrieval/VectorSearch.ts` | ChromaDB vector retrieval |
| `Chat/src/services/retrieval/RetrievalService.ts` | Document retrieval orchestration |
| `Chat/src/services/ai/ResponseValidationService.ts` | Post-generation validation |
| `Chat/src/services/monitoring/RuntimeSafetyMetrics.ts` | Safety monitoring |
| `Chat/src/services/llm/LLMGateway.ts` | LLM provider abstraction |
| `prisma/schema.prisma` (PersonaProfile, ChatSession, ChatMessage, DocumentChunk) | Data models |
