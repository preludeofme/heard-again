# Phase 1 Chat System

Isolated conversational AI system for family history interactions, built as a separate service that communicates with the main Heard Again application via APIs.

## Architecture

- **Service-Oriented**: Clean separation of concerns with typed contracts
- **Tenant Isolation**: Multi-tenant architecture with workspace-scoped data
- **RAG-Powered**: Retrieval-augmented generation using ChromaDB
- **LLM Integration**: Ollama for local model serving
- **Voice Ready**: Integration points for existing TTS service

## Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your configuration

# Setup database
npm run migration:generate
npm run migration:dev

# Start development server
npm run dev
```

The chat system will run on port 3002, separate from the main app.

## Services

- **Chat Service**: Session management and message orchestration
- **Retrieval Service**: Vector search and context ranking  
- **Persona Service**: Profile management and style extraction
- **Ingestion Service**: Document processing and embedding generation
- **LLM Gateway**: Ollama communication and prompt formatting

## API Endpoints

- `/api/chat/*` - Chat sessions and messaging
- `/api/ingestion/*` - Document upload and processing
- `/api/personas/*` - Persona profile management

## Development

This service is designed to run independently while integrating with the main Heard Again application through well-defined APIs.

```bash
# Run ingestion worker
npm run ingestion:worker

# Run tests
npm run test

# Type checking
npm run type-check
```
