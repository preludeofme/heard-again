/**
 * Returns the application's symmetric encryption key.
 *
 * Throws instead of silently falling back to a static default so that a
 * missing `APP_KEY`/`NEXTAUTH_SECRET` in any environment fails loudly rather
 * than encrypting sensitive data (e.g. MFA secrets) with a publicly known key.
 */
export function getAppEncryptionKey(): string {
  const key = process.env.APP_KEY || process.env.NEXTAUTH_SECRET

  if (!key) {
    throw new Error(
      'APP_KEY or NEXTAUTH_SECRET must be set to perform this operation. ' +
        'Set one of these environment variables before starting the app.'
    )
  }

  return key
}
