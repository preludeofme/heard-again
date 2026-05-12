const PROVIDER = (process.env.NARRATION_LLM_PROVIDER ?? 'openai') as 'openai' | 'ollama'
const PRIMARY_MODEL = process.env.NARRATION_LLM_MODEL ?? 'gpt-4.1-nano'
const FALLBACK_MODEL = process.env.NARRATION_LLM_FALLBACK_MODEL ?? 'gpt-4.1-mini'
const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''
const MAX_TOKENS = Number(process.env.NARRATION_MAX_TOKENS ?? 2000)
const TEMPERATURE = Number(process.env.NARRATION_TEMPERATURE ?? 0.3)

const WORDS_FALLBACK_THRESHOLD = 8000
const THIRD_PERSON_PRONOUN_RATIO_THRESHOLD = 0.04
const THIRD_PERSON_RE = /\b(he|she|they|his|her|their|him|them)\b/gi
const AMBIGUITY_RE = /\b(unclear|ambiguous|I'm not sure|hard to tell|cannot determine|it(?:'s| is) unclear)\b/i

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type FallbackReason = 'input_length' | 'empty_output' | 'third_person_leak' | 'ambiguity' | 'quality_override'

export interface LLMCallResult {
  content: string
  model: string
  usedFallback: boolean
  fallbackReason?: FallbackReason
}

async function callOpenAI(model: string, messages: LLMMessage[]): Promise<{ content: string; model: string }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model, messages, temperature: TEMPERATURE, max_tokens: MAX_TOKENS }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`OpenAI API error (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return {
    content: (data.choices?.[0]?.message?.content as string) ?? '',
    model: (data.model as string) ?? model,
  }
}

async function callOllama(model: string, messages: LLMMessage[]): Promise<{ content: string; model: string }> {
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      options: { temperature: TEMPERATURE, num_predict: MAX_TOKENS, top_p: 0.9, repeat_penalty: 1.1 },
      messages,
    }),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Ollama error (${res.status}): ${errText}`)
  }

  const data = await res.json()
  return {
    content: (data?.message?.content as string) ?? '',
    model: (data?.model as string) ?? model,
  }
}

function callProvider(model: string, messages: LLMMessage[]): Promise<{ content: string; model: string }> {
  return PROVIDER === 'ollama' ? callOllama(model, messages) : callOpenAI(model, messages)
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function thirdPersonRatio(text: string): number {
  const matches = text.match(THIRD_PERSON_RE)
  if (!matches) return 0
  const words = wordCount(text)
  return words > 0 ? matches.length / words : 0
}

function detectFallbackReason(content: string): FallbackReason | undefined {
  if (!content.trim()) return 'empty_output'
  if (thirdPersonRatio(content) > THIRD_PERSON_PRONOUN_RATIO_THRESHOLD) return 'third_person_leak'
  if (AMBIGUITY_RE.test(content)) return 'ambiguity'
  return undefined
}

export async function rewriteWithFallback(
  messages: LLMMessage[],
  inputText: string,
  options: { qualityOverride?: boolean } = {}
): Promise<LLMCallResult> {
  // Skip primary entirely for long inputs or explicit quality override
  if (wordCount(inputText) > WORDS_FALLBACK_THRESHOLD) {
    const result = await callProvider(FALLBACK_MODEL, messages)
    return { ...result, usedFallback: true, fallbackReason: 'input_length' }
  }

  if (options.qualityOverride) {
    const result = await callProvider(FALLBACK_MODEL, messages)
    return { ...result, usedFallback: true, fallbackReason: 'quality_override' }
  }

  const primary = await callProvider(PRIMARY_MODEL, messages)
  const fallbackReason = detectFallbackReason(primary.content)

  if (!fallbackReason) {
    return { ...primary, usedFallback: false }
  }

  const fallback = await callProvider(FALLBACK_MODEL, messages)
  return { ...fallback, usedFallback: true, fallbackReason }
}
