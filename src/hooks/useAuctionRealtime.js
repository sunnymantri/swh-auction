import { useEffect, useRef } from 'react'
import { subscribeToAuction } from '../lib/api'

// Calls reload() (debounced) whenever any auction table changes.
export function useAuctionRealtime(auctionId, reload) {
  const timer = useRef(null)
  useEffect(() => {
    if (!auctionId) return
    const debounced = () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(reload, 150)
    }
    const unsub = subscribeToAuction(auctionId, debounced)
    return () => { clearTimeout(timer.current); unsub() }
  }, [auctionId, reload])
}
