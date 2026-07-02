import React, { useState } from 'react'
import {
  Box,
  Container,
  Typography,
  Button,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
} from '@mui/material'
import MenuIcon from '@mui/icons-material/Menu'
import CloseIcon from '@mui/icons-material/Close'
import Link from 'next/link'

export function PublicHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen)
  }

  const navLinks = [
    { label: 'Pricing', href: '/#pricing' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Sign In', href: '/login' },
  ]

  const drawer = (
    <Box sx={{ width: 250, p: 2 }} role="presentation" onClick={handleDrawerToggle}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <IconButton onClick={handleDrawerToggle}>
          <CloseIcon />
        </IconButton>
      </Box>
      <List>
        {navLinks.map((item) => (
          <ListItem key={item.label} disablePadding>
            <ListItemButton component={Link} href={item.href}>
              <ListItemText primary={item.label} sx={{ color: 'primary.main' }} />
            </ListItemButton>
          </ListItem>
        ))}
        <ListItem disablePadding sx={{ mt: 2 }}>
          <Button
            fullWidth
            component={Link}
            href="/signup"
            variant="contained"
            sx={{
              borderRadius: '999px',
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Get Started
          </Button>
        </ListItem>
      </List>
    </Box>
  )

  return (
    <Box
      component="header"
      sx={{
        bgcolor: 'background.default',
        borderBottom: '1px solid',
        borderColor: 'rgba(208, 227, 230, 0.5)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 2,
          }}
        >
          <Typography
            variant="h6"
            component={Link}
            href="/"
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              fontStyle: 'italic',
              color: 'primary.main',
              fontSize: '1.5rem',
              textDecoration: 'none',
            }}
          >
            Heard Again
          </Typography>

          {/* Desktop Nav */}
          <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 1, alignItems: 'center' }}>
            {navLinks.map((item) => (
              <Button
                key={item.label}
                component={Link}
                href={item.href}
                variant="text"
                sx={{
                  color: 'primary.main',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                {item.label}
              </Button>
            ))}
            <Button
              component={Link}
              href="/signup"
              variant="contained"
              sx={{
                ml: 1,
                borderRadius: '999px',
                px: 3,
                textTransform: 'none',
                fontWeight: 600,
              }}
            >
              Get Started
            </Button>
          </Box>

          {/* Mobile Nav Toggle */}
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="end"
            onClick={handleDrawerToggle}
            sx={{ display: { md: 'none' }, color: 'primary.main' }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Container>
      
      {/* Mobile Drawer */}
      <Drawer
        anchor="right"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 250 },
        }}
      >
        {drawer}
      </Drawer>
    </Box>
  )
}
