import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/router'
import { useSession } from 'next-auth/react'
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Divider,
  Alert,
  Chip,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tabs,
  Tab,
  Switch,
  FormControlLabel,
  Avatar,
  ListItemAvatar,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from '@mui/material'
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Download as DownloadIcon,
  Share as ShareIcon,
  Security as SecurityIcon,
} from '@mui/icons-material'
import { useApi } from '@/hooks/useApi'
import { Layout } from '@/components/layout/Layout'
import { getCSRFToken } from '@/lib/api-client'

interface Member {
  id: string
  userId: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER' | 'LEGACY'
  joinedAt: string
  lastLoginAt: string | null
}

interface FamilyspaceDetails {
  id: string
  name: string
  slug: string
  planType: string
  deploymentMode: string
  isPublic: boolean
  allowMemberStories: boolean
  deletionVotes: Record<string, boolean>
  owner: {
    id: string
    email: string
    displayName: string | null
    avatarUrl: string | null
  }
  subscription: {
    planName: string
    billingStatus: string
    renewalDate: string | null
  } | null
  counts: {
    members: number
    people: number
    stories: number
    voiceProfiles: number
    assets: number
  }
  createdAt: string
}

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
  LEGACY: 'Legacy',
}

const roleHierarchy = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'LEGACY']

const TAB_NAMES = ['overview', 'members', 'settings', 'data'] as const
type TabName = (typeof TAB_NAMES)[number]

function tabNameToIndex(name: string | undefined | null): number {
  if (!name) return 0
  const idx = TAB_NAMES.indexOf(name as TabName)
  return idx >= 0 ? idx : 0
}

