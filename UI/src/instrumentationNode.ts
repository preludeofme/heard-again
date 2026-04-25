// Node-only side of the Next.js instrumentation hook. Imported lazily from
// instrumentation.ts when NEXT_RUNTIME === 'nodejs', so the Edge-runtime
// bundle never follows the worker → BullMQ → fs/promises chain.
import { startNarrationWorker } from './workers/narrationWorker'

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
