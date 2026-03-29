import { NextApiRequest, NextApiResponse } from 'next'
import { VoiceIntegrationServiceImpl, VoiceIntegrationService } from '@/services/voice/VoiceIntegrationService'
import { PersonaServiceImpl } from '@/services/persona/PersonaService'
import { PersonaRepositoryImpl } from '@/services/persona/PersonaRepository'

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
  },
}

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

  // Initialize services
  const voiceIntegration: VoiceIntegrationService = new VoiceIntegrationServiceImpl()
  const personaService = new PersonaServiceImpl(
    new PersonaRepositoryImpl(),
    // TODO: Add proper service initialization
    {} as any,
    {} as any
  )

  try {
    switch (method) {
      case 'POST':
        await handleStreamingSynthesis(req, res, voiceIntegration, personaService)
        break
      default:
        res.setHeader('Allow', ['POST'])
        res.status(405).json({
          success: false,
          error: `Method ${method} Not Allowed`
        })
    }
  } catch (error) {
    console.error('Voice streaming API error:', error)
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
}

async function handleStreamingSynthesis(
  req: NextApiRequest,
  res: NextApiResponse,
  voiceIntegration: VoiceIntegrationService,
  personaService: PersonaServiceImpl
) {
  // Parse request body manually since we disabled bodyParser
  const body = await parseRequestBody(req)
  const { text, personaId, voiceProfileId, options } = body

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: text'
    })
  }

  if (!personaId && !voiceProfileId) {
    return res.status(400).json({
      success: false,
      error: 'Missing required field: personaId or voiceProfileId'
    })
  }

  try {
    let voiceProfile

    if (voiceProfileId) {
      // Get specific voice profile
      const profiles = await (voiceIntegration as VoiceIntegrationServiceImpl).listVoiceProfiles()
      voiceProfile = profiles.find(p => p.id === voiceProfileId)
      
      if (!voiceProfile) {
        return res.status(404).json({
          success: false,
          error: 'Voice profile not found'
        })
      }
    } else {
      // Select voice profile based on persona
      const personaProfile = await personaService.getPersonaProfile(personaId)
      if (!personaProfile) {
        return res.status(404).json({
          success: false,
          error: 'Persona profile not found'
        })
      }

      voiceProfile = await voiceIntegration.selectVoiceProfile(personaProfile)
      if (!voiceProfile) {
        return res.status(404).json({
          success: false,
          error: 'No suitable voice profile found for persona'
        })
      }
    }

    // Set up streaming response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    // Get streaming iterator
    const synthesisOptions = {
      style: options?.style,
      speed: options?.speed,
      emotion: options?.emotion,
      priority: options?.priority || 'normal'
    }

    const streamIterator = await voiceIntegration.streamSynthesis(
      text,
      voiceProfile,
      synthesisOptions
    )

    // Stream audio chunks
    try {
      for await (const chunk of streamIterator) {
        if (chunk.isFinal) {
          res.write('data: [DONE]\n\n')
          break
        }

        // Convert audio chunk to base64 for streaming
        const base64Audio = arrayBufferToBase64(chunk.audio)
        
        res.write(`data: ${JSON.stringify({
          audio: base64Audio,
          sequence: chunk.sequence,
          timestamp: chunk.timestamp,
          isFinal: chunk.isFinal
        })}\n\n`)
      }
    } catch (streamError) {
      console.error('Streaming error:', streamError)
      res.write(`data: ${JSON.stringify({
        error: 'Streaming error occurred',
        isFinal: true
      })}\n\n`)
    } finally {
      res.end()
    }

  } catch (error) {
    console.error('Failed to start voice streaming:', error)
    
    if (!res.headersSent) {
      return res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to start voice streaming'
      })
    }
  }
}

async function parseRequestBody(req: NextApiRequest): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    
    req.on('data', (chunk) => {
      body += chunk.toString()
    })
    
    req.on('end', () => {
      try {
        resolve(JSON.parse(body))
      } catch (error) {
        reject(new Error('Invalid JSON in request body'))
      }
    })
    
    req.on('error', (error) => {
      reject(error)
    })
  })
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  
  return btoa(binary)
}
