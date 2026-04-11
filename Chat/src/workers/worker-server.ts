import { createServer } from 'http'
import { parse } from 'url'
import { IngestionWorker, startWorker } from './ingestion'

/**
 * Simple HTTP server for health checks that runs alongside the worker
 * The worker runs in the background while this server handles health checks
 */
async function startWorkerServer() {
  const port = parseInt(process.env.PORT || '4779')
  
  // Start the ingestion worker in the background
  startWorker().catch((error) => {
    console.error('Failed to start ingestion worker:', error)
    process.exit(1)
  })
  
  // Create a simple HTTP server for health checks
  const server = createServer((req, res) => {
    const { pathname } = parse(req.url || '')
    
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200)
      res.end()
      return
    }
    
    if (pathname === '/api/worker/health' && req.method === 'GET') {
      // Health check endpoint
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        pid: process.pid,
        uptime: process.uptime(),
      }))
    } else {
      // 404 for other routes
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found' }))
    }
  })
  
  server.listen(port, () => {
    console.log(`Worker health server listening on port ${port}`)
  })
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    console.log('Received SIGTERM, shutting down gracefully')
    server.close(() => {
      console.log('Worker server closed')
      process.exit(0)
    })
  })
  
  process.on('SIGINT', () => {
    console.log('Received SIGINT, shutting down gracefully')
    server.close(() => {
      console.log('Worker server closed')
      process.exit(0)
    })
  })
}

// Start the server if this file is run directly
if (require.main === module) {
  startWorkerServer().catch(console.error)
}

export { startWorkerServer }
