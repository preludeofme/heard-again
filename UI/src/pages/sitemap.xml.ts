import type { GetServerSideProps } from 'next'
import { blogPosts } from '@/content/blog'

const SITE_ORIGIN = 'https://www.heardagain.com'

type ChangeFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

interface SitemapEntry {
  path: string
  lastmod: string
  changefreq: ChangeFreq
  priority: string
}

/**
 * Pages that are not driven by a content registry. Blog posts are not listed
 * here — they come from `blogPosts`, so an unregistered post (for example one
 * still behind an editorial gate) never reaches the sitemap as a 404.
 */
const STATIC_PAGES: readonly SitemapEntry[] = [
  { path: '/', lastmod: '2026-10-04', changefreq: 'weekly', priority: '1.0' },
  { path: '/pricing', lastmod: '2026-10-04', changefreq: 'weekly', priority: '0.9' },
  { path: '/signup', lastmod: '2026-08-09', changefreq: 'monthly', priority: '0.8' },
  { path: '/login', lastmod: '2026-08-09', changefreq: 'monthly', priority: '0.5' },
  { path: '/setup-guide', lastmod: '2026-08-09', changefreq: 'weekly', priority: '0.7' },
  { path: '/self-hosting', lastmod: '2026-08-09', changefreq: 'monthly', priority: '0.6' },
  { path: '/support', lastmod: '2026-08-09', changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy', lastmod: '2026-08-09', changefreq: 'monthly', priority: '0.3' },
  { path: '/terms', lastmod: '2026-08-09', changefreq: 'monthly', priority: '0.3' },
  { path: '/terms-legacy', lastmod: '2026-08-09', changefreq: 'monthly', priority: '0.3' },
  { path: '/blog', lastmod: '2026-10-04', changefreq: 'weekly', priority: '0.7' },
] as const

/** A lastmod in the future is ignored by crawlers, so never emit one. */
function clampToToday(date: string, today: string): string {
  return date > today ? today : date
}

export function buildSitemapXml(today: string): string {
  const postEntries: SitemapEntry[] = blogPosts.map((post) => ({
    path: `/blog/${post.slug}`,
    lastmod: clampToToday(post.date, today),
    changefreq: 'monthly',
    priority: '0.5',
  }))

  const urls = [...STATIC_PAGES, ...postEntries]
    .map(
      ({ path, lastmod, changefreq, priority }) =>
        `  <url>\n` +
        `    <loc>${SITE_ORIGIN}${path}</loc>\n` +
        `    <lastmod>${lastmod}</lastmod>\n` +
        `    <changefreq>${changefreq}</changefreq>\n` +
        `    <priority>${priority}</priority>\n` +
        `  </url>`
    )
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
}

export const getServerSideProps: GetServerSideProps = async ({ res }) => {
  const today = new Date().toISOString().slice(0, 10)

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400')
  res.write(buildSitemapXml(today))
  res.end()

  return { props: {} }
}

export default function SitemapXml(): null {
  return null
}
