const MAX = 5

const ZONES = [
  { from: 0,   to: 1.2, dim: '#14532d', bright: '#22c55e', label: 'Bargain' },
  { from: 1.2, to: 1.8, dim: '#713f12', bright: '#eab308', label: 'On track' },
  { from: 1.8, to: 3.0, dim: '#7c2d12', bright: '#f97316', label: 'Aggressive' },
  { from: 3.0, to: MAX, dim: '#7f1d1d', bright: '#ef4444', label: 'Overspending' },
]

export function getZoneColor(v) {
  if (v == null) return '#64748b'
  const zone = ZONES.find(z => v >= z.from && v < z.to) ?? ZONES[ZONES.length - 1]
  return zone.bright
}

function vToAngle(v) {
  return Math.PI * (1 - Math.min(Math.max(v, 0), MAX) / MAX)
}

function pt(cx, cy, r, angle) {
  return {
    x: +(cx + r * Math.cos(angle)).toFixed(2),
    y: +(cy - r * Math.sin(angle)).toFixed(2),
  }
}

function arc(cx, cy, r, v1, v2) {
  const a1 = vToAngle(v1)
  const a2 = vToAngle(v2)
  const p1 = pt(cx, cy, r, a1)
  const p2 = pt(cx, cy, r, a2)
  const large = (a1 - a2) > Math.PI ? 1 : 0
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`
}

export default function SpendGauge({ multiplier, benchmark = 1.6, playerCount = 0, compact = false }) {
  const R  = compact ? 56 : 72
  const SW = compact ? 10 : 14
  const cx = compact ? 75 : 95
  const cy = compact ? 68 : 86
  const W  = compact ? 150 : 190
  const H  = compact ? 88  : 108

  const currentZone = multiplier != null
    ? (ZONES.find(z => multiplier >= z.from && multiplier < z.to) ?? ZONES[ZONES.length - 1])
    : null

  const needleAngle  = multiplier != null ? vToAngle(multiplier) : null
  const needleTip    = needleAngle != null ? pt(cx, cy, R * 0.80, needleAngle) : null

  const bAngle = vToAngle(benchmark)
  const bOuter = pt(cx, cy, R + SW * 0.65, bAngle)
  const bInner = pt(cx, cy, R - SW * 0.65, bAngle)

  const color = currentZone?.bright ?? '#64748b'

  return (
    <div className="flex flex-col items-center">
      <svg viewBox={`0 0 ${W} ${H}`} className={compact ? 'w-[128px]' : 'w-[168px]'}>
        {/* Background track */}
        <path d={arc(cx, cy, R, 0, MAX)} fill="none" stroke="#0f1f1f" strokeWidth={SW + 3} strokeLinecap="butt" />

        {/* Dim zone arcs (always visible) */}
        {ZONES.map(z => (
          <path key={z.from} d={arc(cx, cy, R, z.from, z.to)} fill="none" stroke={z.dim} strokeWidth={SW} strokeLinecap="butt" />
        ))}

        {/* Bright highlight: progress up to current value */}
        {multiplier != null && ZONES.map(z => {
          if (multiplier <= z.from) return null
          const to = Math.min(multiplier, z.to)
          return (
            <path key={`h${z.from}`} d={arc(cx, cy, R, z.from, to)} fill="none" stroke={z.bright} strokeWidth={SW} strokeLinecap="butt" opacity="0.9" />
          )
        })}

        {/* Benchmark tick */}
        <line x1={bInner.x} y1={bInner.y} x2={bOuter.x} y2={bOuter.y} stroke="#94a3b8" strokeWidth={compact ? 1.5 : 2} />
        {!compact && (
          <text
            x={+(bOuter.x + (bOuter.x < cx ? -3 : 3)).toFixed(1)}
            y={+(bOuter.y - 2).toFixed(1)}
            textAnchor={bOuter.x < cx ? 'end' : 'start'}
            fill="#64748b" fontSize="7.5"
          >avg</text>
        )}

        {/* Needle */}
        {needleTip && (
          <>
            <line x1={cx} y1={cy} x2={needleTip.x} y2={needleTip.y} stroke={color} strokeWidth={compact ? 2.5 : 3} strokeLinecap="round" />
            <circle cx={cx} cy={cy} r={compact ? 4 : 5} fill={color} />
          </>
        )}

        {/* Value label */}
        <text
          x={cx} y={cy + (compact ? 17 : 21)}
          textAnchor="middle"
          fill="white"
          fontSize={compact ? 14 : 18}
          fontWeight="700"
          fontFamily="ui-monospace, monospace"
        >
          {multiplier != null ? `${multiplier.toFixed(2)}×` : '—'}
        </text>
      </svg>

      <p className={`font-medium ${compact ? 'text-[0.65rem]' : 'text-xs'} -mt-1`} style={{ color }}>
        {currentZone?.label ?? 'No data'}
      </p>

      {playerCount > 0 && (
        <p className={`text-teal-600 ${compact ? 'text-[0.55rem]' : 'text-[0.6rem]'} mt-0.5`}>
          {playerCount} player{playerCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
