import { Box, Typography } from '@mui/material'
import { useRouter } from 'next/router'
import { ArrowForwardRounded, PersonAddAlt1Rounded } from '@mui/icons-material'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import type { DashboardFamilyMember } from '@/controllers/useDashboardController'

interface FamilyAtAGlanceProps {
  members: DashboardFamilyMember[]
  totalPeople: number
}

export function FamilyAtAGlance({ members, totalPeople }: FamilyAtAGlanceProps) {
  const router = useRouter()
  const { setSelectedFamilyMember } = useSelectedFamilyMember()

  const handleClick = (member: DashboardFamilyMember) => {
    setSelectedFamilyMember({
      id: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
      displayName: member.displayName,
      avatarUrl: member.avatarAssetId ? `/api/assets/serve/${member.avatarAssetId}` : null,
    })
    router.push(`/profile/${member.id}`)
  }

  return (
    <Box
      component="section"
      sx={{
        bgcolor: ProfileColors.surfaceContainerLowest,
        borderRadius: '2rem',
        p: { xs: 4, md: 5 },
        boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        height: '100%',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 3 }}>
        <Typography
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontSize: { xs: '1.5rem', md: '1.75rem' },
            fontWeight: 700,
            color: ProfileColors.primary,
          }}
        >
          Family at a glance
        </Typography>
        {totalPeople > members.length && (
          <Box
            onClick={() => router.push('/family-tree')}
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'pointer',
              color: ProfileColors.primary,
              fontFamily: 'var(--font-manrope), sans-serif',
              fontWeight: 600,
              fontSize: '0.85rem',
              '&:hover': { opacity: 0.7 },
            }}
          >
            See all {totalPeople} <ArrowForwardRounded sx={{ fontSize: 16 }} />
          </Box>
        )}
      </Box>

      {members.length === 0 ? (
        <Box
          onClick={() => router.push('/family-tree')}
          sx={{
            textAlign: 'center',
            py: 5,
            px: 3,
            borderRadius: '1.5rem',
            bgcolor: ProfileColors.surfaceContainerLow,
            cursor: 'pointer',
            transition: 'background 0.2s',
            '&:hover': { bgcolor: ProfileColors.surfaceContainer },
          }}
        >
          <PersonAddAlt1Rounded sx={{ fontSize: 36, color: ProfileColors.primary, opacity: 0.6, mb: 1 }} />
          <Typography
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              fontStyle: 'italic',
              fontSize: '1.05rem',
              color: ProfileColors.onSurfaceVariant,
            }}
          >
            Add your first family member
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
            gap: 2,
          }}
        >
          {members.slice(0, 8).map(member => {
            const initials = (member.firstName?.[0] ?? '?').toUpperCase()
            const avatarUrl = member.avatarAssetId
              ? `/api/assets/serve/${member.avatarAssetId}`
              : null
            return (
              <Box
                key={member.id}
                onClick={() => handleClick(member)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  cursor: 'pointer',
                  transition: 'transform 0.2s',
                  '&:hover': { transform: 'translateY(-3px)' },
                }}
              >
                <Box
                  sx={{
                    width: 64,
                    height: 64,
                    borderRadius: '50%',
                    overflow: 'hidden',
                    border: `3px solid ${ProfileColors.surfaceContainerLowest}`,
                    boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                    bgcolor: ProfileColors.surfaceContainerHigh,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    filter: member.isDeceased ? 'grayscale(40%)' : 'none',
                  }}
                >
                  {avatarUrl ? (
                    <Box
                      component="img"
                      src={avatarUrl}
                      alt={member.name}
                      sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <Typography
                      sx={{
                        fontFamily: 'var(--font-newsreader), serif',
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: ProfileColors.primary,
                      }}
                    >
                      {initials}
                    </Typography>
                  )}
                </Box>
                <Typography
                  sx={{
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: ProfileColors.primary,
                    textAlign: 'center',
                    width: '100%',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {member.firstName}
                </Typography>
              </Box>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
