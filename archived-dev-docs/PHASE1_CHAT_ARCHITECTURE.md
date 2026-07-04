# Phase 1 Family-History Conversational System - Architecture Design

## Executive Summary

This design outlines a production-grade, multi-tenant conversational AI system that enables users to chat with AI representations of family members based on their writings, stories, and historical documents. The system uses Ollama for LLM serving, implements robust RAG capabilities, ensures strict tenant isolation, and integrates seamlessly with the existing Heard Again platform's voice synthesis pipeline.

## Recommended Architecture

### Core Design Principles
- **Service-Oriented Architecture**: Clear separation of concerns with typed contracts
- **Defense in Depth**: Multiple layers of security and validation
- **Tenant Isolation by Default**: All data access scoped by familyspace
- **Production-Ready**: Observable, testable, maintainable, and scalable

### High-Level Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │  Document Store  │    │   Vector DB     │
│   (API Layer)   │◄──►│   (PostgreSQL)  │◄──►│   (ChromaDB)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Chat Service   │    │ Ingestion Queue │    │  Retrieval Svc  │
│   (Orchestration)│◄──►│   (Redis/Bull)  │◄──►│   (Embeddings)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Persona Svc    │    │   LLM Gateway   │    │   TTS Service   │
│ (Profile Mgmt)  │◄──►│   (Ollama)      │◄──►│  (Qwen3-TTS)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Service Breakdown

### 1. API Layer (Next.js Routes)
**Responsibility**: HTTP interface, authentication, basic validation
- `/api/chat/*` - Chat endpoints
- `/api/documents/*` - Document management
- `/api/ingestion/*` - Ingestion job management
- `/api/personas/*` - Persona profile management

### 2. Chat Service (Application Layer)
**Responsibility**: Chat orchestration, session management, prompt construction
```typescript
interface ChatService {
  createSession(familyspaceId: string, personId: string): Promise<ChatSession>
  sendMessage(sessionId: string, message: string): Promise<ChatResponse>
  getHistory(sessionId: string): Promise<ChatMessage[]>
}
```

### 3. Retrieval Service
**Responsibility**: Vector search, context ranking, relevance filtering
```typescript
interface RetrievalService {
  searchDocuments(query: string, context: SearchContext): Promise<RetrievedDocument[]>
  searchPersonaDocuments(personId: string, query: string): Promise<RetrievedDocument[]>
  rankDocuments(documents: RetrievedDocument[], query: string): Promise<RetrievedDocument[]>
}
```

### 4. Ingestion Service
**Responsibility**: Document processing, chunking, embedding generation
```typescript
interface IngestionService {
  ingestDocument(documentId: string): Promise<IngestionJob>
  processChunk(chunk: DocumentChunk): Promise<Embedding>
  updateDocumentEmbeddings(documentId: string): Promise<void>
}
```

### 5. Persona Service
**Responsibility**: Persona profile management, style extraction, prompt template management
```typescript
interface PersonaService {
  getPersonaProfile(personId: string): Promise<PersonaProfile>
  extractStyleFromDocuments(personId: string): Promise<StyleProfile>
  generatePromptTemplate(persona: PersonaProfile): Promise<PromptTemplate>
}
```

### 6. LLM Gateway
**Responsibility**: Ollama communication, prompt formatting, response parsing
```typescript
interface LLMGateway {
  generateResponse(prompt: CompiledPrompt): Promise<LLMResponse>
  streamResponse(prompt: CompiledPrompt): Promise<AsyncIterable<string>>
  validateResponse(response: string): Promise<ValidatedResponse>
}
```

## Recommended Tech Stack

### LLM & Embeddings
- **Ollama** - Local LLM serving with model management
  - **Primary Model**: `llama3.1:8b-instruct` - Balance of quality and performance
  - **Alternative**: `qwen2.5:7b-instruct` - Strong multilingual support
  - **Embedding Model**: `nomic-embed-text:latest` - High quality, local inference

### Vector Database
- **ChromaDB** - Open-source, local-first, tenant-aware collections
  - **Why**: Simple deployment, good TypeScript support, metadata filtering
  - **Alternative**: Qdrant (if need advanced filtering)

### Document Processing
- **PDF.js** - PDF text extraction
- **mammoth.js** - DOCX processing  
- **marked** - Markdown parsing
- **node-unidecode** - Text sanitization

### Queue System
- **BullMQ** - Redis-based job queue (already using Redis)
- **Why**: Existing infrastructure, good TypeScript support, retry logic

### Security & Validation
- **Zod** - Runtime type validation (already in use)
- **helmet** - HTTP security headers
- **express-rate-limit** - Rate limiting (already in use)
- **ClamAV** - Virus scanning (already integrated)

## Data Flow

