import { fmtPoints } from '../../lib/format'

const META = {
  bid_placed: { dot: 'bg-gold', label: 'Bid' },
  sold: { dot: 'bg-teal-400', label: 'Sold' },
  unsold: { dot: 'bg-live', label: 'Unsold' },
  reauctioned: { dot: 'bg-orange-400', label: 'Re-auction' },
  player_started: { dot: 'bg-teal-600', label: 'On the block' },
  skipped: { dot: 'bg-gray-500', label: 'Skipped' },
  auction_started: { dot: 'bg-teal-600', label: 'Auction started' },
  auction_paused: { dot: 'bg-orange-400', label: 'Auction paused' },
  auction_resumed: { dot: 'bg-teal-400', label: 'Auction resumed' },
  timer_expired: { dot: 'bg-live', label: 'Timer expired' }
}
const since = (ts) => {
  const s = Math.round((Date.now() - new Date(ts)) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

export default function ActivityFeed({ events, className = '', scrollable = true }) {
  const panelClasses = scrollable
    ? 'max-h-[24rem] sm:max-h-[28rem] overflow-y-auto'
    : 'overflow-visible'
  return (
    <div className={`rounded-2xl bg-ink-800/60 border border-teal-700/35 p-4 ${panelClasses} ${className}`}>
      <h3 className="mb-3 text-xl font-semibold tracking-tight text-white">Live Activity</h3>
      <ul className="space-y-2">
        {events.map(e => {
          const m = META[e.event_type] || { dot: 'bg-gray-500', label: 'Update' }
          const teamLogo = e.teams?.logo_url
          return (
            <li key={e.id} className="flex items-start gap-2.5 text-sm animate-rise">
              {teamLogo ? (
                <img
                  src={teamLogo}
                  alt={e.teams?.name || 'Team'}
                  className="mt-0.5 h-5 w-5 rounded object-cover shrink-0 border border-teal-700/40"
                />
              ) : (
                <span className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${m.dot}`} />
              )}
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-semibold text-[#c0dad3]">{m.label}</span>
                {e.players?.name && <span className="text-white/95"> · {e.players.name}</span>}
                {e.teams?.name && <span className="text-[#c0dad3]"> — {e.teams.name}</span>}
                {e.amount != null && <span className="text-gold tabular font-semibold"> {fmtPoints(e.amount)}</span>}
              </div>
              <span className="shrink-0 pt-0.5 text-xs text-[#93ada6]">{since(e.created_at)}</span>
            </li>
          )
        })}
        {events.length === 0 && <li className="text-teal-500 text-sm">No activity yet.</li>}
      </ul>
    </div>
  )
}
