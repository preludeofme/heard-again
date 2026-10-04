import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { blogPosts } from '..'
import { buildSitemapXml } from '@/pages/sitemap.xml'

const PRICING_HREF = '/#pricing'

/**
 * Posts written under the TRU-6 editorial rules, which require one pricing link
 * per post. The five launch posts predate that rule and link post-to-post only.
 */
const POSTS_REQUIRING_PRICING_LINK = [
  'self-hosted-vs-hosted-family-archive',
  'gedcom-import-with-audio',
  'restore-old-cassette-recording-family-member',
  'how-to-clone-a-deceased-relatives-voice',
]

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

  it('should link every post written under the pricing-link rule to the pricing section', () => {
    const missing = POSTS_REQUIRING_PRICING_LINK.filter((slug) => {
      const source = readFileSync(join(__dirname, '..', `${slug}.tsx`), 'utf8')
      return !source.includes(`href="${PRICING_HREF}"`)
    })

    expect(missing).toEqual([])
  })

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
