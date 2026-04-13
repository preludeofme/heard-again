import { NextApiRequest, NextApiResponse } from 'next'
import { VoiceIntegrationServiceImpl, VoiceIntegrationService } from '@/services/voice/VoiceIntegrationService'
import { PersonaServiceImpl } from '@/services/persona/PersonaService'
import { DatabasePersonaRepository } from '@/services/persona/DatabasePersonaRepository'
import { StyleExtractorImpl } from '@/services/persona/StyleExtractor'
import { PersonService } from '@/services/persona/PersonService'
import { LLMGatewayImpl } from '@/services/llm/LLMGateway'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req
  const workspaceId = req.headers['x-workspace-id'] as string
  const userId = req.headers['x-user-id'] as string

  if (!workspaceId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required headers: x-workspace-id, x-user-id'
    })
  }

  // Initialize services with database backend
  const voiceIntegration: VoiceIntegrationService = new VoiceIntegrationServiceImpl()
  const llmGateway = new LLMGatewayImpl()
  const styleExtractor = new StyleExtractorImpl(llmGateway)
  const documentRepository = new PrismaDocumentRepository()
  const personaRepository = new DatabasePersonaRepository(prisma)
  const personService = new PersonService()
  const personaService = new PersonaServiceImpl(personaRepository, styleExtractor, documentRepository, personService)

  try {
    switch (method) {
      case 'POST':
        await handleSynthesis(req, res, voiceIntegration, personaService, workspaceId)
        break
      default:
        res.setHeader('Allow', ['POST'])
        res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`
        })
    }
  } catch (error) {
    console.error('Voice synthesis API error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleSynthesis(
  req: NextApiRequest,
  res: NextApiResponse,
  voiceIntegration: VoiceIntegrationService,
  personaService: PersonaServiceImpl,
  workspaceId: string
) {
  const { text, personaId, options } = req.body

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: text'
    })
  }

  if (!personaId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: personaId'
    })
  }

  try {
    // Get persona profile
    const personaProfile = await personaService.getPersonaProfile(personaId, workspaceId)
    if (!personaProfile) {
      return res.status(404).json({
        success: false,
        error: 'Persona profile not found'
      })
    }

    // Synthesize voice
    const synthesisOptions = {
      style: options?.style,
      speed: options?.speed,
      emotion: options?.emotion,
      priority: options?.priority || 'normal'
    }

    const result = await voiceIntegration.synthesizeChatResponse(
      text,
      personaProfile,
      synthesisOptions
    )

    return res.status(200).json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Failed to synthesize voice:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to synthesize voice'
    })
  }
}
