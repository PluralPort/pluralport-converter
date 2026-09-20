import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    // The converters and their clients are deliberately free of Vue and Nuxt
    // imports, so they can be tested as plain modules with no DOM.
    environment: 'node',
    include: ['test/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['app/lib/**', 'app/utils/**'],
    },
  },
})
