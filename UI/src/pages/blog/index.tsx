import Head from 'next/head'
import Link from 'next/link'
import {
  Box,
  Container,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  Grid,
  Divider,
} from '@mui/material'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { blogPosts, BlogPostMeta } from '@/content/blog'

interface BlogListingProps {
  posts: BlogPostMeta[]
}

export default function BlogListing({ posts }: BlogListingProps) {
  // Sort newest first (ISO date strings sort lexicographically)
  const sortedPosts = [...posts].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  return (
    <>
      <Head>
        <title>Blog — Heard Again | Family Voice Preservation &amp; Legacy Stories</title>
        <meta
          name="description"
          content="Stories, guides, and reflections on preserving family voices and building a lasting legacy. Read about voice preservation, family storytelling, and making memories that endure."
        />
        <meta
          name="keywords"
          content="family voice preservation blog, legacy stories, family storytelling, voice preservation tips, Heard Again blog"
        />
        <meta
          property="og:title"
          content="Blog — Heard Again | Family Voice Preservation &amp; Legacy Stories"
        />
        <meta
          property="og:description"
          content="Stories, guides, and reflections on preserving family voices and building a lasting legacy."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://www.heardagain.com/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="Heard Again Blog — Family Voice Preservation &amp; Legacy Stories"
        />
        <meta property="og:url" content="https://www.heardagain.com/blog" />
        <meta property="og:site_name" content="Heard Again" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="Blog — Heard Again | Family Voice Preservation &amp; Legacy Stories"
        />
        <meta
          name="twitter:description"
          content="Stories, guides, and reflections on preserving family voices and building a lasting legacy."
        />
        <meta name="twitter:image" content="https://www.heardagain.com/og-image.png" />
        <meta
          name="twitter:image:alt"
          content="Heard Again Blog — Family Voice Preservation &amp; Legacy Stories"
        />
        <link rel="canonical" href="https://www.heardagain.com/blog" />
        {/* JSON-LD for Blog */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Blog',
              '@id': 'https://www.heardagain.com/blog',
              name: 'Heard Again Blog',
              description:
                'Stories, guides, and reflections on preserving family voices and building a lasting legacy.',
              url: 'https://www.heardagain.com/blog',
              publisher: {
                '@type': 'Organization',
                '@id': 'https://www.heardagain.com/#organization',
                name: 'Heard Again',
              },
              blogPost: posts.map((post) => ({
                '@type': 'BlogPosting',
                headline: post.title,
                description: post.excerpt,
                datePublished: post.date,
                url: `https://www.heardagain.com/blog/${post.slug}`,
                author: {
                  '@type': 'Person',
                  name: post.author.name,
                },
              })),
            }),
          }}
        />
      </Head>

      <Box sx={{ bgcolor: '#fcf9f4', minHeight: '100vh' }}>
        <PublicHeader />

        {/* Hero Section */}
        <Box
          sx={{
            bgcolor: 'rgba(208, 227, 230, 0.3)',
            borderBottom: '1px solid rgba(22, 51, 74, 0.08)',
            py: { xs: 8, md: 12 },
          }}
        >
          <Container maxWidth="md" sx={{ textAlign: 'center' }}>
            <Typography
              variant="overline"
              sx={{
                color: 'primary.main',
                fontWeight: 700,
                letterSpacing: '0.15em',
                mb: 2,
                display: 'block',
              }}
            >
              THE HEARD AGAIN BLOG
            </Typography>
            <Typography
              variant="h1"
              sx={{
                fontFamily: 'var(--font-newsreader), serif',
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                color: '#16334a',
                fontWeight: 500,
                mb: 3,
                letterSpacing: '-0.02em',
              }}
            >
              Stories About What Lasts
            </Typography>
            <Typography
              variant="body1"
              sx={{
                fontSize: { xs: '1.1rem', md: '1.25rem' },
                color: '#546669',
                maxWidth: 650,
                mx: 'auto',
                lineHeight: 1.7,
              }}
            >
              Reflections, guides, and stories on preserving family voices, building a lasting
              legacy, and the art of remembering well — from the Heard Again team and community.
            </Typography>
          </Container>
        </Box>

        {/* Blog Posts Grid */}
        <Container maxWidth="lg" sx={{ py: { xs: 6, md: 10 } }}>
          {posts.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Typography
                variant="h4"
                sx={{
                  fontFamily: 'var(--font-newsreader), serif',
                  color: '#546669',
                  mb: 2,
                }}
              >
                No posts yet
              </Typography>
              <Typography variant="body1" sx={{ color: '#546669' }}>
                Check back soon for stories on preserving family voices and building a lasting
                legacy.
              </Typography>
            </Box>
          ) : (
            <Grid container spacing={4}>
              {sortedPosts.map((post) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={post.slug}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      borderRadius: 4,
                      border: '1px solid rgba(22, 51, 74, 0.06)',
                      overflow: 'hidden',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 16px 48px rgba(22, 51, 74, 0.1)',
                      },
                    }}
                  >
                    <CardActionArea
                      component={Link}
                      href={`/blog/${post.slug}`}
                      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                    >
                      {/* Cover image placeholder */}
                      {post.coverImage ? (
                        <Box
                          sx={{
                            height: 200,
                            backgroundImage: `url(${post.coverImage ? post.coverImage.startsWith('http') ? post.coverImage : `https://www.heardagain.com${post.coverImage}` : ''})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            height: 140,
                            background: 'linear-gradient(135deg, #16334a 0%, #2e4a62 100%)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Typography
                            sx={{
                              fontFamily: 'var(--font-newsreader), serif',
                              fontStyle: 'italic',
                              color: 'rgba(255,255,255,0.7)',
                              fontSize: '1rem',
                            }}
                          >
                            Heard Again
                          </Typography>
                        </Box>
                      )}

                      <CardContent
                        sx={{
                          flexGrow: 1,
                          p: 3,
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Tags */}
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
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
                          variant="h3"
                          sx={{
                            fontFamily: 'var(--font-newsreader), serif',
                            fontSize: '1.35rem',
                            color: '#16334a',
                            fontWeight: 600,
                            mb: 1.5,
                            lineHeight: 1.3,
                          }}
                        >
                          {post.title}
                        </Typography>

                        {/* Excerpt */}
                        <Typography
                          variant="body2"
                          sx={{
                            color: '#546669',
                            lineHeight: 1.7,
                            flexGrow: 1,
                            mb: 2.5,
                          }}
                        >
                          {post.excerpt}
                        </Typography>

                        {/* Meta row */}
                        <Box sx={{ mt: 'auto' }}>
                          <Divider sx={{ mb: 2, borderColor: 'rgba(22, 51, 74, 0.06)' }} />
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <Typography
                              variant="caption"
                              sx={{
                                color: '#546669',
                                fontWeight: 500,
                                fontFamily: 'var(--font-manrope), sans-serif',
                              }}
                            >
                              {post.author.name}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#546669',
                                  fontFamily: 'var(--font-manrope), sans-serif',
                                }}
                              >
                                · {post.readTime}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}
        </Container>
      </Box>
    </>
  )
}

export async function getServerSideProps() {
  // Extract just the metadata (no content functions, which aren't serializable)
  const posts: BlogPostMeta[] = blogPosts.map(({ slug, title, date, excerpt, tags, author, readTime, coverImage }) => {
    const meta: BlogPostMeta = { slug, title, date, excerpt, tags, author, readTime }
    if (coverImage) meta.coverImage = coverImage
    return meta
  })

  return {
    props: { posts },
  }
}
