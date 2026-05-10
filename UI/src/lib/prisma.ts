import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use emit:'stdout' in development so Prisma writes logs directly without $on
// listeners — avoids listener accumulation across hot-reload cycles.
const devLogConfig: NonNullable<Prisma.PrismaClientOptions['log']> = [
  { level: 'error', emit: 'stdout' },
  { level: 'warn', emit: 'stdout' },
];

const prismaOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development' ? devLogConfig : [{ level: 'error', emit: 'stdout' }],
};

// Add connection pooling for production
if (process.env.NODE_ENV === 'production') {
  prismaOptions.datasources = {
    db: {
      url: process.env.DATABASE_URL,
    },
  };
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient(prismaOptions);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
