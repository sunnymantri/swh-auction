import { useEffect, useRef, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { generateQueue, getQueue, moveQueueItem, startPlayer, getUnsoldOrReauction } from '../lib/api'

const TABS = ['Queue', 'Unsold / Re-auction']
const START_ELIGIBLE_STATUSES = new Set(['ready_for_auction', 'reauction'])

export default function QueueManagement() {
  const { auction } = useActiveAuction()
  const [tab, setTab] = useState('Queue')
  const [queue, setQueue] = useState([])
  const [unsold, setUnsold] = useState([])
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [infoMsg, setInfoMsg] = useState('')
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)
  const dragIdRef = useRef(null)

  const reloadQueue = async () => {
    if (!auction) return
    setQueue(await getQueue(auction.id))
  }
  const reloadUnsold = async () => {
    if (!auction) return
    const rows = await getUnsoldOrReauction(auction.id)
    // Defensive UI guard: never show non-unsold rows in this tab.
    setUnsold((rows ?? []).filter((p) => p?.status === 'unsold' || p?.status === 'reauction'))
  }
  useEffect(() => { reloadQueue(); reloadUnsold() }, [auction])

  const handleDrop = async (toId) => {
    const fromId = dragIdRef.current
    setDragId(null); setDragOverId(null); dragIdRef.current = null
    if (!fromId || fromId === toId) return
    const pending = queue.filter(q => q.status !== 'completed')
    const fromIdx = pending.findIndex(q => q.id === fromId)
    const toIdx = pending.findIndex(q => q.id === toId)
    if (fromIdx < 0 || toIdx < 0) return
    const arr = [...pending]
    const [item] = arr.splice(fromIdx, 1)
    arr.splice(toIdx, 0, item)
    setBusy(true); setErrorMsg('')
    try {
      await Promise.all(arr.map((q, i) => moveQueueItem(q.id, i + 1)))
      await reloadQueue()
    } catch (e) {
      setErrorMsg(e.message || 'Reorder failed.')
    } finally {
      setBusy(false)
    }
  }

  const reorder = async (id, direction) => {
    if (busy) return
    setErrorMsg('')
    const idx = queue.findIndex((q) => q.id === id)
    const target = queue[idx + direction]
    if (!target) return
    setBusy(true)
    try {
      await moveQueueItem(queue[idx].id, target.queue_order)
      await moveQueueItem(target.id, queue[idx].queue_order)
      await reloadQueue()
    } catch (e) {
      setErrorMsg(e.message || 'Could not reorder queue.')
    } finally {
      setBusy(false)
    }
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
              <button onClick={async () => {
                if (busy) return
                setErrorMsg('')
                setInfoMsg('')
                setBusy(true)
                try {
                  const generated = await generateQueue(auction.id)
                  await reloadQueue()
                  const count = Number(generated || 0)
                  if (count > 0) setInfoMsg(`Queue generated: ${count} player${count === 1 ? '' : 's'} added.`)
                  else setInfoMsg('No ready-for-auction unsold players found for queue generation.')
                } catch (e) {
                  setErrorMsg(e.message || 'Queue generation failed.')
                } finally {
                  setBusy(false)
                }
              }}
                disabled={busy}
                className="px-3 py-1 rounded bg-gold text-ink-900 text-sm disabled:opacity-40">Generate Random Queue</button>
            </div>
            {errorMsg && (
              <div className="mb-3 rounded-lg border border-live/50 bg-live/10 px-3 py-2 text-sm text-live">
                {errorMsg}
              </div>
            )}
            {infoMsg && (
              <div className="mb-3 rounded-lg border border-teal-700/40 bg-teal-900/30 px-3 py-2 text-sm text-teal-200">
                {infoMsg}
              </div>
            )}
            {(() => {
              const pending = queue.filter(q => q.status !== 'completed')
              const completed = queue.filter(q => q.status === 'completed')
              return (
                <>
                  <div className="space-y-2">
                    {pending.map((q, idx) => (
                      (() => {
                        const playerStatus = q.players?.status || ''
                        const isCurrentRow = q.status === 'current'
                        const canSetCurrent = !isCurrentRow && START_ELIGIBLE_STATUSES.has(playerStatus)
                        const isIneligible = !isCurrentRow && !canSetCurrent
                        return (
                      <div key={q.id}
                        draggable={!busy && q.status !== 'current'}
                        onDragStart={() => { setDragId(q.id); dragIdRef.current = q.id }}
                        onDragOver={(e) => { e.preventDefault(); setDragOverId(q.id) }}
                        onDragLeave={() => setDragOverId(null)}
                        onDrop={() => handleDrop(q.id)}
                        onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                        className={`border rounded-lg p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 transition-all
                          ${q.status === 'current' ? 'border-gold bg-gold/10' : 'border-teal-700/40 bg-ink-800/60'}
                          ${dragOverId === q.id && dragId !== q.id ? 'border-teal-400 bg-teal-900/30 scale-[1.01]' : ''}
                          ${dragId === q.id ? 'opacity-50' : ''}
                          ${!busy && q.status !== 'current' ? 'cursor-grab active:cursor-grabbing' : ''}
                        `}>
                        <div className="flex items-center gap-2 min-w-0">
                          {!busy && q.status !== 'current' && (
                            <span className="text-teal-600 text-lg select-none shrink-0" title="Drag to reorder">⠿</span>
                          )}
                          <div>
                            <p>{isCurrentRow ? '▶' : idx + 1}. {q.players?.name}</p>
                            <p className="text-xs text-teal-300">
                              {q.status} · {q.category}
                              {isIneligible && (
                                <span className="text-live"> · Not eligible ({playerStatus || 'unknown'})</span>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button disabled={busy || isCurrentRow} onClick={() => reorder(q.id, -1)} className="px-2 py-1 rounded text-xs bg-teal-700/50 disabled:opacity-40">Up</button>
                          <button disabled={busy || isCurrentRow} onClick={() => reorder(q.id, 1)} className="px-2 py-1 rounded text-xs bg-teal-700/50 disabled:opacity-40">Down</button>
                          {isCurrentRow ? (
                            <span className="px-2 py-1 rounded text-xs bg-gold/30 text-gold font-semibold cursor-default">
                              Current
                            </span>
                          ) : isIneligible ? (
                            <span className="px-2 py-1 rounded text-xs bg-live/20 text-live cursor-default">
                              Ineligible
                            </span>
                          ) : (
                            <button
                              onClick={async () => {
                                if (!window.confirm(`Set "${q.players?.name}" as the current player? This will advance the auction.`)) return
                                if (busy) return
                                setErrorMsg('')
                                setBusy(true)
                                try {
                                  await startPlayer(q.player_id)
                                  await reloadQueue()
                                } catch (e) {
                                  setErrorMsg(e.message || 'Could not set current player.')
                                } finally {
                                  setBusy(false)
                                }
                              }}
                              disabled={busy}
                              className="px-2 py-1 rounded text-xs bg-gold text-ink-900 font-semibold">
                              Set Current
                            </button>
                          )}
                        </div>
                      </div>
                        )
                      })()
                    ))}
                    {pending.length === 0 && <p className="text-teal-500 text-sm">Queue is empty — generate it above.</p>}
                  </div>
                  {completed.length > 0 && (
                    <details className="mt-4">
                      <summary className="text-xs text-teal-400 cursor-pointer hover:text-teal-200">
                        {completed.length} sold player{completed.length !== 1 ? 's' : ''}
                      </summary>
                      <div className="space-y-1 mt-2 opacity-60">
                        {completed.map((q) => (
                          (() => {
                            const playerStatus = q.players?.status || ''
                            const isCurrentRow = q.status === 'current'
                            const canSetCurrent = !isCurrentRow && START_ELIGIBLE_STATUSES.has(playerStatus)
                            const isIneligible = !isCurrentRow && !canSetCurrent
                            return (
                          <div key={q.id} className="border border-teal-700/20 rounded-lg p-2 bg-ink-900/40 flex justify-between items-center">
                            <div>
                              <p className="text-sm">{q.queue_order}. {q.players?.name}</p>
                              <p className="text-xs text-teal-400">
                                {q.status} · {q.category}
                                {isIneligible && (
                                  <span className="text-live"> · Not eligible ({playerStatus || 'unknown'})</span>
                                )}
                              </p>
                            </div>
                            {isCurrentRow ? (
                              <span className="px-2 py-1 rounded text-xs bg-gold/30 text-gold font-semibold cursor-default">
                                Current
                              </span>
                            ) : isIneligible ? (
                              <span className="px-2 py-1 rounded text-xs bg-live/20 text-live cursor-default">
                                Ineligible
                              </span>
                            ) : (
                              <button
                                onClick={async () => {
                                  if (!window.confirm(`Re-start "${q.players?.name}"? This will bring them back to auction.`)) return
                                  if (busy) return
                                  setErrorMsg('')
                                  setBusy(true)
                                  try {
                                    await startPlayer(q.player_id)
                                    await reloadQueue()
                                  } catch (e) {
                                    setErrorMsg(e.message || 'Could not restart player.')
                                  } finally {
                                    setBusy(false)
                                  }
                                }}
                                disabled={busy}
                                className="px-2 py-1 rounded text-xs bg-gold text-ink-900 font-semibold">
                                Set Current
                              </button>
                            )}
                          </div>
                            )
                          })()
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )
            })()}
          </>
        )}

        {tab === 'Unsold / Re-auction' && (
          <div className="space-y-2">
            {unsold.map((p) => (
              <div key={p.id} className="rounded-lg border border-teal-700/40 bg-ink-800/60 p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                <div>
                  <p>{p.name}</p>
                  <p className="text-xs text-teal-300">
                    {p.status} · {p.category}
                  </p>
                </div>
                <button onClick={async () => {
                  if (busy) return
                  setBusy(true)
                  try { await startPlayer(p.id); reloadUnsold(); reloadQueue() } finally { setBusy(false) }
                }}
                  disabled={busy}
                  className="px-3 py-1 rounded bg-gold text-ink-900 text-sm disabled:opacity-40">Bring to Auction</button>
              </div>
            ))}
            {unsold.length === 0 && <p className="text-teal-500">No unsold/reauction players right now.</p>}
          </div>
        )}
      </RoleGate>
    </AppShell>
  )
}
