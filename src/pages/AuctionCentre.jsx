import { useCallback, useEffect, useRef, useState } from 'react'
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
import AuctionTimer from '../components/auction/AuctionTimer'
import TeamBudgetGrid from '../components/auction/TeamBudgetGrid'
import ActivityFeed from '../components/auction/ActivityFeed'
import SoldCelebration from '../components/auction/SoldCelebration'

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
  const [celebration, setCelebration] = useState(null) // { player, soldPrice, teamName, teamLogo }
  const [lastBidAt, setLastBidAt] = useState(null)
  const [timerPaused, setTimerPaused] = useState(false)
  const prevBidCountRef = useRef(0)

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

  // Reset timer when bids change or player changes
  useEffect(() => {
    if (player && bids.length !== prevBidCountRef.current) {
      setLastBidAt(Date.now())
      setTimerPaused(false)
    }
    prevBidCountRef.current = bids.length
  }, [bids.length, player])

  // Start timer when a new player comes on the block
  useEffect(() => {
    if (player) {
      setLastBidAt(Date.now())
      setTimerPaused(false)
    } else {
      setLastBidAt(null)
    }
  }, [player?.id])

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
      const winningTeam = teams.find(t => t.id === teamId)
      return act(async () => {
        await markSold(player.id, teamId, price)
        setCelebration({
          player,
          soldPrice: price,
          teamName: winningTeam?.name ?? 'Unknown',
          teamLogo: winningTeam?.logo_url ?? null,
        })
      })
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
    }),
    onTimerExpired: () => {
      if (!player || busy || !isLive) return
      setTimerPaused(true)
      if (bids.length > 0 && leaderTeamId) {
        const winningTeam = teams.find(t => t.id === leaderTeamId)
        act(async () => {
          await markSold(player.id, leaderTeamId, highestBid)
          setCelebration({
            player,
            soldPrice: highestBid,
            teamName: winningTeam?.name ?? 'Unknown',
            teamLogo: winningTeam?.logo_url ?? null,
          })
        })
      } else {
        act(() => markUnsold(player.id))
      }
    }
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
      {celebration && (
        <SoldCelebration
          player={celebration.player}
          soldPrice={celebration.soldPrice}
          teamName={celebration.teamName}
          teamLogo={celebration.teamLogo}
          onDone={() => setCelebration(null)}
        />
      )}
      <RoleGate allow={['admin']}>
        {!isLive && (
          <div className="mb-4 rounded-xl border border-gold/40 bg-gold/10 text-gold p-3 text-sm">
            This auction is <b>{auction.status}</b>. Set it to <b>live</b> on the <a href="/auctions" className="underline">Auctions</a> page to accept bids.
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:gap-5">
          <div className="space-y-5">
            <PlayerCard player={player} />

            {/* Up next + start/next control (always visible to admin) */}
            <div className="rounded-2xl bg-ink-800/70 border border-teal-700/40 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-sm min-w-0">
                <span className="text-teal-400">Up next: </span>
                <span className="text-white font-semibold break-words">{nextUp?.players?.name || 'Queue empty'}</span>
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

            {/* Scoreboard + Timer */}
            <div key={highestBid} className="rounded-2xl bg-gradient-to-br from-teal-900 to-ink-900 border border-gold/30 p-4 sm:p-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 animate-bidflash">
              <div className="min-w-0">
                <div className="text-teal-400 text-xs uppercase tracking-widest">Current bid</div>
                <div className="font-score text-4xl sm:text-5xl lg:text-6xl text-gold tabular leading-none">{fmtPoints(highestBid)}</div>
              </div>
              {player && lastBidAt && isLive && (
                <AuctionTimer
                  duration={auction.bid_timer_seconds ?? 15}
                  lastBidAt={lastBidAt}
                  onExpired={handlers.onTimerExpired}
                  paused={timerPaused || !!celebration}
                />
              )}
              <div className="sm:text-right min-w-0">
                <div className="text-teal-400 text-xs uppercase tracking-widest">Highest bidder</div>
                <div className="font-score text-2xl sm:text-3xl text-white truncate">{leaderName || '—'}</div>
              </div>
            </div>

            {player && (
              <AuctioneerControls
                player={player} teams={teams} highestBid={highestBid}
                leaderTeamId={leaderTeamId} basePrice={player?.base_price ?? 0}
                hasBids={bids.length > 0}
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
