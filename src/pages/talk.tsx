import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { TalkPage } from '@/components/pages/TalkPage'
import { LegacySubject } from '@/types'
import { useEffect, useState } from 'react'
import { Box, CircularProgress } from '@mui/material'

export default function Talk() {
  const [legacySubject, setLegacySubject] = useState<LegacySubject | null>(null)

  useEffect(() => {
    // Fetch the first person from the workspace as the legacy subject
    async function fetchSubject() {
      try {
        const res = await fetch('/api/people?limit=1')
        const data = await res.json()
        if (data.success && data.data?.length > 0) {
          const p = data.data[0]
          setLegacySubject({
            id: p.id,
            fullName: p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`,
            lifespanText: p.isDeceased ? 'In Loving Memory' : 'Living Legacy',
            bio: p.bio || '',
            avatarUrl: p.avatarUrl || '',
            accentIcon: 'heart',
          })
        } else {
          // Fallback if no people exist
          setLegacySubject({
            id: 'default',
            fullName: 'Your Legacy',
            lifespanText: '',
            bio: '',
            avatarUrl: '',
            accentIcon: 'heart',
          })
        }
      } catch {
        setLegacySubject({
          id: 'default',
          fullName: 'Your Legacy',
          lifespanText: '',
          bio: '',
          avatarUrl: '',
          accentIcon: 'heart',
        })
      }
    }
    fetchSubject()
  }, [])

  if (!legacySubject) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <>
      <Head>
        <title>Talk - Heard Again</title>
        <meta name="description" content={`Conversation with ${legacySubject.fullName}`} />
      </Head>
      <Layout>
        <TalkPage legacySubject={legacySubject} />
      </Layout>
    </>
  )
}
