import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      pwaAssets: { config: true },
      registerType: 'autoUpdate',
      manifest: {
        name: 'Sevak Library',
        short_name: 'Sevak Library',
        description: 'Sevak Library membership admission form',
        theme_color: '#1a7f4b',
        background_color: '#f0f4f1',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait'
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallback: 'index.html'
      },
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    port: 5173,
    host: true
  }
})
