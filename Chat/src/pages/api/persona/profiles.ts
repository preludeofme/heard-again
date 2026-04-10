import { NextApiRequest, NextApiResponse } from 'next'
import { PersonaServiceImpl } from '@/services/persona/PersonaService'
import { StyleExtractorImpl } from '@/services/persona/StyleExtractor'
import { LLMGatewayImpl } from '@/services/llm/LLMGateway'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { DatabasePersonaRepository } from '@/services/persona/DatabasePersonaRepository'
import { PersonService } from '@/services/persona/PersonService'
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
  const workspaceId = req.headers['x-workspace-id'] as string
  const userId = req.headers['x-user-id'] as string

  if (!workspaceId || !userId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required headers: x-workspace-id, x-user-id'
    })
  }

  try {
    switch (method) {
      case 'GET':
        await handleGetProfiles(req, res, workspaceId)
        break
      case 'POST':
        await handleCreateProfile(req, res, workspaceId, userId)
        break
      default:
        res.setHeader('Allow', ['GET', 'POST'])
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

async function handleGetProfiles(req: NextApiRequest, res: NextApiResponse, workspaceId: string) {
  const { personId } = req.query

  if (personId && typeof personId === 'string') {
    // Get specific persona profile
    const profile = await personaService.getPersonaProfile(personId, workspaceId)
    
    // Ownership check — surface as 404 to prevent enumeration
    if (!profile || profile.workspaceId !== workspaceId) {
      return res.status(404).json({
        success: false,
        error: 'Persona profile not found'
      })
    }

    return res.status(200).json({
      success: true,
      profile
    })
  } else {
    // List all persona profiles for workspace
    const profiles = await personaService.listPersonaProfiles(workspaceId)
    
    return res.status(200).json({
      success: true,
      profiles
    })
  }
}

async function handleCreateProfile(
  req: NextApiRequest, 
  res: NextApiResponse, 
  workspaceId: string, 
  userId: string
) {
  const { personId, options } = req.body

  if (!personId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: personId'
    })
  }

  const generationOptions = {
    documentIds: [] as string[],
    minDocumentCount: options?.minDocumentCount || 3,
    maxDocuments: options?.maxDocuments || 10,
    includeRelationships: options?.includeRelationships ?? true,
    extractStyle: options?.extractStyle ?? true,
    extractFacts: options?.extractFacts ?? true,
    extractRelationships: options?.extractRelationships ?? true,
    confidenceThreshold: options?.confidenceThreshold || 0.5,
  }

  try {
    const profile = await personaService.generatePersonaProfile(personId, workspaceId, generationOptions)
    
    return res.status(201).json({
      success: true,
      profile
    })
  } catch (error) {
    console.error('Failed to generate persona profile:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate persona profile'
    })
  }
}
