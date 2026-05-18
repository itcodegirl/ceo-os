import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Explicit vendor chunking so shared dependencies (React, the
        // router, Supabase, Valibot) stay in dedicated chunks instead of
        // being inlined into whichever route happens to import them first.
        // Rollup already deduplicates well, but naming the chunks
        // explicitly gives a stable filename surface for the route-budget
        // baseline and makes the dependency footprint legible in the
        // build output.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }
          if (id.includes('react-router')) return 'vendor-router'
          if (id.includes('react-dom') || id.includes('/scheduler/')) return 'vendor-react'
          if (id.match(/\/react\//)) return 'vendor-react'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('valibot')) return 'vendor-valibot'
          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    testTimeout: 10000,
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
