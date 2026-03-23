'use client'

import { useState } from 'react'
import {
  Box,
  Typography,
  Grid,
  Card,
  CardMedia,
  CardContent,
  IconButton,
  Chip,
  Tooltip,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
} from '@mui/material'
import {
  Image as ImageIcon,
  AudioFile as AudioIcon,
  VideoFile as VideoIcon,
  InsertDriveFile as FileIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material'
import { useApi } from '@/hooks/useApi'
import { AudioPlayer } from './AudioPlayer'

interface Asset {
  id: string
  filename: string
  originalName: string
  mimeType: string
  sizeBytes: number
  assetType: 'AUDIO' | 'VIDEO' | 'IMAGE' | 'DOCUMENT' | 'TRANSCRIPT' | 'GENERATED_AUDIO'
  storagePath: string
  durationSeconds?: number
  width?: number
  height?: number
  transcript?: string
  createdAt: string
  uploadedBy: {
    id: string
    displayName: string | null
    email: string
  }
}

interface AssetGalleryProps {
  onAssetClick?: (asset: Asset) => void
  onDownload?: (asset: Asset) => void
  onDelete?: (asset: Asset) => void
  selectable?: boolean
  selectedIds?: string[]
  onSelect?: (asset: Asset, selected: boolean) => void
  filter?: {
    assetType?: string
    search?: string
  }
}

const ASSET_TYPES = [
  { value: 'ALL', label: 'All Types' },
  { value: 'IMAGE', label: 'Images' },
  { value: 'AUDIO', label: 'Audio' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'DOCUMENT', label: 'Documents' },
]

export function AssetGallery({
  onAssetClick,
  onDownload,
  onDelete,
  selectable = false,
  selectedIds = [],
  onSelect,
  filter,
}: AssetGalleryProps) {
  const [page, setPage] = useState(1)
  const [pageSize] = useState(12)
  const [assetTypeFilter, setAssetTypeFilter] = useState(filter?.assetType || 'ALL')
  const [searchQuery, setSearchQuery] = useState(filter?.search || '')

  const queryParams = new URLSearchParams()
  queryParams.set('page', page.toString())
  queryParams.set('pageSize', pageSize.toString())
  if (assetTypeFilter !== 'ALL') queryParams.set('assetType', assetTypeFilter)
  if (searchQuery) queryParams.set('search', searchQuery)

  const { data, isLoading } = useApi<{ assets: Asset[]; total: number }>({
    url: `/api/assets?${queryParams.toString()}`,
  })

  const assets = data?.assets || []
  const totalPages = Math.ceil((data?.total || 0) / pageSize)

  const getAssetIcon = (assetType: string) => {
    switch (assetType) {
      case 'IMAGE':
        return <ImageIcon fontSize="large" color="primary" />
      case 'AUDIO':
      case 'GENERATED_AUDIO':
        return <AudioIcon fontSize="large" color="primary" />
      case 'VIDEO':
        return <VideoIcon fontSize="large" color="primary" />
      default:
        return <FileIcon fontSize="large" color="primary" />
    }
  }

  const getAssetTypeLabel = (assetType: string) => {
    switch (assetType) {
      case 'GENERATED_AUDIO':
        return 'AI Audio'
      default:
        return assetType.charAt(0) + assetType.slice(1).toLowerCase()
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const isAudioAsset = (asset: Asset) =>
    asset.assetType === 'AUDIO' || asset.assetType === 'GENERATED_AUDIO'

  return (
    <Box>
      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Search assets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, minWidth: 200 }}
        />

        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Type</InputLabel>
          <Select
            value={assetTypeFilter}
            label="Type"
            onChange={(e) => setAssetTypeFilter(e.target.value)}
            startAdornment={<FilterIcon fontSize="small" sx={{ mr: 0.5 }} />}
          >
            {ASSET_TYPES.map((type) => (
              <MenuItem key={type.value} value={type.value}>
                {type.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Asset Grid */}
      <Grid container spacing={2}>
        {assets.map((asset) => (
          <Grid key={asset.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                cursor: onAssetClick ? 'pointer' : 'default',
                border: selectedIds.includes(asset.id) ? '2px solid' : '1px solid',
                borderColor: selectedIds.includes(asset.id) ? 'primary.main' : 'divider',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: 2,
                  borderColor: 'primary.main',
                },
              }}
              onClick={() => {
                if (selectable && onSelect) {
                  onSelect(asset, !selectedIds.includes(asset.id))
                } else if (onAssetClick) {
                  onAssetClick(asset)
                }
              }}
            >
              {/* Preview Area */}
              <Box
                sx={{
                  height: 140,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  bgcolor: 'rgba(208, 227, 230, 0.2)',
                  position: 'relative',
                }}
              >
                {asset.assetType === 'IMAGE' ? (
                  <CardMedia
                    component="img"
                    image={`/api/assets/${asset.id}/download`}
                    alt={asset.originalName}
                    sx={{
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                ) : isAudioAsset(asset) ? (
                  <AudioIcon sx={{ fontSize: 48, color: 'primary.main' }} />
                ) : (
                  getAssetIcon(asset.assetType)
                )}

                {/* Type Badge */}
                <Chip
                  label={getAssetTypeLabel(asset.assetType)}
                  size="small"
                  sx={{
                    position: 'absolute',
                    top: 8,
                    left: 8,
                    bgcolor: 'rgba(255,255,255,0.9)',
                    fontSize: '0.7rem',
                  }}
                />

                {/* Selection indicator */}
                {selectable && selectedIds.includes(asset.id) && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 8,
                      right: 8,
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      bgcolor: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '0.875rem',
                    }}
                  >
                    ✓
                  </Box>
                )}
              </Box>

              {/* Content */}
              <CardContent sx={{ flexGrow: 1, p: 2, '&:last-child': { pb: 2 } }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    mb: 0.5,
                  }}
                >
                  {asset.originalName}
                </Typography>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    mb: 1,
                  }}
                >
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    {formatFileSize(asset.sizeBytes)}
                  </Typography>
                  {asset.durationSeconds && (
                    <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                      {Math.floor(asset.durationSeconds / 60)}:
                      {(asset.durationSeconds % 60).toString().padStart(2, '0')}
                    </Typography>
                  )}
                </Box>

                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block' }}>
                  By {asset.uploadedBy.displayName || asset.uploadedBy.email}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {new Date(asset.createdAt).toLocaleDateString()}
                </Typography>

                {/* Actions */}
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, mt: 1 }}>
                  {onDownload && (
                    <Tooltip title="Download">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDownload(asset)
                        }}
                      >
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {onDelete && (
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDelete(asset)
                        }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {!isLoading && assets.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <FileIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" sx={{ color: 'text.secondary', mb: 1 }}>
            No assets found
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Try adjusting your filters or upload new files
          </Typography>
        </Box>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, value) => setPage(value)}
            color="primary"
          />
        </Box>
      )}
    </Box>
  )
}
