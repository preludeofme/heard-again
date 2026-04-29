import { VoiceLabPage } from '@/components/pages/VoiceLabPage'
import { useVoiceLabController } from '@/controllers'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

export function VoicesLens() {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const selectedSubjectId = selectedFamilyMember?.id
  const controller = useVoiceLabController(selectedSubjectId)

  return (
    <VoiceLabPage
      voiceModels={controller.voiceModels}
      controller={controller}
    />
  )
}
