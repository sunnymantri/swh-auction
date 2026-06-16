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
import { calcIncrement } from '../components/auction/AuctioneerControls'

const DETAIL_TABS = ['Bid History', 'Player Stats', 'Availability']

const extractCricHeroesProfileId = (url = '') => {
  const match = String(url).match(/player-profile\/(\d+)/i)
  return match?.[1] || null
}

const initials = (name = '') => name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase()

function MetaChip({ children, tone = 'default' }) {
  const toneClass = {
    accent: 'border-gold/30 bg-gold/10 text-gold-soft',
    success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
    default: 'border-white/8 bg-white/5 text-[#c8d3d0]'
  }[tone]

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${toneClass}`}>
      {children}
    </span>
  )
}

function StatTile({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
      <div className="text-[0.68rem] uppercase tracking-[0.22em] text-[#8ca09b]">{label}</div>
      <div className={`mt-2 font-score text-2xl leading-none tabular ${accent ? 'text-gold-soft' : 'text-white'}`}>
        {value}
      </div>
    </div>
  )
}

function TeamMetric({ label, value, accent = false }) {
  return (
    <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
      <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">{label}</div>
      <div className={`mt-2 text-2xl font-semibold tabular ${accent ? 'text-gold-soft' : 'text-white'}`}>{value}</div>
    </div>
  )
}

function DetailTabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
        active
          ? 'bg-gold text-[#11130e] shadow-[0_0_24px_-12px_rgba(244,183,64,0.75)]'
          : 'text-[#b8c7c3] hover:bg-white/5 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

function BidHistoryPanel({ bids }) {
  if (bids.length === 0) {
    return <p className="text-sm text-[#9fb2ad]">No bids on this player yet. Once teams start bidding, the ladder will appear here.</p>
  }

  return (
    <div className="space-y-2">
      {bids.map((bid, index) => (
        <div key={bid.id} className="grid grid-cols-[4rem_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
          <div className="text-xs uppercase tracking-[0.18em] text-[#7f938e]">#{bids.length - index}</div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-white">{bid.teams?.name || 'Auctioneer'}</div>
            <div className="text-xs text-[#8ea49f]">{new Date(bid.created_at).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</div>
          </div>
          <div className="text-lg font-semibold tabular text-gold-soft">{fmtPoints(bid.bid_amount)}</div>
        </div>
      ))}
    </div>
  )
}

function PlayerStatsPanel({ player }) {
  const stats = [
    ['Matches', player.matches ?? '—'],
    ['Runs', player.runs ?? '—'],
    ['Wickets', player.wickets ?? '—'],
    ['Bat Avg', player.bat_avg ?? '—'],
    ['Strike Rate', player.strike_rate ?? '—'],
    ['Economy', player.economy ?? '—'],
    ['Batting Style', player.batting_style || '—'],
    ['Bowling Style', player.bowling_style || '—']
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">{label}</div>
          <div className="mt-2 text-lg font-medium text-white">{value}</div>
        </div>
      ))}
    </div>
  )
}

function AvailabilityPanel({ player }) {
  const vacationDates = Array.isArray(player.vacation_dates) ? player.vacation_dates : []

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">Availability</div>
          <div className="mt-2 text-lg font-medium text-white">{vacationDates.length > 0 ? 'Partially unavailable' : 'Available'}</div>
        </div>
        <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">Weeks Away</div>
          <div className="mt-2 text-lg font-medium text-white">{player.weeks_away || 0}</div>
        </div>
        <div className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
          <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">Role Fit</div>
          <div className="mt-2 text-lg font-medium text-white">{player.role || '—'}</div>
        </div>
      </div>

      {vacationDates.length > 0 ? (
        <div>
          <div className="mb-2 text-sm font-medium text-white">Unavailable Sundays</div>
          <div className="flex flex-wrap gap-2">
            {vacationDates.map((date) => (
              <span key={date} className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs text-gold-soft">
                {new Date(`${date}T00:00:00`).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#9fb2ad]">No unavailable Sundays have been recorded for this player.</p>
      )}
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
        {events.slice(0, 4).map((event) => (
          <div key={event.id} className="rounded-2xl border border-gold/10 bg-black/10 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{event.teams?.name || 'Auction Event'}</div>
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

function BidderPlayerHero({ player }) {
  const profileId = extractCricHeroesProfileId(player?.profile_url)

  return (
    <section className="victory-panel rounded-[1.75rem] overflow-hidden">
      <div className="grid gap-5 p-5 sm:p-6 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-start">
        <div className="h-28 w-28 overflow-hidden rounded-[1.35rem] border border-gold/15 bg-black/20 shadow-victory">
          {player.photo_url ? (
            <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center bg-gold/10 font-score text-4xl text-gold-soft">
              {initials(player.name)}
            </div>
          )}
        </div>

        <div className="min-w-0">
          <div className="text-[0.72rem] uppercase tracking-[0.3em] text-[#8ca09b]">Current player</div>
          <h2 className="mt-3 font-score text-4xl leading-none text-white sm:text-5xl">{player.name}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {player.role && <MetaChip tone="accent">{player.role}</MetaChip>}
            {player.category && <MetaChip>{player.category}</MetaChip>}
            {player.batting_style && <MetaChip>{player.batting_style}</MetaChip>}
            {player.bowling_style && <MetaChip>{player.bowling_style}</MetaChip>}
            {player.weeks_away > 0 && <MetaChip tone="success">Away {player.weeks_away}w</MetaChip>}
          </div>
        </div>

        <div className="rounded-[1.35rem] border border-gold/15 bg-black/15 px-5 py-4 text-left lg:min-w-[10rem] lg:text-right">
          <div className="text-[0.72rem] uppercase tracking-[0.24em] text-[#8ca09b]">Base price</div>
          <div className="mt-2 font-score text-4xl leading-none text-gold-soft">{fmtPoints(player.base_price)}</div>
        </div>
      </div>

      <div className="victory-divider border-t px-5 py-5 sm:px-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          <StatTile label="Matches" value={player.matches ?? '—'} />
          <StatTile label="Runs" value={player.runs ?? '—'} />
          <StatTile label="Bat Avg" value={player.bat_avg ?? '—'} />
          <StatTile label="Strike Rate" value={player.strike_rate ?? '—'} />
          <StatTile label="Wickets" value={player.wickets ?? '—'} />
          <StatTile label="Economy" value={player.economy ?? '—'} />
          <StatTile label="CricHeroes ID" value={profileId || '—'} accent />
        </div>
      </div>

      <div className="victory-divider flex flex-col gap-3 border-t px-5 py-4 text-sm text-[#a9bbb7] sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>Profile and auction context are now grouped here so team owners can scan the player before acting.</div>
        {player.profile_url ? (
          <a
            href={player.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gold-soft underline underline-offset-4 hover:text-white"
          >
            View CricHeroes profile ↗
          </a>
        ) : (
          <span className="text-[#80938f]">No CricHeroes profile linked</span>
        )}
      </div>
    </section>
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
  const [detailTab, setDetailTab] = useState('Bid History')
  const prevBidCountRef = useRef(0)

  const reload = useCallback(async () => {
    if (!auction) return
    const [cur, t, e] = await Promise.all([
      getCurrentQueueItem(auction.id), listTeamSummaries(auction.id), getRecentEvents(auction.id, 20)
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
    if (player) {
      setLastBidAt(Date.now())
      setDetailTab('Bid History')
    } else {
      setLastBidAt(null)
    }
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

  const renderDetailPanel = () => {
    if (!player) return null
    if (detailTab === 'Player Stats') return <PlayerStatsPanel player={player} />
    if (detailTab === 'Availability') return <AvailabilityPanel player={player} />
    return <BidHistoryPanel bids={bids} />
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
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_22rem]">
            <div className="space-y-4">
              <BidderPlayerHero player={current.players} />

              <section className="victory-panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-4 py-1.5 text-[0.72rem] uppercase tracking-[0.22em] text-gold-soft">
                      <span className="h-2 w-2 rounded-full bg-emerald-400" />
                      Live auction active
                    </div>
                    <div className="mt-4 text-[0.72rem] uppercase tracking-[0.24em] text-[#8ca09b]">Current highest bid</div>
                    <div className="mt-2 font-score text-[3.25rem] leading-none text-gold-soft sm:text-[4rem]">
                      {fmtPoints(highestBid)}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <span className="text-[#8ca09b]">Leading team</span>
                      <span className="rounded-full border border-gold/20 bg-black/10 px-3 py-1 font-medium text-white">
                        {leaderName || 'Awaiting first bid'}
                      </span>
                      {iAmLeader && <MetaChip tone="accent">You are leading</MetaChip>}
                    </div>
                  </div>

                  {(player && (lastBidAt || current?.current_bid_deadline) && isLive) && (
                    <div className="rounded-[1.5rem] border border-gold/12 bg-black/10 px-5 py-4">
                      <div className="mb-3 text-center text-[0.72rem] uppercase tracking-[0.24em] text-[#8ca09b]">Bid clock</div>
                      <AuctionTimer
                        duration={timerDuration}
                        lastBidAt={lastBidAt}
                        deadlineTs={current?.current_bid_deadline ?? null}
                        paused={!!celebration || !!current?.clock_paused}
                        pausedRemainingSeconds={current?.paused_remaining_seconds ?? null}
                      />
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <StatTile label="Opening floor" value={fmtPoints(bidFloor)} />
                  <StatTile label="Next minimum bid" value={fmtPoints(minNext)} accent />
                  <StatTile label="Auction status" value={fmtStatus(auction.status)} />
                </div>
              </section>

              <section className="victory-panel rounded-[1.75rem] p-5 sm:p-6">
                <div className="mb-5 flex flex-wrap gap-2">
                  {DETAIL_TABS.map((tab) => (
                    <DetailTabButton
                      key={tab}
                      active={detailTab === tab}
                      onClick={() => setDetailTab(tab)}
                    >
                      {tab}
                    </DetailTabButton>
                  ))}
                </div>
                {renderDetailPanel()}
              </section>
            </div>

            <aside className="space-y-4">
              <section className="victory-panel rounded-[1.75rem] p-5 sm:p-6 xl:sticky xl:top-24">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[0.72rem] uppercase tracking-[0.22em] text-[#8ca09b]">Your team</div>
                    <h3 className="mt-2 text-2xl font-semibold text-white">{myTeam?.name ?? '—'}</h3>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-medium ${bidderStatusClass}`}>
                    {bidderStatus.label}
                  </span>
                </div>

                <div className="mt-5 grid gap-3">
                  <TeamMetric label="Remaining budget" value={fmtPoints(myTeam?.points_remaining ?? 0)} accent />
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <TeamMetric label="Squad" value={`${myTeam?.players_count ?? 0}/${myTeam?.squad_size ?? 0}`} />
                    <TeamMetric label="Max safe bid" value={fmtPoints(myTeam?.max_safe_bid ?? 0)} />
                  </div>
                </div>

                <div className="mt-5 rounded-[1.35rem] border border-gold/10 bg-black/10 p-4">
                  <div className="text-[0.68rem] uppercase tracking-[0.18em] text-[#8ca09b]">Quick action</div>
                  <button
                    disabled={!myTeam || !isLive || busy || !!actionBlockedReason}
                    onClick={() => doBid(false)}
                    title={actionBlockedReason || `Minimum next bid is ${fmtPoints(minNext)}`}
                    className="mt-3 w-full rounded-2xl bg-gold px-4 py-3 text-lg font-semibold text-[#11130e] shadow-[0_18px_35px_-24px_rgba(244,183,64,0.85)] transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Bid {fmtPoints(minNext)}
                  </button>

                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ''))}
                      placeholder={`Manual amount above ${fmtPoints(minNext)}`}
                      inputMode="numeric"
                      className="rounded-2xl border border-gold/12 bg-black/20 px-4 py-3 text-white placeholder:text-[#6f817c] focus:border-gold/35 focus:outline-none"
                    />
                    <button
                      disabled={!myTeam || !isLive || !amount || busy || !!actionBlockedReason}
                      onClick={() => doBid(true)}
                      className="rounded-2xl border border-gold/15 bg-white/5 px-4 py-3 font-medium text-[#e5ece9] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
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
              </section>

              <RecentActivityPanel events={events} />
            </aside>
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
