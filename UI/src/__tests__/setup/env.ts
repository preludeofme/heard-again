// Set required environment variables before any module-level code runs
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-abcde'
;(process.env as any).NODE_ENV = 'test'

const streamWeb = require('node:stream/web')
const nodeUtil = require('node:util')

if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = streamWeb.TransformStream
}
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = streamWeb.ReadableStream
}
if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = streamWeb.WritableStream
}
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = nodeUtil.TextEncoder
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = nodeUtil.TextDecoder
}
