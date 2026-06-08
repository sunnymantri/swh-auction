import { useCallback, useEffect, useMemo, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { listSoldPlayers, listTeamSummaries, listPlayers } from '../lib/api'
import { fmtPoints } from '../lib/format'

const TABS = ['Overview', 'Squads']

export default function AuctionResults() {
  const { auction, loading: auctionLoading, error: auctionError, reload: reloadAuction } = useActiveAuction()
  const [sold, setSold] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [tab, setTab] = useState('Overview')
  const [openId, setOpenId] = useState(null)

  const reload = useCallback(async () => {
    if (!auction) return
    const [s, t, p] = await Promise.all([
      listSoldPlayers(auction.id),
      listTeamSummaries(auction.id),
      listPlayers(auction.id)
    ])
    setSold(s); setTeams(t); setPlayers(p)
  }, [auction])

  useEffect(() => { reload() }, [reload])
  useAuctionRealtime(auction?.id, reload)

  const unsoldList = players.filter(p => p.status === 'unsold')
  const totalSpend = sold.reduce((sum, s) => sum + (s.reauctioned ? 0 : s.sold_price), 0)

  const byTeam = useMemo(() => {
    const map = {}
    for (const s of sold.filter(x => !x.reauctioned)) {
      (map[s.team_id] ||= []).push(s)
    }
    return map
  }, [sold])

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

  return (
    <AppShell title="Results">
      <div className="space-y-5">
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-teal-700/40 pb-px">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${tab === t ? 'bg-ink-800/60 text-gold border border-teal-700/40 border-b-transparent -mb-px' : 'text-teal-300 hover:text-white'}`}>
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
                return (
                  <div key={t.id} className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      {t.logo_url && <img src={t.logo_url} alt="" className="h-8 w-8 rounded object-cover" />}
                      <div>
                        <p className="font-score text-lg text-white leading-none">{t.name}</p>
                        <p className="text-xs text-teal-400">{t.players_count} players · spent {fmtPoints(t.points_spent)}</p>
                      </div>
                    </div>
                    <ul className="space-y-1.5">
                      {squad.map(s => (
                        <li key={s.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            {s.players?.photo_url
                              ? <img src={s.players.photo_url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                              : <div className="h-6 w-6 rounded bg-teal-800/50 shrink-0" />}
                            <span className="text-teal-100 truncate">{s.players?.name}</span>
                            <span className="text-teal-500 text-xs shrink-0">{s.players?.role}</span>
                          </div>
                          <span className="text-gold tabular text-xs shrink-0 ml-2">{fmtPoints(s.sold_price)}</span>
                        </li>
                      ))}
                      {squad.length === 0 && <li className="text-teal-500 text-xs">No players yet.</li>}
                    </ul>
                  </div>
                )
              })}
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
          </>
        )}

        {tab === 'Squads' && (
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
        )}
      </div>
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
