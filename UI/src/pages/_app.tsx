import '@/styles/globals.css'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import theme from '@/styles/theme'
import { Manrope, Newsreader } from 'next/font/google'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { SnackbarProvider } from 'notistack'
import { SelectedFamilyMemberProvider } from '@/contexts/SelectedFamilyMemberContext'
import SessionErrorBoundaryWrapper from '@/components/auth/SessionErrorBoundary'
import { Analytics } from '@vercel/analytics/next'
import type { AppProps } from 'next/app'
import type { Session } from 'next-auth'
import { useEffect } from 'react'
import { captureFirstTouchUtm } from '@/lib/analytics/funnel'

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

  // First-touch attribution: the URL that carried the visitor's utm_* params
  // is remembered for the session and attached to every pay-funnel step, so
  // "which channel produced the trial" is answerable from the funnel events.
  useEffect(() => {
    captureFirstTouchUtm()
  }, [])

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
              <Analytics />
            </ThemeProvider>
          </SnackbarProvider>
        </SelectedFamilyMemberProvider>
      </AuthProvider>
    </div>
  )
}
