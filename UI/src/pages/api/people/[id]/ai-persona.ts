import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const session = await getServerSession(req, res, authOptions)
    if (!session?.user?.id) {
      console.error('AI Persona: No session or user ID')
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const { id } = req.query
    if (!id || typeof id !== 'string') {
      console.error('AI Persona: Invalid person ID', id)
      return res.status(400).json({ error: 'Invalid person ID' })
    }

    // Check user has access to this person
    const person = await prisma.person.findFirst({
      where: {
        id,
        workspace: {
          memberships: {
            some: {
              userId: session.user.id,
              status: 'ACTIVE',
            },
          },
        },
      },
      include: {
        aiPersonaProfile: true,
      },
    })

    if (!person) {
      console.error('AI Persona: Person not found', id)
      return res.status(404).json({ error: 'Person not found' })
    }

    if (req.method === 'GET') {
      // Return AI persona profile (or null if not created yet)
      return res.json({
        success: true,
        data: person.aiPersonaProfile,
      })
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const body = req.body

      try {
        const profile = await prisma.aiPersonaProfile.upsert({
          where: { personId: id },
          create: {
            personId: id,
            workspaceId: person.workspaceId,
            status: body.status || 'DRAFT',
            systemPrompt: body.systemPrompt,
            responseGuidelines: body.responseGuidelines || [],
            writingStyle: body.writingStyle,
            knownFacts: body.knownFacts,
            relationships: body.relationships,
            customInstructions: body.customInstructions,
            temperature: body.temperature ?? 0.7,
            topP: body.topP ?? 0.9,
            maxTokens: body.maxTokens ?? 500,
            preferredModel: body.preferredModel,
          },
          update: {
            status: body.status,
            systemPrompt: body.systemPrompt,
            responseGuidelines: body.responseGuidelines,
            writingStyle: body.writingStyle,
            knownFacts: body.knownFacts,
            relationships: body.relationships,
            customInstructions: body.customInstructions,
            temperature: body.temperature,
            topP: body.topP,
            maxTokens: body.maxTokens,
            preferredModel: body.preferredModel,
            lastUpdated: new Date(),
          },
        })

        return res.json({
          success: true,
          data: profile,
        })
      } catch (error) {
        console.error('Error saving AI persona profile:', error)
        return res.status(500).json({ error: 'Failed to save AI persona profile' })
      }
    }

    if (req.method === 'DELETE') {
      try {
        await prisma.aiPersonaProfile.deleteMany({
          where: { personId: id },
        })
        return res.json({ success: true })
      } catch (error) {
        console.error('Error deleting AI persona profile:', error)
        return res.status(500).json({ error: 'Failed to delete AI persona profile' })
      }
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (error) {
    console.error('AI Persona: Unexpected error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
