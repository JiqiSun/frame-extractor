import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',   // <- backend
      '/output': 'http://127.0.0.1:8000',
      '/static': 'http://127.0.0.1:8000',
      '/assets': 'http://127.0.0.1:8000',
    }
  }
})