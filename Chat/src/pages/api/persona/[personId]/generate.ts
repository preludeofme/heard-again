import { NextApiRequest, NextApiResponse } from 'next'
import { PersonaServiceImpl } from '@/services/persona/PersonaService'
import { DatabasePersonaRepository } from '@/services/persona/DatabasePersonaRepository'
import { StyleExtractorImpl } from '@/services/persona/StyleExtractor'
import { PersonService } from '@/services/persona/PersonService'
import { LLMGatewayImpl } from '@/services/llm/LLMGateway'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { prisma } from '@/lib/prisma'
import { verifyServiceToken } from '@/utils/auth-guard'
import { PersonaGenerationOptions } from '@/types'

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
      case 'POST':
        await handleGeneratePersona(req, res, personId, familyspaceId)
        break
      default:
        res.setHeader('Allow', ['POST'])
        res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`
        })
    }
  } catch (error) {
    console.error('Persona generation API error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGeneratePersona(
  req: NextApiRequest, 
  res: NextApiResponse, 
  personId: string, 
  familyspaceId: string
) {
  const { options } = req.body

  // Check if persona already exists
  const existingPersona = await personaService.getPersonaProfile(personId, familyspaceId)
  if (existingPersona) {
    return res.status(409).json({
      success: false,
      error: 'Persona profile already exists for this person'
    })
  }

  // Check if person has any documents
  const documents = await documentRepository.listDocuments(familyspaceId, { personId })
  if (documents.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No documents found for this person. At least one document is required to generate a persona.'
    })
  }

  // Set default generation options
  const generationOptions: PersonaGenerationOptions = {
    documentIds: documents.map(doc => doc.id),
    extractStyle: options?.extractStyle ?? true,
    extractFacts: options?.extractFacts ?? true,
    extractRelationships: options?.extractRelationships ?? true,
    minDocumentCount: options?.minDocumentCount || 1,
    confidenceThreshold: options?.confidenceThreshold || 0.5
  }

  try {
    const persona = await personaService.generatePersonaProfile(personId, familyspaceId, generationOptions)
    
    return res.status(201).json({
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
      },
      message: `Successfully generated persona profile using ${documents.length} documents`
    })
  } catch (error) {
    console.error('Failed to generate persona profile:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate persona profile'
    })
  }
}
