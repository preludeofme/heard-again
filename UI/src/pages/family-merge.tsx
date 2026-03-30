import Head from 'next/head'
import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material'
import {
  CompareArrows,
  CheckCircle,
  Cancel,
  Delete,
  PlayArrow,
  Visibility,
} from '@mui/icons-material'
import { Layout } from '@/components/layout/Layout'

type MergeStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CONFLICT' | 'MERGED' | 'FAILED'

interface Workspace {
  id: string
  name: string
  slug: string
  isDefault: boolean
  role: string
}

interface Match {
  id: string
  targetPersonId: string
  sourcePersonId: string
  targetPerson: {
    firstName: string
    lastName: string | null
    birthDate: string | null
  }
  sourcePerson: {
    firstName: string
    lastName: string | null
    birthDate: string | null
  }
  matchScore: number
  matchReason: string
  isIncluded: boolean
  status: MergeStatus
}

interface Proposal {
  id: string
  status: MergeStatus
  targetWorkspaceId: string
  sourceWorkspaceId: string
  targetWorkspace: {
    name: string
    slug: string
  }
  sourceWorkspace: {
    name: string
    slug: string
  }
  proposedBy: {
    name: string | null
    email: string
  }
  overallMatchScore: number | null
  matchedPeopleCount: number
  totalSourcePeople: number
  createdAt: string
  _count: {
    personMatches: number
  }
}

function statusColor(status: MergeStatus): 'default' | 'warning' | 'success' | 'error' | 'info' {
  switch (status) {
    case 'MERGED':
      return 'success'
    case 'APPROVED':
      return 'info'
    case 'PENDING':
      return 'warning'
    case 'REJECTED':
    case 'FAILED':
      return 'error'
    case 'CONFLICT':
      return 'error'
    default:
      return 'default'
  }
}

