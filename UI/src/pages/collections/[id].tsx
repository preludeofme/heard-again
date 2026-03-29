import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useRouter } from 'next/router'
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Card, Grid, Button, IconButton, Chip,
  CircularProgress, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  List, ListItem, ListItemText, ListItemAvatar, Avatar, Checkbox, TextField,
  Alert,
} from '@mui/material'
import {
  ArrowBack, Delete, Edit, AutoStories, Schedule, Person,
  ArrowForward, Add, Close, Search,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface CollectionDetail {
  id: string
  name: string
  description?: string
  isPinned: boolean
  createdBy: { id: string; displayName?: string }
  stories: Array<{
    id: string
    sortOrder: number
    addedAt: string
    addedBy: { id: string; displayName?: string }
    story: {
      id: string
      title: string
      excerpt?: string
      storyType: string
      status: string
      tags: string[]
      createdAt: string
      subject?: { id: string; firstName: string; lastName?: string }
    }
  }>
  createdAt: string
}

export default function CollectionDetailPage() {
  const router = useRouter()
  const { id } = router.query
  const [collection, setCollection] = useState<CollectionDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Add Story dialog state
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [availableStories, setAvailableStories] = useState<Array<{
    id: string
    title: string
    excerpt?: string
    storyType: string
    createdAt: string
    subject?: { firstName: string; lastName?: string }
  }>>([])
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set())
  const [isAdding, setIsAdding] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [addError, setAddError] = useState<string | null>(null)

  const fetchCollection = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    try {
      const res = await fetch(`/api/collections/${id}`)
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load collection')
      setCollection(data.data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCollection()
  }, [fetchCollection])

  const handleRemoveStory = async (collectionStoryId: string, storyId: string) => {
    try {
      await fetch(`/api/collections/${id}/stories`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storyId }),
      })
      setCollection(prev => prev ? {
        ...prev,
        stories: prev.stories.filter(s => s.id !== collectionStoryId),
      } : null)
    } catch {
      // Silently fail
    }
  }
  
  const fetchAvailableStories = useCallback(async () => {
    try {
      const res = await fetch('/api/stories?status=PUBLISHED&limit=100')
      const data = await res.json()
      if (data.success) {
        // Filter out stories already in collection
        const existingIds = new Set(collection?.stories.map(s => s.story.id) || [])
        setAvailableStories(data.data.stories.filter((s: any) => !existingIds.has(s.id)))
      }
    } catch {
      setAddError('Failed to load stories')
    }
  }, [collection])

  const handleOpenAddDialog = async () => {
    setShowAddDialog(true)
    setSelectedStories(new Set())
    setSearchQuery('')
    setAddError(null)
    await fetchAvailableStories()
  }

  const handleToggleStory = (storyId: string) => {
    setSelectedStories(prev => {
      const next = new Set(prev)
      if (next.has(storyId)) {
        next.delete(storyId)
      } else {
        next.add(storyId)
      }
      return next
    })
  }

  const handleAddStories = async () => {
    if (!id || selectedStories.size === 0) return
    setIsAdding(true)
    setAddError(null)
    
    try {
      const promises = Array.from(selectedStories).map(storyId =>
        fetch(`/api/collections/${id}/stories`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ storyId }),
        })
      )
      
      await Promise.all(promises)
      setShowAddDialog(false)
      fetchCollection()
    } catch {
      setAddError('Failed to add stories')
    } finally {
      setIsAdding(false)
    }
  }

  const personName = (p?: { firstName: string; lastName?: string }) =>
    p ? `${p.firstName}${p.lastName ? ' ' + p.lastName : ''}` : ''

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  if (error || !collection) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 2 }}>
          <Typography color="error">{error || 'Collection not found'}</Typography>
          <Button variant="contained" onClick={() => router.push('/collections')}>Back to Collections</Button>
        </Box>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>{collection.name} - Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4' }}>
          {/* Header */}
          <Box sx={{ px: { xs: 3, md: 8 }, py: 4 }}>
            <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
              <IconButton onClick={() => router.push('/collections')} sx={{ color: '#16334a', mb: 2 }}>
                <ArrowBack />
              </IconButton>

              <Typography
                variant="h3"
                className="serif-font"
                sx={{ color: '#16334a', fontStyle: 'italic', mb: 1 }}
              >
                {collection.name}
              </Typography>

              {collection.description && (
                <Typography variant="body1" sx={{ color: '#546669', mb: 2 }}>
                  {collection.description}
                </Typography>
              )}

              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <Chip
                  label={`${collection.stories.length} ${collection.stories.length === 1 ? 'story' : 'stories'}`}
                  sx={{ backgroundColor: '#d0e3e6', color: '#16334a' }}
                />
                {collection.createdBy.displayName && (
                  <Typography variant="caption" sx={{ color: '#999' }}>
                    Created by {collection.createdBy.displayName}
                  </Typography>
                )}
                <Typography variant="caption" sx={{ color: '#999' }}>
                  {formatDistanceToNow(new Date(collection.createdAt), { addSuffix: true })}
                </Typography>
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<Add />}
                  onClick={handleOpenAddDialog}
                  sx={{ ml: 'auto', borderRadius: 2 }}
                >
                  Add Stories
                </Button>
              </Box>
            </Box>
          </Box>

          <Divider />

          {/* Stories List */}
          <Box sx={{ px: { xs: 3, md: 8 }, py: 4 }}>
            <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
              {collection.stories.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 12 }}>
                  <AutoStories sx={{ fontSize: 64, color: '#d0e3e6', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: '#546669', mb: 1 }}>
                    No stories in this collection yet
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#999' }}>
                    Add stories from the Stories page to organize them here.
                  </Typography>
                </Box>
              ) : (
                <Grid container spacing={3}>
                  {collection.stories.map((cs) => (
                    <Grid key={cs.id} size={{ xs: 12, md: 6, lg: 4 }}>
                      <Card
                        sx={{
                          p: 4,
                          borderRadius: 4,
                          height: '100%',
                          display: 'flex',
                          flexDirection: 'column',
                          cursor: 'pointer',
                          position: 'relative',
                          transition: 'transform 0.2s, box-shadow 0.2s',
                          '&:hover': {
                            transform: 'translateY(-4px)',
                            boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                          },
                        }}
                        onClick={() => router.push(`/stories/${cs.story.id}`)}
                      >
                        {/* Story Type Badge */}
                        <Chip
                          label={cs.story.storyType}
                          size="small"
                          sx={{
                            alignSelf: 'flex-start',
                            mb: 2,
                            backgroundColor: '#f6f3ee',
                            color: '#546669',
                            fontSize: '0.7rem',
                          }}
                        />

                        <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 1 }}>
                          {cs.story.title}
                        </Typography>

                        {cs.story.excerpt && (
                          <Typography
                            variant="body2"
                            sx={{ color: '#666', mb: 2, flexGrow: 1, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                          >
                            {cs.story.excerpt}
                          </Typography>
                        )}

                        {/* Meta */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 2 }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            {cs.story.subject && (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Person sx={{ fontSize: 14, color: '#546669' }} />
                                <Typography variant="caption" sx={{ color: '#546669' }}>
                                  {personName(cs.story.subject)}
                                </Typography>
                              </Box>
                            )}
                          </Box>
                          <Typography variant="caption" sx={{ color: '#999' }}>
                            {formatDistanceToNow(new Date(cs.story.createdAt), { addSuffix: true })}
                          </Typography>
                        </Box>

                        {/* Remove button */}
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveStory(cs.id, cs.story.id)
                          }}
                          sx={{
                            position: 'absolute', top: 12, right: 12,
                            color: '#ccc', '&:hover': { color: '#e53935' },
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Box>
          </Box>
        </Box>
      </Layout>
      
      {/* Add Stories Dialog */}
      <Dialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#16334a' }}>
            Add Stories to Collection
          </Typography>
          <IconButton onClick={() => setShowAddDialog(false)} size="small">
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {addError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {addError}
            </Alert>
          )}
          
          <TextField
            fullWidth
            size="small"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <Search sx={{ color: '#999', mr: 1 }} />,
            }}
            sx={{ mb: 2 }}
          />
          
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            {selectedStories.size} selected
          </Typography>
          
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {availableStories
              .filter(s => 
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (s.excerpt && s.excerpt.toLowerCase().includes(searchQuery.toLowerCase()))
              )
              .map((story) => (
                <ListItem
                  key={story.id}
                  dense
                  onClick={() => handleToggleStory(story.id)}
                  sx={{
                    cursor: 'pointer',
                    borderRadius: 2,
                    mb: 0.5,
                    '&:hover': { backgroundColor: 'rgba(208, 227, 230, 0.3)' },
                  }}
                >
                  <Checkbox
                    edge="start"
                    checked={selectedStories.has(story.id)}
                    onChange={() => handleToggleStory(story.id)}
                    tabIndex={-1}
                    disableRipple
                  />
                  <ListItemAvatar>
                    <Avatar sx={{ backgroundColor: '#d0e3e6' }}>
                      <AutoStories sx={{ fontSize: 20, color: '#16334a' }} />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={story.title}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Chip size="small" label={story.storyType} sx={{ height: 20, fontSize: '0.7rem' }} />
                        {story.subject && (
                          <Typography variant="caption" color="text.secondary">
                            {personName(story.subject)}
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            {availableStories.filter(s => 
              s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              (s.excerpt && s.excerpt.toLowerCase().includes(searchQuery.toLowerCase()))
            ).length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography variant="body2" color="text.secondary">
                  {searchQuery ? 'No stories match your search' : 'No available stories to add'}
                </Typography>
              </Box>
            )}
          </List>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setShowAddDialog(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAddStories}
            disabled={selectedStories.size === 0 || isAdding}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {isAdding ? 'Adding...' : `Add ${selectedStories.size} Stories`}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