### Document Upload → Embedding Flow
```
1. User uploads document → API validates file → Creates Document record
2. Ingestion job queued → Background worker processes file
3. Text extraction → Chunking (512 tokens with overlap) → Sanitization
4. Embedding generation (Nomic) → Store in ChromaDB with tenant metadata
5. Update Document status → Notify completion
```

### Chat Query Flow
```
1. User message → API validates → Create/Retrieve chat session
2. Persona Service loads persona profile → Extract style parameters
3. Retrieval Service searches relevant documents (tenant + person scoped)
4. Context ranking → Select top-k documents → Construct prompt
5. LLM Gateway sends to Ollama → Stream response back
6. Response validation → Store chat history → Return to client
7. Optional: Send to TTS service for voice synthesis
```

## Persona Modeling Strategy

### Profile Structure
```typescript
interface PersonaProfile {
  personId: string
  familyspaceId: string
  // Extracted from documents
  writingStyle: {
    vocabulary: string[]
    sentencePatterns: string[]
    tone: ToneAnalysis
    formality: FormalityLevel
  }
  // Known facts and relationships
  knownFacts: PersonaFact[]
  relationships: Relationship[]
  // Prompt template
  systemPrompt: string
  responseGuidelines: string[]
}
```

### Prompt Architecture
```
System: You are {personName}, born {birthDate}, known for {keyTraits}. 
        You speak in a {formality} manner with a {tone} tone.
        Base responses only on the provided context and your known experiences.
        Do not invent facts or claim certainty about uncertain information.

Context: 
{retrievedDocuments}

History:
{chatHistory}

User: {userMessage}

Guidelines:
- Respond as {personName} would
- Reference specific memories when relevant
- Acknowledge uncertainty when appropriate
- Maintain consistent voice and style
```

## Security Architecture

### Tenant Isolation Layers
1. **Database Level**: All queries include `familyspaceId` filter
2. **Vector DB Level**: Collections scoped by familyspace, metadata filtering
3. **API Level**: Session validation on every request
4. **Service Level**: Context passing with tenant validation

### Input Validation
1. **File Upload**: Type validation, size limits, ClamAV scanning
2. **Document Content**: Text sanitization, length limits, encoding validation
3. **Chat Input**: Length limits, content filtering, prompt injection detection
4. **LLM Output**: Response validation, content filtering, PII detection

### Prompt Injection Defense
```
1. Input sanitization: Remove/escape special characters
2. Context boundaries: Clear delimiters between sections
3. Instruction isolation: Separate system prompts from user content
4. Output validation: Check for prompt leakage attempts
5. Audit logging: Log all prompt constructions and responses
```

## Dockerization Strategy

### Service Containers
```yaml
services:
  # Existing services
  app:
  db:
  redis:
  tts:
  
  # New Phase 1 services
  ollama:
    image: ollama/ollama:latest
    ports: ["11434:11434"]
    volumes: ["ollama_models:/root/.ollama"]
    deploy:
      resources:
        reservations:
          devices: [{driver: nvidia, count: 1, capabilities: [gpu]}]
  
  chromadb:
    image: chromadb/chroma:latest
    ports: ["8000:8000"]
    volumes: ["chroma_data:/chroma/chroma"]
    environment:
      - CHROMA_SERVER_HOST=0.0.0.0
      - CHROMA_SERVER_AUTH_CREDENTIALS=${CHROMA_CREDENTIALS}
  
  ingestion-worker:
    build: ./services/ingestion
    depends_on: [redis, chromadb, ollama]
    environment:
      - REDIS_URL=redis://redis:6379
      - CHROMA_URL=http://chromadb:8000
      - OLLAMA_URL=http://ollama:11434
```

