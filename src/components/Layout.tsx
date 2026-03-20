import { ReactNode } from 'react'
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
} from '@mui/material'
import {
  Search as SearchIcon,
  Notifications as NotificationsIcon,
  Settings as SettingsIcon,
  Mic as MicIcon,
  Add as AddIcon,
  Archive as ArchiveIcon,
  Chat as ChatIcon,
  Home as HomeIcon,
  Person as PersonIcon,
  Support as SupportIcon,
  PrivacyTip as PrivacyTipIcon,
} from '@mui/icons-material'
import Link from 'next/link'
import { useState } from 'react'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { label: 'Home', href: '/', icon: HomeIcon },
  { label: 'Talk', href: '/talk', icon: ChatIcon },
  { label: 'Voice Lab', href: '/voice-lab', icon: MicIcon },
  { label: 'Documents', href: '/documents', icon: ArchiveIcon },
  { label: 'Stories', href: '/stories', icon: PersonIcon },
]

const footerNavItems = [
  { label: 'Support', href: '/support', icon: SupportIcon },
  { label: 'Privacy Settings', href: '/privacy', icon: PrivacyTipIcon },
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

  if (isMobile) {
    return (
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
            <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontFamily: "'Newsreader', serif" }}>
              Heard Again
            </Typography>
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
    )
  }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      {/* Side Rail */}
      <Box
        component="nav"
        sx={{
          width: 280,
          backgroundColor: 'surface-container-low.main',
          borderRight: 'none',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
        }}
      >
        {/* Logo/Brand */}
        <Box sx={{ p: 3 }}>
          <Typography variant="h4" component="div" className="serif-font" sx={{ color: theme.palette.text.primary }}>
            The Living Archive
          </Typography>
        </Box>

        {/* Navigation Items */}
        <Box sx={{ flexGrow: 1, px: 2 }}>
          {navItems.map((item) => {
            const Icon = item.icon
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
                    color: theme.palette.text.primary,
                    textDecoration: 'none',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      backgroundColor: '#ffffff',
                    },
                  }}
                >
                  <Icon sx={{ fontSize: 24 }} />
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
          {footerNavItems.map((item) => {
            const Icon = item.icon
            return (
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
                  <Icon sx={{ fontSize: 20 }} />
                  <Typography variant="body2">
                    {item.label}
                  </Typography>
                </Box>
              </Link>
            )
          })}
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flexGrow: 1, ml: '280px', display: 'flex', flexDirection: 'column' }}>
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
          <Toolbar>
            <Box sx={{ flexGrow: 1, maxWidth: 600 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#ebe8e3',
                  borderRadius: 2,
                  px: 2,
                  py: 1,
                }}
              >
                <SearchIcon sx={{ color: theme.palette.text.primary, opacity: 0.6, mr: 1 }} />
                <InputBase
                  placeholder="Search memories…"
                  sx={{
                    flexGrow: 1,
                    fontSize: '0.95rem',
                    '& input::placeholder': {
                      opacity: 0.6,
                    },
                  }}
                />
              </Box>
            </Box>

            <IconButton size="large" sx={{ ml: 2 }}>
              <Badge badgeContent={3} color="primary">
                <NotificationsIcon />
              </Badge>
            </IconButton>
            <IconButton size="large" sx={{ ml: 1 }}>
              <SettingsIcon />
            </IconButton>
            <IconButton size="large" sx={{ ml: 1 }}>
              <Avatar sx={{ width: 40, height: 40 }} src="/images/user-avatar.jpg" />
            </IconButton>
          </Toolbar>
        </AppBar>

        {/* Page Content */}
        <Box component="main" sx={{ flexGrow: 1, backgroundColor: theme.palette.background.default }}>
          {children}
        </Box>
      </Box>
    </Box>
  )
}
