import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuth } from '../context/AuthContext'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { getBidsForPlayer, getCurrentQueueItem, getRecentEvents, listTeamSummaries, placeBid } from '../lib/api'
import { fmtPoints, fmtStatus } from '../lib/format'
import { useSoldCelebration } from '../hooks/useSoldCelebration'
import AuctionTimer from '../components/auction/AuctionTimer'
import SoldCelebration from '../components/auction/SoldCelebration'
import PlayerCard from '../components/auction/PlayerCard'
import { calcIncrement } from '../components/auction/AuctioneerControls'

const initials = (name = '') => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

function StatTile({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3 text-center">
      <div className="text-[0.68rem] uppercase tracking-[0.22em] text-[#8ca09b]">{label}</div>
      <div className={`mt-2 font-score text-2xl leading-none tabular ${accent ? 'text-gold-soft' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function TeamMetric({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3 text-center">
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular ${accent ? 'text-gold-soft' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function RecentActivityPanel({ events }) {
  return (
    <div className="victory-panel rounded-[1.5rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">Live Activity</div>
          <div className="text-xs uppercase tracking-[0.18em] text-[#839792]">Latest auction events</div>
        </div>
        <span className="rounded-full border border-gold/15 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-gold-soft">
          Real-time
        </span>
      </div>
      <div className="space-y-3">
        {events.slice(0, 5).map((event) => (
          <div key={event.id} className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-white">{event.teams?.name || 'Auction Event'}</div>
                <div className="mt-1 text-xs text-[#90a4a0]">
                  {event.event_type.replace(/_/g, ' ')}
                  {event.players?.name ? ` · ${event.players.name}` : ''}
                </div>
              </div>
              {event.amount != null && (
                <div className="shrink-0 text-sm font-semibold tabular text-gold-soft">{fmtPoints(event.amount)}</div>
              )}
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-[#9fb2ad]">No activity yet.</p>}
      </div>
    </div>
  )
}

export default function TeamOwnerBidding() {
  const { auction } = useActiveAuction()
  const { profile, role } = useAuth()
  const [current, setCurrent] = useState(null)
  const [teams, setTeams] = useState([])
  const [bids, setBids] = useState([])
  const [events, setEvents] = useState([])
  const [amount, setAmount] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastBidAt, setLastBidAt] = useState(null)
  const prevBidCountRef = useRef(0)

  const reload = useCallback(async () => {
    if (!auction) return
    const [cur, t, e] = await Promise.all([
      getCurrentQueueItem(auction.id),
      listTeamSummaries(auction.id),
      getRecentEvents(auction.id, 20)
    ])
    setCurrent(cur)
    setTeams(t)
    setEvents(e)
    setBids(cur?.player_id ? await getBidsForPlayer(cur.player_id) : [])
  }, [auction])

  useEffect(() => { reload() }, [reload])
  useAuctionRealtime(auction?.id, reload)

  const { celebration, dismiss: dismissCelebration } = useSoldCelebration(events)

  const myTeam = useMemo(
    () => (profile ? teams.find((team) => team.owner_user_id === profile.id) || null : null),
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
  const top = bids.reduce((max, bid) => (bid.bid_amount > (max?.bid_amount ?? -1) ? bid : max), null)
  const highestBid = top?.bid_amount ?? 0
  const leaderName = teams.find((team) => team.id === top?.team_id)?.name
  const iAmLeader = Boolean(top?.team_id && myTeam && top.team_id === myTeam.id)
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
  const actionBlockedReason = cannotBidReason || (iAmLeader ? 'You already hold the highest bid' : '')

  const bidderStatus = iAmLeader
    ? { label: 'Leading bid', tone: 'accent' }
    : actionBlockedReason
      ? { label: actionBlockedReason, tone: 'blocked' }
      : { label: 'Eligible to bid', tone: 'ready' }

  const bidderStatusClass = bidderStatus.tone === 'ready'
    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
    : bidderStatus.tone === 'accent'
      ? 'border-gold/25 bg-gold/10 text-gold-soft'
      : 'border-live/30 bg-live/10 text-[#ff9c9c]'

  const doBid = async (manual) => {
    if (!myTeam || !current?.player_id) return
    const bidAmount = manual ? Number(amount || 0) : minNext
    if (manual && bidAmount < minNext) {
      setMsg(`Enter at least ${fmtPoints(minNext)} to beat the current bid.`)
      return
    }
    if (manual && isReauction && bidAmount < (auction?.min_player_price ?? 0)) {
      setMsg(`Minimum bid for re-auction player is ${fmtPoints(auction?.min_player_price ?? 0)}.`)
      return
    }
    setBusy(true)
    setMsg('')
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
    <AppShell title="Bidder's Console">
      {celebration && (
        <SoldCelebration
          player={celebration.player}
          soldPrice={celebration.soldPrice}
          teamName={celebration.teamName}
          teamLogo={celebration.teamLogo}
          onDone={dismissCelebration}
        />
      )}

      <RoleGate allow={['team_owner', 'admin']}>
        {!auction && <p className="text-teal-400">No auction selected.</p>}

        {auction && !myTeam && role === 'team_owner' && (
          <div className="mb-4 rounded-2xl border border-live/30 bg-live/10 p-4 text-sm text-[#ffb6b6]">
            No team is linked to your profile yet. Ask the auction admin to link your account to a team before bidding.
          </div>
        )}

        {auction && !current?.players && (
          <div className="victory-panel rounded-[1.75rem] p-8 text-center">
            <div className="text-[0.72rem] uppercase tracking-[0.28em] text-[#8ca09b]">Bidder console</div>
            <h2 className="mt-3 font-score text-3xl text-white">No player is currently on the block</h2>
            <p className="mt-2 text-sm text-[#9fb2ad]">When the auctioneer starts the next player, your live bidding view will appear here automatically.</p>
          </div>
        )}

        {auction && current?.players && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem] xl:items-start">
            <div className="space-y-4">
              <PlayerCard player={current.players} />

              <section className="victory-panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="mx-auto max-w-5xl text-center">
                  <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-1.5 text-[0.72rem] uppercase tracking-[0.22em] text-gold-soft">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    Live auction active
                  </div>

                  <div className="mt-5 text-[0.72rem] uppercase tracking-[0.24em] text-[#8ca09b]">Current highest bid</div>
                  <div className="mt-2 font-score text-[3.35rem] leading-none text-gold-soft sm:text-[4.25rem]">
                    {fmtPoints(highestBid)}
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-sm">
                    <span className="text-[#8ca09b]">Leading team</span>
                    <span className="rounded-full border border-gold/20 bg-black/10 px-3 py-1 font-medium text-white">
                      {leaderName || 'Awaiting first bid'}
                    </span>
                    {iAmLeader && (
                      <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-soft">
                        You are leading
                      </span>
                    )}
                  </div>

                  {(player && (lastBidAt || current?.current_bid_deadline) && isLive) && (
                    <div className="mt-6 flex justify-center">
                      <div className="rounded-[1.5rem] border border-gold/12 bg-black/10 px-6 py-5">
                        <div className="mb-3 text-center text-[0.72rem] uppercase tracking-[0.24em] text-[#8ca09b]">Bid clock</div>
                        <AuctionTimer
                          duration={timerDuration}
                          lastBidAt={lastBidAt}
                          deadlineTs={current?.current_bid_deadline ?? null}
                          paused={!!celebration || !!current?.clock_paused}
                          pausedRemainingSeconds={current?.paused_remaining_seconds ?? null}
                        />
                      </div>
                    </div>
                  )}

                  <div className="mt-6 rounded-[1.5rem] border border-gold/12 bg-black/10 p-4 sm:p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center justify-center gap-3 sm:justify-start">
                        <div className="h-14 w-14 overflow-hidden rounded-2xl border border-gold/15 bg-black/20">
                          {myTeam?.logo_url ? (
                            <img src={myTeam.logo_url} alt={myTeam.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="grid h-full w-full place-items-center bg-gold/10 font-score text-lg text-gold-soft">
                              {initials(myTeam?.short_name || myTeam?.name || 'T')}
                            </div>
                          )}
                        </div>
                        <div className="text-left">
                          <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[#8ca09b]">Your team</div>
                          <div className="mt-1 text-2xl font-semibold text-white">{myTeam?.name ?? '—'}</div>
                        </div>
                      </div>
                      <span className={`mx-auto rounded-full border px-3 py-1 text-xs font-medium sm:mx-0 ${bidderStatusClass}`}>
                        {bidderStatus.label}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      <TeamMetric label="Remaining budget" value={fmtPoints(myTeam?.points_remaining ?? 0)} accent />
                      <TeamMetric label="Squad" value={`${myTeam?.players_count ?? 0}/${myTeam?.squad_size ?? 0}`} />
                      <TeamMetric label="Max safe bid" value={fmtPoints(myTeam?.max_safe_bid ?? 0)} />
                    </div>
                  </div>

                  <div className="mt-6 mx-auto max-w-3xl rounded-[1.5rem] border border-gold/12 bg-black/10 p-4 sm:p-5">
                    <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">Quick action</div>
                    <button
                      disabled={!myTeam || !isLive || busy || !!actionBlockedReason}
                      onClick={() => doBid(false)}
                      title={actionBlockedReason || `Minimum next bid is ${fmtPoints(minNext)}`}
                      className="mt-4 w-full rounded-2xl bg-gold px-4 py-4 text-2xl font-semibold text-[#11130e] shadow-[0_18px_35px_-24px_rgba(244,183,64,0.85)] transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Bid {fmtPoints(minNext)}
                    </button>

                    <div className="my-4 flex items-center gap-3 text-[#8ca09b]">
                      <div className="h-px flex-1 bg-gold/10" />
                      <span className="text-xs uppercase tracking-[0.18em]">or</span>
                      <div className="h-px flex-1 bg-gold/10" />
                    </div>

                    <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)_auto]">
                      <div className="rounded-2xl border border-gold/12 bg-black/20 px-4 py-3 text-left text-[#8ca09b]">
                        Manual amount
                      </div>
                      <input
                        value={amount}
                        onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                        placeholder={`${fmtPoints(minNext)}`}
                        inputMode="numeric"
                        className="rounded-2xl border border-gold/12 bg-black/20 px-4 py-3 text-white placeholder:text-[#6f817c] focus:border-gold/35 focus:outline-none"
                      />
                      <button
                        disabled={!myTeam || !isLive || !amount || busy || !!actionBlockedReason}
                        onClick={() => doBid(true)}
                        className="rounded-2xl border border-gold/20 bg-transparent px-6 py-3 font-medium uppercase tracking-[0.14em] text-gold-soft transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Place
                      </button>
                    </div>

                    <p className="mt-3 text-sm text-[#9db0ac]">
                      {actionBlockedReason
                        ? actionBlockedReason
                        : `Next valid bid starts at ${fmtPoints(minNext)}.`}
                    </p>
                    {msg && <p className="mt-2 text-sm text-gold-soft">{msg}</p>}
                  </div>

                  <div className="mt-6 grid gap-3 sm:grid-cols-3">
                    <StatTile label="Opening floor" value={fmtPoints(bidFloor)} />
                    <StatTile label="Next minimum bid" value={fmtPoints(minNext)} accent />
                    <StatTile label="Auction status" value={fmtStatus(auction.status)} />
                  </div>
                </div>
              </section>
            </div>

            <aside>
              <RecentActivityPanel events={events} />
            </aside>
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
