import { useEffect, useRef, useState } from 'react'

export default function AuctionTimer({
  duration,
  lastBidAt,
  onExpired,
  paused,
  deadlineTs = null,
  pausedRemainingSeconds = null
}) {
  const [remaining, setRemaining] = useState(duration)
  const expiredRef = useRef(false)
  const intervalRef = useRef(null)
  const onExpiredRef = useRef(onExpired)
  onExpiredRef.current = onExpired

  useEffect(() => {
    expiredRef.current = false
    setRemaining(duration)
  }, [lastBidAt, duration])

  useEffect(() => {
    if (!deadlineTs) return
    expiredRef.current = false
    const msRemaining = Math.max(0, new Date(deadlineTs).getTime() - Date.now())
    setRemaining(msRemaining / 1000)
  }, [deadlineTs])

  useEffect(() => {
    if (!paused) return
    if (pausedRemainingSeconds == null) return
    setRemaining(Math.max(0, pausedRemainingSeconds))
  }, [paused, pausedRemainingSeconds])

  useEffect(() => {
    if (paused) {
      clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        const next = deadlineTs
          ? Math.max(0, (new Date(deadlineTs).getTime() - Date.now()) / 1000)
          : prev - 0.1
        if (next <= 0 && !expiredRef.current) {
          expiredRef.current = true
          setTimeout(() => onExpiredRef.current?.(), 0)
          return 0
        }
        return Math.max(0, next)
      })
    }, 100)
    return () => clearInterval(intervalRef.current)
  }, [lastBidAt, paused, duration, deadlineTs])

  const seconds = Math.ceil(remaining)
  const progress = duration > 0 ? remaining / duration : 0
  const isUrgent = remaining <= 3 && remaining > 0
  const showHammer = isUrgent

  const circumference = 2 * Math.PI * 44
  const strokeOffset = circumference * (1 - progress)

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28 sm:h-32 sm:w-32">
        {/* Background ring */}
        <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="rgba(94,234,212,0.15)" strokeWidth="6" />
          <circle
            cx="50" cy="50" r="44" fill="none"
            stroke={isUrgent ? '#ef4444' : remaining <= 5 ? '#f59e0b' : '#14b8a6'}
            strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeOffset}
            className="transition-all duration-100 ease-linear"
          />
        </svg>
        {/* Centre content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showHammer ? (
            <div className="flex flex-col items-center animate-hammerBounce">
              <span className="text-3xl sm:text-4xl">🔨</span>
              <span className={`font-score text-2xl sm:text-3xl font-semibold tabular leading-none mt-1 ${
                seconds === 1 ? 'text-red-400' : seconds === 2 ? 'text-orange-400' : 'text-yellow-400'
              }`}>
                {seconds}
              </span>
            </div>
          ) : (
            <span className={`font-score text-3xl sm:text-4xl font-semibold tabular leading-none ${
              remaining <= 5 ? 'text-amber-400' : 'text-white'
            }`}>
              {seconds}
            </span>
          )}
        </div>
      </div>
      <span className="va-label text-[#93ada6]">
        {remaining <= 0 ? 'Time!' : isUrgent ? 'Going…' : 'Bid clock'}
      </span>

      <style>{`
        @keyframes hammerBounce {
          0%, 100% { transform: rotate(0deg); }
          25% { transform: rotate(-15deg); }
          75% { transform: rotate(15deg); }
        }
        .animate-hammerBounce {
          animation: hammerBounce 0.5s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
