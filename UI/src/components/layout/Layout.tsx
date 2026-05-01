import { ReactNode, useState } from 'react'
import React from 'react'
import { useRouter } from 'next/router'
import { useSession, signOut } from 'next-auth/react'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Button,
  Menu,
  MenuItem,
  Divider,
  BottomNavigation,
  BottomNavigationAction,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Logout as LogoutIcon,
  Home as HomeIcon,
  Add as AddIcon,
  AccountTree as FamilyTreeIcon,
  Favorite as FavoriteIcon,
  MoreHoriz as MoreIcon,
  Settings as SettingsIcon,
  Description as DocumentsIcon,
  AutoStories as StoriesIcon,
  PersonAdd as PersonAddIcon,
  PostAdd as PostAddIcon,
  CloudUpload as UploadIcon,
  Close as CloseIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { ActiveMemberHeader } from './ActiveMemberHeader'
import { ProfileColors } from '@/components/profile/ProfileConstants'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { label: 'Story', href: '/archive' },
  { label: 'Contribute', href: '/contribute' },
  { label: 'Family', href: '/family-tree' },
]

const bottomNavRoutes = ['/archive', '/contribute', '/family-tree', '/favorites', 'more']
const moreMenuRoutes = [
  { label: 'Voice Memories', href: '/archive?lens=voices', icon: <StoriesIcon /> },
  { label: 'Keepsakes', href: '/archive?lens=keepsakes', icon: <DocumentsIcon /> },
  { label: 'Account', href: '/account', icon: <SettingsIcon /> },
]

