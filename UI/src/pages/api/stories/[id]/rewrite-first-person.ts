import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithFamilyspace, requireFamilyspaceRole } from '@/lib/auth-helpers'
import { logger } from '@/lib/logger'
import { rewriteWithFallback } from '@/lib/narration-llm-client'

export default apiHandler({
  POST: async (req, res) => {
    if (process.env.NARRATION_REWRITE_ENABLED === 'false') {
      return res.status(503).json({ success: false, error: 'Narration rewrite is not enabled' })
    }

    const user = await getAuthUserWithFamilyspace(req, res)
    const storyId = req.query.id as string
    await requireFamilyspaceRole(user.id, user.familyspaceId, 'EDITOR')

    const story = await prisma.story.findFirst({
      where: { id: storyId, familyspaceId: user.familyspaceId },
      include: {
        subject: { select: { firstName: true, lastName: true, nickname: true } },
        speaker: { select: { firstName: true, lastName: true, nickname: true } },
      },
    })
    if (!story) throw Errors.notFound('Story')

    // For audio recordings, require a transcript before rewriting
    if (story.storyType === 'RECORDING' && !story.transcript) {
      return res.status(400).json({
        success: false,
        error: 'This audio story has not been transcribed yet. Transcribe it first to generate the text version.',
        code: 'TRANSCRIPT_REQUIRED',
      })
    }

    // Use transcript for audio stories, fall back to content for text stories
    const sourceText = (story.transcript || story.content || '').trim()
    const cleanSource = stripMediaAndFormatting(sourceText)

    if (!cleanSource) {
      throw Errors.badRequest('Story has no readable text content to rewrite')
    }

    await prisma.story.update({
      where: { id: storyId },
      data: { narrationStatus: 'PENDING', narrationUpdatedAt: new Date() },
    })

    const subjectName = formatPersonName(story.subject)
    const speakerName = formatPersonName(story.speaker)

    const userRecord = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        displayName: true,
        linkedPerson: { select: { firstName: true, lastName: true, nickname: true } },
      },
    })
    const narratorName =
      formatPersonName(userRecord?.linkedPerson) || req.body?.narratorName || undefined

    const subject = subjectName || 'the subject of this story'
    const qualityOverride = req.body?.quality === 'high'

    try {
      logger.info('[rewrite] calling LLM', { storyId, qualityOverride })

      const llmResult = await rewriteWithFallback(
        [
          { role: 'system', content: buildSystemPrompt(subject, speakerName) },
          { role: 'user', content: buildUserMessage(cleanSource, subject, speakerName, narratorName) },
        ],
        cleanSource,
        { qualityOverride }
      )

      if (llmResult.usedFallback) {
        logger.info('[rewrite] used fallback model', { storyId, reason: llmResult.fallbackReason, model: llmResult.model })
      }

      const rawContent = llmResult.content
      const rewrittenContent = cleanRewrite(rawContent)
      const model = llmResult.model

      if (!rewrittenContent) {
        logger.error('[rewrite] empty content from model', { storyId, model, rawLength: rawContent.length })
        await prisma.story.update({
          where: { id: storyId },
          data: { narrationStatus: 'FAILED', narrationModel: model, narrationUpdatedAt: new Date() },
        })
        throw Errors.badRequest('Rewrite model returned empty content — try again or switch models')
      }

      const updated = await prisma.story.update({
        where: { id: storyId },
        data: {
          narratedContent: rewrittenContent,
          narrationStatus: 'READY',
          narrationModel: model,
          narrationUpdatedAt: new Date(),
          narrationApprovedAt: null,
          narrationApprovedById: null,
        },
        select: {
          id: true,
          narratedContent: true,
          narrationStatus: true,
          narrationModel: true,
          narrationUpdatedAt: true,
        },
      })

      return successResponse(res, updated)
    } catch (error) {
      if ((error as any)?.statusCode) throw error
      logger.error('[rewrite] unexpected error', {
        storyId,
        errorMessage: error instanceof Error ? error.message : String(error),
        code: (error as any)?.code,
      })
      await prisma.story.update({
        where: { id: storyId },
        data: { narrationStatus: 'FAILED', narrationUpdatedAt: new Date() },
      }).catch(() => {})
      return res.status(502).json({ success: false, error: 'Rewrite service unavailable' })
    }
  },
})

function formatPersonName(
  person?: { firstName: string; lastName: string | null; nickname: string | null } | null
): string | undefined {
  if (!person) return undefined
  if (person.nickname) return person.nickname
  return `${person.firstName}${person.lastName ? ' ' + person.lastName : ''}`
}

function stripMediaAndFormatting(content: string): string {
  if (!content) return ''
  let text = content
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
  text = text.replace(/!\[.*?\]\(.*?\)/g, '')
  text = text.replace(/<[\s\S]*?(?:>|$)/g, ' ')
  return text.replace(/\s+/g, ' ').trim()
}

function buildSystemPrompt(subject: string, speakerName?: string): string {
  const speakerSection = speakerName
    ? `\n\nIMPORTANT — Pronoun resolution:\nThe ORIGINAL TEXT was written by ${speakerName}. Any first-person pronouns in the original (I, me, my, myself, we, our, us) refer to ${speakerName} — the author — NOT to ${subject}. When converting those author-voice references into ${subject}'s first-person narration, replace them with "${speakerName}" in third person. If the original says "he was telling me" or "she showed me", that "me" = ${speakerName}; convert it to "${speakerName}" in the rewrite.\n`
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
9. Do not add a preamble like "Here is the rewrite" or "Sure,". Return only the rewritten story text.${speakerSection}`
}

function buildUserMessage(
  content: string,
  subject: string,
  speakerName?: string,
  narratorName?: string
): string {
  const lines: string[] = []
  if (speakerName) lines.push(`This story was written by ${speakerName} about ${subject}.`)
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
  for (const pattern of prefixPatterns) text = text.replace(pattern, '')
  if (text.startsWith('"""') && text.endsWith('"""')) text = text.slice(3, -3).trim()
  if (text.startsWith('"') && text.endsWith('"') && text.length > 2) text = text.slice(1, -1).trim()
  return text.trim()
}
