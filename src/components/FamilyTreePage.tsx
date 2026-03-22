import React from 'react'
import {
  Box,
  Typography,
  Button,
  Card,
  Avatar,
  IconButton,
  useTheme,
} from '@mui/material'
import {
  ZoomIn,
  ZoomOut,
  RestartAlt,
  Add,
  AutoFixHigh,
  AutoStories,
  Edit,
  PersonAdd,
} from '@mui/icons-material'
import Link from 'next/link'

// Mock family tree data
const familyData = {
  grandparents: [
    {
      id: 1,
      name: 'Arthur Emerson',
      role: 'Grandfather',
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face',
    },
    {
      id: 2,
      name: 'Martha Emerson',
      role: 'Grandmother',
      avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face',
    },
  ],
  parents: [
    {
      id: 3,
      name: 'David Emerson',
      role: 'Father',
      memories: 52,
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face',
      selected: true,
    },
  ],
  children: [
    {
      id: 4,
      name: 'Elena Emerson',
      role: 'Daughter',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face',
    },
    {
      id: 5,
      name: 'Julian Emerson',
      role: 'Son',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face',
    },
  ],
}

// Tree connector line component
const TreeLine = ({ height = 40, vertical = true }: { height?: number; vertical?: boolean }) => (
  <Box
    sx={{
      width: vertical ? 2 : '100%',
      height: vertical ? height : 2,
      bgcolor: '#dcdad5',
      margin: '0 auto',
    }}
  />
)

