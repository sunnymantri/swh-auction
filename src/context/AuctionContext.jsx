import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { listAuctions } from '../lib/api'

const AuctionCtx = createContext(null)
export const useAuctionContext = () => useContext(AuctionCtx)

const STORAGE_KEY = 'ca.selectedAuctionId'

// Holds the list of auctions and which one is "selected" across the app.
// Selection persists in localStorage so admins can switch auctions and have
// every screen follow along. Falls back to the most recent live/active one.
export function AuctionProvider({ children }) {
  const [auctions, setAuctions] = useState([])
  const [selectedId, setSelectedId] = useState(() => localStorage.getItem(STORAGE_KEY) || null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    // Hard-timeout: if the Supabase project is cold-starting (free tier) or
    // the network is slow, don't block the UI indefinitely.
    let timeoutId
    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Auction list timed out — retrying shortly.')),
        10000
      )
    })

    try {
      const list = await Promise.race([listAuctions(), timeout])
      clearTimeout(timeoutId)
      setAuctions(list)
      setSelectedId((prev) => {
        if (prev && list.some((a) => a.id === prev)) return prev
        const preferred =
          list.find((a) => a.status === 'live') ||
          list.find((a) => ['paused', 'draft'].includes(a.status)) ||
          list[0]
        return preferred?.id ?? null
      })
    } catch (e) {
      clearTimeout(timeoutId)
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { reload() }, [reload])

  useEffect(() => {
    if (selectedId) localStorage.setItem(STORAGE_KEY, selectedId)
  }, [selectedId])

  const selectAuction = useCallback((id) => setSelectedId(id), [])

  const auction = useMemo(
    () => auctions.find((a) => a.id === selectedId) ?? null,
    [auctions, selectedId]
  )

  const value = {
    auctions,
    auction,
    auctionId: selectedId,
    selectAuction,
    loading,
    error,
    reload
  }
  return <AuctionCtx.Provider value={value}>{children}</AuctionCtx.Provider>
}
