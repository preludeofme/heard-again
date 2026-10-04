import { blogPosts } from '..'

/**
 * TRU-6: these posts are written but held out of the registry until Ryan has
 * read them, so their routes 404. Registering one publishes it, which is the
 * step the editorial gate exists to stop. Asserted here so uncommenting the
 * entry in `index.ts` fails the suite instead of shipping quietly.
 */
const AWAITING_EDITORIAL_APPROVAL = [
  'how-to-clone-a-deceased-relatives-voice',
  'restore-old-cassette-recording-family-member',
] as const

describe('editorial gate', () => {
  const registered = new Set(blogPosts.map((post) => post.slug))

  it.each(AWAITING_EDITORIAL_APPROVAL)(
    'should keep %s unregistered when Ryan has not approved it',
    (slug) => {
      expect(registered.has(slug)).toBe(false)
    }
  )
})
