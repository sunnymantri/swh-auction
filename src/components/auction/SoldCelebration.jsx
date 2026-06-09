import { useEffect, useRef, useCallback } from 'react'
import { fmtPoints } from '../../lib/format'

// ─── Fireworks canvas simulation ─────────────────────────────────────────────
const COLOURS = [
  '#FFD700', '#FF6B35', '#FF1493', '#00CED1', '#7FFF00',
  '#FF4500', '#00FFFF', '#FF69B4', '#ADFF2F', '#FFA500',
  '#DA70D6', '#40E0D0', '#FF6347', '#FFE4B5', '#98FB98',
]

function randomColour() { return COLOURS[Math.floor(Math.random() * COLOURS.length)] }

class Particle {
  constructor(x, y, colour) {
    this.x = x
    this.y = y
    this.colour = colour
    const angle = Math.random() * Math.PI * 2
    const speed = 1.5 + Math.random() * 5
    this.vx = Math.cos(angle) * speed
    this.vy = Math.sin(angle) * speed
    this.alpha = 1
    this.decay = 0.012 + Math.random() * 0.014
    this.gravity = 0.08
    this.radius = 2 + Math.random() * 3
    this.trail = []
  }
  update() {
    this.trail.push({ x: this.x, y: this.y, alpha: this.alpha })
    if (this.trail.length > 6) this.trail.shift()
    this.vx *= 0.98
    this.vy *= 0.98
    this.vy += this.gravity
    this.x += this.vx
    this.y += this.vy
    this.alpha -= this.decay
  }
  draw(ctx) {
    // trail
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i]
      const ratio = i / this.trail.length
      ctx.beginPath()
      ctx.arc(t.x, t.y, this.radius * ratio * 0.6, 0, Math.PI * 2)
      ctx.fillStyle = this.colour
      ctx.globalAlpha = t.alpha * ratio * 0.4
      ctx.fill()
    }
    // core
    ctx.beginPath()
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2)
    ctx.fillStyle = this.colour
    ctx.globalAlpha = this.alpha
    ctx.fill()
    ctx.globalAlpha = 1
  }
  isDead() { return this.alpha <= 0 }
}

