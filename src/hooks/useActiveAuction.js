import { useAuctionContext } from '../context/AuctionContext'

// Backwards-compatible hook: returns the currently SELECTED auction from the
// AuctionContext (persisted, multi-auction aware) instead of always grabbing
// the most recent one. Existing screens keep working unchanged.
export function useActiveAuction() {
  const { auction, loading, error, reload } = useAuctionContext()
  return { auction, loading, error, reload }
}
