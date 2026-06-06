import { fmtPoints } from '../../lib/format'

export default function TeamBudgetGrid({ teams, leaderTeamId }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {teams.map(t => {
        const leading = t.id === leaderTeamId
        const pct = Math.max(0, Math.min(100, (t.points_remaining / t.total_budget) * 100))
        return (
          <div key={t.id}
            className={`rounded-xl p-3.5 border transition ${
              leading ? 'border-gold/70 bg-gold/10 shadow-glow'
                       : 'border-teal-700/40 bg-ink-800/70'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-score text-lg text-white truncate">{t.name}</span>
                {leading && <span className="text-[0.6rem] font-bold text-gold uppercase tracking-wide animate-pulsegold">Leading</span>}
              </div>
              <span className="text-teal-300 text-xs tabular">{t.players_count}/{t.squad_size}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-ink-900 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-teal-400">Remaining <b className="text-white tabular">{fmtPoints(t.points_remaining)}</b></span>
              <span className="text-teal-400">Max safe <b className="text-gold tabular">{fmtPoints(t.max_safe_bid)}</b></span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
