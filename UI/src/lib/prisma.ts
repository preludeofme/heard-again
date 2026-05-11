import { Prisma, PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const prismaOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development'
    ? [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ]
    : [{ level: 'error', emit: 'stdout' }],
  ...(process.env.NODE_ENV === 'production' && process.env.DATABASE_URL
    ? {
        datasources: {
          db: {
            url: process.env.DATABASE_URL,
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
