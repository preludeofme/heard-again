// Set required environment variables before any module-level code runs
process.env.NEXTAUTH_SECRET = 'test-secret-32-chars-minimum-abcde'
;(process.env as any).NODE_ENV = 'test'
