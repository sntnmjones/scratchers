import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import prizeDataPlugin from './vite-plugin-prize-data.js'

export default defineConfig({
  plugins: [react(), prizeDataPlugin()],
})
