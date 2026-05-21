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
  createdAt: string
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

const storyPaperAngle = (id: string): number => {
  const sum = id.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return (sum % 41) - 20
}

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
  const getStoryDate = (s: Story) =>
    s.storyDate ? new Date(s.storyDate) : new Date(s.createdAt)
  const sortedStories = [...stories].sort(
    (a, b) => getStoryDate(a).getTime() - getStoryDate(b).getTime(),
  )

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
          <Box sx={{ position: 'absolute', top: 340, left: 0, right: 0, height: 2, background: `linear-gradient(to right, transparent, ${ProfileColors.outlineVariant}30, transparent)`, zIndex: 0, pointerEvents: 'none' }} />
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
              const year = toYear(story.storyDate) ?? toYear(story.createdAt)
              const firstImg = extractFirstImage(story.content)
              const paperAngle = !firstImg ? storyPaperAngle(story.id) : 0
              const hoverTransform = paperAngle
                ? `translateY(-7px) rotate(${paperAngle}deg)`
                : 'translateY(-7px)'
              return (
                <Box
                  key={story.id}
                  onClick={() => handleCardClick(story.id)}
                  sx={{ flexShrink: 0, width: { xs: 240, md: 300 }, textDecoration: 'none', position: 'relative', cursor: 'pointer', '&:hover .story-card': { transform: hoverTransform } }}
                >
                  <Box
                    className="story-card"
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      aspectRatio: '3/4',
                      borderRadius: '2rem',
                      overflow: 'hidden',
                      background: firstImg
                        ? `linear-gradient(160deg, ${ProfileColors.surfaceContainer} 0%, ${ProfileColors.surfaceContainerLow} 100%)`
                        : 'none',
                      boxShadow: firstImg
                        ? '0 8px 32px rgba(28,28,25,0.09)'
                        : '0 6px 28px rgba(28,28,25,0.14), 2px 3px 8px rgba(28,28,25,0.06)',
                      transition: 'transform 0.4s ease',
                      pointerEvents: 'none',
                      transform: paperAngle ? `rotate(${paperAngle}deg)` : undefined,
                    }}
                  >
                    {firstImg ? (
                      <Box
                        component="img"
                        src={firstImg}
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                          opacity: 0.9,
                        }}
                      />
                    ) : (
                      <Box
                        sx={{
                          position: 'absolute',
                          inset: 0,
                          bgcolor: '#faf6ef',
                          backgroundImage:
                            'repeating-linear-gradient(to bottom, transparent 0, transparent 23px, rgba(0,0,0,0.055) 23px, rgba(0,0,0,0.055) 24px)',
                          backgroundPosition: '0 32px',
                          px: 3,
                          pt: 10,
                          pb: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <Typography
                          sx={{
                            fontFamily: 'var(--font-newsreader), serif',
                            fontSize: { xs: '0.78rem', md: '0.83rem' },
                            fontStyle: 'italic',
                            color: 'rgba(22,51,74,0.68)',
                            lineHeight: 1.75,
                            display: '-webkit-box',
                            WebkitLineClamp: 12,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            wordBreak: 'break-word',
                          }}
                        >
                          {story.content
                            ? story.content.replace(/<[^>]*>/g, '').trim()
                            : story.excerpt || story.title}
                        </Typography>
                      </Box>
                    )}
                    {year && (
                      <Typography
                        sx={{
                          position: 'absolute',
                          top: 16,
                          left: 18,
                          fontFamily: 'var(--font-newsreader), serif',
                          fontSize: { xs: '2.75rem', md: '3.25rem' },
                          fontWeight: 700,
                          color: firstImg ? 'rgba(22,51,74,0.45)' : 'rgba(22,51,74,0.18)',
                          lineHeight: 1,
                        }}
                      >
                        {year}
                      </Typography>
                    )}
                  </Box>

                  {/* Timeline dot — sits between card and text in normal flow */}
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 1.5 }}>
                    <Box
                      sx={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        bgcolor: ProfileColors.primary,
                        border: `3px solid ${ProfileColors.surface}`,
                        outline: `2px solid ${ProfileColors.primary}28`,
                        flexShrink: 0,
                      }}
                    />
                  </Box>

                  <Box sx={{ pointerEvents: 'none' }}>
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
