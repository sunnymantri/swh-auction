import { useCallback, useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { useAuctionRealtime } from '../hooks/useAuctionRealtime'
import { getBidsForPlayer, getCurrentQueueItem, getRecentEvents, listTeamSummaries } from '../lib/api'
import { fmtPoints } from '../lib/format'
import PlayerCard from '../components/auction/PlayerCard'
import ActivityFeed from '../components/auction/ActivityFeed'

export default function PublicLiveView() {
  const { auction, loading: auctionLoading, error: auctionError, reload: reloadAuction } = useActiveAuction()
  const [current, setCurrent] = useState(null)
  const [teams, setTeams] = useState([])
  const [events, setEvents] = useState([])
  const [bids, setBids] = useState([])

  const reload = useCallback(async () => {
    if (!auction) return
    const [cur, t, e] = await Promise.all([
      getCurrentQueueItem(auction.id),
      listTeamSummaries(auction.id),
      getRecentEvents(auction.id, 20)
    ])
    setCurrent(cur)
    setTeams(t)
    setEvents(e)
    setBids(cur?.player_id ? await getBidsForPlayer(cur.player_id) : [])
  }, [auction])

  useEffect(() => { reload() }, [reload])
  useAuctionRealtime(auction?.id, reload)

  const top = bids.reduce((m, b) => (b.bid_amount > (m?.bid_amount ?? -1) ? b : m), null)

  if (auctionLoading) {
    return (
      <AppShell title="Public Live View">
        <p className="text-teal-400 animate-pulse">Loading auction…</p>
      </AppShell>
    )
  }

  if (auctionError) {
    return (
      <AppShell title="Public Live View">
        <div className="text-center py-12 space-y-3">
          <p className="text-live text-sm">{auctionError}</p>
          <button
            onClick={reloadAuction}
            className="px-4 py-2 rounded-lg border border-teal-700/40 text-teal-300 hover:text-white text-sm transition"
          >
            Retry
          </button>
        </div>
      </AppShell>
    )
  }

  if (!auction) {
    return (
      <AppShell title="Public Live View">
        <p className="text-teal-400">No live auction right now.</p>
      </AppShell>
    )
  }

  return (
    <AppShell title="Public Live View">
      <div className="grid lg:grid-cols-[1fr_22rem] gap-4">
        <div className="space-y-4">
          <PlayerCard player={current?.players} />
          <div key={top?.bid_amount ?? 0} className="rounded-xl border border-gold/30 bg-gradient-to-r from-teal-900 to-ink-900 p-5 animate-bidflash">
            <p className="text-xs text-teal-300 uppercase">Current Bid</p>
            <p className="font-score text-6xl text-gold tabular">{fmtPoints(top?.bid_amount ?? 0)}</p>
            <p className="text-sm text-teal-100">Highest bidder: {top?.teams?.name || '—'}</p>
          </div>
          <div className="grid md:grid-cols-2 gap-2">
            {teams.map((t) => (
              <div key={t.id} className="rounded-lg border border-teal-700/40 bg-ink-800/60 p-3 flex items-center gap-2">
                {t.logo_url && <img src={t.logo_url} alt="" className="h-8 w-8 rounded object-cover" />}
                <div>
                  <p className="text-white">{t.name}</p>
                  <p className="text-xs text-teal-300">Remaining {fmtPoints(t.points_remaining)} · Players {t.players_count}/{t.squad_size}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <ActivityFeed events={events} />
      </div>
    </AppShell>
  )
}
