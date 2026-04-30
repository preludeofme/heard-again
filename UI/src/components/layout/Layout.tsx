import { ReactNode } from 'react'
import React from 'react'
import { useRouter } from 'next/router'
import { useSession, signOut } from 'next-auth/react'
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  InputBase,
  Avatar,
  Badge,
  useTheme,
  useMediaQuery,
  BottomNavigation,
  BottomNavigationAction,
  Menu,
  MenuItem,
  Button,
  Divider,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
} from '@mui/material'
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  Home as HomeIcon,
  Mic as MicIcon,
  AutoStories as StoriesIcon,
  AccountTree as FamilyTreeIcon,
  Settings as SettingsIcon,
  MoreHoriz as MoreIcon,
  Description as DocumentsIcon,
  Timeline as TimelineIcon,
  Favorite as FavoriteIcon,
  Add as AddIcon,
  Close as CloseIcon,
  PersonAdd as PersonAddIcon,
  PostAdd as PostAddIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { useState } from 'react'
import { ActiveMemberHeader } from './ActiveMemberHeader'
import { FamilyspaceSwitcher } from './FamilyspaceSwitcher'

// Material Symbols Outlined icons matching the mockup
const MaterialSymbolsIcon = ({ children, sx }: { children: string; sx?: Record<string, unknown> }) => (
  <Typography
    component="span"
    aria-hidden="true"
    sx={{
      fontFamily: '"Material Symbols Outlined", sans-serif',
      fontSize: 24,
      fontVariationSettings: "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
      lineHeight: 1,
      ...sx,
    }}
  >
    {children}
  </Typography>
)

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { label: 'Archive', href: '/archive', icon: 'auto_stories' },
  { label: 'Contribute', href: '/contribute', icon: 'add_circle' },
  { label: 'Family Members', href: '/family-tree', icon: 'groups' },
  { label: 'Voice Memories', href: '/archive?lens=voices', icon: 'settings_voice' },
  { label: 'Keepsakes', href: '/archive?lens=keepsakes', icon: 'inventory_2' },
]

const footerNavItems = [
  { label: 'Support', href: '/support', icon: 'help' },
  { label: 'Privacy Settings', href: '/privacy', icon: 'shield_lock' },
]

// Mobile bottom nav — 5 slots. 4 archive-centric + 1 "More" overflow.
const bottomNavRoutes = ['/archive', '/contribute', '/family-tree', '/archive?lens=voices', 'more']
const moreMenuRoutes = [
  { label: 'Keepsakes', href: '/archive?lens=keepsakes', icon: <DocumentsIcon /> },
  { label: 'Stories', href: '/archive?lens=stories', icon: <StoriesIcon /> },
  { label: 'Favorites', href: '/favorites', icon: <FavoriteIcon /> },
  { label: 'Account', href: '/account', icon: <SettingsIcon /> },
]

