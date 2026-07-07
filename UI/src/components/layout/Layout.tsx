import { ReactNode, useState, useEffect } from 'react'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
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
  LockOutlined as LockIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { ActiveMemberHeader } from './ActiveMemberHeader'
import { FamilyspaceSwitcher } from './FamilyspaceSwitcher'
import { ProfileColors } from '@/components/profile/ProfileConstants'
import { useSelectedFamilyMember } from '@/contexts/SelectedFamilyMemberContext'
import { AnimatedWaveform } from '../brand/AnimatedWaveform'

interface LayoutProps {
  children: ReactNode
}

const bottomNavRoutes = ['/legacy', '/contribute', '/family-tree', '/favorites', 'more']
const navItems = [
  { label: 'Family Legacy', href: '/legacy' },
  { label: 'Contribute', href: '/contribute' },
  { label: 'Family Tree', href: '/family-tree' },
]

const moreMenuRoutes = [
  { label: 'Voice Memories', href: '/legacy?lens=voices', icon: <StoriesIcon /> },
  { label: 'Keepsakes', href: '/legacy?lens=keepsakes', icon: <DocumentsIcon /> },
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
    await signOut({ callbackUrl: '/login' })
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
        <MenuItem component={Link} href="/privacy-settings" onClick={handleClose}>
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
  const { data: session, status } = useSession()
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])

  let router: any = null
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    router = useRouter()
  } catch (e) {
    // Router not mounted (common during some build phases)
  }

  const isMfaRequired =
    isMounted &&
    status === 'authenticated' &&
    session?.user?.role === 'OWNER' &&
    !session?.user?.mfaEnabled &&
    session?.user?.loginProvider !== 'google' &&
    router?.pathname !== '/account' &&
    router?.pathname !== '/support' &&
    router?.pathname !== '/login'
  
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { selectedFamilyMember } = useSelectedFamilyMember()
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null)
  const [speedDialOpen, setSpeedDialOpen] = useState(false)

  const dynamicNavItems = [
    { label: 'Family Legacy', href: '/legacy' },
    { label: 'Contribute', href: '/contribute' },
    { label: 'Family Tree', href: '/family-tree' },
  ]

  if (isMounted && selectedFamilyMember) {
    // Add Profile link next to Family Legacy
    dynamicNavItems.splice(1, 0, {
      label: 'Profile',
      href: `/profile/${selectedFamilyMember.id}`
    })
  }

  const currentPath = router?.pathname || ''
  const currentLens = router?.query?.lens || null

  const handleMoreOpen = (event: React.MouseEvent<HTMLElement>) => setMoreMenuAnchor(event.currentTarget)
  const handleMoreClose = () => setMoreMenuAnchor(null)
  const handleMoreNavigate = (path: string) => { handleMoreClose(); router?.push(path) }

  const handleAction = (action: string) => {
    setSpeedDialOpen(false)
    if (action === 'story') router?.push('/contribute')
    else if (action === 'document') router?.push('/legacy?lens=keepsakes')
    else if (action === 'person') router?.push('/family-tree?add=1')
  }

  const getMobileNavValue = () => {
    if (!router) return 0
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
    if (!router) return false
    const [itemPath] = href.split('?')
    if (itemPath === '/legacy') {
      return currentPath === '/legacy' || currentPath === '/' || currentPath.startsWith('/profile/')
    }
    return currentPath === itemPath || currentPath.startsWith(itemPath + '/')
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: ProfileColors.surface,
      }}
    >
      {/* Top navigation bar — desktop and mobile */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          backgroundColor: ProfileColors.surfaceContainerLow,
          color: ProfileColors.primary,
          borderBottom: '1px solid rgba(22, 51, 74, 0.08)',
          zIndex: theme.zIndex.appBar,
          overflow: 'visible',
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
          {/* Row 1: Global / Family Space Level */}
          <Toolbar
            sx={{
              minHeight: 64,
              px: { xs: 2, md: 4 },
              display: 'flex',
              alignItems: 'center',
            }}
          >
            {/* Brand */}
            <Box
              component={Link}
              href="/legacy"
              sx={{
                display: 'flex',
                alignItems: 'center',
                textDecoration: 'none',
                gap: 1.5,
                mr: { md: 3 },
              }}
            >
              <AnimatedWaveform height={18} />
              <Typography
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: { xs: '0.9rem', md: '1.05rem' },
                  fontWeight: 700,
                  color: ProfileColors.primary,
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                }}
              >
                Heard Again
              </Typography>
            </Box>

            {/* Desktop Navigation Links (Row 1) */}
            {!isMobile && session?.user && (
              <Box sx={{ display: 'flex', gap: 4, height: '100%', alignItems: 'center' }}>
                {dynamicNavItems
                  .filter((item) => item.label !== 'Profile')
                  .map((item) => {
                    const active = isNavActive(item.href)
                    return (
                      <Box
                        key={item.href}
                        sx={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: 64,
                        }}
                      >
                        <Typography
                          component={Link}
                          href={item.href}
                          sx={{
                            fontFamily: 'var(--font-manrope), sans-serif',
                            fontSize: '0.9rem',
                            fontWeight: active ? 600 : 500,
                            color: active ? '#16334a' : ProfileColors.onSurfaceVariant,
                            textDecoration: 'none',
                            px: 1,
                            py: 1,
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              color: '#16334a',
                            },
                          }}
                        >
                          {item.label}
                        </Typography>

                        {/* Active Underline */}
                        {active && (
                          <Box
                            sx={{
                              position: 'absolute',
                              left: '50%',
                              bottom: 0,
                              transform: 'translateX(-50%)',
                              width: '56px',
                              height: '2px',
                              backgroundColor: '#16334a',
                              opacity: 0.8,
                            }}
                          />
                        )}

                        {/* Person Context Selector (Desktop only, under Family Legacy) */}
                        {item.label === 'Family Legacy' && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: '66px',
                              left: '50%',
                              transform: 'translateX(-50%)',
                              zIndex: 20,
                            }}
                          >
                            <ActiveMemberHeader variant="mini" />
                          </Box>
                        )}
                      </Box>
                    )
                  })}
              </Box>
            )}

            <Box sx={{ flexGrow: 1 }} />

            {/* Mobile: Compact selector and user menu */}
            {isMobile && session?.user && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ActiveMemberHeader compact />
                <UserMenu />
              </Box>
            )}

            {/* Desktop: FamilyspaceSwitcher and UserMenu on Row 1 (right side) */}
            {!isMobile && session?.user && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FamilyspaceSwitcher />
                <UserMenu />
              </Box>
            )}
          </Toolbar>

          {/* No secondary zone: the active member selector hangs down and overlaps the content below */}
        </Box>
      </AppBar>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          backgroundColor: ProfileColors.surface,
          flexGrow: 1,
          minHeight: isMobile ? 'calc(100vh - 56px)' : 'calc(100vh - 64px)',
          pb: isMobile ? (router?.pathname === '/family-tree' ? 7 : 9) : 0,
        }}
      >
        {children}
      </Box>

      {/* Mobile only: creation FAB + bottom navigation */}
      {isMobile && session?.user && (
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
              tooltipTitle="Add a Memory"
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
            <BottomNavigationAction label="Legacy" icon={<HomeIcon />} />
            <BottomNavigationAction label="Contribute" icon={<AddIcon />} />
            <BottomNavigationAction label="Tree" icon={<FamilyTreeIcon />} />
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

          <Dialog
            open={!!isMfaRequired}
            disableEscapeKeyDown
            PaperProps={{
              sx: {
                borderRadius: 4,
                p: 2,
                maxWidth: 480,
                boxShadow: '0 12px 40px rgba(22, 51, 74, 0.15)',
              }
            }}
          >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
              <LockIcon color="warning" sx={{ fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 700, color: '#16334a' }}>
                Security Setup Required
              </Typography>
            </DialogTitle>
            <DialogContent sx={{ pb: 2 }}>
              <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary', lineHeight: 1.6 }}>
                As a <strong>Familyspace Owner</strong>, you need to enable a login code to keep everyone&apos;s stories and memories safe. 
                We will send a verification code to your email when you sign in — no app download is needed.
              </Typography>
              <Alert severity="warning" variant="outlined" sx={{ borderRadius: 2 }}>
                You must enable Multi-Factor Authentication (MFA) to access the rest of the application.
              </Alert>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
              <Button 
                onClick={async () => {
                  await signOut({ callbackUrl: '/login' })
                }} 
                color="inherit"
                variant="text"
                sx={{ textTransform: 'none' }}
              >
                Sign Out
              </Button>
              <Button
                component={Link}
                href="/account?tab=security"
                variant="contained"
                color="primary"
                sx={{ 
                  textTransform: 'none', 
                  borderRadius: 2,
                  bgcolor: '#16334a',
                  '&:hover': { bgcolor: '#2e4a62' }
                }}
              >
                Go to Security Settings
              </Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Box>
  )
}
