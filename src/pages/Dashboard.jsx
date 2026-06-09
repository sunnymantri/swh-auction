import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { listTeamSummaries, listPlayers, getRecentEvents } from '../lib/api'
import { fmtPoints } from '../lib/format'
import ActivityFeed from '../components/auction/ActivityFeed'

export default function Dashboard() {
  const { auction, loading } = useActiveAuction()
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [events, setEvents] = useState([])

  useEffect(() => {
    if (!auction) return
    Promise.all([
      listTeamSummaries(auction.id),
      listPlayers(auction.id),
      getRecentEvents(auction.id, 10)
    ]).then(([t, p, e]) => { setTeams(t); setPlayers(p); setEvents(e) })
  }, [auction])

  const sold    = players.filter(p => p.status === 'sold').length
  const unsold  = players.filter(p => p.status === 'unsold').length
  const pending = players.filter(p => p.status === 'ready_for_auction').length
  const total   = players.length

  return (
    <AppShell title="Dashboard">
      {loading && <p className="text-teal-400 animate-pulse">Loading…</p>}
      {!auction && !loading && (
        <div className="rounded-xl border border-gold/30 bg-gold/5 p-6 text-center">
          <p className="text-teal-200 mb-3">No auction selected.</p>
          <Link to="/auctions" className="px-4 py-2 rounded-lg bg-gold text-ink-900 font-semibold text-sm">
            Create or select an auction →
          </Link>
        </div>
      )}
      {auction && (
        <div className="space-y-5">
          {/* Auction status banner */}
          <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-score text-2xl text-white">{auction.name}</p>
              <p className="text-sm text-teal-400">{auction.season} · {auction.sport}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                auction.status === 'live'
                  ? 'bg-gold/20 text-gold'
                  : 'bg-teal-700/40 text-teal-200'
              }`}>{auction.status?.toUpperCase()}</span>
              {auction.status !== 'live' && (
                <Link to="/auctions" className="text-xs text-teal-300 hover:text-white">
                  Change status →
                </Link>
              )}
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total players" value={String(total)} />
            <StatCard label="Sold" value={String(sold)} accent="gold" />
            <StatCard label="Unsold" value={String(unsold)} accent="live" />
            <StatCard label="Awaiting auction" value={String(pending)} />
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            {/* Team budget table */}
            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
              <h3 className="font-score text-lg text-teal-200 mb-3">Team budgets</h3>
              <div className="space-y-2 overflow-x-auto">
                {teams.map(t => {
                  const pct = Math.max(0, Math.min(100, (t.points_remaining / t.total_budget) * 100))
                  return (
                    <div key={t.id} className="flex items-center gap-3 min-w-[30rem]">
                      <span className="text-sm text-white w-40 truncate">{t.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-ink-900 overflow-hidden">
                        <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs tabular text-gold min-w-[4rem] text-right">
                        {fmtPoints(t.points_remaining)}
                      </span>
                      <span className="text-xs text-teal-400 min-w-[3rem] text-right">
                        {t.players_count}/{t.squad_size}
                      </span>
                    </div>
                  )
                })}
                {teams.length === 0 && <p className="text-teal-500 text-sm">No teams yet.</p>}
              </div>
            </div>

            {/* Activity feed */}
            <ActivityFeed events={events} />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ['/players', '+ Add players'],
              ['/queue', '📋 Manage queue'],
              ['/auction', '🎙 Auction Centre'],
              ['/results', '📊 Results'],
            ].map(([to, label]) => (
              <Link key={to} to={to}
                className="px-3 py-2.5 rounded-lg bg-ink-800/60 border border-teal-700/40 hover:border-teal-500 text-sm text-teal-200 hover:text-white text-center transition">
                {label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  )
}

function StatCard({ label, value, accent }) {
  const color = accent === 'gold' ? 'text-gold' : accent === 'live' ? 'text-live' : 'text-white'
  return (
    <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4">
      <p className="text-xs text-teal-400 uppercase tracking-wide mb-1">{label}</p>
      <p className={`font-score text-3xl ${color}`}>{value}</p>
    </div>
  )
}
