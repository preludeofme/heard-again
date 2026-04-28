import { NextApiRequest, NextApiResponse } from 'next'
import { PersonaServiceImpl } from '@/services/persona/PersonaService'
import { DatabasePersonaRepository } from '@/services/persona/DatabasePersonaRepository'
import { StyleExtractorImpl } from '@/services/persona/StyleExtractor'
import { PersonService } from '@/services/persona/PersonService'
import { LLMGatewayImpl } from '@/services/llm/LLMGateway'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { prisma } from '@/lib/prisma'
import { verifyServiceToken } from '@/utils/auth-guard'

// Initialize services with database backend
const llmGateway = new LLMGatewayImpl()
const styleExtractor = new StyleExtractorImpl(llmGateway)
const documentRepository = new PrismaDocumentRepository()
const personaRepository = new DatabasePersonaRepository(prisma)
const personService = new PersonService()
const personaService = new PersonaServiceImpl(personaRepository, styleExtractor, documentRepository, personService, llmGateway)

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!verifyServiceToken(req, res)) return

  const { method } = req
  const { personId } = req.query
  const familyspaceId = req.headers['x-familyspace-id'] as string
  const userId = req.headers['x-user-id'] as string

  if (!familyspaceId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required headers: x-familyspace-id, x-user-id'
    })
  }

  if (!personId || typeof personId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid personId'
    })
  }

  try {
    switch (method) {
      case 'GET':
        await handleGetPersona(req, res, personId, familyspaceId)
        break
      default:
        res.setHeader('Allow', ['GET'])
        res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`
        })
    }
  } catch (error) {
    console.error('Persona API error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGetPersona(
  req: NextApiRequest, 
  res: NextApiResponse, 
  personId: string, 
  familyspaceId: string
) {
  try {
    const persona = await personaService.getPersonaProfile(personId, familyspaceId)
    
    // Ownership check — surface as 404 to prevent enumeration
    if (!persona) {
      return res.status(404).json({
        success: false,
        error: 'Persona profile not found'
      })
    }

    return res.status(200).json({
      success: true,
      persona: {
        id: persona.id,
        personId: persona.personId,
        familyspaceId: persona.familyspaceId,
        status: persona.status,
        documentSampleCount: persona.documentSampleCount,
        confidenceScore: persona.confidenceScore,
        lastUpdated: persona.lastUpdated,
        createdAt: persona.createdAt
        // Note: Not returning full persona details (system prompt, etc.) for security
      }
    })
  } catch (error) {
    console.error('Failed to get persona profile:', error)
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve persona profile'
    })
  }
}
