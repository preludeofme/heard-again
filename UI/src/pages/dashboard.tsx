import Head from 'next/head'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/router'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Card,
  CardContent,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Layout } from '@/components/layout/Layout'

interface UserRow {
  id: string
  name: string
  email: string
  createdAt: string
}

interface Metrics {
  total: number
  netNew: number
  users: UserRow[]
}

export default function DashboardPage() {
  const { status } = useSession()
  const router = useRouter()
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    fetch('/api/admin/users-metrics')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setMetrics)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [status, router])

  if (loading || metrics === null) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 10 }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <Alert severity="error" sx={{ m: 2 }}>
          Failed to load metrics: {error}
        </Alert>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Dashboard — Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 900, mx: 'auto' }}>
          <Typography variant="h4" gutterBottom>
            Dashboard
          </Typography>

          <Box sx={{ display: 'flex', gap: 3, mb: 4, flexWrap: 'wrap' }}>
            <Card sx={{ flex: '1 1 200px' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Total Users
                </Typography>
                <Typography variant="h3">{metrics.total}</Typography>
              </CardContent>
            </Card>
            <Card sx={{ flex: '1 1 200px' }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  Net New (30 days)
                </Typography>
                <Typography variant="h3">{metrics.netNew}</Typography>
              </CardContent>
            </Card>
          </Box>

          <Typography variant="h6" gutterBottom>
            Users
          </Typography>
          <TableContainer component={Paper}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Joined</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {metrics.users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {metrics.users.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              No users yet.
            </Typography>
          )}
        </Box>
      </Layout>
    </>
  )
}
