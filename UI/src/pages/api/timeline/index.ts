import { logger } from '@/lib/logger'
import type { NextApiRequest, NextApiResponse } from 'next'
import { getAuthUserWithFamilyspace } from '@/lib/auth-helpers'
import { prisma } from '@/lib/prisma'

export interface TimelineEvent {
  id: string
  type: 'birth' | 'death' | 'marriage' | 'divorce' | 'story' | 'document' | 'custom'
  date: Date | null
  datePrecision: string
  title: string
  description?: string
  people: Array<{
    id: string
    firstName: string
    lastName?: string
    displayName?: string
    avatarAssetId?: string
    role?: string
  }>
  metadata?: Record<string, any>
  sourceId: string
  sourceType: string
}

const EVENT_LABEL_MAP: Record<string, string> = {
  BAPTISM: 'Baptism',
  BURIAL: 'Burial',
  CREMATION: 'Cremation',
  MARRIAGE: 'Marriage',
  DIVORCE: 'Divorce',
  RESIDENCE: 'Residence',
  OCCUPATION: 'Occupation',
  EDUCATION: 'Education',
  MILITARY_SERVICE: 'Military Service',
  NATURALIZATION: 'Naturalization',
  IMMIGRATION: 'Immigration',
  EMIGRATION: 'Emigration',
  CENSUS: 'Census',
  RETIREMENT: 'Retirement',
  WILL: 'Will',
  TITLE: 'Title',
  PHYSICAL_DESCRIPTION: 'Physical Description',
  MEDICAL: 'Medical',
  ADOPTION: 'Adoption',
  CUSTOM: 'Other Event',
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let familyspaceId: string
  let userId: string
  
  try {
    const user = await getAuthUserWithFamilyspace(req, res)
    familyspaceId = user.familyspaceId
    userId = user.id
  } catch (error: any) {
    return res.status(error.statusCode || 401).json({ success: false, error: error.message || 'Unauthorized' })
  }

  const { method } = req

  try {
    switch (method) {
      case 'GET':
        return await getTimelineEvents(req, res, familyspaceId)
      case 'POST':
        return await createTimelineEvent(req, res, familyspaceId, userId)
      default:
        return res.status(405).json({ success: false, error: 'Method not allowed' })
    }
  } catch (error) {
    logger.error('Timeline API error:', error)
    return res.status(500).json({ success: false, error: 'Internal server error' })
  }
}

