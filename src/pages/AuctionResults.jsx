import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { listNonRegularBowlers, listSoldPlayers, listTeamSummaries, listPlayers, reauctionPlayer } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { fmtPoints } from '../lib/format'

const TABS = ['Overview', 'Squads']

export default function AuctionResults() {
  const { auction, loading: auctionLoading, error: auctionError, reload: reloadAuction } = useActiveAuction()
  const { role } = useAuth()
  const location = useLocation()
  const [sold, setSold] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [nominations, setNominations] = useState([])
  const [tab, setTab] = useState('Overview')
  const [openId, setOpenId] = useState(null)
  const [fetchError, setFetchError] = useState(null)
  const [reauctioningId, setReauctioningId] = useState(null)

  useEffect(() => {
    const st = location.state
    if (st?.tab && TABS.includes(st.tab)) setTab(st.tab)
    if (st?.teamId) setOpenId(st.teamId)
  }, [location.state])

  const reload = useCallback(async () => {
    if (!auction) return
    setFetchError(null)
    try {
      const [s, t, p] = await Promise.all([
        listSoldPlayers(auction.id),
        listTeamSummaries(auction.id),
        listPlayers(auction.id),
      ])
      setSold(s); setTeams(t); setPlayers(p)
    } catch (e) {
      setFetchError(e.message || 'Failed to load results')
      return
    }
    try {
      const n = await listNonRegularBowlers(auction.id)
      setNominations(n)
    } catch {
      setNominations([])
    }
  }, [auction])

  useEffect(() => { reload() }, [reload])
  useAuctionRealtime(auction?.id, reload)

  // Bug 7: pull a sold player back into the auction. Reverses the sale via the
  // reauction_player RPC, which re-queues the player as 'reauction' and (if
  // enabled) refunds the team.
  const handleReauction = async (sale) => {
    if (!sale?.id) return
    if (!window.confirm(
      `Re-auction "${sale.players?.name ?? 'this player'}"?\n\n` +
      'This reverses the sale and returns the player to the auction queue. ' +
      'The team\'s budget is refunded if refunds are enabled for this auction.'
    )) return
    setReauctioningId(sale.id)
    setFetchError(null)
    try {
      await reauctionPlayer(sale.id)
      await reload()
    } catch (e) {
      setFetchError(e.message || 'Re-auction failed.')
    } finally {
      setReauctioningId(null)
    }
  }

  const unsoldList = players.filter(p => p.status === 'unsold')
  const totalSpend = sold.reduce((sum, s) => sum + (s.reauctioned ? 0 : s.sold_price), 0)

  const byTeam = useMemo(() => {
    const map = {}
    for (const s of sold.filter(x => !x.reauctioned)) {
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

  if (auctionLoading) {
    return <AppShell title="Results"><p className="text-teal-400 animate-pulse">Loading auction…</p></AppShell>
  }

  if (auctionError) {
    return (
      <AppShell title="Results">
        <div className="text-center py-12 space-y-3">
          <p className="text-live text-sm">{auctionError}</p>
          <button onClick={reloadAuction} className="px-4 py-2 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white text-sm transition">Retry</button>
        </div>
      </AppShell>
    )
  }

  if (!auction) {
    return <AppShell title="Results"><p className="text-teal-400">No auction found.</p></AppShell>
  }

  if (fetchError) {
    return (
      <AppShell title="Results">
        <div className="text-center py-12 space-y-3">
          <p className="text-live text-sm">{fetchError}</p>
          <button onClick={reload} className="px-4 py-2 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white text-sm transition">Retry</button>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Results">
      <div className="space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-teal-700/40 pb-px">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 va-body font-medium rounded-t-lg transition ${tab === t ? 'bg-ink-800/60 text-gold border border-teal-700/40 border-b-transparent -mb-px' : 'text-teal-300 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Overview' && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SCard label="Players sold" value={sold.filter(s => !s.reauctioned).length} />
              <SCard label="Players unsold" value={unsoldList.length} />
              <SCard label="Total spend" value={fmtPoints(totalSpend)} accent />
              <SCard label="Teams" value={teams.length} />
            </div>

            {/* Team squad tables */}
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {teams.map(t => {
                const squad = byTeam[t.id] || []
                const selected = nominationByTeam[t.id] || []
                return (
                  <div key={t.id} className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 cursor-pointer hover:border-teal-500/60 transition" onClick={() => { setTab('Squads'); setOpenId(t.id) }}>
                    <div className="flex items-center gap-2 mb-3">
                      {t.logo_url && <img src={t.logo_url} alt="" className="h-8 w-8 rounded object-cover" />}
                      <div>
                        <p className="va-card-title text-white leading-none">{t.name}</p>
                        <p className="va-micro text-teal-400">{t.players_count} players · spent {fmtPoints(t.points_spent)}</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {squad.map(s => (
                        <li key={s.id} className="flex items-center justify-between text-sm">
                          <div className="va-body flex items-center gap-2 min-w-0">
                            {s.players?.photo_url
                              ? <img src={s.players.photo_url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                              : <div className="h-6 w-6 rounded bg-teal-800/50 shrink-0" />}
                            <span className="text-teal-100 truncate">{s.players?.name}</span>
                            <span className="va-micro text-teal-500 shrink-0">{s.players?.role}</span>
                            {selected.includes(s.player_id) && (
                              <span className="va-micro px-1.5 py-0.5 rounded bg-gold/20 text-gold shrink-0">
                                Non-regular
                              </span>
                            )}
                          </div>
                          <span className="va-micro text-gold tabular shrink-0 ml-2">{fmtPoints(s.sold_price)}</span>
                        </li>
                      ))}
                      {squad.length === 0 && <li className="va-micro text-teal-500">No players yet.</li>}
                    </ul>
                  </div>
                )
              })}
            </div>

            {/* Unsold players */}
            {unsoldList.length > 0 && (
              <div className="rounded-xl border border-live/30 bg-live/5 p-4">
                <h3 className="va-section-title text-live mb-2">Unsold players ({unsoldList.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {unsoldList.map(p => (
                    <span key={p.id} className="va-micro px-2 py-1 rounded-full bg-ink-900 border border-teal-700/40 text-teal-300">
                      {p.name} · {p.role}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === 'Squads' && (
          <div className="grid lg:grid-cols-2 gap-4">
            {teams.map((t) => {
              const squad = byTeam[t.id] || []
              const selected = nominationByTeam[t.id] || []
              const open = openId === t.id
              return (
                <div key={t.id} className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
                  <button onClick={() => setOpenId(open ? null : t.id)} className="w-full flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-3 min-w-0">
                      {t.logo_url && <img src={t.logo_url} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                      <div className="min-w-0">
                        <h3 className="va-card-title text-white truncate">{t.name}</h3>
                        <p className="va-micro text-teal-400">{t.players_count}/{t.squad_size} players · spent {fmtPoints(t.points_spent)} · left {fmtPoints(t.points_remaining)}</p>
                      </div>
                    </div>
                    <span className="text-teal-400 text-sm">{open ? '▲' : '▼'}</span>
                  </button>
                  {open && (
                    <div className="mt-3 border-t border-teal-700/30 pt-3">
                      {squad.length === 0 && <p className="va-support text-teal-500">No players bought yet.</p>}
                      <ul className="space-y-1.5">
                        {squad.map((s) => (
                          <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                            <span className="va-body text-teal-100 min-w-0">
                              {s.players?.name}
                              {s.players?.role && <span className="text-teal-500"> · {s.players.role}</span>}
                              {selected.includes(s.player_id) && (
                                <span className="va-micro ml-2 px-1.5 py-0.5 rounded bg-gold/20 text-gold">
                                  Non-regular
                                </span>
                              )}
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              {role === 'admin' && (
                                <button
                                  onClick={() => handleReauction(s)}
                                  disabled={reauctioningId === s.id}
                                  title="Reverse this sale and return the player to the auction queue"
                                  className="va-micro px-1.5 py-0.5 rounded border border-teal-700/50 text-teal-300 hover:text-white hover:border-teal-500 transition disabled:opacity-50"
                                >
                                  {reauctioningId === s.id ? '…' : '↻ Re-auction'}
                                </button>
                              )}
                              <span className="text-gold tabular">{fmtPoints(s.sold_price)}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                      {squad.length > 0 && (
                        <div className="va-micro mt-2 flex justify-between text-teal-400 border-t border-teal-700/30 pt-2">
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
        )}
      </div>
    </AppShell>
  )
}

function SCard({ label, value, accent }) {
  return (
    <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
      <p className="va-label mb-1 text-teal-400">{label}</p>
      <p className={`text-2xl font-semibold ${accent ? 'text-gold' : 'text-white'}`}>{value}</p>
    </div>
  )
}
