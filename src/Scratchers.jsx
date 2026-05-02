import { useState, useEffect, useMemo, useCallback } from 'react'
import './Scratchers.css'

const API_BASE =
  'https://www.calottery.com/api/Sitecore/ScratchersFilteredList/GetScratchers'
const API_PARAMS =
  'modelId=0dc0c687-836a-43d3-aa8b-a0491dbf4001&sortBy=newest'

function parsePrice(str) {
  const num = parseInt(str.replace(/[^0-9]/g, ''), 10)
  return isNaN(num) ? 0 : num
}

function parseTopPrize(str) {
  if (!str) return 0
  const match = str.replace(/,/g, '').match(/[\d.]+/)
  return match ? parseFloat(match[0]) : 0
}

function parseOdds(str) {
  return str ? parseFloat(str) : 0
}

function parseMarketDate(str) {
  const match = str.match(/Date\((\d+)\)/)
  return match ? new Date(parseInt(match[1], 10)) : new Date(0)
}

function formatNum(n) {
  if (n == null) return '—'
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function formatPct(n) {
  if (n == null || !isFinite(n)) return '—'
  return (n * 100).toFixed(2) + '%'
}

function parsePrizeTable(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const heading = doc.querySelector('h3')
  if (
    !heading ||
    !heading.textContent.toLowerCase().includes('odds and available prizes')
  ) {
    return null
  }
  const table = doc.querySelector('.odds-available-prizes__table table, .odds-available-prizes table')
  if (!table) return null

  const rows = table.querySelectorAll('tr')
  const prizes = []
  for (const row of rows) {
    const cells = row.querySelectorAll('td')
    if (cells.length < 3) continue
    const prizeText = cells[0].textContent.trim()
    const oddsText = cells[1].textContent.trim().replace(/,/g, '')
    const remainingText = cells[2].textContent.trim().replace(/,/g, '')

    const prizeMatch = prizeText.replace(/,/g, '').match(/[\d.]+/)
    const prizeValue = prizeMatch ? parseInt(prizeMatch[0], 10) : 0
    const odds = parseInt(oddsText, 10)
    const remMatch = remainingText.match(/(\d+)\s*of\s*(\d+)/)
    const remaining = remMatch ? parseInt(remMatch[1], 10) : 0
    const total = remMatch ? parseInt(remMatch[2], 10) : 0

    if (odds > 0 && total > 0) {
      prizes.push({
        label: prizeText,
        prizeValue,
        odds,
        remaining,
        total,
      })
    }
  }
  return prizes
}

function computeStats(prizes, overallOdds) {
  if (!prizes.length) return null

  const totalTicketsInitial = prizes.reduce((max, p) => {
    const estimated = p.odds * p.total
    return Math.max(max, estimated)
  }, 0)

  const totalPrizesInitially = prizes.reduce((sum, p) => sum + p.total, 0)
  const totalPrizesRemaining = prizes.reduce((sum, p) => sum + p.remaining, 0)

  const remainingRatio =
    totalPrizesInitially > 0 ? totalPrizesRemaining / totalPrizesInitially : 0
  const totalTicketsRemaining = Math.round(totalTicketsInitial * remainingRatio)

  const claimedTickets = totalTicketsInitial - totalTicketsRemaining
  const soldPct =
    totalTicketsInitial > 0 ? claimedTickets / totalTicketsInitial : 0

  const currentOverallOdds =
    totalPrizesRemaining > 0 && totalTicketsRemaining > 0
      ? totalTicketsRemaining / totalPrizesRemaining
      : null

  const originalOverallOdds = parseOdds(overallOdds)
  const originalTotalTickets =
    originalOverallOdds > 0 && totalPrizesInitially > 0
      ? Math.round(originalOverallOdds * totalPrizesInitially)
      : null

  return {
    totalTicketsInitial,
    totalTicketsRemaining,
    totalPrizesInitially,
    totalPrizesRemaining,
    claimedTickets,
    soldPct,
    currentOverallOdds,
    originalTotalTickets,
    prizeTiers: prizes,
  }
}

function PrizeDetailModal({ game, onClose }) {
  const [prizes, setPrizes] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortBy, setSortBy] = useState('prize')
  const [sortDir, setSortDir] = useState('desc')

  useEffect(() => {
    let cancelled = false
    async function fetchDetail() {
      try {
        const gamePath = `en${game.GameProductPage}`
        const url = import.meta.env.DEV
          ? `/calottery-api/${gamePath}`
          : `/api/proxy?path=${encodeURIComponent(gamePath)}`
        const res = await fetch(url)
        if (!res.ok) throw new Error(`Failed to load: ${res.status}`)
        const html = await res.text()
        const parsed = parsePrizeTable(html)
        if (!parsed) throw new Error('Could not find prize table on game page')
        if (!cancelled) {
          setPrizes(parsed)
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchDetail()
    return () => {
      cancelled = true
    }
  }, [game])

  const stats = useMemo(() => {
    if (!prizes) return null
    return computeStats(prizes, game.OverallOdds)
  }, [prizes, game])

  const sortedTiers = useMemo(() => {
    if (!stats) return []
    const tiers = [...stats.prizeTiers]
    tiers.sort((a, b) => {
      let cmp = 0
      switch (sortBy) {
        case 'prize':
          cmp = a.prizeValue - b.prizeValue
          break
        case 'odds':
          cmp = a.odds - b.odds
          break
        case 'remaining':
          cmp = a.remaining - b.remaining
          break
        case 'pctRemaining':
          cmp = a.remaining / a.total - b.remaining / b.total
          break
        default:
          cmp = a.prizeValue - b.prizeValue
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return tiers
  }, [stats, sortBy, sortDir])

  function handleSort(key) {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('desc')
    }
  }

  function sortIcon(key) {
    if (sortBy !== key) return '↕'
    return sortDir === 'asc' ? '↑' : '↓'
  }

  if (!game) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <img
              className="modal-thumb"
              src={game.ScratchersImage}
              alt={game.AltText}
            />
            <div>
              <h3>{game.MarketingTitle}</h3>
              <span className="modal-subtitle">Game #{game.GameNumber}</span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading && <div className="modal-body">Loading prize data...</div>}
        {error && <div className="modal-body error">Error: {error}</div>}

        {stats && (
          <>
            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Tickets Printed</span>
                <span className="stat-value">
                  {formatNum(stats.originalTotalTickets || stats.totalTicketsInitial)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Tickets Remaining</span>
                <span className="stat-value">
                  {formatNum(stats.totalTicketsRemaining)}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">% Sold</span>
                <span className="stat-value">{formatPct(stats.soldPct)}</span>
              </div>
              <div className="stat-card highlight">
                <span className="stat-label">Original Odds</span>
                <span className="stat-value">1 : {game.OverallOdds}</span>
              </div>
              <div className="stat-card highlight">
                <span className="stat-label">Current Odds</span>
                <span className="stat-value">
                  {stats.currentOverallOdds != null
                    ? `1 : ${stats.currentOverallOdds.toFixed(2)}`
                    : 'N/A'}
                </span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Prizes Remaining</span>
                <span className="stat-value">
                  {formatNum(stats.totalPrizesRemaining)}{' '}
                  <span className="stat-sub">
                    of {formatNum(stats.totalPrizesInitially)}
                  </span>
                </span>
              </div>
            </div>

            <div className="prize-table-wrapper">
              <table className="prize-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort('prize')}>
                      Prize {sortIcon('prize')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('odds')}>
                      Odds 1 in {sortIcon('odds')}
                    </th>
                    <th className="sortable" onClick={() => handleSort('remaining')}>
                      Remaining {sortIcon('remaining')}
                    </th>
                    <th>Total</th>
                    <th className="sortable" onClick={() => handleSort('pctRemaining')}>
                      % Left {sortIcon('pctRemaining')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTiers.map((tier, i) => {
                    const pctLeft = (tier.remaining / tier.total) * 100
                    return (
                      <tr key={i}>
                        <td className="prize-val">${formatNum(tier.prizeValue)}</td>
                        <td>{formatNum(tier.odds)}</td>
                        <td className={tier.remaining === 0 ? 'zero' : ''}>
                          {formatNum(tier.remaining)}
                        </td>
                        <td>{formatNum(tier.total)}</td>
                        <td>
                          <span className="pct-bar-cell">
                            <span
                              className="pct-bar"
                              style={{ width: `${pctLeft}%` }}
                            />
                            {pctLeft.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Scratchers() {
  const [scratchers, setScratchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortKey, setSortKey] = useState('gameNumber')
  const [sortDir, setSortDir] = useState('desc')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [selectedGame, setSelectedGame] = useState(null)

  useEffect(() => {
    async function fetchAll() {
      try {
        const all = []
        let page = 1
        let totalPages = 1
        while (page <= totalPages) {
          const url = `${API_BASE}?${API_PARAMS}&page=${page}&size=12&show=&gametype=&price=&nameOrNumber=`
          const res = await fetch(url)
          if (!res.ok) throw new Error(`API error: ${res.status}`)
          const data = await res.json()
          totalPages = data.TotalPages
          all.push(...data.SerializedScratcherCardList)
          page++
        }
        setScratchers(all)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchAll()
  }, [])

  const gameTypes = useMemo(() => {
    const types = new Set()
    scratchers.forEach((s) => {
      if (s.GameType) types.add(s.GameType)
    })
    return Array.from(types).sort()
  }, [scratchers])

  const filteredAndSorted = useMemo(() => {
    let items = [...scratchers]
    if (typeFilter) {
      items = items.filter((s) => s.GameType === typeFilter)
    }
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (s) =>
          s.MarketingTitle.toLowerCase().includes(q) ||
          s.GameNumber.toString().includes(q) ||
          (s.GameType && s.GameType.toLowerCase().includes(q))
      )
    }
    items.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'price':
          cmp = parsePrice(a.GamePrice) - parsePrice(b.GamePrice)
          break
        case 'prize':
          cmp = parseTopPrize(a.TopPrizeDollarAmt) - parseTopPrize(b.TopPrizeDollarAmt)
          break
        case 'odds':
          cmp = parseOdds(a.OverallOdds) - parseOdds(b.OverallOdds)
          break
        case 'date':
          cmp = parseMarketDate(a.GotoMarketDate) - parseMarketDate(b.GotoMarketDate)
          break
        default:
          cmp = a.GameNumber - b.GameNumber
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return items
  }, [scratchers, typeFilter, search, sortKey, sortDir])

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  function sortIcon(key) {
    if (sortKey !== key) return '↕'
    return sortDir === 'asc' ? '↑' : '↓'
  }

  const handleRowClick = useCallback((game) => {
    setSelectedGame(game)
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedGame(null)
  }, [])

  useEffect(() => {
    function handleEscape(e) {
      if (e.key === 'Escape') setSelectedGame(null)
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  if (loading) return <div className="scratchers-container">Loading scratchers...</div>
  if (error) return <div className="scratchers-container">Error: {error}</div>

  return (
    <div className="scratchers-container">
      <h2>CA Lottery Scratchers ({scratchers.length} total)</h2>

      <div className="controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search name, number, or type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="type-select"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {gameTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="table-wrapper">
        <table className="scratchers-table">
          <thead>
            <tr>
              <th></th>
              <th className="sortable" onClick={() => handleSort('gameNumber')}>
                # {sortIcon('gameNumber')}
              </th>
              <th>Game</th>
              <th className="sortable" onClick={() => handleSort('price')}>
                Price {sortIcon('price')}
              </th>
              <th className="sortable" onClick={() => handleSort('prize')}>
                Top Prize {sortIcon('prize')}
              </th>
              <th className="sortable" onClick={() => handleSort('odds')}>
                Odds {sortIcon('odds')}
              </th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((s) => (
              <tr
                key={s.GameNumber}
                className="scratcher-row"
                onClick={() => handleRowClick(s)}
              >
                <td className="img-cell">
                  <img src={s.ScratchersImage} alt={s.AltText} />
                </td>
                <td>{s.GameNumber}</td>
                <td className="name-cell">{s.MarketingTitle}</td>
                <td>{s.GamePrice}</td>
                <td>{s.TopPrizeDollarAmt}</td>
                <td>1 : {s.OverallOdds}</td>
                <td>{s.GameType || '—'}</td>
                <td className="link-cell">
                  <a
                    href={`https://www.calottery.com${s.GameProductPage}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    title="Open on calottery.com"
                  >
                    ↗
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSorted.length === 0 && (
        <p className="no-results">No scratchers match your filters.</p>
      )}

      {selectedGame && (
        <PrizeDetailModal
          game={selectedGame}
          onClose={handleCloseModal}
        />
      )}
    </div>
  )
}

export default Scratchers
