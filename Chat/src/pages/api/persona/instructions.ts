import { NextApiRequest, NextApiResponse } from 'next'
import { PersonaServiceImpl } from '@/services/persona/PersonaService'
import { DatabasePersonaRepository } from '@/services/persona/DatabasePersonaRepository'
import { StyleExtractorImpl } from '@/services/persona/StyleExtractor'
import { PersonService } from '@/services/persona/PersonService'
import { LLMGatewayImpl } from '@/services/llm/LLMGateway'
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository'
import { CUSTOM_INSTRUCTION_TEMPLATES, DEFAULT_CUSTOM_INSTRUCTIONS } from '@/types'
import { prisma } from '@/lib/prisma'
import { verifyServiceToken } from '@/utils/auth-guard'

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

  // Initialize services with database backend
  const llmGateway = new LLMGatewayImpl()
  const styleExtractor = new StyleExtractorImpl(llmGateway)
  const documentRepository = new PrismaDocumentRepository()
  const personaRepository = new DatabasePersonaRepository(prisma)
  const personService = new PersonService()
  const personaService = new PersonaServiceImpl(personaRepository, styleExtractor, documentRepository, personService, llmGateway)

  try {
    switch (method) {
      case 'GET':
        await handleGetInstructions(req, res, personaService)
        break
      case 'POST':
        await handleUpdateInstructions(req, res, personaService)
        break
      case 'PUT':
        await handleAddInstruction(req, res, personaService)
        break
      case 'DELETE':
        await handleRemoveInstruction(req, res, personaService)
        break
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`
        })
    }
  } catch (error) {
    console.error('Custom instructions API error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGetInstructions(
  req: NextApiRequest,
  res: NextApiResponse,
  personaService: PersonaServiceImpl
) {
  const { personaId } = req.query

  if (!personaId || typeof personaId !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid personaId'
    })
  }

  const reqWorkspaceId = req.headers['x-workspace-id'] as string
  try {
    const persona = await personaService.getPersonaProfile(personaId, reqWorkspaceId)
    if (!persona || persona.workspaceId !== reqWorkspaceId) {
      return res.status(404).json({
        success: false,
        error: 'Persona profile not found'
      })
    }

    return res.status(200).json({
      success: true,
      instructions: persona.customInstructions,
      templates: CUSTOM_INSTRUCTION_TEMPLATES
    })
  } catch (error) {
    console.error('Failed to get custom instructions:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get custom instructions'
    })
  }
}

async function handleUpdateInstructions(
  req: NextApiRequest,
  res: NextApiResponse,
  personaService: PersonaServiceImpl
) {
  const { personaId, customInstructions } = req.body

  if (!personaId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: personaId'
    })
  }

  if (!customInstructions) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: customInstructions'
    })
  }

  const reqWorkspaceId = req.headers['x-workspace-id'] as string
  try {
    const existing = await personaService.getPersonaProfile(personaId, reqWorkspaceId)
    if (!existing || existing.workspaceId !== reqWorkspaceId) {
      return res.status(404).json({ success: false, error: 'Persona profile not found' })
    }

    const updatedPersona = await personaService.updatePersonaProfile(personaId, {
      customInstructions
    })

    return res.status(200).json({
      success: true,
      persona: updatedPersona
    })
  } catch (error) {
    console.error('Failed to update custom instructions:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update custom instructions'
    })
  }
}

async function handleAddInstruction(
  req: NextApiRequest,
  res: NextApiResponse,
  personaService: PersonaServiceImpl
) {
  const { personaId, category, instruction, key } = req.body

  if (!personaId || !category || !instruction) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: personaId, category, instruction'
    })
  }

  const reqWorkspaceId = req.headers['x-workspace-id'] as string
  try {
    const persona = await personaService.getPersonaProfile(personaId, reqWorkspaceId)
    if (!persona || persona.workspaceId !== reqWorkspaceId) {
      return res.status(404).json({
        success: false,
        error: 'Persona profile not found'
      })
    }

    const updatedInstructions = { ...persona.customInstructions }

    // Add instruction based on category
    switch (category) {
      case 'relationship':
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: key (relationship identifier)'
          })
        }
        updatedInstructions.relationshipInstructions[key] = instruction
        break

      case 'behavior':
        updatedInstructions.behaviorInstructions.push(instruction)
        break

      case 'topic':
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: key (topic)'
          })
        }
        updatedInstructions.topicInstructions[key] = instruction
        break

      case 'context':
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: key (context)'
          })
        }
        updatedInstructions.contextInstructions[key] = instruction
        break

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid category. Must be: relationship, behavior, topic, or context'
        })
    }

    const updatedPersona = await personaService.updatePersonaProfile(personaId, {
      customInstructions: updatedInstructions
    })

    return res.status(200).json({
      success: true,
      persona: updatedPersona
    })
  } catch (error) {
    console.error('Failed to add custom instruction:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to add custom instruction'
    })
  }
}

async function handleRemoveInstruction(
  req: NextApiRequest,
  res: NextApiResponse,
  personaService: PersonaServiceImpl
) {
  const { personaId, category, key, index } = req.body

  if (!personaId || !category) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: personaId, category'
    })
  }

  const reqWorkspaceId = req.headers['x-workspace-id'] as string
  try {
    const persona = await personaService.getPersonaProfile(personaId, reqWorkspaceId)
    if (!persona || persona.workspaceId !== reqWorkspaceId) {
      return res.status(404).json({
        success: false,
        error: 'Persona profile not found'
      })
    }

    const updatedInstructions = { ...persona.customInstructions }

    // Remove instruction based on category
    switch (category) {
      case 'relationship':
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: key (relationship identifier)'
          })
        }
        delete updatedInstructions.relationshipInstructions[key]
        break

      case 'behavior':
        if (index === undefined || index === null) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: index (for behavior instructions)'
          })
        }
        updatedInstructions.behaviorInstructions.splice(index, 1)
        break

      case 'topic':
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: key (topic)'
          })
        }
        delete updatedInstructions.topicInstructions[key]
        break

      case 'context':
        if (!key) {
          return res.status(400).json({
            success: false,
            error: 'Missing required field: key (context)'
          })
        }
        delete updatedInstructions.contextInstructions[key]
        break

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid category. Must be: relationship, behavior, topic, or context'
        })
    }

    const updatedPersona = await personaService.updatePersonaProfile(personaId, {
      customInstructions: updatedInstructions
    })

    return res.status(200).json({
      success: true,
      persona: updatedPersona
    })
  } catch (error) {
    console.error('Failed to remove custom instruction:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove custom instruction'
    })
  }
}
