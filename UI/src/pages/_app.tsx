import '@/styles/globals.css'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import theme from '@/styles/theme'
import { Manrope, Newsreader } from 'next/font/google'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { SnackbarProvider } from 'notistack'
import { SelectedFamilyMemberProvider } from '@/contexts/SelectedFamilyMemberContext'
import SessionErrorBoundaryWrapper from '@/components/auth/SessionErrorBoundary'
import type { AppProps } from 'next/app'
import type { Session } from 'next-auth'

// Configure fonts with Next.js optimization
const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

const newsreader = Newsreader({
  subsets: ['latin'],
  variable: '--font-newsreader',
  display: 'swap',
})

interface CustomAppProps extends AppProps {
  pageProps: {
    session?: Session
  } & Record<string, any>
}

export default function App({ Component, pageProps, router }: CustomAppProps) {
  const { session, ...restPageProps } = pageProps

  return (
    <div className={`${manrope.variable} ${newsreader.variable}`}>
      <AuthProvider session={session}>
        <SelectedFamilyMemberProvider router={router} familyspaceId={session?.user?.defaultFamilyspaceId ?? null}>
          <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <ThemeProvider theme={theme}>
              <CssBaseline />
              <SessionErrorBoundaryWrapper router={router}>
                <Component {...restPageProps} />
              </SessionErrorBoundaryWrapper>
            </ThemeProvider>
          </SnackbarProvider>
        </SelectedFamilyMemberProvider>
      </AuthProvider>
    </div>
  )
}
