import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { StoriesPage } from '@/components/pages/StoriesPage'
import { useStoriesController } from '@/controllers/useStoriesController'
import { Box, CircularProgress, Typography, Button } from '@mui/material'

export default function Stories() {
  const controller = useStoriesController()

  return (
    <>
      <Head>
        <title>Stories - Heard Again</title>
        <meta name="description" content="Help us tell their story" />
      </Head>
      <Layout>
        {controller.isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
            <CircularProgress />
          </Box>
        ) : controller.hasError ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', gap: 2 }}>
            <Typography color="error">{controller.errorMessage}</Typography>
            <Button variant="contained" onClick={controller.refreshStories}>Retry</Button>
          </Box>
        ) : (
          <StoriesPage
            stories={controller.stories}
            onSubmitStory={async (title, content) => {
              await controller.submitStory(title, content)
            }}
            onSubmitAudio={async (audioBlob, duration) => {
              await controller.submitAudioStory(audioBlob, duration)
            }}
          />
        )}
      </Layout>
    </>
  )
}
