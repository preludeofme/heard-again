import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace } from '@/lib/auth-helpers'
import type { WorkspaceRole } from '@prisma/client'

const ACTIVITY_WINDOW_DAYS = 14

type ActivityKind = 'comment' | 'upload' | 'generation'
interface ActivityEntry {
  kind: ActivityKind
  at: Date
  title: string
  detail: string
  href: string | null
  actor: string
}

function dailySeed(workspaceId: string): number {
  const today = new Date().toISOString().slice(0, 10)
  const key = `${workspaceId}-${today}`
  let h = 0
  for (let i = 0; i < key.length; i++) {
    h = (h * 31 + key.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export default apiHandler({
  // GET /api/dashboard/stats - Workspace landing page payload
  GET: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    const workspaceId = user.workspaceId

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: user.id } },
      select: { role: true },
    })

    const role: WorkspaceRole = membership?.role ?? 'VIEWER'
    const isAdminOrOwner = role === 'OWNER' || role === 'ADMIN'

    const activitySince = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 24 * 60 * 60 * 1000)

    const [
      workspace,
      peopleCount,
      storiesCount,
      voiceProfileCount,
      publishedStories,
      draftStories,
      documentsCount,
      latestStoriesRaw,
      recentPeopleRaw,
      lastDraftStory,
      inProgressVoiceJob,
      pendingInvitesCount,
      hasInvitedMemberValue,
      recentComments,
      recentUploads,
      recentGenerations,
      personWithoutStories,
      livingPersonWithoutVoice,
      untaggedStoriesCount,
      featuredPersonCandidates,
    ] = await Promise.all([
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { id: true, name: true, planType: true },
      }),
      prisma.person.count({ where: { workspaceId } }),
      prisma.story.count({ where: { workspaceId, deletedAt: null } }),
      prisma.voiceProfile.count({ where: { workspaceId, deletedAt: null } }),
      prisma.story.count({ where: { workspaceId, status: 'PUBLISHED', deletedAt: null } }),
      prisma.story.count({ where: { workspaceId, status: 'DRAFT', deletedAt: null } }),
      prisma.document.count({ where: { workspaceId, isDeleted: false } }),
      prisma.story.findMany({
        where: { workspaceId, deletedAt: null },
        select: {
          id: true,
          title: true,
          excerpt: true,
          content: true,
          storyDate: true,
          status: true,
          isPinned: true,
          tags: true,
          createdAt: true,
          generatedAudioAssetId: true,
          subject: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, displayName: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
        take: 8,
      }),
      prisma.person.findMany({
        where: { workspaceId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          isDeceased: true,
          avatarAsset: { select: { id: true } },
          _count: { select: { storiesAsSubject: true, voiceProfiles: true } },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
      }),
      prisma.story.findFirst({
        where: { workspaceId, status: 'DRAFT', createdById: user.id, deletedAt: null },
        select: { id: true, title: true, updatedAt: true, subjectId: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.voiceGenerationJob.findFirst({
        where: {
          voiceProfile: { workspaceId },
          status: { in: ['QUEUED', 'PROCESSING'] },
        },
        select: {
          id: true,
          status: true,
          queuedAt: true,
          voiceProfile: { select: { id: true, name: true } },
        },
        orderBy: { queuedAt: 'desc' },
      }),
      isAdminOrOwner
        ? prisma.workspaceInvite.count({ where: { workspaceId, status: 'PENDING' } })
        : Promise.resolve(0),
      prisma.membership.count({ where: { workspaceId } }),
      // Recent comments
      prisma.storyComment.findMany({
        where: { workspaceId, createdAt: { gte: activitySince } },
        select: {
          id: true,
          content: true,
          createdAt: true,
          story: { select: { id: true, title: true } },
          user: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Recent uploads (assets)
      prisma.asset.findMany({
        where: { workspaceId, createdAt: { gte: activitySince }, isAISynthesized: false },
        select: {
          id: true,
          originalName: true,
          assetType: true,
          createdAt: true,
          uploadedBy: { select: { displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Recent completed voice generations
      prisma.voiceGenerationJob.findMany({
        where: {
          voiceProfile: { workspaceId },
          status: 'COMPLETED',
          completedAt: { gte: activitySince },
        },
        select: {
          id: true,
          completedAt: true,
          voiceProfile: { select: { name: true } },
          story: { select: { id: true, title: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
      }),
      // Suggestion: a person with no stories
      prisma.person.findFirst({
        where: { workspaceId, storiesAsSubject: { none: {} } },
        select: { id: true, firstName: true, lastName: true, displayName: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Suggestion: a living person without a voice profile
      prisma.person.findFirst({
        where: { workspaceId, isDeceased: false, voiceProfiles: { none: {} } },
        select: { id: true, firstName: true, lastName: true, displayName: true },
        orderBy: { createdAt: 'asc' },
      }),
      // Suggestion: untagged stories count
      prisma.story.count({ where: { workspaceId, tags: { isEmpty: true }, deletedAt: null } }),
      // Featured person pool (people with at least one story; fall back happens below)
      prisma.person.findMany({
        where: { workspaceId, storiesAsSubject: { some: { deletedAt: null } } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          bio: true,
          birthDate: true,
          deathDate: true,
          isDeceased: true,
          avatarAsset: { select: { id: true } },
          _count: { select: { storiesAsSubject: true } },
        },
        orderBy: { id: 'asc' },
        take: 50,
      }),
    ])

    const latestStories = latestStoriesRaw.map((s) => ({
      id: s.id,
      title: s.title,
      excerpt: s.excerpt || s.content.substring(0, 200),
      storyDate: s.storyDate,
      status: s.status,
      isPinned: s.isPinned,
      tags: s.tags,
      createdAt: s.createdAt,
      hasNarration: Boolean(s.generatedAudioAssetId),
      subject: s.subject
        ? {
            id: s.subject.id,
            name: `${s.subject.firstName}${s.subject.lastName ? ' ' + s.subject.lastName : ''}`,
          }
        : null,
      createdBy: s.createdBy?.displayName || 'Unknown',
    }))

    const familyMembers = recentPeopleRaw.map((p) => ({
      id: p.id,
      name: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
      firstName: p.firstName,
      lastName: p.lastName,
      displayName: p.displayName,
      avatarAssetId: p.avatarAsset?.id ?? null,
      storyCount: p._count.storiesAsSubject,
      voiceProfileCount: p._count.voiceProfiles,
      isDeceased: p.isDeceased,
    }))

    // Build unified activity feed
    const activity: ActivityEntry[] = []
    for (const c of recentComments) {
      activity.push({
        kind: 'comment',
        at: c.createdAt,
        title: `Comment on "${c.story.title}"`,
        detail: c.content.length > 90 ? c.content.slice(0, 90) + '…' : c.content,
        href: `/stories/${c.story.id}`,
        actor: c.user?.displayName || 'Someone',
      })
    }
    for (const a of recentUploads) {
      activity.push({
        kind: 'upload',
        at: a.createdAt,
        title: `Uploaded ${a.originalName}`,
        detail: a.assetType.toLowerCase(),
        href: null,
        actor: a.uploadedBy?.displayName || 'Someone',
      })
    }
    for (const g of recentGenerations) {
      if (!g.completedAt) continue
      activity.push({
        kind: 'generation',
        at: g.completedAt,
        title: g.story
          ? `Narrated "${g.story.title}"`
          : `Generated audio with ${g.voiceProfile.name}`,
        detail: g.voiceProfile.name,
        href: g.story ? `/stories/${g.story.id}` : null,
        actor: g.voiceProfile.name,
      })
    }
    activity.sort((a, b) => b.at.getTime() - a.at.getTime())
    const recentActivity = activity.slice(0, 10)

    // Pick featured person deterministically per day
    let featuredPerson = null
    if (featuredPersonCandidates.length > 0) {
      const seed = dailySeed(workspaceId)
      const pick = featuredPersonCandidates[seed % featuredPersonCandidates.length]
      featuredPerson = {
        id: pick.id,
        name: pick.displayName || `${pick.firstName}${pick.lastName ? ' ' + pick.lastName : ''}`,
        firstName: pick.firstName,
        bio: pick.bio,
        birthDate: pick.birthDate,
        deathDate: pick.deathDate,
        isDeceased: pick.isDeceased,
        avatarAssetId: pick.avatarAsset?.id ?? null,
        storyCount: pick._count.storiesAsSubject,
      }
    }

    // Build suggestions list (max 3)
    const suggestions: Array<{ key: string; label: string; href: string }> = []
    if (personWithoutStories) {
      const personName =
        personWithoutStories.displayName ||
        `${personWithoutStories.firstName}${personWithoutStories.lastName ? ' ' + personWithoutStories.lastName : ''}`
      suggestions.push({
        key: 'add-story',
        label: `Add a story for ${personName}`,
        href: `/stories?subjectId=${personWithoutStories.id}#contribution-hub`,
      })
    }
    if (livingPersonWithoutVoice) {
      const personName =
        livingPersonWithoutVoice.displayName ||
        `${livingPersonWithoutVoice.firstName}${livingPersonWithoutVoice.lastName ? ' ' + livingPersonWithoutVoice.lastName : ''}`
      suggestions.push({
        key: 'record-voice',
        label: `Record a voice sample for ${personName}`,
        href: `/voice-lab?personId=${livingPersonWithoutVoice.id}`,
      })
    }
    if (untaggedStoriesCount > 0 && suggestions.length < 3) {
      suggestions.push({
        key: 'tag-stories',
        label: `Tag ${untaggedStoriesCount} untagged ${untaggedStoriesCount === 1 ? 'story' : 'stories'}`,
        href: '/stories',
      })
    }

    return successResponse(res, {
      workspace: {
        id: workspaceId,
        name: workspace?.name ?? 'Family Vault',
        planType: workspace?.planType ?? 'FREE',
      },
      userContext: {
        userId: user.id,
        displayName: user.displayName,
        role,
      },
      stats: {
        people: peopleCount,
        stories: storiesCount,
        voiceProfiles: voiceProfileCount,
        publishedStories,
        draftStories,
        documents: documentsCount,
        members: hasInvitedMemberValue,
      },
      onboardingState: {
        hasFirstPerson: peopleCount > 0,
        hasFirstStory: storiesCount > 0,
        hasFirstDocument: documentsCount > 0,
        hasFirstVoice: voiceProfileCount > 0,
        hasInvitedMember: hasInvitedMemberValue > 1,
      },
      continueWork: {
        lastDraftStory: lastDraftStory
          ? {
              id: lastDraftStory.id,
              title: lastDraftStory.title,
              updatedAt: lastDraftStory.updatedAt,
              subjectId: lastDraftStory.subjectId,
            }
          : null,
        inProgressVoiceJob: inProgressVoiceJob
          ? {
              id: inProgressVoiceJob.id,
              status: inProgressVoiceJob.status,
              queuedAt: inProgressVoiceJob.queuedAt,
              voiceProfileId: inProgressVoiceJob.voiceProfile.id,
              voiceProfileName: inProgressVoiceJob.voiceProfile.name,
            }
          : null,
      },
      pendingInvites: pendingInvitesCount,
      latestStories,
      familyMembers,
      recentActivity,
      featuredPerson,
      suggestions,
    })
  },
})
