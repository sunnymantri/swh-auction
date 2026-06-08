import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useAuth } from '../context/AuthContext'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import {
  getCurrentQueueItem, listTeamSummaries,
  getBidsForPlayer, getRecentEvents, getNextPending, getActiveSale,
  placeBid, markSold, markUnsold, reauctionPlayer, startPlayer
} from '../lib/api'
import { fmtPoints } from '../lib/format'
import PlayerCard from '../components/auction/PlayerCard'
import AuctioneerControls from '../components/auction/AuctioneerControls'
import TeamBudgetGrid from '../components/auction/TeamBudgetGrid'
import ActivityFeed from '../components/auction/ActivityFeed'

export default function AuctionCentre() {
  const { isAdmin, role } = useAuth()
  const { auction } = useActiveAuction()
  const [current, setCurrent] = useState(null)   // queue row + players(*)
  const [nextUp, setNextUp] = useState(null)
  const [teams, setTeams] = useState([])
  const [bids, setBids] = useState([])
  const [events, setEvents] = useState([])
  const [activeSale, setActiveSale] = useState(null)
  const [busy, setBusy] = useState(false)
  const [warning, setWarning] = useState(null)

  const player = current?.players ?? null
  const isLive = auction?.status === 'live'

  const reload = useCallback(async () => {
    if (!auction) return
    const [cur, tms, evs, nxt] = await Promise.all([
      getCurrentQueueItem(auction.id), listTeamSummaries(auction.id),
      getRecentEvents(auction.id), getNextPending(auction.id)
    ])
    setCurrent(cur); setTeams(tms); setEvents(evs); setNextUp(nxt)
    if (cur?.players) {
      const [b, sale] = await Promise.all([
        getBidsForPlayer(cur.players.id),
        cur.players.status === 'sold' ? getActiveSale(cur.players.id) : Promise.resolve(null)
      ])
      setBids(b); setActiveSale(sale)
    } else { setBids([]); setActiveSale(null) }
  }, [auction])

  useEffect(() => { reload() }, [reload])
  useAuctionRealtime(auction?.id, reload)

  const top = bids.reduce((m, b) => (b.bid_amount > (m?.bid_amount ?? -1) ? b : m), null)
  const highestBid = top?.bid_amount ?? 0
  const leaderTeamId = top?.team_id ?? null
  const leaderName = teams.find(t => t.id === leaderTeamId)?.name

  const act = async (fn) => {
    setBusy(true); setWarning(null)
    try { await fn(); await reload() }
    catch (e) { setWarning(e.message) }
    finally { setBusy(false) }
  }

  const handlers = {
    onBid: (teamId, amount, type, override) =>
      act(() => placeBid(player.id, teamId, amount, type, override)),
    onSold: (teamId, price) => {
      if (!teamId) { setWarning('No bids yet — cannot mark sold.'); return }
      return act(() => markSold(player.id, teamId, price))
    },
    onUnsold: () => act(() => markUnsold(player.id)),
    onReauction: (saleId) => saleId && act(() => reauctionPlayer(saleId)),
    onStart: () => act(async () => {
      const next = await getNextPending(auction.id)
      if (next) await startPlayer(next.players.id)
      else setWarning('Queue is empty — add players and generate the queue.')
    }),
    onNext: () => act(async () => {
      const next = await getNextPending(auction.id)
      if (next) await startPlayer(next.players.id)
      else setWarning('No more players in the queue.')
    })
  }

  if (!auction) {
    return (
      <AppShell title="Auction Centre">
        <p className="text-teal-400">No auction selected. Create or select one on the Auctions screen.</p>
      </AppShell>
    )
  }

  return (
    <AppShell title="Auction Centre">
      <RoleGate allow={['admin']}>
        {!isLive && (
          <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 text-gold p-3 text-sm">
            This auction is <b>{auction.status}</b>. Set it to <b>live</b> on the <a href="/auctions" className="underline">Auctions</a> page to accept bids.
          </div>
        )}
        <div className="grid lg:grid-cols-[1fr_22rem] gap-5">
          <div className="space-y-5">
            <PlayerCard player={player} />

            {/* Up next + start/next control (always visible to admin) */}
            <div className="rounded-2xl bg-ink-800/70 border border-teal-700/40 p-4 flex items-center justify-between gap-3">
              <div className="text-sm">
                <span className="text-teal-400">Up next: </span>
                <span className="text-white font-semibold">{nextUp?.players?.name || 'Queue empty'}</span>
              </div>
              <div className="flex gap-2">
                <button
                  className="px-3 py-2 rounded-lg bg-gold text-ink-900 font-semibold text-sm disabled:opacity-40"
                  disabled={busy || !nextUp}
                  onClick={player ? handlers.onNext : handlers.onStart}
                >
                  {player ? 'Next player →' : '▶ Start auction'}
                </button>
              </div>
            </div>

            {/* Scoreboard */}
            <div key={highestBid} className="rounded-2xl bg-gradient-to-br from-teal-900 to-ink-900 border border-gold/30 p-6 flex items-end justify-between animate-bidflash">
              <div>
                <div className="text-teal-400 text-xs uppercase tracking-widest">Current bid</div>
                <div className="font-score text-6xl text-gold tabular leading-none">{fmtPoints(highestBid)}</div>
              </div>
              <div className="text-right">
                <div className="text-teal-400 text-xs uppercase tracking-widest">Highest bidder</div>
                <div className="font-score text-3xl text-white">{leaderName || '—'}</div>
              </div>
            </div>

            {player && (
              <AuctioneerControls
                player={player} teams={teams} highestBid={highestBid}
                leaderTeamId={leaderTeamId} basePrice={player?.base_price ?? 0}
                increment={auction.default_bid_increment} hasBids={bids.length > 0}
                activeSale={activeSale} busy={busy || !isLive} warning={warning} {...handlers} />
            )}

            <div className="rounded-2xl bg-ink-800/70 border border-teal-700/40 p-4">
              <h3 className="font-score text-lg text-teal-200 mb-2">Bid history</h3>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {bids.map(b => (
                  <li key={b.id} className="flex justify-between text-sm">
                    <span className="text-teal-200">{b.teams?.name || 'Auctioneer'}</span>
                    <span className="text-gold tabular">{fmtPoints(b.bid_amount)}</span>
                  </li>
                ))}
                {bids.length === 0 && <li className="text-teal-500 text-sm">No bids on this player yet.</li>}
              </ul>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="font-score text-lg text-teal-200 mb-2">Team budgets</h3>
              <TeamBudgetGrid teams={teams} leaderTeamId={leaderTeamId} />
            </div>
            <ActivityFeed events={events} />
          </div>
        </div>
      </RoleGate>
    </AppShell>
  )
}
