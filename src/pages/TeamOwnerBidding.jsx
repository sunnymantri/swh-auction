import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuth } from '../context/AuthContext'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { getBidsForPlayer, getCurrentQueueItem, listTeamSummaries, placeBid } from '../lib/api'
import { fmtPoints } from '../lib/format'
import PlayerCard from '../components/auction/PlayerCard'
import AuctionTimer from '../components/auction/AuctionTimer'
import { calcIncrement } from '../components/auction/AuctioneerControls'

export default function TeamOwnerBidding() {
  const { auction } = useActiveAuction()
  const { profile, role } = useAuth()
  const [current, setCurrent] = useState(null)
  const [teams, setTeams] = useState([])
  const [bids, setBids] = useState([])
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastBidAt, setLastBidAt] = useState(null)
  const prevBidCountRef = useRef(0)

  const reload = useCallback(async () => {
    if (!auction) return
    const [cur, t] = await Promise.all([getCurrentQueueItem(auction.id), listTeamSummaries(auction.id)])
    setCurrent(cur)
    setTeams(t)
    setBids(cur?.player_id ? await getBidsForPlayer(cur.player_id) : [])
  }, [auction])

  useEffect(() => { reload() }, [reload])
  useAuctionRealtime(auction?.id, reload)

  const myTeam = useMemo(
    () => (profile ? teams.find((t) => t.owner_user_id === profile.id) || null : null),
    [teams, profile]
  )

  const player = current?.players ?? null

  useEffect(() => {
    if (player && bids.length !== prevBidCountRef.current) {
      setLastBidAt(Date.now())
    }
    prevBidCountRef.current = bids.length
  }, [bids.length, player])

  useEffect(() => {
    if (player) setLastBidAt(Date.now())
    else setLastBidAt(null)
  }, [player?.id])

  const isLive = auction?.status === 'live'
  const top = bids.reduce((m, b) => (b.bid_amount > (m?.bid_amount ?? -1) ? b : m), null)
  const highestBid = top?.bid_amount ?? 0
  const leaderName = teams.find((t) => t.id === top?.team_id)?.name
  const iAmLeader = top?.team_id && myTeam && top.team_id === myTeam.id
  const isReauction = current?.players?.status === 'reauction'
  const bidFloor = isReauction
    ? (auction?.min_player_price ?? 0)
    : (current?.players?.base_price ?? 0)
  const minNext = Math.max(highestBid + calcIncrement(highestBid), bidFloor)
  const timerDuration = bids.length > 0
    ? (auction?.bid_timer_seconds ?? 15)
    : (auction?.initial_bid_timer_seconds ?? 90)
  const cannotBidReason = !myTeam
    ? 'No team linked'
    : !isLive
      ? `Auction is ${auction?.status}`
      : (myTeam.players_count >= myTeam.squad_size)
        ? 'Squad is full'
        : ((myTeam.max_safe_bid ?? 0) <= 0)
          ? 'Insufficient budget reserve'
          : ''

  const doBid = async (manual) => {
    if (!myTeam || !current?.player_id) return
    const bidAmount = manual ? Number(amount || 0) : minNext
    if (manual && isReauction && bidAmount < (auction?.min_player_price ?? 0)) {
      setMsg(`Minimum bid for re-auction player is ${fmtPoints(auction?.min_player_price ?? 0)}.`)
      return
    }
    setBusy(true); setMsg('')
    try {
      await placeBid(current.player_id, myTeam.id, bidAmount, 'team_bid', false)
      setAmount('')
      setMsg('Bid placed.')
      await reload()
    } catch (e) {
      setMsg(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AppShell title="Team Owner Bidding">
      <RoleGate allow={['team_owner', 'admin']}>
        {!auction && <p className="text-teal-400">No auction selected.</p>}
        {auction && !myTeam && role === 'team_owner' && (
          <div className="rounded-xl border border-live/40 bg-live/10 p-3 text-sm">
            No team is linked to your profile yet. Ask the auction admin to link your account to a team.
          </div>
        )}
        {auction && !current?.players && (
          <p className="text-teal-400">No player is currently on the block.</p>
        )}
        {auction && current?.players && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="space-y-4">
              <PlayerCard player={current.players} />
              <div className="rounded-2xl bg-gradient-to-br from-teal-900 to-ink-900 border border-gold/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-teal-400 text-xs uppercase tracking-widest">Current bid</div>
                  <div className="font-score text-4xl sm:text-5xl text-gold tabular leading-none">{fmtPoints(highestBid)}</div>
                </div>
                {player && (lastBidAt || current?.current_bid_deadline) && isLive && (
                  <AuctionTimer
                    duration={timerDuration}
                    lastBidAt={lastBidAt}
                    deadlineTs={current?.current_bid_deadline ?? null}
                    paused={!!current?.clock_paused}
                    pausedRemainingSeconds={current?.paused_remaining_seconds ?? null}
                  />
                )}
                <div className="sm:text-right min-w-0">
                  <div className="text-teal-400 text-xs uppercase tracking-widest">Leader</div>
                  <div className="font-score text-2xl text-white truncate">{leaderName || '—'}</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-teal-700/40 bg-ink-800/60 p-4 space-y-3 h-fit">
              {!isLive && (
                <div className="rounded-lg border border-gold/40 bg-gold/10 text-gold p-2 text-xs">
                  Auction is {auction.status}. Bidding opens when it is live.
                </div>
              )}
              {iAmLeader && <p className="text-xs text-gold font-semibold">You are the highest bidder.</p>}
              <p className="text-sm text-teal-300">Team: <b className="text-white">{myTeam?.name ?? '—'}</b></p>
              <p className="text-sm text-teal-300">Remaining: <b className="text-white">{fmtPoints(myTeam?.points_remaining)}</b></p>
              <p className="text-sm text-teal-300">Squad: <b className="text-white">{myTeam?.players_count}/{myTeam?.squad_size}</b></p>
              <p className="text-sm text-teal-300" title="Maximum bid from unauctioned-player pool average formula.">Max safe bid: <b className="text-gold">{fmtPoints(myTeam?.max_safe_bid)}</b></p>
              <button disabled={!myTeam || !isLive || busy || !!cannotBidReason} onClick={() => doBid(false)}
                title={cannotBidReason || `Minimum next bid is ${fmtPoints(minNext)}`}
                className="w-full px-3 py-2 rounded bg-gold text-ink-900 font-semibold disabled:opacity-40">
                Bid {fmtPoints(minNext)}
              </button>
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                  placeholder="Manual amount" inputMode="numeric"
                  className="flex-1 rounded bg-ink-900 border border-teal-700/50 px-3 py-2" />
                <button disabled={!myTeam || !isLive || !amount || busy} onClick={() => doBid(true)}
                  className="px-3 py-2 rounded bg-teal-700/60 disabled:opacity-40">Place</button>
              </div>
              {msg && <p className="text-xs text-live">{msg}</p>}
            </div>
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
