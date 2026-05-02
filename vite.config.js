import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/calottery-api': {
        target: 'https://www.calottery.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/calottery-api/, ''),
        headers: {
          'Referer': 'https://www.calottery.com/',
        },
      },
    },
  },
})
