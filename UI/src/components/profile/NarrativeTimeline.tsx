import React from 'react'
import { Box, Typography } from '@mui/material'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { ProfileColors } from './ProfileConstants'
import { extractFirstImage } from '@/lib/html-utils'

interface Story {
  id: string
  title: string
  content: string
  excerpt?: string | null
  storyDate?: string | null
}

interface NarrativeTimelineProps {
  stories: Story[]
  personId?: string
  isGlobal?: boolean
  timelineRef?: React.RefObject<HTMLDivElement | null>
  onDragStart?: (e: React.MouseEvent) => void
  onDragMove?: (e: React.MouseEvent) => void
  onDragEnd?: () => void
  onTouchStart?: (e: React.TouchEvent) => void
  onTouchMove?: (e: React.TouchEvent) => void
  hasDragged?: boolean
}

const toYear = (d?: string | null) => (d ? new Date(d).getFullYear() : null)

export function NarrativeTimeline({
  stories,
  personId,
  isGlobal = false,
  timelineRef,
  onDragStart,
  onDragMove,
  onDragEnd,
  onTouchStart,
  onTouchMove,
  hasDragged,
}: NarrativeTimelineProps) {
  const router = useRouter()
  const sortedStories = [...stories].sort((a, b) => {
    if (!a.storyDate && !b.storyDate) return 0
    if (!a.storyDate) return 1
    if (!b.storyDate) return -1
    return new Date(a.storyDate).getTime() - new Date(b.storyDate).getTime()
  })

  const handleCardClick = (storyId: string) => {
    if (!hasDragged) {
      router.push(`/stories/${storyId}`)
    }
  }

  return (
    <Box component="section" sx={{ mb: { xs: 8, md: 14 }, overflow: 'hidden' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 5 }}>
        <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: { xs: '2rem', md: '2.625rem' }, fontWeight: 700, color: ProfileColors.primary, whiteSpace: 'nowrap' }}>
          {isGlobal ? 'Family Narrative' : 'The Narrative'}
        </Typography>
        <Box sx={{ flex: 1, height: 1, bgcolor: `${ProfileColors.outlineVariant}25` }} />
        <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.72rem', color: ProfileColors.onSurfaceVariant, opacity: 0.6, userSelect: 'none' }}>
          drag to explore
        </Typography>
      </Box>

      {sortedStories.length === 0 ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <Typography sx={{ color: ProfileColors.onSurfaceVariant, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.25rem', fontStyle: 'italic' }}>
            {isGlobal ? 'No family stories have been recorded yet.' : 'No stories have been recorded yet.'}
          </Typography>
          <Box
            component={Link}
            href={isGlobal ? '/legacy?lens=stories' : personId ? `/stories/contribute?subjectId=${personId}` : '/stories/contribute'}
            sx={{ display: 'inline-block', mt: 2, color: ProfileColors.primary, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 600, fontSize: '0.9rem', borderBottom: `2px solid ${ProfileColors.primary}35`, pb: 0.25 }}
          >
            Begin the narrative →
          </Box>
        </Box>
      ) : (
        <Box sx={{ position: 'relative' }}>
          <Box sx={{ position: 'absolute', top: 310, left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${ProfileColors.outlineVariant}30, transparent)`, zIndex: 0 }} />
          <Box
            ref={timelineRef}
            onMouseDown={onDragStart}
            onMouseMove={onDragMove}
            onMouseUp={onDragEnd}
            onMouseLeave={onDragEnd}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onDragEnd}
            sx={{
              display: 'flex',
              gap: { xs: 3, md: 4 },
              overflowX: 'auto',
              pb: 5,
              pt: 2,
              px: 0.5,
              cursor: onDragStart ? 'grabbing' : 'grab',
              userSelect: 'none',
              '&::-webkit-scrollbar': { display: 'none' },
              msOverflowStyle: 'none',
              scrollbarWidth: 'none',
              '& *': { userDrag: 'none', WebkitUserDrag: 'none' }
            }}
          >
            {sortedStories.map(story => {
              const year = toYear(story.storyDate)
              const firstImg = extractFirstImage(story.content)
              return (
                <Box
                  key={story.id}
                  onClick={() => handleCardClick(story.id)}
                  sx={{ flexShrink: 0, width: { xs: 240, md: 300 }, textDecoration: 'none', position: 'relative', cursor: 'pointer', '&:hover .story-card': { transform: 'translateY(-7px)' } }}
                >
                  <Box
                    className="story-card"
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      aspectRatio: '3/4',
                      borderRadius: '2rem',
                      overflow: 'hidden',
                      background: `linear-gradient(160deg, ${ProfileColors.surfaceContainer} 0%, ${ProfileColors.surfaceContainerLow} 100%)`,
                      boxShadow: '0 8px 32px rgba(28,28,25,0.09)',
                      transition: 'transform 0.4s ease',
                      pointerEvents: 'none',
                    }}
                  >
                    {firstImg && (
                      <Box 
                        component="img" 
                        src={firstImg} 
                        sx={{ 
                          position: 'absolute', 
                          inset: 0, 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'cover',
                          opacity: 0.9
                        }} 
                      />
                    )}
                    {year && (
                      <Typography
                        sx={{
                          position: 'absolute',
                          top: 20,
                          left: 22,
                          fontFamily: 'var(--font-newsreader), serif',
                          fontSize: { xs: '2.75rem', md: '3.25rem' },
                          fontWeight: 700,
                          color: 'rgba(22,51,74,0.45)',
                          lineHeight: 1,
                        }}
                      >
                        {year}
                      </Typography>
                    )}
                  </Box>

                  {/* Timeline dot */}
                  <Box
                    sx={{
                      position: 'absolute',
                      bottom: 66,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: ProfileColors.primary,
                      border: `3px solid ${ProfileColors.surface}`,
                      outline: `2px solid ${ProfileColors.primary}28`,
                      zIndex: 10,
                    }}
                  />

                  <Box sx={{ pt: 3.5, pointerEvents: 'none' }}>
                    <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1.2rem', fontWeight: 600, color: ProfileColors.primary }}>
                      {story.title}
                    </Typography>
                    {story.excerpt && (
                      <Typography
                        sx={{
                          fontFamily: 'var(--font-manrope), sans-serif',
                          fontSize: '0.82rem',
                          color: ProfileColors.onSurfaceVariant,
                          mt: 0.75,
                          lineHeight: 1.6,
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {story.excerpt}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )
            })}

            {/* Add chapter placeholder */}
            <Box 
              onClick={() => {
                if (!hasDragged) {
                  router.push(personId ? `/stories/contribute?subjectId=${personId}` : '/stories/contribute')
                }
              }}
              sx={{ flexShrink: 0, width: { xs: 240, md: 300 }, textDecoration: 'none', cursor: 'pointer' }}
            >
              <Box
                sx={{
                  aspectRatio: '3/4',
                  borderRadius: '2rem',
                  border: `2px dashed ${ProfileColors.outlineVariant}50`,
                  bgcolor: ProfileColors.surfaceContainerLow,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: 1.5,
                  transition: 'border-color 0.2s, background 0.2s',
                  pointerEvents: 'none',
                  '&:hover': { borderColor: `${ProfileColors.primary}60`, bgcolor: ProfileColors.surfaceContainerLowest },
                }}
              >
                <span style={{ fontFamily: '"Material Symbols Outlined"', fontSize: 32, color: ProfileColors.onSurfaceVariant, opacity: 0.35 }}>add</span>
                <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: '1rem', fontStyle: 'italic', color: ProfileColors.onSurfaceVariant }}>
                  Add a chapter
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </Box>
  )
}
