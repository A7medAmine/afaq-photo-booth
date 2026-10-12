import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxy = { '/api': 'http://localhost:8787' }

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy,
  },
  // `npm start` serves the production build on the same URL as dev
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy,
  },
})
