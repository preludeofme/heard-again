import { NextApiRequest, NextApiResponse } from 'next'
import { verifyServiceToken } from '@/utils/auth-guard'
import { LLMGatewayImpl } from '@/services/llm/LLMGateway'
import { FirstPersonRewriter } from '@/services/rewrite/FirstPersonRewriter'
import { logger } from '@/lib/logger'

const llmGateway = new LLMGatewayImpl()
const rewriter = new FirstPersonRewriter(llmGateway)

const MAX_CONTENT_CHARS = 20000

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyServiceToken(req, res)) return

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ success: false, error: `Method ${req.method} Not Allowed` })
  }

  const workspaceId = req.headers['x-workspace-id'] as string | undefined
  if (!workspaceId) {
    return res.status(400).json({ success: false, error: 'Missing x-workspace-id header' })
  }

  const { content, subjectName, speakerName, styleHints } = req.body ?? {}

  if (typeof content !== 'string' || content.trim().length === 0) {
    return res.status(400).json({ success: false, error: 'content is required' })
  }
  if (content.length > MAX_CONTENT_CHARS) {
    return res.status(400).json({
      success: false,
      error: `content exceeds ${MAX_CONTENT_CHARS} character limit`,
    })
  }

  try {
    const result = await rewriter.rewrite({
      content,
      subjectName: typeof subjectName === 'string' ? subjectName : undefined,
      speakerName: typeof speakerName === 'string' ? speakerName : undefined,
      styleHints: typeof styleHints === 'string' ? styleHints : undefined,
    })

    logger.info('[rewrite] first-person rewrite complete', {
      workspaceId,
      model: result.model,
      processingTimeMs: result.processingTimeMs,
      inputChars: content.length,
      outputChars: result.rewrittenContent.length,
    })

    return res.status(200).json({
      success: true,
      data: {
        rewrittenContent: result.rewrittenContent,
        model: result.model,
        processingTimeMs: result.processingTimeMs,
      },
    })
  } catch (error) {
    logger.error('[rewrite] first-person rewrite failed', { workspaceId, error })
    const message = error instanceof Error ? error.message : 'Rewrite failed'
    return res.status(502).json({ success: false, error: message })
  }
}