async function getTimelineEvents(req: NextApiRequest, res: NextApiResponse, familyspaceId: string) {
  const {
    personId,
    eventTypes,
    dateFrom,
    dateTo,
    page = '1',
    limit = '50',
  } = req.query

  const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
  const take = parseInt(limit as string)

  // Build filter for person if specified
  const personFilter = personId ? { id: personId as string } : undefined

  // Fetch all event types in parallel
  const [birthEvents, deathEvents, marriageEvents, storyEvents, documentEvents, personEvents] = await Promise.all([
    // Birth events from Person.birthDate
    prisma.person.findMany({
      where: {
        familyspaceId,
        birthDate: { not: null },
        ...(personFilter && { id: personFilter.id }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarAssetId: true,
        birthDate: true,
      },
    }),

    // Death events from Person.deathDate
    prisma.person.findMany({
      where: {
        familyspaceId,
        deathDate: { not: null },
        isDeceased: true,
        ...(personFilter && { id: personFilter.id }),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        avatarAssetId: true,
        deathDate: true,
      },
    }),

    // Marriage events from FamilyUnit.marriageDate
    prisma.familyUnit.findMany({
      where: {
        familyspaceId,
        marriageDate: { not: null },
        ...(personFilter && {
          parents: {
            some: {
              parentId: personFilter.id,
            },
          },
        }),
      },
      include: {
        parents: {
          include: {
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatarAssetId: true,
              },
            },
          },
        },
      },
    }),

    // Story events
    prisma.story.findMany({
      where: {
        familyspaceId,
        storyDate: { not: null },
        ...(personFilter && {
          OR: [
            { subjectId: personFilter.id },
            { speakerId: personFilter.id },
          ],
        }),
      },
      select: {
        id: true,
        title: true,
        storyDate: true,
        storyDatePrecision: true,
        excerpt: true,
        content: true,
        subjectId: true,
        subject: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarAssetId: true,
          },
        },
        speaker: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarAssetId: true,
          },
        },
        assets: {
          where: {
            asset: {
              assetType: 'IMAGE',
            },
          },
          take: 1,
          select: {
            asset: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    }),

    // Document events
    prisma.document.findMany({
      where: {
        familyspaceId,
        dateOccurred: { not: null },
        isDeleted: false,
        ...(personFilter && {
          people: {
            some: {
              personId: personFilter.id,
            },
          },
        }),
      },
      select: {
        id: true,
        title: true,
        dateOccurred: true,
        dateOccurredPrecision: true,
        description: true,
        documentType: true,
        asset: {
          select: {
            id: true,
            assetType: true,
          },
        },
        people: {
          include: {
            person: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayName: true,
                avatarAssetId: true,
              },
            },
          },
        },
      },
    }),

    // PersonEvent records (custom events from Add Event form)
    prisma.personEvent.findMany({
      where: {
        person: { familyspaceId },
        eventDate: { not: null },
        ...(personFilter && { personId: personFilter.id }),
      },
      include: {
        person: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarAssetId: true,
          },
        },
      },
    }),
  ])

  // Transform all events into a unified format
  let allEvents: TimelineEvent[] = []

  // Add birth events
  birthEvents.forEach(person => {
    if (person.birthDate) {
      allEvents.push({
        id: `birth-${person.id}`,
        type: 'birth',
        date: person.birthDate,
        datePrecision: 'EXACT',
        title: `Birth of ${person.displayName || `${person.firstName} ${person.lastName || ''}`.trim()}`,
        people: [{
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName ?? undefined,
          displayName: person.displayName ?? undefined,
          avatarAssetId: person.avatarAssetId ?? undefined,
          role: 'subject',
        }],
        sourceId: person.id,
        sourceType: 'person',
      })
    }
  })

  // Add death events
  deathEvents.forEach(person => {
    if (person.deathDate) {
      allEvents.push({
        id: `death-${person.id}`,
        type: 'death',
        date: person.deathDate,
        datePrecision: 'EXACT',
        title: `Death of ${person.displayName || `${person.firstName} ${person.lastName || ''}`.trim()}`,
        people: [{
          id: person.id,
          firstName: person.firstName,
          lastName: person.lastName ?? undefined,
          displayName: person.displayName ?? undefined,
          avatarAssetId: person.avatarAssetId ?? undefined,
          role: 'subject',
        }],
        sourceId: person.id,
        sourceType: 'person',
      })
    }
  })

  // Add marriage events
  marriageEvents.forEach(family => {
    if (family.marriageDate) {
      const people = family.parents.map(p => ({
        id: p.parent.id,
        firstName: p.parent.firstName,
        lastName: p.parent.lastName ?? undefined,
        displayName: p.parent.displayName ?? undefined,
        avatarAssetId: p.parent.avatarAssetId ?? undefined,
        role: 'spouse',
      }))

      allEvents.push({
        id: `marriage-${family.id}`,
        type: 'marriage',
        date: family.marriageDate,
        datePrecision: 'EXACT',
        title: `Marriage${family.marriagePlace ? ` in ${family.marriagePlace}` : ''}`,
        description: family.marriagePlace ?? undefined,
        people,
        sourceId: family.id,
        sourceType: 'family',
      })
    }
  })

  // Add story events
  storyEvents.forEach(story => {
    if (story.storyDate) {
      const people: TimelineEvent['people'] = []
      if (story.subject) {
        people.push({
          id: story.subject.id,
          firstName: story.subject.firstName,
          lastName: story.subject.lastName ?? undefined,
          displayName: story.subject.displayName ?? undefined,
          avatarAssetId: story.subject.avatarAssetId ?? undefined,
          role: 'subject',
        })
      }
      if (story.speaker && story.speaker.id !== story.subject?.id) {
        people.push({
          id: story.speaker.id,
          firstName: story.speaker.firstName,
          lastName: story.speaker.lastName ?? undefined,
          displayName: story.speaker.displayName ?? undefined,
          avatarAssetId: story.speaker.avatarAssetId ?? undefined,
          role: 'speaker',
        })
      }

      allEvents.push({
        id: `story-${story.id}`,
        type: 'story',
        date: story.storyDate,
        datePrecision: story.storyDatePrecision,
        title: story.title,
        description: story.content ?? story.excerpt ?? undefined,
        people,
        metadata: { 
          imageAssetId: story.assets[0]?.asset.id 
        },
        sourceId: story.id,
        sourceType: 'story',
      })
    }
  })

  // Add document events
  documentEvents.forEach(doc => {
    if (doc.dateOccurred) {
      allEvents.push({
        id: `document-${doc.id}`,
        type: 'document',
        date: doc.dateOccurred,
        datePrecision: doc.dateOccurredPrecision,
        title: doc.title,
        description: doc.description ?? undefined,
        people: doc.people.map(dp => ({
          id: dp.person.id,
          firstName: dp.person.firstName,
          lastName: dp.person.lastName ?? undefined,
          displayName: dp.person.displayName ?? undefined,
          avatarAssetId: dp.person.avatarAssetId ?? undefined,
          role: dp.role ?? undefined,
        })),
        metadata: { 
          documentType: doc.documentType,
          imageAssetId: doc.asset.assetType === 'IMAGE' ? doc.asset.id : undefined
        },
        sourceId: doc.id,
        sourceType: 'document',
      })
    }
  })

  // Add person events (custom events)
  personEvents.forEach(event => {
    if (event.eventDate) {
      const typeLabel = EVENT_LABEL_MAP[event.eventType] || event.eventType
      const name = event.person.displayName || `${event.person.firstName} ${event.person.lastName || ''}`.trim()
      
      let title = `${typeLabel} of ${name}`
      if (event.place) {
        title += ` in ${event.place}`
      }
      
      allEvents.push({
        id: `event-${event.id}`,
        type: 'custom',
        date: event.eventDate,
        datePrecision: 'EXACT',
        title,
        description: event.description || undefined,
        people: [{
          id: event.person.id,
          firstName: event.person.firstName,
          lastName: event.person.lastName ?? undefined,
          displayName: event.person.displayName ?? undefined,
          avatarAssetId: event.person.avatarAssetId ?? undefined,
          role: 'subject',
        }],
        metadata: { subType: event.eventType },
        sourceId: event.id,
        sourceType: 'personEvent',
      })
    }
  })

  // Filter by date range if specified
  if (dateFrom) {
    const fromDate = new Date(dateFrom as string)
    allEvents = allEvents.filter(e => e.date && e.date >= fromDate)
  }
  if (dateTo) {
    const toDate = new Date(dateTo as string)
    allEvents = allEvents.filter(e => e.date && e.date <= toDate)
  }

  // Filter by event types if specified
  if (eventTypes) {
    const types = (eventTypes as string).split(',')
    allEvents = allEvents.filter(e => types.includes(e.type))
  }

  // Sort by date (null dates at the end)
  allEvents.sort((a, b) => {
    if (!a.date && !b.date) return 0
    if (!a.date) return 1
    if (!b.date) return -1
    return a.date.getTime() - b.date.getTime()
  })

  const total = allEvents.length
  const paginatedEvents = allEvents.slice(skip, skip + take)

  return res.status(200).json({
    success: true,
    data: paginatedEvents,
    pagination: {
      page: parseInt(page as string),
      limit: take,
      total,
      totalPages: Math.ceil(total / take),
    },
  })
}

