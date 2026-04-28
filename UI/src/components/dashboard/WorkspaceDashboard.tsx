import { Box, Grid, CircularProgress, Alert, Typography } from '@mui/material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { useDashboardController } from '@/controllers/useDashboardController'
import { WorkspaceHero } from './WorkspaceHero'
import { OnboardingChecklist } from './OnboardingChecklist'
import { ContinueCard } from './ContinueCard'
import { QuickActionsRail } from './QuickActionsRail'
import { RecentStoriesFeed } from './RecentStoriesFeed'
import { FamilyAtAGlance } from './FamilyAtAGlance'
import { ActivityFeed } from './ActivityFeed'
import { FeaturedPersonCard } from './FeaturedPersonCard'
import { Suggestions } from './Suggestions'
import { SubscriptionStatusCard } from './SubscriptionStatusCard'

export function WorkspaceDashboard() {
  const {
    workspace,
    userContext,
    stats,
    onboardingState,
    continueWork,
    pendingInvites,
    latestStories,
    familyMembers,
    recentActivity,
    featuredPerson,
    suggestions,
    billingUsage,
    isLoading,
    hasError,
    errorMessage,
  } = useDashboardController()

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          gap: 2,
        }}
      >
        <CircularProgress sx={{ color: ProfileColors.primary }} />
        <Typography variant="body2" color="text.secondary">
          Gathering family memories...
        </Typography>
      </Box>
    )
  }

  if (hasError) {
    return (
      <Box sx={{ maxWidth: 600, mx: 'auto', p: 4, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {errorMessage || 'Failed to load dashboard'}
        </Alert>
      </Box>
    )
  }

  const role = userContext?.role ?? 'VIEWER'
  const isColdStart = stats.people === 0
  const hasContinueWork =
    Boolean(continueWork.lastDraftStory) || Boolean(continueWork.inProgressVoiceJob)
  const allOnboardingDone =
    onboardingState.hasFirstPerson &&
    onboardingState.hasFirstStory &&
    onboardingState.hasFirstDocument &&
    onboardingState.hasFirstVoice &&
    (role !== 'OWNER' && role !== 'ADMIN' ? true : onboardingState.hasInvitedMember)
  const showSubscription = role === 'OWNER' || role === 'ADMIN'

  return (
    <Box
      sx={{
        maxWidth: 1200,
        mx: 'auto',
        px: { xs: 3, md: 6 },
        pt: { xs: 4, md: 8 },
        pb: 20,
        bgcolor: ProfileColors.surface,
        minHeight: '100vh',
      }}
    >
      <Grid container spacing={3}>
        <Grid size={{ xs: 12 }}>
          <WorkspaceHero
            workspace={workspace}
            userContext={userContext}
            stats={stats}
            pendingInvites={pendingInvites}
          />
        </Grid>

        {!allOnboardingDone && (
          <Grid size={{ xs: 12 }}>
            <OnboardingChecklist state={onboardingState} role={role} workspaceId={workspace?.id ?? null} />
          </Grid>
        )}

        {!isColdStart && (
          <>
            {(hasContinueWork || suggestions.length > 0) && (
              <>
                {hasContinueWork && (
                  <Grid size={{ xs: 12, md: suggestions.length > 0 ? 8 : 12 }}>
                    <ContinueCard continueWork={continueWork} />
                  </Grid>
                )}
                {suggestions.length > 0 && (
                  <Grid size={{ xs: 12, md: hasContinueWork ? 4 : 12 }}>
                    <Suggestions suggestions={suggestions} />
                  </Grid>
                )}
              </>
            )}

            <Grid size={{ xs: 12 }}>
              <QuickActionsRail role={role} />
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <RecentStoriesFeed stories={latestStories} />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <FamilyAtAGlance members={familyMembers} totalPeople={stats.people} />
            </Grid>

            {(recentActivity.length > 0 || featuredPerson) && (
              <>
                {recentActivity.length > 0 && (
                  <Grid size={{ xs: 12, md: featuredPerson ? 5 : 12 }}>
                    <ActivityFeed entries={recentActivity} />
                  </Grid>
                )}
                {featuredPerson && (
                  <Grid size={{ xs: 12, md: recentActivity.length > 0 ? 7 : 12 }}>
                    <FeaturedPersonCard person={featuredPerson} />
                  </Grid>
                )}
              </>
            )}

            {showSubscription && billingUsage && (
              <Grid size={{ xs: 12 }}>
                <SubscriptionStatusCard usage={billingUsage} planType={workspace?.planType ?? 'FREE'} />
              </Grid>
            )}
          </>
        )}

        {isColdStart && (
          <Grid size={{ xs: 12 }}>
            <QuickActionsRail role={role} />
          </Grid>
        )}
      </Grid>
    </Box>
  )
}
