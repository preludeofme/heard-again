'use client'

import { useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Box,
  Typography,
  Button,
  Menu,
  MenuItem,
  Avatar,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
  Tooltip,
  useTheme,
} from '@mui/material'
import {
  Business as BusinessIcon,
  Check as CheckIcon,
  Add as AddIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import { useApi } from '@/hooks/useApi'
import Link from 'next/link'

interface Workspace {
  id: string
  name: string
  slug: string
  planType: string
  deploymentMode: string
  role: string
  isDefault: boolean
  counts: {
    members: number
    people: number
    stories: number
    voiceProfiles: number
  }
  createdAt: string
}

export function WorkspaceSwitcher() {
  const theme = useTheme()
  const { data: session, update } = useSession()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [isSwitching, setIsSwitching] = useState<string | null>(null)

  const { data: workspaces, isLoading, error } = useApi<Workspace[]>({ url: '/api/workspaces' })

  const currentWorkspace = workspaces?.find((w) => w.isDefault) || workspaces?.[0]

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSwitchWorkspace = useCallback(async (workspaceId: string) => {
    if (workspaceId === currentWorkspace?.id) {
      handleClose()
      return
    }

    setIsSwitching(workspaceId)

    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/switch`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to switch workspace')
      }

      // Update session to reflect new default workspace
      await update()

      // Reload page to refresh data for new workspace
      window.location.reload()
    } catch (error) {
      console.error('Failed to switch workspace:', error)
    } finally {
      setIsSwitching(null)
      handleClose()
    }
  }, [currentWorkspace?.id, update])

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'primary'
      case 'ADMIN':
        return 'success'
      case 'EDITOR':
        return 'info'
      default:
        return 'default'
    }
  }

  const getPlanLabel = (planType: string) => {
    switch (planType) {
      case 'FREE':
        return 'Free'
      case 'CONNECTED':
        return 'Connected'
      case 'HYBRID':
        return 'Hybrid'
      case 'CLOUD':
        return 'Cloud'
      default:
        return planType
    }
  }

  if (isLoading) {
    return (
      <Button
        variant="text"
        sx={{
          color: theme.palette.text.primary,
          textTransform: 'none',
          minWidth: 200,
          justifyContent: 'flex-start',
        }}
      >
        <BusinessIcon sx={{ mr: 1, color: theme.palette.primary.main }} />
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          Loading...
        </Typography>
      </Button>
    )
  }

  if (error || !workspaces || workspaces.length === 0) {
    return (
      <Button
        component={Link}
        href="/workspace/new"
        variant="contained"
        size="small"
        startIcon={<AddIcon />}
      >
        Create Workspace
      </Button>
    )
  }

  return (
    <>
      <Tooltip title="Switch workspace">
        <Button
          onClick={handleOpen}
          variant="text"
          sx={{
            color: theme.palette.text.primary,
            textTransform: 'none',
            minWidth: 200,
            justifyContent: 'flex-start',
            px: 2,
            py: 1,
            borderRadius: 2,
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.04)',
            },
          }}
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              mr: 1.5,
              bgcolor: theme.palette.primary.main,
              fontSize: '0.875rem',
              fontWeight: 600,
            }}
          >
            {currentWorkspace?.name?.[0]?.toUpperCase() || 'W'}
          </Avatar>
          <Box sx={{ textAlign: 'left', overflow: 'hidden' }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: 140,
              }}
            >
              {currentWorkspace?.name}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                color: theme.palette.text.secondary,
                display: 'block',
                whiteSpace: 'nowrap',
              }}
            >
              {getPlanLabel(currentWorkspace?.planType || 'FREE')}
            </Typography>
          </Box>
        </Button>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        PaperProps={{
          sx: {
            minWidth: 280,
            maxWidth: 360,
            mt: 1,
          },
        }}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'left', vertical: 'bottom' }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
            Your Workspaces
          </Typography>
        </Box>

        <Divider />

        {workspaces.map((workspace) => (
          <MenuItem
            key={workspace.id}
            onClick={() => handleSwitchWorkspace(workspace.id)}
            disabled={isSwitching === workspace.id}
            selected={workspace.id === currentWorkspace?.id}
            sx={{
              py: 1.5,
              px: 2,
              '&.Mui-selected': {
                backgroundColor: 'rgba(22, 51, 74, 0.08)',
              },
            }}
          >
            <ListItemIcon>
              <Avatar
                sx={{
                  width: 36,
                  height: 36,
                  bgcolor: workspace.id === currentWorkspace?.id
                    ? theme.palette.primary.main
                    : theme.palette.grey[300],
                  fontSize: '0.875rem',
                }}
              >
                {workspace.name[0]?.toUpperCase()}
              </Avatar>
            </ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: workspace.id === currentWorkspace?.id ? 600 : 400,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: 140,
                    }}
                  >
                    {workspace.name}
                  </Typography>
                  {workspace.id === currentWorkspace?.id && (
                    <CheckIcon sx={{ fontSize: 16, color: 'primary.main' }} />
                  )}
                </Box>
              }
              secondary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Chip
                    label={workspace.role}
                    size="small"
                    color={getRoleColor(workspace.role) as any}
                    sx={{
                      height: 20,
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  />
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {workspace.counts.members} members
                  </Typography>
                </Box>
              }
            />
          </MenuItem>
        ))}

        <Divider />

        <MenuItem
          component={Link}
          href="/workspace/new"
          onClick={handleClose}
          sx={{ py: 1.5 }}
        >
          <ListItemIcon>
            <AddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Create new workspace" />
        </MenuItem>

        {currentWorkspace?.role === 'OWNER' || currentWorkspace?.role === 'ADMIN' ? (
          <MenuItem
            component={Link}
            href={`/workspaces/${currentWorkspace?.id}/settings`}
            onClick={handleClose}
            sx={{ py: 1.5 }}
          >
            <ListItemIcon>
              <SettingsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Workspace settings" />
          </MenuItem>
        ) : null}
      </Menu>
    </>
  )
}
