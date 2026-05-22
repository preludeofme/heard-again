import { useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormLabel,
  Divider,
} from '@mui/material'
import {
  PersonAdd as PersonAddIcon,
  FamilyRestroom as FamilyIcon,
  Group as FriendIcon,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { fetchWithCSRF } from '@/lib/api-client'

type InviteRole = 'EDITOR' | 'VIEWER'

interface RoleOption {
  value: InviteRole
  label: string
  description: string
  icon: React.ReactNode
  capabilities: string[]
}

const ROLE_OPTIONS: RoleOption[] = [
  {
    value: 'EDITOR',
    label: 'Family Member',
    description: 'Full access to the family space',
    icon: <FamilyIcon sx={{ fontSize: 22, color: ProfileColors.primary }} />,
    capabilities: [
      'See all memories and stories',
      'Create and share stories',
      'Manage family tree',
      'View all family documents',
    ],
  },
  {
    value: 'VIEWER',
    label: 'Friend',
    description: 'Limited, view-only access',
    icon: <FriendIcon sx={{ fontSize: 22, color: ProfileColors.onSecondaryContainer }} />,
    capabilities: [
      'Create and share stories',
      'See public and friends-visible memories',
      'Cannot access private family content',
    ],
  },
]

export default function InvitePage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InviteRole>('EDITOR')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successEmail, setSuccessEmail] = useState<string | null>(null)

  if (status === 'unauthenticated') {
    router.replace('/login')
    return null
  }

  const familyspaceId = (session?.user as { defaultFamilyspaceId?: string | null } | undefined)
    ?.defaultFamilyspaceId

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) return
    if (!familyspaceId) {
      setError('No active family space found. Please create or select one first.')
      return
    }

    setIsSubmitting(true)
    setError(null)
    setSuccessEmail(null)

    try {
      const res = await fetchWithCSRF(`/api/familyspaces/${familyspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          role,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        throw new Error((data as { error?: string }).error || 'Failed to send invitation')
      }

      setSuccessEmail(email.trim())
      setEmail('')
      setMessage('')
      setRole('EDITOR')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInviteAnother = () => {
    setSuccessEmail(null)
    setError(null)
  }

  return (
    <>
      <Head>
        <title>Invite a Member | Heard Again</title>
      </Head>
      <Layout>
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: ProfileColors.surface,
            px: 3,
            py: 6,
          }}
        >
          <Box
            sx={{
              width: '100%',
              maxWidth: 560,
              bgcolor: ProfileColors.surfaceContainerLow,
              borderRadius: '2rem',
              p: { xs: 4, md: 6 },
              boxShadow: '0 8px 40px rgba(28,28,25,0.06)',
            }}
          >
            {/* Header */}
            <Box sx={{ textAlign: 'center', mb: 5 }}>
              <Box
                sx={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  bgcolor: ProfileColors.secondaryContainer,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  mx: 'auto',
                  mb: 3,
                }}
              >
                <PersonAddIcon sx={{ fontSize: 36, color: ProfileColors.primary }} />
              </Box>
              <Typography
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: '2rem',
                  fontWeight: 700,
                  color: ProfileColors.primary,
                  lineHeight: 1.1,
                }}
              >
                Invite Someone
              </Typography>
              <Typography
                sx={{
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontSize: '1rem',
                  color: ProfileColors.onSurfaceVariant,
                  mt: 1.5,
                  lineHeight: 1.6,
                }}
              >
                Share your family&apos;s stories with someone who matters.
              </Typography>
            </Box>

            {/* Success state */}
            {successEmail !== null ? (
              <Box sx={{ textAlign: 'center' }}>
                <Alert severity="success" sx={{ mb: 4, borderRadius: 2 }}>
                  Invitation sent to <strong>{successEmail}</strong>. They&apos;ll receive an email
                  with a link to join your family space.
                </Alert>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleInviteAnother}
                  sx={{
                    backgroundColor: ProfileColors.primary,
                    borderRadius: '999px',
                    py: 1.5,
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    mb: 2,
                    '&:hover': {
                      backgroundColor: ProfileColors.primaryContainer,
                      color: ProfileColors.surfaceContainerLowest,
                    },
                  }}
                >
                  Invite Another Person
                </Button>
                <Button
                  variant="text"
                  fullWidth
                  onClick={() => router.push('/')}
                  sx={{
                    color: ProfileColors.onSurfaceVariant,
                    fontFamily: 'var(--font-manrope), sans-serif',
                    textTransform: 'none',
                  }}
                >
                  Back to Home
                </Button>
              </Box>
            ) : (
              <Box component="form" onSubmit={handleSubmit}>
                {error && (
                  <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                    {error}
                  </Alert>
                )}

                {/* Email field */}
                <TextField
                  label="Email address"
                  type="email"
                  placeholder="their@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  disabled={isSubmitting}
                  sx={{ mb: 4 }}
                />

                {/* Role selector */}
                <Box sx={{ mb: 4 }}>
                  <FormLabel
                    sx={{
                      fontFamily: 'var(--font-manrope), sans-serif',
                      fontWeight: 600,
                      fontSize: '0.875rem',
                      color: ProfileColors.onSurface,
                      mb: 2,
                      display: 'block',
                    }}
                  >
                    What kind of access should they have?
                  </FormLabel>

                  <RadioGroup
                    value={role}
                    onChange={(e) => setRole(e.target.value as InviteRole)}
                  >
                    {ROLE_OPTIONS.map((option) => {
                      const isSelected = role === option.value
                      return (
                        <Box
                          key={option.value}
                          onClick={() => !isSubmitting && setRole(option.value)}
                          sx={{
                            border: '2px solid',
                            borderColor: isSelected ? ProfileColors.primary : ProfileColors.outlineVariant,
                            borderRadius: '1rem',
                            p: 2.5,
                            mb: 2,
                            cursor: isSubmitting ? 'default' : 'pointer',
                            backgroundColor: isSelected
                              ? 'rgba(22, 51, 74, 0.04)'
                              : ProfileColors.surfaceContainerLowest,
                            transition: 'border-color 0.15s, background-color 0.15s',
                            '&:hover': isSubmitting
                              ? {}
                              : {
                                  borderColor: ProfileColors.primaryContainer,
                                  backgroundColor: 'rgba(22, 51, 74, 0.02)',
                                },
                          }}
                        >
                          <FormControlLabel
                            value={option.value}
                            control={
                              <Radio
                                disabled={isSubmitting}
                                sx={{
                                  color: ProfileColors.outlineVariant,
                                  '&.Mui-checked': { color: ProfileColors.primary },
                                }}
                              />
                            }
                            label={
                              <Box sx={{ ml: 0.5 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                  {option.icon}
                                  <Typography
                                    sx={{
                                      fontFamily: 'var(--font-manrope), sans-serif',
                                      fontWeight: 700,
                                      fontSize: '0.95rem',
                                      color: ProfileColors.onSurface,
                                    }}
                                  >
                                    {option.label}
                                  </Typography>
                                </Box>
                                <Typography
                                  sx={{
                                    fontFamily: 'var(--font-manrope), sans-serif',
                                    fontSize: '0.8rem',
                                    color: ProfileColors.onSurfaceVariant,
                                    mb: 1,
                                  }}
                                >
                                  {option.description}
                                </Typography>
                                <Box component="ul" sx={{ m: 0, pl: 2 }}>
                                  {option.capabilities.map((cap) => (
                                    <Typography
                                      key={cap}
                                      component="li"
                                      sx={{
                                        fontFamily: 'var(--font-manrope), sans-serif',
                                        fontSize: '0.78rem',
                                        color: ProfileColors.onSurfaceVariant,
                                        lineHeight: 1.8,
                                      }}
                                    >
                                      {cap}
                                    </Typography>
                                  ))}
                                </Box>
                              </Box>
                            }
                            sx={{ alignItems: 'flex-start', m: 0, width: '100%' }}
                          />
                        </Box>
                      )
                    })}
                  </RadioGroup>
                </Box>

                {/* Optional message — noted for future email service support */}
                <TextField
                  label="Personal message (optional)"
                  placeholder="Add a personal note to your invitation..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  fullWidth
                  multiline
                  rows={3}
                  disabled={isSubmitting}
                  inputProps={{ maxLength: 500 }}
                  sx={{ mb: 4 }}
                />

                <Divider sx={{ mb: 4 }} />

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  disabled={isSubmitting || !email.trim() || !familyspaceId}
                  startIcon={
                    isSubmitting ? (
                      <CircularProgress size={18} color="inherit" />
                    ) : (
                      <PersonAddIcon />
                    )
                  }
                  sx={{
                    backgroundColor: ProfileColors.primary,
                    borderRadius: '999px',
                    py: 1.5,
                    fontFamily: 'var(--font-manrope), sans-serif',
                    fontWeight: 700,
                    fontSize: '1rem',
                    textTransform: 'none',
                    '&:hover': {
                      backgroundColor: ProfileColors.primaryContainer,
                      color: ProfileColors.surfaceContainerLowest,
                    },
                  }}
                >
                  {isSubmitting ? 'Sending Invitation...' : 'Send Invitation'}
                </Button>

                <Button
                  variant="text"
                  fullWidth
                  onClick={() => router.push('/')}
                  disabled={isSubmitting}
                  sx={{
                    mt: 2,
                    color: ProfileColors.onSurfaceVariant,
                    fontFamily: 'var(--font-manrope), sans-serif',
                    textTransform: 'none',
                  }}
                >
                  Cancel
                </Button>
              </Box>
            )}
          </Box>
        </Box>
      </Layout>
    </>
  )
}

export async function getServerSideProps() {
  return { props: {} }
}
