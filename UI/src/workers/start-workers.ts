import { startNarrationWorker, stopNarrationWorker } from './narrationWorker'
import { startImportWorker } from '@/lib/queues/importQueue'
import { logger } from '@/lib/logger'

async function main() {
  logger.info('Starting standalone worker process')

  const narrationWorker = startNarrationWorker()
  if (narrationWorker) {
    logger.info('Narration worker started')
  }

  startImportWorker()
  logger.info('Import worker started')

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutdown signal received — stopping workers gracefully')
    await stopNarrationWorker()
    logger.info('Workers stopped')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  logger.info('Worker process ready')
}

main().catch((err) => {
  console.error('Worker process failed to start:', err)
  process.exit(1)
})
