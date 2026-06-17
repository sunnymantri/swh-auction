import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { searchPlayersByName, updatePlayerVacation } from '../lib/api'

const DAY_MAP = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }

function getMatchDays(startDate, endDate, matchDay = 'Sunday') {
  const days = []
  const targetDay = DAY_MAP[matchDay] ?? 0
  const start = new Date(startDate + 'T12:00:00')
  const end = new Date(endDate + 'T12:00:00')
  const current = new Date(start)
  const diff = (targetDay - current.getDay() + 7) % 7
  if (diff > 0) current.setDate(current.getDate() + diff)
  while (current <= end) {
    days.push(current.toISOString().split('T')[0])
    current.setDate(current.getDate() + 7)
  }
  return days
}

function formatMatchDay(dateStr, timezone = 'Australia/Sydney') {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone })
}

export default function VacationForm() {
  const { auction, loading: auctionLoading } = useActiveAuction()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [selectedDates, setSelectedDates] = useState([])
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

  const matchDay = auction?.match_day || 'Sunday'
  const timezone = auction?.timezone || 'Australia/Sydney'

  const sundays = useMemo(() => {
    if (!auction?.season_start_date || !auction?.season_end_date) return []
    return getMatchDays(auction.season_start_date, auction.season_end_date, matchDay)
  }, [auction, matchDay])

  useEffect(() => {
    if (!auction || search.trim().length < 2) {
      setResults([])
      return
    }
    const timeout = setTimeout(async () => {
      try {
        const data = await searchPlayersByName(auction.id, search.trim())
        setResults(data)
      } catch {
        setResults([])
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [auction, search])

  const selectPlayer = (player) => {
    setSelected(player)
    const existing = Array.isArray(player.vacation_dates) ? player.vacation_dates : []
    setSelectedDates(existing)
    setSearch('')
    setResults([])
    setSuccess('')
    setError('')
  }

  const toggleDate = (date) => {
    setSelectedDates((prev) =>
      prev.includes(date) ? prev.filter((d) => d !== date) : [...prev, date]
    )
  }

  const selectAll = () => setSelectedDates([...sundays])
  const clearAll = () => setSelectedDates([])

  const submit = async () => {
    if (!selected) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const sorted = [...selectedDates].sort()
      await updatePlayerVacation(selected.id, sorted)
      const count = sorted.length
      setSuccess(
        count === 0
          ? `Updated! ${selected.name} is available for the full season.`
          : `Updated! ${selected.name} marked as away for ${count} ${matchDay}${count === 1 ? '' : 's'}.`
      )
      setSelected(null)
      setSelectedDates([])
    } catch (e) {
      setError(e.message || 'Failed to update. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  if (auctionLoading) {
    return <AppShell title="Vacation Form"><p className="text-teal-400 animate-pulse">Loading…</p></AppShell>
  }

  if (!auction) {
    return <AppShell title="Vacation Form"><p className="text-teal-400">No active auction found.</p></AppShell>
  }

  if (!auction.season_start_date || !auction.season_end_date) {
    return (
      <AppShell title="Vacation Form">
        <div className="max-w-lg mx-auto rounded-xl border border-yellow-600/40 bg-yellow-900/20 p-5 text-center">
          <p className="va-body text-yellow-400 font-medium">Season dates not configured yet.</p>
          <p className="va-support text-teal-300 mt-2">The auction admin needs to set the season start and end dates in Auctions → Configuration.</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Vacation Form">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5 space-y-2">
          <h2 className="va-section-title text-white">Report your availability</h2>
          <p className="va-body text-teal-300">
            Select the {matchDay}s you'll be unavailable this season ({formatMatchDay(auction.season_start_date, timezone)} – {formatMatchDay(auction.season_end_date, timezone)}).
          </p>
        </div>

        {!selected && (
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5 space-y-3">
            <label className="va-body block text-teal-200 font-medium">
              Find your name
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Start typing your name…"
                className="va-body mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-4 py-3 text-white placeholder:text-teal-600"
              />
            </label>

            {results.length > 0 && (
              <ul className="rounded-lg border border-teal-700/40 bg-ink-900 divide-y divide-teal-700/30 max-h-60 overflow-y-auto">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      onClick={() => selectPlayer(p)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-teal-900/30 transition"
                    >
                      <div className="h-8 w-8 rounded-lg bg-ink-800 border border-teal-700/40 overflow-hidden grid place-items-center shrink-0">
                        {p.photo_url
                          ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                          : <span className="va-micro text-teal-500">img</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="va-body text-white truncate">{p.name}</p>
                        <p className="va-micro text-teal-400">{p.role}{p.category ? ` · ${p.category}` : ''}</p>
                      </div>
                      {p.weeks_away > 0 && (
                        <span className="va-micro ml-auto text-yellow-400 shrink-0">
                          {p.weeks_away}w away
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {search.trim().length >= 2 && results.length === 0 && (
              <p className="va-support text-teal-500">No players found matching "{search}"</p>
            )}
          </div>
        )}

        {selected && (
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-ink-900 border border-teal-700/40 overflow-hidden grid place-items-center shrink-0">
                {selected.photo_url
                  ? <img src={selected.photo_url} alt="" className="h-full w-full object-cover" />
                  : <span className="va-micro text-teal-500">img</span>}
              </div>
              <div>
                <p className="va-card-title text-white">{selected.name}</p>
                <p className="va-micro text-teal-400">{selected.role}{selected.category ? ` · ${selected.category}` : ''}</p>
              </div>
              <button onClick={() => { setSelected(null); setSuccess(''); setError('') }}
                className="va-micro ml-auto text-teal-400 hover:text-white px-2 py-1 rounded border border-teal-700/40">
                Change
              </button>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="va-body text-teal-200 font-medium">
                  Select {matchDay}s you'll be away
                  {selectedDates.length > 0 && (
                    <span className="text-yellow-400 ml-2">({selectedDates.length} selected)</span>
                  )}
                </p>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="va-micro text-teal-400 hover:text-white">All</button>
                  <button onClick={clearAll} className="va-micro text-teal-400 hover:text-white">None</button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-64 overflow-y-auto rounded-lg border border-teal-700/30 bg-ink-900/50 p-3">
                {sundays.map((date) => {
                  const checked = selectedDates.includes(date)
                  return (
                    <label key={date} className={`flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition ${checked ? 'bg-yellow-900/30 border border-yellow-600/30' : 'hover:bg-teal-900/30 border border-transparent'}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleDate(date)}
                        className="accent-gold shrink-0"
                      />
                      <span className={`va-body ${checked ? 'text-yellow-400' : 'text-teal-200'}`}>
                        {formatMatchDay(date, timezone)}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <button
              onClick={submit}
              disabled={busy}
              className="w-full px-4 py-3 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50 transition"
            >
              {busy ? 'Submitting…' : 'Submit'}
            </button>

            {error && <p className="va-support text-red-400">{error}</p>}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-600/40 bg-green-900/20 p-4 text-center">
            <p className="va-body text-green-400 font-medium">{success}</p>
            <button
              onClick={() => setSuccess('')}
              className="va-micro mt-2 text-teal-300 hover:text-white"
            >
              Submit for another player
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
