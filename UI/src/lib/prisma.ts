import { PrismaClient, Prisma } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Redact sensitive information from Prisma query parameters
 */
function redactSensitiveParams(query: string, params: string): string {
  try {
    const parsed = JSON.parse(params);
    
    // List of sensitive fields to redact
    const sensitiveFields = [
      'password', 'token', 'secret', 'key', 'auth', 'session',
      'externalId', 'storagePath', 'ttsProfileId', 'embedding',
      'transcript', 'ocr', 'vector', 'voiceData', 'audioData'
    ];
    
    const redactValue = (obj: any, path: string = ''): any => {
      if (Array.isArray(obj)) {
        return obj.map(item => redactValue(item, path));
      }
      
      if (obj && typeof obj === 'object') {
        const redacted: any = {};
        for (const [key, value] of Object.entries(obj)) {
          const lowerKey = key.toLowerCase();
          const isSensitive = sensitiveFields.some(field => 
            lowerKey.includes(field) || path.includes(field)
          );
          
          if (isSensitive && value !== null && value !== undefined) {
            redacted[key] = typeof value === 'string' ? '[REDACTED_STRING]' : '[REDACTED_VALUE]';
          } else {
            redacted[key] = redactValue(value, `${path}.${key}`);
          }
        }
        return redacted;
      }
      
      return obj;
    };
    
    return JSON.stringify(redactValue(parsed));
  } catch {
    // If parsing fails, return redacted placeholder
    return '[REDACTED_PARAMS]';
  }
}

/**
 * Custom Prisma logger that redacts sensitive information
 */
const prismaLogger: Prisma.LogDefinition[] = [
  {
    level: 'query',
    emit: 'event',
  },
  {
    level: 'error',
    emit: 'event',
  },
  {
    level: 'warn',
    emit: 'event',
  },
];

const logOptions: Prisma.LogLevel[] = process.env.NODE_ENV === 'development' 
  ? ['query', 'error', 'warn'] 
  : ['error'];

const prismaOptions: Prisma.PrismaClientOptions = {
  log: process.env.NODE_ENV === 'development' ? prismaLogger : logOptions,
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
  
  // Set up event listeners for development logging
  if (process.env.NODE_ENV === 'development') {
    (prisma as any).$on('query', (event: any) => {
      const redactedParams = redactSensitiveParams(event.query, event.params);
      console.log(`[PRISMA_QUERY] ${event.query} -- ${redactedParams}`);
    });
    
    (prisma as any).$on('error', (event: any) => {
      console.error(`[PRISMA_ERROR] ${event.message}`);
    });
    
    (prisma as any).$on('warn', (event: any) => {
      console.warn(`[PRISMA_WARN] ${event.message}`);
    });
  }
}

export default prisma;
