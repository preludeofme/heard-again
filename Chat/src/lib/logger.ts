/**
 * Structured logger for the Chat service.
 * Mirrors the pino-based logger used by the UI service so log output
 * has the same JSON shape in production and is readable in dev.
 */

const isDev = process.env.NODE_ENV !== 'production'

type Level = 'info' | 'warn' | 'error' | 'debug'

function write(level: Level, ctx: Record<string, unknown>, msg: string) {
  const entry = {
    level,
    time: new Date().toISOString(),
    service: 'heardagain-chat',
    environment: process.env.NODE_ENV || 'development',
    ...ctx,
    msg,
  }

  if (isDev) {
    // Human-readable in dev — prefix with level label
    const label = { info: 'INFO', warn: 'WARN', error: 'ERROR', debug: 'DEBUG' }[level]
    const ctxStr = Object.keys(ctx).length ? ' ' + JSON.stringify(ctx) : ''
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
    fn(`[${label}] [chat]${ctxStr} ${msg}`)
  } else {
    // JSON in production
    const fn = level === 'error' ? console.error : console.log
    fn(JSON.stringify(entry))
  }
}

export const logger = {
  info:  (ctx: Record<string, unknown> | string, msg?: string) =>
    typeof ctx === 'string' ? write('info',  {}, ctx)  : write('info',  ctx, msg!),
  warn:  (ctx: Record<string, unknown> | string, msg?: string) =>
    typeof ctx === 'string' ? write('warn',  {}, ctx)  : write('warn',  ctx, msg!),
  error: (ctx: Record<string, unknown> | string, msg?: string) =>
    typeof ctx === 'string' ? write('error', {}, ctx)  : write('error', ctx, msg!),
  debug: (ctx: Record<string, unknown> | string, msg?: string) =>
    typeof ctx === 'string' ? write('debug', {}, ctx)  : write('debug', ctx, msg!),
}
