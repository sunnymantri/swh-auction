import { useState } from 'react'
import { fmtPoints } from '../../lib/format'

const btn = 'px-3 py-2 rounded-lg font-semibold text-sm transition disabled:opacity-40 disabled:cursor-not-allowed'

export default function AuctioneerControls({
  player, teams, highestBid, leaderTeamId, basePrice, increment,
  hasBids, activeSale, busy, warning, onBid, onSold, onUnsold, onReauction, onNext, onStart
}) {
  const [teamId, setTeamId] = useState('')
  const [manual, setManual] = useState('')

  const nextBid = Math.max((highestBid || 0) + increment, basePrice)
  const leader = teams.find(t => t.id === leaderTeamId)

  if (!player) {
    return (
      <div className="rounded-2xl bg-ink-800/70 border border-teal-700/40 p-5">
        <button className={`${btn} w-full bg-gold text-ink-900 hover:bg-gold-soft`}
          disabled={busy} onClick={onStart}>▶  Start auction</button>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-ink-800/80 border border-teal-700/50 p-5 space-y-4 shadow-card">
      <div className="flex items-center gap-2">
        <span className="font-score text-lg text-teal-200">Auctioneer</span>
        {busy && <span className="text-xs text-teal-400 animate-pulsegold">working…</span>}
      </div>

      {/* Calling bids on behalf of a team */}
      <div className="space-y-2">
        <div className="text-xs text-teal-300 uppercase tracking-wide">Bidding team</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {teams.map((t) => {
            const isSelected = teamId === t.id
            const isLeader = t.id === leaderTeamId
            const isFull = t.players_count >= t.squad_size
            return (
              <button
                key={t.id}
                type="button"
                disabled={isFull || busy}
                onClick={() => setTeamId(t.id)}
                className={`
                  rounded-lg border px-2 py-2 text-left transition
                  ${isSelected
                    ? 'border-gold bg-gold/15'
                    : 'border-teal-700/40 bg-ink-900/70 hover:border-teal-500/60'}
                  ${isFull ? 'opacity-40 cursor-not-allowed' : ''}
                `}
                title={isFull ? `${t.name} squad is full` : `${t.name} (${fmtPoints(t.points_remaining)} left)`}
              >
                <div className="flex items-center gap-2">
                  {t.logo_url ? (
                    <img src={t.logo_url} alt="" className="h-6 w-6 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-6 w-6 rounded bg-teal-800/60 grid place-items-center text-[10px] text-teal-200">
                      {(t.short_name || t.name || '?').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-white truncate">
                      {isLeader ? '★ ' : ''}{t.short_name || t.name}
                    </p>
                    <p className="text-[10px] text-teal-300 truncate">
                      {fmtPoints(t.points_remaining)} left{isFull ? ' · Full' : ''}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button className={`${btn} bg-teal-600 hover:bg-teal-500 text-white`}
            disabled={busy || !teamId}
            onClick={() => onBid(teamId, nextBid, 'team_bid', false)}>
            + {fmtPoints(increment)} → {fmtPoints(nextBid)}
          </button>
          <div className="flex gap-1">
            <input value={manual} onChange={e => setManual(e.target.value.replace(/[^\d]/g, ''))}
              placeholder="amount" inputMode="numeric"
              className="w-full rounded-lg bg-ink-900 border border-teal-700/50 px-2 py-2 text-sm text-white tabular" />
            <button className={`${btn} bg-teal-700 hover:bg-teal-600 text-white shrink-0`}
              disabled={busy || !teamId || !manual}
              title="Manual bid (overrides increment rule)"
              onClick={() => onBid(teamId, Number(manual), 'auctioneer_manual_bid', true)}>
              Set
            </button>
          </div>
        </div>
      </div>

      {warning && <p className="text-live text-xs bg-live/10 rounded-lg px-3 py-2">{warning}</p>}

      {/* Outcome */}
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button className={`${btn} bg-gold text-ink-900 hover:bg-gold-soft`}
          disabled={busy || !hasBids}
          onClick={() => onSold(leaderTeamId, highestBid)}>
          ✓ Sold{leader ? ` → ${leader.short_name}` : ''}
        </button>
        <button className={`${btn} bg-live/80 hover:bg-live text-white`}
          disabled={busy} onClick={onUnsold}>✕ Unsold</button>
        <button className={`${btn} bg-white/5 hover:bg-white/10 text-teal-200`}
          disabled={busy || !activeSale} onClick={() => onReauction(activeSale?.id)}>
          ↻ Re-auction
        </button>
        <button className={`${btn} bg-teal-800 hover:bg-teal-700 text-white`}
          disabled={busy} onClick={onNext}>Next player →</button>
      </div>
    </div>
  )
}
