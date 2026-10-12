import { defineConfig, globalIgnores } from 'eslint/config'
import next from 'eslint-config-next'

export default defineConfig([
  globalIgnores(['.next/**', 'node_modules/**', 'src/prisma/contract.d.ts', 'tests/bench/**']),
  ...next,
])
