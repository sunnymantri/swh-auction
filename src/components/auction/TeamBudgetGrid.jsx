import { fmtPoints } from '../../lib/format'

export default function TeamBudgetGrid({ teams, leaderTeamId, onTeamClick }) {
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {teams.map(t => {
        const leading = t.id === leaderTeamId
        const totalBudget = Number(t.total_budget || 0)
        const pointsSpent = Number(t.points_spent || 0)
        const pointsRemaining = Number(t.points_remaining || 0)
        const pct = totalBudget > 0
          ? Math.max(0, Math.min(100, (pointsRemaining / totalBudget) * 100))
          : 0
        return (
          <button key={t.id} type="button"
            onClick={() => onTeamClick?.(t.id)}
            className={`rounded-xl p-3.5 border transition text-left w-full ${
              onTeamClick ? 'cursor-pointer hover:border-teal-500/60' : ''} ${
              leading ? 'border-gold/70 bg-gold/10 shadow-glow'
                       : 'border-teal-700/40 bg-ink-800/70'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-score text-lg text-white truncate">{t.name}</span>
                {leading && <span className="text-[0.7rem] sm:text-xs font-bold text-gold uppercase tracking-wide animate-pulsegold">Leading</span>}
              </div>
              <span className="text-teal-300 text-xs tabular">{t.players_count}/{t.squad_size}</span>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-ink-900 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-teal-400">Remaining <b className="text-white tabular">{fmtPoints(pointsRemaining)}</b></span>
              <span className="text-teal-400">Max safe <b className="text-gold tabular">{fmtPoints(t.max_safe_bid)}</b></span>
            </div>
            <div className="mt-1 text-[0.68rem] text-teal-500 tabular">
              Spent {fmtPoints(pointsSpent)} / Budget {fmtPoints(totalBudget)}
            </div>
          </button>
        )
      })}
    </div>
  )
}
