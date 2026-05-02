import { useState, useEffect, useMemo } from 'react'
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

function Scratchers() {
  const [scratchers, setScratchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortKey, setSortKey] = useState('gameNumber')
  const [sortDir, setSortDir] = useState('desc')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')

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
                onClick={() => window.open(`https://www.calottery.com${s.GameProductPage}`, '_blank')}
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSorted.length === 0 && (
        <p className="no-results">No scratchers match your filters.</p>
      )}
    </div>
  )
}

export default Scratchers
