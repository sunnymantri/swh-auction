import { useEffect, useState } from 'react'
import AppShell from '../components/layout/AppShell'
import RoleGate from '../components/common/RoleGate'
import { useActiveAuction } from '../hooks/useActiveAuction'
import { getUnsoldOrReauction, startPlayer } from '../lib/api'

export default function UnsoldReauctionQueue() {
  const { auction } = useActiveAuction()
  const [items, setItems] = useState([])
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const reload = async () => {
    if (!auction) return
    const rows = await getUnsoldOrReauction(auction.id)
    // Defensive UI guard: this screen should only list unsold/reauction rows.
    setItems((rows ?? []).filter((p) => p?.status === 'unsold' || p?.status === 'reauction'))
  }

  useEffect(() => { reload() }, [auction])

  return (
    <AppShell title="Unsold / Re-auction Queue">
      <RoleGate allow={['admin']}>
        <div className="mb-3 rounded-lg border border-teal-700/40 bg-ink-900/40 p-3 text-xs text-teal-300">
          This view is maintained for compatibility. Prefer the consolidated queue workflow in the main Queue page.
        </div>
        <div className="space-y-2">
          {errorMsg && (
            <div className="rounded-lg border border-live/50 bg-live/10 px-3 py-2 text-sm text-live">
              {errorMsg}
            </div>
          )}
          {items.map((p) => (
            <div key={p.id} className="rounded-lg border border-teal-700/40 bg-ink-800/60 p-3 flex justify-between items-center">
              <div>
                <p>{p.name}</p>
                <p className="text-xs text-teal-300">
                  {p.status} · {p.category}
                </p>
              </div>
              <button
                disabled={busy}
                onClick={async () => {
                  if (busy) return
                  setBusy(true)
                  setErrorMsg('')
                  try {
                    await startPlayer(p.id)
                    await reload()
                  } finally {
                    setBusy(false)
                  }
                }}
                className="px-3 py-1 rounded bg-gold text-ink-900 text-sm disabled:opacity-40"
              >
                Bring to Auction
              </button>
            </div>
          ))}
          {items.length === 0 && <p className="text-teal-500">No unsold/reauction players right now.</p>}
        </div>
      </RoleGate>
    </AppShell>
  )
}

