import { useEffect, useRef } from 'react'
import { fmtPoints } from '../../lib/format'

// ─── Firework particle colours ───────────────────────────────────────────────
const COLOURS = [
  '#FFD700', '#FF6B35', '#00CED1', '#FF1493', '#7FFF00',
  '#FF4500', '#00FFFF', '#FF69B4', '#ADFF2F', '#FFA500',
]

// Generate N particles with random angles, distances and colours
function makeParticles(n = 60) {
  return Array.from({ length: n }, (_, i) => {
    const angle = (i / n) * 360 + Math.random() * (360 / n)
    const dist = 80 + Math.random() * 180      // px
    const rad = (angle * Math.PI) / 180
    const x = Math.cos(rad) * dist
    const y = Math.sin(rad) * dist
    const size = 4 + Math.random() * 6
    const delay = Math.random() * 0.4           // staggered burst
    const colour = COLOURS[Math.floor(Math.random() * COLOURS.length)]
    return { x, y, size, delay, colour }
  })
}

// Two bursts — one per side
const LEFT_PARTICLES  = makeParticles(50)
const RIGHT_PARTICLES = makeParticles(50)
const TOP_PARTICLES   = makeParticles(40)

export default function SoldCelebration({ player, soldPrice, teamName, teamLogo, onDone }) {
  const audioRef = useRef(null)

  // Play audio + auto-dismiss after 5 s
  useEffect(() => {
    try {
      audioRef.current = new Audio('/fireworks.mp3')
      audioRef.current.volume = 0.8
      audioRef.current.play().catch(() => {/* autoplay blocked — silent */})
    } catch (_) {}
    const t = setTimeout(onDone, 5200)
    return () => {
      clearTimeout(t)
      try { audioRef.current?.pause() } catch (_) {}
    }
  }, [onDone])

  const initials = (n = '') => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer"
      onClick={onDone}
      style={{ animation: 'fadeIn 0.3s ease' }}
    >
      {/* ── Burst: top-left ────────────────────────────────────── */}
      <Burst particles={LEFT_PARTICLES} originX="15%" originY="20%" />
      {/* ── Burst: top-right ───────────────────────────────────── */}
      <Burst particles={RIGHT_PARTICLES} originX="85%" originY="15%" />
      {/* ── Burst: top-centre ──────────────────────────────────── */}
      <Burst particles={TOP_PARTICLES} originX="50%" originY="10%" />

      {/* ── Centre card ────────────────────────────────────────── */}
      <div
        className="relative flex flex-col items-center gap-4 p-8 rounded-3xl border border-gold/60 bg-ink-900/95 shadow-2xl max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'celebrationPop 0.5s cubic-bezier(.175,.885,.32,1.275)' }}
      >
        {/* SOLD stamp ribbon */}
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1 rounded-full bg-gold text-ink-900 font-score text-xl tracking-widest shadow-lg"
          style={{ animation: 'stampIn 0.6s 0.2s cubic-bezier(.175,.885,.32,1.275) both' }}>
          ✓ SOLD
        </div>

        {/* Player photo */}
        <div className="mt-4 h-28 w-28 rounded-full overflow-hidden border-4 border-gold shadow-gold-glow bg-teal-800/60 grid place-items-center"
          style={{ boxShadow: '0 0 32px 8px rgba(255,215,0,0.45)' }}>
          {player?.photo_url
            ? <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
            : <span className="font-score text-4xl text-teal-200">{initials(player?.name)}</span>}
        </div>

        {/* Player name */}
        <p className="font-score text-3xl text-white text-center leading-tight">{player?.name}</p>

        {/* Sold price */}
        <div className="text-center">
          <p className="text-teal-400 text-xs uppercase tracking-widest">Sold for</p>
          <p className="font-score text-5xl text-gold tabular leading-none"
            style={{ animation: 'countUp 0.4s 0.3s ease both', textShadow: '0 0 20px rgba(255,215,0,0.6)' }}>
            {fmtPoints(soldPrice)}
          </p>
        </div>

        {/* Winning team */}
        <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-teal-900/60 border border-teal-600/40">
          {teamLogo
            ? <img src={teamLogo} alt="" className="h-8 w-8 rounded object-cover" />
            : <div className="h-8 w-8 rounded bg-teal-700 grid place-items-center text-xs font-bold text-white">
                {initials(teamName)}
              </div>}
          <p className="font-score text-xl text-teal-100">{teamName}</p>
        </div>

        <p className="text-xs text-teal-500 mt-1">Tap anywhere to continue</p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes celebrationPop {
          from { transform: scale(0.5); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
        @keyframes stampIn {
          from { transform: translateX(-50%) scale(0); opacity: 0 }
          to   { transform: translateX(-50%) scale(1); opacity: 1 }
        }
        @keyframes countUp {
          from { transform: scale(0.6); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
        @keyframes particle {
          0%   { transform: translate(0,0) scale(1); opacity: 1 }
          80%  { opacity: 0.8 }
          100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0 }
        }
      `}</style>
    </div>
  )
}

function Burst({ particles, originX, originY }) {
  return (
    <div className="absolute pointer-events-none" style={{ left: originX, top: originY, transform: 'translate(-50%,-50%)' }}>
      {particles.map((p, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            borderRadius: Math.random() > 0.5 ? '50%' : '2px',
            background: p.colour,
            '--tx': `${p.x}px`,
            '--ty': `${p.y}px`,
            animation: `particle 1.4s ${p.delay}s cubic-bezier(.25,.46,.45,.94) both`,
          }}
        />
      ))}
    </div>
  )
}
