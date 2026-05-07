// Workers run as a separate container (narration-worker service) in production.
// In development (NARRATION_WORKER_ENABLED=true, no separate worker container),
// they start inline with the Next.js server process.
import { startNarrationWorker } from './workers/narrationWorker'
import { startImportWorker } from './lib/queues/importQueue'
import { initStorage } from './lib/storage/init-storage'

// Ensure local dev GCS bucket exists when running against fake-gcs-server
initStorage().catch((error: unknown) => {
  console.error('[instrumentation] Failed to initialize storage:', error)
})

const workersEnabled = process.env.NARRATION_WORKER_ENABLED !== 'false'

if (workersEnabled) {
  try {
    const instance = startNarrationWorker()
    if (instance) {
      console.log('[instrumentation] narration worker started')
    } else {
      console.log('[instrumentation] narration worker disabled or already running')
    }
  } catch (error) {
    console.error('[instrumentation] Failed to start narration worker:', error)
  }

  try {
    startImportWorker()
    console.log('[instrumentation] import worker started')
  } catch (error) {
    console.error('[instrumentation] Failed to start import worker:', error)
  }
} else {
  console.log('[instrumentation] workers disabled — running as separate narration-worker container')
}
