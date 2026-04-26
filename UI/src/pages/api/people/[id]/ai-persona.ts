import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'
export default apiHandler({
  // GET /api/people/[id]/ai-persona - Get person's AI persona
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string

    // Verify person exists in workspace
    const person = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!person) {
      throw Errors.notFound('Person')
    }

    // Get the latest active persona profile
    const persona = await prisma.personaProfile.findFirst({
      where: {
        personId,
        workspaceId: user.workspaceId,
        status: 'active',
      },
      orderBy: { version: 'desc' },
    })

    // If no active persona, check for draft
    if (!persona) {
      const draftPersona = await prisma.personaProfile.findFirst({
        where: {
          personId,
          workspaceId: user.workspaceId,
          status: 'draft',
        },
        orderBy: { version: 'desc' },
      })
      return successResponse(res, draftPersona || null)
    }

    return successResponse(res, persona)
  },

  // PUT /api/people/[id]/ai-persona - Update or create AI persona
  PUT: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    // Verify person exists in workspace
    const person = await prisma.person.findFirst({
      where: { id: personId, workspaceId: user.workspaceId },
    })
    if (!person) {
      throw Errors.notFound('Person')
    }

    const {
      systemPrompt = '',
      responseGuidelines = [],
      formality = 'neutral',
      averageSentenceLength = 15.0,
      behaviorInstructions = [],
      relationshipInstructions = {},
      topicInstructions = {},
      contextInstructions = {},
      styleOverrides = {},
      status = 'draft',
    } = req.body

    // Get existing persona to update or create new version
    const existingPersona = await prisma.personaProfile.findFirst({
      where: {
        personId,
        workspaceId: user.workspaceId,
      },
      orderBy: { version: 'desc' },
    })

    let newVersion = 1
    if (existingPersona) {
      // If updating an active persona, create a new version
      // If updating a draft, keep the same version
      newVersion = existingPersona.status === 'active' 
        ? existingPersona.version + 1 
        : existingPersona.version
    }

    const persona = await prisma.personaProfile.upsert({
      where: {
        personId_workspaceId_version: {
          personId,
          workspaceId: user.workspaceId,
          version: newVersion,
        },
      },
      update: {
        systemPrompt,
        responseGuidelines,
        formality,
        averageSentenceLength,
        behaviorInstructions,
        relationshipInstructions,
        topicInstructions,
        contextInstructions,
        styleOverrides,
        status,
        lastUpdated: new Date(),
      },
      create: {
        personId,
        workspaceId: user.workspaceId,
        version: newVersion,
        systemPrompt,
        responseGuidelines,
        formality,
        averageSentenceLength,
        behaviorInstructions,
        relationshipInstructions,
        topicInstructions,
        contextInstructions,
        styleOverrides,
        status,
      },
    })

    return successResponse(res, persona)
  },

  // POST /api/people/[id]/ai-persona/activate - Activate a persona version
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const personId = req.query.id as string
    await requireWorkspaceRole(user.id, user.workspaceId, 'EDITOR')

    const { version } = req.body

    if (!version || typeof version !== 'number') {
      throw Errors.badRequest('Version is required')
    }

    // Verify persona exists
    const persona = await prisma.personaProfile.findFirst({
      where: {
        personId,
        workspaceId: user.workspaceId,
        version,
      },
    })
    if (!persona) {
      throw Errors.notFound('Persona profile')
    }

    // Deactivate all other personas for this person
    await prisma.personaProfile.updateMany({
      where: {
        personId,
        workspaceId: user.workspaceId,
        status: 'active',
      },
      data: { status: 'archived' },
    })

    // Activate this persona
    const activatedPersona = await prisma.personaProfile.update({
      where: { id: persona.id },
      data: { status: 'active', lastUpdated: new Date() },
    })

    return successResponse(res, activatedPersona)
  },
})
