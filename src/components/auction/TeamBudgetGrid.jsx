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
              <span className="va-card-title text-white truncate">{t.name}</span>
              <span className="va-micro rounded-lg bg-ink-900/70 px-2 py-0.5 text-teal-200 tabular">
                {playersCount}/{squadSize} Players
              </span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div>
                <div className="va-label text-teal-400">Remaining</div>
                <div className="text-3xl font-semibold text-white tabular leading-tight">{fmtPoints(pointsRemaining)}</div>
              </div>
              <div className="text-right">
                <div className="va-label text-teal-400">Max safe</div>
                <div className="va-card-title text-gold tabular leading-tight">{fmtPoints(t.max_safe_bid)}</div>
              </div>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-ink-900 overflow-hidden">
              <div className="h-full rounded-full bg-teal-500" style={{ width: `${pct}%` }} />
            </div>
            <div className="va-micro mt-2 flex justify-between">
              <span className="text-teal-300">Spent: <b className="text-white tabular">{fmtPoints(pointsSpent)}</b></span>
              <span className="text-teal-500">Budget: <b className="text-teal-300 tabular">{fmtPoints(totalBudget)}</b></span>
            </div>
            {leading && <p className="va-micro mt-1 uppercase tracking-[0.16em] text-gold">Highest bidder currently</p>}
          </button>
        )
      })}
    </div>
  )
}
