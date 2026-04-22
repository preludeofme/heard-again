import { createTheme } from '@mui/material/styles'

const theme = createTheme({
  palette: {
    mode: 'light',
    // Warm minimalism palette
    background: {
      default: '#fcf9f4', // Base background (surface)
      paper: '#ffffff', // Cards (surface-container-lowest)
    },
    primary: {
      main: '#16334a',
    },
    secondary: {
      main: '#445558',
    },
    tertiary: {
      main: '#6d5f44',
    },
    info: {
      main: '#16334a',
    },
    text: {
      primary: '#1c1c19', // on-surface
      secondary: '#445558',
    },
    // Custom properties for Material Design 3 colors
    // Using type assertion to avoid TypeScript errors
    ...({
      'surface-container': '#f0ede8',
      'surface-container-low': '#f6f3ee',
      'surface-container-lowest': '#ffffff',
      'surface-container-high': '#ebe8e3',
      'surface-dim': '#dcdad5',
      'surface-bright': '#fcf9f4',
      'primary-container': '#2e4a62',
      'secondary-container': '#d0e3e6',
      'tertiary-fixed-dim': '#e0c29a',
      'tertiary-fixed': '#feddb4',
      'on-tertiary-fixed': '#281801',
      'outline': '#73777d',
      'outline-variant': '#c3c7cd',
      'on-surface-variant': '#43474d',
    } as any),
  },
  typography: {
    fontFamily: 'var(--font-manrope), sans-serif',
    h1: {
      fontFamily: 'var(--font-newsreader), serif',
      fontSize: '3.5rem',
      lineHeight: 1.2,
      fontWeight: 600,
    },
    h2: {
      fontFamily: 'var(--font-newsreader), serif',
      fontSize: '1.75rem',
      lineHeight: 1.3,
      fontWeight: 500,
    },
    h3: {
      fontFamily: 'var(--font-newsreader), serif',
      fontSize: '1.5rem',
      lineHeight: 1.3,
      fontWeight: 500,
    },
    h4: {
      fontFamily: 'var(--font-newsreader), serif',
      fontSize: '1.25rem',
      lineHeight: 1.3,
      fontWeight: 500,
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.6,
      fontWeight: 400,
    },
    caption: {
      fontSize: '0.75rem',
      fontFamily: 'var(--font-manrope), sans-serif',
      fontWeight: 400,
    },
  },
  shape: {
    borderRadius: 8, // Default (0.5rem)
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 24, // xl (1.5rem)
          textTransform: 'none',
          fontWeight: 600,
          transition: 'all 0.2s ease-in-out',
          '&:active': {
            transform: 'scale(0.98)',
          },
          '&.Mui-focusVisible': {
            outline: '2px solid #16334a',
            outlineOffset: '2px',
          },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
          '&:hover': {
            background: 'linear-gradient(135deg, #1a3d5a 0%, #345470 100%)',
            boxShadow: '0 4px 12px rgba(22, 51, 74, 0.15)',
          },
        },
        outlined: {
          borderColor: '#c3c7cd',
          color: '#445558',
          '&:hover': {
            backgroundColor: '#f6f3ee',
            borderColor: '#adcae6',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(208, 227, 230, 0.3)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12, // xl (1.5rem) for legacy cards
          boxShadow: 'none',
          border: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-2px)',
            boxShadow: '0 10px 40px rgba(28, 28, 25, 0.06)',
          },
          '&[tabIndex="0"]:focus': {
            outline: '2px solid #16334a',
            outlineOffset: '2px',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            backgroundColor: '#ebe8e3',
            borderRadius: 8,
            transition: 'all 0.2s ease-in-out',
            color: '#1c1c19',
            '& fieldset': {
              border: 'none',
            },
            '&:hover': {
              backgroundColor: '#e0ddd8',
            },
            '&:hover fieldset': {
              border: 'none',
            },
            '&.Mui-focused': {
              backgroundColor: '#ffffff',
              boxShadow: '0 0 0 1px rgba(208, 227, 230, 0.5)',
            },
            '&.Mui-focused fieldset': {
              border: '1px solid rgba(208, 227, 230, 0.5)',
            },
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(208, 227, 230, 0.3)',
          },
          '&:active': {
            transform: 'scale(0.95)',
          },
          '&.Mui-focusVisible': {
            outline: '2px solid #16334a',
            outlineOffset: '2px',
            backgroundColor: 'rgba(208, 227, 230, 0.5)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&.MuiChip-clickable': {
            '&:hover': {
              backgroundColor: 'rgba(208, 227, 230, 0.5)',
            },
            '&.Mui-focusVisible': {
              outline: '2px solid #16334a',
              outlineOffset: '2px',
            },
          },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(208, 227, 230, 0.2)',
          },
          '&.Mui-focusVisible': {
            outline: '2px solid #16334a',
            outlineOffset: '2px',
            backgroundColor: 'rgba(208, 227, 230, 0.3)',
          },
        },
      },
    },
  },
})

export default theme
