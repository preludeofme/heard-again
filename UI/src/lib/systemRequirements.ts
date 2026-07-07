export interface SystemRequirementTier {
  title: string
  items: string[]
  note?: string
}

/**
 * Single source of truth for self-hosting minimum system requirements.
 * Based on the resource limits declared in docker-compose.yml:
 * - Core stack (app, chat, db, redis, clamav, chromadb, narration-worker) sums to ~18GB of memory limits.
 * - Local AI adds Ollama (16GB limit, GPU) and the TTS service (12GB limit, GPU,
 *   reference GPU RTX 4090 / 24GB VRAM per TTS/RUNPOD_CONFIG.md).
 */
export const systemRequirementTiers: SystemRequirementTier[] = [
  {
    title: 'Core archive (photos, documents, family tree)',
    items: [
      '4 CPU cores, 8GB RAM',
      '20GB+ free disk space (grows with your media)',
      'Docker & Docker Compose',
      'Linux, macOS, or Windows (WSL2)',
    ],
  },
  {
    title: 'Local AI chat & voice cloning',
    items: [
      '8+ CPU cores, 32GB RAM',
      'NVIDIA GPU with 24GB VRAM (e.g. RTX 3090/4090)',
      '50GB+ free disk (AI models + generated audio)',
    ],
    note: 'No local GPU? AI chat and voice generation can also run against a cloud LLM or RunPod endpoint instead of local hardware.',
  },
]
