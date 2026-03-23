import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [react(), tailwindcss(), nodePolyfills({ globals: { Buffer: true, global: true, process: true } })],
  base: '/',
  build: {
    manifest: true,
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks: {
          'xmtp': ['@xmtp/browser-sdk'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': 'https://hazza.name',
      '/x402': 'https://hazza.name',
    },
  },
})
