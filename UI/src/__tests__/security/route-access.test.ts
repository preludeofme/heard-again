import fs from 'fs'
import path from 'path'
import {
  PRIVATE_PATH_PREFIXES,
  PUBLIC_PATH_PREFIXES,
  isBypassedPath,
  isPublicPath,
  requiresAuth,
} from '@/lib/security/route-access'

const PAGES_DIR = path.join(__dirname, '..', '..', 'pages')

/** Pages that are not addressable routes, or are the error pages themselves. */
const NON_ROUTE_FILES = new Set(['_app', '_document', '_error', '404', '500'])

function collectRoutes(dir: string, prefix = ''): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory()) {
      if (entry.name === 'api') return []
      return collectRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`)
    }

    const name = entry.name.replace(/\.(tsx|ts|jsx|js)$/, '')
    if (name === entry.name) return []
    if (NON_ROUTE_FILES.has(name)) return []
    // sitemap.xml.ts serves a file, and the asset bypass already covers it
    if (name.endsWith('.xml')) return []

    return [name === 'index' ? prefix || '/' : `${prefix}/${name}`]
  })
}

/** Replace [id] / [...slug] with a concrete value so prefix matching can run. */
function toConcretePath(route: string): string {
  return route.replace(/\[\.{0,3}(\w+)\]/g, 'sample-value')
}

describe('route access classification', () => {
  const routes = collectRoutes(PAGES_DIR)

  it('should find the page routes it is meant to audit', () => {
    expect(routes).toContain('/')
    expect(routes).toContain('/dashboard')
    expect(routes).toContain('/stories/[id]/edit')
    expect(routes.length).toBeGreaterThan(40)
  })

  it.each(routes)('should classify %s as either public or private', (route) => {
    const pathname = toConcretePath(route)
    const classifications = [isPublicPath(pathname), requiresAuth(pathname)].filter(Boolean)

    // Exactly one must hold. Zero means a new page would be silently public;
    // two means the lists overlap and the private rule would be unreachable.
    expect(classifications).toHaveLength(1)
  })

  it('should not list the same prefix as both public and private', () => {
    const overlap = PUBLIC_PATH_PREFIXES.filter((p) => PRIVATE_PATH_PREFIXES.includes(p as never))
    expect(overlap).toEqual([])
  })

  describe('requiresAuth', () => {
    it.each([
      '/dashboard',
      '/account',
      '/admin/dashboard',
      '/stories/abc',
      '/stories/abc/edit',
      '/profile/abc',
      '/familyspaces/abc/settings',
      '/privacy-settings',
      '/voice-lab',
    ])('should require a session for %s', (pathname) => {
      expect(requiresAuth(pathname)).toBe(true)
    })

    it.each([
      '/',
      '/login',
      '/pricing',
      '/blog',
      '/blog/some-post',
      '/share/story/abc',
      '/terms',
      '/support',
    ])('should not require a session for the public page %s', (pathname) => {
      expect(requiresAuth(pathname)).toBe(false)
    })

    it.each([
      '/about',
      '/faq',
      '/how-it-works',
      '/demo',
      '/dashboards',
      '/accounts',
      '/storiesxyz',
      '/nope/nested/deep',
    ])('should let the unknown path %s fall through to the 404 page', (pathname) => {
      expect(requiresAuth(pathname)).toBe(false)
      expect(isPublicPath(pathname)).toBe(false)
    })
  })

  describe('isBypassedPath', () => {
    it.each(['/_next/static/chunk.js', '/api/stories', '/favicon.ico', '/images/logo.png', '/robots.txt', '/sitemap.xml', '/manifest.json'])(
      'should bypass the guard for %s',
      (pathname) => {
        expect(isBypassedPath(pathname)).toBe(true)
        expect(requiresAuth(pathname)).toBe(false)
      }
    )

    it('should not bypass the guard for a private page route', () => {
      expect(isBypassedPath('/dashboard')).toBe(false)
    })
  })
})