export default function FamilyspaceSettingsPage() {
  const router = useRouter()
  const { id, tab: tabParam } = router.query
  const { data: session } = useSession()
  const [tabValue, setTabValue] = useState(() => tabNameToIndex(tabParam as string | undefined))
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Member Management State
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER')
  const [isInviting, setIsInviting] = useState(false)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  // Export state
  const [isExporting, setIsExporting] = useState(false)

  const { data: familyspace, isLoading, refresh } = useApi<FamilyspaceDetails>({
    url: (id && id !== 'undefined') ? `/api/familyspaces/${id}` : '',
  })

  const { data: members, isLoading: loadingMembers, refresh: refreshMembers } = useApi<Member[]>({
    url: (id && id !== 'undefined') && tabValue === 1 ? `/api/familyspaces/${id}/members` : '',
  })

  const isOwner = familyspace?.owner.id === session?.user?.id
  const isAdmin = isOwner || members?.find(m => m.userId === session?.user?.id)?.role === 'ADMIN'

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
    // Sync tab to URL query parameter
    const tabName = TAB_NAMES[newValue]
    if (tabName) {
      router.replace(
        { pathname: router.pathname, query: { ...router.query, tab: tabName } },
        undefined,
        { shallow: true }
      )
    }
  }

  // Sync tab from URL when query param changes (back/forward navigation)
  useEffect(() => {
    if (router.isReady) {
      const idx = tabNameToIndex(tabParam as string | undefined)
      if (idx !== tabValue) setTabValue(idx)
    }
  }, [tabParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleEdit = () => {
    setEditName(familyspace?.name || '')
    setIsEditing(true)
    setError(null)
    setSuccess(null)
  }

  const handleSave = async (dataOverride?: any) => {
    if (!id || id === 'undefined') return
    setIsSaving(true)
    setError(null)

    try {
      const token = await getCSRFToken()
      const response = await fetch(`/api/familyspaces/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': token
        },
        credentials: 'include',
        body: JSON.stringify(dataOverride || { name: editName.trim() }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update familyspace')
      }

      setSuccess('Familyspace updated successfully')
      setIsEditing(false)
      refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update familyspace')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!id || id === 'undefined') return
    setIsDeleting(true)
    setError(null)

    try {
      const token = await getCSRFToken()
      const response = await fetch(`/api/familyspaces/${id}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': token
        },
        credentials: 'include',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to process deletion')
      }

      if (result.deleted) {
        router.push('/legacy')
      } else {
        setSuccess(`Deletion vote recorded. ${result.votesReceived} of ${result.votesNeeded} members have voted.`)
        setShowDeleteDialog(false)
        refresh()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to process deletion')
    } finally {
      setIsDeleting(false)
    }
  }

  // Member Management Handlers
  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, member: Member) => {
    setMenuAnchorEl(event.currentTarget)
    setSelectedMember(member)
  }

  const handleCloseMenu = () => {
    setMenuAnchorEl(null)
    setSelectedMember(null)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !id || id === 'undefined') return
    setIsInviting(true)
    try {
      const token = await getCSRFToken()
      const response = await fetch(`/api/familyspaces/${id}/invite`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': token
        },
        credentials: 'include',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      if (!response.ok) throw new Error('Failed to send invite')
      setSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      refreshMembers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsInviting(false)
    }
  }

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedMember) return
    setIsUpdating(true)
    try {
      const token = await getCSRFToken()
      const response = await fetch(`/api/familyspaces/${id}/members/${selectedMember.userId}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'x-csrf-token': token
        },
        credentials: 'include',
        body: JSON.stringify({ role: newRole }),
      })
      if (!response.ok) throw new Error('Failed to update role')
      refreshMembers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUpdating(false)
      handleCloseMenu()
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedMember) return
    setIsUpdating(true)
    try {
      const token = await getCSRFToken()
      const response = await fetch(`/api/familyspaces/${id}/members/${selectedMember.userId}`, {
        method: 'DELETE',
        headers: {
          'x-csrf-token': token
        },
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to remove member')
      refreshMembers()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsUpdating(false)
      handleCloseMenu()
    }
  }

  const handleExportData = async () => {
    if (!id || id === 'undefined') return
    setIsExporting(true)
    try {
      const response = await fetch(`/api/familyspaces/${id}/export`, {
        method: 'GET',
        credentials: 'include',
      })
      if (!response.ok) throw new Error('Failed to export data')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${familyspace?.slug || 'familyspace'}-export-${new Date().toISOString().split('T')[0]}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setSuccess('Data export package downloaded successfully')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsExporting(false)
    }
  }

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'FREE': return 'default'
      case 'CONNECTED': return 'info'
      case 'HYBRID': return 'warning'
      case 'CLOUD': return 'success'
      default: return 'default'
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (!familyspace) {
    return (
      <Layout>
        <Box sx={{ p: 4 }}>
          <Alert severity="error">Familyspace not found</Alert>
        </Box>
      </Layout>
    )
  }

  const voteCount = Object.keys(familyspace.deletionVotes || {}).length
  const totalNeeded = members?.length || familyspace.counts.members

  return (
    <Layout>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" sx={{ fontFamily: 'var(--font-newsreader), serif', color: 'primary.main' }}>
            Familyspace Administration
          </Typography>
          <Chip label={familyspace.planType} color={getPlanColor(familyspace.planType) as any} />
        </Box>

        {error && <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>{success}</Alert>}

        <Tabs 
          value={tabValue} 
          onChange={handleTabChange} 
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ mb: 4, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Overview" icon={<BusinessIcon />} iconPosition="start" />
          <Tab label="Members" icon={<PeopleIcon />} iconPosition="start" />
          <Tab label="Settings" icon={<SettingsIcon />} iconPosition="start" />
          <Tab label="Data" icon={<StorageIcon />} iconPosition="start" />
        </Tabs>

        {/* TAB 0: OVERVIEW */}
        {tabValue === 0 && (
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 7 }}>
              <Card sx={{ mb: 3, borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>General Information</Typography>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>Familyspace Name</Typography>
                    {isEditing ? (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField fullWidth value={editName} onChange={(e) => setEditName(e.target.value)} size="small" autoFocus />
                        <Button variant="contained" onClick={() => handleSave()} disabled={isSaving} size="small">Save</Button>
                        <Button variant="outlined" onClick={() => setIsEditing(false)} size="small">Cancel</Button>
                      </Box>
                    ) : (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Typography variant="body1" sx={{ fontWeight: 500 }}>{familyspace.name}</Typography>
                        {isAdmin && <IconButton size="small" onClick={handleEdit}><AdminIcon fontSize="small" /></IconButton>}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>Access Slug</Typography>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>{familyspace.slug}</Typography>
                  </Box>
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>Owner</Typography>
                    <Typography variant="body2">{familyspace.owner.displayName || familyspace.owner.email}</Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid size={{ xs: 12, md: 5 }}>
              <Card sx={{ borderRadius: 3 }}>
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>Stats</Typography>
                  <List>
                    <ListItem divider><ListItemText primary="Members" secondary={familyspace.counts.members} /></ListItem>
                    <ListItem divider><ListItemText primary="Family Members (People)" secondary={familyspace.counts.people} /></ListItem>
                    <ListItem divider><ListItemText primary="Stories" secondary={familyspace.counts.stories} /></ListItem>
                    <ListItem><ListItemText primary="Storage Usage" secondary={`${familyspace.counts.assets} files`} /></ListItem>
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* TAB 1: MEMBERS */}
        {tabValue === 1 && (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              {isAdmin && (
                <Box sx={{ mb: 4, p: 3, bgcolor: 'rgba(22, 51, 74, 0.04)', borderRadius: 2, border: '1px solid rgba(22, 51, 74, 0.08)' }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: '#16334a' }}>Invite Relative</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField fullWidth size="small" placeholder="Email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} sx={{ bgcolor: 'background.paper' }} />
                    <TextField select size="small" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as any)} SelectProps={{ native: true }} sx={{ minWidth: 100, bgcolor: 'background.paper' }}>
                      <option value="EDITOR">Editor</option>
                      <option value="VIEWER">Viewer</option>
                    </TextField>
                    <Button variant="contained" onClick={handleInvite} disabled={isInviting || !inviteEmail} startIcon={<PersonAddIcon />} sx={{ bgcolor: '#16334a' }}>Invite</Button>
                  </Box>
                </Box>
              )}

              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Active Members</Typography>
              {loadingMembers ? <CircularProgress /> : (
                <List>
                  {members?.map(member => (
                    <ListItem key={member.id} secondaryAction={
                      isAdmin && member.role !== 'OWNER' && (
                        <IconButton onClick={(e) => handleOpenMenu(e, member)}><MoreVertIcon /></IconButton>
                      )
                    }>
                      <ListItemAvatar>
                        <Avatar src={member.avatarUrl || undefined}>{member.displayName?.[0] || member.email[0]}</Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={member.displayName || member.email} secondary={roleLabels[member.role]} />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        )}

        {/* TAB 2: SETTINGS */}
        {tabValue === 2 && (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>Privacy & Access</Typography>
              <List>
                <ListItem>
                  <ListItemText primary="Public Access" secondary="Allow anyone with the link to view public stories (no account required)" />
                  <Switch checked={familyspace.isPublic} onChange={(e) => handleSave({ isPublic: e.target.checked })} disabled={!isAdmin} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="Member Story Contributions" secondary="Allow non-admin members to add new stories" />
                  <Switch checked={familyspace.allowMemberStories} onChange={(e) => handleSave({ allowMemberStories: e.target.checked })} disabled={!isAdmin} />
                </ListItem>
              </List>

              <Box sx={{ mt: 4 }}>
                <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, color: 'error.main' }}>Danger Zone</Typography>
                <Card variant="outlined" sx={{ borderColor: 'error.light' }}>
                  <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Delete Familyspace</Typography>
                      <Typography variant="body2" color="text.secondary">Requires approval from ALL active members.</Typography>
                    </Box>
                    <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => setShowDeleteDialog(true)}>
                      {voteCount > 0 ? `Delete (${voteCount}/${totalNeeded})` : 'Start Deletion'}
                    </Button>
                  </CardContent>
                </Card>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* TAB 3: DATA */}
        {tabValue === 3 && (
          <Card sx={{ borderRadius: 3 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>Data Portability</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Download a complete copy of your familyspace data, including all family members, stories, metadata, and links to assets.
                Files are exported in a standardized JSON format.
              </Typography>
              <Button variant="contained" startIcon={isExporting ? <CircularProgress size={20} /> : <DownloadIcon />} onClick={handleExportData} disabled={isExporting || !isAdmin}>
                Export Full Data Package
              </Button>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>Compliance & Legal</Typography>
              <Alert severity="info" icon={<SecurityIcon />}>
                Heard Again follows a strict non-commercial data policy. Your family memories are yours alone and will never be sold or used for marketing.
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* Member Action Menu */}
        <Menu anchorEl={menuAnchorEl} open={Boolean(menuAnchorEl)} onClose={handleCloseMenu}>
          {selectedMember && (
            <Box>
              <Typography variant="caption" sx={{ px: 2, py: 1, display: 'block' }}>Change Role</Typography>
              {roleHierarchy.slice(1).map(role => (
                <MenuItem key={role} onClick={() => handleUpdateRole(role)} selected={selectedMember.role === role}>{roleLabels[role]}</MenuItem>
              ))}
              <Divider />
              <MenuItem onClick={handleRemoveMember} sx={{ color: 'error.main' }}>Remove Member</MenuItem>
            </Box>
          )}
        </Menu>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Delete Familyspace?</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>This is PERMANENT. Deletion only occurs if ALL members vote YES.</Alert>
            <Typography variant="body1">By voting for deletion, you agree to remove all stories, people, and media for <strong>{familyspace.name}</strong>.</Typography>
            {voteCount > 0 && <Typography variant="body2" sx={{ mt: 2, fontWeight: 600 }}>Progress: {voteCount} of {totalNeeded} votes received.</Typography>}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button onClick={handleDelete} variant="contained" color="error" disabled={isDeleting}>
              {familyspace.deletionVotes?.[session?.user?.id as string] ? 'Vote Recorded' : 'Cast Deletion Vote'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  )
}

export async function getServerSideProps() { return { props: {} } }
