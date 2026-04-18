module.exports = {
  // Use the Jest environment for Next.js
  testEnvironment: 'jsdom',
  
  // Setup files — env.ts runs before modules load; setup.ts runs after the test framework
  setupFiles: ['<rootDir>/src/__tests__/setup/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup/setup.ts'],
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}',
    '<rootDir>/src/**/*.{test,spec}.{js,jsx,ts,tsx}'
  ],
  
  // Module path mapping
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  
  // Coverage
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**/*',
  ],
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', { presets: ['next/babel'] }],
  },
  
  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/.next/',
    '<rootDir>/node_modules/',
    '<rootDir>/TTS/',
    '<rootDir>/src/pages/api/',
    '<rootDir>/src/__tests__/setup/',
  ],
}
