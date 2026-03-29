import { NextApiRequest, NextApiResponse } from 'next'
import { VoiceIntegrationServiceImpl, VoiceIntegrationService } from '@/services/voice/VoiceIntegrationService'

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

  // Initialize voice integration service
  const voiceIntegration: VoiceIntegrationService = new VoiceIntegrationServiceImpl()

  try {
    switch (method) {
      case 'GET':
        await handleGetProfiles(req, res, voiceIntegration)
        break
      case 'POST':
        await handleCreateProfile(req, res, voiceIntegration)
        break
      case 'PUT':
        await handleUpdateProfile(req, res, voiceIntegration)
        break
      case 'DELETE':
        await handleDeleteProfile(req, res, voiceIntegration)
        break
      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE'])
        res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`
        })
    }
  } catch (error) {
    console.error('Voice profiles API error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleGetProfiles(
  req: NextApiRequest,
  res: NextApiResponse,
  voiceIntegration: VoiceIntegrationService
) {
  const { personaId } = req.query

  try {
    const profiles = await (voiceIntegration as VoiceIntegrationServiceImpl).listVoiceProfiles()
    
    // Filter by personaId if provided
    const filteredProfiles = personaId
      ? profiles.filter(profile => profile.personaId === personaId)
      : profiles

    return res.status(200).json({
      success: true,
      profiles: filteredProfiles
    })
  } catch (error) {
    console.error('Failed to get voice profiles:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get voice profiles'
    })
  }
}

async function handleCreateProfile(
  req: NextApiRequest,
  res: NextApiResponse,
  voiceIntegration: VoiceIntegrationService
) {
  const { name, personaId, description, style } = req.body

  if (!name) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: name'
    })
  }

  if (!style) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: style'
    })
  }

  try {
    const profile = await (voiceIntegration as VoiceIntegrationServiceImpl).createVoiceProfile({
      name,
      personaId,
      description,
      style,
      isActive: true
    })

    return res.status(201).json({
      success: true,
      profile
    })
  } catch (error) {
    console.error('Failed to create voice profile:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create voice profile'
    })
  }
}

async function handleUpdateProfile(
  req: NextApiRequest,
  res: NextApiResponse,
  voiceIntegration: VoiceIntegrationService
) {
  const { id } = req.query
  const updates = req.body

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid profile ID'
    })
  }

  try {
    const profile = await (voiceIntegration as VoiceIntegrationServiceImpl).updateVoiceProfile(id, updates)

    return res.status(200).json({
      success: true,
      profile
    })
  } catch (error) {
    console.error('Failed to update voice profile:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update voice profile'
    })
  }
}

async function handleDeleteProfile(
  req: NextApiRequest,
  res: NextApiResponse,
  voiceIntegration: VoiceIntegrationService
) {
  const { id } = req.query

  if (!id || typeof id !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Missing or invalid profile ID'
    })
  }

  try {
    await (voiceIntegration as VoiceIntegrationServiceImpl).deleteVoiceProfile(id)

    return res.status(200).json({
      success: true,
      message: 'Voice profile deleted successfully'
    })
  } catch (error) {
    console.error('Failed to delete voice profile:', error)
    
    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete voice profile'
    })
  }
}
