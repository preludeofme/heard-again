import { NextPageContext } from 'next'
import Link from 'next/link'

interface ErrorProps {
  statusCode?: number
}

export default function Error({ statusCode }: ErrorProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '4rem', margin: 0 }}>{statusCode ?? 'Error'}</h1>
      <p style={{ color: '#666' }}>{statusCode === 404 ? 'Page not found' : 'An error occurred'}</p>
      <Link href="/" style={{ marginTop: '1rem', color: '#1976d2' }}>Go home</Link>
    </div>
  )
}

Error.getInitialProps = ({ res, err }: NextPageContext) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode }
}
