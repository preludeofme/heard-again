import { useRouter } from 'next/router'
import { VoiceLabPage } from '@/components/pages/VoiceLabPage'
import { useVoiceLabController } from '@/controllers'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'

export function VoicesLens() {
  const router = useRouter()
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const selectedSubjectId = selectedFamilyMember?.id
  const controller = useVoiceLabController(selectedSubjectId)
  const autoCreate = router.query.create === 'true'

  return (
    <VoiceLabPage
      voiceModels={controller.voiceModels}
      controller={controller}
      autoCreate={autoCreate}
    />
  )
}
