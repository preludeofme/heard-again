import React from 'react'
import { Box, Typography } from '@mui/material'
import Link from 'next/link'
import { ProfileColors } from './ProfileConstants'

interface DocItem {
  id: string
  title: string
  documentType?: string
  dateOccurred?: string | null
  asset?: { id: string; storagePath: string; mimeType: string }
}

interface ArchiveGridProps {
  documents: DocItem[]
  docTotal: number
  personId?: string
  isGlobal?: boolean
}

export function ArchiveGrid({
  documents,
  docTotal,
  personId,
  isGlobal = false,
}: ArchiveGridProps) {
  return (
    <Box component="section">
      <Box sx={{ bgcolor: ProfileColors.surfaceContainerLow, borderRadius: '3rem', p: { xs: 3, md: 6 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 5, flexWrap: 'wrap', gap: 2 }}>
          <Box>
            <Typography sx={{ fontFamily: 'var(--font-newsreader), serif', fontSize: { xs: '2rem', md: '2.5rem' }, fontWeight: 700, color: ProfileColors.primary }}>
              {isGlobal ? 'The Family Story' : 'The Keepsake Drawer'}
            </Typography>
            <Typography sx={{ fontFamily: 'var(--font-manrope), sans-serif', fontSize: '0.875rem', color: ProfileColors.onSurfaceVariant, mt: 0.5 }}>
              Scanned letters, blueprints, and physical memories.
            </Typography>
          </Box>
          {docTotal > 4 && (
            <Box
              component={Link}
              href={isGlobal ? '/archive?lens=keepsakes' : `/archive?lens=keepsakes`}
              sx={{ color: ProfileColors.primary, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 700, fontSize: '0.72rem', letterSpacing: '0.12em', textTransform: 'uppercase', borderBottom: `2px solid ${ProfileColors.primary}30`, pb: 0.25, transition: 'border-color 0.2s', '&:hover': { borderColor: ProfileColors.primary } }}
            >
              View All {docTotal} Items
            </Box>
          )}
        </Box>

        {documents.length === 0 ? (
          <Box sx={{ py: 5, textAlign: 'center' }}>
            <Typography sx={{ color: ProfileColors.onSurfaceVariant, fontFamily: 'var(--font-newsreader), serif', fontSize: '1.1rem', fontStyle: 'italic' }}>
              {isGlobal ? 'No keepsakes here yet.' : 'No keepsakes here yet.'}
            </Typography>
            <Box
              component={Link}
              href={isGlobal ? '/archive?lens=keepsakes' : `/archive?lens=keepsakes`}
              sx={{ display: 'inline-block', mt: 2, color: ProfileColors.primary, textDecoration: 'none', fontFamily: 'var(--font-manrope), sans-serif', fontWeight: 600, fontSize: '0.9rem', borderBottom: `2px solid ${ProfileColors.primary}35`, pb: 0.25 }}
            >
              Upload documents →
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: { xs: 2, md: 3 } }}>
            {documents.map(doc => (
              <Box
                key={doc.id}
                component={Link}
                href={`/documents/${doc.id}`}
                sx={{
                  position: 'relative',
                  aspectRatio: '1',
                  bgcolor: ProfileColors.surfaceContainerLowest,
                  borderRadius: '1rem',
                  overflow: 'hidden',
                  boxShadow: '0 2px 10px rgba(28,28,25,0.05)',
                  textDecoration: 'none',
                  cursor: 'zoom-in',
                  transition: 'box-shadow 0.3s',
                  '&:hover .doc-img': { transform: 'scale(1.08)', opacity: 1 },
                  '&:hover .doc-overlay': { opacity: 1 },
                  '&:hover': { boxShadow: '0 8px 32px rgba(28,28,25,0.14)' },
                }}
              >
                {doc.asset?.id ? (
                  <Box
                    className="doc-img"
                    component="img"
                    src={`/api/assets/serve/${doc.asset.id}`}
                    alt={doc.title}
                    sx={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.83, transition: 'transform 0.4s ease, opacity 0.3s ease' }}
                  />
                ) : (
                  <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: ProfileColors.surfaceContainer }}>
                    <span style={{ fontFamily: '"Material Symbols Outlined"', fontSize: 38, color: ProfileColors.onSurfaceVariant, opacity: 0.45 }}>
                      {doc.documentType === 'PHOTO' ? 'photo' : doc.documentType === 'LETTER' ? 'mail' : 'description'}
                    </span>
                  </Box>
                )}
                <Box
                  className="doc-overlay"
                  sx={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    p: 1.5,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.62), transparent)',
                    opacity: 0,
                    transition: 'opacity 0.3s ease',
                  }}
                >
                  <Typography sx={{ color: '#fff', fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'var(--font-manrope), sans-serif' }}>
                    {doc.title.length > 26 ? doc.title.substring(0, 26) + '\u2026' : doc.title}
                    {doc.dateOccurred && `, ${new Date(doc.dateOccurred).getFullYear()}`}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
