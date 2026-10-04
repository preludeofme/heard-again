import Link from 'next/link'
import { Box } from '@mui/material'
import type { ReactNode } from 'react'

interface PostLinkProps {
  href: string
  children: ReactNode
}

/**
 * Inline link style shared by all blog post bodies, so internal links read
 * consistently against the article typography in `pages/blog/[slug].tsx`.
 */
export function PostLink({ href, children }: PostLinkProps): ReactNode {
  return (
    <Box
      component={Link}
      href={href}
      sx={{
        color: '#16334a',
        fontWeight: 600,
        textDecoration: 'underline',
        textDecorationColor: 'rgba(22, 51, 74, 0.35)',
        textUnderlineOffset: '3px',
        '&:hover': { textDecorationColor: '#16334a' },
      }}
    >
      {children}
    </Box>
  )
}