function UserMenu() {
  const { data: session, status } = useSession()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const router = useRouter()

  const handleClick = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleClose = () => setAnchorEl(null)
  const handleSignOut = async () => {
    handleClose()
    await signOut({ redirect: false })
    router.push('/')
  }

  if (status === 'loading') return <Avatar sx={{ width: 32, height: 32 }} />

  if (!session?.user) {
    return (
      <Button component={Link} href="/login" variant="contained" size="small" sx={{ ml: 1 }}>
        Sign In
      </Button>
    )
  }

  return (
    <>
      <IconButton size="small" onClick={handleClick} aria-label="Open user menu" sx={{ ml: 1 }}>
        <Avatar sx={{ width: 32, height: 32 }} src={session.user.avatarUrl || undefined}>
          {session.user.displayName?.[0] || session.user.email?.[0]}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{ sx: { borderRadius: 3, minWidth: 200 } }}
      >
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: ProfileColors.primary }}>
            {session.user.displayName || session.user.email}
          </Typography>
        </MenuItem>
        <Divider />
        <MenuItem component={Link} href="/account" onClick={handleClose}>
          <SettingsIcon sx={{ mr: 1.5, fontSize: 18, color: ProfileColors.onSurfaceVariant }} />
          <Typography variant="body2">Account</Typography>
        </MenuItem>
        <MenuItem component={Link} href="/support" onClick={handleClose}>
          <Typography variant="body2" sx={{ ml: 4 }}>Support</Typography>
        </MenuItem>
        <MenuItem component={Link} href="/privacy" onClick={handleClose}>
          <Typography variant="body2" sx={{ ml: 4 }}>Privacy Settings</Typography>
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleSignOut}>
          <LogoutIcon sx={{ mr: 1.5, fontSize: 18, color: ProfileColors.onSurfaceVariant }} />
          <Typography variant="body2">Sign Out</Typography>
        </MenuItem>
      </Menu>
    </>
  )
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null)
  const [speedDialOpen, setSpeedDialOpen] = useState(false)

  const currentPath = router.pathname
  const currentLens = typeof router.query.lens === 'string' ? router.query.lens : null

  const handleMoreOpen = (event: React.MouseEvent<HTMLElement>) => setMoreMenuAnchor(event.currentTarget)
  const handleMoreClose = () => setMoreMenuAnchor(null)
  const handleMoreNavigate = (path: string) => { handleMoreClose(); router.push(path) }

  const handleAction = (action: string) => {
    setSpeedDialOpen(false)
    if (action === 'story') router.push('/contribute')
    else if (action === 'document') router.push('/archive?lens=keepsakes')
    else if (action === 'person') router.push('/family-tree?add=1')
  }

  const getMobileNavValue = () => {
    const fullPath = currentLens ? `${currentPath}?lens=${currentLens}` : currentPath
    const exactIdx = bottomNavRoutes.indexOf(fullPath)
    if (exactIdx >= 0) return exactIdx
    const baseIdx = bottomNavRoutes.indexOf(currentPath)
    if (baseIdx >= 0) return baseIdx
    const prefixIdx = bottomNavRoutes.findIndex((r) => currentPath.startsWith(r + '/'))
    if (prefixIdx >= 0) return prefixIdx
    const isInMore = moreMenuRoutes.some((r) => {
      const [hrefPath] = r.href.split('?')
      return currentPath === hrefPath || currentPath.startsWith(hrefPath + '/')
    })
    if (isInMore) return 4
    return false
  }

  const isNavActive = (href: string) => {
    const [itemPath] = href.split('?')
    if (itemPath === '/archive') {
      return currentPath === '/archive' || currentPath === '/'
    }
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
  }

  return (
    <>
      {/* Top navigation bar — desktop and mobile */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: ProfileColors.surfaceContainerLow,
          color: ProfileColors.primary,
          borderBottom: `1px solid ${ProfileColors.outlineVariant}26`,
          zIndex: theme.zIndex.appBar,
        }}
      >
        <Toolbar
          sx={{
            minHeight: { xs: 56, md: 64 },
            px: { xs: 2, md: 4 },
            gap: 1,
          }}
        >
          {/* Brand */}
          <Typography
            component={Link}
            href="/archive"
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              fontSize: { xs: '1.3rem', md: '1.5rem' },
              fontWeight: 700,
              color: ProfileColors.primary,
              textDecoration: 'none',
              letterSpacing: '-0.01em',
              flexShrink: 0,
              mr: { md: 2 },
            }}
          >
            Heard Again
          </Typography>

          {/* Desktop nav links */}
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              {navItems.map((item) => {
                const active = isNavActive(item.href)
                return (
                  <Typography
                    key={item.href}
                    component={Link}
                    href={item.href}
                    sx={{
                      fontFamily: 'var(--font-manrope), sans-serif',
                      fontSize: '0.95rem',
                      fontWeight: active ? 600 : 400,
                      color: active ? ProfileColors.primary : ProfileColors.onSurfaceVariant,
                      textDecoration: 'none',
                      px: 2,
                      py: 1,
                      borderRadius: '999px',
                      backgroundColor: active ? ProfileColors.surfaceContainerLowest : 'transparent',
                      boxShadow: active ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: active
                          ? ProfileColors.surfaceContainerLowest
                          : ProfileColors.surfaceContainer,
                        color: ProfileColors.primary,
                      },
                    }}
                  >
                    {item.label}
                  </Typography>
                )
              })}
            </Box>
          )}

          <Box sx={{ flexGrow: 1 }} />

          {/* Active family member pill */}
          <ActiveMemberHeader compact />

          {/* User account menu */}
          <UserMenu />
        </Toolbar>
      </AppBar>

      {/* Main content — full width, no sidebar offset */}
      <Box
        component="main"
        sx={{
          backgroundColor: ProfileColors.surface,
          minHeight: 'calc(100vh - 64px)',
          pb: isMobile ? 9 : 0,
        }}
      >
        {children}
      </Box>

      {/* Mobile only: creation FAB + bottom navigation */}
      {isMobile && (
        <>
          <SpeedDial
            ariaLabel="Creation SpeedDial"
            sx={{ position: 'fixed', bottom: 72, right: 16 }}
            icon={<SpeedDialIcon icon={<AddIcon />} openIcon={<CloseIcon />} />}
            onClose={() => setSpeedDialOpen(false)}
            onOpen={() => setSpeedDialOpen(true)}
            open={speedDialOpen}
            FabProps={{
              sx: {
                bgcolor: '#16334a',
                '&:hover': { bgcolor: '#2e4a62' },
              },
            }}
          >
            <SpeedDialAction
              icon={<PostAddIcon />}
              tooltipTitle="Add Story"
              onClick={() => handleAction('story')}
            />
            <SpeedDialAction
              icon={<UploadIcon />}
              tooltipTitle="Upload Artifact"
              onClick={() => handleAction('document')}
            />
            <SpeedDialAction
              icon={<PersonAddIcon />}
              tooltipTitle="Add Person"
              onClick={() => handleAction('person')}
            />
          </SpeedDial>

          <BottomNavigation
            showLabels
            value={getMobileNavValue()}
            onChange={(_, newValue: number) => {
              const target = bottomNavRoutes[newValue]
              if (target === 'more') return
              router.push(target)
            }}
            sx={{
              position: 'fixed',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: theme.zIndex.appBar,
              backgroundColor: '#f6f3ee',
              borderTop: '1px solid rgba(22,51,74,0.08)',
              boxShadow: '0 -1px 8px rgba(22,51,74,0.06)',
              '& .MuiBottomNavigationAction-root': {
                minWidth: 'auto',
                padding: '8px',
                minHeight: '56px',
                '& .MuiSvgIcon-root': { fontSize: 28 },
              },
            }}
          >
            <BottomNavigationAction label="Story" icon={<HomeIcon />} />
            <BottomNavigationAction label="Contribute" icon={<AddIcon />} />
            <BottomNavigationAction label="Family" icon={<FamilyTreeIcon />} />
            <BottomNavigationAction label="Favorites" icon={<FavoriteIcon />} />
            <BottomNavigationAction label="More" icon={<MoreIcon />} onClick={handleMoreOpen} />
          </BottomNavigation>

          <Menu
            anchorEl={moreMenuAnchor}
            open={Boolean(moreMenuAnchor)}
            onClose={handleMoreClose}
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            transformOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            PaperProps={{
              sx: {
                width: 200,
                borderRadius: 3,
                boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
                mb: 1,
              },
            }}
          >
            {moreMenuRoutes.map((route) => {
              const [hrefPath] = route.href.split('?')
              const isMoreActive =
                currentPath === hrefPath || currentPath.startsWith(hrefPath + '/')
              return (
                <MenuItem
                  key={route.href}
                  onClick={() => handleMoreNavigate(route.href)}
                  sx={{
                    py: 1.5,
                    gap: 2,
                    color: isMoreActive ? '#16334a' : 'inherit',
                    fontWeight: isMoreActive ? 600 : 400,
                  }}
                >
                  {route.icon}
                  <Typography variant="body2">{route.label}</Typography>
                </MenuItem>
              )
            })}
          </Menu>
        </>
      )}
    </>
  )
}
