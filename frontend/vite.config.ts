import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // Without this, Vite's dep pre-bundler can end up with two separate copies of
    // `immer` in dev — one for the app's own `import { enableMapSet } from 'immer'`
    // and a different one inlined inside the `zustand/middleware/immer` pre-bundle
    // chunk. enableMapSet() then registers the MapSet plugin on the wrong copy's
    // plugin registry, and any store update touching a Set/Map (transactionsSlice's
    // `selectedIds: Set<number>`) throws "The plugin for 'MapSet' has not been
    // loaded into Immer" even though enableMapSet() clearly ran. Deduping forces
    // both import sites to resolve to the exact same module instance.
    dedupe: ['immer'],
  },
  optimizeDeps: {
    include: ['immer', 'zustand/middleware/immer'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom')) return 'vendor'
          if (id.includes('node_modules/react')) return 'vendor'
          if (id.includes('node_modules/react-router-dom')) return 'router'
        },
      },
    },
  },
})
