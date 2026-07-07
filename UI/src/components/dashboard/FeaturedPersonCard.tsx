import { Box, Typography } from '@mui/material'
import { useRouter } from 'next/router'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import type { FeaturedPerson } from '@/controllers/useDashboardController'

interface FeaturedPersonCardProps {
  person: FeaturedPerson | null
}

const toYear = (iso: string | null) => (iso ? new Date(iso).getFullYear() : null)

export function FeaturedPersonCard({ person }: FeaturedPersonCardProps) {
  const router = useRouter()
  if (!person) return null

  const avatarUrl = person.avatarAssetId ? `/api/assets/serve/${person.avatarAssetId}` : null
  const initials = (person.firstName?.[0] ?? '?').toUpperCase()
  const birthYear = toYear(person.birthDate)
  const deathYear = toYear(person.deathDate)
  const lifespan = birthYear && deathYear ? `${birthYear} — ${deathYear}` : birthYear ? `b. ${birthYear}` : deathYear ? `d. ${deathYear}` : null

  return (
    <Box
      component="section"
      onClick={() => router.push(`/profile/${person.id}`)}
      sx={{
        bgcolor: ProfileColors.primary,
        color: '#fff',
        borderRadius: '2rem',
        p: { xs: 4, md: 5 },
        boxShadow: '0 8px 32px rgba(22,51,74,0.24)',
        height: '100%',
        cursor: 'pointer',
        transition: 'transform 0.25s, box-shadow 0.25s',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: '0 12px 40px rgba(22,51,74,0.32)',
        },
        display: 'flex',
        flexDirection: 'column',
        gap: 2.5,
      }}
    >
      <Typography
        sx={{
          fontFamily: 'var(--font-manrope), sans-serif',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        Today&apos;s spotlight
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            overflow: 'hidden',
            border: '4px solid rgba(255,255,255,0.18)',
            bgcolor: 'rgba(255,255,255,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <Box
              component="img"
              src={avatarUrl}
              alt={person.name}
              sx={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(15%)' }}
            />
          ) : (
            <Typography
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontSize: '2rem',
                fontWeight: 700,
                color: '#fff',
              }}
            >
              {initials}
            </Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              fontSize: { xs: '1.6rem', md: '2rem' },
              fontWeight: 700,
              color: '#fff',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {person.name}
          </Typography>
          {lifespan && (
            <Typography
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontStyle: 'italic',
                fontSize: '0.95rem',
                color: 'rgba(255,255,255,0.75)',
                mt: 0.5,
              }}
            >
              {lifespan}
            </Typography>
          )}
        </Box>
      </Box>

      {person.bio && (
        <Typography
          sx={{
            fontFamily: 'var(--font-newsreader), serif',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            color: 'rgba(255,255,255,0.92)',
            lineHeight: 1.6,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          “{person.bio}”
        </Typography>
      )}

      <Typography
        sx={{
          fontFamily: 'var(--font-manrope), sans-serif',
          fontSize: '0.85rem',
          color: 'rgba(255,255,255,0.7)',
          mt: 'auto',
        }}
      >
        {person.storyCount} {person.storyCount === 1 ? 'story' : 'stories'} preserved · tap to explore
      </Typography>
    </Box>
  )
}
