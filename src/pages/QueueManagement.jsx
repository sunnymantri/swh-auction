import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { generateQueue, getQueue, moveQueueItem, startPlayer, getUnsoldOrReauction } from '../lib/api'

const TABS = ['Queue', 'Unsold / Re-auction']

export default function QueueManagement() {
  const { auction } = useActiveAuction()
  const [tab, setTab] = useState('Queue')
  const [queue, setQueue] = useState([])
  const [unsold, setUnsold] = useState([])

  const reloadQueue = async () => {
    if (!auction) return
    setQueue(await getQueue(auction.id))
  }
  const reloadUnsold = async () => {
    if (!auction) return
    setUnsold(await getUnsoldOrReauction(auction.id))
  }
  useEffect(() => { reloadQueue(); reloadUnsold() }, [auction])

  const reorder = async (id, direction) => {
    const idx = queue.findIndex((q) => q.id === id)
    const target = queue[idx + direction]
    if (!target) return
    await moveQueueItem(queue[idx].id, target.queue_order)
    await moveQueueItem(target.id, queue[idx].queue_order)
    await reloadQueue()
  }

  if (!auction) {
    return (
      <AppShell title="Queue">
        <RoleGate allow={['admin']}>
          <p className="text-teal-400">No auction selected. Create or select one on the Auctions screen.</p>
        </RoleGate>
      </AppShell>
    )
  }

  return (
    <AppShell title="Queue">
      <RoleGate allow={['admin']}>
        {/* Tab bar */}
        <div className="flex gap-1 border-b border-teal-700/40 pb-px mb-5 overflow-x-auto scrollbar-none">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg transition ${tab === t ? 'bg-ink-800/60 text-gold border border-teal-700/40 border-b-transparent -mb-px' : 'text-teal-300 hover:text-white'}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'Queue' && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              <button onClick={async () => { await generateQueue(auction.id); reloadQueue() }}
                className="px-3 py-1 rounded bg-gold text-ink-900 text-sm">Generate Random Queue</button>
            </div>
            <div className="space-y-2">
              {queue.map((q) => (
                <div key={q.id} className="border border-teal-700/40 rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 bg-ink-800/60">
                  <div>
                    <p>{q.queue_order}. {q.players?.name}</p>
                    <p className="text-xs text-teal-300">{q.status} · {q.category}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => reorder(q.id, -1)} className="px-2 py-1 rounded text-xs bg-teal-700/50">Up</button>
                    <button onClick={() => reorder(q.id, 1)} className="px-2 py-1 rounded text-xs bg-teal-700/50">Down</button>
                    <button
                      onClick={async () => {
                        if (!window.confirm(`Set "${q.players?.name}" as the current player? This will advance the auction.`)) return
                        await startPlayer(q.player_id)
                        reloadQueue()
                      }}
                      className="px-2 py-1 rounded text-xs bg-gold text-ink-900 font-semibold">
                      Set Current
                    </button>
                  </div>
                </div>
              ))}
              {queue.length === 0 && <p className="text-teal-500 text-sm">Queue is empty — generate it above.</p>}
            </div>
          </>
        )}

        {tab === 'Unsold / Re-auction' && (
          <div className="space-y-2">
            {unsold.map((p) => (
              <div key={p.id} className="rounded-lg border border-teal-700/40 bg-ink-800/60 p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                  <p>{p.name}</p>
                  <p className="text-xs text-teal-300">{p.status} · {p.category}</p>
                </div>
                <button onClick={async () => { await startPlayer(p.id); reloadUnsold(); reloadQueue() }}
                  className="px-3 py-1 rounded bg-gold text-ink-900 text-sm">Bring to Auction</button>
              </div>
            ))}
            {unsold.length === 0 && <p className="text-teal-500">No unsold/reauction players right now.</p>}
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
