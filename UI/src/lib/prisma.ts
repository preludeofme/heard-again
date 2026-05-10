import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use explicit log levels to avoid namespace resolution issues
const devLogConfig: NonNullable<Prisma.PrismaClientOptions['log']> = [
   { level: 'error', emit: 'stdout' },
  { level: 'warn', emit: 'stdout' },
];

// Initialize Prisma with a configuration that doesn't rely on explicitly naming the options type
const getPrismaClient = () => {
  const options: any = {
    log: process.env.NODE_ENV === 'development' ? devLogConfig : [{ level: 'error', emit: 'stdout' }],
  };

  if (process.env.NODE_ENV === 'production') {
    options.datasources = {
      db: {
        url: process.env.DATABASE_URL,
      },
    };
  }

  return new PrismaClient(options);
};

export const prisma = globalForPrisma.prisma ?? getPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
