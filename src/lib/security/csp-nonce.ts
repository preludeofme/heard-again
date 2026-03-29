import crypto from 'crypto'

export function generateNonce(): string {
  return crypto.randomBytes(16).toString('base64')
}

export function generateCspPolicy(nonce: string): string {
  const directives = {
    'default-src': ["'self'"],
    'script-src': ["'self'", `'nonce-${nonce}'`],
    'style-src': ["'self'", `'nonce-${nonce}'`],
    'img-src': ["'self'", 'data:', 'https:'],
    'font-src': ["'self'", 'data:'],
    'connect-src': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'upgrade-insecure-requests': [],
  }
  
  return Object.entries(directives)
    .map(([key, values]) => `${key} ${values.join(' ')}`.trim())
    .join('; ')
}
