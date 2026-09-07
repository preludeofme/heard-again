import Head from 'next/head'
import Link from 'next/link'
import {
  Box,
  Container,
  Typography,
  Breadcrumbs,
  Chip,
  Divider,
  Avatar,
  Paper,
  Stack,
  Card,
  CardContent,
  CardActionArea,
} from '@mui/material'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { getPostBySlug, getRelatedPosts, blogPosts, BlogPost, BlogPostMeta } from '@/content/blog'
import type { GetServerSideProps } from 'next'

interface BlogPostPageProps {
  post?: BlogPostMeta
  contentHtml?: string
  relatedPosts: BlogPostMeta[]
  notFound?: boolean
}

export const getServerSideProps: GetServerSideProps<BlogPostPageProps> = async (context) => {
  const slug = context.params?.slug as string | undefined

  if (!slug) {
    return { notFound: true }
  }

  const post = getPostBySlug(slug)
  if (!post) {
    return { notFound: true }
  }

  const relatedPosts = getRelatedPosts(slug, 3)

  // Serialize only the meta (content is rendered client-side)
  const { content: _content, ...meta } = post

  return {
    props: {
      post: meta,
      relatedPosts,
    },
  }
}

export default function BlogPostPage({ post, relatedPosts }: BlogPostPageProps) {
  if (!post) {
    return (
      <>
        <Head>
          <title>Post Not Found — Heard Again Blog</title>
        </Head>
        <Box sx={{ bgcolor: '#fcf9f4', minHeight: '100vh' }}>
          <PublicHeader />
          <Container maxWidth="md" sx={{ py: 12, textAlign: 'center' }}>
            <Typography
              variant="h1"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                color: '#16334a',
                mb: 2,
              }}
            >
              Post Not Found
            </Typography>
            <Typography variant="body1" sx={{ color: '#546669', mb: 4 }}>
              The post you&apos;re looking for doesn&apos;t exist or has been moved.
            </Typography>
            <Link href="/blog" style={{ color: '#16334a', fontWeight: 600 }}>
              ← Back to Blog
            </Link>
          </Container>
        </Box>
      </>
    )
  }

  const pageTitle = `${post.title} — Heard Again Blog`
  const canonicalUrl = `https://www.heardagain.com/blog/${post.slug}`

  // Find the full post to render content client-side
  const fullPost = blogPosts.find((p) => p.slug === post.slug)

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <meta property="og:type" content="article" />
        <meta property="og:image" content={post.coverImage || 'https://www.heardagain.com/og-image.png'} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={post.title} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:site_name" content="Heard Again" />
        <meta property="article:published_time" content={post.date} />
        {post.tags.map((tag) => (
          <meta key={tag} property="article:tag" content={tag} />
        ))}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.excerpt} />
        <meta name="twitter:image" content={post.coverImage || 'https://www.heardagain.com/og-image.png'} />
        <meta name="twitter:image:alt" content={post.title} />
        <link rel="canonical" href={canonicalUrl} />
        {/* JSON-LD for Article */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Article',
              headline: post.title,
              description: post.excerpt,
              datePublished: post.date,
              url: canonicalUrl,
              author: {
                '@type': 'Person',
                name: post.author.name,
              },
              publisher: {
                '@type': 'Organization',
                '@id': 'https://www.heardagain.com/#organization',
                name: 'Heard Again',
              },
              image: post.coverImage || 'https://www.heardagain.com/og-image.png',
              mainEntityOfPage: {
                '@type': 'WebPage',
                '@id': canonicalUrl,
              },
            }),
          }}
        />
      </Head>

      <Box sx={{ bgcolor: '#fcf9f4', minHeight: '100vh' }}>
        <PublicHeader />

        <Container maxWidth="md" sx={{ py: { xs: 4, md: 6 } }}>
          {/* Breadcrumbs */}
          <Breadcrumbs
            aria-label="breadcrumb"
            sx={{ mb: 4 }}
            separator={
              <Typography variant="caption" sx={{ color: '#546669', mx: 0.5 }}>
                ›
              </Typography>
            }
          >
            <Link
              href="/"
              style={{
                color: '#546669',
                textDecoration: 'none',
                fontFamily: 'var(--font-manrope), sans-serif',
                fontSize: '0.875rem',
              }}
            >
              Home
            </Link>
            <Link
              href="/blog"
              style={{
                color: '#546669',
                textDecoration: 'none',
                fontFamily: 'var(--font-manrope), sans-serif',
                fontSize: '0.875rem',
              }}
            >
              Blog
            </Link>
            <Typography
              variant="body2"
              sx={{
                color: '#16334a',
                fontWeight: 600,
                fontFamily: 'var(--font-manrope), sans-serif',
              }}
            >
              {post.title.length > 40 ? `${post.title.substring(0, 40)}...` : post.title}
            </Typography>
          </Breadcrumbs>

          {/* Article Header */}
          <Box component="header" sx={{ mb: 6 }}>
            {/* Tags */}
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {post.tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  sx={{
                    bgcolor: 'rgba(208, 227, 230, 0.5)',
                    color: '#16334a',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    borderRadius: '12px',
                  }}
                />
              ))}
            </Box>

            {/* Title */}
            <Typography
              variant="h1"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontSize: { xs: '2rem', md: '2.75rem' },
                color: '#16334a',
                fontWeight: 600,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                mb: 3,
              }}
            >
              {post.title}
            </Typography>

            {/* Excerpt / dek */}
            <Typography
              variant="body1"
              sx={{
                fontSize: '1.2rem',
                color: '#546669',
                lineHeight: 1.7,
                mb: 4,
                fontFamily: 'var(--font-newsreader), serif',
                fontStyle: 'italic',
              }}
            >
              {post.excerpt}
            </Typography>

            {/* Author + Meta Row */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'wrap',
              }}
            >
              <Avatar
                src={post.author.avatar}
                sx={{
                  width: 48,
                  height: 48,
                  bgcolor: '#16334a',
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: '1.25rem',
                }}
              >
                {post.author.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: 600,
                    color: '#16334a',
                    fontFamily: 'var(--font-manrope), sans-serif',
                  }}
                >
                  {post.author.name}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{
                    color: '#546669',
                    fontFamily: 'var(--font-manrope), sans-serif',
                  }}
                >
                  {new Date(post.date).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  {' · '}
                  {post.readTime}
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Article Body */}
          <Box
            sx={{
              '& h2': {
                fontFamily: 'var(--font-newsreader), serif',
                color: '#16334a',
                fontWeight: 600,
                fontSize: { xs: '1.5rem', md: '1.75rem' },
                mt: 6,
                mb: 2,
                lineHeight: 1.35,
              },
              '& h3': {
                fontFamily: 'var(--font-newsreader), serif',
                color: '#16334a',
                fontWeight: 600,
                fontSize: '1.25rem',
                mt: 4,
                mb: 1.5,
              },
              '& p': {
                fontSize: '1.15rem',
                lineHeight: 1.85,
                color: '#1c1c19',
                mb: 3,
              },
              '& ul, & ol': {
                pl: 3,
                mb: 3,
              },
              '& li': {
                fontSize: '1.1rem',
                lineHeight: 1.8,
                color: '#1c1c19',
                mb: 0.75,
              },
              '& blockquote': {
                borderLeft: '4px solid #16334a',
                bgcolor: 'rgba(208, 227, 230, 0.3)',
                p: 3,
                borderRadius: '0 12px 12px 0',
                my: 4,
                '& p': {
                  fontFamily: 'var(--font-newsreader), serif',
                  fontStyle: 'italic',
                  color: '#16334a',
                  mb: 0,
                },
              },
            }}
          >
            {fullPost ? <fullPost.content /> : null}
          </Box>

          <Divider sx={{ my: 6, borderColor: 'rgba(22, 51, 74, 0.08)' }} />

          {/* Author Bio Section */}
          {post.author.bio && (
            <Paper
              elevation={0}
              sx={{
                p: 4,
                mb: 6,
                borderRadius: 4,
                bgcolor: 'rgba(208, 227, 230, 0.2)',
                border: '1px solid rgba(22, 51, 74, 0.06)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 3,
                flexDirection: { xs: 'column', sm: 'row' },
              }}
            >
              <Avatar
                src={post.author.avatar}
                sx={{
                  width: 64,
                  height: 64,
                  bgcolor: '#16334a',
                  fontFamily: 'var(--font-newsreader), serif',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {post.author.name.charAt(0)}
              </Avatar>
              <Box>
                <Typography
                  variant="h4"
                  sx={{
                    fontFamily: 'var(--font-newsreader), serif',
                    color: '#16334a',
                    fontWeight: 600,
                    mb: 1,
                  }}
                >
                  {post.author.name}
                </Typography>
                <Typography variant="body2" sx={{ color: '#546669', lineHeight: 1.7 }}>
                  {post.author.bio}
                </Typography>
              </Box>
            </Paper>
          )}

          {/* Social Share Buttons (placeholder) */}
          <Paper
            elevation={0}
            sx={{
              p: 4,
              mb: 6,
              borderRadius: 4,
              bgcolor: '#ffffff',
              border: '1px solid rgba(22, 51, 74, 0.06)',
              textAlign: 'center',
            }}
          >
            <Typography
              variant="h4"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                color: '#16334a',
                fontWeight: 600,
                mb: 1,
              }}
            >
              Share this article
            </Typography>
            <Typography variant="body2" sx={{ color: '#546669', mb: 3 }}>
              Help others discover the importance of preserving family voices.
            </Typography>
            <Stack
              direction="row"
              spacing={2}
              justifyContent="center"
              sx={{
                '& a': {
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  bgcolor: '#16334a',
                  color: 'white',
                  textDecoration: 'none',
                  fontFamily: 'var(--font-manrope), sans-serif',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    bgcolor: '#2e4a62',
                    transform: 'translateY(-2px)',
                  },
                },
              }}
            >
              {/* X / Twitter */}
              <Box
                component="a"
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(canonicalUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on X (Twitter)"
              >
                𝕏
              </Box>
              {/* Facebook */}
              <Box
                component="a"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(canonicalUrl)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on Facebook"
              >
                f
              </Box>
              {/* LinkedIn */}
              <Box
                component="a"
                href={`https://www.linkedin.com/shareArticle?mini=true&url=${encodeURIComponent(canonicalUrl)}&title=${encodeURIComponent(post.title)}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Share on LinkedIn"
              >
                in
              </Box>
              {/* Email */}
              <Box
                component="a"
                href={`mailto:?subject=${encodeURIComponent(post.title)}&body=${encodeURIComponent(`I thought you might enjoy this article: ${canonicalUrl}`)}`}
                aria-label="Share via Email"
              >
                ✉
              </Box>
            </Stack>
          </Paper>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <Box sx={{ mb: 4 }}>
              <Typography
                variant="h3"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  color: '#16334a',
                  fontWeight: 600,
                  mb: 4,
                  textAlign: 'center',
                }}
              >
                Related Stories
              </Typography>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' },
                  gap: 3,
                }}
              >
                {relatedPosts.map((related) => (
                  <Card
                    key={related.slug}
                    sx={{
                      borderRadius: 4,
                      border: '1px solid rgba(22, 51, 74, 0.06)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 10px 30px rgba(22, 51, 74, 0.08)',
                      },
                    }}
                  >
                    <CardActionArea component={Link} href={`/blog/${related.slug}`}>
                      <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                          {related.tags.slice(0, 2).map((tag) => (
                            <Chip
                              key={tag}
                              label={tag}
                              size="small"
                              sx={{
                                bgcolor: 'rgba(208, 227, 230, 0.5)',
                                color: '#16334a',
                                fontWeight: 500,
                                fontSize: '0.7rem',
                                borderRadius: '10px',
                                height: 22,
                              }}
                            />
                          ))}
                        </Box>
                        <Typography
                          variant="h4"
                          sx={{
                            fontFamily: 'var(--font-newsreader), serif',
                            fontSize: '1.1rem',
                            color: '#16334a',
                            fontWeight: 600,
                            mb: 1,
                            lineHeight: 1.3,
                          }}
                        >
                          {related.title}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#546669',
                            fontFamily: 'var(--font-manrope), sans-serif',
                          }}
                        >
                          {new Date(related.date).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </Typography>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                ))}
              </Box>
            </Box>
          )}

          {/* Back to Blog */}
          <Box sx={{ textAlign: 'center', mt: 4, pb: 4 }}>
            <Link
              href="/blog"
              style={{
                color: '#16334a',
                fontWeight: 600,
                fontFamily: 'var(--font-manrope), sans-serif',
                fontSize: '0.95rem',
              }}
            >
              ← Back to all articles
            </Link>
          </Box>
        </Container>
      </Box>
    </>
  )
}
