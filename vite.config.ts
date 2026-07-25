import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Écoute sur toutes les interfaces (IPv4 + IPv6) pour être accessible
    // depuis le navigateur local et depuis un téléphone sur le même Wi-Fi
    host: true,
  },
})
