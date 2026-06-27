import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { exportSquadsCsv, listNonRegularBowlers, listSoldPlayers, listTeamSummaries, reauctionPlayer, setNonRegularBowlers } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { fmtPoints } from '../lib/format'
import SpendGauge, { getZoneColor } from '../components/common/SpendGauge'

function downloadCsv(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.setAttribute('download', filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(link.href)
}

const roleBadgeClass = (role = '') => {
  const r = role.toLowerCase()
  if (r.includes('all') || r === 'ar') return 'bg-gold/20 text-gold border-gold/40'
  if (r.includes('bowl')) return 'bg-emerald-900/40 text-emerald-300 border-emerald-700/40'
  if (r.includes('wk') || r.includes('keep')) return 'bg-violet-900/40 text-violet-300 border-violet-700/40'
  return 'bg-sky-900/40 text-sky-300 border-sky-700/40'
}

export default function TeamSquadSummary() {
  const { auction, loading: auctionLoading } = useActiveAuction()
  const { role, profile } = useAuth()
  const location = useLocation()
  const [teams, setTeams] = useState([])
  const [sold, setSold] = useState([])
  const [nominations, setNominations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [msg, setMsg] = useState('')
  const [savingTeamId, setSavingTeamId] = useState(null)
  const [reauctioningSaleId, setReauctioningSaleId] = useState(null)

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

  useEffect(() => {
    if (location.state?.teamId) setSelectedId(location.state.teamId)
  }, [location.state?.teamId])

  const byTeam = useMemo(() => {
    const map = {}
    for (const s of sold) {
      (map[s.team_id] ||= []).push(s)
    }
    return map
  }, [sold])

  const spendMultiplierByTeam = useMemo(() => {
    const result = {}
    for (const [teamId, players] of Object.entries(byTeam)) {
      const totalBase = players.reduce((sum, s) => sum + (s.players?.base_price ?? 0), 0)
      const totalSold = players.reduce((sum, s) => sum + (s.sold_price ?? 0), 0)
      result[teamId] = totalBase > 0 ? totalSold / totalBase : null
    }
    return result
  }, [byTeam])

  const nominationByTeam = useMemo(() => {
    const map = {}
    for (const n of nominations) {
      (map[n.team_id] ||= []).push(n.player_id)
    }
    return map
  }, [nominations])

  const toggleNomination = async (teamId, playerId) => {
    const current = nominationByTeam[teamId] || []
    // Only players still in the team's active squad can be tagged. A previously
    // tagged player who was later re-auctioned away would otherwise be re-sent
    // and rejected by the server, so drop any such stale ids first.
    const squadIds = new Set((byTeam[teamId] || []).map((s) => s.player_id))
    const exists = current.includes(playerId)
    const next = (exists
      ? current.filter((id) => id !== playerId)
      : [...current, playerId]
    ).filter((id) => squadIds.has(id))
    if (!exists && next.length > 2) {
      setMsg('A team can tag at most two non-regular players.')
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

  const releasePlayer = async (sale) => {
    if (role !== 'admin') return
    const ok = window.confirm(
      `Release "${sale.players?.name ?? 'this player'}" for re-auction?\n\n` +
      'The player will move back to the queue as Re-auction.'
    )
    if (!ok) return
    setMsg('')
    setReauctioningSaleId(sale.id)
    try {
      await reauctionPlayer(sale.id)
      setMsg(
        auction?.reauction_refund_enabled
          ? 'Player released to re-auction. Team points refunded.'
          : 'Player released to re-auction. Refund is disabled for this auction.'
      )
      await reload()
    } catch (e) {
      setMsg(e.message || 'Failed to release player to re-auction.')
    } finally {
      setReauctioningSaleId(null)
    }
  }

  if (auctionLoading) {
    return <AppShell title="Team Squad Summary"><p className="text-teal-400 animate-pulse">Loading auction…</p></AppShell>
  }
  if (!auction) {
    return <AppShell title="Team Squad Summary"><p className="text-teal-400">No auction found.</p></AppShell>
  }

  const selectedTeam = teams.find(t => t.id === selectedId) ?? null
  const squad = selectedId ? (byTeam[selectedId] || []) : []
  const nominated = selectedId ? (nominationByTeam[selectedId] || []) : []
  const canManage = role === 'admin' || (role === 'team_owner' && selectedTeam?.owner_user_id === profile?.id)

  return (
    <AppShell title="Team Squad Summary">
      {msg && <p className="mb-3 rounded-lg border border-live/40 bg-live/10 p-2 text-live text-sm">{msg}</p>}
      <div className="grid lg:grid-cols-[18rem_1fr] gap-4">

        {/* Left: team list */}
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-teal-700/30 flex items-center justify-between gap-2">
            <h3 className="font-score text-base text-teal-200">Teams</h3>
            {role === 'admin' && teams.length > 0 && (
              <button
                onClick={() => downloadCsv(
                  `squads-${auction.name || 'auction'}.csv`,
                  exportSquadsCsv(teams, sold)
                )}
                className="text-[0.65rem] px-2 py-1 rounded border border-teal-700/50 text-teal-300 hover:text-white hover:border-teal-500 transition"
                title="Download all team squads as CSV (no points)"
              >
                ↓ Squads CSV
              </button>
            )}
          </div>
          <ul className="divide-y divide-teal-700/20">
            {teams.map((t) => (
              <li key={t.id}>
                <button
                  onClick={() => setSelectedId(t.id === selectedId ? null : t.id)}
                  className={`w-full flex items-center gap-3 px-3 py-3 text-left transition border-l-2 ${
                    selectedId === t.id
                      ? 'bg-teal-800/30 border-gold'
                      : 'hover:bg-ink-800/80 border-transparent'
                  }`}
                >
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="h-9 w-9 rounded-lg bg-teal-900/40 border border-teal-700/40 grid place-items-center shrink-0">
                      <span className="text-teal-500 text-xs font-bold">{(t.name || '?').charAt(0)}</span>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-score text-sm text-white truncate">{t.name}</p>
                    <p className="text-[0.65rem] text-teal-400 mt-0.5">
                      {t.players_count}/{t.squad_size} players · {fmtPoints(t.points_spent)} spent
                    </p>
                  </div>
                  <span className={`text-base transition ${selectedId === t.id ? 'text-gold' : 'text-teal-600'}`}>›</span>
                </button>
              </li>
            ))}
            {teams.length === 0 && (
              <li className="px-4 py-3 text-teal-500 text-sm">No teams found.</li>
            )}
          </ul>
        </div>

        {/* Right: squad view */}
        <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 min-h-[24rem]">
          {selectedTeam ? (
            <>
              {/* Team header */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-teal-700/30">
                {selectedTeam.logo_url && (
                  <img src={selectedTeam.logo_url} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="font-score text-xl text-white truncate">{selectedTeam.name}</h3>
                  <p className="text-xs text-teal-400 mt-0.5">
                    {selectedTeam.players_count}/{selectedTeam.squad_size} players
                    · spent {fmtPoints(selectedTeam.points_spent)}
                    · left {fmtPoints(selectedTeam.points_remaining)}
                  </p>
                </div>
                <div className="shrink-0">
                  <SpendGauge
                    multiplier={spendMultiplierByTeam[selectedTeam.id] ?? null}
                    benchmark={auction?.budget_multiplier ?? 1.6}
                    playerCount={squad.length}
                    compact
                  />
                </div>
              </div>

              {/* Player list */}
              <div className="p-4">
                {squad.length === 0 && (
                  <p className="text-teal-500 text-sm">No players bought yet.</p>
                )}
                <div className="space-y-1">
                  {squad.map((s, idx) => (
                    <div key={s.id} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-ink-900/40 transition">
                      <span className="text-xs text-teal-600 w-5 text-right shrink-0 tabular">{idx + 1}</span>
                      {s.players?.photo_url ? (
                        <img src={s.players.photo_url} alt="" className="h-9 w-9 rounded-full object-cover border border-teal-700/40 shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-teal-900/40 border border-teal-700/40 grid place-items-center shrink-0">
                          <span className="text-teal-400 text-xs font-bold">{(s.players?.name || '?').charAt(0)}</span>
                        </div>
                      )}
                      <span className="text-sm text-teal-100 flex-1 min-w-0 truncate">{s.players?.name}</span>
                      {s.players?.role && (
                        <span className={`text-[0.65rem] px-2 py-0.5 rounded-full border font-medium shrink-0 ${roleBadgeClass(s.players.role)}`}>
                          {s.players.role}
                        </span>
                      )}
                      {nominated.includes(s.player_id) && (
                        <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-gold/20 text-gold shrink-0">Non-regular</span>
                      )}
                      {canManage && (
                        <button
                          className={`px-2 py-0.5 text-[0.65rem] rounded border shrink-0 ${
                            nominated.includes(s.player_id)
                              ? 'border-gold/70 text-gold bg-gold/10'
                              : 'border-teal-700/50 text-teal-400'
                          }`}
                          disabled={savingTeamId === selectedTeam.id}
                          onClick={() => toggleNomination(selectedTeam.id, s.player_id)}
                        >
                          {nominated.includes(s.player_id) ? 'Tagged' : 'Tag'}
                        </button>
                      )}
                      {role === 'admin' && (
                        <button
                          className="px-2 py-0.5 text-[0.65rem] rounded border border-teal-700/50 text-teal-300 hover:text-white hover:border-teal-500 disabled:opacity-50 shrink-0"
                          disabled={reauctioningSaleId === s.id}
                          onClick={() => releasePlayer(s)}
                          title="Release this sold player to re-auction"
                        >
                          {reauctioningSaleId === s.id ? '…' : 'Release'}
                        </button>
                      )}
                      {(s.players?.base_price ?? 0) > 0 && (
                        <span
                          className="text-[0.6rem] tabular shrink-0 font-medium"
                          style={{ color: getZoneColor(s.sold_price / s.players.base_price) }}
                        >
                          {(s.sold_price / s.players.base_price).toFixed(1)}×
                        </span>
                      )}
                      <span className="text-sm text-gold font-semibold tabular shrink-0">{fmtPoints(s.sold_price)}</span>
                    </div>
                  ))}
                </div>

                {canManage && squad.length > 0 && (
                  <p className="text-[0.65rem] text-teal-500 mt-3">Tag up to two players as non-regular for this team.</p>
                )}
                {squad.length > 0 && (
                  <div className="mt-4 flex justify-between text-sm text-teal-400 border-t border-teal-700/30 pt-3">
                    <span>Max safe bid now</span>
                    <span className="text-gold tabular font-semibold">{fmtPoints(selectedTeam.max_safe_bid)}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[24rem] text-center px-8">
              <svg className="w-12 h-12 text-teal-700/50 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-teal-500 text-sm">Select a team from the left to view their squad</p>
            </div>
          )}
        </div>

      </div>
    </AppShell>
  )
}
