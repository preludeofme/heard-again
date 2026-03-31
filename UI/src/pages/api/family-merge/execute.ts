import { prisma } from '@/lib/prisma'
import { apiHandler, successResponse, Errors } from '@/lib/api-helpers'
import { getAuthUserWithWorkspace, requireWorkspaceRole } from '@/lib/auth-helpers'

interface MergeResult {
  mergedPeople: number
  mergedFamilies: number
  transferredStories: number
  transferredDocuments: number
  transferredVoiceProfiles: number
  errors: string[]
}

export default apiHandler({
  // POST /api/family-merge/execute - Execute an approved merge proposal
  POST: async (req, res) => {
    const user = await getAuthUserWithWorkspace(req, res)
    await requireWorkspaceRole(user.id, user.workspaceId, 'OWNER')
    
    const { proposalId } = req.body
    
    if (!proposalId) {
      throw Errors.badRequest('proposalId is required')
    }
    
    // Fetch the proposal with all matches
    const proposal = await prisma.familyMergeProposal.findFirst({
      where: {
        id: proposalId,
        targetWorkspaceId: user.workspaceId,
        status: 'APPROVED'
      },
      include: {
        personMatches: {
          where: { isIncluded: true },
          include: {
            targetPerson: true,
            sourcePerson: {
              include: {
                storiesAsSubject: true,
                storiesAsSpeaker: true,
                voiceProfiles: true,
                documentLinks: true,
                parentInFamilies: {
                  include: {
                    family: {
                      include: {
                        parents: true,
                        children: true
                      }
                    }
                  }
                },
                familyChildLinks: {
                  include: {
                    family: {
                      include: {
                        parents: true,
                        children: true
                      }
                    }
                  }
                },
                names: true,
                events: true
              }
            }
          }
        }
      }
    })
    
    if (!proposal) {
      throw Errors.notFound('FamilyMergeProposal or proposal is not approved')
    }
    
    const result: MergeResult = {
      mergedPeople: 0,
      mergedFamilies: 0,
      transferredStories: 0,
      transferredDocuments: 0,
      transferredVoiceProfiles: 0,
      errors: []
    }
    
    // Execute the merge in a transaction
    await prisma.$transaction(async (tx) => {
      for (const match of proposal.personMatches) {
        try {
          const { targetPerson, sourcePerson } = match
          
          // 1. Transfer stories where source person is subject
          for (const story of sourcePerson.storiesAsSubject) {
            await tx.story.update({
              where: { id: story.id },
              data: { subjectId: targetPerson.id }
            })
            result.transferredStories++
          }
          
          // 2. Transfer stories where source person is speaker
          for (const story of sourcePerson.storiesAsSpeaker) {
            await tx.story.update({
              where: { id: story.id },
              data: { speakerId: targetPerson.id }
            })
            result.transferredStories++
          }
          
          // 3. Transfer voice profiles
          for (const voiceProfile of sourcePerson.voiceProfiles) {
            await tx.voiceProfile.update({
              where: { id: voiceProfile.id },
              data: { personId: targetPerson.id }
            })
            result.transferredVoiceProfiles++
          }
          
          // 4. Transfer document links
          for (const docLink of sourcePerson.documentLinks) {
            // Check if target person already has this document link
            const existingLink = await tx.documentPerson.findFirst({
              where: {
                documentId: docLink.documentId,
                personId: targetPerson.id
              }
            })
            
            if (!existingLink) {
              await tx.documentPerson.create({
                data: {
                  documentId: docLink.documentId,
                  personId: targetPerson.id,
                  role: docLink.role,
                  aiSuggested: docLink.aiSuggested,
                  aiConfidence: docLink.aiConfidence
                }
              })
            }
            
            // Remove old link
            await tx.documentPerson.delete({
              where: { id: docLink.id }
            })
            result.transferredDocuments++
          }
          
          // 5. Merge family relationships
          // For each family where source is a parent, add target as parent too
          for (const parentLink of sourcePerson.parentInFamilies) {
            const family = parentLink.family
            
            // Check if target is already a parent in this family
            const existingParent = await tx.familyParent.findFirst({
              where: {
                familyId: family.id,
                parentId: targetPerson.id
              }
            })
            
            if (!existingParent) {
              await tx.familyParent.create({
                data: {
                  familyId: family.id,
                  parentId: targetPerson.id,
                  relationshipType: parentLink.relationshipType,
                  sortOrder: parentLink.sortOrder
                }
              })
            }
            
            // Remove source parent link
            await tx.familyParent.delete({
              where: { id: parentLink.id }
            })
            result.mergedFamilies++
          }
          
          // For each family where source is a child, update to target
          for (const childLink of sourcePerson.familyChildLinks) {
            const family = childLink.family
            
            // Check if target is already a child in this family
            const existingChild = await tx.familyChild.findFirst({
              where: {
                familyId: family.id,
                childId: targetPerson.id
              }
            })
            
            if (!existingChild) {
              await tx.familyChild.create({
                data: {
                  familyId: family.id,
                  childId: targetPerson.id,
                  relationshipType: childLink.relationshipType,
                  sortOrder: childLink.sortOrder
                }
              })
            }
            
            // Remove source child link
            await tx.familyChild.delete({
              where: { id: childLink.id }
            })
            result.mergedFamilies++
          }
          
          // 6. Merge additional names from source to target
          for (const name of sourcePerson.names) {
            // Check if target already has this name
            const existingName = await tx.personName.findFirst({
              where: {
                personId: targetPerson.id,
                givenName: name.givenName,
                surname: name.surname
              }
            })
            
            if (!existingName) {
              await tx.personName.create({
                data: {
                  personId: targetPerson.id,
                  nameType: name.nameType,
                  givenName: name.givenName,
                  surname: name.surname,
                  prefix: name.prefix,
                  suffix: name.suffix,
                  nickname: name.nickname,
                  isPrimary: false // Never override primary name
                }
              })
            }
          }
          
          // 7. Merge events from source to target
          for (const event of sourcePerson.events) {
            // Check if target already has this event type on same date
            const existingEvent = await tx.personEvent.findFirst({
              where: {
                personId: targetPerson.id,
                eventType: event.eventType,
                eventDate: event.eventDate
              }
            })
            
            if (!existingEvent) {
              await tx.personEvent.create({
                data: {
                  personId: targetPerson.id,
                  eventType: event.eventType,
                  eventDate: event.eventDate,
                  place: event.place,
                  description: event.description,
                  sourceCitation: event.sourceCitation,
                  isPrimary: false
                }
              })
            }
          }
          
          // 8. Delete the source person
          await tx.person.delete({
            where: { id: sourcePerson.id }
          })
          
          // 9. Update match status
          await tx.familyMergePersonMatch.update({
            where: { id: match.id },
            data: {
              status: 'MERGED',
              mergedAt: new Date()
            }
          })
          
          result.mergedPeople++
        } catch (error: any) {
          result.errors.push(`Failed to merge ${match.sourcePersonId}: ${error.message}`)
          
          // Update match status to failed
          await tx.familyMergePersonMatch.update({
            where: { id: match.id },
            data: {
              status: 'FAILED',
              errorMessage: error.message
            }
          })
        }
      }
      
      // Update proposal status
      const hasFailures = result.errors.length > 0
      await tx.familyMergeProposal.update({
        where: { id: proposalId },
        data: {
          status: hasFailures ? 'CONFLICT' : 'MERGED',
          executedAt: new Date(),
          executedById: user.id,
          errorMessage: hasFailures ? result.errors.join('; ') : null
        }
      })
    })
    
    return successResponse(res, {
      proposalId,
      status: result.errors.length > 0 ? 'CONFLICT' : 'MERGED',
      result
    })
  }
})
