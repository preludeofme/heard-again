import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import {
  Box, Typography, TextField, InputAdornment, Card, Avatar, Chip,
  CircularProgress, Grid, Divider,
} from '@mui/material'
import {
  Search as SearchIcon, AutoStories, Person, Description,
  Schedule, ArrowForward,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface SearchResults {
  stories: Array<{
    id: string; title: string; excerpt?: string; storyType: string;
    status: string; createdAt: string;
    subject?: { id: string; firstName: string; lastName?: string }
  }>
  people: Array<{
    id: string; firstName: string; lastName?: string; displayName?: string;
    personType: string; isDeceased: boolean; avatarAssetId?: string
  }>
  assets: Array<{
    id: string; originalName: string; assetType: string;
    mimeType: string; createdAt: string
  }>
  totalResults: number
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState((router.query.q as string) || '')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const debounceRef = useRef<NodeJS.Timeout>(null)

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(null)
      return
    }
    setIsSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=20`)
      const data = await res.json()
      if (data.success) setResults(data.data)
    } catch {
      // Silently fail
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const personName = (p: { firstName: string; lastName?: string; displayName?: string }) =>
    p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`

  return (
    <>
      <Head>
        <title>Search - Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
          {/* Search Header */}
          <Box sx={{ maxWidth: 800, mx: 'auto', mb: 6 }}>
            <Typography
              variant="h3"
              className="serif-font"
              sx={{ color: '#16334a', mb: 4, fontStyle: 'italic', textAlign: 'center' }}
            >
              Search the Archive
            </Typography>
            <TextField
              fullWidth
              placeholder="Search stories, people, documents..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#546669' }} />
                  </InputAdornment>
                ),
                endAdornment: isSearching ? (
                  <InputAdornment position="end">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : null,
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  backgroundColor: '#ffffff',
                  borderRadius: 4,
                  fontSize: '1.1rem',
                  py: 0.5,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
                },
              }}
            />
          </Box>

          {/* Results */}
          {results && (
            <Box sx={{ maxWidth: 800, mx: 'auto' }}>
              <Typography variant="body2" sx={{ color: '#546669', mb: 4 }}>
                {results.totalResults} result{results.totalResults !== 1 ? 's' : ''} found
              </Typography>

              {/* Stories */}
              {results.stories.length > 0 && (
                <Box sx={{ mb: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AutoStories sx={{ fontSize: 20, color: '#16334a' }} />
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      Stories ({results.stories.length})
                    </Typography>
                  </Box>
                  {results.stories.map((story) => (
                    <Card
                      key={story.id}
                      onClick={() => router.push(`/stories/${story.id}`)}
                      sx={{
                        p: 3, mb: 2, borderRadius: 3, cursor: 'pointer',
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateX(4px)', boxShadow: 2 },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Box sx={{ flexGrow: 1 }}>
                          <Typography variant="subtitle1" sx={{ color: '#16334a', fontWeight: 600, mb: 0.5 }}>
                            {story.title}
                          </Typography>
                          {story.excerpt && (
                            <Typography variant="body2" sx={{ color: '#666', mb: 1 }} noWrap>
                              {story.excerpt}
                            </Typography>
                          )}
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip label={story.storyType} size="small" sx={{ backgroundColor: '#f6f3ee', fontSize: '0.7rem' }} />
                            <Typography variant="caption" sx={{ color: '#999' }}>
                              {formatDistanceToNow(new Date(story.createdAt), { addSuffix: true })}
                            </Typography>
                          </Box>
                        </Box>
                        <ArrowForward sx={{ color: '#ccc', fontSize: 18 }} />
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}

              {/* People */}
              {results.people.length > 0 && (
                <Box sx={{ mb: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Person sx={{ fontSize: 20, color: '#16334a' }} />
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      People ({results.people.length})
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {results.people.map((person) => (
                      <Grid key={person.id} size={{ xs: 12, sm: 6 }}>
                        <Card
                          sx={{
                            p: 3, borderRadius: 3, cursor: 'pointer',
                            transition: 'transform 0.2s',
                            '&:hover': { transform: 'translateY(-2px)', boxShadow: 2 },
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Avatar sx={{ width: 44, height: 44, backgroundColor: '#d0e3e6', color: '#16334a' }}>
                              {person.firstName[0]}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 600 }}>
                                {personName(person)}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#546669' }}>
                                {person.personType} {person.isDeceased ? '• In Memoriam' : ''}
                              </Typography>
                            </Box>
                          </Box>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Assets */}
              {results.assets.length > 0 && (
                <Box sx={{ mb: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Description sx={{ fontSize: 20, color: '#16334a' }} />
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      Documents ({results.assets.length})
                    </Typography>
                  </Box>
                  {results.assets.map((asset) => (
                    <Card
                      key={asset.id}
                      sx={{
                        p: 2.5, mb: 1.5, borderRadius: 3, cursor: 'pointer',
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateX(4px)', boxShadow: 1 },
                      }}
                    >
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                          <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 500 }}>
                            {asset.originalName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            {asset.assetType} • {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })}
                          </Typography>
                        </Box>
                        <Chip label={asset.assetType} size="small" sx={{ backgroundColor: '#f6f3ee', fontSize: '0.7rem' }} />
                      </Box>
                    </Card>
                  ))}
                </Box>
              )}

              {/* No Results */}
              {results.totalResults === 0 && query.trim() && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <Typography variant="h6" sx={{ color: '#546669', mb: 1 }}>
                    No results found
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#999' }}>
                    Try a different search term or browse the archive sections.
                  </Typography>
                </Box>
              )}
            </Box>
          )}

          {/* Initial State */}
          {!results && !query.trim() && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography variant="body1" sx={{ color: '#546669' }}>
                Start typing to search across all stories, people, and documents in your archive.
              </Typography>
            </Box>
          )}
        </Box>
      </Layout>
    </>
  )
}
