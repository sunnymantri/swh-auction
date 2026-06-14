import { fmtPoints } from '../../lib/format'

export default function TeamBudgetGrid({ teams, leaderTeamId, onTeamClick }) {
  return (
    <div className="grid gap-3">
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
            className={`rounded-2xl p-4 border transition text-left w-full ${
              onTeamClick ? 'cursor-pointer hover:border-teal-500/60' : ''} ${
              leading ? 'border-gold/70 bg-gold/10 shadow-glow'
                       : 'border-teal-700/40 bg-ink-800/70'}`}>
            <div className="flex items-center justify-between">
              <span className="font-score text-2xl text-white truncate">{t.name}</span>
              <span className="px-2 py-0.5 rounded-lg bg-ink-900/70 text-teal-200 text-xs tabular">
                {playersCount}/{squadSize} Players
              </span>
            </div>
            <div className="mt-2 text-center">
              <div className="font-score text-5xl text-white tabular leading-tight">{fmtPoints(pointsRemaining)}</div>
              <div className="text-teal-300/90 text-sm tracking-wide uppercase">Remaining budget</div>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-ink-900 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-teal-300">Spent: <b className="text-white tabular">{fmtPoints(pointsSpent)}</b></span>
              <span className="text-teal-300">Max safe bid: <b className="text-gold tabular">{fmtPoints(t.max_safe_bid)}</b></span>
            </div>
            {leading && <p className="mt-2 text-[0.7rem] text-gold uppercase tracking-wider">Highest bidder currently</p>}
          </button>
        )
      })}
    </div>
  )
}
