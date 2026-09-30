export default async function handler(req, res) {
  const { action, ...query } = req.query

  let targetUrl = ''
  if (action === 'list') {
    const params = new URLSearchParams(query).toString()
    targetUrl = `https://www.calottery.com/api/Sitecore/ScratchersFilteredList/GetScratchers?${params}`
  } else if (action === 'game') {
    const { path } = query
    targetUrl = `https://www.calottery.com/en${path}`
  } else {
    return res.status(400).json({ error: 'Invalid action' })
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

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch: ${response.status}` })
    }

    const contentType = response.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json()
      return res.status(200).json(data)
    } else {
      const text = await response.text()
      return res.status(200).send(text)
    }
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
}
