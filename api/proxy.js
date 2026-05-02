export default async function handler(req) {
  const url = new URL(req.url)
  const path = url.searchParams.get('path')
  if (!path) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const target = `https://www.calottery.com/${path.replace(/^\/+/, '')}`
    const response = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.calottery.com/',
      },
    })

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream error: ${response.status}` }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const html = await response.text()
    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export const config = {
  runtime: 'edge',
}