### Multi-Stage Builds
```dockerfile
# services/ingestion/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runtime
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
USER nextjs
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

## Testing Strategy

### Unit Testing
- **Service Layer**: Test business logic in isolation
- **Data Access**: Test repository patterns with mock DB
- **Security**: Test validation and sanitization functions

### Integration Testing
- **API Endpoints**: Test full request/response cycles
- **Document Processing**: Test ingestion pipeline end-to-end
- **Chat Flow**: Test retrieval → LLM → response generation

### Security Testing
- **Tenant Isolation**: Verify data leakage prevention
- **Prompt Injection**: Test adversarial input handling
- **File Security**: Test malicious file upload prevention

### Performance Testing
- **Concurrent Chats**: Test multi-user load
- **Large Documents**: Test ingestion performance
- **Vector Search**: Test retrieval speed and accuracy

## Implementation Roadmap

### Phase 1.1: Foundation (Week 1-2)
**Goal**: Basic infrastructure and data models
**Files/Services**:
- `src/services/chat/ChatService.ts`
- `src/services/retrieval/RetrievalService.ts`
- `src/services/persona/PersonaService.ts`
- `src/services/llm/LLMGateway.ts`
- `src/types/chat.ts`, `src/types/persona.ts`
- Database migrations for chat tables

**Dependencies**:
- Ollama installation and basic setup
- ChromaDB container setup
- Redis queue configuration

**Risks**:
- GPU memory constraints for Ollama
- Vector DB performance with large datasets

**Acceptance Criteria**:
- All services defined with TypeScript interfaces
- Database schema created and tested
- Ollama and ChromaDB accessible in development
- Basic health checks implemented

### Phase 1.2: Document Ingestion (Week 2-3)
**Goal**: Complete document processing pipeline
**Files/Services**:
- `src/services/ingestion/IngestionService.ts`
- `src/services/ingestion/DocumentProcessor.ts`
- `src/services/ingestion/EmbeddingGenerator.ts`
- `src/pages/api/ingestion/upload.ts`
- `src/pages/api/ingestion/jobs/[id].ts`
- Background worker implementation

**Dependencies**:
- Phase 1.1 foundation complete
- File parsing libraries integrated
- Embedding model selected and tested

**Risks**:
- Large file processing memory usage
- Embedding generation performance
- Document format edge cases

**Acceptance Criteria**:
- Documents upload successfully
- Text extraction works for PDF, DOCX, TXT, MD
- Chunks generated with proper overlap
- Embeddings stored in ChromaDB with tenant isolation
- Ingestion jobs trackable via API

### Phase 1.3: Chat Implementation (Week 3-4)
**Goal**: Basic chat functionality with RAG
**Files/Services**:
- `src/pages/api/chat/sessions.ts`
- `src/pages/api/chat/messages.ts`
- `src/services/chat/PromptBuilder.ts`
- `src/services/retrieval/VectorSearch.ts`
- Chat UI components (if needed)

**Dependencies**:
- Phase 1.2 ingestion working
- LLM model loaded in Ollama
- Persona profiles creatable

**Risks**:
- LLM response quality
- Retrieval relevance accuracy
- Prompt injection vulnerabilities

**Acceptance Criteria**:
- Chat sessions can be created and managed
- Messages retrieve relevant document context
- LLM responses are persona-consistent
- Chat history persists correctly
- Basic rate limiting implemented

### Phase 1.4: Persona & Style (Week 4-5)
**Goal**: Advanced persona modeling and style extraction
**Files/Services**:
- `src/services/persona/StyleExtractor.ts`
- `src/services/persona/PromptTemplate.ts`
- `src/pages/api/personas/[id].ts`
- `src/pages/api/personas/[id]/style.ts`

**Dependencies**:
- Phase 1.3 chat working
- Sufficient document samples for analysis
- NLP processing capabilities

**Risks**:
- Style extraction accuracy
- Overfitting to limited documents
- Computational complexity

**Acceptance Criteria**:
- Persona profiles auto-extract style from documents
- Prompt templates adapt to individual personas
- Response consistency improves with style modeling
- Manual persona override capabilities available

### Phase 1.5: TTS Integration (Week 5-6)
**Goal**: Connect chat responses to voice synthesis
**Files/Services**:
- `src/services/chat/VoiceIntegration.ts`
- `src/pages/api/chat/[id]/speak.ts`
- Integration with existing VoiceService

**Dependencies**:
- Phase 1.4 chat stable
- Existing TTS service operational
- Voice profiles available

**Risks**:
- Response text length limitations
- Voice profile availability
- Audio generation latency

**Acceptance Criteria**:
- Chat responses can be converted to speech
- Voice selection respects persona voice profiles
- Audio generation integrates with existing asset system
- Error handling for TTS failures

### Phase 1.6: Security Hardening (Week 6-7)
**Goal**: Production security and tenant isolation
**Files/Services**:
- Security middleware updates
- Input validation enhancements
- Audit logging implementation
- Rate limiting per tenant

**Dependencies**:
- All core functionality complete
- Security audit requirements identified

**Risks**:
- Performance impact from security measures
- False positives in content filtering
- Complexity of tenant isolation testing

**Acceptance Criteria**:
- All inputs validated and sanitized
- Tenant isolation verified through testing
- Prompt injection attacks mitigated
- Comprehensive audit logging implemented
- Security headers and rate limiting active

## Open Questions / Decisions Needed

1. **Model Selection**: Final choice between Llama3.1:8b vs Qwen2.5:7b based on testing
2. **Chunking Strategy**: Optimal chunk size and overlap for family history documents
3. **Retrieval Limits**: Maximum documents to retrieve per query (balance quality vs performance)
4. **Chat History Limits**: How many messages to retain in context window
5. **Voice Integration**: Whether to stream TTS or wait for complete response
6. **Deployment**: GPU requirements for production Ollama instance
7. **Monitoring**: Specific metrics and alerting thresholds for LLM operations

## Conclusion

This architecture provides a solid foundation for Phase 1 while maintaining the production-grade standards and security requirements specified. The modular design allows for incremental implementation and testing at each phase, ensuring a robust and maintainable system that integrates cleanly with the existing Heard Again platform.
