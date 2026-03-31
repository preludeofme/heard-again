import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'

export default apiHandler({
  // GET /api/dashboard/stats - Get workspace dashboard stats and recent activity
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const workspaceId = user.workspaceId

    const [
      peopleCount,
      storiesCount,
      voiceProfileCount,
      publishedStories,
      draftStories,
      recentStories,
      recentPeople,
    ] = await Promise.all([
      prisma.person.count({ where: { workspaceId } }),
      prisma.story.count({ where: { workspaceId } }),
      prisma.voiceProfile.count({ where: { workspaceId } }),
      prisma.story.count({ where: { workspaceId, status: 'PUBLISHED' } }),
      prisma.story.count({ where: { workspaceId, status: 'DRAFT' } }),
      prisma.story.findMany({
        where: { workspaceId },
        include: {
          subject: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      prisma.person.findMany({
        where: { workspaceId },
        include: {
          _count: { select: { storiesAsSubject: true, voiceProfiles: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])

    // Build memory wall from recent stories
    const memoryWall = recentStories.map((s) => ({
      id: s.id,
      type: s.generatedAudioAssetId ? 'audio-memory' : 'story',
      title: s.title,
      content: s.excerpt || s.content.substring(0, 200),
      subject: s.subject
        ? `${s.subject.firstName}${s.subject.lastName ? ' ' + s.subject.lastName : ''}`
        : null,
      createdBy: s.createdBy?.displayName || 'Unknown',
      status: s.status,
      isPinned: s.isPinned,
      tags: s.tags,
      createdAt: s.createdAt,
    }))

    const familyMembers = recentPeople.map((p) => ({
      id: p.id,
      name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      storyCount: p._count.storiesAsSubject,
      voiceProfileCount: p._count.voiceProfiles,
      isDeceased: p.isDeceased,
    }))

    return successResponse(res, {
      stats: {
        people: peopleCount,
        stories: storiesCount,
        voiceProfiles: voiceProfileCount,
        publishedStories,
        draftStories,
      },
      memoryWall,
      familyMembers,
    })
  },
})
