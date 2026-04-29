import { useMemo } from 'react'
import { Box, CircularProgress, Typography, Button } from '@mui/material'
import { StoriesPage } from '@/components/pages/StoriesPage'
import { useStoriesController } from '@/controllers/useStoriesController'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import type { StoryContribution } from '@/types'

export function StoriesLens() {
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const selectedSubjectId = selectedFamilyMember?.id
  const controller = useStoriesController(selectedSubjectId)

  const visibleStories = useMemo<StoryContribution[]>(() => {
    if (selectedSubjectId) {
      return controller.stories
    }
    const shuffled = [...controller.stories].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, 6)
  }, [controller.stories, selectedSubjectId])

  if (controller.isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (controller.hasError) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '40vh', gap: 2 }}>
        <Typography color="error">{controller.errorMessage}</Typography>
        <Button variant="contained" onClick={controller.refreshStories}>Retry</Button>
      </Box>
    )
  }

  return (
    <StoriesPage
      stories={visibleStories}
      selectedFamilyMember={selectedFamilyMember}
      onSubmitStory={async (title, content, storyDate, location, authorRelationship) => {
        await controller.submitStory({
          title,
          content,
          storyType: 'MEMORY',
          subjectId: selectedSubjectId,
          storyDate,
          location,
          authorRelationship,
        })
      }}
      onSubmitAudio={async (audioBlob, duration, title, authorRelationship) => {
        await controller.submitAudioStory(audioBlob, duration, title, authorRelationship)
      }}
    />
  )
}
