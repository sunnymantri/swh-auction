import { fmtPoints } from '../../lib/format'
import { calcBattingPoints, calcBowlingPoints, calcFieldingPoints, calcTotalPoints, calcPPM, getTier } from '../../lib/points'

const initials = (n = '') => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

function Stat({ label, value }) {
  return (
    <div className="text-center">
      <div className="font-score text-2xl font-semibold leading-none tabular text-white">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#93ada6]">{label}</div>
    </div>
  )
}

const extractCricHeroesProfileId = (url = '') => {
  const match = String(url).match(/player-profile\/(\d+)/i)
  return match?.[1] || null
}

function PointsBreakdown({
  player,
  onRecalculate,
  recalculating,
  onFetchAndRecalculate,
  fetchingAndRecalculating,
  tierOverride
}) {
  const batting = calcBattingPoints(player)
  const bowling = calcBowlingPoints(player)
  const fielding = calcFieldingPoints(player)
  const total = calcTotalPoints(player)
  const ppm = calcPPM(player)
  const tier = tierOverride || getTier(ppm)

  return (
      <div className="bg-black/10 px-4 py-4 sm:px-6 border-t victory-divider">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f5f2e8]">Performance Points</h4>
        <div className="flex items-center gap-2">
          {onFetchAndRecalculate && (
            <button
              onClick={onFetchAndRecalculate}
              disabled={fetchingAndRecalculating || recalculating}
              className="px-3 py-1 text-xs rounded-lg bg-gold/80 text-ink-900 font-semibold hover:bg-gold disabled:opacity-50 transition"
            >
              {fetchingAndRecalculating ? 'Fetching…' : 'Fetch + Recalculate'}
            </button>
          )}
          {onRecalculate && (
            <button
              onClick={onRecalculate}
              disabled={recalculating || fetchingAndRecalculating}
              className="px-3 py-1 text-xs rounded-lg bg-[#1a5c54]/80 text-white font-medium hover:bg-[#227369]/80 disabled:opacity-50 transition"
            >
              {recalculating ? 'Calculating…' : 'Recalculate'}
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="rounded-xl border border-gold/10 bg-black/10 p-2.5 text-center">
          <div className="font-score text-lg font-semibold text-white tabular">{batting.toFixed(0)}</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[#93ada6]">Batting</div>
        </div>
        <div className="rounded-xl border border-gold/10 bg-black/10 p-2.5 text-center">
          <div className="font-score text-lg font-semibold text-white tabular">{bowling.toFixed(0)}</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[#93ada6]">Bowling</div>
        </div>
        <div className="rounded-xl border border-gold/10 bg-black/10 p-2.5 text-center">
          <div className="font-score text-lg font-semibold text-white tabular">{fielding.toFixed(0)}</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[#93ada6]">Fielding</div>
        </div>
        <div className="rounded-xl border border-gold/10 bg-black/10 p-2.5 text-center">
          <div className="font-score text-lg font-semibold text-white tabular">{total.toFixed(0)}</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[#93ada6]">Total</div>
        </div>
        <div className={`rounded-xl border p-2.5 text-center ${tier.label === 'Platinum' ? 'bg-white/5 border-white/10' : tier.label === 'Gold' ? 'bg-gold/12 border-gold/20' : tier.label === 'Silver' ? 'bg-white/5 border-white/10' : 'bg-amber-900/20 border-amber-700/30'}`}>
          <div className={`font-score text-lg font-semibold tabular ${tier.color}`}>{ppm.toFixed(1)}</div>
          <div className="mt-0.5 text-xs uppercase tracking-[0.16em] text-[#93ada6]">PPM · {tier.label}</div>
        </div>
      </div>
    </div>
  )
}

export default function PlayerCard({
  player,
  showPoints = false,
  onRecalculate,
  recalculating,
  onFetchAndRecalculate,
  fetchingAndRecalculating,
  tierOverride
}) {
  const profileId = extractCricHeroesProfileId(player?.profile_url)
  if (!player) {
    return (
      <div className="victory-panel rounded-2xl p-10 text-center text-[#93ada6]">
        No player on the block. Press <span className="text-gold font-semibold">Start</span> to begin.
      </div>
    )
  }
  return (
    <div className="victory-panel animate-rise overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 bg-[linear-gradient(135deg,rgba(21,48,41,0.92),rgba(16,37,32,0.98))] p-4 sm:flex-row sm:items-center sm:gap-5 sm:p-6">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-gold/15 bg-black/20 sm:h-24 sm:w-24">
          {player.photo_url
            ? <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
            : <span className="font-score text-3xl text-[#c0dad3]">{initials(player.name)}</span>}
        </div>
        <div className="min-w-0">
          <h2 className="font-score text-3xl sm:text-4xl font-semibold leading-none text-white break-words">{player.name}</h2>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="rounded-full bg-gold/15 px-2.5 py-0.5 text-xs font-semibold text-gold">{player.role}</span>
            <span className="rounded-full bg-[#1a5c54]/30 px-2.5 py-0.5 text-xs text-[#c0dad3]">{player.category}</span>
            {player.batting_style && <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-[#c0dad3]">{player.batting_style}</span>}
            {player.bowling_style && <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs text-[#c0dad3]">{player.bowling_style}</span>}
            {player.weeks_away > 0 && (
              <span className="rounded-full border border-gold/25 bg-gold/10 px-2.5 py-0.5 text-xs font-semibold text-gold-soft">
                Away {player.weeks_away}w
              </span>
            )}
          </div>
        </div>
        <div className="sm:ml-auto sm:text-right">
          <div className="text-xs uppercase tracking-[0.16em] text-[#93ada6]">Base</div>
          <div className="font-score text-2xl font-semibold text-gold tabular">{fmtPoints(player.base_price)}</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 px-4 sm:px-6 py-5 stat-grid">
        <Stat label="Matches" value={player.matches ?? '—'} />
        <Stat label="Runs" value={player.runs != null ? fmtPoints(player.runs) : '—'} />
        <Stat label="Bat Avg" value={player.bat_avg ?? '—'} />
        <Stat label="Bat SR" value={player.strike_rate ?? '—'} />
        <Stat label="Wickets" value={player.wickets ?? '—'} />
        <Stat label="Bowl Avg" value={player.bowl_avg ?? '—'} />
        <Stat label="Econ" value={player.economy ?? '—'} />
      </div>
      {showPoints && player.matches > 0 && (
        <PointsBreakdown
          player={player}
          onRecalculate={onRecalculate}
          recalculating={recalculating}
          onFetchAndRecalculate={onFetchAndRecalculate}
          fetchingAndRecalculating={fetchingAndRecalculating}
          tierOverride={tierOverride}
        />
      )}
      {Array.isArray(player.vacation_dates) && player.vacation_dates.length > 0 && (
        <div className="px-4 sm:px-6 py-4 border-t victory-divider">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold">Unavailable Sundays</h4>
          <div className="flex flex-wrap gap-1.5">
            {player.vacation_dates.map((date) => (
              <span key={date} className="rounded-full border border-gold/20 bg-gold/10 px-2.5 py-1 text-xs text-gold-soft">
                {new Date(date + 'T00:00:00').toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })}
              </span>
            ))}
          </div>
        </div>
      )}
      <div className="px-6 pb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs text-[#c0dad3]">CricHeroes ID: <b className="text-white">{profileId || '—'}</b></span>
        {player.profile_url && (
          <a
            href={player.profile_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#93ada6] underline underline-offset-2 hover:text-[#c0dad3]"
          >
            View CricHeroes profile ↗
          </a>
        )}
      </div>
    </div>
  )
}
