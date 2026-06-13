import { useEffect, useRef, useState } from 'react'

// Derives a one-shot "player sold" celebration from the auction event stream,
// independent of which player is currently on the block. This lets every
// screen (auctioneer, public, team owners) fire the same SoldCelebration the
// moment a sale is recorded — including after the auctioneer has moved on to
// the next player.
//
//   events: rows from getRecentEvents() (newest first), each sold row joined
//           with players(name, photo_url) and teams(name, logo_url).
//
// Returns { celebration, dismiss }. `celebration` is null until an unseen
// sold event arrives; render <SoldCelebration {...celebration} onDone={dismiss}/>.
// The first batch of events after mount/login is treated as already-seen so a
// stale sale doesn't replay every time the screen loads.
export function useSoldCelebration(events) {
  const [celebration, setCelebration] = useState(null)
  const [seenEventId, setSeenEventId] = useState(null)
  const initializedRef = useRef(false)

  const latestSold = Array.isArray(events)
    ? events.find((e) => e.event_type === 'sold')
    : null

  useEffect(() => {
    if (!latestSold) return

    // First load: remember the latest sale without celebrating it.
    if (!initializedRef.current) {
      initializedRef.current = true
      setSeenEventId(latestSold.id)
      return
    }

    if (latestSold.id === seenEventId) return

    setCelebration({
      player: {
        name: latestSold.players?.name,
        photo_url: latestSold.players?.photo_url ?? null,
      },
      soldPrice: latestSold.amount,
      teamName: latestSold.teams?.name ?? 'Unknown',
      teamLogo: latestSold.teams?.logo_url ?? null,
    })
    setSeenEventId(latestSold.id)
  }, [latestSold, seenEventId])

  return { celebration, dismiss: () => setCelebration(null) }
}
