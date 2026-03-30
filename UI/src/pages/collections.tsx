import Head from 'next/head'
import { Layout } from '@/components/layout/Layout'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import {
  Box, Typography, Card, Grid, Button, TextField, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress,
  Chip, Avatar,
} from '@mui/material'
import {
  Add, Collections as CollectionsIcon, ArrowForward,
  Delete, Edit, Close,
} from '@mui/icons-material'
import { formatDistanceToNow } from 'date-fns'

interface Collection {
  id: string
  name: string
  description?: string
  isDefault: boolean
  storyCount: number
  createdAt: string
}

export default function CollectionsPage() {
  const router = useRouter()
  const [collections, setCollections] = useState<Collection[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('/api/collections', { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setCollections(data.data || [])
      }
    } catch {
      // Silently fail
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCollections()
  }, [fetchCollections])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setIsCreating(true)
    try {
      const res = await fetch('/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: newName, description: newDescription }),
      })
      if (res.ok) {
        setShowCreateDialog(false)
        setNewName('')
        setNewDescription('')
        fetchCollections()
      }
    } catch {
      // Silently fail
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`/api/collections/${id}`, { method: 'DELETE', credentials: 'include' })
      setCollections(prev => prev.filter(c => c.id !== id))
    } catch {
      // Silently fail
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <CircularProgress />
        </Box>
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>Collections - Heard Again</title>
        <meta name="description" content="Organize your memories into collections" />
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
          {/* Header */}
          <Box sx={{ maxWidth: 1200, mx: 'auto', mb: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 2 }}>
            <Box>
              <Typography
                variant="h3"
                className="serif-font"
                sx={{ color: '#16334a', fontStyle: 'italic', mb: 1 }}
              >
                Collections
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669' }}>
                Organize your stories and memories into themed collections.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={() => setShowCreateDialog(true)}
              sx={{
                backgroundColor: '#16334a',
                borderRadius: 3,
                py: 1.5,
                px: 3,
                '&:hover': { backgroundColor: '#2e4a62' },
              }}
            >
              New Collection
            </Button>
          </Box>

          {/* Collections Grid */}
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            {collections.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 12 }}>
                <CollectionsIcon sx={{ fontSize: 64, color: '#d0e3e6', mb: 2 }} />
                <Typography variant="h6" sx={{ color: '#546669', mb: 1 }}>
                  No collections yet
                </Typography>
                <Typography variant="body2" sx={{ color: '#999', mb: 3 }}>
                  Create your first collection to start organizing memories.
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => setShowCreateDialog(true)}
                  sx={{ borderColor: '#16334a', color: '#16334a', borderRadius: 3 }}
                >
                  Create Collection
                </Button>
              </Box>
            ) : (
              <Grid container spacing={3}>
                {collections.map((collection) => (
                  <Grid key={collection.id} size={{ xs: 12, sm: 6, md: 4 }}>
                    <Card
                      sx={{
                        p: 4,
                        borderRadius: 4,
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        transition: 'transform 0.2s, box-shadow 0.2s',
                        cursor: 'pointer',
                        position: 'relative',
                        '&:hover': {
                          transform: 'translateY(-4px)',
                          boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
                        },
                      }}
                      onClick={() => router.push(`/collections/${collection.id}`)}
                    >
                      {/* Collection Icon */}
                      <Box
                        sx={{
                          width: 48, height: 48, borderRadius: 3,
                          backgroundColor: collection.isDefault ? '#16334a' : '#d0e3e6',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          mb: 3,
                        }}
                      >
                        <CollectionsIcon sx={{ color: collection.isDefault ? 'white' : '#16334a', fontSize: 24 }} />
                      </Box>

                      <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600, mb: 1 }}>
                        {collection.name}
                      </Typography>

                      {collection.description && (
                        <Typography variant="body2" sx={{ color: '#666', mb: 2, flexGrow: 1 }} noWrap>
                          {collection.description}
                        </Typography>
                      )}

                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto', pt: 2 }}>
                        <Chip
                          label={`${collection.storyCount} ${collection.storyCount === 1 ? 'story' : 'stories'}`}
                          size="small"
                          sx={{ backgroundColor: '#f6f3ee', color: '#546669' }}
                        />
                        <Typography variant="caption" sx={{ color: '#999' }}>
                          {formatDistanceToNow(new Date(collection.createdAt), { addSuffix: true })}
                        </Typography>
                      </Box>

                      {/* Delete button (non-default only) */}
                      {!collection.isDefault && (
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(collection.id)
                          }}
                          sx={{
                            position: 'absolute', top: 12, right: 12,
                            color: '#ccc', '&:hover': { color: '#e53935' },
                          }}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      )}
                    </Card>
                  </Grid>
                ))}
              </Grid>
            )}
          </Box>

          {/* Create Dialog */}
          <Dialog
            open={showCreateDialog}
            onClose={() => setShowCreateDialog(false)}
            maxWidth="sm"
            fullWidth
            PaperProps={{ sx: { borderRadius: 4 } }}
          >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 600 }}>
                Create Collection
              </Typography>
              <IconButton onClick={() => setShowCreateDialog(false)} size="small">
                <Close />
              </IconButton>
            </DialogTitle>
            <DialogContent sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Collection Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Summer Memories, Grandpa's Stories"
                sx={{ mb: 3 }}
                autoFocus
              />
              <TextField
                fullWidth
                label="Description (optional)"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="What's this collection about?"
                multiline
                rows={3}
              />
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 3 }}>
              <Button onClick={() => setShowCreateDialog(false)} sx={{ color: '#546669' }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={!newName.trim() || isCreating}
                sx={{
                  backgroundColor: '#16334a',
                  borderRadius: 3,
                  '&:hover': { backgroundColor: '#2e4a62' },
                }}
              >
                {isCreating ? 'Creating...' : 'Create'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      </Layout>
    </>
  )
}
