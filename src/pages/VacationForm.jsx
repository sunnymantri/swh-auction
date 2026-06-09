import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { searchPlayersByName, updatePlayerVacation } from '../lib/api'

export default function VacationForm() {
  const { auction, loading: auctionLoading } = useActiveAuction()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [weeksAway, setWeeksAway] = useState(0)
  const [busy, setBusy] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')

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
    setWeeksAway(player.weeks_away || 0)
    setSearch('')
    setResults([])
    setSuccess('')
    setError('')
  }

  const submit = async () => {
    if (!selected) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await updatePlayerVacation(selected.id, weeksAway)
      setSuccess(`Updated! ${selected.name} marked as away for ${weeksAway} week${weeksAway === 1 ? '' : 's'}.`)
      setSelected(null)
      setWeeksAway(0)
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

  return (
    <AppShell title="Vacation Form">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5 space-y-2">
          <h2 className="font-score text-xl text-white">Report your availability</h2>
          <p className="text-sm text-teal-300">
            If you'll be away for part of the season, let the captains know how many weeks you'll be unavailable.
          </p>
        </div>

        {!selected && (
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5 space-y-3">
            <label className="block text-sm text-teal-200 font-medium">
              Find your name
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Start typing your name…"
                className="mt-1 w-full rounded-lg bg-ink-900 border border-teal-700/50 px-4 py-3 text-white placeholder:text-teal-600"
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
                          : <span className="text-[0.5rem] text-teal-500">img</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white text-sm truncate">{p.name}</p>
                        <p className="text-xs text-teal-400">{p.role}{p.category ? ` · ${p.category}` : ''}</p>
                      </div>
                      {p.weeks_away > 0 && (
                        <span className="ml-auto text-xs text-yellow-400 shrink-0">
                          {p.weeks_away}w away
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {search.trim().length >= 2 && results.length === 0 && (
              <p className="text-sm text-teal-500">No players found matching "{search}"</p>
            )}
          </div>
        )}

        {selected && (
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-ink-900 border border-teal-700/40 overflow-hidden grid place-items-center shrink-0">
                {selected.photo_url
                  ? <img src={selected.photo_url} alt="" className="h-full w-full object-cover" />
                  : <span className="text-xs text-teal-500">img</span>}
              </div>
              <div>
                <p className="text-white font-score text-lg">{selected.name}</p>
                <p className="text-xs text-teal-400">{selected.role}{selected.category ? ` · ${selected.category}` : ''}</p>
              </div>
              <button onClick={() => { setSelected(null); setSuccess(''); setError('') }}
                className="ml-auto text-xs text-teal-400 hover:text-white px-2 py-1 rounded border border-teal-700/40">
                Change
              </button>
            </div>

            <label className="block text-sm text-teal-200 font-medium">
              How many weeks will you be away this season?
              <div className="mt-2 flex items-center gap-4">
                <input
                  type="range"
                  min="0"
                  max="12"
                  value={weeksAway}
                  onChange={(e) => setWeeksAway(Number(e.target.value))}
                  className="flex-1 accent-gold"
                />
                <span className="font-score text-2xl text-gold tabular w-12 text-center">{weeksAway}</span>
              </div>
              <p className="text-xs text-teal-500 mt-1">
                {weeksAway === 0 ? 'Available for the full season' : `Away for ${weeksAway} week${weeksAway === 1 ? '' : 's'}`}
              </p>
            </label>

            <button
              onClick={submit}
              disabled={busy}
              className="w-full px-4 py-3 rounded-lg bg-gold text-ink-900 font-semibold disabled:opacity-50 transition"
            >
              {busy ? 'Submitting…' : 'Submit'}
            </button>

            {error && <p className="text-red-400 text-sm">{error}</p>}
          </div>
        )}

        {success && (
          <div className="rounded-xl border border-green-600/40 bg-green-900/20 p-4 text-center">
            <p className="text-green-400 font-medium">{success}</p>
            <button
              onClick={() => setSuccess('')}
              className="mt-2 text-xs text-teal-300 hover:text-white"
            >
              Submit for another player
            </button>
          </div>
        )}
      </div>
    </AppShell>
  )
}
