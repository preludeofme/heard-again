/**
 * Cryptographically secure replacement for `Math.random()`.
 *
 * Works in both the browser (Web Crypto API) and Node.js (`globalThis.crypto`,
 * available without an import since Node 19+) — safe to use from client
 * components and server-side code alike. Same [0, 1) contract as `Math.random()`,
 * so it's a drop-in replacement.
 *
 * Use this for any non-cryptographic-secret randomness (UI jitter, shuffling,
 * ephemeral local IDs) that would otherwise trip SonarQube's "insecure PRNG"
 * rule (typescript:S2245). For actual secrets (tokens, filenames meant to
 * resist guessing, MFA codes), use Node's `crypto.randomBytes`/`randomInt`
 * directly instead.
 */
export function secureRandom(): number {
  const buf = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buf)
  return buf[0] / 0x100000000
}
