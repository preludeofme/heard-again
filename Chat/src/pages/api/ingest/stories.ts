import { NextApiRequest, NextApiResponse } from 'next'
import { StoryIngestionService } from '@/services/ingestion/StoryIngestionService'

// Allow long-running ingestion process
export const config = {
  api: { bodyParser: true, responseLimit: false },
  maxDuration: 300, // 5 minutes for bulk ingestion
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { familyspaceId, storyId, action = 'ingest' } = req.body

    if (!familyspaceId && !storyId && action !== 'sync-all') {
      return res.status(400).json({ 
        error: 'Missing required parameters. Provide familyspaceId, storyId, or use action=sync-all' 
      })
    }

    const storyIngestion = new StoryIngestionService()

    switch (action) {
      case 'ingest-familyspace':
        if (!familyspaceId) {
          return res.status(400).json({ error: 'familyspaceId is required for ingest-familyspace action' })
        }
        await storyIngestion.ingestFamilyspaceStories(familyspaceId)
        return res.status(200).json({ 
          message: `Successfully ingested stories for familyspace ${familyspaceId}` 
        })

      case 'ingest-story':
        if (!storyId) {
          return res.status(400).json({ error: 'storyId is required for ingest-story action' })
        }
        // Get the story and ingest it
        const { PrismaClient } = require('@prisma/client')
        const prismaClient = new PrismaClient()
        const story = await (prismaClient as any).story.findUnique({
          where: { id: storyId },
          include: {
            subject: {
              select: { id: true, firstName: true, lastName: true }
            },
            speaker: {
              select: { id: true, firstName: true, lastName: true }
            },
            createdBy: {
              select: { id: true, displayName: true }
            }
          }
        })
        
        if (!story) {
          return res.status(404).json({ error: 'Story not found' })
        }

        await storyIngestion.ingestStory(story)
        return res.status(200).json({ 
          message: `Successfully ingested story ${storyId}` 
        })

      case 'remove-story':
        if (!storyId) {
          return res.status(400).json({ error: 'storyId is required for remove-story action' })
        }
        await storyIngestion.removeStory(storyId)
        return res.status(200).json({ 
          message: `Successfully removed story ${storyId} from search index` 
        })

      case 'sync-all':
        await storyIngestion.syncAllStories()
        return res.status(200).json({ 
          message: 'Successfully synced all stories for all familyspaces' 
        })

      default:
        return res.status(400).json({ 
          error: `Invalid action: ${action}. Use ingest-familyspace, ingest-story, remove-story, or sync-all` 
        })
    }

  } catch (error) {
    console.error('[STORY_INGESTION_API] Error:', error)
    return res.status(500).json({ 
      error: 'Internal server error during story ingestion',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    })
  }
}
