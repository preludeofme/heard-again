import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prefer DATABASE_URL (set in Trigger.dev / some envs) then POSTGRES_URL (set by Neon integration).
// Do not gate on NODE_ENV — Trigger.dev does not set it, so the override would silently be skipped.
const resolvedDbUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

const prismaOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development'
    ? [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]
    : [{ level: 'error', emit: 'stdout' }],
  ...(resolvedDbUrl
    ? {
        datasources: {
          db: {
            url: resolvedDbUrl,
          },
        },
      }
    : {}),
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export { prisma };
export default prisma;
