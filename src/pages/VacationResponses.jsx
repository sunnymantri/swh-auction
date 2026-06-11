import { useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { listPlayers } from '../lib/api'

export default function VacationResponses() {
  const { auction, loading: auctionLoading } = useActiveAuction()
  const [players, setPlayers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auction) return
    setLoading(true)
    listPlayers(auction.id)
      .then((p) => setPlayers(p))
      .catch(() => setPlayers([]))
      .finally(() => setLoading(false))
  }, [auction])

  const onVacation = useMemo(
    () => players.filter((p) => (p.vacation_dates ?? []).length > 0)
      .sort((a, b) => (b.vacation_dates?.length ?? 0) - (a.vacation_dates?.length ?? 0)),
    [players]
  )

  const matchDay = auction?.match_day || 'Sunday'
  const timezone = auction?.timezone || 'Australia/Sydney'

  if (auctionLoading || loading) {
    return <AppShell title="Vacation Responses"><p className="text-teal-400 animate-pulse">Loading…</p></AppShell>
  }

  if (!auction) {
    return <AppShell title="Vacation Responses"><p className="text-teal-400">No active auction found.</p></AppShell>
  }

  return (
    <AppShell title="Vacation Responses">
      <RoleGate allow={['admin']}>
        <div className="space-y-4">
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-score text-lg text-teal-200">Player Availability</h3>
              <span className="text-xs text-teal-400">{onVacation.length} of {players.length} players reported time away</span>
            </div>
            <p className="text-xs text-teal-500">
              {matchDay}s between {auction.season_start_date || '—'} and {auction.season_end_date || '—'} ({timezone})
            </p>
          </div>

          {onVacation.length === 0 ? (
            <p className="text-teal-500 text-sm">No players have submitted vacation dates yet.</p>
          ) : (
            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
              <div className="space-y-3">
                {onVacation.map((p) => (
                  <div key={p.id} className="border border-teal-700/40 rounded-lg p-3 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-ink-900 border border-teal-700/40 overflow-hidden grid place-items-center shrink-0">
                      {p.photo_url
                        ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                        : <span className="text-[0.55rem] text-teal-500">no img</span>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-white font-medium">
                        {p.name}
                        <span className="text-teal-400 text-xs ml-2">{p.role}{p.category ? ` / ${p.category}` : ''}</span>
                        <span className="text-yellow-400 text-xs ml-2">{p.vacation_dates.length} {matchDay}{p.vacation_dates.length === 1 ? '' : 's'} away</span>
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {(p.vacation_dates ?? []).map((d) => (
                          <span key={d} className="px-2 py-0.5 rounded-full bg-yellow-900/40 border border-yellow-700/40 text-yellow-300 text-xs">
                            {new Date(d + 'T12:00:00').toLocaleDateString('en-AU', { weekday: 'short', month: 'short', day: 'numeric', timeZone: timezone })}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </RoleGate>
    </AppShell>
  )
}
