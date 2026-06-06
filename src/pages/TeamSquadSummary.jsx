import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { listSoldPlayers, listTeamSummaries } from '../lib/api'
import { fmtPoints } from '../lib/format'

export default function TeamSquadSummary() {
  const { auction, loading: auctionLoading } = useActiveAuction()
  const [teams, setTeams] = useState([])
  const [sold, setSold] = useState([])
  const [openId, setOpenId] = useState(null)

  const reload = useCallback(async () => {
    if (!auction) return
    const [t, s] = await Promise.all([listTeamSummaries(auction.id), listSoldPlayers(auction.id)])
    setTeams(t)
    setSold(s.filter((x) => !x.reauctioned))
  }, [auction])

  useEffect(() => { reload() }, [reload])
  useAuctionRealtime(auction?.id, reload)

  const byTeam = useMemo(() => {
    const map = {}
    for (const s of sold) {
      (map[s.team_id] ||= []).push(s)
    }
    return map
  }, [sold])

  if (auctionLoading) {
    return <AppShell title="Team Squad Summary"><p className="text-teal-400 animate-pulse">Loading auction…</p></AppShell>
  }

  if (!auction) {
    return <AppShell title="Team Squad Summary"><p className="text-teal-400">No auction found.</p></AppShell>
  }

  return (
    <AppShell title="Team Squad Summary">
      <div className="grid lg:grid-cols-2 gap-4">
        {teams.map((t) => {
          const squad = byTeam[t.id] || []
          const open = openId === t.id
          return (
            <div key={t.id} className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
              <button onClick={() => setOpenId(open ? null : t.id)} className="w-full flex items-center justify-between gap-3 text-left">
                <div className="flex items-center gap-3 min-w-0">
                  {t.logo_url && <img src={t.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                  <div className="min-w-0">
                    <h3 className="font-score text-lg text-white truncate">{t.name}</h3>
                    <p className="text-xs text-teal-400">{t.players_count}/{t.squad_size} players · spent {fmtPoints(t.points_spent)} · left {fmtPoints(t.points_remaining)}</p>
                  </div>
                </div>
                <span className="text-teal-400 text-sm">{open ? '▲' : '▼'}</span>
              </button>
              {open && (
                <div className="mt-3 border-t border-teal-700/30 pt-3">
                  {squad.length === 0 && <p className="text-teal-500 text-sm">No players bought yet.</p>}
                  <ul className="space-y-1.5">
                    {squad.map((s) => (
                      <li key={s.id} className="flex items-center justify-between text-sm">
                        <span className="text-teal-100">
                          {s.players?.name}
                          {s.players?.role && <span className="text-teal-500"> · {s.players.role}</span>}
                        </span>
                        <span className="text-gold tabular">{fmtPoints(s.sold_price)}</span>
                      </li>
                    ))}
                  </ul>
                  {squad.length > 0 && (
                    <div className="mt-2 flex justify-between text-xs text-teal-400 border-t border-teal-700/30 pt-2">
                      <span>Max safe bid now</span>
                      <span className="text-gold tabular">{fmtPoints(t.max_safe_bid)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </AppShell>
  )
}
