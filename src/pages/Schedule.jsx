import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuth } from '../context/AuthContext'
import { listTeams, updateAuction } from '../lib/api'

function formatDate(dateStr, timezone = 'Australia/Sydney') {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone })
}

// Schedule team names carry an "SWH " prefix the teams table doesn't, so we
// match on a normalised key (prefix stripped, case-folded).
function normTeam(name) {
  return String(name || '').replace(/^swh\s+/i, '').trim().toLowerCase()
}

function initials(name) {
  return String(name || '')
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '').join('') || '?'
}

function TeamCell({ name, team }) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div className="h-7 w-7 shrink-0 overflow-hidden rounded-md border border-teal-700/40 bg-ink-900">
        {team?.logo_url ? (
          <img src={team.logo_url} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-teal-900/40 text-[10px] font-semibold text-teal-300">
            {initials(name)}
          </div>
        )}
      </div>
      <span className="truncate">{name}</span>
    </div>
  )
}

const EMPTY_FILTERS = { round: '', team: '', home: '', away: '', venue: '', umpire: '', division: '' }

export default function Schedule() {
  const { auction, loading, reload } = useActiveAuction()
  const { isAdmin } = useAuth()

  const [teams, setTeams] = useState([])
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [editing, setEditing] = useState(null) // { key, value }
  const [savingKey, setSavingKey] = useState(null)
  const [saveErr, setSaveErr] = useState('')

  const auctionId = auction?.id
  useEffect(() => {
    if (!auctionId) return
    let alive = true
    listTeams(auctionId).then((rows) => { if (alive) setTeams(rows || []) }).catch(() => {})
    return () => { alive = false }
  }, [auctionId])

  const teamByName = useMemo(() => {
    const m = new Map()
    for (const t of teams) m.set(normTeam(t.name), t)
    return m
  }, [teams])

  const schedule = Array.isArray(auction?.season_schedule) ? auction.season_schedule : []
  const timezone = auction?.timezone || 'Australia/Sydney'

  // Flatten to one row per match, keeping indices so we can write back.
  const rows = useMemo(() => {
    const out = []
    schedule.forEach((round, ri) => {
      const label = round.label || `Round ${round.round}`
      ;(round.matches || []).forEach((match, mi) => {
        out.push({
          ri, mi,
          round: label,
          date: round.date || null,
          home: match.home || '',
          away: match.away || '',
          venue: match.venue || '',
          umpire: match.umpire || '',
          division: match.division || '',
        })
      })
    })
    return out
  }, [schedule])

  const hasDivision = rows.some((r) => r.division)

  const options = useMemo(() => {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))]
    return {
      round: uniq(rows.map((r) => r.round)),
      venue: uniq(rows.map((r) => r.venue)).sort(),
      umpire: uniq(rows.map((r) => r.umpire)).sort(),
      division: uniq(rows.map((r) => r.division)).sort(),
    }
  }, [rows])

  const filtered = useMemo(() => {
    const team = filters.team.trim().toLowerCase()
    const home = filters.home.trim().toLowerCase()
    const away = filters.away.trim().toLowerCase()
    return rows.filter((r) => {
      if (filters.round && r.round !== filters.round) return false
      if (filters.venue && r.venue !== filters.venue) return false
      if (filters.umpire && r.umpire !== filters.umpire) return false
      if (filters.division && r.division !== filters.division) return false
      if (home && !r.home.toLowerCase().includes(home)) return false
      if (away && !r.away.toLowerCase().includes(away)) return false
      if (team && !r.home.toLowerCase().includes(team) && !r.away.toLowerCase().includes(team)) return false
      return true
    })
  }, [rows, filters])

  const filtersActive = Object.values(filters).some((v) => v !== '')

  async function commitUmpire(ri, mi, value) {
    setSaveErr('')
    if (value === (schedule[ri]?.matches?.[mi]?.umpire || '')) { setEditing(null); return }
    const next = schedule.map((round, i) => {
      if (i !== ri) return round
      const matches = round.matches.map((m, j) => (j === mi ? { ...m, umpire: value } : m))
      return { ...round, matches }
    })
    setSavingKey(`${ri}-${mi}`)
    try {
      await updateAuction(auctionId, { season_schedule: next })
      await reload()
    } catch (e) {
      setSaveErr(e?.message || 'Could not save umpire change.')
    } finally {
      setSavingKey(null)
      setEditing(null)
    }
  }

  if (loading) {
    return <AppShell title="Schedule"><p className="text-teal-400 animate-pulse">Loading…</p></AppShell>
  }
  if (!auction) {
    return <AppShell title="Schedule"><p className="text-teal-400">No active season found.</p></AppShell>
  }
  if (schedule.length === 0) {
    return (
      <AppShell title="Schedule">
        <div className="max-w-2xl mx-auto rounded-xl border border-yellow-600/40 bg-yellow-900/20 p-6 text-center">
          <p className="va-card-title text-yellow-400 font-medium">Season schedule not yet generated.</p>
          <p className="va-support text-teal-300 mt-2">
            The admin can generate it in Auctions → Configuration → Schedule.
          </p>
        </div>
      </AppShell>
    )
  }

  const thBase = 'va-label text-left px-3 py-2 text-teal-500 font-medium align-top'
  const selCls = 'va-micro w-full rounded-md bg-ink-900 border border-teal-700/50 px-2 py-1 text-teal-100 font-normal'

  return (
    <AppShell title="Schedule">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="va-page-title text-white">{auction.name} — Season Schedule</h2>
            <p className="va-body text-teal-400 mt-1">
              {auction.season} · {schedule.length} rounds · {rows.length} matches · Games on {auction.match_day || 'Sunday'}s
            </p>
          </div>
          <div className="va-micro text-teal-400">
            Showing {filtered.length} of {rows.length}
            {filtersActive && (
              <button onClick={() => setFilters(EMPTY_FILTERS)}
                className="ml-3 rounded-md border border-teal-700/50 px-2 py-1 text-teal-200 hover:bg-teal-900/40 transition">
                Clear filters
              </button>
            )}
          </div>
        </div>

        {saveErr && (
          <div className="rounded-lg border border-red-600/40 bg-red-900/20 px-4 py-2 va-support text-red-300">{saveErr}</div>
        )}

        {/* Single filterable table */}
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="va-body w-full">
              <thead>
                {/* Labels */}
                <tr className="border-b border-teal-700/20 bg-teal-900/30">
                  <th className={thBase + ' w-[12%]'}>Round</th>
                  <th className={thBase + ' w-[12%]'}>Date</th>
                  {hasDivision && <th className={thBase + ' w-[9%]'}>Division</th>}
                  <th className={thBase + ' w-[20%]'}>Home</th>
                  <th className={thBase + ' w-[20%]'}>Away</th>
                  <th className={thBase + ' w-[14%]'}>Venue</th>
                  <th className={thBase + ' w-[13%]'}>Umpire</th>
                </tr>
                {/* Filter controls */}
                <tr className="border-b border-teal-700/30 bg-ink-900/40">
                  <th className="px-3 py-2 align-top">
                    <select value={filters.round} onChange={(e) => setFilters((f) => ({ ...f, round: e.target.value }))} className={selCls}>
                      <option value="">All</option>
                      {options.round.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-2 align-top">
                    <input value={filters.team} onChange={(e) => setFilters((f) => ({ ...f, team: e.target.value }))}
                      placeholder="Any team…" className={selCls} />
                  </th>
                  {hasDivision && (
                    <th className="px-3 py-2 align-top">
                      <select value={filters.division} onChange={(e) => setFilters((f) => ({ ...f, division: e.target.value }))} className={selCls}>
                        <option value="">All</option>
                        {options.division.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </th>
                  )}
                  <th className="px-3 py-2 align-top">
                    <input value={filters.home} onChange={(e) => setFilters((f) => ({ ...f, home: e.target.value }))}
                      placeholder="Filter home…" className={selCls} />
                  </th>
                  <th className="px-3 py-2 align-top">
                    <input value={filters.away} onChange={(e) => setFilters((f) => ({ ...f, away: e.target.value }))}
                      placeholder="Filter away…" className={selCls} />
                  </th>
                  <th className="px-3 py-2 align-top">
                    <select value={filters.venue} onChange={(e) => setFilters((f) => ({ ...f, venue: e.target.value }))} className={selCls}>
                      <option value="">All</option>
                      {options.venue.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-2 align-top">
                    <select value={filters.umpire} onChange={(e) => setFilters((f) => ({ ...f, umpire: e.target.value }))} className={selCls}>
                      <option value="">All</option>
                      {options.umpire.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-teal-700/20">
                {filtered.length === 0 ? (
                  <tr><td colSpan={hasDivision ? 7 : 6} className="px-4 py-8 text-center va-support text-teal-500">
                    No matches for the current filters.
                  </td></tr>
                ) : filtered.map((r) => {
                  const key = `${r.ri}-${r.mi}`
                  const isEditing = editing?.key === key
                  const isSaving = savingKey === key
                  return (
                    <tr key={key} className="hover:bg-teal-900/20 transition">
                      <td className="va-micro px-3 py-2.5 text-teal-200 font-medium">{r.round}</td>
                      <td className="va-micro px-3 py-2.5 text-teal-400">{formatDate(r.date, timezone)}</td>
                      {hasDivision && <td className="va-micro px-3 py-2.5 text-teal-300">{r.division || '—'}</td>}
                      <td className="px-3 py-2.5 text-white font-medium">
                        <TeamCell name={r.home} team={teamByName.get(normTeam(r.home))} />
                      </td>
                      <td className="px-3 py-2.5 text-teal-200">
                        <TeamCell name={r.away} team={teamByName.get(normTeam(r.away))} />
                      </td>
                      <td className="va-micro px-3 py-2.5 text-teal-400">{r.venue || '—'}</td>
                      <td className="va-micro px-3 py-2.5 text-teal-400">
                        {isEditing ? (
                          <input
                            autoFocus
                            defaultValue={r.umpire}
                            disabled={isSaving}
                            onBlur={(e) => commitUmpire(r.ri, r.mi, e.target.value.trim())}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur()
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            className="va-micro w-full rounded-md bg-ink-900 border border-teal-500/60 px-2 py-1 text-white"
                          />
                        ) : isAdmin ? (
                          <button
                            onClick={() => setEditing({ key, value: r.umpire })}
                            title="Click to edit umpire"
                            className="group inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 -mx-1.5 text-left hover:bg-teal-900/40 transition"
                          >
                            <span>{isSaving ? 'Saving…' : (r.umpire || '—')}</span>
                            <span className="opacity-0 group-hover:opacity-60 text-teal-400">✎</span>
                          </button>
                        ) : (
                          <span>{r.umpire || '—'}</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AppShell>
  )
}
