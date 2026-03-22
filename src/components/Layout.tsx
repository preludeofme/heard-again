import { ReactNode } from 'react'
import React from 'react'
import { useRouter } from 'next/router'
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
  SvgIcon,
} from '@mui/material'
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Mic as MicIcon,
  Add as AddIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Support as SupportIcon,
  PrivacyTip as PrivacyTipIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { useState } from 'react'
import { ToastProvider } from './ToastProvider'

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
  { label: 'Home', href: '/', icon: 'home' },
  { label: 'Voice Lab', href: '/voice-lab', icon: 'settings_voice' },
  { label: 'Documents', href: '/documents', icon: 'description' },
  { label: 'Stories', href: '/stories', icon: 'auto_stories' },
  { label: 'Family Tree', href: '/family-tree', icon: 'account_tree' },
  { label: 'Talk', href: '/talk', icon: 'forum' },
]

const footerNavItems = [
  { label: 'Support', href: '/support', icon: 'help' },
  { label: 'Privacy Settings', href: '/privacy', icon: 'shield_lock' },
]

export function Layout({ children }: LayoutProps) {
  const router = useRouter()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileNavValue, setMobileNavValue] = useState(0)

  const currentPath = router.pathname

  const getMobileNavValue = () => {
    switch (currentPath) {
      case '/': return 0
      case '/voice-lab': return 1
      case '/stories': return 3
      case '/talk': return 2
      default: return 0
    }
  }

  return (
    <ToastProvider>
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
                <IconButton size="large">
                  <SearchIcon />
                </IconButton>
                <IconButton size="large">
                  <Badge badgeContent={3} color="primary">
                    <NotificationsIcon />
                  </Badge>
                </IconButton>
                <IconButton size="large">
                  <Avatar sx={{ width: 32, height: 32 }} src="/images/user-avatar.jpg" />
                </IconButton>
              </Box>
            </Toolbar>
          </AppBar>

          <Box component="main" sx={{ flexGrow: 1, p: 2, backgroundColor: theme.palette.background.default }}>
            {children}
          </Box>

          <BottomNavigation
            value={getMobileNavValue()}
            onChange={(event, newValue) => {
              const routes = ['/', '/voice-lab', '/talk', '/stories']
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
                const isActive = currentPath === item.href
                
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

            {/* Start Recording CTA */}
            <Box sx={{ px: 3, pb: 2 }}>
              <Box
                sx={{
                  background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                  borderRadius: 3,
                  p: 2,
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'opacity 0.2s',
                  '&:hover': {
                    opacity: 0.9,
                  },
                }}
              >
                <MicIcon sx={{ color: 'white', fontSize: 32, mb: 1 }} />
                <Typography variant="body2" sx={{ color: 'white', fontWeight: 600 }}>
                  Start Recording
                </Typography>
              </Box>
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
          <Box sx={{ flexGrow: 1, ml: '256px', display: 'flex', flexDirection: 'column' }}>
            {/* Top App Bar */}
            <AppBar
              position="sticky"
              elevation={0}
              sx={{
                backgroundColor: theme.palette.background.default,
                color: theme.palette.text.primary,
                borderBottom: 'none',
              }}
            >
              <Toolbar sx={{ justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Typography variant="h6" component="div" sx={{ fontFamily: "'Newsreader', serif", color: '#16334a', fontWeight: 'bold' }}>
                    Heard Again
                  </Typography>
                  <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 3 }}>
                    <Link href="/" passHref legacyBehavior>
                      <Typography component="a" sx={{ color: '#16334a', fontWeight: 'bold', cursor: 'pointer', '&:hover': { color: '#2e4a62' } }}>
                        Home
                      </Typography>
                    </Link>
                    <Link href="/voice-lab" passHref legacyBehavior>
                      <Typography component="a" sx={{ color: '#73777d', fontWeight: 500, cursor: 'pointer', '&:hover': { color: '#2e4a62' } }}>
                        Voice Lab
                      </Typography>
                    </Link>
                    <Link href="/stories" passHref legacyBehavior>
                      <Typography component="a" sx={{ color: '#73777d', fontWeight: 500, cursor: 'pointer', '&:hover': { color: '#2e4a62' } }}>
                        Stories
                      </Typography>
                    </Link>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', backgroundColor: '#f0ede8', borderRadius: 3, px: 2, py: 1 }}>
                    <SearchIcon sx={{ color: '#73777d', fontSize: 20, mr: 1 }} />
                    <InputBase
                      placeholder="Search memories..."
                      sx={{
                        fontSize: '0.875rem',
                        '& input::placeholder': {
                          opacity: 0.7,
                        },
                      }}
                    />
                  </Box>
                  <IconButton size="large" sx={{ color: '#16334a' }}>
                    <NotificationsIcon />
                  </IconButton>
                  <IconButton size="large" sx={{ color: '#16334a' }}>
                    <SettingsIcon />
                  </IconButton>
                  <Avatar sx={{ width: 32, height: 32 }} src="/images/user-avatar.jpg" />
                </Box>
              </Toolbar>
            </AppBar>

            {/* Page Content */}
            <Box component="main" sx={{ flexGrow: 1, backgroundColor: theme.palette.background.default }}>
              {children}
            </Box>
          </Box>
        </Box>
      )}
    </ToastProvider>
  )
}
