import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const PRISMA_IMPORT_MESSAGE =
  "Please use repositories in '@/server/repositories/' instead of direct Prisma access. prisma should only be imported within the server/ directory."

const eslintConfig = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'next-env.d.ts'],
  },
  ...nextCoreWebVitals,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [{ name: '@/lib/prisma', message: PRISMA_IMPORT_MESSAGE }],
          patterns: [{ group: ['**/lib/prisma'], message: PRISMA_IMPORT_MESSAGE }],
        },
      ],
      // React Compiler is not enabled in this project (see next.config.js).
      // These rules anticipate Compiler semantics; keep them visible as
      // warnings rather than hard build failures until Compiler adoption.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
  {
    files: [
      'src/server/**/*.ts',
      'src/lib/prisma.ts',
      'src/__tests__/**/*.ts',
      'src/pages/api/**/*.ts',
      // Legacy call sites that pre-date the repository-pattern migration.
      // TODO: migrate these to use src/server/repositories/* directly.
      'src/lib/auth.ts',
      'src/lib/auth-helpers.ts',
      'src/lib/security/mfa.ts',
      'src/lib/security/mfa-service.ts',
      'src/lib/security/security-logger.ts',
      'src/lib/storage/url-service.ts',
      'src/lib/voice/generate-voice-sample.ts',
      'src/pages/profile/index.tsx',
      'src/services/**/*.ts',
      'src/trigger/**/*.ts',
      'src/workers/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': 'off',
    },
  },
]

export default eslintConfig
