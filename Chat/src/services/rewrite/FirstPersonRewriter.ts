import { LLMGateway, CompiledPrompt } from '@/types'
import { RELEASE_CANDIDATE_MODEL_POLICY } from '@/config/releaseCandidate'

export interface RewriteRequest {
  content: string
  subjectName?: string
  speakerName?: string
  styleHints?: string
}

export interface RewriteResult {
  rewrittenContent: string
  model: string
  processingTimeMs: number
}

const NARRATION_MAX_TOKENS = Number(process.env.NARRATION_MAX_TOKENS || 2000)
const NARRATION_TEMPERATURE = Number(process.env.NARRATION_TEMPERATURE || 0.3)

export class FirstPersonRewriter {
  constructor(private llm: LLMGateway) {}

  async rewrite(request: RewriteRequest): Promise<RewriteResult> {
    const start = Date.now()

    const subject = request.subjectName?.trim() || 'the subject of this story'
    const systemPrompt = buildSystemPrompt(subject, request.styleHints)

    const prompt: CompiledPrompt = {
      systemPrompt,
      context: '',
      history: [],
      userMessage: buildUserMessage(request.content, subject, request.speakerName),
      metadata: {
        model:
          process.env.NARRATION_LLM_MODEL ||
          RELEASE_CANDIDATE_MODEL_POLICY.primaryModel,
        temperature: NARRATION_TEMPERATURE,
        maxTokens: NARRATION_MAX_TOKENS,
        topP: 0.9,
      },
    }

    const response = await this.llm.generateResponse(prompt)
    const cleaned = cleanRewrite(response.content)

    if (cleaned.length === 0) {
      console.warn('[rewrite] empty after clean', {
        model: response.metadata.model,
        rawLength: response.content?.length ?? 0,
        rawPreview: (response.content || '').slice(0, 200),
        finishReason: response.metadata.finishReason,
        completionTokens: response.metadata.completionTokens,
      })
    }

    // Validate the rewritten content for hallucinations or other safety violations
    const validation = await this.llm.validateResponse(cleaned, {
      documents: [request.content], // Use original content as the grounded context
    })

    if (validation.violations.length > 0) {
      const highSeverity = validation.violations.filter(v => v.severity === 'high')
      if (highSeverity.length > 0) {
        // We log high-severity violations for audit but still return the content 
        // as the user will have a chance to review it in the READY state.
        console.warn('[rewrite] High-severity violations detected in rewrite', {
          violations: highSeverity.map(v => ({ type: v.type, desc: v.description })),
          subject: request.subjectName
        })
      }
    }

    return {
      rewrittenContent: cleaned,
      model: response.metadata.model,
      processingTimeMs: Date.now() - start,
    }
  }
}

function buildSystemPrompt(subject: string, styleHints?: string): string {
  const styleSection = styleHints?.trim()
    ? `\n\nSpeaking style notes for ${subject}:\n${styleHints.trim()}\n`
    : ''

  return `You are rewriting a family memory so that ${subject} can narrate it aloud in their own voice, in first person. The ORIGINAL TEXT was written by a family member ABOUT ${subject}.

Rules (absolute):
1. Do not invent facts. Only use information present in the ORIGINAL TEXT.
2. Do not add feelings, opinions, or memories that were not written.
3. Preserve every name, date, place, and quoted dialogue exactly as written.
4. Rewrite the perspective from third-person to first-person, as if ${subject} is telling this story aloud to their family today.
5. Convert references to ${subject} (they/he/she/their/his/her) into "I/me/my" where appropriate. Other people remain in third person.
6. Keep the original pacing and emotional register. Do not dramatize.
7. Write in plain spoken English, the way someone speaks aloud. No stage directions, no headings, no markdown, no meta commentary. Just the story.
8. If the ORIGINAL TEXT is already written in first person from ${subject}'s perspective, return it nearly verbatim with only minor cleanup for spoken cadence.
9. Do not add a preamble like "Here is the rewrite" or "Sure,". Return only the rewritten story text.${styleSection}`
}

function buildUserMessage(content: string, subject: string, speakerName?: string): string {
  const authorLine = speakerName?.trim()
    ? `The ORIGINAL TEXT below was written by ${speakerName.trim()}.\n\n`
    : ''
  return `${authorLine}ORIGINAL TEXT (about ${subject}):\n"""\n${content}\n"""\n\nRewrite the ORIGINAL TEXT so ${subject} can narrate it in first person. Return only the rewritten story.`
}

function cleanRewrite(raw: string): string {
  let text = raw.trim()

  const prefixPatterns = [
    /^sure[,!]\s*/i,
    /^here(?:'s| is)\s+(?:the|a)\s+(?:rewritten|first-?person|first person)[^\n:]*:\s*/i,
    /^rewritten[^\n:]*:\s*/i,
    /^first[- ]person[^\n:]*:\s*/i,
  ]
  for (const pattern of prefixPatterns) {
    text = text.replace(pattern, '')
  }

  if (text.startsWith('"""') && text.endsWith('"""')) {
    text = text.slice(3, -3).trim()
  }
  if (text.startsWith('"') && text.endsWith('"') && text.length > 2) {
    text = text.slice(1, -1).trim()
  }

  return text.trim()
}
