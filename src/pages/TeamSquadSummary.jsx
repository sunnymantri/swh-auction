import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { listNonRegularBowlers, listSoldPlayers, listTeamSummaries, setNonRegularBowlers } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { fmtPoints } from '../lib/format'

export default function TeamSquadSummary() {
  const { auction, loading: auctionLoading } = useActiveAuction()
  const { role, profile } = useAuth()
  const [teams, setTeams] = useState([])
  const [sold, setSold] = useState([])
  const [nominations, setNominations] = useState([])
  const [openId, setOpenId] = useState(null)
  const [msg, setMsg] = useState('')
  const [savingTeamId, setSavingTeamId] = useState(null)

  const reload = useCallback(async () => {
    if (!auction) return
    const [t, s, n] = await Promise.all([
      listTeamSummaries(auction.id),
      listSoldPlayers(auction.id),
      listNonRegularBowlers(auction.id)
    ])
    setTeams(t)
    setSold(s.filter((x) => !x.reauctioned))
    setNominations(n)
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

  const nominationByTeam = useMemo(() => {
    const map = {}
    for (const n of nominations) {
      (map[n.team_id] ||= []).push(n.player_id)
    }
    return map
  }, [nominations])

  const isBowler = (roleText = '') => roleText.toLowerCase().includes('bowler')

  const toggleNomination = async (teamId, playerId) => {
    const current = nominationByTeam[teamId] || []
    const exists = current.includes(playerId)
    const next = exists
      ? current.filter((id) => id !== playerId)
      : [...current, playerId]

    if (!exists && next.length > 2) {
      setMsg('A team can nominate only two non-regular bowlers.')
      return
    }

    setSavingTeamId(teamId)
    setMsg('')
    try {
      await setNonRegularBowlers(teamId, next)
      await reload()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setSavingTeamId(null)
    }
  }

  if (auctionLoading) {
    return <AppShell title="Team Squad Summary"><p className="text-teal-400 animate-pulse">Loading auction…</p></AppShell>
  }

  if (!auction) {
    return <AppShell title="Team Squad Summary"><p className="text-teal-400">No auction found.</p></AppShell>
  }

  return (
    <AppShell title="Team Squad Summary">
      {msg && <p className="mb-3 rounded-lg border border-live/40 bg-live/10 p-2 text-live text-sm">{msg}</p>}
      <div className="grid lg:grid-cols-2 gap-4">
        {teams.map((t) => {
          const squad = byTeam[t.id] || []
          const selected = nominationByTeam[t.id] || []
          const open = openId === t.id
          const canManage = role === 'admin' || (role === 'team_owner' && t.owner_user_id === profile?.id)
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
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-teal-100 truncate">
                            {s.players?.name}
                            {s.players?.role && <span className="text-teal-500"> · {s.players.role}</span>}
                          </span>
                          {selected.includes(s.player_id) && (
                            <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-gold/20 text-gold shrink-0">
                              NR bowler
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-gold tabular">{fmtPoints(s.sold_price)}</span>
                          {canManage && isBowler(s.players?.role || '') && (
                            <button
                              className={`px-2 py-0.5 text-[0.65rem] rounded border ${
                                selected.includes(s.player_id)
                                  ? 'border-gold/70 text-gold bg-gold/10'
                                  : 'border-teal-700/50 text-teal-300'
                              }`}
                              disabled={savingTeamId === t.id}
                              onClick={() => toggleNomination(t.id, s.player_id)}
                            >
                              {selected.includes(s.player_id) ? 'Tagged' : 'Tag'}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {(role === 'admin' || (role === 'team_owner' && t.owner_user_id === profile?.id)) && (
                    <p className="text-[0.65rem] text-teal-400 mt-2">
                      Nominate exactly two bowlers as non-regular for this team.
                    </p>
                  )}
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