export function FamilyTreePage() {
  const theme = useTheme()

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex' }}>
      {/* Side Navigation */}
      <Box
        component="aside"
        sx={{
          width: 256,
          bgcolor: 'background.default',
          borderRight: '1px solid',
          borderColor: 'rgba(208, 227, 230, 0.5)',
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column',
          position: 'fixed',
          height: '100vh',
          left: 0,
          top: 0,
          pt: 10,
          zIndex: 40,
        }}
      >
        <Box sx={{ px: 3, py: 4 }}>
          <Typography
            variant="h5"
            sx={{
              fontFamily: 'var(--font-newsreader), serif',
              color: 'primary.main',
              mb: 0.5,
            }}
          >
            The Living Archive
          </Typography>
          <Typography
            variant="caption"
            sx={{
              color: 'secondary.main',
              fontWeight: 500,
              opacity: 0.7,
            }}
          >
            Preserving your legacy
          </Typography>
        </Box>

        <Box sx={{ flex: 1, px: 1 }}>
          {[
            { label: 'My Archive', icon: 'auto_stories', href: '/', active: false },
            { label: 'Family Tree', icon: 'account_tree', href: '/family-tree', active: true },
            { label: 'Voice Vault', icon: 'settings_voice', href: '/voice-lab', active: false },
            { label: 'Settings', icon: 'settings', href: '/settings', active: false },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  px: 3,
                  py: 2,
                  mx: 1,
                  my: 0.5,
                  borderRadius: 3,
                  bgcolor: item.active ? 'primary.main' : 'transparent',
                  color: item.active ? 'white' : 'secondary.main',
                  transition: 'all 0.3s ease',
                  '&:hover': {
                    bgcolor: item.active ? 'primary.main' : 'rgba(208, 227, 230, 0.5)',
                  },
                }}
              >
                <Typography
                  component="span"
                  sx={{
                    fontFamily: '"Material Symbols Outlined", sans-serif',
                    fontSize: 24,
                    fontVariationSettings: "'FILL' 0, 'wght' 400",
                  }}
                >
                  {item.icon}
                </Typography>
                <Typography variant="body1">{item.label}</Typography>
              </Box>
            </Link>
          ))}
        </Box>

        <Box sx={{ p: 3 }}>
          <Button
            fullWidth
            variant="contained"
            startIcon={
              <Typography
                component="span"
                sx={{
                  fontFamily: '"Material Symbols Outlined", sans-serif',
                  fontSize: 18,
                  fontVariationSettings: "'FILL' 0, 'wght' 400",
                }}
              >
                add
              </Typography>
            }
            sx={{
              bgcolor: 'rgba(208, 227, 230, 0.8)',
              color: 'secondary.main',
              py: 1.5,
              borderRadius: 3,
              '&:hover': {
                bgcolor: 'rgba(208, 227, 230, 1)',
              },
            }}
          >
            Record a Memory
          </Button>
        </Box>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flex: 1,
          ml: { lg: '256px' },
          bgcolor: 'rgba(208, 227, 230, 0.2)',
          p: { xs: 3, md: 6 },
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Context Header */}
        <Box
          sx={{
            maxWidth: 1200,
            mx: 'auto',
            mb: 6,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            flexWrap: 'wrap',
            gap: 3,
          }}
        >
          <Box>
            <Typography
              variant="h3"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                color: 'primary.main',
                mb: 1,
              }}
            >
              The Emerson Legacy
            </Typography>
            <Typography variant="body1" sx={{ color: 'secondary.main', fontSize: '1.125rem' }}>
              Charting four generations of storytelling.
            </Typography>
          </Box>

          {/* Zoom Controls */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              bgcolor: 'background.paper',
              p: 1,
              borderRadius: 10,
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              border: '1px solid',
              borderColor: 'rgba(208, 227, 230, 0.5)',
            }}
          >
            <IconButton size="small" sx={{ color: 'primary.main' }}>
              <ZoomIn />
            </IconButton>
            <IconButton size="small" sx={{ color: 'primary.main' }}>
              <ZoomOut />
            </IconButton>
            <Box sx={{ width: 1, height: 24, bgcolor: 'rgba(208, 227, 230, 0.5)', mx: 0.5 }} />
            <Button
              startIcon={<RestartAlt />}
              size="small"
              sx={{ color: 'primary.main', textTransform: 'none' }}
            >
              Reset View
            </Button>
          </Box>
        </Box>

        {/* Family Tree Visualization */}
        <Box
          sx={{
            position: 'relative',
            minHeight: 700,
            width: '100%',
            bgcolor: 'rgba(208, 227, 230, 0.3)',
            borderRadius: 6,
            p: 6,
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          {/* Root Generation - Grandparents */}
          <Box sx={{ display: 'flex', gap: 8, position: 'relative', zIndex: 10 }}>
            {familyData.grandparents.map((person) => (
              <Box key={person.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Card
                  sx={{
                    bgcolor: 'background.paper',
                    p: 3,
                    borderRadius: 4,
                    width: 256,
                    boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
                    border: '1px solid',
                    borderColor: 'rgba(22, 51, 74, 0.05)',
                    transition: 'transform 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={person.avatar} sx={{ width: 56, height: 56 }} />
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontFamily: 'var(--font-newsreader), serif',
                          color: 'primary.main',
                        }}
                      >
                        {person.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 500 }}>
                        {person.role}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
                <TreeLine height={40} />
              </Box>
            ))}
          </Box>

          {/* Connector Generation 1 to 2 */}
          <Box sx={{ position: 'relative', width: '100%', maxWidth: 600, height: 40 }}>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: '50%',
                transform: 'translateX(-50%)',
                width: 2,
                height: 40,
                bgcolor: '#dcdad5',
              }}
            />
          </Box>

          {/* Main Generation - Parents */}
          <Box sx={{ display: 'flex', gap: 6, mt: 2, position: 'relative', zIndex: 20 }}>
            {familyData.parents.map((person) => (
              <Box key={person.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Card
                  sx={{
                    bgcolor: 'primary.main',
                    p: 4,
                    borderRadius: 6,
                    width: 288,
                    position: 'relative',
                    boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
                    outline: 8,
                    outlineColor: 'rgba(22, 51, 74, 0.05)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Avatar
                      src={person.avatar}
                      sx={{
                        width: 64,
                        height: 64,
                        border: 2,
                        borderColor: 'rgba(205, 229, 255, 0.5)',
                      }}
                    />
                    <Box>
                      <Typography
                        variant="h5"
                        sx={{
                          fontFamily: 'var(--font-newsreader), serif',
                          color: 'white',
                        }}
                      >
                        {person.name}
                      </Typography>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        {person.role} • {person.memories} Memories
                      </Typography>
                    </Box>
                  </Box>

                  {/* Quick Actions */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button
                      fullWidth
                      variant="text"
                      startIcon={<AutoStories />}
                      sx={{
                        color: 'white',
                        bgcolor: 'rgba(255,255,255,0.1)',
                        '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                        justifyContent: 'center',
                        py: 1,
                        borderRadius: 2,
                      }}
                    >
                      View Archive
                    </Button>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="text"
                        startIcon={<Edit />}
                        sx={{
                          flex: 1,
                          color: 'white',
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                          justifyContent: 'center',
                          py: 1,
                          borderRadius: 2,
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="text"
                        startIcon={<PersonAdd />}
                        sx={{
                          flex: 1,
                          color: 'white',
                          bgcolor: 'rgba(255,255,255,0.1)',
                          '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' },
                          justifyContent: 'center',
                          py: 1,
                          borderRadius: 2,
                        }}
                      >
                        Add
                      </Button>
                    </Box>
                  </Box>

                  {/* Connector Down */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: -40,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 2,
                      height: 40,
                      bgcolor: 'rgba(22, 51, 74, 0.4)',
                    }}
                  />
                </Card>
              </Box>
            ))}
          </Box>

          {/* Connector Generation 2 to 3 */}
          <Box sx={{ position: 'relative', width: '100%', maxWidth: 400, height: 40, mt: 10 }}>
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 2,
                bgcolor: '#dcdad5',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 2,
                height: 40,
                bgcolor: '#dcdad5',
              }}
            />
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: 2,
                height: 40,
                bgcolor: '#dcdad5',
              }}
            />
          </Box>

          {/* Children Generation */}
          <Box sx={{ display: 'flex', gap: 8, mt: 0, position: 'relative', zIndex: 10 }}>
            {familyData.children.map((person) => (
              <Box key={person.id} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Card
                  sx={{
                    bgcolor: 'background.paper',
                    p: 3,
                    borderRadius: 4,
                    width: 240,
                    boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
                    border: '1px solid',
                    borderColor: 'rgba(22, 51, 74, 0.05)',
                    transition: 'transform 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Avatar src={person.avatar} sx={{ width: 48, height: 48 }} />
                    <Box>
                      <Typography
                        variant="h6"
                        sx={{
                          fontFamily: 'var(--font-newsreader), serif',
                          color: 'primary.main',
                          fontSize: '1.125rem',
                        }}
                      >
                        {person.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'secondary.main', fontWeight: 500 }}>
                        {person.role}
                      </Typography>
                    </Box>
                  </Box>
                </Card>
              </Box>
            ))}
          </Box>

          {/* Add Relative Button */}
          <Box sx={{ mt: 8, cursor: 'pointer' }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  bgcolor: 'rgba(208, 227, 230, 0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'secondary.main',
                  transition: 'all 0.3s',
                  '&:hover': {
                    bgcolor: 'primary.main',
                    color: 'white',
                  },
                }}
              >
                <Add />
              </Box>
              <Typography
                variant="caption"
                sx={{
                  mt: 1,
                  fontWeight: 700,
                  color: 'secondary.main',
                  opacity: 0.6,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                Add Relative
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Detail Sidebar */}
        <Card
          sx={{
            position: 'absolute',
            right: 48,
            top: 200,
            width: 320,
            bgcolor: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(20px)',
            p: 4,
            borderRadius: 8,
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
            border: '1px solid',
            borderColor: 'rgba(255,255,255,0.5)',
            display: { xs: 'none', xl: 'block' },
          }}
        >
          <Box sx={{ mb: 4 }}>
            <Typography
              variant="overline"
              sx={{
                color: 'secondary.main',
                fontWeight: 700,
                letterSpacing: '0.2em',
                fontSize: '0.65rem',
              }}
            >
              INSIGHT
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                color: 'primary.main',
                mt: 0.5,
              }}
            >
              Common Threads
            </Typography>
          </Box>

          <Box sx={{ spaceY: 3 }}>
            <Card
              sx={{
                bgcolor: 'rgba(208, 227, 230, 0.3)',
                p: 3,
                borderRadius: 4,
                mb: 3,
              }}
            >
              <Typography
                variant="body2"
                sx={{
                  color: 'secondary.main',
                  fontStyle: 'italic',
                }}
              >
                &quot;Most family stories reference &apos;The Summer of &apos;84&apos; at the lake house.&quot;
              </Typography>
            </Card>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1, mb: 2 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'tertiary.main',
                }}
              />
              <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                3 Shared voice patterns found
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, px: 1 }}>
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bgcolor: 'rgba(22, 51, 74, 0.5)',
                }}
              />
              <Typography variant="body2" sx={{ color: 'secondary.main' }}>
                Genealogy sync active
              </Typography>
            </Box>
          </Box>

          <Button
            fullWidth
            variant="contained"
            endIcon={<AutoFixHigh />}
            sx={{
              mt: 4,
              py: 1.5,
              borderRadius: 3,
            }}
          >
            Generate Family Bio
          </Button>
        </Card>
      </Box>
    </Box>
  )
}
