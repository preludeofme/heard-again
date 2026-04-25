// Next.js calls register() once per runtime (Node + Edge). The worker tree
// pulls in fs/promises and BullMQ which are Node-only — splitting the import
// into a separate file keeps webpack from following that tree in the Edge
// runtime bundle, which would otherwise fail with "Can't resolve 'fs/promises'".
//
// Note: the helper file must NOT contain ".node" before its extension, since
// webpack treats `*.node` as a native-binary module and refuses to resolve it.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentationNode')
  }
}
