import { useMemo, useState } from 'react'
import { fmtPoints } from '../../lib/format'
import { calcIncrement } from '../../lib/bidding'

export { calcIncrement }

const initials = (label = '') =>
  String(label)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?'

function HammerIcon({ className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M14.5 3.5L20.5 9.5L18 12L12 6L14.5 3.5Z" fill="currentColor" />
      <path d="M11 7L17 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M4 20L11.5 12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8.5 20H4V15.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CheckIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4.5 10.5L8.25 14.25L15.5 6.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function XIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M5.5 5.5L14.5 14.5M14.5 5.5L5.5 14.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function RotateIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M15.5 8A6 6 0 1 0 16 12.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M12.75 4.5H16.5V8.25" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ArrowIcon({ className = 'h-4 w-4' }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path d="M4 10H16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11.5 5.5L16 10L11.5 14.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function AuctioneerControls({
  player, teams, highestBid, leaderTeamId, basePrice,
  minPlayerPrice = 0,
  hasBids, activeSale, busy, warning, clockPaused = false, onBid, onSold, onUnsold, onReauction, onNext, onStart
}) {
  const [teamId, setTeamId] = useState('')
  const [manual, setManual] = useState('')

  const isReauction = player?.status === 'reauction'
  const dynamicIncrement = calcIncrement(highestBid)
  const bidFloor = isReauction ? minPlayerPrice : basePrice
  const nextBid = Math.max((highestBid || 0) + dynamicIncrement, bidFloor)
  const leader = teams.find((t) => t.id === leaderTeamId)

  const selectedTeam = useMemo(
    () => teams.find((t) => t.id === teamId) ?? null,
    [teamId, teams]
  )
  const manualAmount = Number(manual || 0)
  const hasManualAmount = manual.trim().length > 0 && manualAmount > 0
  const activeBidAmount = hasManualAmount ? manualAmount : nextBid
  const manualTooLow = hasManualAmount && manualAmount < nextBid
  const manualBelowReauctionFloor = isReauction && hasManualAmount && manualAmount < minPlayerPrice
  const biddingDisabled = busy || clockPaused || !selectedTeam
  const canSubmitBid = !biddingDisabled && !manualTooLow && !manualBelowReauctionFloor

  const bumpAmount = (delta) => {
    setManual((current) => {
      const startingPoint = current ? Number(current) : nextBid
      return String(startingPoint + delta)
    })
  }

  if (!player) {
    return (
      <div className="rounded-[1.75rem] border border-gold/12 bg-ink-800/80 p-5 shadow-card">
        <div className="va-label text-center text-[#8ca09b]">Auctioneer stage</div>
        <button
          className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-4 py-4 text-2xl font-semibold text-[#11130e] shadow-[0_18px_35px_-24px_rgba(244,183,64,0.85)] transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
          disabled={busy}
          onClick={onStart}
        >
          <ArrowIcon className="h-6 w-6" />
          Start auction
        </button>
      </div>
    )
  }

  return (
    <div className="rounded-[1.75rem] border border-gold/12 bg-ink-800/80 p-4 sm:p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="va-label text-[#8ca09b]">Auctioneer stage</div>
        <div className="flex items-center gap-2">
          {isReauction && (
            <span className="va-micro rounded-full border border-yellow-500/25 bg-yellow-500/10 px-3 py-1 text-yellow-300">
              Re-auction
            </span>
          )}
          {busy && <span className="va-micro text-teal-400 animate-pulsegold">working…</span>}
        </div>
      </div>

      <div className="mt-4 rounded-[1.5rem] bg-black/10 p-4">
        <div className="va-label mb-3 text-[#8ca09b]">Bidding team</div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => {
            const isSelected = teamId === t.id
            const isLeader = t.id === leaderTeamId
            const isFull = t.players_count >= t.squad_size
            return (
              <button
                key={t.id}
                type="button"
                disabled={isFull || busy || clockPaused}
                onClick={() => setTeamId(t.id)}
                title={isFull ? `${t.name} squad is full` : `${t.name} (${fmtPoints(t.points_remaining)} left)`}
                className={`rounded-2xl border px-3 py-3 text-left transition ${
                  isSelected
                    ? 'border-gold/35 bg-gold/10 shadow-[0_14px_28px_-24px_rgba(244,183,64,0.8)]'
                    : 'border-gold/10 bg-black/20 hover:border-gold/20'
                } ${isFull ? 'cursor-not-allowed opacity-40' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-gold/12 bg-black/20 shrink-0">
                    {t.logo_url ? (
                      <img src={t.logo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full w-full place-items-center bg-gold/10 text-sm font-semibold text-gold-soft">
                        {initials(t.short_name || t.name)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="va-body truncate text-white">
                      {t.short_name || t.name}
                      {isLeader && <span className="va-micro ml-2 text-gold-soft">Leading</span>}
                    </div>
                    <div className="va-micro truncate text-[#9db0ac]">
                      {fmtPoints(t.points_remaining)} left{isFull ? ' · Full' : ''}
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="mt-4 rounded-[1.5rem] bg-black/10 p-4 sm:p-5">
        <div className="mx-auto max-w-5xl">
          <div className="va-label text-center text-[#8ca09b]">Quick action</div>
          <button
            disabled={!canSubmitBid}
            onClick={() => onBid(teamId, activeBidAmount, hasManualAmount ? 'auctioneer_manual_bid' : 'team_bid', hasManualAmount || isReauction)}
            title={
              clockPaused
                ? 'Clock is paused'
                : selectedTeam
                  ? `Place bid ${fmtPoints(activeBidAmount)}`
                  : 'Select a bidding team'
            }
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-gold px-4 py-4 text-2xl font-semibold text-[#11130e] shadow-[0_18px_35px_-24px_rgba(244,183,64,0.85)] transition hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            <HammerIcon className="h-7 w-7" />
            {hasManualAmount ? 'Bid' : 'Next bid'} {fmtPoints(activeBidAmount)}
          </button>

          <button
            disabled={busy || !hasBids}
            onClick={() => onSold(leaderTeamId, highestBid)}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-gold/20 bg-gold/12 px-4 py-3 text-lg font-semibold text-gold-soft transition hover:bg-gold/16 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CheckIcon className="h-5 w-5" />
            Sold{leader ? ` → ${leader.short_name}` : ''}
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
                disabled={biddingDisabled}
                className="rounded-full border border-gold/20 bg-gold/10 px-3 py-1.5 text-sm font-medium text-gold-soft transition hover:bg-gold/15 disabled:cursor-not-allowed disabled:opacity-40"
              >
                +{fmtPoints(delta)}
              </button>
            ))}
          </div>

          <div className="grid gap-2 lg:grid-cols-[14rem_minmax(0,1fr)_auto]">
            <div className="rounded-2xl border border-gold/12 bg-black/20 px-4 py-3 text-left text-[#8ca09b]">
              Manual amount
            </div>
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value.replace(/[^\d]/g, ''))}
              placeholder={`${fmtPoints(nextBid)}`}
              inputMode="numeric"
              className="rounded-2xl border border-gold/12 bg-black/20 px-4 py-3 text-white placeholder:text-[#6f817c] focus:border-gold/35 focus:outline-none"
            />
            <button
              disabled={!canSubmitBid || !manual}
              title="Manual bid (overrides increment rule)"
              onClick={() => onBid(teamId, Number(manual), 'auctioneer_manual_bid', true)}
              className="rounded-2xl border border-gold/20 bg-transparent px-8 py-3 font-medium uppercase tracking-[0.14em] text-gold-soft transition hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Place
            </button>
          </div>

          <p className="mt-3 text-center text-sm text-[#9db0ac]">
            {clockPaused
              ? 'Clock is paused. Bidding is locked until the auctioneer resumes it.'
              : !selectedTeam
                ? 'Select a bidding team to activate quick bid and manual amount actions.'
                : manualTooLow
                  ? `Enter at least ${fmtPoints(nextBid)} to beat the current bid.`
                  : manualBelowReauctionFloor
                    ? `Minimum bid for re-auction player is ${fmtPoints(minPlayerPrice)}.`
                    : hasManualAmount
                      ? `Current highest bid is ${fmtPoints(highestBid)}. You are about to place ${fmtPoints(activeBidAmount)}.`
                      : `Current highest bid is ${fmtPoints(highestBid)}. Next valid bid starts at ${fmtPoints(nextBid)}.`}
          </p>

          {warning && <p className="va-support mt-3 rounded-2xl bg-live/10 px-4 py-3 text-center text-live">{warning}</p>}

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <button
              className="flex items-center justify-center gap-2 rounded-2xl border border-live/18 bg-live/75 px-4 py-3 font-medium text-white transition hover:bg-live disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy}
              onClick={onUnsold}
            >
              <XIcon className="h-5 w-5" />
              Unsold
            </button>
            <button
              className="flex items-center justify-center gap-2 rounded-2xl border border-gold/12 bg-white/5 px-4 py-3 font-medium text-teal-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy || !activeSale}
              onClick={() => onReauction(activeSale?.id)}
            >
              <RotateIcon className="h-5 w-5" />
              Re-auction
            </button>
            <button
              className="flex items-center justify-center gap-2 rounded-2xl border border-teal-500/18 bg-teal-800 px-4 py-3 font-medium text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={busy}
              onClick={onNext}
            >
              <ArrowIcon className="h-5 w-5" />
              Next player
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
