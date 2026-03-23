import Head from 'next/head'
import { Layout } from '@/components/Layout'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/router'
import {
  Box, Typography, TextField, InputAdornment, Card, Avatar, Chip,
  CircularProgress, Grid, Divider, MenuItem,
} from '@mui/material'
import {
  Search as SearchIcon, AutoStories, Person, Description,
  Schedule, ArrowForward, Favorite, Tune,
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

interface FavoriteQuickStory {
  id: string
  title: string
  excerpt?: string
  favoritedAt: string
  subject?: { id: string; firstName: string; lastName?: string }
}

export default function SearchPage() {
  const router = useRouter()
  const [query, setQuery] = useState((router.query.q as string) || '')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const [favoriteStories, setFavoriteStories] = useState<FavoriteQuickStory[]>([])
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'stories' | 'people' | 'assets'>('all')
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'oldest'>('relevance')
  const [storyTypeFilter, setStoryTypeFilter] = useState<'all' | string>('all')
  const [personStatusFilter, setPersonStatusFilter] = useState<'all' | 'living' | 'deceased'>('all')
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
      if (data.success) {
        setResults(data.data)

        const normalized = q.trim()
        if (normalized) {
          setRecentSearches((prev) => {
            const next = [normalized, ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 8)
            localStorage.setItem('heard-again:recent-searches', JSON.stringify(next))
            return next
          })
        }
      }
    } catch {
      // Silently fail
    } finally {
      setIsSearching(false)
    }
  }, [])

  useEffect(() => {
    const stored = localStorage.getItem('heard-again:recent-searches')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          setRecentSearches(parsed.filter((item) => typeof item === 'string').slice(0, 8))
        }
      } catch {
        // Ignore malformed local storage values
      }
    }
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadFavoriteStories = async () => {
      try {
        const res = await fetch('/api/favorites')
        const data = await res.json()
        if (isMounted && data.success) {
          setFavoriteStories((data.data.stories || []).slice(0, 4))
        }
      } catch {
        // Silently fail
      }
    }

    loadFavoriteStories()

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const personName = (p: { firstName: string; lastName?: string; displayName?: string }) =>
    p.displayName || `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}`

  const filteredStories = (results?.stories || [])
    .filter((story) => storyTypeFilter === 'all' || story.storyType === storyTypeFilter)
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      return 0
    })

  const filteredPeople = (results?.people || []).filter((person) => {
    if (personStatusFilter === 'living') return !person.isDeceased
    if (personStatusFilter === 'deceased') return person.isDeceased
    return true
  })

  const filteredAssets = [...(results?.assets || [])].sort((a, b) => {
    if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    return 0
  })

  const filteredTotal = filteredStories.length + filteredPeople.length + filteredAssets.length
  const storyTypes = Array.from(new Set((results?.stories || []).map((story) => story.storyType))).sort()

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
              <Card sx={{ p: 2.5, borderRadius: 3, mb: 3, backgroundColor: '#fffaf2' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                  <Tune sx={{ fontSize: 18, color: '#546669' }} />
                  <Typography variant="subtitle2" sx={{ color: '#16334a', fontWeight: 700 }}>
                    Advanced Filters
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                  {[
                    { key: 'all', label: 'All' },
                    { key: 'stories', label: 'Stories' },
                    { key: 'people', label: 'People' },
                    { key: 'assets', label: 'Documents' },
                  ].map((item) => (
                    <Chip
                      key={item.key}
                      label={item.label}
                      onClick={() => setContentTypeFilter(item.key as 'all' | 'stories' | 'people' | 'assets')}
                      variant={contentTypeFilter === item.key ? 'filled' : 'outlined'}
                      sx={{
                        backgroundColor: contentTypeFilter === item.key ? '#dce9ec' : '#fff',
                        borderColor: '#dce9ec',
                      }}
                    />
                  ))}
                </Box>

                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Sort"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'relevance' | 'newest' | 'oldest')}
                    >
                      <MenuItem value="relevance">Relevance</MenuItem>
                      <MenuItem value="newest">Newest</MenuItem>
                      <MenuItem value="oldest">Oldest</MenuItem>
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="Story Type"
                      value={storyTypeFilter}
                      onChange={(e) => setStoryTypeFilter(e.target.value)}
                      disabled={contentTypeFilter === 'people' || contentTypeFilter === 'assets'}
                    >
                      <MenuItem value="all">All story types</MenuItem>
                      {storyTypes.map((type) => (
                        <MenuItem key={type} value={type}>{type}</MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      select
                      fullWidth
                      size="small"
                      label="People"
                      value={personStatusFilter}
                      onChange={(e) => setPersonStatusFilter(e.target.value as 'all' | 'living' | 'deceased')}
                      disabled={contentTypeFilter === 'stories' || contentTypeFilter === 'assets'}
                    >
                      <MenuItem value="all">All</MenuItem>
                      <MenuItem value="living">Living only</MenuItem>
                      <MenuItem value="deceased">In memoriam</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </Card>

              <Typography variant="body2" sx={{ color: '#546669', mb: 4 }}>
                {filteredTotal} result{filteredTotal !== 1 ? 's' : ''} found
              </Typography>

              {/* Stories */}
              {(contentTypeFilter === 'all' || contentTypeFilter === 'stories') && filteredStories.length > 0 && (
                <Box sx={{ mb: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AutoStories sx={{ fontSize: 20, color: '#16334a' }} />
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      Stories ({filteredStories.length})
                    </Typography>
                  </Box>
                  {filteredStories.map((story) => (
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
              {(contentTypeFilter === 'all' || contentTypeFilter === 'people') && filteredPeople.length > 0 && (
                <Box sx={{ mb: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Person sx={{ fontSize: 20, color: '#16334a' }} />
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      People ({filteredPeople.length})
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {filteredPeople.map((person) => (
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
              {(contentTypeFilter === 'all' || contentTypeFilter === 'assets') && filteredAssets.length > 0 && (
                <Box sx={{ mb: 5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Description sx={{ fontSize: 20, color: '#16334a' }} />
                    <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                      Documents ({filteredAssets.length})
                    </Typography>
                  </Box>
                  {filteredAssets.map((asset) => (
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
              {filteredTotal === 0 && query.trim() && (
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
            <Box sx={{ maxWidth: 900, mx: 'auto', py: 4 }}>
              <Typography variant="body1" sx={{ color: '#546669', textAlign: 'center', mb: 4 }}>
                Start typing to search across all stories, people, and documents in your archive.
              </Typography>

              <Grid container spacing={3}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 3 }}>
                    <Typography variant="subtitle1" sx={{ color: '#16334a', fontWeight: 600, mb: 1.5 }}>
                      Recent Searches
                    </Typography>
                    {recentSearches.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#7c8688' }}>
                        Your recent searches will appear here.
                      </Typography>
                    ) : (
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {recentSearches.map((item) => (
                          <Chip
                            key={item}
                            label={item}
                            onClick={() => setQuery(item)}
                            icon={<SearchIcon sx={{ fontSize: '1rem !important' }} />}
                            sx={{ backgroundColor: '#f6f3ee', cursor: 'pointer' }}
                          />
                        ))}
                      </Box>
                    )}
                  </Card>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Card sx={{ p: 3, borderRadius: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                      <Typography variant="subtitle1" sx={{ color: '#16334a', fontWeight: 600 }}>
                        Favorite Stories
                      </Typography>
                      <Chip
                        icon={<Favorite sx={{ fontSize: '0.95rem !important' }} />}
                        label="View All"
                        onClick={() => router.push('/favorites')}
                        size="small"
                        sx={{ backgroundColor: '#fdecec', color: '#a13030', cursor: 'pointer' }}
                      />
                    </Box>

                    {favoriteStories.length === 0 ? (
                      <Typography variant="body2" sx={{ color: '#7c8688' }}>
                        Favorite stories will appear here for quick access.
                      </Typography>
                    ) : (
                      <Box>
                        {favoriteStories.map((story, index) => (
                          <Box key={story.id}>
                            <Box
                              onClick={() => router.push(`/stories/${story.id}`)}
                              sx={{ py: 1.25, cursor: 'pointer', '&:hover': { opacity: 0.8 } }}
                            >
                              <Typography variant="body2" sx={{ color: '#16334a', fontWeight: 600 }} noWrap>
                                {story.title}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#7c8688' }}>
                                {story.subject ? `${story.subject.firstName}${story.subject.lastName ? ` ${story.subject.lastName}` : ''} • ` : ''}
                                {formatDistanceToNow(new Date(story.favoritedAt), { addSuffix: true })}
                              </Typography>
                            </Box>
                            {index < favoriteStories.length - 1 && <Divider sx={{ borderColor: 'rgba(22, 51, 74, 0.08)' }} />}
                          </Box>
                        ))}
                      </Box>
                    )}
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </Box>
      </Layout>
    </>
  )
}