function UserMenu() {
  const { data: session, status } = useSession()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const router = useRouter()

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleSignOut = async () => {
    handleClose()
    await signOut({ redirect: false })
    router.push('/')
  }

  if (status === 'loading') {
    return <Avatar sx={{ width: 32, height: 32 }} />
  }

  if (!session?.user) {
    return (
      <Button
        component={Link}
        href="/login"
        variant="contained"
        size="small"
        sx={{ ml: 2 }}
      >
        Sign In
      </Button>
    )
  }

  return (
    <>
      <IconButton size="large" onClick={handleClick} aria-label="Open user menu">
        <Avatar
          sx={{ width: 32, height: 32 }}
          src={session.user.avatarUrl || undefined}
        >
          {session.user.displayName?.[0] || session.user.email?.[0]}
        </Avatar>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem disabled>
          <Typography variant="body2">
            {session.user.displayName || session.user.email}
          </Typography>
        </MenuItem>
        <MenuItem onClick={handleSignOut}>
          <LogoutIcon sx={{ mr: 1, fontSize: 20 }} />
          Sign Out
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
  const showAdvancedSearchButton = currentPath !== '/family-tree'

  const handleMoreOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMoreMenuAnchor(event.currentTarget)
  }

  const handleMoreClose = () => {
    setMoreMenuAnchor(null)
  }

  const handleMoreNavigate = (path: string) => {
    handleMoreClose()
    router.push(path)
  }

  const handleAction = (action: string) => {
    setSpeedDialOpen(false)
    if (action === 'story') {
      router.push('/contribute')
    } else if (action === 'document') {
      router.push('/archive?lens=keepsakes')
    } else if (action === 'person') {
      router.push('/family-tree?add=1')
    }
  }

  const getMobileNavValue = () => {
    const fullPath = currentLens ? `${currentPath}?lens=${currentLens}` : currentPath

    // Match the most specific route first (with lens param)
    const exactIdx = bottomNavRoutes.indexOf(fullPath)
    if (exactIdx >= 0) return exactIdx

    // Then bare path
    const baseIdx = bottomNavRoutes.indexOf(currentPath)
    if (baseIdx >= 0) return baseIdx

    const prefixIdx = bottomNavRoutes.findIndex((r) => currentPath.startsWith(r + '/'))
    if (prefixIdx >= 0) return prefixIdx

    // Check if current path is in "More" menu
    const isInMore = moreMenuRoutes.some((r) => {
      const [hrefPath] = r.href.split('?')
      return currentPath === hrefPath || currentPath.startsWith(hrefPath + '/')
    })
    if (isInMore) return 4

    return false
  }

  return (
    <>
      {isMobile ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <AppBar
            position="sticky"
            elevation={0}
            sx={{
              backgroundColor: theme.palette.background.default,
              color: theme.palette.text.primary,
              borderBottom: 'none',
            }}
          >
            <Toolbar sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" component="div" sx={{ fontFamily: "'Newsreader', serif", flexShrink: 0 }}>
                Heard Again
              </Typography>
              
              <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', px: 1 }}>
                <ActiveMemberHeader compact />
              </Box>

              <Box sx={{ flexShrink: 0 }}>
                <UserMenu />
              </Box>
            </Toolbar>
          </AppBar>

          {/* pb: 7 (56px) reserves space so content isn't hidden behind the fixed bottom nav */}
          <Box component="main" sx={{ flexGrow: 1, p: 2, pb: 9, backgroundColor: theme.palette.background.default }}>
            {children}
          </Box>

          {/* Creation FAB for Mobile */}
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
                '&:hover': {
                  bgcolor: '#2e4a62',
                }
              }
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
              if (target === 'more') {
                // Handled by handleMoreOpen via onClick on the action below
                return
              }
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
                '& .MuiSvgIcon-root': {
                  fontSize: 28,
                }
              }
            }}
          >
            <BottomNavigationAction label="Archive" icon={<HomeIcon />} />
            <BottomNavigationAction label="Contribute" icon={<AddIcon />} />
            <BottomNavigationAction label="Family" icon={<FamilyTreeIcon />} />
            <BottomNavigationAction label="Voices" icon={<MicIcon />} />
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
              }
            }}
          >
            {moreMenuRoutes.map((route) => {
              const [hrefPath] = route.href.split('?')
              const isMoreActive = currentPath === hrefPath || currentPath.startsWith(hrefPath + '/')
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
        </Box>
      ) : (
        <Box sx={{ display: 'flex', minHeight: '100vh' }}>
          {/* Side Rail */}
          <Box
            component="nav"
            sx={{
              width: 256,
              backgroundColor: '#f6f3ee',
              borderRight: 'none',
              display: 'flex',
              flexDirection: 'column',
              position: 'fixed',
              height: '100vh',
              left: 0,
              top: 0,
              pt: 6,
            }}
          >
            {/* Logo/Brand */}
            <Box sx={{ p: 3, mb: 1 }}>
              <Typography variant="h4" component="div" className="serif-font" sx={{ color: '#16334a', fontWeight: 600 }}>
                Heard Again
              </Typography>
              <Typography variant="caption" sx={{ color: '#73777d', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Memory Preservation
              </Typography>
            </Box>

            {/* Familyspace switcher */}
            <Box sx={{ px: 1, mb: 2 }}>
              <FamilyspaceSwitcher />
            </Box>

            <Divider sx={{ mx: 3, mb: 2 }} />

            {/* Navigation Items */}
            <Box sx={{ flexGrow: 1, px: 2, overflowY: 'auto' }}>
              {navItems.map((item) => {
                const [itemPath, itemQuery] = item.href.split('?')
                const itemLens = itemQuery?.startsWith('lens=') ? itemQuery.slice(5) : null
                const pathMatches = currentPath === itemPath
                let isActive = false
                if (itemPath === '/archive') {
                  // Archive entries differentiate by lens param
                  if (itemLens) {
                    isActive = pathMatches && currentLens === itemLens
                  } else {
                    // Plain /archive matches when no lens or lens is journey (default)
                    isActive = pathMatches && (currentLens === null || currentLens === 'journey')
                  }
                } else {
                  isActive = pathMatches || currentPath.startsWith(itemPath + '/')
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{ textDecoration: 'none' }}
                    aria-label={item.label}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        px: 3,
                        py: 2,
                        mb: 1,
                        borderRadius: 2,
                        backgroundColor: isActive ? '#ffffff' : 'transparent',
                        color: isActive ? '#16334a' : '#546669',
                        boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        transition: 'all 0.3s ease',
                        '&:hover': {
                          backgroundColor: '#ebe8e3',
                          transform: 'translateX(4px)',
                        },
                      }}
                    >
                      <MaterialSymbolsIcon>{item.icon}</MaterialSymbolsIcon>
                      <Typography variant="body1" sx={{ fontWeight: isActive ? 600 : 400 }}>
                        {item.label}
                      </Typography>
                    </Box>
                  </Link>
                )
              })}
            </Box>

            <Divider sx={{ mx: 3, mb: 2 }} />

            {/* Active family member — full-width sidebar block */}
            <Box sx={{ px: 2, mb: 2 }}>
              <ActiveMemberHeader compact={false} />
            </Box>

            {/* Footer Links */}
            <Box sx={{ px: 2, pb: 3 }}>
              {footerNavItems.map((item) => (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }} aria-label={item.label}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 3,
                      py: 1.5,
                      borderRadius: 2,
                      color: theme.palette.text.primary,
                      opacity: 0.7,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        opacity: 1,
                        backgroundColor: '#ffffff',
                      },
                    }}
                  >
                    <MaterialSymbolsIcon sx={{ fontSize: 20 }}>{item.icon}</MaterialSymbolsIcon>
                    <Typography variant="body2">{item.label}</Typography>
                  </Box>
                </Link>
              ))}
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box sx={{ flexGrow: 1, ml: '256px' }}>
            <Box component="main" sx={{ flexGrow: 1, backgroundColor: theme.palette.background.default }}>
              {children}
            </Box>
          </Box>
        </Box>
      )}
    </>
  )
}
