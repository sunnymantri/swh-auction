import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { generateQueue, getQueue, moveQueueItem, startPlayer } from '../lib/api'

export default function QueueManagement() {
  const { auction } = useActiveAuction()
  const [queue, setQueue] = useState([])

  const reload = async () => {
    if (!auction) return
    setQueue(await getQueue(auction.id))
  }
  useEffect(() => { reload() }, [auction])

  const reorder = async (id, direction) => {
    const idx = queue.findIndex((q) => q.id === id)
    const target = queue[idx + direction]
    if (!target) return
    await moveQueueItem(queue[idx].id, target.queue_order)
    await moveQueueItem(target.id, queue[idx].queue_order)
    await reload()
  }

  if (!auction) {
    return (
      <AppShell title="Auction Queue">
        <RoleGate allow={['admin']}>
          <p className="text-teal-400">No auction selected. Create or select one on the Auctions screen.</p>
        </RoleGate>
      </AppShell>
    )
  }

  return (
    <AppShell title="Auction Queue">
      <RoleGate allow={['admin']}>
        <div className="mb-3 flex gap-2">
          <button onClick={async () => { await generateQueue(auction.id); reload() }} className="px-3 py-1 rounded bg-gold text-ink-900 text-sm">Generate Random Queue</button>
        </div>
        <div className="space-y-2">
          {queue.map((q) => (
            <div key={q.id} className="border border-teal-700/40 rounded-lg p-3 flex justify-between items-center bg-ink-800/60">
              <div>
                <p>{q.queue_order}. {q.players?.name}</p>
                <p className="text-xs text-teal-300">{q.status} · {q.category}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => reorder(q.id, -1)} className="px-2 py-1 rounded text-xs bg-teal-700/50">Up</button>
                <button onClick={() => reorder(q.id, 1)} className="px-2 py-1 rounded text-xs bg-teal-700/50">Down</button>
                <button
                  onClick={async () => {
                    if (!window.confirm(`Set "${q.players?.name}" as the current player? This will advance the auction.`)) return
                    await startPlayer(q.player_id)
                    reload()
                  }}
                  className="px-2 py-1 rounded text-xs bg-gold text-ink-900 font-semibold"
                >
                  Set Current
                </button>
              </div>
            </div>
          ))}
        </div>
      </RoleGate>
    </AppShell>
  )
}