class Rocket {
  constructor(canvasW, canvasH) {
    this.x = canvasW * (0.1 + Math.random() * 0.8)
    this.y = canvasH
    this.targetY = canvasH * (0.1 + Math.random() * 0.45)
    this.vy = -12 - Math.random() * 6
    this.colour = randomColour()
    this.exploded = false
    this.alpha = 1
    this.trail = []
  }
  update() {
    this.trail.push({ x: this.x, y: this.y })
    if (this.trail.length > 10) this.trail.shift()
    this.vy += 0.18          // gravity slows rocket
    this.y += this.vy
    if (this.vy >= 0 || this.y <= this.targetY) {
      this.exploded = true
    }
  }
  draw(ctx) {
    for (let i = 0; i < this.trail.length; i++) {
      const t = this.trail[i]
      const ratio = i / this.trail.length
      ctx.beginPath()
      ctx.arc(t.x, t.y, 2 * ratio, 0, Math.PI * 2)
      ctx.fillStyle = this.colour
      ctx.globalAlpha = ratio * 0.6
      ctx.fill()
    }
    ctx.beginPath()
    ctx.arc(this.x, this.y, 3, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 1
    ctx.fill()
    ctx.globalAlpha = 1
  }
  burst(particleList) {
    const count = 80 + Math.floor(Math.random() * 60)
    for (let i = 0; i < count; i++) {
      particleList.push(new Particle(this.x, this.y, randomColour()))
    }
    // golden ring
    for (let i = 0; i < 24; i++) {
      const p = new Particle(this.x, this.y, '#FFD700')
      const angle = (i / 24) * Math.PI * 2
      const speed = 4 + Math.random() * 2
      p.vx = Math.cos(angle) * speed
      p.vy = Math.sin(angle) * speed
      p.radius = 1.5
      particleList.push(p)
    }
  }
}

function useFireworksCanvas(canvasRef, active) {
  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    let rockets = []
    let particles = []
    let frame = 0
    let raf

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // Launch schedule: rockets at frames 0, 18, 36, 55, 70, 90, 110, 130
    const LAUNCH_FRAMES = [0, 18, 36, 55, 70, 90, 110, 130, 155, 175]

    const loop = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Launch new rockets on schedule
      if (LAUNCH_FRAMES.includes(frame)) {
        rockets.push(new Rocket(canvas.width, canvas.height))
        // pair launch for big moments
        if (frame === 0 || frame === 55 || frame === 130) {
          rockets.push(new Rocket(canvas.width, canvas.height))
        }
      }

      // Update & draw rockets
      rockets = rockets.filter(r => {
        r.update()
        r.draw(ctx)
        if (r.exploded) {
          r.burst(particles)
          return false
        }
        return true
      })

      // Update & draw particles
      particles = particles.filter(p => {
        p.update()
        p.draw(ctx)
        return !p.isDead()
      })

      frame++
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [active, canvasRef])
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function SoldCelebration({ player, soldPrice, teamName, teamLogo, onDone }) {
  const audioRef  = useRef(null)
  const canvasRef = useRef(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  // stable callback so the canvas effect doesn't re-run when parent re-renders
  const stableOnDone = useCallback(() => onDoneRef.current(), [])

  // Audio + auto-dismiss
  useEffect(() => {
    try {
      audioRef.current = new Audio('/fireworks.mp3')
      audioRef.current.volume = 0.85
      audioRef.current.play().catch(() => {})
    } catch (_) {}
    const t = setTimeout(stableOnDone, 6000)
    return () => {
      clearTimeout(t)
      try { audioRef.current?.pause() } catch (_) {}
    }
  }, [stableOnDone])

  useFireworksCanvas(canvasRef, true)

  const initials = (n = '') => n.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center cursor-pointer"
      style={{ background: 'rgba(0,0,0,0.82)' }}
      onClick={stableOnDone}
    >
      {/* ── Canvas fireworks (full screen, behind card) ──────────── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ width: '100%', height: '100%' }}
      />

      {/* ── Centre card ──────────────────────────────────────────── */}
      <div
        className="relative z-10 flex flex-col items-center gap-4 p-8 rounded-3xl border border-gold/60 bg-black/80 shadow-2xl max-w-sm w-full mx-4"
        onClick={e => e.stopPropagation()}
        style={{ animation: 'celebPop 0.55s cubic-bezier(.175,.885,.32,1.275) both' }}
      >
        {/* SOLD stamp */}
        <div
          className="absolute -top-5 left-1/2 px-7 py-1.5 rounded-full bg-gold text-ink-900 font-score text-2xl tracking-widest shadow-xl"
          style={{
            transform: 'translateX(-50%)',
            animation: 'stampIn 0.5s 0.25s cubic-bezier(.175,.885,.32,1.275) both',
            boxShadow: '0 0 24px 4px rgba(255,215,0,0.6)',
          }}
        >
          ✓ SOLD
        </div>

        {/* Player photo */}
        <div
          className="mt-5 h-32 w-32 rounded-full overflow-hidden border-4 border-gold bg-teal-800/60 grid place-items-center shrink-0"
          style={{ boxShadow: '0 0 40px 12px rgba(255,215,0,0.5)', animation: 'photoPop 0.5s 0.1s cubic-bezier(.175,.885,.32,1.275) both' }}
        >
          {player?.photo_url
            ? <img src={player.photo_url} alt={player.name} className="h-full w-full object-cover" />
            : <span className="font-score text-4xl text-teal-200">{initials(player?.name)}</span>}
        </div>

        {/* Player name */}
        <p className="font-score text-3xl text-white text-center leading-tight drop-shadow-lg">
          {player?.name}
        </p>

        {/* Sold price */}
        <div className="text-center">
          <p className="text-teal-400 text-xs uppercase tracking-widest mb-1">Sold for</p>
          <p
            className="font-score text-6xl text-gold tabular leading-none"
            style={{
              animation: 'priceIn 0.45s 0.35s cubic-bezier(.175,.885,.32,1.275) both',
              textShadow: '0 0 30px rgba(255,215,0,0.8), 0 0 60px rgba(255,215,0,0.4)',
            }}
          >
            {fmtPoints(soldPrice)}
          </p>
        </div>

        {/* Winning team */}
        <div
          className="flex items-center gap-3 px-5 py-2.5 rounded-xl bg-teal-900/70 border border-teal-500/50"
          style={{ animation: 'priceIn 0.4s 0.5s ease both' }}
        >
          {teamLogo
            ? <img src={teamLogo} alt="" className="h-9 w-9 rounded-lg object-cover shadow" />
            : <div className="h-9 w-9 rounded-lg bg-teal-700 grid place-items-center text-sm font-bold text-white shrink-0">
                {initials(teamName)}
              </div>}
          <p className="font-score text-2xl text-teal-100">{teamName}</p>
        </div>

        <p className="text-xs text-teal-500">Tap anywhere to continue</p>
      </div>

      <style>{`
        @keyframes celebPop {
          from { transform: scale(0.4) translateY(40px); opacity: 0 }
          to   { transform: scale(1)   translateY(0);    opacity: 1 }
        }
        @keyframes stampIn {
          from { transform: translateX(-50%) scale(0) rotate(-15deg); opacity: 0 }
          to   { transform: translateX(-50%) scale(1) rotate(0deg);   opacity: 1 }
        }
        @keyframes photoPop {
          from { transform: scale(0.5); opacity: 0 }
          to   { transform: scale(1);   opacity: 1 }
        }
        @keyframes priceIn {
          from { transform: scale(0.5) translateY(10px); opacity: 0 }
          to   { transform: scale(1)   translateY(0);    opacity: 1 }
        }
      `}</style>
    </div>
  )
}
