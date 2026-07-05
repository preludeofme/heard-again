
import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemAvatar,
  Avatar,
  ListItemText,
  ListItemIcon,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Chip,
  Divider,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material'
import {
  MoreVert as MoreVertIcon,
  PersonAdd as PersonAddIcon,
  Delete as DeleteIcon,
  AdminPanelSettings as AdminIcon,
  Edit as EditIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import { useApi } from '@/hooks/useApi'

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

interface MemberManagementModalProps {
  familyspaceId: string
  open: boolean
  onClose: () => void
  canManageMembers: boolean
}

const roleLabels: Record<string, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  EDITOR: 'Editor',
  VIEWER: 'Viewer',
  LEGACY: 'Legacy',
}

const roleHierarchy = ['OWNER', 'ADMIN', 'EDITOR', 'VIEWER', 'LEGACY']

export function MemberManagementModal({
  familyspaceId,
  open,
  onClose,
  canManageMembers,
}: MemberManagementModalProps) {
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'VIEWER'>('VIEWER')
  const [isInviting, setIsInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null)
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null)
  const [selectedMember, setSelectedMember] = useState<Member | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const { data: members, isLoading, error, refresh } = useApi<Member[]>({
    url: open ? `/api/familyspaces/${familyspaceId}/members` : '',
  })

  const handleOpenMenu = (event: React.MouseEvent<HTMLElement>, member: Member) => {
    setMenuAnchorEl(event.currentTarget)
    setSelectedMember(member)
  }

  const handleCloseMenu = () => {
    setMenuAnchorEl(null)
    setSelectedMember(null)
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return

    setIsInviting(true)
    setInviteError(null)
    setInviteSuccess(null)

    try {
      const response = await fetch(`/api/familyspaces/${familyspaceId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send invite')
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      refresh()
    } catch (err: any) {
      setInviteError(err.message || 'Failed to send invite')
    } finally {
      setIsInviting(false)
    }
  }

  const handleUpdateRole = async (newRole: string) => {
    if (!selectedMember) return

    setIsUpdating(true)
    handleCloseMenu()

    try {
      const response = await fetch(
        `/api/familyspaces/${familyspaceId}/members/${selectedMember.userId}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ role: newRole }),
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to update role')
      }

      refresh()
    } catch (err: any) {
      console.error('Failed to update role:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedMember) return

    setIsUpdating(true)
    handleCloseMenu()

    try {
      const response = await fetch(
        `/api/familyspaces/${familyspaceId}/members/${selectedMember.userId}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to remove member')
      }

      refresh()
    } catch (err: any) {
      console.error('Failed to remove member:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const getAvailableRoles = (currentRole: string) => {
    const currentIndex = roleHierarchy.indexOf(currentRole)
    return roleHierarchy.slice(currentIndex + 1)
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="member-management-dialog-title">
      <DialogTitle id="member-management-dialog-title" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Familyspace Members
        </Typography>
        <IconButton onClick={onClose} size="small" aria-label="Close dialog">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {/* Invite Section */}
        {canManageMembers && (
          <Box sx={{ mb: 4 }}>
            <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
              Invite New Member
            </Typography>

            {inviteError && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {inviteError}
              </Alert>
            )}

            {inviteSuccess && (
              <Alert severity="success" sx={{ mb: 2 }}>
                {inviteSuccess}
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Enter email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                disabled={isInviting}
              />
              <TextField
                select
                size="small"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'EDITOR' | 'VIEWER')}
                SelectProps={{ native: true }}
                sx={{ minWidth: 120 }}
                disabled={isInviting}
              >
                <option value="EDITOR">Editor</option>
                <option value="VIEWER">Viewer</option>
              </TextField>
              <Button
                variant="contained"
                onClick={handleInvite}
                disabled={isInviting || !inviteEmail.trim()}
                startIcon={isInviting ? <CircularProgress size={16} /> : <PersonAddIcon />}
              >
                Invite
              </Button>
            </Box>

            <Divider sx={{ my: 3 }} />
          </Box>
        )}

        {/* Members List */}
        <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
          Current Members ({members?.length || 0})
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">Failed to load members</Alert>
        ) : (
          <List sx={{ p: 0 }}>
            {members?.map((member) => (
              <ListItem
                key={member.id}
                sx={{
                  px: 0,
                  py: 1.5,
                  borderBottom: '1px solid',
                  borderColor: 'divider',
                  '&:last-child': { borderBottom: 'none' },
                }}
                secondaryAction={
                  canManageMembers && member.role !== 'OWNER' ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Chip
                        label={roleLabels[member.role]}
                        size="small"
                        color={member.role === 'ADMIN' ? 'primary' : 'default'}
                      />
                      <Tooltip title="Manage member">
                        <IconButton
                          edge="end"
                          onClick={(e) => handleOpenMenu(e, member)}
                          disabled={isUpdating}
                        >
                          <MoreVertIcon />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  ) : (
                    <Chip
                      label={roleLabels[member.role]}
                      size="small"
                      color={member.role === 'OWNER' ? 'primary' : 'default'}
                    />
                  )
                }
              >
                <ListItemAvatar>
                  <Avatar src={member.avatarUrl || undefined}>
                    {member.displayName?.[0] || member.email[0]}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {member.displayName || member.email}
                    </Typography>
                  }
                  secondary={
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {member.email}
                      {member.lastLoginAt && (
                        <span> • Last active {new Date(member.lastLoginAt).toLocaleDateString()}</span>
                      )}
                    </Typography>
                  }
                />
              </ListItem>
            ))}
          </List>
        )}

        {/* Member Actions Menu */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleCloseMenu}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        >
          {selectedMember ? [
            <Typography key="role-header" variant="caption" sx={{ px: 2, py: 1, display: 'block', color: 'text.secondary' }}>
              Change Role
            </Typography>,
            ...getAvailableRoles(selectedMember.role).map((role) => (
              <MenuItem
                key={role}
                onClick={() => handleUpdateRole(role)}
                disabled={isUpdating}
              >
                <ListItemIcon>
                  <AdminIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText primary={roleLabels[role]} />
              </MenuItem>
            )),
            <Divider key="divider" />,
            <MenuItem key="remove" onClick={handleRemoveMember} disabled={isUpdating} sx={{ color: 'error.main' }}>
              <ListItemIcon>
                <DeleteIcon fontSize="small" color="error" />
              </ListItemIcon>
              <ListItemText primary="Remove from familyspace" />
            </MenuItem>
          ] : null}
        </Menu>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}
