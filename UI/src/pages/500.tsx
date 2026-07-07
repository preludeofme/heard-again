import Link from 'next/link'

export default function Custom500() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>500</h1>
      <p style={{ color: '#666' }}>Something went wrong on our end.</p>
      <Link href="/" style={{ marginTop: '1rem', color: '#1976d2' }}>Go home</Link>
    </div>
  )
}
