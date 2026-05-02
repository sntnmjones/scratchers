import fs from 'fs'
import path from 'path'

function parsePrizeTable(html) {
  const headingMatch = html.match(/<h3>Odds and Available Prizes<\/h3>/i)
  if (!headingMatch) return null

  const tableStart = html.indexOf('<table', headingMatch.index)
  if (tableStart === -1) return null

  const tableEnd = html.indexOf('</table>', tableStart)
  if (tableEnd === -1) return null

  const tableHtml = html.slice(tableStart, tableEnd + 8)
  const rowRegex = /<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi
  const prizes = []
  let rowMatch

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const prizeText = rowMatch[1].replace(/<[^>]*>/g, '').trim()
    const oddsText = rowMatch[2].replace(/<[^>]*>/g, '').trim().replace(/,/g, '')
    const remainingText = rowMatch[3].replace(/<[^>]*>/g, '').trim().replace(/,/g, '')

    const prizeMatch = prizeText.replace(/,/g, '').match(/[\d.]+/)
    const prizeValue = prizeMatch ? parseInt(prizeMatch[0], 10) : 0
    const odds = parseInt(oddsText, 10)
    const remMatch = remainingText.match(/(\d+)\s*of\s*(\d+)/)
    const remaining = remMatch ? parseInt(remMatch[1], 10) : 0
    const total = remMatch ? parseInt(remMatch[2], 10) : 0

    if (odds > 0 && total > 0) {
      prizes.push({ label: prizeText, prizeValue, odds, remaining, total })
    }
  }
  return prizes.length > 0 ? prizes : null
}

async function fetchGamePage(gameProductPage, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const url = `https://www.calottery.com/en${gameProductPage}`
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.calottery.com/',
        },
      })
      if (!res.ok) {
        console.warn(`  Fetch attempt ${i + 1} failed for ${gameProductPage}: ${res.status}`)
        if (i < retries) await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      return await res.text()
    } catch (err) {
      console.warn(`  Fetch attempt ${i + 1} failed for ${gameProductPage}: ${err.message}`)
      if (i < retries) await new Promise((r) => setTimeout(r, 2000))
    }
  }
  return null
}

async function fetchAllPrizeData(games) {
  const prizeData = {}
  for (const game of games) {
    console.log(`Fetching ${game.MarketingTitle} (${game.GameNumber})...`)
    const html = await fetchGamePage(game.GameProductPage)
    if (html) {
      const parsed = parsePrizeTable(html)
      if (parsed) {
        prizeData[game.GameNumber] = parsed
        console.log(`  ✓ Found ${parsed.length} prize tiers`)
      } else {
        console.log(`  ✗ Could not parse prize table`)
      }
    } else {
      console.log(`  ✗ Failed to fetch page`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  return prizeData
}

export default function prizeDataPlugin() {
  return {
    name: 'prize-data',
    async buildStart() {
      console.log('\n🎫 Fetching scratcher prize data from calottery.com...')

      try {
        const all = []
        let page = 1
        let totalPages = 1
        while (page <= totalPages) {
          const url = `https://www.calottery.com/api/Sitecore/ScratchersFilteredList/GetScratchers?modelId=0dc0c687-836a-43d3-aa8b-a0491dbf4001&sortBy=newest&page=${page}&size=12&show=&gametype=&price=&nameOrNumber=`
          const res = await fetch(url)
          if (!res.ok) {
            console.warn(`Failed to fetch scratchers list: ${res.status}`)
            return
          }
          const data = await res.json()
          totalPages = data.TotalPages
          all.push(...data.SerializedScratcherCardList)
          page++
        }

        console.log(`Found ${all.length} scratchers, fetching prize data...\n`)
        const prizeData = await fetchAllPrizeData(all)

        const outPath = path.resolve(__dirname, 'src/prize-data.json')
        fs.writeFileSync(outPath, JSON.stringify(prizeData, null, 2))
        console.log(`\n✅ Prize data saved to src/prize-data.json (${Object.keys(prizeData).length} games)\n`)
      } catch (err) {
        console.warn(`⚠️  Failed to fetch prize data: ${err.message}`)
      }
    },
  }
}
