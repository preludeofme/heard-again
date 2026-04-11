# Ingestion Worker Setup

The ingestion worker processes uploaded documents for RAG (Retrieval-Augmented Generation). It can run in Docker or locally.

## Docker Setup (Recommended)

### Production
```bash
# Start all services including ingestion worker
docker-compose --profile with-ingestion up -d

# Check worker health
docker-compose exec ingestion-worker curl -f http://localhost:4779/api/worker/health
```

### Development
```bash
# Start with development overrides (includes source code mounting)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# View worker logs
docker-compose logs -f ingestion-worker

# Check worker health
curl http://localhost:4779/api/worker/health
```

## Local Development

### Prerequisites
- Node.js 18+
- Redis running
- PostgreSQL running
- ChromaDB running

### Start Services
```bash
# Start dependencies
docker-compose up -d db redis chromadb ollama

# Start the worker
npm run ingestion:worker
```

### Health Check
The worker exposes a health check endpoint:
```bash
curl http://localhost:4779/api/worker/health
```

Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-11T03:30:00.000Z",
  "pid": 12345,
  "uptime": 3600
}
```

## Monitoring

### Check Queue Status
```bash
# In the Chat directory
node scripts/check-queue.js
```

### View Logs
```bash
# Docker
docker-compose logs -f ingestion-worker

# Local
# Worker logs to stdout
```

## Troubleshooting

### Worker Not Starting
1. Check Redis connection: `redis-cli ping`
2. Verify environment variables
3. Check Docker logs: `docker-compose logs ingestion-worker`

### Health Check Failing
1. Verify worker can connect to Redis
2. Check if BullMQ queue is accessible
3. Ensure PORT=4779 is set

### Documents Not Processing
1. Check if worker is running: `curl http://localhost:4779/api/worker/health`
2. Verify temp directory exists: `ls -la temp-ingestion/`
3. Check queue for jobs: See monitoring section above

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| NODE_ENV | No | development | Environment |
| DATABASE_URL | Yes | - | PostgreSQL connection |
| REDIS_URL | Yes | - | Redis connection |
| REDIS_HOST | No | localhost | Redis host |
| REDIS_PORT | No | 6379 | Redis port |
| CHROMA_URL | Yes | - | ChromaDB URL |
| OLLAMA_URL | No | http://localhost:11434 | Ollama URL |
| PORT | No | 4779 | Health check port |
| WORKER_CONCURRENCY | No | 3 | Max concurrent jobs |
