'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  Stack,
  Alert,
  Collapse,
  IconButton,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Divider,
} from '@mui/material'
import {
  Psychology as AIIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Save as SaveIcon,
  PlayArrow as ActivateIcon,
  Edit as EditIcon,
  SmartToy as RobotIcon,
} from '@mui/icons-material'
import { fetchWithCSRF } from '@/lib/api-client'

interface AIProfileData {
  id?: string
  systemPrompt: string
  responseGuidelines: string[]
  formality: 'very_informal' | 'informal' | 'neutral' | 'formal' | 'very_formal'
  averageSentenceLength: number
  behaviorInstructions: string[]
  relationshipInstructions: Record<string, string>
  topicInstructions: Record<string, string>
  contextInstructions: Record<string, string>
  styleOverrides: {
    warmth?: number
    humor?: number
    storytelling?: number
  }
  status: 'draft' | 'active' | 'archived'
  version?: number
  lastUpdated?: string
}

interface AIProfileSectionProps {
  personId: string
  personName: string
}

const formalityLevels = [
  { value: 'very_informal', label: 'Very Informal' },
  { value: 'informal', label: 'Informal' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'formal', label: 'Formal' },
  { value: 'very_formal', label: 'Very Formal' },
]

export function AIProfileSection({ personId, personName }: AIProfileSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState(0)
  
  const [profile, setProfile] = useState<AIProfileData>({
    systemPrompt: '',
    responseGuidelines: [],
    formality: 'neutral',
    averageSentenceLength: 15,
    behaviorInstructions: [],
    relationshipInstructions: {},
    topicInstructions: {},
    contextInstructions: {},
    styleOverrides: {},
    status: 'draft',
  })

  // Load existing profile
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const res = await fetch(`/api/people/${personId}/ai-persona`, {
          credentials: 'include',
        })
        const data = await res.json()
        
        if (data.success && data.data) {
          setProfile({
            systemPrompt: data.data.systemPrompt || '',
            responseGuidelines: data.data.responseGuidelines || [],
            formality: data.data.formality || 'neutral',
            averageSentenceLength: data.data.averageSentenceLength || 15,
            behaviorInstructions: data.data.behaviorInstructions || [],
            relationshipInstructions: data.data.relationshipInstructions || {},
            topicInstructions: data.data.topicInstructions || {},
            contextInstructions: data.data.contextInstructions || {},
            styleOverrides: data.data.styleOverrides || {},
            status: data.data.status || 'draft',
            version: data.data.version,
            lastUpdated: data.data.lastUpdated,
          })
        }
      } catch (err) {
        console.error('Failed to load AI profile:', err)
      }
    }

    if (personId) {
      loadProfile()
    }
  }, [personId])

  const handleSave = async () => {
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetchWithCSRF(`/api/people/${personId}/ai-persona`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(profile),
      })

      const data = await res.json()
      
      if (data.success) {
        setSuccess('AI profile saved successfully!')
        setEditing(false)
        setProfile(prev => ({ ...prev, ...data.data }))
      } else {
        setError(data.error || 'Failed to save AI profile')
      }
    } catch (err) {
      setError('Failed to save AI profile')
    } finally {
      setLoading(false)
    }
  }

  const handleActivate = async () => {
    if (!profile.version) return

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const res = await fetchWithCSRF(`/api/people/${personId}/ai-persona`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ version: profile.version }),
      })

      const data = await res.json()
      
      if (data.success) {
        setSuccess('AI profile activated! This will be used in conversations.')
        setProfile(prev => ({ ...prev, status: 'active', ...data.data }))
      } else {
        setError(data.error || 'Failed to activate AI profile')
      }
    } catch (err) {
      setError('Failed to activate AI profile')
    } finally {
      setLoading(false)
    }
  }

  const addGuideline = () => {
    setProfile(prev => ({
      ...prev,
      responseGuidelines: [...prev.responseGuidelines, ''],
    }))
  }

  const updateGuideline = (index: number, value: string) => {
    setProfile(prev => ({
      ...prev,
      responseGuidelines: prev.responseGuidelines.map((g, i) => i === index ? value : g),
    }))
  }

  const removeGuideline = (index: number) => {
    setProfile(prev => ({
      ...prev,
      responseGuidelines: prev.responseGuidelines.filter((_, i) => i !== index),
    }))
  }

  const addBehaviorInstruction = () => {
    setProfile(prev => ({
      ...prev,
      behaviorInstructions: [...prev.behaviorInstructions, ''],
    }))
  }

  const updateBehaviorInstruction = (index: number, value: string) => {
    setProfile(prev => ({
      ...prev,
      behaviorInstructions: prev.behaviorInstructions.map((b, i) => i === index ? value : b),
    }))
  }

  const removeBehaviorInstruction = (index: number) => {
    setProfile(prev => ({
      ...prev,
      behaviorInstructions: prev.behaviorInstructions.filter((_, i) => i !== index),
    }))
  }

  return (
    <Card sx={{ mt: 3, borderRadius: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <AIIcon sx={{ fontSize: 28, color: '#16334a' }} />
            <Box>
              <Typography variant="h6" sx={{ color: '#16334a' }}>
                AI Profile Configuration
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Configure how {personName} responds in AI conversations
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {profile.status === 'active' && (
              <Chip 
                label="Active" 
                color="success" 
                size="small" 
                icon={<RobotIcon />}
              />
            )}
            <IconButton onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          </Box>
        </Box>

        <Collapse in={expanded}>
          <Box sx={{ mt: 3 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                {error}
              </Alert>
            )}
            
            {success && (
              <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
              <Tab label="Basic Settings" />
              <Tab label="Response Guidelines" />
              <Tab label="Behavior & Style" />
            </Tabs>

            {activeTab === 0 && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={4}
                  label="System Prompt"
                  placeholder={`Define who ${personName} is, their personality, background, and how they should respond...`}
                  value={profile.systemPrompt}
                  onChange={(e) => setProfile(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  disabled={!editing}
                  helperText="This sets the foundation for how the AI will portray this person"
                />
                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                  <FormControl fullWidth>
                    <InputLabel>Formality Level</InputLabel>
                    <Select
                      value={profile.formality}
                      onChange={(e) => setProfile(prev => ({ 
                        ...prev, 
                        formality: e.target.value as any 
                      }))}
                      disabled={!editing}
                    >
                      {formalityLevels.map(level => (
                        <MenuItem key={level.value} value={level.value}>
                          {level.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    type="number"
                    label="Average Sentence Length"
                    value={profile.averageSentenceLength}
                    onChange={(e) => setProfile(prev => ({ 
                      ...prev, 
                      averageSentenceLength: parseFloat(e.target.value) || 15 
                    }))}
                    disabled={!editing}
                    inputProps={{ min: 5, max: 50, step: 1 }}
                    helperText="Typical sentence length (5-50 words)"
                  />
                </Box>
              </Box>
            )}

            {activeTab === 1 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Response Guidelines
                </Typography>
                {profile.responseGuidelines.map((guideline, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      placeholder="Enter a response guideline..."
                      value={guideline}
                      onChange={(e) => updateGuideline(index, e.target.value)}
                      disabled={!editing}
                    />
                    {editing && (
                      <IconButton onClick={() => removeGuideline(index)} color="error">
                        ×
                      </IconButton>
                    )}
                  </Box>
                ))}
                {editing && (
                  <Button onClick={addGuideline} sx={{ mt: 1 }}>
                    Add Guideline
                  </Button>
                )}
              </Box>
            )}

            {activeTab === 2 && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Behavior Instructions
                </Typography>
                {profile.behaviorInstructions.map((instruction, index) => (
                  <Box key={index} sx={{ display: 'flex', gap: 1, mb: 1 }}>
                    <TextField
                      fullWidth
                      placeholder="e.g., 'Always be encouraging', 'Share family stories often'"
                      value={instruction}
                      onChange={(e) => updateBehaviorInstruction(index, e.target.value)}
                      disabled={!editing}
                    />
                    {editing && (
                      <IconButton onClick={() => removeBehaviorInstruction(index)} color="error">
                        ×
                      </IconButton>
                    )}
                  </Box>
                ))}
                {editing && (
                  <Button onClick={addBehaviorInstruction} sx={{ mt: 1 }}>
                    Add Behavior Instruction
                  </Button>
                )}

                <Divider sx={{ my: 3 }} />
                
                <Typography variant="subtitle2" sx={{ mb: 2 }}>
                  Style Overrides
                </Typography>
                <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography gutterBottom>Warmth</Typography>
                    <Slider
                      value={profile.styleOverrides.warmth || 0.5}
                      onChange={(_, value) => setProfile(prev => ({
                        ...prev,
                        styleOverrides: {
                          ...prev.styleOverrides,
                          warmth: value as number,
                        },
                      }))}
                      disabled={!editing}
                      min={0}
                      max={1}
                      step={0.1}
                      marks={[
                        { value: 0, label: 'Reserved' },
                        { value: 1, label: 'Warm' },
                      ]}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography gutterBottom>Humor</Typography>
                    <Slider
                      value={profile.styleOverrides.humor || 0.5}
                      onChange={(_, value) => setProfile(prev => ({
                        ...prev,
                        styleOverrides: {
                          ...prev.styleOverrides,
                          humor: value as number,
                        },
                      }))}
                      disabled={!editing}
                      min={0}
                      max={1}
                      step={0.1}
                      marks={[
                        { value: 0, label: 'Serious' },
                        { value: 1, label: 'Humorous' },
                      ]}
                    />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography gutterBottom>Storytelling</Typography>
                    <Slider
                      value={profile.styleOverrides.storytelling || 0.5}
                      onChange={(_, value) => setProfile(prev => ({
                        ...prev,
                        styleOverrides: {
                          ...prev.styleOverrides,
                          storytelling: value as number,
                        },
                      }))}
                      disabled={!editing}
                      min={0}
                      max={1}
                      step={0.1}
                      marks={[
                        { value: 0, label: 'Direct' },
                        { value: 1, label: 'Storyteller' },
                      ]}
                    />
                  </Box>
                </Box>
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
              {editing ? (
                <>
                  <Button onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleSave}
                    variant="contained"
                    disabled={loading}
                    startIcon={<SaveIcon />}
                  >
                    {loading ? 'Saving...' : 'Save'}
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    onClick={() => setEditing(true)}
                    variant="outlined"
                    startIcon={<EditIcon />}
                  >
                    Edit Profile
                  </Button>
                  {profile.status !== 'active' && (
                    <Button 
                      onClick={handleActivate}
                      variant="contained"
                      disabled={loading || profile.status === 'draft'}
                      startIcon={<ActivateIcon />}
                    >
                      {loading ? 'Activating...' : 'Activate'}
                    </Button>
                  )}
                </>
              )}
            </Box>
          </Box>
        </Collapse>
      </CardContent>
    </Card>
  )
}
