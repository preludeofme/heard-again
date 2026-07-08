#!/usr/bin/env node
/**
 * Purge E2E test data from the local development database.
 *
 * Every user the E2E suite creates uses the reserved email pattern
 * `e2e-*@heardagain.test`, so cleanup is a targeted delete:
 *   1. familyspaces owned by e2e users (cascades people/stories/memberships/…)
 *   2. the e2e users themselves
 *
 * Usage: npm run test:e2e:cleanup
 * Reads DATABASE_URL from the environment or UI/.env. Never touches other rows.
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const EMAIL_PREFIX = 'e2e-'
const EMAIL_DOMAIN = '@heardagain.test'

function resolveDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const envPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'UI', '.env')
  try {
    const line = readFileSync(envPath, 'utf8')
      .split('\n')
      .find((l) => l.startsWith('DATABASE_URL='))
    if (line) return line.slice('DATABASE_URL='.length).trim().replace(/^"|"$/g, '')
  } catch {
    // fall through
  }
  throw new Error('DATABASE_URL not set and UI/.env not readable')
}

const prisma = new PrismaClient({ datasources: { db: { url: resolveDatabaseUrl() } } })

try {
  const where = {
    email: { startsWith: EMAIL_PREFIX, endsWith: EMAIL_DOMAIN },
  }

  const users = await prisma.user.findMany({ where, select: { id: true, email: true } })
  if (users.length === 0) {
    console.log('No E2E test users found — nothing to clean up.')
    process.exit(0)
  }

  const familyspaces = await prisma.familyspace.deleteMany({
    where: { ownerId: { in: users.map((u) => u.id) } },
  })
  const deletedUsers = await prisma.user.deleteMany({ where })

  console.log(
    `Removed ${deletedUsers.count} E2E user(s) and ${familyspaces.count} familyspace(s) ` +
      `matching ${EMAIL_PREFIX}*${EMAIL_DOMAIN}`,
  )
} finally {
  await prisma.$disconnect()
}
