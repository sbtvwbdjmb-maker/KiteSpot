import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Alias @/ vers src, convention shadcn
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    // Écoute sur toutes les interfaces (IPv4 + IPv6) pour être accessible
    // depuis le navigateur local et depuis un téléphone sur le même Wi-Fi
    host: true,
  },
})
