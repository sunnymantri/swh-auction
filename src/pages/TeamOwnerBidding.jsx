import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuth } from '../context/AuthContext'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { getBidsForPlayer, getCurrentQueueItem, getRecentEvents, listTeamSummaries, placeBid } from '../lib/api'
import { fmtPoints } from '../lib/format'
import { useSoldCelebration } from '../hooks/useSoldCelebration'
import AuctionTimer from '../components/auction/AuctionTimer'
import SoldCelebration from '../components/auction/SoldCelebration'
import PlayerCard from '../components/auction/PlayerCard'
import { calcIncrement } from '../components/auction/AuctioneerControls'
import ActivityFeed from '../components/auction/ActivityFeed'

const initials = (name = '') => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

function HammerIcon({ className = 'h-6 w-6' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M13.5 4.5L18.75 9.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11.25 6.75L17.25 12.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 9L15 15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6.25 12.25L11.75 17.75" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19H13.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function StatTile({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3 text-center">
      <div className="va-label text-[#8ca09b]">{label}</div>
      <div className={`mt-2 text-2xl font-semibold leading-none tabular ${accent ? 'text-gold-soft' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function TeamMetric({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3 text-center">
      <div className="va-label text-[#8ca09b]">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular ${accent ? 'text-gold-soft' : 'text-white'}`}>{value}</div>
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
  const leaderTeam = teams.find((team) => team.id === top?.team_id) ?? null
  const leaderName = leaderTeam?.name
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
      : current?.clock_paused
        ? 'Clock is paused'
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

  const bumpAmount = (delta) => {
    const currentValue = Number(amount || 0)
    const base = currentValue > 0 ? currentValue : minNext
    setAmount(String(base + delta))
    setMsg('')
  }

  const doBid = async (manual) => {
    if (!myTeam || !current?.player_id) return
    if (current?.clock_paused) {
      setMsg('Clock is paused. Wait for the auctioneer to resume bidding.')
      return
    }
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
            <div className="va-label text-[#8ca09b]">Bidder console</div>
            <h2 className="va-page-title mt-3 text-white">No player is currently on the block</h2>
            <p className="va-support mt-2 text-[#9fb2ad]">When the auctioneer starts the next player, your live bidding view will appear here automatically.</p>
          </div>
        )}

        {auction && current?.players && (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_25rem] xl:items-start">
            <div className="space-y-4">
              <PlayerCard player={current.players} />

              <section className="victory-panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="mx-auto max-w-6xl">
                  <div className="flex justify-center">
                    <div className="va-label inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-1.5 text-gold-soft">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Live auction active
                    </div>
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem_minmax(0,1fr)] xl:items-center">
                    <div className="text-center xl:text-left">
                      <div className="va-label text-[#8ca09b]">Current highest bid</div>
                      <div className="va-display mt-3 text-gold-soft tabular">
                        {fmtPoints(highestBid)}
                      </div>
                      <div className="mt-5">
                        <div className="va-label text-[#8ca09b]">Leading team</div>
                        <div className="mt-3 flex flex-wrap items-center justify-center gap-3 xl:justify-start">
                          {leaderTeam ? (
                            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-gold/15 bg-black/20 shrink-0">
                              {leaderTeam.logo_url ? (
                                <img src={leaderTeam.logo_url} alt={leaderTeam.name} className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full w-full place-items-center bg-gold/10 text-sm font-semibold text-gold-soft">
                                  {initials(leaderTeam.short_name || leaderTeam.name)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-3xl text-gold-soft">⌂</span>
                          )}
                          <span className="va-page-title text-white">{leaderName || 'Awaiting first bid'}</span>
                          {iAmLeader && (
                            <span className="rounded-full border border-gold/25 bg-gold/10 px-3 py-1 text-xs font-medium text-gold-soft">
                              Leading
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {(player && (lastBidAt || current?.current_bid_deadline) && isLive) && (
                      <div className="flex justify-center">
                        <div className="rounded-[1.75rem] border border-gold/12 bg-black/10 px-6 py-5 shadow-[0_10px_35px_-26px_rgba(0,0,0,0.8)]">
                          <div className="va-label mb-3 text-center text-[#8ca09b]">Bid clock</div>
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

                    <div className="space-y-5 text-center xl:text-right">
                      <div>
                        <div className="va-label text-[#8ca09b]">Opening floor</div>
                        <div className="mt-2 text-4xl font-semibold leading-none text-gold-soft tabular">{fmtPoints(bidFloor)}</div>
                      </div>
                      <div className="mx-auto h-px w-40 bg-gold/10 xl:ml-auto" />
                      <div>
                        <div className="va-label text-[#8ca09b]">Next minimum bid</div>
                        <div className="mt-2 text-4xl font-semibold leading-none text-gold-soft tabular">{fmtPoints(minNext)}</div>
                      </div>
                    </div>
                  </div>

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
                          <div className="va-label text-[#8ca09b]">Your team</div>
                          <div className="va-page-title mt-1 text-white">{myTeam?.name ?? '—'}</div>
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

                  <div className="mt-4 rounded-[1.5rem] border border-gold/12 bg-black/10 p-4 sm:p-5">
                    <div className="mx-auto max-w-5xl">
                      <div className="va-label text-center text-[#8ca09b]">Quick action</div>
                      <button
                        disabled={!myTeam || !isLive || busy || !!actionBlockedReason}
                        onClick={() => doBid(false)}
                        title={actionBlockedReason || `Minimum next bid is ${fmtPoints(minNext)}`}
                        className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-4 py-4 text-2xl font-semibold text-[#11130e] shadow-[0_18px_35px_-24px_rgba(244,183,64,0.85)] transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <HammerIcon className="h-7 w-7" />
                        Bid {fmtPoints(minNext)}
                      </button>

                      <div className="my-4 flex items-center gap-3 text-[#8ca09b]">
                        <div className="h-px flex-1 bg-gold/10" />
                        <span className="va-micro uppercase tracking-[0.18em]">or</span>
                        <div className="h-px flex-1 bg-gold/10" />
                      </div>

                      <div className="mb-3 flex flex-wrap justify-center gap-2">
                        {[100, 500, 1000].map((delta) => (
                          <button
                            key={delta}
                            type="button"
                            onClick={() => bumpAmount(delta)}
                            disabled={!myTeam || !isLive || busy || !!actionBlockedReason}
                            className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold-soft transition hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            +{fmtPoints(delta)}
                          </button>
                        ))}
                      </div>

                      <div className="grid gap-2 lg:grid-cols-[16rem_minmax(0,1fr)_auto]">
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
                          className="rounded-2xl border border-gold/20 bg-transparent px-8 py-3 font-medium uppercase tracking-[0.14em] text-gold-soft transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Place
                        </button>
                      </div>

                      <p className="mt-3 text-center text-sm text-[#9db0ac]">
                        {actionBlockedReason
                          ? actionBlockedReason
                          : `Next valid bid starts at ${fmtPoints(minNext)}.`}
                      </p>
                      {msg && <p className="mt-2 text-center text-sm text-gold-soft">{msg}</p>}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <aside>
              <ActivityFeed events={events} scrollable={false} />
            </aside>
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
