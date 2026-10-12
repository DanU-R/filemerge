import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      // Next menyediakan modul ini saat build; untuk vitest cukup di-stub.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
