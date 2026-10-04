/**
 * Route access classification for the edge auth guard (`UI/src/proxy.ts`).
 *
 * The guard used to be deny-by-default over an allowlist of public paths, which
 * meant an unknown URL answered with a login form instead of a 404. A stranger
 * following a guessed or stale link read that as "this site wants an account
 * before it tells me anything" and left.
 *
 * The rule now: redirect to /login only for paths that match a known private
 * route. Everything else falls through to Next.js, so unknown paths render
 * `404.tsx` and public pages render themselves.
 *
 * The trade-off is that a new page is publicly reachable unless it is listed in
 * PRIVATE_PATH_PREFIXES. `route-access.test.ts` enumerates `src/pages` and fails
 * when a page is in neither list, so a new route cannot stay unclassified.
 */

/** Pages intended for logged-out visitors. Listed for the classification test. */
export const PUBLIC_PATH_PREFIXES = [
  '/',
  '/login',
  '/signup',
  '/pricing',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
  '/self-hosting',
  '/setup-guide',
  '/privacy',
  '/terms',
  '/terms-legacy',
  '/support',
  '/blog',
  '/share',
] as const

/**
 * Pages that require a session. A request matching one of these — exactly, or as
 * a path segment prefix — is redirected to /login when there is no token.
 */
export const PRIVATE_PATH_PREFIXES = [
  '/account',
  '/admin',
  '/collections',
  '/contribute',
  '/dashboard',
  '/documents',
  '/export',
  '/export-tree',
  '/family-merge',
  '/family-tree',
  '/familyspace',
  '/familyspaces',
  '/favorites',
  '/import',
  '/invite',
  '/legacy',
  '/moderation',
  '/privacy-settings',
  '/profile',
  '/search',
  '/stories',
  '/subscription',
  '/timeline',
  '/tunnel-setup',
  '/voice-lab',
] as const

const STATIC_ASSET_PATTERN = /\.(png|jpg|jpeg|gif|svg|ico|json|txt|xml|css|js|woff2?|ttf|eot)$/i

function matchesPrefix(pathname: string, prefix: string): boolean {
  if (prefix === '/') return pathname === '/'
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

/** Requests the guard must not touch: framework internals, API routes, assets. */
export function isBypassedPath(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    STATIC_ASSET_PATTERN.test(pathname)
  )
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
}

/**
 * True when the path belongs to a known private route and so needs a session.
 * Unknown paths return false and fall through to Next.js, which 404s them.
 */
export function requiresAuth(pathname: string): boolean {
  if (isBypassedPath(pathname)) return false
  return PRIVATE_PATH_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix))
}
