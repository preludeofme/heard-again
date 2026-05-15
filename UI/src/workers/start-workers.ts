import { logger } from '@/lib/logger'

// GEDCOM import now runs via Trigger.dev — no standalone workers needed here.
// This entry point is kept for the narration-worker container; remove once
// narrationWorker.ts BullMQ cleanup is complete.

async function main() {
  logger.info('Worker process started — no active workers (all tasks on Trigger.dev)')

  function shutdown(signal: string) {
    logger.info({ signal }, 'Shutdown signal received')
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('Worker process failed to start:', err)
  process.exit(1)
})
