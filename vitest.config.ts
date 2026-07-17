import { defineConfig, configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, '.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      include: ['lib/**/*.mjs', 'lib/**/*.ts'],
      exclude: ['lib/__tests__/**', 'lib/types.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
  },
})
