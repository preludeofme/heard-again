# Heard Again - Implementation Todo (Remaining Work)

> This document tracks **incomplete work only**. Completed items have been removed.

**Status Key:**
- `[ ]` Not Started
- `[-]` In Progress
- `[~]` Partially Complete
- `[x]` Complete


---
## Phase 1: Chat
- [ ] Create a llm-based chat system with ollama and a performant but high quality llm
    - [ ] LLM needs to support RAG
    - [ ] LLM needs to be tuned for impersonating people based on background documentation
    - The idea is that the llm will take on the persona of the specific family member and respond as them. So it will review the rag documentation and stories about the person and any writings from that person to understand their personality, voice, and mannerisms.
- [ ] Create a vector DB to handle the documents etc for RAG
- [ ] Create a system to ingest documents and convert them to embeddings for RAG
- [ ] Create a system to query the vector DB and retrieve relevant information for the LLM
- [ ] Create a system to tie in the LLM to the STT so the LLM can use the rag documentation to respond to the user in the cloned voice
- [ ] LLM needs to be isolated so that it can't expose other customer's data or system data
    - [ ] Need to follow all LLM hardening practices
    - [ ] Need to follow all LLM security practices
    - [ ] LLM should not be able to access other customer's data or system data
- [ ] LLM/DB/system needs to be dockerized and integrated into the existing systems 
 
## Phase 5: Stories & Memory System (Remaining)

### UI - Stories
- [ ] Story editor with rich text (basic inline editing via detail page)
=---

## Phase 13: Testing & Quality Assurance

### Automated Testing
- [ ] Unit tests for API routes
- [ ] Integration tests for voice pipeline
- [ ] E2E tests for critical user flows
- [ ] Database migration tests

### Manual QA
- [ ] Cross-browser testing
- [ ] Mobile responsiveness testing
- [ ] Accessibility audit (WCAG)
- [ ] Performance testing (Lighthouse)

---

## Phase 14: Deployment & Operations

### Production Setup
- [x] Production database setup
- [x] Environment configuration
- [x] Docker configuration for deployment
- [~] CI/CD pipeline

### Monitoring & Logging
- [ ] Error tracking (Sentry)
- [ ] Application monitoring
- [ ] Voice service health monitoring
- [ ] Usage analytics

### Documentation
- [ ] API documentation (OpenAPI/Swagger)
- [ ] User documentation
- [ ] Self-hosting guide
- [ ] Admin/runbook documentation

---

## Next Priority Actions


---

*For completed work history, see git history or the SCALABILITY_CHECKLIST.md for architectural progress.*
