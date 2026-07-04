import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* PWA manifest — enables "Add to Home Screen" with standalone fullscreen display */}
        <link rel="manifest" href="/manifest.json" />

        {/* Favicon — Heard Again logo */}
        <link rel="icon" type="image/png" sizes="32x32" href="/heard-again-logo-32.png" />
        <link rel="icon" type="image/png" sizes="64x64" href="/heard-again-logo-64.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/heard-again-logo-180.png" />

        {/* Theme color — colors the browser chrome on Android and the status bar tint on iOS */}
        <meta name="theme-color" content="#16334a" />

        {/* iOS PWA: run in standalone (no Safari chrome) when launched from home screen */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Heard Again" />

        {/* Material Symbols Outlined font for navigation icons */}
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
