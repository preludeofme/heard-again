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
} from '@mui/icons-material'
import Link from 'next/link'
import { useState } from 'react'
import { ActiveMemberHeader } from './ActiveMemberHeader'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'

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
  { label: 'Profile', href: '/profile', icon: 'person' },
  { label: 'Voice Lab', href: '/voice-lab', icon: 'settings_voice' },
  { label: 'Documents', href: '/documents', icon: 'description' },
  { label: 'Stories', href: '/stories', icon: 'auto_stories' },
  { label: 'Timeline', href: '/timeline', icon: 'timeline' },
  { label: 'Favorites', href: '/favorites', icon: 'favorite' },
  { label: 'Family Tree', href: '/family-tree', icon: 'account_tree' },
]

const footerNavItems = [
  { label: 'Support', href: '/support', icon: 'help' },
  { label: 'Privacy Settings', href: '/privacy', icon: 'shield_lock' },
]

// Mobile bottom nav — 5 highest-priority destinations
const bottomNavRoutes = ['/profile', '/stories', '/family-tree', '/voice-lab', '/account']

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

  const currentPath = router.pathname
  const showAdvancedSearchButton = currentPath !== '/family-tree'

  const getMobileNavValue = () => {
    const exactIdx = bottomNavRoutes.indexOf(currentPath)
    if (exactIdx >= 0) return exactIdx
    const prefixIdx = bottomNavRoutes.findIndex((r) => currentPath.startsWith(r + '/'))
    return prefixIdx >= 0 ? prefixIdx : false
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
            <Toolbar>
              <Typography variant="h6" component="div" sx={{ fontFamily: "'Newsreader', serif" }}>
                Heard Again
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 'auto' }}>
                {/* Single active member indicator — clickable, opens flyout */}
                <ActiveMemberHeader compact />
                {showAdvancedSearchButton && (
                  <Button
                    component={Link}
                    href="/family-tree?expandSearch=1"
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Search
                  </Button>
                )}
                <IconButton size="large" aria-label="Search">
                  <SearchIcon />
                </IconButton>
                <IconButton size="large" aria-label="Notifications">
                  <Badge color="primary" invisible>
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
                <UserMenu />
              </Box>
            </Toolbar>
          </AppBar>

          {/* pb: 7 (56px) reserves space so content isn't hidden behind the fixed bottom nav */}
          <Box component="main" sx={{ flexGrow: 1, p: 2, pb: 9, backgroundColor: theme.palette.background.default }}>
            {children}
          </Box>

          <BottomNavigation
            value={getMobileNavValue()}
            onChange={(_, newValue: number) => {
              router.push(bottomNavRoutes[newValue])
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
            }}
          >
            <BottomNavigationAction label="Home" icon={<HomeIcon />} />
            <BottomNavigationAction label="Stories" icon={<StoriesIcon />} />
            <BottomNavigationAction label="Tree" icon={<FamilyTreeIcon />} />
            <BottomNavigationAction label="Voice" icon={<MicIcon />} />
            <BottomNavigationAction label="Account" icon={<SettingsIcon />} />
          </BottomNavigation>
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

            {/* Workspace switcher */}
            <Box sx={{ px: 1, mb: 2 }}>
              <WorkspaceSwitcher />
            </Box>

            <Divider sx={{ mx: 3, mb: 2 }} />

            {/* Navigation Items */}
            <Box sx={{ flexGrow: 1, px: 2, overflowY: 'auto' }}>
              {navItems.map((item) => {
                const isActive =
                  currentPath === item.href ||
                  (item.href === '/profile' && currentPath.startsWith('/profile')) ||
                  (item.href === '/stories' && currentPath.startsWith('/stories'))

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
