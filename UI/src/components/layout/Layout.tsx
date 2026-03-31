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
} from '@mui/material'
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Mic as MicIcon,
  Add as AddIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { useState } from 'react'
import { SelectedFamilyMemberChip } from './SelectedFamilyMemberChip'

// Material Symbols Outlined icons matching the mockup
const MaterialSymbolsIcon = ({ children, sx }: { children: string; sx?: any }) => (
  <Typography
    component="span"
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
  { label: 'Talk', href: '/talk', icon: 'forum' },
]

const footerNavItems = [
  { label: 'Support', href: '/support', icon: 'help' },
  { label: 'Privacy Settings', href: '/privacy', icon: 'shield_lock' },
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
      <IconButton size="large" onClick={handleClick}>
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
  const [mobileNavValue, setMobileNavValue] = useState(0)

  const currentPath = router.pathname
  const showAdvancedSearchButton = currentPath !== '/family-tree'


  const getMobileNavValue = () => {
    switch (currentPath) {
      case '/': return 0
      case '/profile': return 0
      case '/profile/[id]': return 0
      case '/voice-lab': return 1
      case '/stories': return 3
      case '/talk': return 2
      default: return 0
    }
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6" component="div" sx={{ fontFamily: "'Newsreader', serif" }}>
                  Heard Again
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, marginLeft: 'auto' }}>
                {showAdvancedSearchButton && (
                  <Button
                    component={Link}
                    href="/family-tree?expandSearch=1"
                    size="small"
                    variant="outlined"
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Advanced Search
                  </Button>
                )}
                <IconButton size="large">
                  <SearchIcon />
                </IconButton>
                <SelectedFamilyMemberChip />
                <IconButton size="large">
                  <Badge badgeContent={3} color="primary">
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
                <UserMenu />
              </Box>
            </Toolbar>
          </AppBar>

          <Box component="main" sx={{ flexGrow: 1, p: 2, backgroundColor: theme.palette.background.default }}>
            {children}
          </Box>

          <BottomNavigation
            value={getMobileNavValue()}
            onChange={(event, newValue) => {
              const routes = ['/profile', '/voice-lab', '/talk', '/stories']
              router.push(routes[newValue])
            }}
            sx={{
              backgroundColor: '#f6f3ee',
              borderTop: 'none',
              boxShadow: 'none',
            }}
          >
            <BottomNavigationAction label="Home" icon={<HomeIcon />} />
            <BottomNavigationAction label="Lab" icon={<MicIcon />} />
            <BottomNavigationAction
              label="Add"
              icon={<AddIcon />}
              sx={{
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '0.6rem',
                },
              }}
            />
            <BottomNavigationAction label="Stories" icon={<PersonIcon />} />
            <BottomNavigationAction label="Profile" icon={<Avatar sx={{ width: 24, height: 24 }} />} />
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
            <Box sx={{ p: 3, mb: 2 }}>
              <Typography variant="h4" component="div" className="serif-font" sx={{ color: '#16334a', fontWeight: 600 }}>
                The Living Archive
              </Typography>
              <Typography variant="caption" sx={{ color: '#73777d', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Memory Preservation
              </Typography>
            </Box>

            {/* Navigation Items */}
            <Box sx={{ flexGrow: 1, px: 2 }}>
              {navItems.map((item) => {
                const isActive =
                  currentPath === item.href
                  || (item.href === '/profile' && currentPath.startsWith('/profile'))
                  || (item.href === '/stories' && currentPath.startsWith('/stories'))
                
                return (
                  <Link key={item.href} href={item.href} passHref legacyBehavior>
                    <Box
                      component="a"
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
                        textDecoration: 'none',
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

            {/* Footer Links */}
            <Box sx={{ px: 2, pb: 3 }}>
              {footerNavItems.map((item) => (
                <Link key={item.href} href={item.href} passHref legacyBehavior>
                  <Box
                    component="a"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                      px: 3,
                      py: 1.5,
                      borderRadius: 2,
                      color: theme.palette.text.primary,
                      textDecoration: 'none',
                      opacity: 0.7,
                      transition: 'all 0.2s ease-in-out',
                      '&:hover': {
                        opacity: 1,
                        backgroundColor: '#ffffff',
                      },
                    }}
                  >
                    <MaterialSymbolsIcon sx={{ fontSize: 20 }}>{item.icon}</MaterialSymbolsIcon>
                    <Typography variant="body2">
                      {item.label}
                    </Typography>
                  </Box>
                </Link>
              ))}
            </Box>
          </Box>

          {/* Main Content Area */}
          <Box sx={{ flexGrow: 1, ml: '256px' }}>

            {/* Page Content */}
            <Box component="main" sx={{ flexGrow: 1, backgroundColor: theme.palette.background.default }}>
              {children}
            </Box>
          </Box>
        </Box>
      )}
    </>
  )
}
