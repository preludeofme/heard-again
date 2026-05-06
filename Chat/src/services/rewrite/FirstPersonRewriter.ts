import { LLMGateway, CompiledPrompt } from '@/types'
import { RELEASE_CANDIDATE_MODEL_POLICY } from '@/config/releaseCandidate'

export interface RewriteRequest {
  content: string
  subjectName?: string
  speakerName?: string
  narratorName?: string
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
    const speaker = request.speakerName?.trim()
    const narrator = request.narratorName?.trim()
    const systemPrompt = buildSystemPrompt(subject, speaker, request.styleHints)

    const prompt: CompiledPrompt = {
      systemPrompt,
      context: '',
      history: [],
      userMessage: buildUserMessage(request.content, subject, speaker, narrator),
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

function buildSystemPrompt(subject: string, speakerName?: string, styleHints?: string): string {
  const styleSection = styleHints?.trim()
    ? `\n\nSpeaking style notes for ${subject}:\n${styleHints.trim()}\n`
    : ''

  const speakerSection = speakerName
    ? `\n\nIMPORTANT — Pronoun resolution:\nThe ORIGINAL TEXT was written by ${speakerName}. Any first-person pronouns in the original (I, me, my, myself, we, our, us) refer to ${speakerName} — the author — NOT to ${subject}. When converting those author-voice references into ${subject}'s first-person narration, replace them with "${speakerName}" in third person (e.g. "I remember" written by ${speakerName} about ${subject} becomes "${subject} once told me" only if it's ${speakerName} recalling something — otherwise rephrase naturally). If the original says "he was telling me" or "she showed me", that "me" = ${speakerName}; convert it to "${speakerName}" in the rewrite.\n`
    : ''

  return `You are rewriting a family memory so that ${subject} can narrate it aloud in their own voice, in first person. The ORIGINAL TEXT was written by a family member ABOUT ${subject}.

Rules (absolute):
1. Do not invent facts. Only use information present in the ORIGINAL TEXT.
2. Do not add feelings, opinions, or memories that were not written.
3. Preserve every name, date, place, and quoted dialogue exactly as written.
4. Rewrite the perspective from third-person to first-person, as if ${subject} is telling this story aloud to their family today.
5. Convert references to ${subject} (they/he/she/their/his/her) into "I/me/my" where appropriate. All other people, including the author, remain in third person by name.
6. Keep the original pacing and emotional register. Do not dramatize.
7. Write in plain spoken English, the way someone speaks aloud. No stage directions, no headings, no markdown, no meta commentary. Just the story.
8. If the ORIGINAL TEXT is already written in first person from ${subject}'s perspective, return it nearly verbatim with only minor cleanup for spoken cadence.
9. Do not add a preamble like "Here is the rewrite" or "Sure,". Return only the rewritten story text.${speakerSection}${styleSection}`
}

function buildUserMessage(
  content: string,
  subject: string,
  speakerName?: string,
  narratorName?: string,
): string {
  const lines: string[] = []

  if (speakerName) {
    lines.push(`This story was written by ${speakerName} about ${subject}.`)
  }
  if (narratorName && narratorName !== speakerName && narratorName !== subject) {
    lines.push(`Context: the person triggering this narration is ${narratorName}.`)
  }
  if (lines.length > 0) lines.push('')

  lines.push(`ORIGINAL TEXT (about ${subject}):`)
  lines.push(`"""`)
  lines.push(content)
  lines.push(`"""`)
  lines.push(``)
  lines.push(`Rewrite the ORIGINAL TEXT so ${subject} can narrate it in first person. Return only the rewritten story.`)

  return lines.join('\n')
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
