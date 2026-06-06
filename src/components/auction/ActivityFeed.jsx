import { fmtPoints } from '../../lib/format'

const META = {
  bid_placed:    { dot: 'bg-gold',    label: 'Bid' },
  sold:          { dot: 'bg-teal-400', label: 'Sold' },
  unsold:        { dot: 'bg-live',    label: 'Unsold' },
  reauctioned:   { dot: 'bg-orange-400', label: 'Re-auction' },
  player_started:{ dot: 'bg-teal-600', label: 'On the block' },
  skipped:       { dot: 'bg-gray-500', label: 'Skipped' }
}
const since = (ts) => {
  const s = Math.round((Date.now() - new Date(ts)) / 1000)
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)}m`
  return `${Math.round(s / 3600)}h`
}

export default function ActivityFeed({ events }) {
  return (
    <div className="rounded-2xl bg-ink-800/70 border border-teal-700/40 p-4 max-h-[28rem] overflow-y-auto">
      <h3 className="font-score text-lg text-teal-200 mb-3">Live Activity</h3>
      <ul className="space-y-2.5">
        {events.map(e => {
          const m = META[e.event_type] || META.skipped
          return (
            <li key={e.id} className="flex items-start gap-2.5 text-sm animate-rise">
              <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${m.dot}`} />
              <div className="min-w-0 flex-1">
                <span className="text-teal-300 font-semibold">{m.label}</span>
                {e.players?.name && <span className="text-white"> · {e.players.name}</span>}
                {e.teams?.name && <span className="text-teal-200"> — {e.teams.name}</span>}
                {e.amount != null && <span className="text-gold tabular"> {fmtPoints(e.amount)}</span>}
              </div>
              <span className="text-teal-500 text-xs shrink-0">{since(e.created_at)}</span>
            </li>
          )
        })}
        {events.length === 0 && <li className="text-teal-500 text-sm">No activity yet.</li>}
      </ul>
    </div>
  )
}
