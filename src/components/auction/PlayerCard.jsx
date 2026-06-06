import { fmtPoints } from '../../lib/format'

const initials = (n = '') => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-score text-2xl leading-none tabular text-white">{value}</div>
      <div className="text-teal-400/80 text-[0.62rem] uppercase tracking-wider mt-1">{label}</div>
    </div>
  )
}

export default function PlayerCard({ player }) {
  if (!player) {
    return (
      <div className="rounded-2xl bg-ink-800/70 border border-teal-700/40 p-10 text-center text-teal-400">
        No player on the block. Press <span className="text-gold font-semibold">Start</span> to begin.
      </div>
    )
  }
  return (
    <div className="rounded-2xl bg-ink-800/80 border border-teal-700/50 shadow-card overflow-hidden animate-rise">
      <div className="flex items-center gap-5 p-6 bg-gradient-to-r from-teal-900 to-ink-800">
        <div className="h-24 w-24 shrink-0 rounded-xl overflow-hidden bg-teal-700/50 grid place-items-center">
          {player.photo_url
            ? <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
            : <span className="font-score text-3xl text-teal-300">{initials(player.name)}</span>}
        </div>
        <div className="min-w-0">
          <h2 className="font-score text-4xl leading-none text-white truncate">{player.name}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2.5 py-0.5 rounded-full bg-gold/15 text-gold text-xs font-semibold">{player.role}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-teal-600/30 text-teal-200 text-xs">{player.category}</span>
            {player.batting_style && <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-teal-200 text-xs">{player.batting_style}</span>}
            {player.bowling_style && <span className="px-2.5 py-0.5 rounded-full bg-white/5 text-teal-200 text-xs">{player.bowling_style}</span>}
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className="text-teal-400 text-[0.62rem] uppercase tracking-wider">Base</div>
          <div className="font-score text-2xl text-gold tabular">{fmtPoints(player.base_price)}</div>
        </div>
      </div>
      <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 px-6 py-5 stat-grid">
        <Stat label="Matches" value={player.matches ?? '—'} />
        <Stat label="Runs" value={player.runs != null ? fmtPoints(player.runs) : '—'} />
        <Stat label="Bat Avg" value={player.bat_avg ?? '—'} />
        <Stat label="Bat SR" value={player.strike_rate ?? '—'} />
        <Stat label="Wickets" value={player.wickets ?? '—'} />
        <Stat label="Bowl Avg" value={player.bowl_avg ?? '—'} />
        <Stat label="Econ" value={player.economy ?? '—'} />
      </div>
      {player.profile_url && (
        <div className="px-6 pb-4">
          <a
            href={player.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 hover:text-teal-200 text-xs underline underline-offset-2"
          >
            View CricHeroes profile ↗
          </a>
        </div>
      )}
    </div>
  )
}
