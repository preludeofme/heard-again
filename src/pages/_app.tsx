import '@/styles/globals.css'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import theme from '@/styles/theme'
import { Manrope, Newsreader } from 'next/font/google'
import { useEffect } from 'react'

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

export default function App({ Component, pageProps }: { Component: any; pageProps: any }) {
  useEffect(() => {
    // Debug font loading
    if (typeof window !== 'undefined') {
      console.log('Font variables applied:', {
        manrope: manrope.variable,
        newsreader: newsreader.variable,
      })
      
      // Check if fonts are loaded
      setTimeout(() => {
        const manropeLoaded = document.fonts.check('12px Manrope')
        const newsreaderLoaded = document.fonts.check('12px Newsreader')
        console.log('Fonts loaded:', { manropeLoaded, newsreaderLoaded })
      }, 1000)
    }
  }, [])

  return (
    <div className={`${manrope.variable} ${newsreader.variable}`}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Component {...pageProps} />
      </ThemeProvider>
    </div>
  )
}
