export interface InferenceSettings {
  temperature: number
  topP: number
  topK: number
  repeatPenalty: number
  maxTokens: number
}

export interface ModelReleasePolicy {
  primaryModel: string
  fallbackModel: string
  embeddingModel: string
  runtime: 'ollama'
  minRuntimeVersion: string
  specVersion: string
}

export interface PromptContextTuning {
  maxContextTokens: number
  maxDocuments: number
  maxExcerptTokens: number
  includeCitationMetadata: boolean
}

export interface LaunchGoNoGoThresholds {
  minGroundedPrecision: number
  maxUnsupportedClaimRate: number
  minRefusalPrecision: number
  minRefusalRecall: number
  minPersonaStyleConsistencyScore: number
  minCitationCoverage: number
  maxP95LatencyMs: number
  maxMeanTokensPerResponse: number
}

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

export const RELEASE_CANDIDATE_MODEL_POLICY: ModelReleasePolicy = {
  primaryModel:
    process.env.OLLAMA_PRIMARY_MODEL ||
    process.env.OLLAMA_MODEL ||
    'qwen3.5:8b-instruct',
  fallbackModel:
    process.env.OLLAMA_FALLBACK_MODEL ||
    'llama3.1:8b-instruct',
  embeddingModel:
    process.env.OLLAMA_EMBEDDING_MODEL ||
    'nomic-embed-text:latest',
  runtime: 'ollama',
  minRuntimeVersion: '0.5.0',
  specVersion: 'persona-rc-v1',
}

export const STRICT_CHAT_INFERENCE_SETTINGS: InferenceSettings = {
  temperature: parseNumber(process.env.CHAT_TEMPERATURE, 0.5),
  topP: parseNumber(process.env.CHAT_TOP_P, 0.08),
  topK: parseNumber(process.env.CHAT_TOP_K, 24),
  repeatPenalty: parseNumber(process.env.CHAT_REPEAT_PENALTY, 1.15),
  maxTokens: parseNumber(process.env.CHAT_MAX_TOKENS, 800),
}

export const STYLE_ANALYSIS_INFERENCE_SETTINGS: InferenceSettings = {
  temperature: parseNumber(process.env.STYLE_ANALYSIS_TEMPERATURE, 0.2),
  topP: parseNumber(process.env.STYLE_ANALYSIS_TOP_P, 0.7),
  topK: parseNumber(process.env.STYLE_ANALYSIS_TOP_K, 30),
  repeatPenalty: parseNumber(process.env.STYLE_ANALYSIS_REPEAT_PENALTY, 1.05),
  maxTokens: parseNumber(process.env.STYLE_ANALYSIS_MAX_TOKENS, 800),
}

export const FACT_EXTRACTION_INFERENCE_SETTINGS: InferenceSettings = {
  temperature: parseNumber(process.env.FACT_EXTRACTION_TEMPERATURE, 0.05),
  topP: parseNumber(process.env.FACT_EXTRACTION_TOP_P, 0.2),
  topK: parseNumber(process.env.FACT_EXTRACTION_TOP_K, 20),
  repeatPenalty: parseNumber(process.env.FACT_EXTRACTION_REPEAT_PENALTY, 1.1),
  maxTokens: parseNumber(process.env.FACT_EXTRACTION_MAX_TOKENS, 1024),
}

export const PROMPT_CONTEXT_TUNING: PromptContextTuning = {
  maxContextTokens: parseNumber(process.env.CHAT_MAX_CONTEXT_TOKENS, 7000),
  maxDocuments: parseNumber(process.env.CHAT_MAX_CONTEXT_DOCS, 5),
  maxExcerptTokens: parseNumber(process.env.CHAT_MAX_EXCERPT_TOKENS, 280),
  includeCitationMetadata: true,
}

export const LAUNCH_GO_NO_GO_THRESHOLDS: LaunchGoNoGoThresholds = {
  minGroundedPrecision: parseNumber(process.env.EVAL_MIN_GROUNDED_PRECISION, 0.9),
  maxUnsupportedClaimRate: parseNumber(process.env.EVAL_MAX_UNSUPPORTED_CLAIM_RATE, 0.05),
  minRefusalPrecision: parseNumber(process.env.EVAL_MIN_REFUSAL_PRECISION, 0.95),
  minRefusalRecall: parseNumber(process.env.EVAL_MIN_REFUSAL_RECALL, 0.95),
  minPersonaStyleConsistencyScore: parseNumber(
    process.env.EVAL_MIN_PERSONA_STYLE_SCORE,
    0.85
  ),
  minCitationCoverage: parseNumber(process.env.EVAL_MIN_CITATION_COVERAGE, 0.95),
  maxP95LatencyMs: parseNumber(process.env.EVAL_MAX_P95_LATENCY_MS, 4500),
  maxMeanTokensPerResponse: parseNumber(
    process.env.EVAL_MAX_MEAN_TOKENS_PER_RESPONSE,
    420
  ),
}
