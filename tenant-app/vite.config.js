import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron/simple'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
  plugins: [
    react(),
    electron({
      main: {
        entry: 'electron/main.js',
        onstart({ startup }) {
          const env = { ...process.env }
          delete env.ELECTRON_RUN_AS_NODE
          startup(undefined, { env })
        },
      },
      preload: {
        input: 'electron/preload.mjs',
      },
      renderer: {},
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        // Allow larger bundles in precache to avoid build failure on >2MB chunks
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
      manifest: {
        name: 'ACIS V2',
        short_name: 'ACIS',
        description: 'ACIS Ajman Default Template',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
