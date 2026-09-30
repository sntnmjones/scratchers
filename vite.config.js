import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function apiProxyPlugin() {
  return {
    name: 'api-proxy',
    configureServer(server) {
      server.middlewares.use('/api/proxy', async (req, res) => {
        const urlObj = new URL(req.url, 'http://localhost')
        const action = urlObj.searchParams.get('action')

        let targetUrl = ''
        if (action === 'list') {
          urlObj.searchParams.delete('action')
          targetUrl = `https://www.calottery.com/api/Sitecore/ScratchersFilteredList/GetScratchers?${urlObj.searchParams.toString()}`
        } else if (action === 'game') {
          const path = urlObj.searchParams.get('path')
          targetUrl = `https://www.calottery.com/en${path}`
        } else {
          res.statusCode = 400
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'Invalid action' }))
          return
        }

        try {
          const response = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/json',
              'Accept-Language': 'en-US,en;q=0.9',
              'Referer': 'https://www.calottery.com/',
            },
          })

          res.statusCode = response.status
          const contentType = response.headers.get('content-type')
          if (contentType) res.setHeader('Content-Type', contentType)

          if (contentType && contentType.includes('application/json')) {
            const data = await response.json()
            res.end(JSON.stringify(data))
          } else {
            const text = await response.text()
            res.end(text)
          }
        } catch (err) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: err.message }))
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), apiProxyPlugin()],
})
