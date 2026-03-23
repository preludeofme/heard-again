import { useState } from 'react'
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
} from '@mui/material'
import {
  Business as BusinessIcon,
  People as PeopleIcon,
  Storage as StorageIcon,
  Delete as DeleteIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { useApi } from '@/hooks/useApi'
import { Layout } from '@/components/Layout'

interface WorkspaceDetails {
  id: string
  name: string
  slug: string
  planType: string
  deploymentMode: string
  tunnelEnabled: boolean
  cloudGpuEnabled: boolean
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

export default function WorkspaceSettingsPage() {
  const router = useRouter()
  const { id } = router.query
  const { data: session } = useSession()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const { data: workspace, isLoading, refresh } = useApi<WorkspaceDetails>({
    url: id ? `/api/workspaces/${id}` : '',
  })

  const isOwner = workspace?.owner.id === session?.user?.id
  const isAdmin = isOwner // Simplified - would check role in real implementation

  const handleEdit = () => {
    setEditName(workspace?.name || '')
    setIsEditing(true)
    setError(null)
    setSuccess(null)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditName('')
    setError(null)
  }

  const handleSave = async () => {
    if (!editName.trim() || editName === workspace?.name) {
      setIsEditing(false)
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update workspace')
      }

      setSuccess('Workspace name updated successfully')
      setIsEditing(false)
      refresh()
    } catch (err: any) {
      setError(err.message || 'Failed to update workspace')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/workspaces/${id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete workspace')
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Failed to delete workspace')
      setShowDeleteDialog(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'FREE':
        return 'default'
      case 'CONNECTED':
        return 'info'
      case 'HYBRID':
        return 'warning'
      case 'CLOUD':
        return 'success'
      default:
        return 'default'
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

  if (!workspace) {
    return (
      <Layout>
        <Box sx={{ p: 4 }}>
          <Alert severity="error">Workspace not found</Alert>
        </Box>
      </Layout>
    )
  }

  return (
    <Layout>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 800 }}>
        <Typography
          variant="h4"
          sx={{
            mb: 4,
            fontFamily: 'var(--font-newsreader), serif',
            color: 'primary.main',
          }}
        >
          Workspace Settings
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        {/* General Settings */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              General Information
            </Typography>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    Workspace Name
                  </Typography>
                  {isEditing ? (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField
                        fullWidth
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        size="small"
                        autoFocus
                      />
                      <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={isSaving}
                        size="small"
                      >
                        {isSaving ? <CircularProgress size={20} /> : 'Save'}
                      </Button>
                      <Button variant="outlined" onClick={handleCancel} size="small">
                        Cancel
                      </Button>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Typography variant="body1" sx={{ fontWeight: 500 }}>
                        {workspace.name}
                      </Typography>
                      {isAdmin && (
                        <Button variant="text" size="small" onClick={handleEdit}>
                          Edit
                        </Button>
                      )}
                    </Box>
                  )}
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    Slug
                  </Typography>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'grey.100', p: 1, borderRadius: 1 }}>
                    {workspace.slug}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    Plan Type
                  </Typography>
                  <Chip
                    label={workspace.planType}
                    color={getPlanColor(workspace.planType) as any}
                    size="small"
                  />
                </Box>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    Owner
                  </Typography>
                  <Typography variant="body2">
                    {workspace.owner.displayName || workspace.owner.email}
                  </Typography>
                </Box>

                <Box sx={{ mb: 3 }}>
                  <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {new Date(workspace.createdAt).toLocaleDateString()}
                  </Typography>
                </Box>

                {workspace.subscription && (
                  <Box>
                    <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
                      Subscription
                    </Typography>
                    <Typography variant="body2">
                      {workspace.subscription.planName}
                      {workspace.subscription.renewalDate && (
                        <span> (Renews: {new Date(workspace.subscription.renewalDate).toLocaleDateString()})</span>
                      )}
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card sx={{ mb: 3, borderRadius: 3 }}>
          <CardContent sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
              Workspace Statistics
            </Typography>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(208, 227, 230, 0.2)', borderRadius: 2 }}>
                  <PeopleIcon sx={{ color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {workspace.counts.members}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Members
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 6, sm: 4 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(208, 227, 230, 0.2)', borderRadius: 2 }}>
                  <BusinessIcon sx={{ color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {workspace.counts.people}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    People
                  </Typography>
                </Box>
              </Grid>

              <Grid size={{ xs: 6, sm: 4 }}>
                <Box sx={{ textAlign: 'center', p: 2, bgcolor: 'rgba(208, 227, 230, 0.2)', borderRadius: 2 }}>
                  <StorageIcon sx={{ color: 'primary.main', mb: 1 }} />
                  <Typography variant="h4" sx={{ fontWeight: 600, color: 'primary.main' }}>
                    {workspace.counts.stories}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    Stories
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <List sx={{ mt: 2 }}>
              <ListItem>
                <ListItemIcon>
                  <StorageIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Assets"
                  secondary={`${workspace.counts.assets} files stored`}
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <PeopleIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Voice Profiles"
                  secondary={`${workspace.counts.voiceProfiles} profiles created`}
                />
              </ListItem>
            </List>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        {isOwner && (
          <Card sx={{ borderRadius: 3, borderColor: 'error.main', border: 1 }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600, color: 'error.main' }}>
                Danger Zone
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    Delete Workspace
                  </Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                    This will permanently delete all data in this workspace
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setShowDeleteDialog(true)}
                >
                  Delete
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onClose={() => setShowDeleteDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ color: 'error.main' }}>
            <WarningIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
            Delete Workspace?
          </DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 2 }}>
              This action cannot be undone. All data including stories, people, voice profiles, and assets will be permanently deleted.
            </Alert>
            <Typography variant="body2">
              Are you sure you want to delete <strong>{workspace.name}</strong>?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
            <Button
              onClick={handleDelete}
              color="error"
              variant="contained"
              disabled={isDeleting}
            >
              {isDeleting ? <CircularProgress size={20} /> : 'Delete Workspace'}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Layout>
  )
}
