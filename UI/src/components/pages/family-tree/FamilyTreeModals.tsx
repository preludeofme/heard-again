import React from 'react'
import { PersonDetailModal } from '@/components/modals/PersonDetailModal'
import { AddEditPersonModal, PersonFormData } from '@/components/modals/AddEditPersonModal'
import { VoiceTrainingModal } from '@/components/audio/VoiceTrainingModal'

interface FamilyTreeModalsProps {
  detailModalOpen: boolean
  setDetailModalOpen: (open: boolean) => void
  addEditModalOpen: boolean
  setAddEditModalOpen: (open: boolean) => void
  addEditMode: 'create' | 'edit'
  selectedPersonId: string | null
  personDetail: any
  personStories: any[]
  personVoiceProfiles: any[]
  personRelationships: any[]
  isLoadingDetail: boolean
  detailError: string | null
  isSubmitting: boolean
  voiceTrainingPersonId: string | null
  setVoiceTrainingPersonId: (id: string | null) => void
  onEditPerson: () => void
  onDeletePerson: (id: string) => void
  onAddStory: (id: string) => void
  onAddVoiceProfile: (id: string) => void
  onAddRelationship: (id: string) => void
  onStoryClick: (id: string) => void
  onViewFullProfile: (id: string) => void
  onSubmitPerson: (data: PersonFormData) => Promise<void>
}

export function FamilyTreeModals({
  detailModalOpen,
  setDetailModalOpen,
  addEditModalOpen,
  setAddEditModalOpen,
  addEditMode,
  selectedPersonId,
  personDetail,
  personStories,
  personVoiceProfiles,
  personRelationships,
  isLoadingDetail,
  detailError,
  isSubmitting,
  voiceTrainingPersonId,
  setVoiceTrainingPersonId,
  onEditPerson,
  onDeletePerson,
  onAddStory,
  onAddVoiceProfile,
  onAddRelationship,
  onStoryClick,
  onViewFullProfile,
  onSubmitPerson,
}: FamilyTreeModalsProps) {
  return (
    <>
      <PersonDetailModal
        open={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        person={personDetail}
        stories={personStories}
        voiceProfiles={personVoiceProfiles}
        relationships={personRelationships}
        isLoading={isLoadingDetail}
        error={detailError}
        onEdit={onEditPerson}
        onDelete={onDeletePerson}
        onAddStory={onAddStory}
        onAddVoiceProfile={onAddVoiceProfile}
        onAddRelationship={onAddRelationship}
        onStoryClick={onStoryClick}
        onViewFull={onViewFullProfile}
      />

      <AddEditPersonModal
        open={addEditModalOpen}
        onClose={() => setAddEditModalOpen(false)}
        mode={addEditMode}
        personId={selectedPersonId || undefined}
        initialData={addEditMode === 'edit' ? personDetail : undefined}
        onSubmit={onSubmitPerson}
        isSubmitting={isSubmitting}
      />

      {voiceTrainingPersonId && (
        <VoiceTrainingModal
          open={!!voiceTrainingPersonId}
          onClose={() => setVoiceTrainingPersonId(null)}
          personId={voiceTrainingPersonId}
          personName={personDetail?.displayName || personDetail?.firstName || 'Family Member'}
        />
      )}
    </>
  )
}
