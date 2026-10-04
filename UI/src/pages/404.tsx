import Head from 'next/head'
import Link from 'next/link'

export default function Custom404() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', padding: '1rem', textAlign: 'center' }}>
      <Head>
        <title>Page not found - Heard Again</title>
        <meta name="robots" content="noindex" />
      </Head>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>404</h1>
      <p style={{ color: '#666' }}>We can&apos;t find that page. The link may be old or mistyped.</p>
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem' }}>
        <Link href="/" style={{ color: '#1976d2' }}>Go home</Link>
        <Link href="/pricing" style={{ color: '#1976d2' }}>See pricing</Link>
      </div>
    </div>
  )
}