async function createTimelineEvent(
  req: NextApiRequest,
  res: NextApiResponse,
  familyspaceId: string,
  userId: string
) {
  // For now, custom timeline events can be created as PersonEvent records
  // This could be extended to a separate TimelineEvent model in the future
  const { personId, eventType, eventDate, title, description, place } = req.body

  if (!personId || !eventType || !eventDate) {
    return res.status(400).json({
      success: false,
      error: 'personId, eventType, and eventDate are required',
    })
  }

  // Verify person exists in familyspace
  const person = await prisma.person.findFirst({
    where: { id: personId, familyspaceId },
  })

  if (!person) {
    return res.status(404).json({
      success: false,
      error: 'Person not found',
    })
  }

  // Combine title and description for storage
  const fullDescription = title && description 
    ? `${title}: ${description}` 
    : title || description || ''

  const event = await prisma.personEvent.create({
    data: {
      personId,
      eventType,
      eventDate: new Date(eventDate),
      place,
      description: fullDescription,
    },
    include: {
      person: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          avatarAssetId: true,
        },
      },
    },
  })

  return res.status(201).json({
    success: true,
    data: {
      id: `event-${event.id}`,
      type: 'custom',
      date: event.eventDate,
      datePrecision: 'EXACT',
      title: title || `${event.eventType}: ${event.person.displayName || event.person.firstName}`,
      description: description || event.description,
      people: [{
        id: event.person.id,
        firstName: event.person.firstName,
        lastName: event.person.lastName ?? undefined,
        displayName: event.person.displayName ?? undefined,
        avatarAssetId: event.person.avatarAssetId ?? undefined,
        role: 'subject',
      }],
      sourceId: event.id,
      sourceType: 'personEvent',
    },
  })
}