export default function FamilyMergePage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true)
  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [selectedSourceWorkspace, setSelectedSourceWorkspace] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<{
    matches: Array<{
      targetPerson: { firstName: string; lastName: string | null }
      sourcePerson: { firstName: string; lastName: string | null }
      matchScore: number
      matchReason: string
    }>
    overallMatchScore: number
    matchedPeopleCount: number
    totalSourcePeople: number
  } | null>(null)
  
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null)
  const [proposalMatches, setProposalMatches] = useState<Match[]>([])
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  
  const [isExecuting, setIsExecuting] = useState(false)

  const loadProposals = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/family-merge/proposals', { credentials: 'include' })
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load merge proposals')
      }
      
      setProposals(data.data.proposals || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load proposals')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load workspaces
  useEffect(() => {
    const loadWorkspaces = async () => {
      setIsLoadingWorkspaces(true)
      try {
        const response = await fetch('/api/workspaces', { credentials: 'include' })
        const data = await response.json()
        
        if (response.ok && data.success) {
          setWorkspaces(data.data || [])
        }
      } catch (err) {
        console.error('Failed to load workspaces', err)
      } finally {
        setIsLoadingWorkspaces(false)
      }
    }
    
    loadWorkspaces()
  }, [])

  const analyzeWorkspace = async () => {
    if (!selectedSourceWorkspace) return
    
    setIsAnalyzing(true)
    setError(null)
    setAnalysisResult(null)
    
    try {
      const response = await fetch('/api/family-merge/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceWorkspaceId: selectedSourceWorkspace, minScore: 0.6 })
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to analyze workspace')
      }
      
      setAnalysisResult(data.data)
    } catch (err: any) {
      setError(err.message || 'Failed to analyze workspace')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const createProposal = async () => {
    if (!selectedSourceWorkspace || !analysisResult) return
    
    setIsAnalyzing(true)
    setError(null)
    
    try {
      const response = await fetch('/api/family-merge/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceWorkspaceId: selectedSourceWorkspace, minScore: 0.6 })
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to create proposal')
      }
      
      setSuccess('Merge proposal created successfully')
      setIsCreateOpen(false)
      setSelectedSourceWorkspace('')
      setAnalysisResult(null)
      await loadProposals()
    } catch (err: any) {
      setError(err.message || 'Failed to create proposal')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const viewProposal = async (proposal: Proposal) => {
    setSelectedProposal(proposal)
    setIsDetailOpen(true)
    setIsLoadingDetail(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/family-merge/proposals/${proposal.id}`, { credentials: 'include' })
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load proposal details')
      }
      
      setProposalMatches(data.data.proposal.personMatches || [])
    } catch (err: any) {
      setError(err.message || 'Failed to load proposal details')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  const approveProposal = async () => {
    if (!selectedProposal) return
    
    setError(null)
    try {
      const response = await fetch(`/api/family-merge/proposals/${selectedProposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'APPROVED' })
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to approve proposal')
      }
      
      setSuccess('Proposal approved successfully')
      setIsDetailOpen(false)
      await loadProposals()
    } catch (err: any) {
      setError(err.message || 'Failed to approve proposal')
    }
  }

  const rejectProposal = async () => {
    if (!selectedProposal) return
    
    setError(null)
    try {
      const response = await fetch(`/api/family-merge/proposals/${selectedProposal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: 'REJECTED' })
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to reject proposal')
      }
      
      setSuccess('Proposal rejected successfully')
      setIsDetailOpen(false)
      await loadProposals()
    } catch (err: any) {
      setError(err.message || 'Failed to reject proposal')
    }
  }

  const executeMerge = async () => {
    if (!selectedProposal) return
    
    setIsExecuting(true)
    setError(null)
    
    try {
      const response = await fetch('/api/family-merge/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ proposalId: selectedProposal.id })
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to execute merge')
      }
      
      const result = data.data.result
      setSuccess(`Merge completed! Merged ${result.mergedPeople} people, transferred ${result.transferredStories} stories, ${result.transferredDocuments} documents.`)
      setIsDetailOpen(false)
      await loadProposals()
    } catch (err: any) {
      setError(err.message || 'Failed to execute merge')
    } finally {
      setIsExecuting(false)
    }
  }

  const deleteProposal = async (proposalId: string) => {
    if (!confirm('Are you sure you want to delete this proposal?')) return
    
    setError(null)
    try {
      const response = await fetch(`/api/family-merge/proposals/${proposalId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      
      const data = await response.json()
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete proposal')
      }
      
      setSuccess('Proposal deleted successfully')
      await loadProposals()
    } catch (err: any) {
      setError(err.message || 'Failed to delete proposal')
    }
  }

  // Filter out current workspace from available workspaces
  const availableWorkspaces = workspaces.filter(
    (w) => !w.isDefault
  ) || []

  return (
    <>
      <Head>
        <title>Family Merge - Heard Again</title>
      </Head>
      <Layout>
        <Box sx={{ minHeight: '100vh', backgroundColor: '#fcf9f4', px: { xs: 3, md: 8 }, py: 6 }}>
          <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h4" className="serif-font" sx={{ color: '#16334a', fontStyle: 'italic' }}>
                Family Merge
              </Typography>
              <Button
                variant="contained"
                startIcon={<CompareArrows />}
                onClick={() => setIsCreateOpen(true)}
                disabled={availableWorkspaces.length === 0}
              >
                New Merge Proposal
              </Button>
            </Box>
            <Typography variant="body2" sx={{ color: '#546669', mb: 4 }}>
              Merge family trees from different workspaces. Matches people by name, dates, and parents.
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            <Card sx={{ borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ color: '#16334a', fontWeight: 700, mb: 2 }}>
                  Merge Proposals
                </Typography>

                {isLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : proposals.length === 0 ? (
                  <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f5f5f5' }}>
                    <CompareArrows sx={{ fontSize: 48, color: '#546669', mb: 2 }} />
                    <Typography variant="h6" sx={{ color: '#16334a', mb: 1 }}>
                      No merge proposals yet
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6f7c7f' }}>
                      Create a new proposal to merge family trees from another workspace.
                    </Typography>
                  </Paper>
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell>Source Workspace</TableCell>
                          <TableCell>Status</TableCell>
                          <TableCell>Matches</TableCell>
                          <TableCell>Created</TableCell>
                          <TableCell>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {proposals.map((proposal) => (
                          <TableRow key={proposal.id}>
                            <TableCell>
                              <Typography variant="subtitle2" sx={{ color: '#16334a' }}>
                                {proposal.sourceWorkspace?.name || 'Unknown'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                label={proposal.status}
                                color={statusColor(proposal.status)}
                                size="small"
                              />
                            </TableCell>
                            <TableCell>
                              {proposal.matchedPeopleCount} / {proposal.totalSourcePeople} people
                              {proposal.overallMatchScore && (
                                <Typography variant="caption" display="block" sx={{ color: '#6f7c7f' }}>
                                  {(proposal.overallMatchScore * 100).toFixed(0)}% match score
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              {new Date(proposal.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <IconButton
                                  size="small"
                                  onClick={() => viewProposal(proposal)}
                                  title="View details"
                                >
                                  <Visibility />
                                </IconButton>
                                {proposal.status === 'PENDING' && (
                                  <>
                                    <IconButton
                                      size="small"
                                      color="success"
                                      onClick={async () => {
                                        setSelectedProposal(proposal)
                                        await approveProposal()
                                      }}
                                      title="Approve"
                                    >
                                      <CheckCircle />
                                    </IconButton>
                                    <IconButton
                                      size="small"
                                      color="error"
                                      onClick={async () => {
                                        setSelectedProposal(proposal)
                                        await rejectProposal()
                                      }}
                                      title="Reject"
                                    >
                                      <Cancel />
                                    </IconButton>
                                  </>
                                )}
                                {proposal.status === 'APPROVED' && (
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={async () => {
                                      setSelectedProposal(proposal)
                                      await executeMerge()
                                    }}
                                    disabled={isExecuting}
                                    title="Execute merge"
                                  >
                                    <PlayArrow />
                                  </IconButton>
                                )}
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => deleteProposal(proposal.id)}
                                  disabled={proposal.status === 'MERGED'}
                                  title="Delete"
                                >
                                  <Delete />
                                </IconButton>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>
          </Box>
        </Box>

        {/* Create Proposal Dialog */}
        <Dialog open={isCreateOpen} onClose={() => setIsCreateOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Create Merge Proposal</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#6f7c7f', mb: 3 }}>
              Select a workspace to merge into your current family tree. We'll analyze and suggest matching people.
            </Typography>

            <FormControl fullWidth sx={{ mb: 3 }}>
              <InputLabel>Source Workspace</InputLabel>
              <Select
                value={selectedSourceWorkspace}
                onChange={(e) => {
                  setSelectedSourceWorkspace(e.target.value)
                  setAnalysisResult(null)
                }}
                disabled={isLoadingWorkspaces || isAnalyzing}
              >
                {availableWorkspaces.map((workspace: { id: string; name: string }) => (
                  <MenuItem key={workspace.id} value={workspace.id}>
                    {workspace.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {selectedSourceWorkspace && !analysisResult && (
              <Button
                variant="outlined"
                onClick={analyzeWorkspace}
                disabled={isAnalyzing}
                startIcon={isAnalyzing ? <CircularProgress size={20} /> : <CompareArrows />}
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Matches'}
              </Button>
            )}

            {analysisResult && (
              <Box sx={{ mt: 3 }}>
                <Alert severity={analysisResult.matchedPeopleCount > 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
                  Found {analysisResult.matchedPeopleCount} potential matches out of {analysisResult.totalSourcePeople} people
                  ({(analysisResult.overallMatchScore * 100).toFixed(0)}% overall match score)
                </Alert>

                {analysisResult.matches.length > 0 && (
                  <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Current Person</TableCell>
                          <TableCell>Source Person</TableCell>
                          <TableCell>Match Score</TableCell>
                          <TableCell>Reason</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analysisResult.matches.slice(0, 5).map((match, idx) => (
                          <TableRow key={idx}>
                            <TableCell>
                              {match.targetPerson.firstName} {match.targetPerson.lastName}
                            </TableCell>
                            <TableCell>
                              {match.sourcePerson.firstName} {match.sourcePerson.lastName}
                            </TableCell>
                            <TableCell>{(match.matchScore * 100).toFixed(0)}%</TableCell>
                            <TableCell>{match.matchReason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    {analysisResult.matches.length > 5 && (
                      <Typography variant="caption" sx={{ p: 2, display: 'block', textAlign: 'center' }}>
                        ...and {analysisResult.matches.length - 5} more matches
                      </Typography>
                    )}
                  </TableContainer>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => {
              setIsCreateOpen(false)
              setSelectedSourceWorkspace('')
              setAnalysisResult(null)
            }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={createProposal}
              disabled={!analysisResult || analysisResult.matchedPeopleCount === 0 || isAnalyzing}
            >
              Create Proposal
            </Button>
          </DialogActions>
        </Dialog>

        {/* Proposal Detail Dialog */}
        <Dialog open={isDetailOpen} onClose={() => setIsDetailOpen(false)} maxWidth="lg" fullWidth>
          <DialogTitle>
            Merge Proposal: {selectedProposal?.sourceWorkspace?.name}
          </DialogTitle>
          <DialogContent>
            {isLoadingDetail ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <>
                <Box sx={{ mb: 3 }}>
                  <Chip
                    label={selectedProposal?.status}
                    color={statusColor(selectedProposal?.status || 'PENDING')}
                    sx={{ mr: 1 }}
                  />
                  <Typography variant="body2" component="span" sx={{ color: '#6f7c7f' }}>
                    {selectedProposal?.matchedPeopleCount} matches found •
                    {(selectedProposal?.overallMatchScore ? selectedProposal.overallMatchScore * 100 : 0).toFixed(0)}% match score
                  </Typography>
                </Box>

                <Typography variant="h6" sx={{ color: '#16334a', mb: 2 }}>
                  Matched People
                </Typography>

                <List>
                  {proposalMatches.map((match) => (
                    <ListItem key={match.id} divider>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box>
                              <Typography variant="subtitle2" sx={{ color: '#16334a' }}>
                                {match.targetPerson.firstName} {match.targetPerson.lastName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#6f7c7f' }}>
                                Current workspace
                              </Typography>
                            </Box>
                            <CompareArrows sx={{ color: '#546669' }} />
                            <Box>
                              <Typography variant="subtitle2" sx={{ color: '#16334a' }}>
                                {match.sourcePerson.firstName} {match.sourcePerson.lastName}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#6f7c7f' }}>
                                Source workspace
                              </Typography>
                            </Box>
                            <Chip
                              label={`${(match.matchScore * 100).toFixed(0)}%`}
                              size="small"
                              color={match.matchScore > 0.8 ? 'success' : 'warning'}
                            />
                            <Typography variant="caption" sx={{ color: '#6f7c7f' }}>
                              {match.matchReason}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsDetailOpen(false)}>Close</Button>
            {selectedProposal?.status === 'PENDING' && (
              <>
                <Button onClick={rejectProposal} color="error" variant="outlined">
                  Reject
                </Button>
                <Button onClick={approveProposal} color="success" variant="contained">
                  Approve
                </Button>
              </>
            )}
            {selectedProposal?.status === 'APPROVED' && (
              <Button
                onClick={executeMerge}
                color="primary"
                variant="contained"
                disabled={isExecuting}
                startIcon={isExecuting ? <CircularProgress size={20} /> : <PlayArrow />}
              >
                {isExecuting ? 'Executing...' : 'Execute Merge'}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      </Layout>
    </>
  )
}
