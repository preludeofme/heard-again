import React from 'react'
import { Box, Typography, Avatar } from '@mui/material'
import Link from 'next/link'
import { ProfileColors } from './ProfileConstants'

interface Relationship {
  id: string
  type: 'PARENT' | 'CHILD' | 'SPOUSE'
  person: { id: string; firstName: string; lastName?: string | null }
}

interface MiniFamilyTreeProps {
  personId?: string
  firstName?: string
  avatarUrl?: string | null
  relationships?: Relationship[]
  isGlobal?: boolean
  totalPeople?: number
  recentPeople?: Array<{ id: string; firstName: string; lastName?: string | null; avatarUrl?: string | null }>
}

export function MiniFamilyTree({
  personId,
  firstName,
  avatarUrl,
  relationships,
  isGlobal = false,
  totalPeople = 0,
  recentPeople = [],
}: MiniFamilyTreeProps) {
  const spouse = relationships?.find(r => r.type === 'SPOUSE') ?? null
  const parents = relationships?.filter(r => r.type === 'PARENT') ?? []
  const children = relationships?.filter(r => r.type === 'CHILD') ?? []

  if (isGlobal) {
    return (
      <Box
        sx={{
          gridColumn: { xs: '1', md: '9 / 13' },
          bgcolor: ProfileColors.surfaceContainerLow,
          borderRadius: '2rem',
          p: { xs: 3, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          minHeight: 380,
        }}
      >
        <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.5rem', fontWeight: 700, color: ProfileColors.primary, mb: 3 }}>
          Family Tree
        </Typography>

        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 2 }}>
            {recentPeople.slice(0, 6).map(person => (
              <Box key={person.id} component={Link} href={`/profile/${person.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textDecoration: 'none' }}>
                <Avatar 
                  src={person.avatarUrl || undefined}
                  sx={{ width: 50, height: 50, bgcolor: '#adcae6', border: `2px solid ${ProfileColors.primaryContainer}`, transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.06)' } }}
                >
                  {person.firstName[0]}
                </Avatar>
              </Box>
            ))}
          </Box>
          
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: ProfileColors.onSurfaceVariant, mt: 1 }}>
            {totalPeople} family members preserved
          </Typography>

          <Box
            component={Link}
            href="/family-tree"
            sx={{ mt: 1, fontSize: '0.75rem', color: ProfileColors.onSurfaceVariant, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', borderBottom: `1px solid ${ProfileColors.outlineVariant}50`, pb: 0.25, '&:hover': { color: ProfileColors.primary } }}
          >
            Explore the full tree →
          </Box>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      sx={{
        gridColumn: { xs: '1', md: '9 / 13' },
        bgcolor: ProfileColors.surfaceContainerLow,
        borderRadius: '2rem',
        p: { xs: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        minHeight: 380,
      }}
    >
      <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.5rem', fontWeight: 700, color: ProfileColors.primary, mb: 3 }}>
        Family Tree
      </Typography>

      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        {/* Spouse or parents row */}
        {(spouse || parents.length > 0) && (
          <>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              {spouse && (
                <Box component={Link} href={`/profile/${spouse.person.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textDecoration: 'none' }}>
                  <Avatar sx={{ width: 54, height: 54, bgcolor: '#adcae6', border: `2px solid ${ProfileColors.primaryContainer}`, transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.06)' } }}>
                    {spouse.person.firstName[0]}
                  </Avatar>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ProfileColors.onSurfaceVariant }}>
                    {spouse.person.firstName}
                  </Typography>
                </Box>
              )}
              {parents.slice(0, 2).map(r => (
                <Box key={r.id} component={Link} href={`/profile/${r.person.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textDecoration: 'none' }}>
                  <Avatar sx={{ width: 54, height: 54, bgcolor: '#adcae6', border: `2px solid ${ProfileColors.primaryContainer}`, transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.06)' } }}>
                    {r.person.firstName[0]}
                  </Avatar>
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: ProfileColors.onSurfaceVariant }}>
                    {r.person.firstName}
                  </Typography>
                </Box>
              ))}
            </Box>
            <Box sx={{ width: 1, height: 28, bgcolor: `${ProfileColors.outlineVariant}35` }} />
          </>
        )}

        {/* Current person */}
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
          <Box
            sx={{
              width: 68,
              height: 68,
              borderRadius: '50%',
              overflow: 'hidden',
              border: `4px solid ${ProfileColors.primary}`,
              boxShadow: '0 4px 18px rgba(22,51,74,0.22)',
              bgcolor: ProfileColors.surfaceContainerHigh,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {avatarUrl ? (
              <Box component="img" src={avatarUrl} alt={firstName} sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.6rem', color: ProfileColors.primary, fontWeight: 700, lineHeight: 1 }}>
                {firstName?.[0]}
              </Typography>
            )}
          </Box>
          <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, color: ProfileColors.primary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {firstName}
          </Typography>
        </Box>

        {/* Children */}
        {children.length > 0 && (
          <>
            <Box sx={{ width: 1, height: 28, bgcolor: `${ProfileColors.outlineVariant}35` }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
              {children.slice(0, 3).map(r => (
                <Box key={r.id} component={Link} href={`/profile/${r.person.id}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75, textDecoration: 'none' }}>
                  <Avatar sx={{ width: 42, height: 42, bgcolor: '#d3e6e9', transition: 'transform 0.2s', '&:hover': { transform: 'scale(1.06)' } }}>
                    {r.person.firstName[0]}
                  </Avatar>
                  <Typography sx={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: ProfileColors.onSurfaceVariant }}>
                    {r.person.firstName}
                  </Typography>
                </Box>
              ))}
              {children.length > 3 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.75 }}>
                  <Avatar sx={{ width: 42, height: 42, bgcolor: ProfileColors.surfaceContainerHigh, color: ProfileColors.onSurfaceVariant, fontSize: '0.72rem', fontWeight: 700 }}>
                    +{children.length - 3}
                  </Avatar>
                  <Typography sx={{ fontSize: '0.58rem', textTransform: 'uppercase', color: ProfileColors.onSurfaceVariant }}>more</Typography>
                </Box>
              )}
            </Box>
          </>
        )}

        {parents.length === 0 && !spouse && children.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography sx={{ color: ProfileColors.onSurfaceVariant, fontSize: '0.875rem', fontFamily: 'var(--font-manrope), sans-serif' }}>
              No family connections yet.
            </Typography>
          </Box>
        )}

        <Box
          component={Link}
          href={`/family-tree?personId=${personId}`}
          sx={{ mt: 2.5, fontSize: '0.75rem', color: ProfileColors.onSurfaceVariant, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', borderBottom: `1px solid ${ProfileColors.outlineVariant}50`, pb: 0.25, '&:hover': { color: ProfileColors.primary } }}
        >
          View full family tree →
        </Box>
      </Box>
    </Box>
  )
}
