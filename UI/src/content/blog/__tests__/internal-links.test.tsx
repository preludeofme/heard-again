import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { blogPosts } from '..'
import { buildSitemapXml } from '@/pages/sitemap.xml'

const POSTS_DIR = join(__dirname, '..')
const PRICING_HREF = '/#pricing'

/**
 * Every post body in the directory, registered or still behind the editorial
 * gate. Derived from the filesystem so a new post cannot ship without a pricing
 * link just by being absent from a hand-maintained list.
 */
const ALL_POST_SLUGS = readdirSync(POSTS_DIR)
  .filter((file) => file.endsWith('.tsx') && file !== 'post-link.tsx')
  .map((file) => file.replace(/\.tsx$/, ''))

/**
 * TRU-20: these three posts touch death and loss, so their drafted pricing
 * paragraph is held on `content/tru-20-gated-pricing-paragraphs` until Ryan has
 * read it. Asserted to have *no* pricing link yet, so merging the paragraph
 * fails this suite and forces the entry out rather than leaving a standing hole
 * in the guard above.
 */
const PENDING_EDITORIAL_READ = [
  'preserve-family-voices-before-its-too-late',
  'ai-voice-cloning-ethics-family-consent',
  'record-grandparents-voices-before-stories-go-quiet',
]

function pricingLinkCount(slug: string): number {
  const source = readFileSync(join(POSTS_DIR, `${slug}.tsx`), 'utf8')
  return source.split(`href="${PRICING_HREF}"`).length - 1
}

/** Collect every internal href rendered in a post body. */
function renderedHrefs(content: () => React.ReactNode): string[] {
  const Content = content as React.FunctionComponent
  const { container } = render(<Content />)
  return Array.from(container.querySelectorAll('a')).map((a) => a.getAttribute('href') ?? '')
}

describe('blog internal linking', () => {
  const slugs = new Set(blogPosts.map((p) => p.slug))

  it.each(blogPosts.map((p) => [p.slug, p] as const))(
    'should link %s to at least two other posts',
    (slug, post) => {
      const linkedPosts = new Set(
        renderedHrefs(post.content)
          .filter((href) => href.startsWith('/blog/'))
          .map((href) => href.replace('/blog/', ''))
          .filter((linked) => linked !== slug)
      )

      expect(linkedPosts.size).toBeGreaterThanOrEqual(2)
    }
  )

  it('should guard every post file in the directory, registered or gated', () => {
    const registered = blogPosts.map((p) => p.slug)

    expect(ALL_POST_SLUGS).toEqual(expect.arrayContaining(registered))
    expect(ALL_POST_SLUGS.length).toBeGreaterThanOrEqual(registered.length)
  })

  it.each(ALL_POST_SLUGS.filter((slug) => !PENDING_EDITORIAL_READ.includes(slug)))(
    'should link %s to the pricing section exactly once',
    (slug) => {
      expect(pricingLinkCount(slug)).toBe(1)
    }
  )

  it.each(PENDING_EDITORIAL_READ)(
    'should still be holding the pricing paragraph for %s pending an editorial read',
    (slug) => {
      expect(ALL_POST_SLUGS).toContain(slug)
      expect(pricingLinkCount(slug)).toBe(0)
    }
  )

  it('should only link to posts that are registered', () => {
    const broken = blogPosts.flatMap((post) =>
      renderedHrefs(post.content)
        .filter((href) => href.startsWith('/blog/'))
        .map((href) => href.replace('/blog/', ''))
        .filter((linked) => !slugs.has(linked))
        .map((linked) => `${post.slug} -> ${linked}`)
    )

    expect(broken).toEqual([])
  })

  it('should list every registered post in the generated sitemap', () => {
    const sitemap = buildSitemapXml('2026-10-04')

    const missing = blogPosts
      .map((p) => `https://www.heardagain.com/blog/${p.slug}`)
      .filter((loc) => !sitemap.includes(`<loc>${loc}</loc>`))

    expect(missing).toEqual([])
  })

  it('should omit posts that are written but not registered', () => {
    const sitemap = buildSitemapXml('2026-10-04')

    expect(sitemap).not.toContain('/blog/how-to-clone-a-deceased-relatives-voice')
    expect(sitemap).not.toContain('/blog/restore-old-cassette-recording-family-member')
  })

  it('should never emit a lastmod in the future', () => {
    const today = '2026-10-04'
    const sitemap = buildSitemapXml(today)

    const future = Array.from(sitemap.matchAll(/<lastmod>(.*?)<\/lastmod>/g))
      .map(([, date]) => date)
      .filter((date) => date > today)

    expect(future).toEqual([])
  })
})
