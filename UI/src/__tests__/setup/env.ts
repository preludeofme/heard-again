// Set required environment variables before any module-level code runs
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-abcde'
;(process.env as any).NODE_ENV = 'test'

const { TransformStream, ReadableStream, WritableStream } = require('node:stream/web')
const { TextEncoder, TextDecoder } = require('node:util')

if (typeof global.TransformStream === 'undefined') {
  global.TransformStream = TransformStream
}
if (typeof global.ReadableStream === 'undefined') {
  global.ReadableStream = ReadableStream
}
if (typeof global.WritableStream === 'undefined') {
  global.WritableStream = WritableStream
}
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder
}
