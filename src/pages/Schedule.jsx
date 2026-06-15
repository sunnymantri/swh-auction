import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'

function formatDate(dateStr, timezone = 'Australia/Sydney') {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: timezone })
}

export default function Schedule() {
  const { auction, loading } = useActiveAuction()

  if (loading) {
    return <AppShell title="Schedule"><p className="text-teal-400 animate-pulse">Loading…</p></AppShell>
  }

  if (!auction) {
    return <AppShell title="Schedule"><p className="text-teal-400">No active season found.</p></AppShell>
  }

  const schedule = Array.isArray(auction.season_schedule) ? auction.season_schedule : []
  const timezone = auction.timezone || 'Australia/Sydney'

  if (schedule.length === 0) {
    return (
      <AppShell title="Schedule">
        <div className="max-w-2xl mx-auto rounded-xl border border-yellow-600/40 bg-yellow-900/20 p-6 text-center">
          <p className="text-yellow-400 font-medium text-lg">Season schedule not yet generated.</p>
          <p className="text-sm text-teal-300 mt-2">
            The admin can generate it in Auctions → Configuration → Schedule.
          </p>
        </div>
      </AppShell>
    )
  }

  const totalMatches = schedule.reduce((n, r) => n + r.matches.length, 0)

  return (
    <AppShell title="Schedule">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-5">
          <h2 className="font-score text-2xl text-white">{auction.name} — Season Schedule</h2>
          <p className="text-sm text-teal-400 mt-1">
            {auction.season} · {schedule.length} rounds · {totalMatches} matches · Games on {auction.match_day || 'Sunday'}s
          </p>
        </div>

        {/* Rounds */}
        <div className="space-y-4">
          {schedule.map((round) => (
            <div key={round.round} className="rounded-xl border border-teal-700/40 bg-ink-800/60 overflow-hidden">
              {/* Round header */}
              <div className="px-4 py-3 bg-teal-900/40 border-b border-teal-700/30 flex items-center justify-between">
                <span className="font-score text-teal-200 text-sm font-bold uppercase tracking-wider">
                  {round.label || `Round ${round.round}`}
                </span>
                {round.date && (
                  <span className="text-xs text-teal-400">
                    {formatDate(round.date, timezone)}
                  </span>
                )}
              </div>

              {/* Matches table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-teal-700/20">
                      <th className="text-left px-4 py-2 text-xs text-teal-500 font-medium w-[38%]">Home</th>
                      <th className="text-center px-2 py-2 text-xs text-teal-500 font-medium w-[8%]">vs</th>
                      <th className="text-left px-4 py-2 text-xs text-teal-500 font-medium w-[38%]">Away</th>
                      <th className="text-left px-4 py-2 text-xs text-teal-500 font-medium w-[16%]">Venue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-teal-700/20">
                    {round.matches.map((match, i) => (
                      <tr key={i} className="hover:bg-teal-900/20 transition">
                        <td className="px-4 py-2.5 text-white font-medium">{match.home}</td>
                        <td className="px-2 py-2.5 text-center text-teal-500 text-xs">vs</td>
                        <td className="px-4 py-2.5 text-teal-200">{match.away}</td>
                        <td className="px-4 py-2.5 text-teal-400 text-xs">{match.venue || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
