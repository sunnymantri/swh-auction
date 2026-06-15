import { fmtPoints } from '../../lib/format'

export default function TeamBudgetGrid({ teams, leaderTeamId, onTeamClick }) {
  return (
    <div className="grid gap-2">
      {teams.map(t => {
        const leading = t.id === leaderTeamId
        const totalBudget = Number(t.total_budget || 0)
        const pointsSpent = Number(t.points_spent || 0)
        const pointsRemaining = Number(t.points_remaining || 0)
        const playersCount = Number(t.players_count || 0)
        const squadSize = Number(t.squad_size || 0)
        const pct = totalBudget > 0
          ? Math.max(0, Math.min(100, (pointsRemaining / totalBudget) * 100))
          : 0
        return (
          <button key={t.id} type="button"
            onClick={() => onTeamClick?.(t.id)}
            className={`rounded-xl p-3 border transition text-left w-full ${
              onTeamClick ? 'cursor-pointer hover:border-teal-500/60' : ''} ${
              leading ? 'border-gold/70 bg-gold/10 shadow-glow'
                       : 'border-teal-700/40 bg-ink-800/70'}`}>
            <div className="flex items-center justify-between">
              <span className="font-score text-xl text-white truncate">{t.name}</span>
              <span className="px-2 py-0.5 rounded-lg bg-ink-900/70 text-teal-200 text-[0.7rem] tabular">
                {playersCount}/{squadSize} Players
              </span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div>
                <div className="text-[0.65rem] text-teal-400 uppercase tracking-wide">Remaining</div>
                <div className="font-score text-3xl text-white tabular leading-tight">{fmtPoints(pointsRemaining)}</div>
              </div>
              <div className="text-right">
                <div className="text-[0.65rem] text-teal-400 uppercase tracking-wide">Max safe</div>
                <div className="font-score text-xl text-gold tabular leading-tight">{fmtPoints(t.max_safe_bid)}</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-ink-900 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex justify-between text-xs">
              <span className="text-teal-300">Spent: <b className="text-white tabular">{fmtPoints(pointsSpent)}</b></span>
              <span className="text-teal-500">Budget: <b className="text-teal-300 tabular">{fmtPoints(totalBudget)}</b></span>
            </div>
            {leading && <p className="mt-1 text-[0.62rem] text-gold uppercase tracking-wider">Highest bidder currently</p>}
          </button>
        )
      })}
    </div>
  )
}
