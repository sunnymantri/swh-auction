import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { listSoldPlayers, listTeamSummaries, listPlayers } from '../lib/api'
import { fmtPoints } from '../lib/format'

export default function AuctionResults() {
  const { auction, loading: auctionLoading, error: auctionError, reload } = useActiveAuction()
  const [sold, setSold]     = useState([])
  const [teams, setTeams]   = useState([])
  const [players, setPlayers] = useState([])

  useEffect(() => {
    if (!auction) return
    Promise.all([
      listSoldPlayers(auction.id),
      listTeamSummaries(auction.id),
      listPlayers(auction.id)
    ]).then(([s, t, p]) => { setSold(s); setTeams(t); setPlayers(p) })
  }, [auction])

  const unsoldList = players.filter(p => p.status === 'unsold')
  const totalSpend = sold.reduce((sum, s) => sum + (s.reauctioned ? 0 : s.sold_price), 0)

  const byTeam = teams.map(t => ({
    ...t,
    squad: sold.filter(s => s.team_id === t.id && !s.reauctioned)
  }))

  if (auctionLoading) {
    return (
      <AppShell title="Auction Results">
        <p className="text-teal-400 animate-pulse">Loading auction…</p>
      </AppShell>
    )
  }

  if (auctionError) {
    return (
      <AppShell title="Auction Results">
        <div className="text-center py-12 space-y-3">
          <p className="text-live text-sm">{auctionError}</p>
          <button
            onClick={reload}
            className="px-4 py-2 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white text-sm transition"
          >
            Retry
          </button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Auction Results">
      {!auction && <p className="text-teal-400">No auction found.</p>}
      {auction && (
        <div className="space-y-5">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SCard label="Players sold"   value={sold.filter(s => !s.reauctioned).length} />
            <SCard label="Players unsold" value={unsoldList.length} />
            <SCard label="Total spend"    value={fmtPoints(totalSpend)} accent />
            <SCard label="Teams"          value={teams.length} />
          </div>

          {/* Team squad tables */}
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {byTeam.map(t => (
              <div key={t.id} className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
                <div className="flex items-center gap-2 mb-3">
                  {t.logo_url && <img src={t.logo_url} alt="" className="h-8 w-8 rounded object-cover" />}
                  <div>
                    <p className="font-score text-lg text-white leading-none">{t.name}</p>
                    <p className="text-xs text-teal-400">
                      {t.players_count} players · spent {fmtPoints(t.points_spent)}
                    </p>
                  </div>
                </div>
                <ul className="space-y-1.5">
                  {t.squad.map(s => (
                    <li key={s.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {s.players?.photo_url
                          ? <img src={s.players.photo_url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                          : <div className="h-6 w-6 rounded bg-teal-800/50 shrink-0" />
                        }
                        <span className="text-teal-100 truncate">{s.players?.name}</span>
                        <span className="text-teal-500 text-xs shrink-0">{s.players?.role}</span>
                      </div>
                      <span className="text-gold tabular text-xs shrink-0 ml-2">{fmtPoints(s.sold_price)}</span>
                    </li>
                  ))}
                  {t.squad.length === 0 && <li className="text-teal-500 text-xs">No players yet.</li>}
                </ul>
              </div>
            ))}
          </div>

          {/* Unsold players */}
          {unsoldList.length > 0 && (
            <div className="rounded-xl border border-live/30 bg-live/5 p-4">
              <h3 className="font-score text-lg text-live mb-2">Unsold players ({unsoldList.length})</h3>
              <div className="flex flex-wrap gap-2">
                {unsoldList.map(p => (
                  <span key={p.id} className="px-2 py-1 text-xs rounded-full bg-ink-900 border border-teal-700/40 text-teal-300">
                    {p.name} · {p.role}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AppShell>
  )
}

function SCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
      <p className="text-xs text-teal-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-score text-2xl ${accent ? 'text-gold' : 'text-white'}`}>{value}</p>
    </div>
  )
}
